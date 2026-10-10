package org.fs0ciety.privatix;

import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Activité unique de Privatix : le jeu web 3D dans la WebView de Capacitor.
 *
 * - Plein écran immersif : barres d'état et de navigation masquées ; un glissement depuis le bord
 *   les fait réapparaître un instant, puis elles se masquent à nouveau (re-masquage au retour du
 *   focus, par exemple après une notification ou le sélecteur d'applications).
 * - Écran maintenu allumé tant que l'activité est au premier plan (le jeu se joue sans toucher
 *   l'écran pendant les dialogues et cinématiques).
 * - Arrière-plan : WebView en pause (page « hidden » : le jeu coupe le son et suspend sa boucle).
 * - Bouton/geste « retour » : envoyé au jeu comme la touche Échap (pause, fermeture d'un menu) au
 *   lieu de quitter l'application en pleine partie. On quitte par le bouton d'accueil.
 */
public class MainActivity extends BridgeActivity {

    /** Échap simulé : le jeu lit KeyboardEvent.code sur document (src/engine/Input.ts). */
    private static final String ESCAPE_JS =
        "(function(){var o={key:'Escape',code:'Escape',bubbles:true,cancelable:true};" +
        "document.dispatchEvent(new KeyboardEvent('keydown',o));" +
        "document.dispatchEvent(new KeyboardEvent('keyup',o));})();";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemBars();

        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    WebView webView = bridge != null ? bridge.getWebView() : null;
                    if (webView != null) webView.evaluateJavascript(ESCAPE_JS, null);
                }
            }
        );
    }

    @Override
    public void onResume() {
        super.onResume();
        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (webView != null) webView.onResume();
        hideSystemBars();
    }

    /**
     * Arrière-plan : la WebView est mise en pause, la page passe « hidden » (Page Visibility) et le
     * jeu coupe le son et suspend sa boucle (src/engine/Loop.ts, AudioEngine.setHidden).
     */
    @Override
    public void onPause() {
        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}
