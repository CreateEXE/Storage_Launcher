package com.savagestorage.vrm

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.documentfile.provider.DocumentFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

class SafStorageBridge(
    private val activity: Activity,
    private val webView: WebView
) {
    companion object {
        private const val TAG = "SafStorageBridge"
        private const val PREF_SAF_URI = "saf_persisted_tree_uri"
        const val SAF_REQUEST_CODE = 2001
        private const val MAX_TEXT_BYTES = 10 * 1024 * 1024
        private const val MAX_BASE64_BYTES = 30 * 1024 * 1024
    }

    private val context: Context get() = activity.applicationContext
    // Content URI paths are provider-defined. Remember the actual tree-backed DocumentFile
    // objects discovered during listing rather than deriving parents from URI string slashes.
    private val documents = ConcurrentHashMap<String, DocumentFile>()
    private val parents = ConcurrentHashMap<String, String>()

    private fun prefs() = context.getSharedPreferences("saf_storage_prefs", Context.MODE_PRIVATE)
    private fun rootUri(): Uri? = getPersistedUriString().takeIf { it.isNotBlank() }?.let(Uri::parse)
    private fun rootDocument(): DocumentFile? = rootUri()?.let { DocumentFile.fromTreeUri(context, it) }

    @JavascriptInterface
    public fun getPersistedUriString(): String = prefs().getString(PREF_SAF_URI, "") ?: ""

    @JavascriptInterface
    public fun hasPersistedPermission(): Boolean {
        val uri = rootUri() ?: return false
        return try {
            val permission = context.contentResolver.persistedUriPermissions.firstOrNull { it.uri == uri } ?: return false
            permission.isReadPermission && permission.isWritePermission &&
                (DocumentFile.fromTreeUri(context, uri)?.let { it.canRead() && it.canWrite() } == true)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking SAF persisted permission", e)
            false
        }
    }

    @JavascriptInterface
    public fun openDocumentTree() {
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
                Log.e(TAG, "Failed to launch ACTION_OPEN_DOCUMENT_TREE", e)
            }
        }
    }

    public fun handleActivityResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
        if (requestCode != SAF_REQUEST_CODE) return false
        if (resultCode != Activity.RESULT_OK || data?.data == null) return true
        val uri = data.data!!
        try {
            val grantFlags = data.flags and (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            context.contentResolver.takePersistableUriPermission(uri, grantFlags)
            prefs().edit().putString(PREF_SAF_URI, uri.toString()).apply()
            documents.clear()
            parents.clear()
            webView.post {
                val safeUri = JSONObject.quote(uri.toString())
                webView.evaluateJavascript("window.onSafPermissionGranted && window.onSafPermissionGranted($safeUri);", null)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to persist SAF permission", e)
        }
        return true
    }

    private fun resolve(uriOrPath: String?): DocumentFile? {
        val treeUri = rootUri() ?: return null
        val root = DocumentFile.fromTreeUri(context, treeUri) ?: return null
        if (uriOrPath.isNullOrBlank() || uriOrPath == "/" || uriOrPath == treeUri.toString() || uriOrPath == root.uri.toString()) {
            documents[root.uri.toString()] = root
            return root
        }

        if (uriOrPath.startsWith("content://")) {
            documents[uriOrPath]?.let { return it }
            return try {
                val inputUri = Uri.parse(uriOrPath)
                if (inputUri.authority != treeUri.authority) return null
                val targetId = when {
                    DocumentsContract.isTreeUri(inputUri) -> DocumentsContract.getTreeDocumentId(inputUri)
                    DocumentsContract.isDocumentUri(context, inputUri) -> DocumentsContract.getDocumentId(inputUri)
                    else -> return null
                }
                val rootId = DocumentsContract.getTreeDocumentId(treeUri)
                if (targetId == rootId) return root

                // SAF IDs are opaque and may contain slashes. Walk the selected tree and compare
                // document IDs; all returned DocumentFiles keep the persisted tree context.
                val queue = java.util.ArrayDeque<DocumentFile>()
                queue.add(root)
                while (!queue.isEmpty()) {
                    val current = queue.removeFirst()
                    for (child in current.listFiles()) {
                        val childId = try { DocumentsContract.getDocumentId(child.uri) } catch (_: Exception) { null }
                        documents[child.uri.toString()] = child
                        parents[child.uri.toString()] = current.uri.toString()
                        if (childId == targetId) return child
                        if (child.isDirectory) queue.addLast(child)
                    }
                }
                null
            } catch (e: Exception) {
                Log.e(TAG, "Could not resolve SAF URI: $uriOrPath", e)
                null
            }
        }

        val cleanPath = uriOrPath.trim('/').removePrefix("storage/emulated/0").trim('/')
        if (cleanPath.isEmpty()) return root
        var current = root
        for (segment in cleanPath.split('/').filter { it.isNotBlank() }) {
            current = current.findFile(segment) ?: return null
        }
        return current
    }

    @JavascriptInterface
    public fun resolveParentDocumentUri(documentUriStr: String): String {
        if (documentUriStr.isBlank()) return ""
        return parents[documentUriStr] ?: rootDocument()?.uri?.toString().orEmpty()
    }

    private fun appendItem(array: JSONArray, child: DocumentFile, parentUri: String, size: Long, modified: Long) {
        val uri = child.uri.toString()
        documents[uri] = child
        parents[uri] = parentUri
        val name = child.name ?: "Unknown"
        val isFolder = child.isDirectory
        val ext = name.substringAfterLast('.', "").lowercase(Locale.US)
        val type = when {
            isFolder -> "Folder"
            ext == "vrm" -> "VRM"
            ext == "glb" || ext == "gltf" -> "glTF"
            ext in setOf("png", "jpg", "jpeg") -> "Image"
            ext == "json" -> "JSON"
            ext in setOf("txt", "md", "sh", "cpp") -> "Text"
            else -> "File"
        }
        array.put(JSONObject().apply {
            put("name", name)
            put("uri", uri)
            put("isFolder", isFolder)
            put("sizeBytes", if (isFolder) 0L else size)
            put("modified", SimpleDateFormat("MM/dd HH:mm", Locale.US).format(Date(modified)))
            put("type", type)
        })
    }

    @JavascriptInterface
    public fun listSafDirectory(uriOrPath: String?): String {
        return try {
            val directory = resolve(uriOrPath) ?: return "[]"
            if (!directory.isDirectory) return "[]"
            val children = directory.listFiles()
            val results = JSONArray()
            children.take(800).forEach { child -> appendItem(results, child, directory.uri.toString(), child.length(), child.lastModified()) }
            results.toString()
        } catch (e: Exception) {
            Log.e(TAG, "Error listing SAF directory: $uriOrPath", e)
            "[]"
        }
    }

    private fun readBounded(uri: Uri, maxBytes: Int): ByteArray? {
        val input = context.contentResolver.openInputStream(uri) ?: return null
        input.use { stream ->
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(16 * 1024)
            var total = 0
            while (true) {
                val count = stream.read(buffer)
                if (count < 0) break
                total += count
                if (total > maxBytes) return null
                output.write(buffer, 0, count)
            }
            return output.toByteArray()
        }
    }

    @JavascriptInterface
    public fun readSafFileAsString(fileUriStr: String): String {
        return try {
            val document = resolve(fileUriStr) ?: return ""
            val bytes = readBounded(document.uri, MAX_TEXT_BYTES) ?: return ""
            String(bytes, Charsets.UTF_8)
        } catch (e: Exception) {
            Log.e(TAG, "Error reading SAF text file", e)
            ""
        }
    }

    @JavascriptInterface
    public fun readSafFileAsBase64(fileUriStr: String): String {
        return try {
            val document = resolve(fileUriStr) ?: return ""
            val bytes = readBounded(document.uri, MAX_BASE64_BYTES) ?: return ""
            Base64.encodeToString(bytes, Base64.NO_WRAP)
        } catch (e: Exception) {
            Log.e(TAG, "Error reading SAF binary file", e)
            ""
        }
    }

    @JavascriptInterface
    public fun writeSafFile(parentUriOrPath: String, fileName: String, content: String, isBase64: Boolean): String {
        return try {
            val parent = resolve(parentUriOrPath) ?: return ""
            if (!parent.isDirectory || fileName.isBlank() || fileName.contains('/') || fileName.contains('\\')) return ""
            val mime = when (fileName.substringAfterLast('.', "").lowercase(Locale.US)) {
                "json" -> "application/json"
                "png" -> "image/png"
                "jpg", "jpeg" -> "image/jpeg"
                "vrm", "glb", "gltf", "obj" -> "application/octet-stream"
                else -> "text/plain"
            }
            val target = parent.findFile(fileName) ?: parent.createFile(mime, fileName) ?: return ""
            val bytes = if (isBase64) Base64.decode(content.substringAfter(',', content), Base64.DEFAULT) else content.toByteArray(Charsets.UTF_8)
            val output = context.contentResolver.openOutputStream(target.uri, "wt") ?: return ""
            output.use { it.write(bytes); it.flush() }
            val uri = target.uri.toString()
            documents[uri] = target
            parents[uri] = parent.uri.toString()
            uri
        } catch (e: Exception) {
            Log.e(TAG, "Error writing SAF file: $fileName", e)
            ""
        }
    }

    @JavascriptInterface
    public fun createSafDirectory(parentUriOrPath: String, dirName: String): String {
        return try {
            val parent = resolve(parentUriOrPath) ?: return ""
            if (!parent.isDirectory || dirName.isBlank() || dirName.contains('/') || dirName.contains('\\')) return ""
            val directory = parent.findFile(dirName) ?: parent.createDirectory(dirName) ?: return ""
            val uri = directory.uri.toString()
            documents[uri] = directory
            parents[uri] = parent.uri.toString()
            uri
        } catch (e: Exception) {
            Log.e(TAG, "Error creating SAF directory: $dirName", e)
            ""
        }
    }

    @JavascriptInterface
    public fun renameSafDocument(documentUriStr: String, newName: String): Boolean {
        if (newName.isBlank() || newName.contains('/') || newName.contains('\\')) return false
        return try {
            val document = resolve(documentUriStr) ?: return false
            val renamed = DocumentsContract.renameDocument(context.contentResolver, document.uri, newName) ?: return false
            documents.remove(documentUriStr)
            parents[renamed.toString()] = parents[documentUriStr] ?: rootDocument()?.uri?.toString().orEmpty()
            documents[renamed.toString()] = resolve(renamed.toString()) ?: document
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error renaming SAF document", e)
            false
        }
    }

    @JavascriptInterface
    public fun deleteSafDocument(documentUriStr: String): Boolean {
        return try {
            val document = resolve(documentUriStr) ?: return false
            val deleted = document.delete()
            if (deleted) {
                documents.remove(documentUriStr)
                parents.remove(documentUriStr)
            }
            deleted
        } catch (e: Exception) {
            Log.e(TAG, "Error deleting SAF document", e)
            false
        }
    }
}
