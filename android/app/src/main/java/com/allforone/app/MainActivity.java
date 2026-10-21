package com.allforone.app;

import android.os.Bundle;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {

    private boolean inForeground = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android may stop the web view's process, for example to free memory while the app is in
        // the background. Without this the whole app crashes. Instead: restart the screen if the
        // person is looking at it, or close quietly if not (it reopens fresh next time).
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
                if (isFinishing() || isDestroyed()) return true;
                if (inForeground) recreate();
                else finish();
                return true;
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        inForeground = true;
    }

    @Override
    public void onPause() {
        inForeground = false;
        super.onPause();
    }
}
