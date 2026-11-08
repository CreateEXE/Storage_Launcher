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
    // The origin is DERIVED from WebViewAssetLoader.DEFAULT_DOMAIN
    // (appassets.androidplatform.net) and must never be hardcoded:
    // hardcoding appassets.android.com broke every launch — the loader's
    // PathMatcher only intercepts its own domain, the .com request fell
    // through to real DNS (both domains are NXDOMAIN), and the app showed
    // "failed to start / ERR_NAME_NOT_RESOLVED". Deriving it here makes
    // that mismatch impossible by construction. Package-visible so
    // SafStorageBridge trusts exactly the same origin.
    static final String APP_ORIGIN = "https://" + WebViewAssetLoader.DEFAULT_DOMAIN + "/";
    private static final String APP_URL = APP_ORIGIN + "public/index.html";

    // JavascriptInterface calls carry no origin or auth token in the Android
    // API. The only check available here is the page currently loaded in
    // this WebView: bridges must only answer the bundled app page
    // (file:///android_asset/...). A remote page, or any other file:// page,
    // loaded in the WebView must not be able to call these bridges.
    // This is an origin check, not a cryptographic auth token; it stops the
    // reported hole (any loaded web content using the bridges) but any code
    // running inside the bundled app page itself is still trusted.
    //
    // The check MUST NOT read the URL from the WebView here.
    // @JavascriptInterface methods run on the WebView's JavaBridge thread,
    // not the UI thread, and WebView.getUrl() calls checkThread() and
    // throws IllegalStateException when invoked off the UI thread (AOSP
    // WebView.java: getUrl() -> checkThread()). That threw out of
    // getStorageRootPath() — the first bridge call at startup — as
    // "Java exception was raised during method invocation", which the JS
    // side surfaced as the SYSTEM RECOVERY SHIELD on every launch. The
    // same latent bug made SafStorageBridge's origin check silently fail
    // on every call (it caught the exception and returned false), so the
    // SAF bridge was dead without any visible error. Instead the current
    // page URL is cached in currentPageUrl on the UI thread (set before
    // loadUrl, updated in onPageStarted) and the check reads that field
    // only. Never call a WebView method from a bridge method.
    private volatile String currentPageUrl;

    // Package-visible for SafStorageBridge: it must use the same cached
    // URL for the same reason (its own webView.url reads threw too, just
    // silently, because they were wrapped in try/catch).
    String getCurrentPageUrl() {
        return currentPageUrl;
    }

    private boolean isTrustedOrigin() {
        try {
            String url = currentPageUrl;
            return url != null && (url.startsWith("file:///android_asset/")
                    || url.startsWith(APP_ORIGIN));
        } catch (Exception e) {
            Log.e(TAG, "Error checking trusted origin", e);
            return false;
        }
    }

    private boolean checkTrusted() {
        if (!isTrustedOrigin()) {
            Log.w(TAG, "Blocked JavascriptInterface call from untrusted origin: "
                    + currentPageUrl);
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
            // A bridge method called at startup must never throw into the
            // JS layer: an exception here aborts the FileManagerService
            // constructor during the first render and the app lands on the
            // SYSTEM RECOVERY SHIELD. checkTrusted() no longer touches the
            // WebView (see above), but this method is still guarded so a
            // future failure degrades to the app-private files dir — or ""
            // — instead of crashing the launch.
            try {
                if (!checkTrusted()) return "";
                File external = Environment.getExternalStorageDirectory();
                if (external != null && external.exists()) {
                    return external.getAbsolutePath();
                }
                return getFilesDir().getAbsolutePath();
            } catch (Exception e) {
                Log.e(TAG, "Error getting storage root path", e);
                try {
                    return getFilesDir().getAbsolutePath();
                } catch (Exception e2) {
                    Log.e(TAG, "Error getting app files dir as storage fallback", e2);
                    return "";
                }
            }
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
        // A net::ERR_* on the bundled app URL can never be a real network
        // problem: the page is served locally by WebViewAssetLoader, so
        // ERR_NAME_NOT_RESOLVED / ERR_CONNECTION_REFUSED means the loader
        // did not intercept the request (e.g. a domain mismatch) — not
        // the user's internet connection. Say so on the page.
        boolean localAssetFailure = safeDetail.contains("ERR_NAME_NOT_RESOLVED")
                || safeDetail.contains("ERR_CONNECTION_REFUSED");
        String html = "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
                + "<style>body{background:#03060c;color:#e2e8f0;font-family:sans-serif;margin:0;"
                + "display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}"
                + "button{background:#0891b2;color:#fff;border:0;border-radius:8px;padding:12px 24px;"
                + "font-size:16px;margin-top:16px}</style></head><body><div>"
                + "<h2>Savage Storage failed to start</h2>"
                + "<p>The app page could not be loaded.</p>"
                + "<p style=\"color:#94a3b8;font-size:13px\">" + safeDetail + "</p>"
                + (localAssetFailure
                        ? "<p style=\"color:#fbbf24;font-size:13px\">The app's built-in page server did not answer. This is not your internet connection — the app's own files failed to load.</p>"
                        : "")
                + "<button onclick=\"location.href='" + APP_URL + "'\">Retry</button>"
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
            // (https://appassets.androidplatform.net/, i.e. APP_ORIGIN)
            // instead of file://.
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
            // android_asset/ are ever served — never arbitrary device
            // files. androidx.webkit is already a dependency (1.10.0), and
            // in 1.10.0 AssetsPathHandler has only a (Context) constructor
            // — the (Context, String path) form does not exist yet — so the
            // handler serves the assets root and the app is loaded at
            // /public/index.html, where the workflow copies dist/.
            assetLoader = new WebViewAssetLoader.Builder()
                    .setDomain(WebViewAssetLoader.DEFAULT_DOMAIN)
                    .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
                    .build();
            // Regression guard: APP_URL is derived from DEFAULT_DOMAIN
            // above, so the loader must intercept it. Log both so a future
            // domain mismatch is visible in logcat instead of surfacing as
            // a bare ERR_NAME_NOT_RESOLVED on the error page.
            Log.i(TAG, "Serving bundled app from " + APP_URL
                    + " via WebViewAssetLoader domain "
                    + WebViewAssetLoader.DEFAULT_DOMAIN);

            // Expose Native Android Storage & SAF Kotlin Bridges
            // SafStorageBridge gets the cached page URL (this::getCurrentPageUrl)
            // for its origin check — it must not read webView.url from the
            // JavaBridge thread either (see isTrustedOrigin above).
            safStorageBridge = new SafStorageBridge(this, webView, this::getCurrentPageUrl);
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
                        if ("file".equalsIgnoreCase(scheme)) {
                            // Previously this served any file:// path outside
                            // /android_asset/ to any loaded page. Do not do
                            // that: only the WebView's own android_asset
                            // handling may serve bundled files.
                            return super.shouldInterceptRequest(view, request);
                        }
                        // No content:// branch: previously any content://
                        // URI the loaded page asked for was opened and
                        // served, with no check on which document it was —
                        // including documents in the user-granted SAF tree.
                        // Nothing legitimate needs it any more (since PR #7
                        // the viewer loads models as base64 data: URLs, and
                        // the system file picker hands chosen files to the
                        // WebView itself), so content:// requests are left
                        // to the default handling instead of being served.
                    }
                    return super.shouldInterceptRequest(view, request);
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    Uri uri = request != null ? request.getUrl() : null;
                    if (uri == null) return false;
                    String scheme = uri.getScheme();
                    boolean isAppUrl = uri.toString().startsWith(APP_ORIGIN)
                            || uri.toString().startsWith("file:///android_asset/");
                    if (isAppUrl) return false; // load inside the WebView
                    if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                        // Never load a foreign page inside the app's
                        // WebView: it would run with the app's bridges
                        // beside it (blocked by the origin check, but the
                        // user would still see a foreign page inside the
                        // app). Open it in the system browser instead.
                        // Top-level navigation only — fetch() calls (e.g.
                        // the Termux loopback daemon) do not come here.
                        try {
                            Intent browserIntent = new Intent(Intent.ACTION_VIEW, uri);
                            startActivity(browserIntent);
                        } catch (Exception e) {
                            Log.e(TAG, "Could not open external URL: " + uri, e);
                        }
                        return true;
                    }
                    return false;
                }

                @Override
                public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                    super.onPageStarted(view, url, favicon);
                    // UI-thread callback: keep the cached page URL current
                    // for the bridge origin checks (they run on the
                    // JavaBridge thread and must never call WebView.getUrl()).
                    currentPageUrl = url;
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

                    // Build the picker intent explicitly. Do NOT use
                    // fileChooserParams.createIntent(): it bakes the web
                    // page's accept list (.vrm,.glb,.gltf,.obj,.json) into
                    // EXTRA_MIME_TYPES, and .vrm/.glb/.obj have no registered
                    // Android MIME type, so document providers greyed out
                    // every 3D file. setType("*/*") does not clear those
                    // extras, so the previous code filtered them out even
                    // after "fixing" the type. A bare */* type with no
                    // EXTRA_MIME_TYPES lets every file be selected; the web
                    // input's accept attribute still guides the user
                    // in-page, and the loader validates the extension.
                    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    if (fileChooserParams.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    }

                    try {
                        // Kept on startActivityForResult deliberately: the
                        // SAF bridge shares this Activity's onActivityResult
                        // dispatch (see onActivityResult below), and moving
                        // to the Activity Result API would re-plumb that
                        // shared flow for no user-facing gain.
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

            // Cache the page URL before loading it: bridge origin checks
            // read this field (UI thread) instead of WebView.getUrl()
            // (which throws off the UI thread — see isTrustedOrigin).
            currentPageUrl = APP_URL;
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
