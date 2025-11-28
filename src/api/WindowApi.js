/**
 * Description:
 * A Facade class that exposes a safe subset of the Window's functionality.
 * It allows external control over the window's state (minimize, maximize, close),
 * focus, and properties (title) without exposing internal DOM or renderer logic.
 *
 * Properties summary:
 * - _window {Window} : The internal window instance.
 *
 * Typical usage:
 * const winApi = myWindow.api;
 * winApi.setTitle('New Title');
 * winApi.maximize();
 *
 * Events:
 * - None directly.
 *
 * Business rules implemented:
 * - Wraps Window operations.
 * - Validates inputs before delegation.
 *
 * Dependencies:
 * - {import('../components/Viewport/Window.js').Window}
 */
export class WindowApi {
    /**
     * The internal window instance.
     *
     * @type {import('../components/Viewport/Window.js').Window}
     * @private
     */
    _window;

    /**
     * Creates an instance of WindowApi.
     *
     * @param {import('../components/Viewport/Window.js').Window} windowInstance - The window instance to wrap.
     */
    constructor(windowInstance) {
        if (!windowInstance || typeof windowInstance !== 'object') {
            throw new Error('[WindowApi] Constructor requires a valid Window instance.');
        }
        this._window = windowInstance;
    }

    /**
     * Minimizes the window.
     *
     * @returns {void}
     */
    minimize() {
        if (typeof this._window.minimize === 'function') {
            this._window.minimize();
        }
    }

    /**
     * Maximizes the window.
     * If it is already maximized, this does nothing.
     *
     * @returns {void}
     */
    maximize() {
        if (!this._window.isMaximized && typeof this._window.toggleMaximize === 'function') {
            this._window.toggleMaximize();
        }
    }

    /**
     * Restores the window (un-maximizes).
     *
     * @returns {void}
     */
    restore() {
        if (this._window.isMaximized && typeof this._window.toggleMaximize === 'function') {
            this._window.toggleMaximize();
        }
    }

    /**
     * Closes the window.
     *
     * @returns {Promise<void>}
     */
    async close() {
        if (typeof this._window.close === 'function') {
            await this._window.close();
        }
    }

    /**
     * Focuses the window (brings it to front).
     *
     * @returns {void}
     */
    focus() {
        if (typeof this._window.focus === 'function') {
            this._window.focus();
        }
    }

    /**
     * Sets the window title.
     *
     * @param {string} title - The new title.
     * @returns {void}
     */
    setTitle(title) {
        if (typeof title !== 'string') {
            console.warn(`[WindowApi] invalid title assignment (${title}). Must be a string.`);
            return;
        }
        this._window.title = title;
    }
}
