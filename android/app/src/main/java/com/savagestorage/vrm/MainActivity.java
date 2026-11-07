package com.savagestorage.vrm;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "SavageStorageMainActivity";
    private static final int PERMISSION_REQUEST_CODE = 1001;
    private static final int FILECHOOSER_RESULTCODE = 1002;

    private WebView webView;
    private ValueCallback<Uri[]> uploadMessage;
    private SafStorageBridge safStorageBridge;
    private WebViewAssetLoader assetLoader;
    private boolean loadErrorShown = false;

    // The bundled app is served over a real local HTTPS origin instead of
    // file:// (see assetLoader below). The bridges trust exactly this
    // origin, plus the legacy file:///android_asset/ origin as a fallback.
    private static final String APP_ORIGIN = "https://appassets.android.com/";
    private static final String APP_URL = "https://appassets.android.com/index.html";

    // JavascriptInterface calls carry no origin or auth token in the Android
    // API. The only check available here is the page currently loaded in
    // this WebView: bridges must only answer the bundled app page
    // (file:///android_asset/...). A remote page, or any other file:// page,
    // loaded in the WebView must not be able to call these bridges.
    // This is an origin check, not a cryptographic auth token; it stops the
    // reported hole (any loaded web content using the bridges) but any code
    // running inside the bundled app page itself is still trusted.
    private boolean isTrustedOrigin() {
        if (webView == null) return false;
        String url = webView.getUrl();
        return url != null && (url.startsWith("file:///android_asset/")
                || url.startsWith(APP_ORIGIN));
    }

    private boolean checkTrusted() {
        if (!isTrustedOrigin()) {
            Log.w(TAG, "Blocked JavascriptInterface call from untrusted origin: "
                    + (webView != null ? webView.getUrl() : null));
            return false;
        }
        return true;
    }

    private boolean isAllowedPath(File file) {
        try {
            String canonical = file.getCanonicalPath();
            File external = Environment.getExternalStorageDirectory();
            String externalRoot = external != null ? external.getCanonicalPath() : null;
            String appFiles = getFilesDir().getCanonicalPath();
            String cache = getCacheDir().getCanonicalPath();
            if (externalRoot != null && (canonical.equals(externalRoot) || canonical.startsWith(externalRoot + File.separator))) return true;
            if (canonical.equals(appFiles) || canonical.startsWith(appFiles + File.separator)) return true;
            if (canonical.equals(cache) || canonical.startsWith(cache + File.separator)) return true;
            Log.w(TAG, "Blocked file access outside allowed roots: " + canonical);
            return false;
        } catch (Exception e) {
            Log.e(TAG, "Error checking allowed path", e);
            return false;
        }
    }

    public class AndroidStorageBridge {

        @JavascriptInterface
        public boolean hasStoragePermission() {
            if (!checkTrusted()) return false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                return Environment.isExternalStorageManager();
            } else {
                int read = ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.READ_EXTERNAL_STORAGE);
                int write = ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.WRITE_EXTERNAL_STORAGE);
                return read == PackageManager.PERMISSION_GRANTED && write == PackageManager.PERMISSION_GRANTED;
            }
        }

        @JavascriptInterface
        public void requestStoragePermission() {
            if (!checkTrusted()) return;
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    try {
                        Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                        Uri uri = Uri.fromParts("package", getPackageName(), null);
                        intent.setData(uri);
                        startActivity(intent);
                    } catch (Exception e) {
                        try {
                            Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                            startActivity(intent);
                        } catch (Exception ex) {
                            Log.e(TAG, "Could not open manage storage settings", ex);
                        }
                    }
                } else {
                    ActivityCompat.requestPermissions(
                        MainActivity.this,
                        new String[]{
                            Manifest.permission.READ_EXTERNAL_STORAGE,
                            Manifest.permission.WRITE_EXTERNAL_STORAGE
                        },
                        PERMISSION_REQUEST_CODE
                    );
                }
            });
        }

        @JavascriptInterface
        public String getStorageRootPath() {
            if (!checkTrusted()) return "";
            File external = Environment.getExternalStorageDirectory();
            if (external != null && external.exists()) {
                return external.getAbsolutePath();
            }
            return getFilesDir().getAbsolutePath();
        }

        @JavascriptInterface
        public String listDirectory(String dirPath) {
            if (!checkTrusted()) return "[]";
            try {
                String targetPath = (dirPath == null || dirPath.trim().isEmpty() || dirPath.equals("/"))
                        ? getStorageRootPath()
                        : dirPath;

                File dir = new File(targetPath);
                if (!isAllowedPath(dir)) return "[]";
                if (!dir.exists() || !dir.isDirectory()) {
                    return "[]";
                }

                File[] files = dir.listFiles();
                if (files == null) {
                    return "[]";
                }

                // Sort directories first, then alphabetical, limit to 800 to avoid freezing
                Arrays.sort(files, (a, b) -> {
                    if (a.isDirectory() && !b.isDirectory()) return -1;
                    if (!a.isDirectory() && b.isDirectory()) return 1;
                    return a.getName().compareToIgnoreCase(b.getName());
                });

                JSONArray array = new JSONArray();
                SimpleDateFormat sdf = new SimpleDateFormat("MM/dd HH:mm", Locale.US);
                int limit = Math.min(files.length, 800);

                for (int idx = 0; idx < limit; idx++) {
                    File file = files[idx];
                    JSONObject obj = new JSONObject();
                    obj.put("name", file.getName());
                    obj.put("path", file.getAbsolutePath());
                    obj.put("isFolder", file.isDirectory());
                    obj.put("sizeBytes", file.isDirectory() ? 0 : file.length());
                    obj.put("modified", sdf.format(new Date(file.lastModified())));

                    String ext = "";
                    int i = file.getName().lastIndexOf('.');
                    if (i > 0) ext = file.getName().substring(i + 1).toLowerCase();

                    String type = "File";
                    if (file.isDirectory()) type = "Folder";
                    else if (ext.equals("vrm")) type = "VRM";
                    else if (ext.equals("glb") || ext.equals("gltf")) type = "glTF";
                    else if (ext.equals("png") || ext.equals("jpg") || ext.equals("jpeg")) type = "Image";
                    else if (ext.equals("json")) type = "JSON";
                    else if (ext.equals("txt") || ext.equals("md") || ext.equals("sh") || ext.equals("cpp")) type = "Text";

                    obj.put("type", type);
                    array.put(obj);
                }

                return array.toString();
            } catch (Exception e) {
                Log.e(TAG, "Error listing directory: " + dirPath, e);
                return "[]";
            }
        }

        @JavascriptInterface
        public String readFileAsBase64(String filePath) {
            if (!checkTrusted()) return "";
            try {
                File file = new File(filePath);
                if (!file.exists() || !file.isFile()) return "";
                if (!isAllowedPath(file)) return "";

                long length = file.length();
                if (length > 40 * 1024 * 1024) { // 40MB limit for Base64 to prevent OOM
                    Log.w(TAG, "File too large for Base64, should use streaming URI: " + filePath);
                    return "";
                }

                byte[] bytes = new byte[(int) length];
                try (FileInputStream fis = new FileInputStream(file)) {
                    // A single read() is not guaranteed to fill the buffer.
                    // Loop until full, and fail (return "") on a short read
                    // instead of encoding unwritten zero bytes as data.
                    int offset = 0;
                    while (offset < bytes.length) {
                        int read = fis.read(bytes, offset, bytes.length - offset);
                        if (read == -1) {
                            Log.e(TAG, "Short read reading file base64: " + filePath
                                    + " (" + offset + " of " + bytes.length + " bytes)");
                            return "";
                        }
                        offset += read;
                    }
                    return Base64.encodeToString(bytes, Base64.NO_WRAP);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error reading file base64: " + filePath, e);
            }
            return "";
        }

        @JavascriptInterface
        public String readFileAsString(String filePath) {
            if (!checkTrusted()) return "";
            try {
                File file = new File(filePath);
                if (!file.exists() || !file.isFile()) return "";
                if (!isAllowedPath(file)) return "";

                long length = file.length();
                if (length > 10 * 1024 * 1024) { // 10MB limit for text strings
                    return "";
                }

                byte[] bytes = new byte[(int) length];
                try (FileInputStream fis = new FileInputStream(file)) {
                    int offset = 0;
                    while (offset < bytes.length) {
                        int read = fis.read(bytes, offset, bytes.length - offset);
                        if (read == -1) {
                            Log.e(TAG, "Short read reading file string: " + filePath
                                    + " (" + offset + " of " + bytes.length + " bytes)");
                            return "";
                        }
                        offset += read;
                    }
                    return new String(bytes, "UTF-8");
                }
            } catch (Exception e) {
                Log.e(TAG, "Error reading file string: " + filePath, e);
            }
            return "";
        }

        @JavascriptInterface
        public boolean writeFile(String filePath, String dataContent, boolean isBase64) {
            if (!checkTrusted()) return false;
            try {
                File file = new File(filePath);
                if (!isAllowedPath(file)) return false;
                File parent = file.getParentFile();
                if (parent != null && !parent.exists()) {
                    parent.mkdirs();
                }

                byte[] bytes;
                if (isBase64) {
                    String base64Data = dataContent;
                    if (base64Data.contains(",")) {
                        base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
                    }
                    bytes = Base64.decode(base64Data, Base64.NO_WRAP);
                } else {
                    bytes = dataContent.getBytes("UTF-8");
                }

                try (FileOutputStream fos = new FileOutputStream(file)) {
                    fos.write(bytes);
                    fos.flush();
                }
                return true;
            } catch (Exception e) {
                Log.e(TAG, "Error writing file: " + filePath, e);
                return false;
            }
        }

        @JavascriptInterface
        public boolean deletePath(String filePath) {
            if (!checkTrusted()) return false;
            try {
                File file = new File(filePath);
                if (!isAllowedPath(file)) return false;
                if (!file.exists()) return false;
                if (file.isDirectory()) {
                    deleteRecursive(file);
                    return true;
                }
                return file.delete();
            } catch (Exception e) {
                Log.e(TAG, "Error deleting path: " + filePath, e);
                return false;
            }
        }

        private void deleteRecursive(File fileOrDirectory) {
            if (fileOrDirectory.isDirectory()) {
                File[] children = fileOrDirectory.listFiles();
                if (children != null) {
                    for (File child : children) {
                        deleteRecursive(child);
                    }
                }
            }
            fileOrDirectory.delete();
        }

        @JavascriptInterface
        public boolean createDirectory(String dirPath) {
            if (!checkTrusted()) return false;
            try {
                File dir = new File(dirPath);
                if (!isAllowedPath(dir)) return false;
                return dir.mkdirs() || dir.exists();
            } catch (Exception e) {
                Log.e(TAG, "Error creating directory: " + dirPath, e);
                return false;
            }
        }
    }

    // Shows a visible error screen instead of leaving the user on a blank
    // page when the bundled app fails to load. The retry button reloads the
    // app URL; loadErrorShown guards against an error loop.
    private void showLoadErrorPage(String detail) {
        if (webView == null || loadErrorShown) return;
        loadErrorShown = true;
        String safeDetail = detail == null ? "" : detail.replace("<", "&lt;").replace(">", "&gt;");
        String html = "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
                + "<style>body{background:#03060c;color:#e2e8f0;font-family:sans-serif;margin:0;"
                + "display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}"
                + "button{background:#0891b2;color:#fff;border:0;border-radius:8px;padding:12px 24px;"
                + "font-size:16px;margin-top:16px}</style></head><body><div>"
                + "<h2>Savage Storage failed to start</h2>"
                + "<p>The app page could not be loaded.</p>"
                + "<p style=\"color:#94a3b8;font-size:13px\">" + safeDetail + "</p>"
                + "<button onclick=\"location.href='https://appassets.android.com/index.html'\">Retry</button>"
                + "</div></body></html>";
        webView.loadDataWithBaseURL(APP_ORIGIN, html, "text/html", "UTF-8", null);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            webView = new WebView(this);
            setContentView(webView);

            WebSettings settings = webView.getSettings();

            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
            settings.setMediaPlaybackRequiresUserGesture(false);

            // Previously true/ALWAYS_ALLOW/disabled: any page loaded in the
            // WebView could reach file:// URLs and mixed content, and use the
            // JavascriptInterface bridges. The bundled app page is loaded
            // from file:///android_asset/, so it still works with these off.
            settings.setAllowFileAccessFromFileURLs(false);
            settings.setAllowUniversalAccessFromFileURLs(false);

            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                settings.setSafeBrowsingEnabled(true);
            }

            // Serve the bundled app over a real local HTTPS origin
            // (https://appassets.android.com/) instead of file://.
            // Why: Vite emits the app as ES modules with a `crossorigin`
            // attribute, and module scripts are always CORS-checked. From
            // file:// the page has an opaque origin and the bundled files
            // carry no CORS headers, so the JS (and CSS) never loads and
            // React never mounts — a blank white screen. That is what the
            // PR #2 hardening exposed: setAllowUniversalAccessFromFileURLs
            // (false) used to be the escape hatch that let file:// modules
            // load. WebViewAssetLoader fixes the root cause without
            // reopening it: same-origin module loads work over HTTPS, the
            // page still cannot fetch file:// URLs, and only files under
            // android_asset/public/ are ever served — never arbitrary
            // device files. androidx.webkit is already a dependency.
            assetLoader = new WebViewAssetLoader.Builder()
                    .setDomain(WebViewAssetLoader.DEFAULT_DOMAIN)
                    .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this, "public"))
                    .build();

            // Expose Native Android Storage & SAF Kotlin Bridges
            safStorageBridge = new SafStorageBridge(this, webView);
            webView.addJavascriptInterface(new AndroidStorageBridge(), "AndroidStorage");
            webView.addJavascriptInterface(safStorageBridge, "SafStorage");

            webView.setWebViewClient(new WebViewClient() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    // Let the asset loader serve the bundled app first.
                    WebResourceResponse assetResponse =
                            assetLoader.shouldInterceptRequest(request.getUrl());
                    if (assetResponse != null) {
                        return assetResponse;
                    }
                    Uri uri = request.getUrl();
                    if (uri != null) {
                        String scheme = uri.getScheme();
                        if ("content".equalsIgnoreCase(scheme)) {
                            try {
                                InputStream is = getContentResolver().openInputStream(uri);
                                String mimeType = getContentResolver().getType(uri);
                                if (mimeType == null) mimeType = "application/octet-stream";
                                return new WebResourceResponse(mimeType, "UTF-8", is);
                            } catch (Exception e) {
                                Log.e(TAG, "Error intercepting content URI: " + uri, e);
                            }
                        } else if ("file".equalsIgnoreCase(scheme)) {
                            // Previously this served any file:// path outside
                            // /android_asset/ to any loaded page. Do not do
                            // that: only the WebView's own android_asset
                            // handling may serve bundled files.
                            return super.shouldInterceptRequest(view, request);
                        }
                    }
                    return super.shouldInterceptRequest(view, request);
                }

                @Override
                public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                    super.onPageStarted(view, url, favicon);
                    if (url != null && url.startsWith(APP_ORIGIN)) {
                        loadErrorShown = false;
                    }
                }

                @Override
                public void onReceivedError(WebView view, WebResourceRequest request,
                                            WebResourceError error) {
                    if (request != null && request.isForMainFrame()) {
                        Log.e(TAG, "WebView page load error: " + request.getUrl()
                                + " — " + error.getDescription());
                        showLoadErrorPage(String.valueOf(error.getDescription()));
                    } else if (request != null) {
                        Log.e(TAG, "WebView resource load error: " + request.getUrl()
                                + " — " + error.getDescription());
                    }
                }

                @Override
                public void onReceivedHttpError(WebView view, WebResourceRequest request,
                                                WebResourceResponse errorResponse) {
                    if (request != null && request.isForMainFrame()) {
                        Log.e(TAG, "WebView HTTP error loading page: " + request.getUrl()
                                + " — HTTP " + errorResponse.getStatusCode());
                        showLoadErrorPage("HTTP " + errorResponse.getStatusCode());
                    } else if (request != null) {
                        Log.w(TAG, "WebView HTTP error loading resource: " + request.getUrl()
                                + " — HTTP " + errorResponse.getStatusCode());
                    }
                }

                @Override
                public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                    Log.e(TAG, "WebView render process gone. Re-creating activity...");
                    if (webView != null) {
                        webView.destroy();
                        webView = null;
                    }
                    recreate();
                    return true;
                }
            });

            // WebChromeClient with Native Android System File Chooser
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                    String text = consoleMessage.message() + " -- Line "
                            + consoleMessage.lineNumber() + " of " + consoleMessage.sourceId();
                    if (consoleMessage.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                        Log.e("SavageStorageWeb", text);
                    } else {
                        Log.d("SavageStorageWeb", text);
                    }
                    return true;
                }

                @Override
                public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                    if (uploadMessage != null) {
                        uploadMessage.onReceiveValue(null);
                        uploadMessage = null;
                    }
                    uploadMessage = filePathCallback;

                    Intent intent = fileChooserParams.createIntent();
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");

                    try {
                        startActivityForResult(intent, FILECHOOSER_RESULTCODE);
                    } catch (ActivityNotFoundException e) {
                        uploadMessage = null;
                        Log.e(TAG, "ActivityNotFoundException opening file chooser", e);
                        return false;
                    }
                    return true;
                }
            });

            getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    if (webView != null && webView.canGoBack()) {
                        webView.goBack();
                    } else {
                        setEnabled(false);
                        getOnBackPressedDispatcher().onBackPressed();
                    }
                }
            });

            webView.loadUrl(APP_URL);
        } catch (Exception e) {
            Log.e(TAG, "Fatal error initializing MainActivity WebView", e);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (safStorageBridge != null && safStorageBridge.handleActivityResult(requestCode, resultCode, data)) {
            return;
        }

        if (requestCode == FILECHOOSER_RESULTCODE) {
            if (uploadMessage == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                String dataString = data.getDataString();
                if (dataString != null) {
                    results = new Uri[]{Uri.parse(dataString)};
                } else if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                }
            }
            uploadMessage.onReceiveValue(results);
            uploadMessage = null;
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
