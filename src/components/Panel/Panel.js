import { PanelHeader } from './PanelHeader.js';
import { appBus } from '../../utils/EventBus.js';
import { generateId } from '../../utils/generateId.js';
import { globalState } from '../../services/GlobalStateService.js';

/**
 * Description:
 * The base class for a content Panel.
 * This class is an abstract controller and not a direct DOM element.
 * It manages its two child UI components:
 * 1. this.header (PanelHeader instance - the "tab" or "header")
 * 2. this.contentElement (HTMLElement - the "content area")
 *
 * The parent PanelGroup is responsible for orchestrating *where* these
 * two elements are attached in the final DOM.
 *
 * This class now implements a reactive lifecycle, automatically
 * subscribing/unsubscribing to keys from the GlobalStateService
 * via the 'mount' and 'unmount' hooks.
 *
 * Properties summary:
 * - id {string} : A unique ID for this panel instance.
 * - parentGroup {PanelGroup} : The parent group containing this panel.
 * - header {PanelHeader} : The header component.
 * - contentElement {HTMLElement} : The DOM element for the panel's content.
 * - minHeight {number} : Minimum height constraint.
 * - minWidth {number} : Minimum width constraint.
 * - closable {boolean} : Whether the panel can be closed.
 * - collapsible {boolean} : Whether the panel can be collapsed.
 * - movable {boolean} : Whether the panel can be dragged.
 * - title {string} : The title of the panel.
 *
 * Typical usage:
 * ```javascript
 * // This is an abstract class; typically you would extend it.
 * class MyPanel extends Panel {
 *
 *     constructor(...) {
 *         super(...);
 *         // Bind listeners FIRST
 *         this._myCallback = this._myCallback.bind(this);
 *         // Call render LAST
 *         this.render();
 *     }
 *
 *     render() {
 *         // Called once on init
 *         this.contentElement.innerHTML = 'Hello World';
 *     }
 *
 *     getObservedStateKeys() {
 *         // Define which keys to listen to
 *         return ['activeTool'];
 *     }
 *
 *     onStateUpdate(key, value) {
 *         // Called when 'activeTool' changes
 *         if (key === 'activeTool') {
 *         this.contentElement.textContent = `Tool is: ${value}`;
 *     }
 * }
 * ```
 *
 * Events:
 * - Emits: 'panel:group-child-close-request' (via 'close()' method)
 *
 * Business rules implemented:
 * - Validates inputs for dimensions (must be positive numbers).
 * - Propagates configuration changes (title, closable, movable) to the Header component.
 * - Manages lifecycle hooks (mount/unmount) for global state subscriptions.
 * - Enforces encapsulation using private properties and public accessors.
 *
 * Dependencies:
 * - {import('./PanelHeader.js').PanelHeader}
 * - {import('../../utils/EventBus.js').appBus}
 * - {import('../../utils/generateId.js').generateId}
 * - {import('../../services/GlobalStateService.js').globalState}
 *
 * Notes / Additional:
 * - This class is intended to be extended, not instantiated directly.
 */
export class Panel {
    /**
     * The parent PanelGroup.
     *
     * @type {import('./PanelGroup.js').PanelGroup | null}
     * @private
     */
    _parentGroup = null;

    /**
     * The header component instance.
     *
     * @type {PanelHeader | null}
     * @private
     */
    _header = null;

    /**
     * The DOM element for the panel's content.
     *
     * @type {HTMLElement | null}
     * @private
     */
    _contentElement = null;

    /**
     * Minimum height in pixels.
     *
     * @type {number}
     * @private
     */
    _minHeight = 100;

    /**
     * Minimum width in pixels.
     *
     * @type {number}
     * @private
     */
    _minWidth = 150;

    /**
     * Whether the panel allows closing.
     *
     * @type {boolean}
     * @private
     */
    _closable = true;

    /**
     * Whether the panel allows collapsing.
     *
     * @type {boolean}
     * @private
     */
    _collapsible = true;

    /**
     * Whether the panel allows moving/dragging.
     *
     * @type {boolean}
     * @private
     */
    _movable = true;

    /**
     * The title text.
     *
     * @type {string | null}
     * @private
     */
    _title = null;

    /**
     * Stores the actual listener functions for automatic unsubscribing.
     *
     * @type {Map<string, Function>}
     * @private
     */
    _boundStateListeners = null;

    /**
     * Unique ID for the Panel, used by PanelGroup to manage tabs.
     *
     * @type {string}
     * @public
     */
    id = generateId();

    /**
     * Creates a new Panel instance.
     *
     * @param {string} title - The initial title for the panel header/tab.
     * @param {number|null} [height=null] - (Ignored) Kept for API compatibility.
     * @param {object} [config={}] - Configuration overrides (closable, movable, etc.).
     */
    constructor(title, height = null, config = {}) {
        const me = this;

        me._contentElement = document.createElement('div');
        me._contentElement.classList.add('panel__content');
        me._boundStateListeners = new Map();

        // Initialize Header
        const initialTitle = title !== undefined && title !== null ? String(title) : '';
        me._title = initialTitle;
        me._header = new PanelHeader(me, initialTitle);

        // Apply configuration via setters to ensure validation and side effects
        if (config.minHeight !== undefined) me.minHeight = config.minHeight;
        if (config.minWidth !== undefined) me.minWidth = config.minWidth;
        if (config.closable !== undefined) me.closable = config.closable;
        if (config.collapsible !== undefined) me.collapsible = config.collapsible;
        if (config.movable !== undefined) me.movable = config.movable;

        me.build();
    }

    /**
     * Returns the unique type identifier for this panel class.
     *
     * @returns {string} The type identifier.
     */
    static get panelType() {
        return 'Panel';
    }

    /**
     * Retrieves the parent PanelGroup.
     *
     * @returns {import('./PanelGroup.js').PanelGroup | null} The parent group.
     */
    get parentGroup() {
        const me = this;
        return me._parentGroup;
    }

    /**
     * Sets the parent PanelGroup.
     * Updates the header's parent group reference as well.
     *
     * @param {import('./PanelGroup.js').PanelGroup | null} value - The new parent group.
     * @returns {void}
     */
    set parentGroup(value) {
        const me = this;
        // Basic validation to check if it's an object or null
        if (value !== null && typeof value !== 'object') {
            console.warn(`[Panel] invalid parentGroup assignment. Must be an object or null.`);
            return;
        }
        me._parentGroup = value;
        if (me._header) {
            me._header.parentGroup = value;
        }
    }

    /**
     * Retrieves the header component.
     *
     * @returns {PanelHeader | null} The header instance.
     */
    get header() {
        const me = this;
        return me._header;
    }

    /**
     * Retrieves the content DOM element.
     *
     * @returns {HTMLElement | null} The content element.
     */
    get contentElement() {
        const me = this;
        return me._contentElement;
    }

    /**
     * Retrieves the panel title.
     *
     * @returns {string | null} The title.
     */
    get title() {
        const me = this;
        return me._title;
    }

    /**
     * Sets the panel title.
     * Updates the header title.
     *
     * @param {string | null} value - The new title.
     * @returns {void}
     */
    set title(value) {
        const me = this;
        if (value !== null && typeof value !== 'string') {
            console.warn(`[Panel] invalid title assignment (${value}). Must be a string or null.`);
            return;
        }
        me._title = value;
        if (me._header) {
            me._header.title = value;
        }
    }

    /**
     * Retrieves the minimum height.
     *
     * @returns {number} The minimum height.
     */
    get minHeight() {
        const me = this;
        return me._minHeight;
    }

    /**
     * Sets the minimum height.
     *
     * @param {number} value - The new minimum height.
     * @returns {void}
     */
    set minHeight(value) {
        const me = this;
        const num = Number(value);
        if (!Number.isFinite(num) || num < 0) {
            console.warn(
                `[Panel] invalid minHeight assignment (${value}). Must be a positive number.`
            );
            return;
        }
        me._minHeight = num;
    }

    /**
     * Retrieves the minimum width.
     *
     * @returns {number} The minimum width.
     */
    get minWidth() {
        const me = this;
        return me._minWidth;
    }

    /**
     * Sets the minimum width.
     *
     * @param {number} value - The new minimum width.
     * @returns {void}
     */
    set minWidth(value) {
        const me = this;
        const num = Number(value);
        if (!Number.isFinite(num) || num < 0) {
            console.warn(
                `[Panel] invalid minWidth assignment (${value}). Must be a positive number.`
            );
            return;
        }
        me._minWidth = num;
    }

    /**
     * Checks if the panel is closable.
     *
     * @returns {boolean} True if closable.
     */
    get closable() {
        const me = this;
        return me._closable;
    }

    /**
     * Sets whether the panel is closable.
     * Propagates configuration to the header.
     *
     * @param {boolean} value - True to allow closing.
     * @returns {void}
     */
    set closable(value) {
        const me = this;
        if (typeof value !== 'boolean') {
            console.warn(`[Panel] invalid closable assignment (${value}). Must be boolean.`);
            return;
        }
        me._closable = value;
        if (me._header) {
            me._header.updateConfig({ closable: value, movable: me._movable });
        }
    }

    /**
     * Checks if the panel is collapsible.
     *
     * @returns {boolean} True if collapsible.
     */
    get collapsible() {
        const me = this;
        return me._collapsible;
    }

    /**
     * Sets whether the panel is collapsible.
     *
     * @param {boolean} value - True to allow collapsing.
     * @returns {void}
     */
    set collapsible(value) {
        const me = this;
        if (typeof value !== 'boolean') {
            console.warn(`[Panel] invalid collapsible assignment (${value}). Must be boolean.`);
            return;
        }
        me._collapsible = value;
    }

    /**
     * Checks if the panel is movable.
     *
     * @returns {boolean} True if movable.
     */
    get movable() {
        const me = this;
        return me._movable;
    }

    /**
     * Sets whether the panel is movable.
     * Propagates configuration to the header.
     *
     * @param {boolean} value - True to allow moving.
     * @returns {void}
     */
    set movable(value) {
        const me = this;
        if (typeof value !== 'boolean') {
            console.warn(`[Panel] invalid movable assignment (${value}). Must be boolean.`);
            return;
        }
        me._movable = value;
        if (me._header) {
            me._header.updateConfig({ closable: me._closable, movable: value });
        }
    }

    /**
     * Returns the instance type identifier.
     *
     * @returns {string} The type identifier string.
     */
    getPanelType() {
        return 'Panel';
    }

    /**
     * Wrapper for parentGroup setter to maintain compatibility.
     *
     * @param {import('./PanelGroup.js').PanelGroup | null} group - The parent group.
     * @returns {void}
     */
    setParentGroup(group) {
        this.parentGroup = group;
    }

    /**
     * Calculates the header height.
     *
     * @returns {number} The pixel height of the header.
     */
    getHeaderHeight() {
        const me = this;
        return me._header ? me._header.element.offsetHeight : 0;
    }

    /**
     * Calculates the minimum panel height.
     *
     * @returns {number} The minimum height.
     */
    getMinPanelHeight() {
        const me = this;
        return Math.max(0, me._minHeight);
    }

    /**
     * Calculates the minimum panel width.
     *
     * @returns {number} The minimum width.
     */
    getMinPanelWidth() {
        const me = this;
        return Math.max(0, me._minWidth);
    }

    /**
     * Cleans up child components and internal listeners.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        me.unmount();
        if (me._header && typeof me._header.destroy === 'function') {
            me._header.destroy();
        }
    }

    /**
     * Builds the panel's internal structure.
     *
     * @returns {void}
     */
    build() {
        const me = this;
        me.updateHeight();
    }

    /**
     * Sets the inner HTML of the content element.
     *
     * @param {string} htmlString - The HTML string to set.
     * @returns {void}
     */
    setContent(htmlString) {
        const me = this;
        me.contentElement.innerHTML = htmlString;
    }

    /**
     * Requests to be closed by its parent group.
     *
     * @returns {void}
     */
    close() {
        const me = this;
        if (!me._closable) return;

        if (me._parentGroup) {
            appBus.emit('panel:group-child-close-request', {
                panel: me,
                group: me._parentGroup
            });
        }
    }

    /**
     * Applies height and min-height styles to the content element.
     *
     * @returns {void}
     */
    updateHeight() {
        const me = this;
        const contentEl = me.contentElement;
        if (!contentEl) return;

        contentEl.style.minHeight = `${me.getMinPanelHeight()}px`;
        contentEl.style.height = 'auto';
        contentEl.style.flex = '1 1 auto';
    }

    /**
     * Serializes the Panel's state to a JSON-friendly object.
     *
     * @returns {object} The serialized data.
     */
    toJSON() {
        const me = this;
        return {
            type: me.getPanelType(),
            title: me.title
        };
    }

    /**
     * Deserializes state from a JSON object.
     *
     * @param {object} data - The state object.
     * @returns {void}
     */
    fromJSON(data) {
        const me = this;
        if (data.title !== undefined) {
            me.title = data.title;
        }
    }

    /**
     * Initial render method. Subclasses should override this
     * to populate the panel's content element.
     *
     * @returns {void}
     */
    render() {
        // This is intentionally left empty. Subclasses can override.
    }

    /**
     * (Lifecycle Hook) Called by PanelGroup when this panel becomes visible (active tab).
     * Subscribes to all keys specified in 'getObservedStateKeys'.
     *
     * @returns {void}
     */
    mount() {
        const me = this;
        const boundOnStateUpdate = me.onStateUpdate.bind(me);

        me.getObservedStateKeys().forEach(key => {
            const listener = value => {
                boundOnStateUpdate(key, value);
            };
            me._boundStateListeners.set(key, listener);
            globalState.subscribe(key, listener);
        });
    }

    /**
     * (Lifecycle Hook) Called by PanelGroup when this panel becomes hidden
     * (another tab selected) or before it is destroyed.
     * Unsubscribes from all observed keys.
     *
     * @returns {void}
     */
    unmount() {
        const me = this;
        if (me._boundStateListeners) {
            me._boundStateListeners.forEach((listener, key) => {
                globalState.unsubscribe(key, listener);
            });
            me._boundStateListeners.clear();
        }
    }

    /**
     * (Reactive Hook) Called when any observed state key (from 'getObservedStateKeys') changes.
     *
     * @param {string} key - The state key that changed.
     * @param {*} value - The new value.
     * @returns {void}
     */
    onStateUpdate(key, value) {
        key;
        value;
        // Subclasses must implement this to react to state changes.
    }

    /**
     * (Reactive Hook) Specifies which GlobalStateService keys this panel listens to.
     *
     * @returns {Array<string>} An array of state keys (e.g., ['activeTool', 'activeColor']).
     */
    getObservedStateKeys() {
        // Subclasses must implement this to define subscriptions.
        return [];
    }
}
