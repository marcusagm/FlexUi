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
 * - _state {object} : Internal state management (child PanelGroups, width, parent).
 * - element {HTMLElement} : The main DOM element (<div class="column">).
 * - dropZoneType {string} : The identifier for the DragDropService.
 * - _id {string} : Unique ID for this instance.
 * - _namespace {string} : Unique namespace for appBus listeners.
 * - _minWidth {number} : The minimum width in pixels for horizontal resizing.
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
 * Dependencies:
 * - {import('../Panel/PanelGroup.js').PanelGroup}
 * - {import('../../utils/EventBus.js').appBus}
 * - {import('../../utils/ThrottleRAF.js').throttleRAF}
 * - {import('../../utils/ResizeHandleManager.js').ResizeHandleManager}
 * - {import('../../constants/DNDTypes.js').DropZoneType}
 * - {import('../../constants/EventTypes.js').EventTypes}
 */
export class Column {
    /**
     * Internal state holding child PanelGroups and dimensions.
     *
     * @type {{container: import('../Row/Row.js').Row | null, panelGroups: Array<PanelGroup>, width: number | null}}
     * @private
     */
    _state = {
        container: null,
        panelGroups: [],
        width: null
    };

    /**
     * Unique ID for this instance, used for namespacing events.
     *
     * @type {string}
     * @private
     */
    _id = generateId();

    /**
     * Unique namespace for appBus listeners.
     *
     * @type {string}
     * @private
     */
    _namespace = this._id;

    /**
     * The minimum width in pixels for horizontal resizing.
     *
     * @type {number}
     * @private
     */
    _minWidth = 150;

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
     * @type {import('../../utils/ResizeHandleManager.js').ResizeHandleManager | null}
     * @private
     */
    _resizeHandleManager = null;

    /**
     * @param {import('../Row/Row.js').Row} container - The parent Row instance.
     * @param {number|null} [width=null] - The initial width of the column.
     */
    constructor(container, width = null) {
        const me = this;
        me.setMinWidth(me._minWidth);
        me.setParentContainer(container);
        me._state.width = width;

        me.element = document.createElement('div');
        me.element.classList.add('column');
        me.dropZoneType = DropZoneType.COLUMN;

        me.element.dataset.dropzone = me.dropZoneType;
        me.element.dropZoneInstance = me;

        me.setThrottledUpdate(
            throttleRAF(() => {
                if (me._state.width !== null) {
                    me.element.style.flex = `0 0 ${me._state.width}px`;
                }
            })
        );

        me._boundOnPanelGroupRemoved = me.onPanelGroupRemoved.bind(me);

        me.initEventListeners();
    }

    /**
     * MinimumWidth setter with validation.
     *
     * @param {number} width - The minimum width in pixels.
     * @returns {void}
     */
    setMinWidth(width) {
        const minimumWidth = Number(width);
        if (!Number.isFinite(minimumWidth) || minimumWidth < 0) {
            console.warn(`Column: Invalid minimumWidth "${width}". Setting to 0.`);
            this._minWidth = 0;
            return;
        }
        this._minWidth = minimumWidth;
    }

    /**
     * MinimumWidth getter.
     *
     * @returns {number} The minimum width in pixels.
     */
    getMinWidth() {
        return this._minWidth;
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
     * ParentContainer setter.
     *
     * @param {import('../Row/Row.js').Row} container - The parent Row instance.
     * @returns {void}
     */
    setParentContainer(container) {
        if (!container) {
            console.warn('Column: setParentContainer received a null container.');
            return;
        }
        this._state.container = container;
    }

    /**
     * Calculates the effective minimum width by checking its own minWidth
     * and the minWidth of all child PanelGroups.
     *
     * @returns {number} The calculated effective minimum width.
     */
    getEffectiveMinWidth() {
        const me = this;
        let effectiveMinWidth = me.getMinWidth();
        me.getPanelGroups().forEach(group => {
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

        [...me._state.panelGroups].forEach(panel => panel.destroy());
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
                me._state.width = width;
                me.getThrottledUpdate()();
            },
            onEnd: () => {
                if (me._state.container) {
                    me._state.container.requestLayoutUpdate();
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
            me._state.width = null;
        } else if (me._state.width !== null) {
            me.element.style.flex = `0 0 ${me._state.width}px`;
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
            me._state.panelGroups.push(panelGroup);
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
            me._state.panelGroups.push(panelGroup);
            me.element.insertBefore(panelGroup.element, resizeHandle);
        } else {
            me._state.panelGroups.splice(index, 0, panelGroup);
            const nextSiblingPanel = me._state.panelGroups[index + 1];
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
        return this._state.panelGroups.filter(p => p._state.collapsed);
    }

    /**
     * Gets all uncollapsed PanelGroups.
     *
     * @returns {Array<PanelGroup>} Uncollapsed PanelGroup instances.
     */
    getPanelGroupsUncollapsed() {
        return this._state.panelGroups.filter(p => !p._state.collapsed);
    }

    /**
     * PanelGroups getter.
     *
     * @returns {Array<PanelGroup>} All child PanelGroup instances.
     */
    getPanelGroups() {
        return this._state.panelGroups;
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

        me._state.panelGroups.splice(index, 1);
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
        if (this._state.container) {
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
        return this._state.panelGroups.findIndex(p => p === panelGroup);
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
                me._state.panelGroups.some(p => p.element === child) &&
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
        return this._state.panelGroups.length;
    }

    /**
     * Serializes the Column state (and its child PanelGroups) to JSON.
     *
     * @returns {object} The serialized state object.
     */
    toJSON() {
        const me = this;
        return {
            width: me._state.width,
            panelGroups: me._state.panelGroups
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
            me._state.width = data.width;
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
