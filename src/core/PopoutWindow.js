import { Disposable } from './Disposable.js';

/**
 * Description:
 * A wrapper class for managing native browser popout windows.
 * It handles the creation of a new window, synchronization of styles (CSS)
 * from the main application to ensure theming consistency, and lifecycle management.
 *
 * Properties summary:
 * - id {string} : The unique identifier for this popout.
 * - nativeWindow {Window|null} : The native browser window object.
 * - options {object} : Configuration options (width, height, title, left, top).
 * - onClose {Function|null} : Callback triggered when the window is closed.
 *
 * Typical usage:
 * const popout = new PopoutWindow('popout-1', { title: 'My Popout', width: 800, height: 600 });
 * await popout.open();
 *
 * Events:
 * - Dispatches 'resize' events to the internal content (implied).
 * - Triggers onClose callback on unload.
 *
 * Business rules implemented:
 * - Injects application styles into the new window to maintain theme.
 * - Manages the 'beforeunload' event to handle user-initiated closing.
 * - Ensures the popout body has 100% dimensions to prevent layout collapse.
 *
 * Dependencies:
 * - {import('./Disposable.js').Disposable}
 */
export class PopoutWindow extends Disposable {
    /**
     * The unique identifier for this popout.
     *
     * @type {string}
     * @private
     */
    _id;

    /**
     * The native browser window object.
     *
     * @type {Window | null}
     * @private
     */
    _nativeWindow = null;

    /**
     * Configuration options.
     *
     * @type {object}
     * @private
     */
    _options;

    /**
     * Callback triggered when the window is closed.
     *
     * @type {Function | null}
     * @private
     */
    _onCloseCallback = null;

    /**
     * Bound handler for the beforeunload event.
     *
     * @type {Function}
     * @private
     */
    _boundOnBeforeUnload;

    /**
     * Bound handler for the resize event.
     *
     * @type {Function}
     * @private
     */
    _boundOnResize;

    /**
     * Creates an instance of PopoutWindow.
     *
     * @param {string} id - The unique identifier.
     * @param {object} [options={}] - Configuration options.
     * @param {string} [options.title='Popout'] - The window title.
     * @param {number} [options.width=800] - The window width.
     * @param {number} [options.height=600] - The window height.
     * @param {number} [options.left] - The window screen X position.
     * @param {number} [options.top] - The window screen Y position.
     */
    constructor(id, options = {}) {
        super();
        const me = this;

        if (!id || typeof id !== 'string') {
            throw new Error('[PopoutWindow] id must be a non-empty string.');
        }

        me._id = id;
        me._options = {
            title: 'Popout',
            width: 800,
            height: 600,
            ...options
        };

        me._boundOnBeforeUnload = me._onBeforeUnload.bind(me);
        me._boundOnResize = me._onResize.bind(me);
    }

    /**
     * Gets the unique identifier.
     *
     * @returns {string} The id.
     */
    get id() {
        return this._id;
    }

    /**
     * Gets the native window object.
     *
     * @returns {Window | null} The native window.
     */
    get nativeWindow() {
        return this._nativeWindow;
    }

    /**
     * Sets the close callback.
     *
     * @param {Function | null} callback - The function to call on close.
     * @returns {void}
     */
    set onClose(callback) {
        const me = this;
        if (callback && typeof callback !== 'function') {
            console.warn(
                `[PopoutWindow] invalid onClose assignment (${callback}). Must be a function or null. Keeping previous value: ${me._onCloseCallback}`
            );
            return;
        }
        me._onCloseCallback = callback;
    }

    /**
     * Opens the native window and injects styles.
     *
     * @returns {Promise<void>} Resolves when the window is ready.
     */
    async open() {
        const me = this;

        let left = me._options.left;
        let top = me._options.top;

        if (left === undefined || left === null) {
            left = (window.screen.width - me._options.width) / 2;
        }
        if (top === undefined || top === null) {
            top = (window.screen.height - me._options.height) / 2;
        }

        const features = `popup=yes,width=${me._options.width},height=${me._options.height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no`;

        me._nativeWindow = window.open('about:blank', me._id, features);

        if (!me._nativeWindow) {
            throw new Error(
                '[PopoutWindow] Failed to open window. It might have been blocked by a popup blocker.'
            );
        }

        const targetDocument = me._nativeWindow.document;
        targetDocument.title = me._options.title;

        targetDocument.body.style.margin = '0';
        targetDocument.body.style.height = '100vh';
        targetDocument.body.style.width = '100vw';
        targetDocument.body.style.overflow = 'hidden';
        targetDocument.body.style.display = 'flex';
        targetDocument.body.style.flexDirection = 'column';
        targetDocument.body.className = document.body.className;

        me._copyStyles(targetDocument);

        me._nativeWindow.addEventListener('beforeunload', me._boundOnBeforeUnload);
        me._nativeWindow.addEventListener('resize', me._boundOnResize);

        return Promise.resolve();
    }

    /**
     * Appends a DOM element to the popout's body.
     *
     * @param {HTMLElement} element - The element to append.
     * @returns {void}
     */
    appendChild(element) {
        const me = this;
        if (!me._nativeWindow) {
            console.warn('[PopoutWindow] Cannot append child. Window is not open.');
            return;
        }
        if (!(element instanceof HTMLElement)) {
            console.warn('[PopoutWindow] appendChild expects an HTMLElement.');
            return;
        }

        me._nativeWindow.document.body.appendChild(element);
    }

    /**
     * Closes the native window.
     *
     * @returns {void}
     */
    close() {
        const me = this;
        if (me._nativeWindow) {
            me._nativeWindow.close();
        }
    }

    /**
     * Disposes resources.
     *
     * @returns {void}
     */
    dispose() {
        const me = this;
        if (me._nativeWindow) {
            me._nativeWindow.removeEventListener('beforeunload', me._boundOnBeforeUnload);
            me._nativeWindow.removeEventListener('resize', me._boundOnResize);
            me._nativeWindow = null;
        }
        super.dispose();
    }

    /**
     * Internal handler for beforeunload.
     * Triggers the onClose callback and disposes resources.
     *
     * @private
     * @returns {void}
     */
    _onBeforeUnload() {
        const me = this;
        if (typeof me._onCloseCallback === 'function') {
            me._onCloseCallback();
        }
        me.dispose();
    }

    /**
     * Internal handler for resize events.
     *
     * @private
     * @returns {void}
     */
    _onResize() {
        // Reserved for future logic
    }

    /**
     * Copies styles from the main window to the target document.
     *
     * @param {Document} targetDocument - The target document.
     * @private
     * @returns {void}
     */
    _copyStyles(targetDocument) {
        const styleSheets = Array.from(document.styleSheets);

        styleSheets.forEach(styleSheet => {
            try {
                if (styleSheet.href) {
                    const link = targetDocument.createElement('link');
                    link.rel = 'stylesheet';
                    link.type = 'text/css';
                    link.href = styleSheet.href;
                    targetDocument.head.appendChild(link);
                } else if (styleSheet.cssRules) {
                    const style = targetDocument.createElement('style');
                    const rules = Array.from(styleSheet.cssRules);
                    const cssText = rules.map(rule => rule.cssText).join('\n');
                    style.textContent = cssText;
                    targetDocument.head.appendChild(style);
                }
            } catch (error) {
                console.warn(
                    '[PopoutWindow] Failed to copy a stylesheet (likely CORS policy).',
                    error
                );
            }
        });
    }
}
