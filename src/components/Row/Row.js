import { Column } from '../Column/Column.js';
import { appBus } from '../../utils/EventBus.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';
import { generateId } from '../../utils/generateId.js';
import { ResizeHandleManager } from '../../utils/ResizeHandleManager.js';
import { DropZoneType } from '../../constants/DNDTypes.js';
import { EventTypes } from '../../constants/EventTypes.js';

/**
 * Description:
 * Manages a single horizontal Row, which contains and organizes Columns.
 * It acts as a 'drop zone' (type 'row') to detect drops in the horizontal
 * gaps *between* columns. It also manages its own vertical (height) resizing
 * and collapse state using the unified ResizeHandleManager.
 *
 * Properties summary:
 * - element {HTMLElement} : The main DOM element (<div class="row">).
 * - columns {Array<Column>} : List of child Columns.
 * - parentContainer {Container} : The parent Container instance.
 * - height {number|null} : The height of the row.
 * - collapsed {boolean} : Whether the row is collapsed.
 * - collapsible {boolean} : Whether the row can be collapsed.
 * - minHeight {number} : Minimum height constraint.
 * - collapseBtn {HTMLElement|null} : The button element to toggle collapse state.
 * - _id {string} : Unique ID for this instance.
 * - _namespace {string} : Unique namespace for appBus listeners.
 * - _minHeight {number} : Minimum height in pixels for vertical resizing.
 * - _throttledUpdate {Function|null} : The throttled function for height updates.
 * - _resizeHandleManager {ResizeHandleManager|null} : Manages the vertical resize handles.
 *
 * Typical usage:
 * // In Container.js
 * const row = new Row(this, height);
 * this.element.appendChild(row.element);
 *
 * Events:
 * - Listens to: EventTypes.COLUMN_EMPTY (to clean up empty columns)
 * - Emits: EventTypes.LAYOUT_COLUMNS_CHANGED (to notify LayoutService)
 * - Emits: EventTypes.ROW_EMPTY (to notify Container when this row is empty)
 *
 * Business rules implemented:
 * - Renders 'Column' children horizontally.
 * - Registers as a 'row' type drop zone.
 * - Automatically removes empty columns via 'onColumnEmpty'.
 * - Manages vertical resizing via ResizeHandleManager.
 * - Supports collapsing, which hides all child columns and reduces height.
 *
 * Dependencies:
 * - {import('../Column/Column.js').Column}
 * - {import('../../utils/EventBus.js').appBus}
 * - {import('../../utils/ThrottleRAF.js').throttleRAF}
 * - {import('../../utils/generateId.js').generateId}
 * - {import('../../utils/ResizeHandleManager.js').ResizeHandleManager}
 * - {import('../../constants/DNDTypes.js').DropZoneType}
 * - {import('../../constants/EventTypes.js').EventTypes}
 */
export class Row {
    /**
     * List of child Column components.
     *
     * @type {Array<import('../Column/Column.js').Column>}
     * @private
     */
    _columns = [];

    /**
     * The parent Container instance.
     *
     * @type {import('../Container/Container.js').Container | null}
     * @private
     */
    _parentContainer = null;

    /**
     * The height of the row in pixels, or null if flexible.
     *
     * @type {number | null}
     * @private
     */
    _height = null;

    /**
     * Whether the row is currently collapsed.
     *
     * @type {boolean}
     * @private
     */
    _collapsed = false;

    /**
     * Whether the row allows collapsing.
     *
     * @type {boolean}
     * @private
     */
    _collapsible = true;

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
     * Minimum height in pixels for vertical resizing.
     *
     * @type {number}
     * @private
     */
    _minHeight = 100;

    /**
     * Stores the throttled update function for resizing.
     *
     * @type {Function | null}
     * @private
     */
    _throttledUpdate = null;

    /**
     * Stores the bound reference for the 'onColumnEmpty' listener.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnColumnEmpty = null;

    /**
     * Stores the bound reference for the collapse button listener.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnToggleCollapseRequest = null;

    /**
     * Stores the resize handle manager instance.
     *
     * @type {ResizeHandleManager | null}
     * @private
     */
    _resizeHandleManager = null;

    /**
     * The button element to toggle collapse state.
     * Stored for access by LayoutService (to disable).
     *
     * @type {HTMLElement | null}
     * @public
     */
    collapseBtn = null;

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
     * Creates an instance of Row.
     *
     * @param {import('../Container/Container.js').Container} container - The parent Container instance.
     * @param {number|null} [height=null] - The initial height of the row.
     */
    constructor(container, height = null) {
        const me = this;
        me.element = document.createElement('div');
        me.element.classList.add('row');

        me.parentContainer = container;
        me.height = height;
        me.minHeight = me._minHeight; // Use default or trigger setter

        me.dropZoneType = DropZoneType.ROW;

        me.element.dataset.dropzone = me.dropZoneType;
        me.element.dropZoneInstance = me;

        me.setThrottledUpdate(
            throttleRAF(() => {
                me.updateHeight(false);
            })
        );

        me._boundOnColumnEmpty = me.onColumnEmpty.bind(me);
        me._boundOnToggleCollapseRequest = me.toggleCollapse.bind(me);

        me.clear();
        me.initEventListeners();
        me.updateHeight(false);
    }

    /**
     * Columns getter.
     *
     * @returns {Array<import('../Column/Column.js').Column>} The list of child columns.
     */
    get columns() {
        return this._columns;
    }

    /**
     * ParentContainer getter.
     *
     * @returns {import('../Container/Container.js').Container | null} The parent container.
     */
    get parentContainer() {
        return this._parentContainer;
    }

    /**
     * ParentContainer setter.
     * Validates that the value looks like a Container.
     *
     * @param {import('../Container/Container.js').Container | null} value
     * @returns {void}
     */
    set parentContainer(value) {
        if (value !== null && typeof value !== 'object') {
            console.warn(`[Row] Invalid parentContainer assignment (${value}).`);
            return;
        }
        this._parentContainer = value;
    }

    /**
     * Height getter.
     *
     * @returns {number | null} The height in pixels or null.
     */
    get height() {
        return this._height;
    }

    /**
     * Height setter.
     * Validates that the value is a positive number or null.
     *
     * @param {number | null} value
     * @returns {void}
     */
    set height(value) {
        if (value !== null && (!Number.isFinite(value) || value < 0)) {
            console.warn(
                `[Row] Invalid height assignment (${value}). Must be positive number or null.`
            );
            return;
        }
        this._height = value;
    }

    /**
     * Collapsed getter.
     *
     * @returns {boolean}
     */
    get collapsed() {
        return this._collapsed;
    }

    /**
     * Collapsed setter.
     * Manages UI state: adds/removes classes, hides/shows columns, updates button, updates height.
     *
     * @param {boolean} value
     * @returns {void}
     */
    set collapsed(value) {
        const me = this;
        if (typeof value !== 'boolean') {
            console.warn(`[Row] Invalid collapsed assignment (${value}). Must be boolean.`);
            return;
        }
        me._collapsed = value;

        if (value) {
            me.element.classList.add('row--collapsed');
            me._columns.forEach(column => (column.element.style.display = 'none'));
            if (me.collapseBtn) {
                me.collapseBtn.classList.add('row__collapse-btn--collapsed');
            }
        } else {
            me.element.classList.remove('row--collapsed');
            me._columns.forEach(column => (column.element.style.display = ''));
            if (me.collapseBtn) {
                me.collapseBtn.classList.remove('row__collapse-btn--collapsed');
            }
        }
        me.updateHeight(false);
    }

    /**
     * Collapsible getter.
     *
     * @returns {boolean}
     */
    get collapsible() {
        return this._collapsible;
    }

    /**
     * Collapsible setter.
     * Updates the internal state and refreshes the collapse button UI.
     *
     * @param {boolean} value
     * @returns {void}
     */
    set collapsible(value) {
        const me = this;
        if (typeof value !== 'boolean') {
            console.warn(`[Row] Invalid collapsible assignment (${value}). Must be boolean.`);
            return;
        }
        me._collapsible = value;
        me._setupCollapseButton(); // Re-render button if state changes
    }

    /**
     * MinHeight getter.
     *
     * @returns {number}
     */
    get minHeight() {
        return this._minHeight;
    }

    /**
     * MinHeight setter.
     *
     * @param {number} value
     * @returns {void}
     */
    set minHeight(value) {
        const num = Number(value);
        if (!Number.isFinite(num) || num < 0) {
            console.warn('Row: Invalid minHeight value. Setting to 0.');
            this._minHeight = 0;
            return;
        }
        this._minHeight = num;
    }

    /**
     * Wrapper for minHeight setter (compatibility).
     *
     * @param {number} height
     * @returns {void}
     */
    setMinHeight(height) {
        this.minHeight = height;
    }

    /**
     * Wrapper for minHeight getter (compatibility).
     *
     * @returns {number}
     */
    getMinHeight() {
        return this.minHeight;
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
     * Wrapper for parentContainer setter (compatibility).
     *
     * @param {import('../Container/Container.js').Container} container
     * @returns {void}
     */
    setParentContainer(container) {
        this.parentContainer = container;
    }

    /**
     * Initializes appBus event listeners for this component.
     *
     * @returns {void}
     */
    initEventListeners() {
        appBus.on(EventTypes.COLUMN_EMPTY, this._boundOnColumnEmpty, {
            namespace: this._namespace
        });
    }

    /**
     * Notifies the LayoutService that the column layout has changed.
     *
     * @returns {void}
     */
    requestLayoutUpdate() {
        appBus.emit(EventTypes.LAYOUT_COLUMNS_CHANGED, this);
    }

    /**
     * Cleans up appBus listeners and destroys all child Column components.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        appBus.offByNamespace(me._namespace);
        me.getThrottledUpdate()?.cancel();

        if (me.collapseBtn) {
            me.collapseBtn.removeEventListener('click', me._boundOnToggleCollapseRequest);
        }

        me._resizeHandleManager?.destroy();

        [...me.columns].forEach(column => column.destroy());
    }

    /**
     * Event handler for when a child Column reports it is empty.
     *
     * @param {import('../Column/Column.js').Column} column - The Column instance that emitted the event.
     * @returns {void}
     */
    onColumnEmpty(column) {
        this.deleteColumn(column);

        if (this.getTotalColumns() === 0 && this.parentContainer) {
            appBus.emit(EventTypes.ROW_EMPTY, this);
        }
    }

    /**
     * Updates the horizontal resize bars for all child Columns.
     * This is called by LayoutService.
     *
     * @returns {void}
     */
    updateAllResizeBars() {
        const columns = this.columns;
        columns.forEach((column, index) => {
            column.addResizeBars(index === columns.length - 1);
        });
    }

    /**
     * Sets up the collapse button logic and DOM.
     *
     * @returns {void}
     * @private
     */
    _setupCollapseButton() {
        const me = this;
        me.element.querySelectorAll('.row__collapse-btn').forEach(button => button.remove());
        me.collapseBtn = null;

        if (me.collapsible) {
            me.collapseBtn = document.createElement('button');
            me.collapseBtn.type = 'button';
            me.collapseBtn.className = 'row__collapse-btn';
            me.collapseBtn.setAttribute('aria-label', 'Toggle Row Collapse');
            if (me.collapsed) {
                me.collapseBtn.classList.add('row__collapse-btn--collapsed');
            }
            me.collapseBtn.addEventListener('click', me._boundOnToggleCollapseRequest);
            me.element.appendChild(me.collapseBtn);
        }
    }

    /**
     * Adds the vertical resize handle to this Row using ResizeHandleManager.
     *
     * @param {boolean} isLast - True if this is the last Row in the Container.
     * @returns {void}
     */
    addResizeBars(isLast) {
        const me = this;
        me.element.querySelectorAll('.row__resize-handle').forEach(element => element.remove());
        me.element.classList.remove('row--resize-bottom');
        me._resizeHandleManager?.destroy();

        me._setupCollapseButton();

        if (isLast) {
            return;
        }

        me.element.classList.add('row--resize-bottom');

        me._resizeHandleManager = new ResizeHandleManager(me.element, {
            handles: ['s'],
            customClass: 'row__resize-handle',
            getConstraints: () => ({
                minimumHeight: me.getMinHeight(),
                maximumHeight: Infinity,
                minimumWidth: 0,
                maximumWidth: Infinity,
                containerRectangle: null
            }),
            onResize: ({ height }) => {
                me.height = height;
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
     * Toggles the collapse state and notifies LayoutService.
     *
     * @returns {void}
     */
    toggleCollapse() {
        const me = this;
        if (!me.collapsible) return;
        me.collapsed = !me.collapsed; // Triggers setter

        if (me.parentContainer) {
            me.parentContainer.requestLayoutUpdate();
        }
    }

    /**
     * Applies the correct visibility state based on the internal state.
     *
     * @returns {void}
     */
    updateCollapse() {
        this.collapsed = this._collapsed;
    }

    /**
     * Hides the content and applies collapsed styles.
     *
     * @returns {void}
     */
    collapse() {
        this.collapsed = true;
    }

    /**
     * Shows the content and removes collapsed styles.
     *
     * @returns {void}
     */
    unCollapse() {
        this.collapsed = false;
    }

    /**
     * Creates and inserts a new Column component into this Row.
     *
     * @param {number|null} [width=null] - The initial width of the column.
     * @param {number|null} [index=null] - The exact state array index to insert at.
     * @returns {import('../Column/Column.js').Column} The created Column instance.
     */
    createColumn(width = null, index = null) {
        const me = this;
        const column = new Column(me, width);

        if (index === null) {
            me._columns.push(column);
            const resizeHandle = me.element.querySelector('.row__resize-handle');
            if (resizeHandle) {
                me.element.insertBefore(column.element, resizeHandle);
            } else {
                me.element.appendChild(column.element);
            }
        } else {
            me._columns.splice(index, 0, column);

            const nextSiblingColumn = me._columns[index + 1];
            let nextDomNode = nextSiblingColumn ? nextSiblingColumn.element : null;

            if (!nextDomNode) {
                const resizeHandle = me.element.querySelector('.row__resize-handle');
                if (resizeHandle) {
                    nextDomNode = resizeHandle;
                }
            }

            if (nextDomNode) {
                me.element.insertBefore(column.element, nextDomNode);
            } else {
                me.element.appendChild(column.element);
            }
        }

        if (me.collapsed) {
            column.element.style.display = 'none';
        }

        column.setParentContainer(me);
        me.requestLayoutUpdate();
        return column;
    }

    /**
     * Deletes a child Column.
     *
     * @param {import('../Column/Column.js').Column} column - The Column instance to remove.
     * @returns {void}
     */
    deleteColumn(column) {
        const me = this;
        const index = me._columns.indexOf(column);
        if (index === -1) {
            return;
        }

        column.destroy();
        const columnElement = column.element;
        if (columnElement && me.element.contains(columnElement)) {
            me.element.removeChild(columnElement);
        }
        me._columns.splice(index, 1);
        me.requestLayoutUpdate();
    }

    /**
     * Returns all child Column instances.
     *
     * @returns {Array<import('../Column/Column.js').Column>} All child column instances.
     */
    getColumns() {
        return this.columns;
    }

    /**
     * Returns the total number of child Columns.
     *
     * @returns {number} The total number of columns.
     */
    getTotalColumns() {
        return this.columns.length;
    }

    /**
     * Returns the first child Column. If none exists, creates one.
     *
     * @returns {import('../Column/Column.js').Column} The first column instance.
     */
    getFirstColumn() {
        const columns = this.columns;
        return columns[0] || this.createColumn();
    }

    /**
     * Returns the last child Column. If none exists, creates one.
     *
     * @returns {import('../Column/Column.js').Column} The last column instance.
     */
    getLastColumn() {
        const columns = this.columns;
        return columns[columns.length - 1] || this.createColumn();
    }

    /**
     * Updates the CSS flex properties based on the row's state.
     *
     * @param {boolean} isLast - True if this is the last Row in the Container.
     * @returns {void}
     */
    updateHeight(isLast) {
        const me = this;
        me.element.style.minHeight = `${me.getMinHeight()}px`;

        if (me.collapsed) {
            me.element.style.flex = '0 0 auto';
            me.element.style.height = 'auto';
            me.element.classList.add('row--collapsed');
            me.element.style.minHeight = 'auto';
            return;
        }

        me.element.classList.remove('row--collapsed');

        if (isLast) {
            me.element.style.flex = '1 1 auto';
            me.height = null; // Reset internal height for fluid layout
        } else if (me.height !== null) {
            me.element.style.flex = `0 0 ${me.height}px`;
        } else {
            me.element.style.flex = '1 1 auto';
        }
    }

    /**
     * Clears the Row, destroying and removing all child Columns.
     *
     * @returns {void}
     */
    clear() {
        const me = this;
        [...me.columns].forEach(column => {
            me.deleteColumn(column);
        });

        me.element.innerHTML = '';
        me._columns = [];
        me.collapseBtn = null;
    }

    /**
     * Serializes the Row state (and its child Columns) to JSON.
     *
     * @returns {object} The serialized state object.
     */
    toJSON() {
        const me = this;
        return {
            height: me.height,
            collapsed: me.collapsed,
            collapsible: me.collapsible,
            columns: me.columns.map(column => column.toJSON())
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
        me.clear();

        if (data.height !== undefined) {
            me.height = data.height;
        }
        if (data.collapsible !== undefined) {
            me.collapsible = data.collapsible;
        }

        const columnsData = data.columns || [];

        columnsData.forEach(colData => {
            const column = me.createColumn();
            column.fromJSON(colData);
        });

        me.requestLayoutUpdate();
        me.updateHeight(false);

        // Apply collapsed state last to trigger UI update
        if (data.collapsed !== undefined) {
            me.collapsed = data.collapsed;
        }
    }
}
