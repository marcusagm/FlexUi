import { Column } from '../Column/Column.js';
import { appBus } from '../../utils/EventBus.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';

/**
 * Description:
 * Manages a single horizontal Row, which contains and organizes Columns.
 * It acts as a 'drop zone' (type 'row') to detect drops in the horizontal
 * gaps *between* columns. It also manages its own vertical (height) resizing.
 *
 * Properties summary:
 * - _state {object} : Internal state (child Columns, parent Container, height).
 * - element {HTMLElement} : The main DOM element (<div class="row">).
 * - dropZoneType {string} : The identifier for the DragDropService.
 * - _id {string} : Unique ID for this instance.
 * - _namespace {string} : Unique namespace for appBus listeners.
 *
 * Typical usage:
 * // In Container.js
 * const row = new Row(this, height);
 * this.element.appendChild(row.element);
 *
 * Events:
 * - Listens to: 'column:empty' (to clean up empty columns)
 * - Emits: 'layout:columns-changed' (to notify LayoutService)
 * - Emits: 'row:empty' (to notify Container when this row is empty)
 *
 * Business rules implemented:
 * - Renders 'Column' children horizontally.
 * - Registers as a 'row' type drop zone.
 * - Listens for 'column:empty' and removes the child Column.
 * - If it becomes empty (last Column removed), emits 'row:empty'.
 * - Manages its own vertical resize handle (via 'addResizeBars').
 *
 * Dependencies:
 * - components/Column/Column.js
 * - utils/EventBus.js
 * - utils/ThrottleRAF.js
 */
export class Row {
    /**
     * @type {{children: Array<Column>, parentContainer: import('../Container/Container.js').Container | null, height: number | null}}
     * @private
     */
    _state = {
        children: [],
        parentContainer: null,
        height: null
    };

    /**
     * Unique ID for this instance, used for namespacing events.
     * @type {string}
     * @private
     */
    _id = 'row_' + (Math.random().toString(36).substring(2, 9) + Date.now());

    /**
     * Unique namespace for appBus listeners.
     * @type {string}
     * @private
     */
    _namespace = this._id;

    /**
     * Minimum height in pixels for vertical resizing.
     * @type {number}
     * @private
     */
    _minHeight = 100;

    /**
     * Stores the throttled update function for resizing.
     * @type {Function | null}
     * @private
     */
    _throttledUpdate = null;

    /**
     * Stores the bound reference for the 'onColumnEmpty' listener.
     * @type {Function | null}
     * @private
     */
    _boundOnColumnEmpty = null;

    /**
     * @param {import('../Container/Container.js').Container} container - The parent Container instance.
     * @param {number|null} [height=null] - The initial height of the row.
     */
    constructor(container, height = null) {
        const me = this;
        me.element = document.createElement('div');
        me.element.classList.add('row');
        me._state.parentContainer = container;
        me._state.height = height;
        me.setMinHeight(me._minHeight);

        me.dropZoneType = 'row';

        me.element.dataset.dropzone = me.dropZoneType;
        me.element.dropZoneInstance = me;

        me.setThrottledUpdate(
            throttleRAF(() => {
                me.updateHeight(false);
            })
        );

        me._boundOnColumnEmpty = me.onColumnEmpty.bind(me);

        me.clear();
        me.initEventListeners();
        me.updateHeight(false);
    }

    /**
     * <MinHeight> setter with validation.
     * @param {number} height - The minimum height in pixels.
     * @returns {void}
     */
    setMinHeight(height) {
        const sanitizedHeight = Number(height);
        if (isNaN(sanitizedHeight) || sanitizedHeight < 0) {
            this._minHeight = 0;
            return;
        }
        this._minHeight = sanitizedHeight;
    }

    /**
     * <MinHeight> getter.
     * @returns {number} The minimum height in pixels.
     */
    getMinHeight() {
        return this._minHeight;
    }

    /**
     * <ThrottledUpdate> setter.
     * @param {Function} throttledFunction
     * @returns {void}
     */
    setThrottledUpdate(throttledFunction) {
        this._throttledUpdate = throttledFunction;
    }

    /**
     * <ThrottledUpdate> getter.
     * @returns {Function | null}
     */
    getThrottledUpdate() {
        return this._throttledUpdate;
    }

    /**
     * <ParentContainer> setter.
     * @param {import('../Container/Container.js').Container} container - The parent container instance.
     * @returns {void}
     */
    setParentContainer(container) {
        this._state.parentContainer = container;
    }

    /**
     * Initializes appBus event listeners for this component.
     * @returns {void}
     */
    initEventListeners() {
        appBus.on('column:empty', this._boundOnColumnEmpty, { namespace: this._namespace });
    }

    /**
     * Notifies the LayoutService that the column layout has changed.
     * @returns {void}
     */
    requestLayoutUpdate() {
        appBus.emit('layout:columns-changed', this);
    }

    /**
     * Cleans up appBus listeners and destroys all child Column components.
     * @returns {void}
     */
    destroy() {
        const me = this;
        appBus.offByNamespace(me._namespace);
        me.getThrottledUpdate()?.cancel();

        [...me.getColumns()].forEach(column => column.destroy());
    }

    /**
     * Event handler for when a child Column reports it is empty.
     * @param {Column} column - The Column instance that emitted the event.
     * @returns {void}
     */
    onColumnEmpty(column) {
        this.deleteColumn(column);

        if (this.getTotalColumns() === 0 && this._state.parentContainer) {
            appBus.emit('row:empty', this); // Notifies the Container (parent)
        }
    }

    /**
     * Updates the horizontal resize bars for all child Columns.
     * This is called by LayoutService.
     * @returns {void}
     */
    updateAllResizeBars() {
        const columns = this.getColumns();
        columns.forEach((column, idx) => {
            column.addResizeBars(idx === columns.length - 1);
        });
    }

    /**
     * Adds the vertical resize handle to this Row.
     * @param {boolean} isLast - True if this is the last Row in the Container.
     * @returns {void}
     */
    addResizeBars(isLast) {
        this.element.querySelectorAll('.row__resize-handle').forEach(b => b.remove());
        this.element.classList.remove('row--resize-bottom');

        if (isLast) return;

        this.element.classList.add('row--resize-bottom');
        const bar = document.createElement('div');
        bar.classList.add('row__resize-handle');
        this.element.appendChild(bar);
        bar.addEventListener('mousedown', e => this.startResize(e));
    }

    /**
     * Handles the start of a vertical resize drag for this Row.
     * @param {MouseEvent} e - The mousedown event.
     * @returns {void}
     */
    startResize(e) {
        const me = this;
        const container = me._state.parentContainer;
        if (!container) return;

        const rows = container.getRows();
        const idx = rows.indexOf(me);
        if (rows.length === 1 || idx === rows.length - 1) return;

        e.preventDefault();
        const startY = e.clientY;
        const startH = me.element.offsetHeight;

        const onMove = ev => {
            const delta = ev.clientY - startY;
            me._state.height = Math.max(me.getMinHeight(), startH + delta);
            me.getThrottledUpdate()(); // Updates style O(1)
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            me.getThrottledUpdate()?.cancel();
            // Delegate layout sync to Container -> LayoutService
            container.requestLayoutUpdate();
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    /**
     * Creates and inserts a new Column component into this Row.
     * @param {number|null} [width=null] - The initial width of the column.
     * @param {number|null} [index=null] - The exact state array index to insert at.
     * @returns {Column} The created Column instance.
     */
    createColumn(width = null, index = null) {
        const me = this;
        const column = new Column(me, width);

        if (index === null) {
            me._state.children.push(column);
            const resizeHandle = me.element.querySelector('.row__resize-handle');
            me.element.insertBefore(column.element, resizeHandle);
        } else {
            me._state.children.splice(index, 0, column);
            const nextSiblingColumn = me._state.children[index + 1];
            let nextSiblingElement = nextSiblingColumn ? nextSiblingColumn.element : null;

            if (!nextSiblingElement) {
                const resizeHandle = me.element.querySelector('.row__resize-handle');
                if (resizeHandle) {
                    nextSiblingElement = resizeHandle;
                }
            }
            me.element.insertBefore(column.element, nextSiblingElement);
        }

        column.setParentContainer(me);
        me.requestLayoutUpdate(); // Notifies LayoutService
        return column;
    }

    /**
     * Deletes a child Column.
     * @param {Column} column - The Column instance to remove.
     * @returns {void}
     */
    deleteColumn(column) {
        const me = this;
        const index = me._state.children.indexOf(column);
        if (index === -1) return;
        if (!(me._state.children[index] instanceof Column)) return;

        column.destroy();
        const columnEl = me._state.children[index].element;
        if (columnEl && me.element.contains(columnEl)) {
            me.element.removeChild(columnEl);
        }
        me._state.children.splice(index, 1);
        me.requestLayoutUpdate(); // Notifies LayoutService
    }

    /**
     * Returns all child Column instances.
     * @returns {Array<Column>}
     */
    getColumns() {
        return this._state.children;
    }

    /**
     * Returns the total number of child Columns.
     * @returns {number}
     */
    getTotalColumns() {
        return this.getColumns().length;
    }

    /**
     * Returns the first child Column. If none exists, creates one.
     * @returns {Column}
     */
    getFirstColumn() {
        const columns = this.getColumns();
        return columns[0] || this.createColumn();
    }

    /**
     * Returns the last child Column. If none exists, creates one.
     * @returns {Column}
     */
    getLastColumn() {
        const columns = this.getColumns();
        return columns[columns.length - 1] || this.createColumn();
    }

    /**
     * Updates the CSS flex properties based on the row's state.
     * @param {boolean} isLast - True if this is the last Row in the Container.
     * @returns {void}
     */
    updateHeight(isLast) {
        const me = this;
        if (isLast) {
            me.element.style.flex = '1 1 auto';
            me._state.height = null;
        } else if (me._state.height !== null) {
            me.element.style.flex = `0 0 ${me._state.height}px`;
        } else {
            me.element.style.flex = '1 1 auto';
        }
    }

    /**
     * Clears the Row, destroying and removing all child Columns.
     * @returns {void}
     */
    clear() {
        const me = this;
        [...me.getColumns()].forEach(column => {
            me.deleteColumn(column);
        });

        me.element.innerHTML = '';
        me._state.children = [];
    }

    /**
     * Serializes the Row state (and its child Columns) to JSON.
     * @returns {object}
     */
    toJSON() {
        return {
            height: this._state.height,
            columns: this.getColumns().map(column => column.toJSON())
        };
    }

    /**
     * Deserializes state from JSON data.
     * @param {object} data - The state object.
     * @returns {void}
     */
    fromJSON(data) {
        const me = this;
        me.clear();

        if (data.height !== undefined) {
            me._state.height = data.height;
        }

        const columnsData = data.columns || [];

        columnsData.forEach(colData => {
            const column = me.createColumn();
            column.fromJSON(colData);
        });

        me.requestLayoutUpdate();
        me.updateHeight(false);
    }
}
