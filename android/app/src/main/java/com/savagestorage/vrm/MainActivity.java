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
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

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

    public class AndroidStorageBridge {

        @JavascriptInterface
        public boolean hasStoragePermission() {
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
            File external = Environment.getExternalStorageDirectory();
            if (external != null && external.exists()) {
                return external.getAbsolutePath();
            }
            return getFilesDir().getAbsolutePath();
        }

        @JavascriptInterface
        public String listDirectory(String dirPath) {
            try {
                String targetPath = (dirPath == null || dirPath.trim().isEmpty() || dirPath.equals("/"))
                        ? getStorageRootPath()
                        : dirPath;

                File dir = new File(targetPath);
                if (!dir.exists() || !dir.isDirectory()) {
                    return "[]";
                }

                File[] files = dir.listFiles();
                if (files == null) {
                    return "[]";
                }

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
            try {
                File file = new File(filePath);
                if (!file.exists() || !file.isFile()) return "";

                long length = file.length();
                if (length > 40 * 1024 * 1024) {
                    Log.w(TAG, "File too large for Base64, should use streaming URI: " + filePath);
                    return "";
                }

                byte[] bytes = new byte[(int) length];
                try (FileInputStream fis = new FileInputStream(file)) {
                    int read = fis.read(bytes);
                    if (read > 0) {
                        return Base64.encodeToString(bytes, Base64.NO_WRAP);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error reading file base64: " + filePath, e);
            }
            return "";
        }

        @JavascriptInterface
        public String readFileAsString(String filePath) {
            try {
                File file = new File(filePath);
                if (!file.exists() || !file.isFile()) return "";

                long length = file.length();
                if (length > 10 * 1024 * 1024) {
                    return "";
                }

                byte[] bytes = new byte[(int) length];
                try (FileInputStream fis = new FileInputStream(file)) {
                    fis.read(bytes);
                    return new String(bytes, "UTF-8");
                }
            } catch (Exception e) {
                Log.e(TAG, "Error reading file string: " + filePath, e);
            }
            return "";
        }

        @JavascriptInterface
        public boolean writeFile(String filePath, String dataContent, boolean isBase64) {
            try {
                File file = new File(filePath);
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
            try {
                File file = new File(filePath);
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
            try {
                File dir = new File(dirPath);
                return dir.mkdirs() || dir.exists();
            } catch (Exception e) {
                Log.e(TAG, "Error creating directory: " + dirPath, e);
                return false;
            }
        }
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

            // Bundled Vite JavaScript modules and stylesheets are loaded relative to the local
            // index.html. Allow the trusted app document to load its own packaged file assets.
            settings.setAllowFileAccessFromFileURLs(true);
            settings.setAllowUniversalAccessFromFileURLs(true);

            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                settings.setSafeBrowsingEnabled(true);
            }

            safStorageBridge = new SafStorageBridge(this, webView);
            webView.addJavascriptInterface(new AndroidStorageBridge(), "AndroidStorage");
            webView.addJavascriptInterface(safStorageBridge, "SafStorage");

            webView.setWebViewClient(new WebViewClient() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
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
                            try {
                                String path = uri.getPath();
                                if (path != null && !path.startsWith("/android_asset/")) {
                                    File f = new File(path);
                                    if (f.exists() && f.isFile()) {
                                        FileInputStream fis = new FileInputStream(f);
                                        return new WebResourceResponse("application/octet-stream", "UTF-8", fis);
                                    }
                                }
                            } catch (Exception e) {
                                Log.e(TAG, "Error intercepting file URI: " + uri, e);
                            }
                        }
                    }
                    return super.shouldInterceptRequest(view, request);
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

            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                    Log.d("SavageStorageWeb", consoleMessage.message() + " -- Line "
                            + consoleMessage.lineNumber() + " of " + consoleMessage.sourceId());
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

            webView.loadUrl("file:///android_asset/public/index.html");
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
