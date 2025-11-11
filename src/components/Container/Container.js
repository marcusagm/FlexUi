import { Row } from '../Row/Row.js';
import { appBus } from '../../utils/EventBus.js';

/**
 * Description:
 * The main application container and root UI component.
 * It manages the vertical layout of all 'Row' components.
 * It also acts as a 'drop zone' (type 'container') to allow
 * panels to be dropped "between" rows, creating new rows.
 *
 * Properties summary:
 * - _state {object} : Manages child Row instances.
 * - element {HTMLElement} : The main DOM element (<div class="container">).
 * - dropZoneType {string} : The identifier for the DragDropService.
 *
 * Typical usage:
 * // In App.js
 * this.container = new Container();
 * document.body.append(this.container.element);
 *
 * Events:
 * - Listens to: 'row:empty' (to clean up empty rows)
 * - Emits: 'layout:rows-changed' (to notify LayoutService)
 *
 * Business rules implemented:
 * - Renders 'Row' children vertically.
 * - Registers as a 'container' type drop zone.
 * - Listens for 'row:empty' and automatically removes any Row that
 * reports its last Column has been removed.
 * - Manages the vertical resize handles for its child Rows (the last
 * Row never has a handle).
 * - Forces recalculation of *column* resize handles on all child Rows
 * whenever a row is added or deleted.
 *
 * Dependencies:
 * - components/Row/Row.js
 * - utils/EventBus.js
 */
export class Container {
    /**
     * Internal state holding child Row components.
     * @type {{children: Array<Row>}}
     * @private
     */
    _state = {
        children: []
    };

    /**
     * Unique namespace for this component's appBus listeners.
     * @type {string}
     * @private
     */
    _namespace = 'app-container';

    /**
     * Stores the bound reference for the 'onRowEmpty' listener.
     * @type {Function | null}
     * @private
     */
    _boundOnRowEmpty = null;

    constructor() {
        const me = this;
        me.element = document.createElement('div');
        me.element.classList.add('container');

        me.dropZoneType = 'container';

        me.element.dataset.dropzone = me.dropZoneType;
        me.element.dropZoneInstance = me;

        me._boundOnRowEmpty = me.onRowEmpty.bind(me);

        me.clear();
        me.initEventListeners();
    }

    /**
     * Initializes appBus event listeners for this component.
     * @returns {void}
     */
    initEventListeners() {
        const me = this;
        appBus.on('row:empty', me._boundOnRowEmpty, { namespace: me._namespace });
    }

    /**
     * Cleans up appBus listeners and destroys all child Row components.
     * @returns {void}
     */
    destroy() {
        const me = this;
        appBus.offByNamespace(me._namespace);

        [...me.getRows()].forEach(row => row.destroy());
        me.element.remove();
    }

    /**
     * Notifies the LayoutService that the row layout has changed.
     * @returns {void}
     */
    requestLayoutUpdate() {
        appBus.emit('layout:rows-changed', this);
    }

    /**
     * Event handler for when a child Row reports it is empty.
     * @param {Row} row - The Row instance that emitted the event.
     * @returns {void}
     */
    onRowEmpty(row) {
        this.deleteRow(row);
    }

    /**
     * Updates the vertical resize bars for all child Rows.
     * The last Row is instructed not to show its bar.
     * @returns {void}
     */
    updateAllResizeBars() {
        const rows = this.getRows();
        rows.forEach((row, idx) => {
            row.addResizeBars(idx === rows.length - 1);
        });
    }

    /**
     * Forces all child Rows to recalculate their *column* resize handles.
     * (Required to fix DND bugs where the "last" row changes).
     * @private
     * @returns {void}
     */
    _updateAllColumnResizeBars() {
        this.getRows().forEach(row => {
            if (typeof row.updateAllResizeBars === 'function') {
                row.updateAllResizeBars();
            }
        });
    }

    /**
     * Creates and inserts a new Row component into the container.
     * @param {number|null} [height=null] - The initial height of the row.
     * @param {number|null} [index=null] - The exact state array index to insert at.
     * @returns {Row} The created Row instance.
     */
    createRow(height = null, index = null) {
        const me = this;
        const row = new Row(me, height);

        if (index === null) {
            me.element.appendChild(row.element);
            me._state.children.push(row);
        } else {
            const targetElement = me.element.children[index] || null;
            if (targetElement) {
                me.element.insertBefore(row.element, targetElement);
            } else {
                me.element.appendChild(row.element);
            }
            me._state.children.splice(index, 0, row);
        }

        me.requestLayoutUpdate();
        me.updateAllResizeBars();
        me._updateAllColumnResizeBars();

        return row;
    }

    /**
     * Deletes a child Row.
     * @param {Row} row - The Row instance to remove.
     * @returns {void}
     */
    deleteRow(row) {
        const me = this;
        const index = me._state.children.indexOf(row);
        if (index === -1) return;

        const rowEl = row.element;
        row.destroy();

        if (rowEl && me.element.contains(rowEl)) {
            me.element.removeChild(rowEl);
        }

        me._state.children.splice(index, 1);

        me.requestLayoutUpdate();
        me.updateAllResizeBars();
        me._updateAllColumnResizeBars();
    }

    /**
     * Returns all child Row instances.
     * @returns {Array<Row>}
     */
    getRows() {
        return this._state.children;
    }

    /**
     * Returns the total number of child Rows.
     * @returns {number}
     */
    getTotalRows() {
        return this.getRows().length;
    }

    /**
     * Returns the first child Row. If none exists, creates one.
     * @returns {Row}
     */
    getFirstRow() {
        const rows = this.getRows();
        return rows[0] || this.createRow();
    }

    /**
     * Clears the container, destroying and removing all child Rows.
     * @returns {void}
     */
    clear() {
        const me = this;
        [...me.getRows()].forEach(row => {
            me.deleteRow(row);
        });

        me.element.innerHTML = '';
        me._state.children = [];
    }

    /**
     * Serializes the Container state (and its child Rows) to JSON.
     * @returns {object}
     */
    toJSON() {
        return {
            rows: this.getRows().map(row => row.toJSON())
        };
    }

    /**
     * Deserializes state from JSON data.
     * @param {object} data - The state object (from default.json or localStorage).
     * @returns {void}
     */
    fromJSON(data) {
        const me = this;
        me.clear();
        const rowsData = data.rows || [];

        if (rowsData.length === 0 && data.columns) {
            // Fallback for legacy layouts (without 'rows')
            console.warn("Container: Loading legacy layout (no 'rows'). Wrapping in a Row.");
            const row = me.createRow();
            row.fromJSON(data);
        } else {
            // Load rows
            rowsData.forEach(rowData => {
                const row = me.createRow(rowData.height);
                row.fromJSON(rowData);
            });
        }

        if (me.getRows().length === 0) {
            me.createRow();
        }

        me.requestLayoutUpdate();
        me.updateAllResizeBars();
        me._updateAllColumnResizeBars();
    }
}
