import { PanelGroup } from '../Panel/PanelGroup.js';
import { Viewport } from '../Viewport/Viewport.js';
import { appBus } from '../../utils/EventBus.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';
import { generateId } from '../../utils/generateId.js';
import { ResizeHandleManager } from '../../utils/ResizeHandleManager.js';
import { DropZoneType, ItemType } from '../../constants/DNDTypes.js';
import { EventTypes } from '../../constants/EventTypes.js';
import { UIElement } from '../../core/UIElement.js';
import { VanillaColumnAdapter } from '../../renderers/vanilla/VanillaColumnAdapter.js';
import { ViewportFactory } from '../Viewport/ViewportFactory.js';

/**
 * Description:
 * Manages a single vertical column in the container. It holds and organizes
 * generic children components (PanelGroups or Viewports), manages horizontal
 * resizing via ResizeHandleManager, and delegates drag/drop logic.
 *
 * It extends UIElement to participate in the application lifecycle and delegates
 * DOM rendering to VanillaColumnAdapter.
 *
 * Properties summary:
 * - id {string} : Unique ID for this instance.
 * - parentContainer {Row} : The parent Row instance.
 * - children {Array<PanelGroup|Viewport>} : List of child components.
 * - width {number|null} : The width of the column.
 * - minWidth {number} : The minimum width of the column.
 * - dropZoneType {string} : The identifier for the DragDropService.
 *
 * Typical usage:
 * const column = new Column(rowInstance, 300);
 * column.addChild(new PanelGroup(...));
 *
 * Events:
 * - Listens to: EventTypes.COLUMN_EMPTY (via appBus)
 * - Emits: EventTypes.LAYOUT_PANELGROUPS_CHANGED
 * - Emits: EventTypes.COLUMN_EMPTY
 *
 * Business rules implemented:
 * - Acts as a 'column' drop zone.
 * - Manages children (PanelGroups/Viewports) and their lifecycle.
 * - Supports fixed or fluid width (flex-basis).
 * - Integrates with ResizeHandleManager for width adjustments.
 * - Provides API for LayoutService to apply computed constraints.
 *
 * Dependencies:
 * - {import('../../core/UIElement.js').UIElement}
 * - {import('../../renderers/vanilla/VanillaColumnAdapter.js').VanillaColumnAdapter}
 * - {import('../../utils/ResizeHandleManager.js').ResizeHandleManager}
 * - {import('../../utils/EventBus.js').appBus}
 * - {import('../Panel/PanelGroup.js').PanelGroup}
 * - {import('../Viewport/Viewport.js').Viewport}
 * - {import('../Panel/PanelFactory.js').PanelFactory}
 * - {import('../Viewport/ViewportFactory.js').ViewportFactory}
 *
 * Notes / Additional:
 * - The Column delegates horizontal resizing to its child Columns logic via the LayoutService interactions.
 */
export class Column extends UIElement {
    /**
     * The parent Row instance.
     *
     * @type {import('../Row/Row.js').Row | null}
     * @private
     */
    _parentContainer = null;

    /**
     * List of child components (PanelGroups or Viewports).
     *
     * @type {Array<import('../Panel/PanelGroup.js').PanelGroup | import('../Viewport/Viewport.js').Viewport>}
     * @private
     */
    _children = [];

    /**
     * The width of the column in pixels.
     *
     * @type {number | null}
     * @private
     */
    _width = null;

    /**
     * The minimum width in pixels for horizontal resizing.
     *
     * @type {number}
     * @private
     */
    _minWidth = 150;

    /**
     * Unique namespace for appBus listeners.
     *
     * @type {string | null}
     * @private
     */
    _namespace = null;

    /**
     * The throttled (rAF) update function for resizing.
     *
     * @type {Function | null}
     * @private
     */
    _throttledUpdate = null;

    /**
     * Stores the bound reference for the child removal listener.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnChildRemoved = null;

    /**
     * Stores the resize handle manager instance.
     *
     * @type {ResizeHandleManager | null}
     * @private
     */
    _resizeHandleManager = null;

    /**
     * The drop zone type identifier.
     *
     * @type {string}
     * @public
     */
    dropZoneType = DropZoneType.COLUMN;

    /**
     * Creates a new Column instance.
     *
     * @param {import('../Row/Row.js').Row} container - The parent Row instance.
     * @param {number|null} [width=null] - The initial width of the column.
     * @param {import('../../core/IRenderer.js').IRenderer} [renderer=null] - Optional renderer.
     */
    constructor(container, width = null, renderer = null) {
        super(generateId(), renderer || new VanillaColumnAdapter());
        const me = this;

        me._namespace = me.id;
        me.minWidth = me._minWidth;
        me.parentContainer = container;
        me.width = width;

        me.setThrottledUpdate(
            throttleRAF(() => {
                if (me._width !== null && me.element) {
                    me.renderer.updateWidth(me.element, me._width);
                }
            })
        );

        me._boundOnChildRemoved = me.onChildRemoved.bind(me);

        // Initialize DOM via UIElement lifecycle
        me.render();
        me.initEventListeners();
    }

    /**
     * Width getter.
     *
     * @returns {number | null} The current width.
     */
    get width() {
        return this._width;
    }

    /**
     * Width setter.
     * Validates input and requests layout update on change.
     *
     * @param {number | null} value - The new width.
     * @returns {void}
     */
    set width(value) {
        const me = this;
        if (value !== null && (!Number.isFinite(value) || value < 0)) {
            console.warn(
                `[Column] Invalid width assignment (${value}). Must be positive number or null.`
            );
            return;
        }
        if (me._width === value) return;

        me._width = value;

        if (me.element) {
            me.renderer.updateWidth(me.element, value);
        }

        me.requestLayoutUpdate();
    }

    /**
     * Children getter.
     *
     * @returns {Array<import('../Panel/PanelGroup.js').PanelGroup | import('../Viewport/Viewport.js').Viewport>} The list of children.
     */
    get children() {
        return this._children;
    }

    /**
     * ParentContainer getter.
     *
     * @returns {import('../Row/Row.js').Row | null} The parent row.
     */
    get parentContainer() {
        return this._parentContainer;
    }

    /**
     * ParentContainer setter.
     *
     * @param {import('../Row/Row.js').Row | null} value - The new parent container.
     * @returns {void}
     */
    set parentContainer(value) {
        if (value !== null && typeof value !== 'object') {
            console.warn(`[Column] Invalid parentContainer assignment (${value}).`);
            return;
        }
        this._parentContainer = value;
    }

    /**
     * MinimumWidth getter.
     *
     * @returns {number} The minimum width.
     */
    get minWidth() {
        return this._minWidth;
    }

    /**
     * MinimumWidth setter.
     *
     * @param {number} value - The new minimum width.
     * @returns {void}
     */
    set minWidth(value) {
        const num = Number(value);
        if (!Number.isFinite(num) || num < 0) {
            console.warn(
                `[Column] Invalid minWidth assignment (${value}). Must be positive number.`
            );
            return;
        }
        this._minWidth = num;
    }

    /**
     * ThrottledUpdate setter.
     *
     * @param {Function} throttledFunction - The throttled function.
     * @returns {void}
     */
    setThrottledUpdate(throttledFunction) {
        this._throttledUpdate = throttledFunction;
    }

    /**
     * ThrottledUpdate getter.
     *
     * @returns {Function | null} The throttled update function.
     */
    getThrottledUpdate() {
        return this._throttledUpdate;
    }

    /**
     * Implementation of the rendering logic.
     * Uses the adapter to create the column DOM structure.
     *
     * @returns {HTMLElement} The root column element.
     * @protected
     */
    _doRender() {
        const me = this;
        const element = me.renderer.createColumnElement(me.id);

        // Apply initial width
        me.renderer.updateWidth(element, me._width);

        // Configure DropZone
        element.dataset.dropzone = me.dropZoneType;
        element.dropZoneInstance = me;

        return element;
    }

    /**
     * Implementation of the mounting logic.
     * Mounts all children into the column.
     *
     * @param {HTMLElement} container - The parent container.
     * @protected
     */
    _doMount(container) {
        const me = this;
        if (me.element) {
            if (me.element.parentNode !== container) {
                me.renderer.mount(container, me.element);
            }

            // Mount all children
            me._children.forEach(child => {
                // Ensure child has its element created
                if (!child.element) child.render();

                // If a resize handle exists, we must insert before it
                const resizeHandle = me.element.querySelector('.column__resize-handle');
                if (resizeHandle) {
                    me.element.insertBefore(child.element, resizeHandle);
                } else {
                    me.renderer.mount(me.element, child.element);
                }

                child.mount(me.element);
            });
        }
    }

    /**
     * Implementation of the unmounting logic.
     *
     * @protected
     */
    _doUnmount() {
        const me = this;

        if (me._resizeHandleManager) {
            me._resizeHandleManager.destroy();
            me._resizeHandleManager = null;
        }

        if (me.getThrottledUpdate()) {
            me.getThrottledUpdate().cancel();
        }

        // Unmount children
        me._children.forEach(child => child.unmount());

        if (me.element && me.element.parentNode) {
            me.renderer.unmount(me.element.parentNode, me.element);
        }
    }

    /**
     * Sets a computed minimum width style on the element.
     * Used by LayoutService to enforce constraints based on content.
     *
     * @param {number} value - The computed min-width in pixels.
     * @returns {void}
     */
    setComputedMinWidth(value) {
        const me = this;
        if (me.element) {
            me.renderer.setMinWidth(me.element, value);
        }
    }

    /**
     * Calculates the effective minimum width by checking its own minWidth
     * and the minWidth of all children.
     *
     * @returns {number} The calculated effective minWidth.
     */
    getEffectiveMinWidth() {
        const me = this;
        let effectiveMinWidth = me.minWidth;
        me._children.forEach(child => {
            let childMin = 0;
            if (typeof child.getMinPanelWidth === 'function') {
                childMin = child.getMinPanelWidth();
            } else if (child.minWidth !== undefined) {
                childMin = child.minWidth;
            }
            effectiveMinWidth = Math.max(effectiveMinWidth, childMin);
        });
        return effectiveMinWidth;
    }

    /**
     * Initializes appBus event listeners for this component.
     *
     * @returns {void}
     */
    initEventListeners() {
        appBus.on(EventTypes.PANEL_GROUP_REMOVED, this._boundOnChildRemoved, {
            namespace: this._namespace
        });
    }

    /**
     * Event handler for when a child reports removal.
     *
     * @param {object} eventData - The event data.
     * @param {import('../Panel/PanelGroup.js').PanelGroup} eventData.panel - The instance being removed.
     * @param {Column} eventData.column - The Column it is being removed from.
     * @returns {void}
     */
    onChildRemoved({ panel, column }) {
        if (column === this) {
            this.removeChild(panel, true);
        }
    }

    /**
     * Cleans up appBus listeners and destroys all children.
     *
     * @returns {void}
     */
    dispose() {
        const me = this;
        appBus.offByNamespace(me._namespace);

        [...me._children].forEach(child => child.dispose());

        super.dispose();
    }

    /**
     * Adds the horizontal resize handle to the column using ResizeHandleManager.
     *
     * @param {boolean} isLast - Indicates if this is the last column in the row.
     * @returns {void}
     */
    addResizeBars(isLast) {
        const me = this;
        if (!me.element) return;

        // Clean up existing
        const existingHandles = me.element.querySelectorAll('.column__resize-handle');
        existingHandles.forEach(el => el.remove());
        me.element.classList.remove('column--resize-right');
        if (me._resizeHandleManager) {
            me._resizeHandleManager.destroy();
            me._resizeHandleManager = null;
        }

        if (isLast) {
            return;
        }

        me.element.classList.add('column--resize-right');

        me._resizeHandleManager = new ResizeHandleManager(me.element, {
            handles: ['e'],
            customClass: 'column__resize-handle',
            getConstraints: () => ({
                minimumWidth: me.getEffectiveMinWidth(),
                maximumWidth: Infinity,
                minimumHeight: 0,
                maximumHeight: Infinity,
                containerRectangle: null
            }),
            onResize: ({ width }) => {
                me._width = width;
                if (me.getThrottledUpdate()) {
                    me.getThrottledUpdate()();
                }
            },
            onEnd: () => {
                if (me.parentContainer) {
                    me.parentContainer.requestLayoutUpdate();
                }
            }
        });
    }

    /**
     * Updates the CSS flex-basis (width) of the column.
     *
     * @param {boolean} isLast - Indicates if this is the last column.
     * @returns {void}
     */
    updateWidth(isLast) {
        const me = this;
        if (!me.element) return;

        if (isLast) {
            me.renderer.updateWidth(me.element, null); // Auto
            me._width = null;
        } else {
            me.renderer.updateWidth(me.element, me.width);
        }
        me.requestLayoutUpdate();
    }

    /**
     * Adds multiple children at once.
     *
     * @param {Array<import('../Panel/PanelGroup.js').PanelGroup|import('../Viewport/Viewport.js').Viewport>} children - Array of children instances.
     * @returns {void}
     */
    addChildrenBulk(children) {
        const me = this;
        children.forEach(child => {
            me.addChild(child);
        });
        me.requestLayoutUpdate();
    }

    /**
     * Adds a single child (PanelGroup or Viewport) to the column at a specific index.
     *
     * @param {import('../Panel/PanelGroup.js').PanelGroup|import('../Viewport/Viewport.js').Viewport} child - The component instance to add.
     * @param {number|null} [index=null] - The index to insert at.
     * @returns {void}
     */
    addChild(child, index = null) {
        const me = this;
        if (!me.element) return;

        if (index === null || index >= me._children.length) {
            me._children.push(child);
        } else {
            me._children.splice(index, 0, child);
        }

        if (typeof child.setParentColumn === 'function') {
            child.setParentColumn(me);
        }

        // Mount if we are mounted
        if (me.isMounted) {
            if (!child.element) child.render();

            const safeIndex = index === null ? me._children.length - 1 : index;
            const nextChild = me._children[safeIndex + 1];

            const resizeHandle = me.element.querySelector('.column__resize-handle');
            const referenceNode = nextChild ? nextChild.element : resizeHandle;

            if (referenceNode) {
                me.element.insertBefore(child.element, referenceNode);
            } else {
                me.renderer.mount(me.element, child.element);
            }

            child.mount(me.element);
        }

        me.requestLayoutUpdate();
    }

    /**
     * Gets all collapsed children.
     *
     * @returns {Array<import('../Panel/PanelGroup.js').PanelGroup|import('../Viewport/Viewport.js').Viewport>} Collapsed children instances.
     */
    getChildrenCollapsed() {
        return this._children.filter(child => {
            if (child instanceof PanelGroup) {
                return child.collapsed;
            }
            return false;
        });
    }

    /**
     * Gets all uncollapsed children.
     *
     * @returns {Array<import('../Panel/PanelGroup.js').PanelGroup|import('../Viewport/Viewport.js').Viewport>} Uncollapsed children instances.
     */
    getChildrenUncollapsed() {
        return this._children.filter(child => {
            if (child instanceof Viewport) {
                return true;
            }
            return !child.collapsed;
        });
    }

    /**
     * Removes a child from the column.
     *
     * @param {import('../Panel/PanelGroup.js').PanelGroup|import('../Viewport/Viewport.js').Viewport} child - The instance to remove.
     * @param {boolean} [emitEmpty=true] - Whether to emit EventTypes.COLUMN_EMPTY.
     * @returns {void}
     */
    removeChild(child, emitEmpty = true) {
        const me = this;
        const index = me.getChildIndex(child);
        if (index === -1) {
            return;
        }

        child.unmount();

        me._children.splice(index, 1);
        if (typeof child.setParentColumn === 'function') {
            child.setParentColumn(null);
        }

        me.requestLayoutUpdate();

        if (emitEmpty && me.getChildCount() === 0) {
            appBus.emit(EventTypes.COLUMN_EMPTY, me);
        }
    }

    /**
     * Emits an event to the LayoutService to recalculate this column.
     *
     * @returns {void}
     */
    requestLayoutUpdate() {
        if (this.parentContainer) {
            appBus.emit(EventTypes.LAYOUT_PANELGROUPS_CHANGED, this);
        }
    }

    /**
     * Finds the state index of a child instance.
     *
     * @param {import('../Panel/PanelGroup.js').PanelGroup|import('../Viewport/Viewport.js').Viewport} child - The child to find.
     * @returns {number} The index, or -1 if not found.
     */
    getChildIndex(child) {
        return this._children.findIndex(p => p === child);
    }

    /**
     * Finds the state index of a child based on its DOM element.
     *
     * @param {HTMLElement} element - The DOM element of the child.
     * @returns {number} The index.
     */
    getChildIndexByElement(element) {
        const me = this;
        return me._children.findIndex(child => child.element === element);
    }

    /**
     * Gets the total number of children.
     *
     * @returns {number} The total count.
     */
    getChildCount() {
        return this._children.length;
    }

    /**
     * Serializes the Column state to JSON.
     *
     * @returns {object} The serialized state object.
     */
    toJSON() {
        const me = this;
        return {
            width: me.width,
            children: me._children
                .map(child => {
                    if (typeof child.toJSON === 'function') {
                        return child.toJSON();
                    }
                    return null;
                })
                .filter(Boolean)
        };
    }

    /**
     * Deserializes state from JSON data.
     *
     * @param {object} data - The state object.
     * @returns {void}
     */
    fromJSON(data) {
        const me = this;
        [...me._children].forEach(child => me.removeChild(child, false));

        if (data.width !== undefined) {
            me.width = data.width;
        }

        const childrenData = data.children || data.panelGroups;
        const itemsToRestore = [];

        if (childrenData && Array.isArray(childrenData)) {
            const viewportFactory = ViewportFactory.getInstance();

            childrenData.forEach(itemData => {
                let item = null;

                if (
                    itemData.type === ItemType.VIEWPORT ||
                    itemData.type === DropZoneType.VIEWPORT
                ) {
                    item = viewportFactory.createViewport(itemData);
                } else {
                    // Default to PanelGroup
                    item = new PanelGroup();
                    item.fromJSON(itemData);
                }

                if (item) {
                    itemsToRestore.push(item);
                }
            });
        }

        if (itemsToRestore.length > 0) {
            me.addChildrenBulk(itemsToRestore);
        }

        me.updateWidth(false);
    }

    /**
     * Wrapper method for minWidth setter.
     *
     * @param {number} width
     * @returns {void}
     */
    setMinWidth(width) {
        this.minWidth = width;
    }

    /**
     * Wrapper method for minWidth getter.
     *
     * @returns {number}
     */
    getMinWidth() {
        return this.minWidth;
    }
}
