import { Row } from '../Row/Row.js';
import { appBus } from '../../utils/EventBus.js';
import { FloatingPanelManagerService } from '../../services/DND/FloatingPanelManagerService.js';
import { EventTypes } from '../../constants/EventTypes.js';

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
 * - Listens to: EventTypes.ROW_EMPTY (to clean up empty rows)
 * - Emits: EventTypes.LAYOUT_ROWS_CHANGED (to notify LayoutService)
 *
 * Business rules implemented:
 * - Renders 'Row' children vertically.
 * - Registers as a 'container' type drop zone.
 * - Listens for EventTypes.ROW_EMPTY and automatically removes any Row that
 * reports its last Column has been removed.
 * - Manages the vertical resize handles/collapse buttons for its child Rows.
 * - Forces recalculation of *column* resize handles on all child Rows
 * whenever a row is added or deleted.
 *
 * Dependencies:
 * - components/Row/Row.js
 * - utils/EventBus.js
 * - services/DND/FloatingPanelManagerService.js
 * - ../../constants/EventTypes.js
 */
export class Container {
    /**
     * Internal state holding child Row components.
     *
     * @type {{children: Array<Row>}}
     * @private
     */
    _state = {
        children: []
    };

    /**
     * Unique namespace for this component's appBus listeners.
     *
     * @type {string}
     * @private
     */
    _namespace = 'app-container';

    /**
     * Stores the bound reference for the 'onRowEmpty' listener.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnRowEmpty = null;

    /**
     * Description:
     * Creates an instance of Container.
     */
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
     * Description:
     * Initializes appBus event listeners for this component.
     *
     * @returns {void}
     */
    initEventListeners() {
        const me = this;
        appBus.on(EventTypes.ROW_EMPTY, me._boundOnRowEmpty, { namespace: me._namespace });
    }

    /**
     * Description:
     * Cleans up appBus listeners and destroys all child Row components.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        appBus.offByNamespace(me._namespace);

        [...me.getRows()].forEach(row => row.destroy());
        me.element.remove();
    }

    /**
     * Description:
     * Notifies the LayoutService that the row layout has changed.
     *
     * @returns {void}
     */
    requestLayoutUpdate() {
        appBus.emit(EventTypes.LAYOUT_ROWS_CHANGED, this);
    }

    /**
     * Description:
     * Event handler for when a child Row reports it is empty.
     *
     * @param {Row} row - The Row instance that emitted the event.
     * @returns {void}
     */
    onRowEmpty(row) {
        this.deleteRow(row);
    }

    /**
     * Description:
     * Updates the vertical resize bars for all child Rows.
     * The last Row is instructed not to show its bar.
     *
     * @returns {void}
     */
    updateAllResizeBars() {
        const rows = this.getRows();
        rows.forEach((row, index) => {
            row.addResizeBars(index === rows.length - 1);
        });
    }

    /**
     * Description:
     * Forces all child Rows to recalculate their *column* resize handles.
     * (Required to fix DND bugs where the "last" row changes).
     *
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
     * Description:
     * Creates and inserts a new Row component into the container.
     *
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
     * Description:
     * Deletes a child Row.
     *
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
     * Description:
     * Returns all child Row instances.
     *
     * @returns {Array<Row>} All child row instances.
     */
    getRows() {
        return this._state.children;
    }

    /**
     * Description:
     * Returns the total number of child Rows.
     *
     * @returns {number} The total number of rows.
     */
    getTotalRows() {
        return this.getRows().length;
    }

    /**
     * Description:
     * Returns the first child Row. If none exists, creates one.
     *
     * @returns {Row} The first row instance.
     */
    getFirstRow() {
        const rows = this.getRows();
        return rows[0] || this.createRow();
    }

    /**
     * Description:
     * Clears the container, destroying and removing all child Rows.
     *
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
     * Description:
     * Serializes the Container state (and its child Rows) to JSON.
     *
     * @returns {object} The serialized layout object.
     */
    toJSON() {
        const me = this;
        const fpms = FloatingPanelManagerService.getInstance();

        const layout = {
            rows: me.getRows().map(row => row.toJSON()),
            floatingPanels: fpms.toJSON()
        };
        return layout;
    }

    /**
     * Description:
     * Deserializes state from JSON data.
     *
     * @param {object} data - The state object (from default.json or localStorage).
     * @returns {void}
     */
    fromJSON(data) {
        const me = this;
        me.clear();
        const rowsData = data.rows || [];

        if (rowsData.length === 0 && data.columns) {
            console.warn("Container: Loading legacy layout (no 'rows'). Wrapping in a Row.");
            const row = me.createRow();
            row.fromJSON(data);
        } else {
            rowsData.forEach(rowData => {
                const row = me.createRow(rowData.height);
                row.fromJSON(rowData);
            });
        }

        if (data.floatingPanels && Array.isArray(data.floatingPanels)) {
            const fpms = FloatingPanelManagerService.getInstance();
            fpms.fromJSON(data.floatingPanels);
        }

        if (me.getRows().length === 0) {
            me.createRow();
        }

        me.requestLayoutUpdate();
        me.updateAllResizeBars();
        me._updateAllColumnResizeBars();
    }
}
