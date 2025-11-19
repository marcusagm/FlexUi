import { PanelGroup } from '../Panel/PanelGroup.js';
import { Viewport } from '../Viewport/Viewport.js';
import { appBus } from '../../utils/EventBus.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';
import { generateId } from '../../utils/generateId.js';
import { ResizeHandleManager } from '../../utils/ResizeHandleManager.js';
import { DropZoneType, ItemType } from '../../constants/DNDTypes.js';
import { EventTypes } from '../../constants/EventTypes.js';

/**
 * Description:
 * Manages a single vertical column in the container. It holds and organizes
 * generic children components (PanelGroups or Viewports), manages horizontal
 * resizing via ResizeHandleManager, and delegates drag/drop logic.
 *
 * This class is agnostic to the specific type of child (PanelGroup or Viewport),
 * treating them as generic layout units provided they implement the expected interface
 * (element, destroy, toJSON, etc.).
 *
 * Properties summary:
 * - _namespace {string} : Unique namespace for appBus listeners.
 * - element {HTMLElement} : The main DOM element (<div class="column">).
 * - dropZoneType {string} : The identifier for the DragDropService.
 * - id {string} : Unique ID for this instance.
 * - minWidth {number} : The minimum width of the column.
 * - parentContainer {Row} : The parent Row instance.
 * - children {Array<PanelGroup|Viewport>} : List of child components.
 * - width {number|null} : The width of the column.
 * - _throttledUpdate {Function | null} : The throttled function for resizing.
 * - _boundOnChildRemoved {Function | null} : Bound handler for child removal via events.
 * - _resizeHandleManager {ResizeHandleManager | null} : Manages the horizontal resize handles.
 *
 * Typical usage:
 * // In Row.js
 * const column = new Column(this, width);
 * this.element.appendChild(column.element);
 * column.addChild(new PanelGroup(...));
 *
 * Events:
 * - Listens to: EventTypes.PANEL_GROUP_REMOVED (to clean up empty groups)
 * - Emits: EventTypes.LAYOUT_PANELGROUPS_CHANGED (to notify LayoutService)
 * - Emits: EventTypes.COLUMN_EMPTY (to notify Row when this column is empty)
 *
 * Business rules implemented:
 * - Renders children vertically.
 * - Registers as a 'column' type drop zone.
 * - Automatically removes children via 'onChildRemoved' if they request removal.
 * - If it becomes empty (last child removed), emits EventTypes.COLUMN_EMPTY.
 * - Manages its own horizontal resize handle via ResizeHandleManager.
 * - Resize logic dynamically calculates minWidth based on children constraints.
 * - Supports serialization (toJSON/fromJSON) for both PanelGroups and Viewports.
 *
 * Dependencies:
 * - {import('../Panel/PanelGroup.js').PanelGroup}
 * - {import('../Viewport/Viewport.js').Viewport}
 * - {import('../Panel/PanelFactory.js').PanelFactory}
 * - {import('../Viewport/ViewportFactory.js').ViewportFactory}
 * - {import('../../utils/EventBus.js').appBus}
 * - {import('../../utils/ThrottleRAF.js').throttleRAF}
 * - {import('../../utils/generateId.js').generateId}
 * - {import('../../utils/ResizeHandleManager.js').ResizeHandleManager}
 * - {import('../../constants/DNDTypes.js').DropZoneType}
 * - {import('../../constants/EventTypes.js').EventTypes}
 */
export class Column {
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
     * @type {Array<PanelGroup|Viewport>}
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
     * Unique ID for this instance, used for namespacing events.
     *
     * @type {string}
     * @public
     */
    id = generateId();

    /**
     * Unique namespace for appBus listeners.
     *
     * @type {string}
     * @private
     */
    _namespace = this.id;

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
     * The main DOM element.
     *
     * @type {HTMLElement}
     * @public
     */
    element;

    /**
     * The drop zone type identifier.
     *
     * @type {string}
     * @public
     */
    dropZoneType;

    /**
     * @param {import('../Row/Row.js').Row} container - The parent Row instance.
     * @param {number|null} [width=null] - The initial width of the column.
     */
    constructor(container, width = null) {
        const me = this;

        me.minWidth = me._minWidth;
        me.parentContainer = container;
        me.width = width;

        me.element = document.createElement('div');
        me.element.classList.add('column');
        me.dropZoneType = DropZoneType.COLUMN;

        me.element.dataset.dropzone = me.dropZoneType;
        me.element.dropZoneInstance = me;

        me.setThrottledUpdate(
            throttleRAF(() => {
                if (me.width !== null) {
                    me.element.style.flex = `0 0 ${me.width}px`;
                }
            })
        );

        me._boundOnChildRemoved = me.onChildRemoved.bind(me);

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
        me.requestLayoutUpdate();
    }

    /**
     * Children getter.
     *
     * @returns {Array<PanelGroup|Viewport>} The list of children.
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
     * Wrapper method for minWidth setter (for compatibility).
     *
     * @param {number} width
     * @returns {void}
     */
    setMinWidth(width) {
        this.minWidth = width;
    }

    /**
     * Wrapper method for minWidth getter (for compatibility).
     *
     * @returns {number}
     */
    getMinWidth() {
        return this.minWidth;
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
            // PanelGroup has getMinPanelWidth(), Viewport/Windows usually have minWidth property
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
        // Listens for legacy PanelGroup removal events to support PanelGroup closure
        appBus.on(EventTypes.PANEL_GROUP_REMOVED, this._boundOnChildRemoved, {
            namespace: this._namespace
        });
    }

    /**
     * Event handler for when a child (specifically PanelGroup) reports removal via EventBus.
     *
     * @param {object} eventData - The event data.
     * @param {PanelGroup} eventData.panel - The instance being removed.
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
    destroy() {
        const me = this;
        appBus.offByNamespace(me._namespace);
        me.getThrottledUpdate()?.cancel();
        me._resizeHandleManager?.destroy();

        [...me._children].forEach(child => child.destroy());
    }

    /**
     * Adds the horizontal resize handle to the column using ResizeHandleManager.
     *
     * @param {boolean} isLast - Indicates if this is the last column in the row.
     * @returns {void}
     */
    addResizeBars(isLast) {
        const me = this;
        me.element.querySelectorAll('.column__resize-handle').forEach(element => element.remove());
        me.element.classList.remove('column--resize-right');
        me._resizeHandleManager?.destroy();

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
                me.getThrottledUpdate()();
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
        if (isLast) {
            me.element.style.flex = `1 1 auto`;
            me._width = null;
        } else if (me.width !== null) {
            me.element.style.flex = `0 0 ${me.width}px`;
        }
        me.requestLayoutUpdate();
    }

    /**
     * Adds multiple children at once.
     *
     * @param {Array<PanelGroup|Viewport>} children - Array of children instances.
     * @returns {void}
     */
    addChildrenBulk(children) {
        const me = this;
        const resizeHandle = me.element.querySelector('.column__resize-handle');
        children.forEach(child => {
            me._children.push(child);
            me.element.insertBefore(child.element, resizeHandle);
            if (typeof child.setParentColumn === 'function') {
                child.setParentColumn(me);
            }
        });
        me.requestLayoutUpdate();
    }

    /**
     * Adds a single child (PanelGroup or Viewport) to the column at a specific index.
     *
     * @param {PanelGroup|Viewport} child - The component instance to add.
     * @param {number|null} [index=null] - The index to insert at.
     * @returns {void}
     */
    addChild(child, index = null) {
        const me = this;
        const resizeHandle = me.element.querySelector('.column__resize-handle');

        if (index === null) {
            me._children.push(child);
            me.element.insertBefore(child.element, resizeHandle);
        } else {
            me._children.splice(index, 0, child);
            const nextSibling = me._children[index + 1];
            let nextSiblingElement = nextSibling ? nextSibling.element : null;

            if (!nextSiblingElement) {
                nextSiblingElement = resizeHandle;
            }
            me.element.insertBefore(child.element, nextSiblingElement);
        }

        if (typeof child.setParentColumn === 'function') {
            child.setParentColumn(me);
        }

        me.requestLayoutUpdate();
    }

    /**
     * Gets all collapsed children.
     * Viewports are never collapsed, so this returns only collapsed PanelGroups.
     *
     * @returns {Array<PanelGroup|Viewport>} Collapsed children instances.
     */
    getChildrenCollapsed() {
        return this._children.filter(child => {
            if (child instanceof PanelGroup) {
                return child.collapsed;
            }
            // Viewports are not collapsible
            return false;
        });
    }

    /**
     * Gets all uncollapsed children.
     * Includes open PanelGroups and all Viewports.
     *
     * @returns {Array<PanelGroup|Viewport>} Uncollapsed children instances.
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
     * @param {PanelGroup|Viewport} child - The instance to remove.
     * @param {boolean} [emitEmpty=true] - Whether to emit EventTypes.COLUMN_EMPTY.
     * @returns {void}
     */
    removeChild(child, emitEmpty = true) {
        const me = this;
        const index = me.getChildIndex(child);
        if (index === -1) {
            return;
        }

        me._children.splice(index, 1);
        if (typeof child.setParentColumn === 'function') {
            child.setParentColumn(null);
        }

        if (me.element.contains(child.element)) {
            me.element.removeChild(child.element);
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
     * @param {PanelGroup|Viewport} child - The child to find.
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
        const allChildren = Array.from(me.element.children);
        let panelIndex = 0;
        for (const child of allChildren) {
            if (child === element) {
                break;
            }
            if (
                (child.classList.contains('panel-group') || child.classList.contains('viewport')) &&
                me._children.some(p => p.element === child)
            ) {
                panelIndex++;
            }
        }
        return panelIndex;
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
     * Handles polymorphic children types (PanelGroup vs Viewport).
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
     * Uses factories to instantiate correct child types (PanelGroup or Viewport).
     *
     * @param {object} data - The state object.
     * @returns {void}
     */
    fromJSON(data) {
        const me = this;
        if (data.width !== undefined) {
            me.width = data.width;
        }

        // Support 'children' (new) or 'panelGroups' (legacy)
        const childrenData = data.children || data.panelGroups;
        const itemsToRestore = [];

        if (childrenData && Array.isArray(childrenData)) {
            childrenData.forEach(itemData => {
                let item = null;

                // Check for Viewport type
                if (
                    itemData.type === ItemType.VIEWPORT ||
                    itemData.type === DropZoneType.VIEWPORT
                ) {
                    item = new Viewport();
                    // Viewport hydration if it supports fromJSON in the future
                    if (typeof item.fromJSON === 'function') {
                        item.fromJSON(itemData);
                    }
                } else {
                    // Default to PanelGroup for backward compatibility or explicit type
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
}
