import { ApplicationWindow } from '../ApplicationWindow.js';
import { Modal } from '../../../services/Modal/Modal.js';

/**
 * Description:
 * A concrete implementation of ApplicationWindow that provides a simple text editing interface.
 * It demonstrates the usage of the `renderContent` hook, custom state serialization,
 * and the `preventClose` mechanism to handle unsaved changes (dirty state).
 *
 * Properties summary:
 * - _textarea {HTMLTextAreaElement} : The main text input element.
 * - _initialContent {string} : The content loaded from storage or default.
 * - _isDirty {boolean} : Flag indicating if the content has changed.
 * - _boundOnInput {Function} : Bound handler for input events.
 * - _baseTitle {string} : Stores the original window title to support dirty state indication.
 *
 * Typical usage:
 * const notepad = new NotepadWindow('My Notes', 'Content', { x: 50, y: 50 });
 * viewport.addWindow(notepad);
 *
 * Events:
 * - None specific, inherits ApplicationWindow events.
 *
 * Business rules implemented:
 * - Renders a full-size textarea within the window content area.
 * - Tracks changes to the text content.
 * - Appends an asterisk (*) to the title when unsaved changes exist.
 * - Intercepts close requests via `preventClose` if the state is dirty, prompting the user.
 * - Persists text content to JSON state.
 * - Supports polymorphic constructor for flexible instantiation.
 *
 * Dependencies:
 * - ../ApplicationWindow.js
 * - ../../../services/Modal/Modal.js
 */
export class NotepadWindow extends ApplicationWindow {
    /**
     * The main text input element.
     *
     * @type {HTMLTextAreaElement}
     * @private
     */
    _textarea = null;

    /**
     * The content loaded from storage or default.
     *
     * @type {string}
     * @private
     */
    _initialContent = '';

    /**
     * Flag indicating if the content has changed.
     *
     * @type {boolean}
     * @private
     */
    _isDirty = false;

    /**
     * Stores the original window title.
     *
     * @type {string}
     * @private
     */
    _baseTitle = 'Notepad';

    /**
     * Bound handler for input events.
     *
     * @type {Function}
     * @private
     */
    _boundOnInput;

    /**
     * Creates an instance of NotepadWindow.
     * Supports two signatures:
     * 1. Standard/Factory: (title, content, config)
     * 2. Config-first (legacy/quick): (config, initialText) - handled via type check.
     *
     * @param {string|object} [titleOrConfig='Notepad'] - Title string OR Config object.
     * @param {string|null} [contentOrNull=''] - Initial text content.
     * @param {object} [config={}] - Configuration options (if first arg is title).
     */
    constructor(titleOrConfig = 'Notepad', contentOrNull = '', config = {}) {
        // Argument normalization to support Factory (3 args) and direct App usage (1 arg)
        let title = 'Notepad';
        let initialText = '';
        let cfg = {};

        if (typeof titleOrConfig === 'object' && titleOrConfig !== null) {
            // Usage: new NotepadWindow({x:10}, 'text')
            cfg = titleOrConfig;
            if (typeof contentOrNull === 'string') initialText = contentOrNull;
        } else {
            // Usage: new NotepadWindow('Title', 'text', {x:10})
            title = String(titleOrConfig);
            initialText = contentOrNull || '';
            cfg = config || {};
        }

        super(title, null, cfg);
        const me = this;

        me._baseTitle = title;
        me._initialContent = initialText;
        me._boundOnInput = me._onInput.bind(me);

        // Register the dirty check handler
        me.preventClose(me._checkDirtyState.bind(me));
    }

    /**
     * Returns the unique type identifier for this specific window class.
     * Used by the factory for instantiation.
     *
     * @returns {string} The type identifier.
     */
    static get windowType() {
        return 'NotepadWindow';
    }

    /**
     * Returns the instance type identifier.
     *
     * @returns {string} The type identifier.
     */
    getPanelType() {
        return 'NotepadWindow';
    }

    /**
     * Renders the textarea into the content container.
     * Overrides the base ApplicationWindow method.
     *
     * @param {HTMLElement} container - The content element of the window.
     * @returns {void}
     */
    renderContent(container) {
        const me = this;

        me._textarea = document.createElement('textarea');
        me._textarea.style.width = '100%';
        me._textarea.style.height = '100%';
        me._textarea.style.resize = 'none';
        me._textarea.style.border = 'none';
        me._textarea.style.outline = 'none';
        me._textarea.style.padding = '10px';
        me._textarea.style.backgroundColor = 'transparent';
        me._textarea.style.color = 'inherit';
        me._textarea.style.fontFamily = 'monospace';

        me._textarea.value = me._initialContent;

        me._textarea.addEventListener('input', me._boundOnInput);

        container.appendChild(me._textarea);
    }

    /**
     * Handler for input events on the textarea.
     * Updates the dirty state and window title.
     *
     * @private
     * @returns {void}
     */
    _onInput() {
        const me = this;
        const currentContent = me._textarea.value;
        const isNowDirty = currentContent !== me._initialContent;

        if (me._isDirty !== isNowDirty) {
            me._isDirty = isNowDirty;
            me._updateTitleVisuals();
        }
    }

    /**
     * Updates the window title to indicate dirty state (adds *).
     * Uses _baseTitle to ensure the original title is preserved.
     *
     * @private
     * @returns {void}
     */
    _updateTitleVisuals() {
        const me = this;
        // Use the stored base title instead of hardcoded string
        const displayTitle = me._isDirty ? `${me._baseTitle} *` : me._baseTitle;

        // Call super setter to update header DOM
        // We avoid this.title = ... to prevent loop if we had a setter logic
        if (me.header) {
            me.header.setTitle(displayTitle);
        }
    }

    /**
     * Checks if the window can be closed.
     * Triggered by ApplicationWindow.close().
     *
     * @private
     * @returns {Promise<boolean>} True if it can close, false to cancel.
     */
    async _checkDirtyState() {
        const me = this;
        if (!me._isDirty) {
            return true;
        }

        const confirmed = await Modal.confirm(
            'You have unsaved changes. Are you sure you want to close this window?',
            'Unsaved Changes'
        );

        return confirmed;
    }

    /**
     * Serializes the window state including content.
     *
     * @returns {object} The serialized data.
     */
    toJSON() {
        const base = super.toJSON();
        return {
            ...base,
            type: 'NotepadWindow',
            content: this._textarea ? this._textarea.value : this._initialContent
        };
    }

    /**
     * Deserializes state from JSON.
     *
     * @param {object} data - The state object.
     * @returns {void}
     */
    fromJSON(data) {
        super.fromJSON(data);

        // Update baseTitle from the loaded data to preserve "Document 1"
        if (data.title) {
            this._baseTitle = data.title;
        }

        if (data.content !== undefined) {
            this._initialContent = data.content;
            if (this._textarea) {
                this._textarea.value = data.content;
            }
        }
    }

    /**
     * Cleans up event listeners.
     *
     * @returns {void}
     */
    unmount() {
        const me = this;
        if (me._textarea) {
            me._textarea.removeEventListener('input', me._boundOnInput);
        }
        super.unmount();
    }
}
