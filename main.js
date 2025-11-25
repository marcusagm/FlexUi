import { App } from './src/App.js';
import { TranslationService } from './src/services/TranslationService.js';
import { Loader } from './src/services/Loader/Loader.js';

window.FLEXUI_DEBUG = true;

/**
 * Description:
 * Handles fatal unhandled errors or promise rejections globally.
 * Ensures an error message is visible to the user and logs the full stack trace.
 * It injects a basic, unstyled error overlay into the body if one doesn't exist.
 *
 * @param {Error|string} error - The error object or message.
 * @returns {void}
 */
const handleFatalError = error => {
    // Log the error for developers
    console.error('UNHANDLED FATAL ERROR:', error);

    // Prepare message
    let errorMessage = 'A critical error occurred. The application cannot continue.';
    if (error && error.message) {
        errorMessage = `Error: ${error.message}`;
    } else if (typeof error === 'string') {
        errorMessage = `Error: ${error}`;
    }

    // Inject visual error into the body if it's not already there
    const existingError = document.getElementById('fatal-error-overlay');
    if (existingError) return;

    const errorDiv = document.createElement('div');
    errorDiv.id = 'fatal-error-overlay';
    // Minimal inline styles to ensure visibility over any UI elements
    errorDiv.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: #100000; color: #ffb4ab; z-index: 10000;
        padding: 20px; font-family: 'Nunito', monospace; overflow: auto;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        text-align: center;
    `;
    errorDiv.innerHTML = `
        <h1 style="font-size: 1.5rem; margin-bottom: 20px;">CRITICAL APPLICATION FAILURE</h1>
        <p style="margin-top: 10px;">${errorMessage}</p>
        <p style="margin-top: 20px; font-size: 0.8em; color: #87201b;">Please check the browser console for the full stack trace.</p>
    `;

    document.body.appendChild(errorDiv);
};

/**
 * Description:
 * Global handler for synchronous runtime errors (like syntax errors in callbacks).
 *
 * @param {string} message - The error message.
 * @param {string} source - The script URL where the error occurred.
 * @param {number} lineno - The line number.
 * @param {number} colno - The column number.
 * @param {Error} error - The error object.
 * @returns {boolean} True to prevent the browser's default error handling/logging.
 */
window.onerror = function (message, source, lineno, colno, error) {
    handleFatalError(error || new Error(message));
    // Return true to prevent the browser's default error dialog.
    return true;
};

/**
 * Description:
 * Global handler for unhandled promise rejections.
 *
 * @param {PromiseRejectionEvent} event - The rejection event.
 * @returns {void}
 */
window.onunhandledrejection = function (event) {
    // event.reason contains the rejection value (usually an Error object)
    handleFatalError(event.reason);
    // Prevent default console logging for the rejection
    event.preventDefault();
};

window.addEventListener('DOMContentLoaded', async () => {
    const i18n = TranslationService.getInstance();
    // Instantiate loader here so we can call hide() on it, if initialization fails.
    const appLoader = new Loader(document.body, { type: 'fullpage' });
    let initMessage = 'Initializing Application...';

    try {
        i18n.registerLanguageSource('en', './i18n/en.json');
        i18n.registerLanguageSource('pt', './i18n/pt.json');

        await i18n.loadLanguage('en');
        i18n.defaultLanguage = 'en';

        await i18n.setLanguage('pt');

        initMessage = i18n.translate('actions.initializing');
        appLoader.show(initMessage);

        const app = new App();
        await app.init();
    } catch (err) {
        // If an error occurs during initialization (fetch, App constructor, App.init),
        // we call the handler to display the error screen.
        handleFatalError(err);
    } finally {
        // Ensures the loader is hidden after all attempts (success or fatal failure)
        appLoader.hide();
    }
});
