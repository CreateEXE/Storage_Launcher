package com.savagestorage.vrm

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.documentfile.provider.DocumentFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class SafStorageBridge(
    private val activity: Activity,
    private val webView: WebView
) {

    companion object {
        private const val TAG = "SafStorageBridge"
        private const val PREF_SAF_URI = "saf_persisted_tree_uri"
        const val SAF_REQUEST_CODE = 2001
    }

    private val context: Context get() = activity.applicationContext

    private fun getSharedPreferences() =
        context.getSharedPreferences("saf_storage_prefs", Context.MODE_PRIVATE)

    // JavascriptInterface calls carry no origin or auth token. Only answer
    // the bundled app page: the WebViewAssetLoader origin
    // (https://appassets.android.com/) or, as a fallback, the legacy
    // file:///android_asset/ origin. A remote page, or any other file://
    // page, loaded in the WebView must not reach SAF documents. This is an
    // origin check, not a cryptographic token, and SAF itself still only
    // exposes the user-granted persisted tree.
    private fun isTrustedOrigin(): Boolean {
        val url = try { webView.url } catch (e: Exception) { null }
        return url != null && (url.startsWith("file:///android_asset/")
                || url.startsWith("https://appassets.android.com/"))
    }

    private fun checkTrusted(): Boolean {
        if (!isTrustedOrigin()) {
            Log.w(TAG, "Blocked SafStorage call from untrusted origin: ${try { webView.url } catch (e: Exception) { null }}")
            return false
        }
        return true
    }

    @JavascriptInterface
    public fun getPersistedUriString(): String {
        if (!checkTrusted()) return ""
        return getSharedPreferences().getString(PREF_SAF_URI, "") ?: ""
    }

    @JavascriptInterface
    public fun hasPersistedPermission(): Boolean {
        if (!checkTrusted()) return false
        val uriString = getSharedPreferences().getString(PREF_SAF_URI, "") ?: ""
        if (uriString.isEmpty()) return false

        try {
            val treeUri = Uri.parse(uriString)
            val persistedPermissions = context.contentResolver.persistedUriPermissions
            val hasPerm = persistedPermissions.any {
                it.uri == treeUri && it.isReadPermission && it.isWritePermission
            }
            if (hasPerm) {
                val doc = DocumentFile.fromTreeUri(context, treeUri)
                return doc != null && doc.canRead() && doc.canWrite()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking SAF persisted permission", e)
        }
        return false
    }

    @JavascriptInterface
    public fun openDocumentTree() {
        if (!checkTrusted()) return
        activity.runOnUiThread {
            try {
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                    addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
                    addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
                }
                activity.startActivityForResult(intent, SAF_REQUEST_CODE)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to launch ACTION_OPEN_DOCUMENT_TREE intent", e)
            }
        }
    }

    public fun handleActivityResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
        if (requestCode == SAF_REQUEST_CODE) {
            if (resultCode == Activity.RESULT_OK && data != null && data.data != null) {
                val treeUri: Uri = data.data!!
                try {
                    val takeFlags = (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                    context.contentResolver.takePersistableUriPermission(treeUri, takeFlags)

                    getSharedPreferences().edit()
                        .putString(PREF_SAF_URI, treeUri.toString())
                        .apply()

                    Log.i(TAG, "SAF Persisted Tree URI granted: $treeUri")

                    // Notify web frontend
                    webView.post {
                        webView.evaluateJavascript("window.onSafPermissionGranted && window.onSafPermissionGranted('${treeUri}');", null)
                    }
                    return true
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to take persistable URI permission", e)
                }
            }
        }
        return false
    }

    private fun getDocumentFileFromUriOrPath(uriOrPath: String?): DocumentFile? {
        if (uriOrPath.isNullOrBlank() || uriOrPath == "/") {
            val rootUriStr = getPersistedUriString()
            if (rootUriStr.isNotEmpty()) {
                return DocumentFile.fromTreeUri(context, Uri.parse(rootUriStr))
            }
            return null
        }

        return try {
            if (uriOrPath.startsWith("content://")) {
                val uri = Uri.parse(uriOrPath)
                if (uriOrPath.contains("/tree/") && !uriOrPath.contains("/document/")) {
                    DocumentFile.fromTreeUri(context, uri)
                } else {
                    DocumentFile.fromSingleUri(context, uri)
                }
            } else {
                val rootUriStr = getPersistedUriString()
                if (rootUriStr.isEmpty()) return null

                val rootDoc = DocumentFile.fromTreeUri(context, Uri.parse(rootUriStr)) ?: return null
                val cleanPath = uriOrPath.trim('/').removePrefix("storage/emulated/0").trim('/')

                if (cleanPath.isEmpty()) return rootDoc

                var current: DocumentFile = rootDoc
                val segments = cleanPath.split('/')
                for (seg in segments) {
                    if (seg.isBlank()) continue
                    val found = current.findFile(seg) ?: return null
                    current = found
                }
                current
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error resolving DocumentFile for: $uriOrPath", e)
            null
        }
    }

    @JavascriptInterface
    public fun listSafDirectory(uriOrPath: String?): String {
        if (!checkTrusted()) return "[]"
        try {
            val rootUriStr = getPersistedUriString()
            if (rootUriStr.isEmpty()) return "[]"
            val treeUri = Uri.parse(rootUriStr)

            val docDir = getDocumentFileFromUriOrPath(uriOrPath) ?: return "[]"
            val targetUri = docDir.uri

            val array = JSONArray()
            val sdf = SimpleDateFormat("MM/dd HH:mm", Locale.US)

            // Fast path: query via DocumentsContract child documents cursor
            var cursorUsed = false
            try {
                val docId = if (DocumentsContract.isDocumentUri(context, targetUri)) {
                    DocumentsContract.getDocumentId(targetUri)
                } else {
                    DocumentsContract.getTreeDocumentId(treeUri)
                }

                val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, docId)
                val projection = arrayOf(
                    DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                    DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                    DocumentsContract.Document.COLUMN_MIME_TYPE,
                    DocumentsContract.Document.COLUMN_SIZE,
                    DocumentsContract.Document.COLUMN_LAST_MODIFIED
                )

                val cursor = context.contentResolver.query(childrenUri, projection, null, null, null)
                if (cursor != null) {
                    cursor.use { c ->
                        var count = 0
                        while (c.moveToNext() && count < 800) {
                            val childDocId = c.getString(0) ?: continue
                            val name = c.getString(1) ?: "Unknown"
                            val mime = c.getString(2) ?: ""
                            val size = if (c.isNull(3)) 0L else c.getLong(3)
                            val lastMod = if (c.isNull(4)) 0L else c.getLong(4)
                            val isFolder = mime == DocumentsContract.Document.MIME_TYPE_DIR
                            val childUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, childDocId)

                            val obj = JSONObject()
                            obj.put("name", name)
                            obj.put("uri", childUri.toString())
                            obj.put("isFolder", isFolder)
                            obj.put("sizeBytes", if (isFolder) 0L else size)
                            obj.put("modified", sdf.format(Date(lastMod)))

                            var ext = ""
                            val dotIdx = name.lastIndexOf('.')
                            if (dotIdx > 0) ext = name.substring(dotIdx + 1).lowercase(Locale.US)

                            var type = "File"
                            if (isFolder) type = "Folder"
                            else if (ext == "vrm") type = "VRM"
                            else if (ext == "glb" || ext == "gltf") type = "glTF"
                            else if (ext == "png" || ext == "jpg" || ext == "jpeg") type = "Image"
                            else if (ext == "json") type = "JSON"
                            else if (ext == "txt" || ext == "md" || ext == "sh" || ext == "cpp") type = "Text"

                            obj.put("type", type)
                            array.put(obj)
                            count++
                        }
                    }
                    cursorUsed = true
                }
            } catch (ce: Exception) {
                Log.w(TAG, "Cursor query failed, falling back to DocumentFile.listFiles: ${ce.message}")
            }

            if (!cursorUsed) {
                val files = docDir.listFiles()
                val limit = Math.min(files.size, 500)
                for (idx in 0 until limit) {
                    val file = files[idx]
                    val obj = JSONObject()
                    val name = file.name ?: "Unknown"
                    obj.put("name", name)
                    obj.put("uri", file.uri.toString())
                    obj.put("isFolder", file.isDirectory)
                    obj.put("sizeBytes", if (file.isDirectory) 0L else file.length())
                    obj.put("modified", sdf.format(Date(file.lastModified())))

                    var ext = ""
                    val dotIdx = name.lastIndexOf('.')
                    if (dotIdx > 0) ext = name.substring(dotIdx + 1).lowercase(Locale.US)

                    var type = "File"
                    if (file.isDirectory) type = "Folder"
                    else if (ext == "vrm") type = "VRM"
                    else if (ext == "glb" || ext == "gltf") type = "glTF"
                    else if (ext == "png" || ext == "jpg" || ext == "jpeg") type = "Image"
                    else if (ext == "json") type = "JSON"
                    else if (ext == "txt" || ext == "md" || ext == "sh" || ext == "cpp") type = "Text"

                    obj.put("type", type)
                    array.put(obj)
                }
            }

            return array.toString()
        } catch (e: Exception) {
            Log.e(TAG, "Error listing SAF directory: $uriOrPath", e)
            return "[]"
        }
    }

    @JavascriptInterface
    public fun readSafFileAsString(fileUriStr: String): String {
        if (!checkTrusted()) return ""
        return try {
            val uri = Uri.parse(fileUriStr)
            val inputStream: InputStream? = context.contentResolver.openInputStream(uri)
            if (inputStream != null) {
                val bytes = inputStream.readBytes()
                inputStream.close()
                String(bytes, Charsets.UTF_8)
            } else ""
        } catch (e: Exception) {
            Log.e(TAG, "Error reading SAF file as string: $fileUriStr", e)
            ""
        }
    }

    @JavascriptInterface
    public fun readSafFileAsBase64(fileUriStr: String): String {
        if (!checkTrusted()) return ""
        return try {
            val uri = Uri.parse(fileUriStr)
            val inputStream: InputStream? = context.contentResolver.openInputStream(uri)
            if (inputStream != null) {
                val buffer = ByteArrayOutputStream()
                val data = ByteArray(16384)
                var nRead: Int
                var total = 0
                val maxLimit = 30 * 1024 * 1024 // 30MB max for Base64 to prevent OOM
                while (inputStream.read(data, 0, data.size).also { nRead = it } != -1) {
                    buffer.write(data, 0, nRead)
                    total += nRead
                    if (total > maxLimit) {
                        Log.w(TAG, "File exceeded Base64 limit, stream directly via Content URI instead")
                        break
                    }
                }
                inputStream.close()
                Base64.encodeToString(buffer.toByteArray(), Base64.NO_WRAP)
            } else ""
        } catch (e: Exception) {
            Log.e(TAG, "Error reading SAF file as base64: $fileUriStr", e)
            ""
        }
    }

    @JavascriptInterface
    public fun writeSafFile(parentUriOrPath: String, fileName: String, content: String, isBase64: Boolean): String {
        if (!checkTrusted()) return ""
        return try {
            val parentDoc = getDocumentFileFromUriOrPath(parentUriOrPath) ?: return ""

            var mimeType = "text/plain"
            if (fileName.endsWith(".vrm") || fileName.endsWith(".glb") || fileName.endsWith(".gltf")) {
                mimeType = "application/octet-stream"
            } else if (fileName.endsWith(".json")) {
                mimeType = "application/json"
            } else if (fileName.endsWith(".png")) {
                mimeType = "image/png"
            } else if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) {
                mimeType = "image/jpeg"
            }

            var targetFile = parentDoc.findFile(fileName)
            if (targetFile == null) {
                targetFile = parentDoc.createFile(mimeType, fileName)
            }

            if (targetFile != null) {
                val bytes = if (isBase64) {
                    var cleanData = content
                    if (cleanData.contains(",")) {
                        cleanData = cleanData.substring(cleanData.indexOf(",") + 1)
                    }
                    Base64.decode(cleanData, Base64.NO_WRAP)
                } else {
                    content.toByteArray(Charsets.UTF_8)
                }

                context.contentResolver.openOutputStream(targetFile.uri, "w")?.use { os ->
                    os.write(bytes)
                    os.flush()
                }
                return targetFile.uri.toString()
            }
            ""
        } catch (e: Exception) {
            Log.e(TAG, "Error writing SAF file: $fileName", e)
            ""
        }
    }

    @JavascriptInterface
    public fun createSafDirectory(parentUriOrPath: String, dirName: String): String {
        if (!checkTrusted()) return ""
        return try {
            val parentDoc = getDocumentFileFromUriOrPath(parentUriOrPath) ?: return ""
            var existing = parentDoc.findFile(dirName)
            if (existing == null) {
                existing = parentDoc.createDirectory(dirName)
            }
            existing?.uri?.toString() ?: ""
        } catch (e: Exception) {
            Log.e(TAG, "Error creating SAF directory: $dirName", e)
            ""
        }
    }

    @JavascriptInterface
    public fun deleteSafDocument(documentUriStr: String): Boolean {
        if (!checkTrusted()) return false
        return try {
            val doc = getDocumentFileFromUriOrPath(documentUriStr) ?: return false
            doc.delete()
        } catch (e: Exception) {
            Log.e(TAG, "Error deleting SAF document: $documentUriStr", e)
            false
        }
    }
}

