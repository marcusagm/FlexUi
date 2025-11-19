import { PanelGroup } from '../Panel/PanelGroup.js';
import { appBus } from '../../utils/EventBus.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';
import { generateId } from '../../utils/generateId.js';
import { ResizeController } from '../../utils/ResizeController.js';
import { DropZoneType } from '../../constants/DNDTypes.js';
import { EventTypes } from '../../constants/EventTypes.js';

/**
 * Description:
 * Manages a single vertical column in the container. It holds and organizes
 * PanelGroups, manages horizontal resizing via ResizeController, and delegates
 * drag/drop logic.
 *
 * Properties summary:
 * - _state {object} : Internal state management (child PanelGroups, width, parent).
 * - element {HTMLElement} : The main DOM element (<div class="column">).
 * - dropZoneType {string} : The identifier for the DragDropService.
 * - _id {string} : Unique ID for this instance.
 * - _namespace {string} : Unique namespace for appBus listeners.
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
 * - Manages its own horizontal resize handle via ResizeController.
 * - Resize logic respects the minWidth of its child PanelGroups.
 *
 * Dependencies:
 * - components/Panel/PanelGroup.js
 * - utils/EventBus.js
 * - utils/ThrottleRAF.js
 * - utils/generateId.js
 * - utils/ResizeController.js
 * - constants/DNDTypes.js
 * - ../../constants/EventTypes.js
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
     * MinWidth setter with validation.
     *
     * @param {number} width
     * @returns {void}
     */
    setMinWidth(width) {
        const sanitizedWidth = Number(width);
        if (isNaN(sanitizedWidth) || sanitizedWidth < 0) {
            console.warn(`Column: Invalid minWidth "${width}". Must be a non-negative number.`);
            this._minWidth = 0;
            return;
        }
        this._minWidth = sanitizedWidth;
    }

    /**
     * MinWidth getter.
     *
     * @returns {number}
     */
    getMinWidth() {
        return this._minWidth;
    }

    /**
     * ThrottledUpdate setter.
     *
     * @param {Function} throttledFunction
     * @returns {void}
     */
    setThrottledUpdate(throttledFunction) {
        this._throttledUpdate = throttledFunction;
    }

    /**
     * ThrottledUpdate getter.
     *
     * @returns {Function | null}
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
     * @returns {number} The calculated effective minWidth.
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

        [...me._state.panelGroups].forEach(panel => panel.destroy());
    }

    /**
     * Adds the horizontal resize bar to the column.
     * Uses ResizeController to manage drag logic.
     *
     * @param {boolean} isLast - Indicates if this is the last column in the row.
     * @returns {void}
     */
    addResizeBars(isLast) {
        const me = this;
        me.element.querySelectorAll('.column__resize-handle').forEach(button => button.remove());
        me.element.classList.remove('column--resize-right');

        if (isLast) {
            return;
        }

        me.element.classList.add('column--resize-right');
        const bar = document.createElement('div');
        bar.classList.add('column__resize-handle');
        bar.style.touchAction = 'none'; // Critical for Pointer Events
        me.element.appendChild(bar);

        let startWidth = 0;
        let effectiveMinWidth = 0;

        const controller = new ResizeController(me.element, 'horizontal', {
            onStart: () => {
                startWidth = me.element.offsetWidth;
                effectiveMinWidth = me.getEffectiveMinWidth();
            },
            onUpdate: delta => {
                me._state.width = Math.max(effectiveMinWidth, startWidth + delta);
                if (me.getThrottledUpdate()) {
                    me.getThrottledUpdate()();
                }
            },
            onEnd: () => {
                if (me._state.container) {
                    me._state.container.requestLayoutUpdate();
                }
            }
        });

        bar.addEventListener('pointerdown', event => {
            // Check logic to prevent resizing if not allowed
            const container = me._state.container;
            if (!container) return;

            const columns = container.getColumns();
            const index = columns.indexOf(me);
            if (columns.length === 1 || index === columns.length - 1) {
                return;
            }

            controller.start(event);
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
        } else if (me._state.width !== null) {
            me.element.style.flex = `0 0 ${me._state.width}px`;
        }
        me.requestLayoutUpdate();
    }

    /**
     * Adds multiple PanelGroups at once (used for state restoration).
     *
     * @param {Array<PanelGroup>} panelGroups
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
     * @param {PanelGroup} panelGroup
     * @param {number|null} [index=null]
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
     * @returns {Array<PanelGroup>}
     */
    getPanelGroupsCollapsed() {
        return this._state.panelGroups.filter(p => p._state.collapsed);
    }

    /**
     * Gets all uncollapsed PanelGroups.
     *
     * @returns {Array<PanelGroup>}
     */
    getPanelGroupsUncollapsed() {
        return this._state.panelGroups.filter(p => !p._state.collapsed);
    }

    /**
     * PanelGroups getter.
     *
     * @returns {Array<PanelGroup>}
     */
    getPanelGroups() {
        return this._state.panelGroups;
    }

    /**
     * Removes a PanelGroup from the column.
     *
     * @param {PanelGroup} panelGroup
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
     * @param {PanelGroup} panelGroup
     * @returns {number} The index, or -1 if not found.
     */
    getPanelGroupIndex(panelGroup) {
        return this._state.panelGroups.findIndex(p => p === panelGroup);
    }

    /**
     * Finds the state index of a PanelGroup based on its DOM element.
     *
     * @param {HTMLElement} element
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
     * @returns {number}
     */
    getTotalPanelGroups() {
        return this._state.panelGroups.length;
    }

    /**
     * Serializes the Column state (and its child PanelGroups) to JSON.
     *
     * @returns {object}
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
