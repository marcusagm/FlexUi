import { IPanel } from './IPanel.js';
import { VanillaPanelAdapter } from '../../renderers/vanilla/VanillaPanelAdapter.js';
import { PanelHeader } from './PanelHeader.js';
import { appBus } from '../../utils/EventBus.js';
import { globalState } from '../../services/GlobalStateService.js';
import { EventTypes } from '../../constants/EventTypes.js';

/**
 * Description:
 * The concrete base class for content panels.
 * It acts as a controller, delegating DOM rendering to an adapter (renderer)
 * and managing the panel's state, header, and lifecycle events.
 *
 * Properties summary:
 * - title {string} : The panel title.
 * - header {PanelHeader} : The header component associated with this panel.
 * - contentElement {HTMLElement} : The main content DOM element.
 * - minHeight {number} : Minimum height constraint.
 * - minWidth {number} : Minimum width constraint.
 * - closable {boolean} : Whether the panel can be closed.
 * - collapsible {boolean} : Whether the panel can be collapsed.
 * - movable {boolean} : Whether the panel can be moved.
 *
 * Typical usage:
 * const panel = new Panel('My Panel');
 * panel.setContent('<p>Hello World</p>');
 * panel.mount(document.body);
 *
 * Events:
 * - Emits: EventTypes.PANEL_GROUP_CHILD_CLOSE_REQUEST
 *
 * Business rules implemented:
 * - Extends IPanel -> UIElement -> Disposable.
 * - Delegates visual operations to VanillaPanelAdapter by default.
 * - Automatically manages global state subscriptions upon mounting/unmounting.
 * - Validates all configuration inputs.
 *
 * Dependencies:
 * - IPanel
 * - VanillaPanelAdapter
 * - PanelHeader
 * - EventBus
 * - GlobalStateService
 */
export class Panel extends IPanel {
    /**
     * The header component instance.
     *
     * @type {PanelHeader | null}
     * @private
     */
    _header = null;

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
     * @type {string}
     * @private
     */
    _title = '';

    /**
     * The parent PanelGroup.
     *
     * @type {import('./PanelGroup.js').PanelGroup | null}
     * @private
     */
    _parentGroup = null;

    /**
     * Stores the actual listener functions for automatic unsubscribing.
     *
     * @type {Map<string, Function>}
     * @private
     */
    _boundStateListeners = new Map();

    /**
     * Creates a new Panel instance.
     *
     * @param {string} title - The initial title for the panel.
     * @param {number|null} [height=null] - Initial height (kept for API compatibility, generally ignored in favor of flex).
     * @param {object} [config={}] - Configuration options.
     * @param {import('../../core/IRenderer.js').IRenderer} [renderer=null] - Optional renderer adapter.
     */
    constructor(title, height = null, config = {}, renderer = null) {
        super(null, renderer || new VanillaPanelAdapter());
        const me = this;

        // Initialize Title
        me._title = typeof title === 'string' ? title : '';

        // Initialize Header (Legacy coupling maintained as per plan)
        me._header = new PanelHeader(me, me._title);

        // Apply configuration via setters to ensure validation
        if (config.minHeight !== undefined) me.minHeight = config.minHeight;
        if (config.minWidth !== undefined) me.minWidth = config.minWidth;
        if (config.closable !== undefined) me.closable = config.closable;
        if (config.collapsible !== undefined) me.collapsible = config.collapsible;
        if (config.movable !== undefined) me.movable = config.movable;

        // Ensure element is created immediately via the standard lifecycle.
        // This calls UIElement.render(), which calls _doRender() and then populate().
        me.render();
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
        return this._parentGroup;
    }

    /**
     * Sets the parent PanelGroup.
     *
     * @param {import('./PanelGroup.js').PanelGroup | null} value - The new parent group.
     * @returns {void}
     */
    set parentGroup(value) {
        const me = this;
        if (value !== null && typeof value !== 'object') {
            console.warn(
                `[Panel] invalid parentGroup assignment (${value}). Must be an object or null.`
            );
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
        return this._header;
    }

    /**
     * Retrieves the content DOM element.
     * Alias for 'element' from UIElement, maintained for compatibility.
     *
     * @returns {HTMLElement | null} The content element.
     */
    get contentElement() {
        return this.element;
    }

    /**
     * Retrieves the panel title.
     *
     * @returns {string} The title.
     */
    get title() {
        return this._title;
    }

    /**
     * Sets the panel title.
     *
     * @param {string} value - The new title.
     * @returns {void}
     */
    set title(value) {
        const me = this;
        if (typeof value !== 'string') {
            console.warn(
                `[Panel] invalid title assignment (${value}). Must be a string. Keeping previous value: ${me._title}`
            );
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
        return this._minHeight;
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
                `[Panel] invalid minHeight assignment (${value}). Must be a positive number. Keeping previous value: ${me._minHeight}`
            );
            return;
        }
        me._minHeight = num;
        me.updateHeight();
    }

    /**
     * Retrieves the minimum width.
     *
     * @returns {number} The minimum width.
     */
    get minWidth() {
        return this._minWidth;
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
                `[Panel] invalid minWidth assignment (${value}). Must be a positive number. Keeping previous value: ${me._minWidth}`
            );
            return;
        }
        me._minWidth = num;
        me.updateHeight();
    }

    /**
     * Checks if the panel is closable.
     *
     * @returns {boolean} True if closable.
     */
    get closable() {
        return this._closable;
    }

    /**
     * Sets whether the panel is closable.
     *
     * @param {boolean} value - True to allow closing.
     * @returns {void}
     */
    set closable(value) {
        const me = this;
        if (typeof value !== 'boolean') {
            console.warn(
                `[Panel] invalid closable assignment (${value}). Must be boolean. Keeping previous value: ${me._closable}`
            );
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
        return this._collapsible;
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
            console.warn(
                `[Panel] invalid collapsible assignment (${value}). Must be boolean. Keeping previous value: ${me._collapsible}`
            );
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
        return this._movable;
    }

    /**
     * Sets whether the panel is movable.
     *
     * @param {boolean} value - True to allow moving.
     * @returns {void}
     */
    set movable(value) {
        const me = this;
        if (typeof value !== 'boolean') {
            console.warn(
                `[Panel] invalid movable assignment (${value}). Must be boolean. Keeping previous value: ${me._movable}`
            );
            return;
        }
        me._movable = value;
        if (me._header) {
            me._header.updateConfig({ closable: me._closable, movable: value });
        }
    }

    /**
     * Sets the title (Alias for title setter).
     *
     * @param {string} title - The new title.
     * @returns {void}
     */
    setTitle(title) {
        this.title = title;
    }

    /**
     * Gets the title (Alias for title getter).
     *
     * @returns {string} The title.
     */
    getTitle() {
        return this.title;
    }

    /**
     * Sets the inner content of the panel.
     * Delegates to the renderer adapter.
     *
     * @param {string|HTMLElement|object} content - The content to display.
     * @returns {void}
     */
    setContent(content) {
        const me = this;
        if (me.element) {
            me.renderer.updateContent(me.element, content);
        }
    }

    /**
     * Requests the panel to close itself.
     * Emits an event to the parent group.
     *
     * @returns {void}
     */
    close() {
        const me = this;
        if (!me._closable) return;

        if (me._parentGroup) {
            appBus.emit(EventTypes.PANEL_GROUP_CHILD_CLOSE, {
                panel: me,
                group: me._parentGroup
            });
        }
    }

    /**
     * Returns the minimum height.
     *
     * @returns {number}
     */
    getMinHeight() {
        return Math.max(0, this._minHeight);
    }

    /**
     * Returns the minimum width.
     *
     * @returns {number}
     */
    getMinWidth() {
        return Math.max(0, this._minWidth);
    }

    // --- UIElement Overrides ---

    /**
     * Extended render method.
     * Calls super.render() to create the DOM via _doRender,
     * then calls populate() to let subclasses fill the content.
     *
     * @returns {void}
     */
    render() {
        super.render();
        this.populate();
    }

    /**
     * Hook for subclasses to populate content without overriding render.
     *
     * @returns {void}
     */
    populate() {
        // Intentionally empty. Subclasses override this.
    }

    /**
     * Implementation of the rendering logic.
     * Uses the VanillaPanelAdapter to create the specific panel DOM structure.
     *
     * @returns {HTMLElement} The created content element.
     * @protected
     */
    _doRender() {
        const me = this;
        const element = me.renderer.createContentElement(me.id);
        me.renderer.updateMinSize(element, me._minWidth, me._minHeight);
        return element;
    }

    /**
     * Implementation of the mounting logic.
     * Inserts the element into the container and sets up state listeners.
     *
     * @param {HTMLElement} container - The parent container.
     * @protected
     */
    _doMount(container) {
        const me = this;
        if (me.element) {
            me.renderer.mount(container, me.element);
        }
        me._setupStateListeners();
    }

    /**
     * Implementation of the unmounting logic.
     * Removes the element from the DOM and tears down state listeners.
     *
     * @protected
     */
    _doUnmount() {
        const me = this;
        if (me.element && me.element.parentNode) {
            me.renderer.unmount(me.element.parentNode, me.element);
        }
        me._teardownStateListeners();
    }

    /**
     * Applies height and width constraints to the DOM element.
     *
     * @returns {void}
     */
    updateHeight() {
        const me = this;
        if (me.element) {
            me.renderer.updateMinSize(me.element, me._minWidth, me._minHeight);
        }
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
     * Calculates the total minimum height including header.
     *
     * @returns {number} Total minimum height.
     */
    getMinPanelHeight() {
        const me = this;
        return Math.max(0, me._minHeight);
    }

    /**
     * Calculates the total minimum width.
     *
     * @returns {number} Total minimum width.
     */
    getMinPanelWidth() {
        const me = this;
        return Math.max(0, me._minWidth);
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
     * Wrapper for parentGroup setter compatibility.
     *
     * @param {import('./PanelGroup.js').PanelGroup | null} group
     * @returns {void}
     */
    setParentGroup(group) {
        this.parentGroup = group;
    }

    /**
     * Disposes the panel and its children (header).
     *
     * @returns {void}
     */
    dispose() {
        const me = this;
        if (me._header && typeof me._header.destroy === 'function') {
            me._header.destroy();
        }
        super.dispose();
    }

    /**
     * Serializes the Panel's state.
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
     * Deserializes state.
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
     * Subscribes to keys in GlobalStateService.
     * Called automatically on mount.
     *
     * @private
     * @returns {void}
     */
    _setupStateListeners() {
        const me = this;
        // Clear existing to be safe
        me._teardownStateListeners();

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
     * Unsubscribes from keys in GlobalStateService.
     * Called automatically on unmount.
     *
     * @private
     * @returns {void}
     */
    _teardownStateListeners() {
        const me = this;
        if (me._boundStateListeners) {
            me._boundStateListeners.forEach((listener, key) => {
                globalState.unsubscribe(key, listener);
            });
            me._boundStateListeners.clear();
        }
    }

    /**
     * Hook called when an observed state key changes.
     * Subclasses should override this.
     *
     * @param {string} key - The state key.
     * @param {*} value - The new value.
     * @returns {void}
     */
    onStateUpdate(key, value) {
        // Intentionally empty for subclasses
    }

    /**
     * Defines which keys to observe.
     * Subclasses should override this.
     *
     * @returns {Array<string>} Array of keys.
     */
    getObservedStateKeys() {
        return [];
    }
}
