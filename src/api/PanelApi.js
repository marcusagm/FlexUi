/**
 * Description:
 * A Facade class that exposes a limited, safe subset of the Panel's functionality
 * to external developers. It protects core lifecycle methods (mount, render)
 * while allowing state manipulation (title, visibility, close) and event subscription.
 *
 * Properties summary:
 * - _panel {Panel} : The internal panel instance being wrapped.
 *
 * Typical usage:
 * const api = new PanelApi(myPanel);
 * api.setTitle('New Title');
 * api.setVisible(true);
 * const disposeListener = api.onDidClose(() => console.log('Closed'));
 *
 * Events:
 * - onDidClose: Fired when the panel is disposed/closed.
 * - onDidVisibilityChange: Fired when visibility changes.
 *
 * Business rules implemented:
 * - Delegates allowed operations to the internal Panel instance.
 * - Hides administrative methods (mount, unmount, renderer, element).
 * - Validates inputs before delegation.
 * - Provides read-only access to lifecycle event subscriptions.
 *
 * Dependencies:
 * - {import('../components/Panel/Panel.js').Panel}
 */
export class PanelApi {
    /**
     * The internal panel instance being wrapped.
     *
     * @type {import('../components/Panel/Panel.js').Panel}
     * @private
     */
    _panel;

    /**
     * Creates an instance of PanelApi.
     *
     * @param {import('../components/Panel/Panel.js').Panel} panel - The panel instance to wrap.
     */
    constructor(panel) {
        const me = this;
        if (!panel || typeof panel !== 'object') {
            throw new Error('[PanelApi] Constructor requires a valid Panel instance.');
        }
        me._panel = panel;
    }

    /**
     * Updates the panel's title.
     *
     * @param {string} title - The new title text.
     * @returns {void}
     */
    setTitle(title) {
        const me = this;
        if (typeof title !== 'string') {
            console.warn(
                `[PanelApi] invalid title assignment (${title}). Must be a string. Keeping previous value.`
            );
            return;
        }
        me._panel.setTitle(title);
    }

    /**
     * Updates the panel's visibility.
     *
     * @param {boolean} visible - Whether the panel should be visible.
     * @returns {void}
     */
    setVisible(visible) {
        const me = this;
        const isVisible = Boolean(visible);
        me._panel.setVisible(isVisible);
    }

    /**
     * Requests the panel to close.
     *
     * @returns {void}
     */
    close() {
        const me = this;
        if (typeof me._panel.close === 'function') {
            me._panel.close();
        }
    }

    /**
     * Sets the minimum dimensions for the panel.
     * Maps to the panel's minWidth and minHeight properties.
     *
     * @param {number} minWidth - The minimum width in pixels.
     * @param {number} minHeight - The minimum height in pixels.
     * @returns {void}
     */
    setMinimumDimensions(minWidth, minHeight) {
        const me = this;

        const w = Number(minWidth);
        const h = Number(minHeight);

        if (!Number.isNaN(w) && w >= 0) {
            me._panel.minWidth = w;
        } else {
            console.warn(`[PanelApi] invalid minWidth (${minWidth}). Must be a positive number.`);
        }

        if (!Number.isNaN(h) && h >= 0) {
            me._panel.minHeight = h;
        } else {
            console.warn(`[PanelApi] invalid minHeight (${minHeight}). Must be a positive number.`);
        }
    }

    /**
     * Event fired when the panel is closed (disposed).
     *
     * @returns {Function} The subscription function (takes a listener, returns a Disposable).
     */
    get onDidClose() {
        // Maps to the underlying UIElement's onDidDispose event
        return this._panel.onDidDispose;
    }

    /**
     * Event fired when the panel's visibility changes.
     *
     * @returns {Function} The subscription function.
     */
    get onDidVisibilityChange() {
        return this._panel.onDidVisibilityChange;
    }
}
