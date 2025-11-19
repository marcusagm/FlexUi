import { PanelGroup } from '../Panel/PanelGroup.js';
import { appBus } from '../../utils/EventBus.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';
import { generateId } from '../../utils/generateId.js';
import { ResizeHandleManager } from '../../utils/ResizeHandleManager.js';
import { DropZoneType } from '../../constants/DNDTypes.js';
import { EventTypes } from '../../constants/EventTypes.js';

/**
 * Description:
 * Manages a single vertical column in the container. It holds and organizes
 * PanelGroups, manages horizontal resizing via ResizeHandleManager, and delegates
 * drag/drop logic.
 *
 * Properties summary:
 * - _namespace {string} : Unique namespace for appBus listeners.
 * - element {HTMLElement} : The main DOM element (<div class="column">).
 * - dropZoneType {string} : The identifier for the DragDropService.
 * - id {string} : Unique ID for this instance.
 * - _namespace {string} : Unique namespace for appBus listeners.
 * - minWidth {number} : The minimum width of the column.
 * - parentContainer {Row} : The parent Row instance.
 * - panelGroups {Array<PanelGroup>} : List of child PanelGroups.
 * - width {number|null} : The width of the column.
 * - _throttledUpdate {Function | null} : The throttled function for resizing.
 * - _boundOnPanelGroupRemoved {Function | null} : Bound handler for group removal.
 * - _resizeHandleManager {ResizeHandleManager | null} : Manages the horizontal resize handles.
 *
 * Typical usage:
 * // In Row.js
 * const column = new Column(this, width);
 * this.element.appendChild(column.element);
 *
 * Events:
 * - Listens to: EventTypes.PANEL_GROUP_REMOVED (to clean up empty groups)
 * - Emits: EventTypes.LAYOUT_PANELGROUPS_CHANGED (to notify LayoutService)
 * - Emits: EventTypes.COLUMN_EMPTY (to notify Row when this column is empty)
 *
 * Business rules implemented:
 * - Renders 'PanelGroup' children vertically.
 * - Registers as a 'column' type drop zone.
 * - Listens for EventTypes.PANEL_GROUP_REMOVED and removes the child.
 * - If it becomes empty (last PanelGroup removed), emits EventTypes.COLUMN_EMPTY.
 * - Manages its own horizontal resize handle via ResizeHandleManager.
 * - Resize logic respects the minWidth of its child PanelGroups.
 *
 * Dependencies:
 * - {import('../Panel/PanelGroup.js').PanelGroup}
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
     * List of child PanelGroups.
     *
     * @type {Array<PanelGroup>}
     * @private
     */
    _panelGroups = [];

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
     * Stores the bound reference for the 'onPanelGroupRemoved' listener.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnPanelGroupRemoved = null;

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

        // Use setters for initialization
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

        me._boundOnPanelGroupRemoved = me.onPanelGroupRemoved.bind(me);

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
        // Trigger layout update on width change (except during drag which might handle it differently)
        me.requestLayoutUpdate();
    }

    /**
     * PanelGroups getter.
     *
     * @returns {Array<PanelGroup>} The list of panel groups.
     */
    get panelGroups() {
        return this._panelGroups;
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
     * Validates that the value looks like a Row component.
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
     * Validates that the value is a positive number.
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
     * Wrapper for parentContainer setter (for compatibility).
     *
     * @param {import('../Row/Row.js').Row} container - The parent Row instance.
     * @returns {void}
     */
    setParentContainer(container) {
        this.parentContainer = container;
    }

    /**
     * Calculates the effective minimum width by checking its own minWidth
     * and the minWidth of all child PanelGroups.
     *
     * @returns {number} The calculated effective minWidth.
     */
    getEffectiveMinWidth() {
        const me = this;
        let effectiveMinWidth = me.minWidth;
        me.panelGroups.forEach(group => {
            effectiveMinWidth = Math.max(effectiveMinWidth, group.getMinPanelWidth());
        });
        return effectiveMinWidth;
    }

    /**
     * Initializes appBus event listeners for this component.
     *
     * @returns {void}
     */
    initEventListeners() {
        appBus.on(EventTypes.PANEL_GROUP_REMOVED, this._boundOnPanelGroupRemoved, {
            namespace: this._namespace
        });
    }

    /**
     * Event handler for when a child PanelGroup is removed.
     *
     * @param {object} eventData - The event data.
     * @param {PanelGroup} eventData.panel - The PanelGroup instance being removed.
     * @param {Column} eventData.column - The Column it is being removed from.
     * @returns {void}
     */
    onPanelGroupRemoved({ panel, column }) {
        if (column === this && panel instanceof PanelGroup) {
            this.removePanelGroup(panel, true);
        }
    }

    /**
     * Cleans up appBus listeners and destroys all child PanelGroups.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        appBus.offByNamespace(me._namespace);
        me.getThrottledUpdate()?.cancel();
        me._resizeHandleManager?.destroy();

        [...me._panelGroups].forEach(panel => panel.destroy());
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
     * Adds multiple PanelGroups at once (used for state restoration).
     *
     * @param {Array<PanelGroup>} panelGroups - Array of PanelGroup instances.
     * @returns {void}
     */
    addPanelGroupsBulk(panelGroups) {
        const me = this;
        const resizeHandle = me.element.querySelector('.column__resize-handle');
        panelGroups.forEach(panelGroup => {
            me._panelGroups.push(panelGroup);
            me.element.insertBefore(panelGroup.element, resizeHandle);
            panelGroup.setParentColumn(me);
        });
        me.requestLayoutUpdate();
    }

    /**
     * Adds a single PanelGroup to the column at a specific index.
     *
     * @param {PanelGroup} panelGroup - The PanelGroup instance to add.
     * @param {number|null} [index=null] - The index to insert at.
     * @returns {void}
     */
    addPanelGroup(panelGroup, index = null) {
        const me = this;
        const resizeHandle = me.element.querySelector('.column__resize-handle');

        if (index === null) {
            me._panelGroups.push(panelGroup);
            me.element.insertBefore(panelGroup.element, resizeHandle);
        } else {
            me._panelGroups.splice(index, 0, panelGroup);
            const nextSiblingPanel = me._panelGroups[index + 1];
            let nextSiblingElement = nextSiblingPanel ? nextSiblingPanel.element : null;

            if (!nextSiblingElement) {
                nextSiblingElement = resizeHandle;
            }
            me.element.insertBefore(panelGroup.element, nextSiblingElement);
        }
        panelGroup.setParentColumn(me);
        me.requestLayoutUpdate();
    }

    /**
     * Gets all collapsed PanelGroups.
     *
     * @returns {Array<PanelGroup>} Collapsed PanelGroup instances.
     */
    getPanelGroupsCollapsed() {
        return this._panelGroups.filter(p => p.collapsed);
    }

    /**
     * Gets all uncollapsed PanelGroups.
     *
     * @returns {Array<PanelGroup>} Uncollapsed PanelGroup instances.
     */
    getPanelGroupsUncollapsed() {
        return this._panelGroups.filter(p => !p.collapsed);
    }

    /**
     * PanelGroups getter (wrapper for compatibility).
     *
     * @returns {Array<PanelGroup>} All child PanelGroup instances.
     */
    getPanelGroups() {
        return this.panelGroups;
    }

    /**
     * Removes a PanelGroup from the column.
     *
     * @param {PanelGroup} panelGroup - The PanelGroup instance to remove.
     * @param {boolean} [emitEmpty=true] - Whether to emit EventTypes.COLUMN_EMPTY.
     * @returns {void}
     */
    removePanelGroup(panelGroup, emitEmpty = true) {
        const me = this;
        const index = me.getPanelGroupIndex(panelGroup);
        if (index === -1) {
            return;
        }

        me._panelGroups.splice(index, 1);
        panelGroup.setParentColumn(null);

        if (me.element.contains(panelGroup.element)) {
            me.element.removeChild(panelGroup.element);
        }

        me.requestLayoutUpdate();

        if (emitEmpty && me.getTotalPanelGroups() === 0) {
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
     * Finds the state index of a PanelGroup instance.
     *
     * @param {PanelGroup} panelGroup - The PanelGroup to find.
     * @returns {number} The index, or -1 if not found.
     */
    getPanelGroupIndex(panelGroup) {
        return this._panelGroups.findIndex(p => p === panelGroup);
    }

    /**
     * Finds the state index of a PanelGroup based on its DOM element.
     *
     * @param {HTMLElement} element - The DOM element of the PanelGroup.
     * @returns {number} The index.
     */
    getPanelGroupIndexByElement(element) {
        const me = this;
        const allChildren = Array.from(me.element.children);
        let panelIndex = 0;
        for (const child of allChildren) {
            if (child === element) {
                break;
            }
            if (
                me._panelGroups.some(p => p.element === child) &&
                child.classList.contains('panel-group')
            ) {
                panelIndex++;
            }
        }
        return panelIndex;
    }

    /**
     * Gets the total number of PanelGroups in this column.
     *
     * @returns {number} The total number of PanelGroups.
     */
    getTotalPanelGroups() {
        return this._panelGroups.length;
    }

    /**
     * Serializes the Column state (and its child PanelGroups) to JSON.
     *
     * @returns {object} The serialized state object.
     */
    toJSON() {
        const me = this;
        return {
            width: me.width,
            panelGroups: me.panelGroups
                .filter(group => group instanceof PanelGroup)
                .map(group => group.toJSON())
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
        if (data.width !== undefined) {
            me.width = data.width;
        }

        const groupsToRestore = [];
        if (data.panelGroups && Array.isArray(data.panelGroups)) {
            data.panelGroups.forEach(groupData => {
                const group = new PanelGroup();
                group.fromJSON(groupData);
                groupsToRestore.push(group);
            });
        }

        if (groupsToRestore.length > 0) {
            me.addPanelGroupsBulk(groupsToRestore);
        }

        me.updateWidth(false);
    }
}
