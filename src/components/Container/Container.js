import { Row } from '../Row/Row.js';
import { appBus } from '../../utils/EventBus.js';
import { FloatingPanelManagerService } from '../../services/DND/FloatingPanelManagerService.js';
import { EventTypes } from '../../constants/EventTypes.js';
import { UIElement } from '../../core/UIElement.js';
import { VanillaContainerAdapter } from '../../renderers/vanilla/VanillaContainerAdapter.js';
import { generateId } from '../../utils/generateId.js';

/**
 * Description:
 * The main application container and root UI component.
 * It manages the vertical layout of all 'Row' components.
 * It also acts as a 'drop zone' (type 'container') to allow
 * panels to be dropped "between" rows, creating new rows.
 *
 * It extends UIElement to participate in the application lifecycle and delegates
 * DOM rendering to VanillaContainerAdapter.
 *
 * Properties summary:
 * - id {string} : Unique ID for this instance.
 * - rows {Array<Row>} : Public getter for the list of rows.
 * - dropZoneType {string} : The identifier for the DragDropService.
 *
 * Typical usage:
 * // In App.js
 * this.container = new Container();
 * this.container.mount(document.body);
 *
 * Events:
 * - Listens to: EventTypes.ROW_EMPTY
 * - Emits: EventTypes.LAYOUT_ROWS_CHANGED
 *
 * Business rules implemented:
 * - Renders 'Row' children vertically.
 * - Registers as a 'container' type drop zone.
 * - Listens for EventTypes.ROW_EMPTY and automatically removes any Row that
 * reports its last Column has been removed.
 * - Manages the vertical resize handles/collapse buttons for its child Rows.
 *
 * Dependencies:
 * - {import('../../core/UIElement.js').UIElement}
 * - {import('../../renderers/vanilla/VanillaContainerAdapter.js').VanillaContainerAdapter}
 * - {import('../Row/Row.js').Row}
 * - {import('../../utils/EventBus.js').appBus}
 * - {import('../../services/DND/FloatingPanelManagerService.js').FloatingPanelManagerService}
 */
export class Container extends UIElement {
    /**
     * Internal list of child Row components.
     *
     * @type {Array<import('../Row/Row.js').Row>}
     * @private
     */
    _rows = [];

    /**
     * Unique namespace for this component's appBus listeners.
     *
     * @type {string}
     * @private
     */
    _namespace = null;

    /**
     * Stores the bound reference for the 'onRowEmpty' listener.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnRowEmpty = null;

    /**
     * The identifier for the DragDropService.
     *
     * @type {string}
     * @public
     */
    dropZoneType = 'container';

    /**
     * Creates an instance of Container.
     *
     * @param {import('../../core/IRenderer.js').IRenderer} [renderer=null] - Optional renderer.
     */
    constructor(renderer = null) {
        super(generateId(), renderer || new VanillaContainerAdapter());
        const me = this;

        me._namespace = `app-container-${me.id}`;
        me._boundOnRowEmpty = me.onRowEmpty.bind(me);

        // Initialize DOM via UIElement lifecycle
        me.render();
        me.initEventListeners();
    }

    /**
     * Rows getter.
     *
     * @returns {Array<import('../Row/Row.js').Row>} The list of rows.
     */
    get rows() {
        return this._rows;
    }

    /**
     * Initializes appBus event listeners for this component.
     *
     * @returns {void}
     */
    initEventListeners() {
        const me = this;
        appBus.on(EventTypes.ROW_EMPTY, me._boundOnRowEmpty, { namespace: me._namespace });
    }

    /**
     * Implementation of the rendering logic.
     * Uses the adapter to create the container DOM structure.
     *
     * @returns {HTMLElement} The root container element.
     * @protected
     */
    _doRender() {
        const me = this;
        const element = me.renderer.createContainerElement(me.id);

        element.dataset.dropzone = me.dropZoneType;
        element.dropZoneInstance = me;

        return element;
    }

    /**
     * Implementation of the mounting logic.
     * Mounts all child rows.
     *
     * @param {HTMLElement} container - The parent DOM element.
     * @protected
     */
    _doMount(container) {
        const me = this;
        if (me.element) {
            if (me.element.parentNode !== container) {
                me.renderer.mount(container, me.element);
            }

            me._rows.forEach(row => {
                if (!row.element) row.render();
                if (row.element.parentNode !== me.element) {
                    me.renderer.mount(me.element, row.element);
                }
                row.mount(me.element);
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

        me._rows.forEach(row => row.unmount());

        if (me.element && me.element.parentNode) {
            me.renderer.unmount(me.element.parentNode, me.element);
        }
    }

    /**
     * Cleans up appBus listeners and destroys all child Row components.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        appBus.offByNamespace(me._namespace);

        [...me.rows].forEach(row => row.dispose());

        super.dispose();
    }

    /**
     * Notifies the LayoutService that the row layout has changed.
     *
     * @returns {void}
     */
    requestLayoutUpdate() {
        appBus.emit(EventTypes.LAYOUT_ROWS_CHANGED, this);
    }

    /**
     * Event handler for when a child Row reports it is empty.
     *
     * @param {import('../Row/Row.js').Row} row - The Row instance that emitted the event.
     * @returns {void}
     */
    onRowEmpty(row) {
        this.deleteRow(row);
    }

    /**
     * Updates the vertical resize bars for all child Rows.
     * The last Row is instructed not to show its bar.
     *
     * @returns {void}
     */
    updateAllResizeBars() {
        const rows = this.rows;
        rows.forEach((row, index) => {
            row.addResizeBars(index === rows.length - 1);
        });
    }

    /**
     * Forces all child Rows to recalculate their *column* resize handles.
     *
     * @private
     * @returns {void}
     */
    _updateAllColumnResizeBars() {
        this.rows.forEach(row => {
            if (typeof row.updateAllResizeBars === 'function') {
                row.updateAllResizeBars();
            }
        });
    }

    /**
     * Creates and inserts a new Row component into the container.
     *
     * @param {number|null} [height=null] - The initial height of the row.
     * @param {number|null} [index=null] - The exact state array index to insert at.
     * @returns {import('../Row/Row.js').Row} The created Row instance.
     */
    createRow(height = null, index = null) {
        const me = this;
        const row = new Row(me, height);

        if (index === null) {
            me._rows.push(row);
        } else {
            me._rows.splice(index, 0, row);
        }

        // Handle DOM insertion if container is rendered
        if (me.element) {
            if (!row.element) row.render();

            if (index === null) {
                // Append
                me.renderer.mount(me.element, row.element);
            } else {
                // Insert at specific index
                // Find the element that is currently at the target index (after splice it's index+1)
                // The array splice happened, so the element currently at `index + 1`
                // (or previously at `index`) is the reference.
                const nextRow = me._rows[index + 1];
                const referenceNode = nextRow ? nextRow.element : null;

                if (referenceNode) {
                    me.element.insertBefore(row.element, referenceNode);
                } else {
                    me.renderer.mount(me.element, row.element);
                }
            }

            // Trigger lifecycle
            row.mount(me.element);
        }

        me.requestLayoutUpdate();
        me.updateAllResizeBars();
        me._updateAllColumnResizeBars();

        return row;
    }

    /**
     * Deletes a child Row.
     *
     * @param {import('../Row/Row.js').Row} row - The Row instance to remove.
     * @returns {void}
     */
    deleteRow(row) {
        const me = this;
        const index = me._rows.indexOf(row);
        if (index === -1) return;

        row.unmount();
        row.dispose();

        me._rows.splice(index, 1);

        me.requestLayoutUpdate();
        me.updateAllResizeBars();
        me._updateAllColumnResizeBars();
    }

    /**
     * Returns all child Row instances.
     * Kept for API compatibility.
     *
     * @returns {Array<import('../Row/Row.js').Row>} All child row instances.
     */
    getRows() {
        return this.rows;
    }

    /**
     * Returns the total number of child Rows.
     *
     * @returns {number} The total number of rows.
     */
    getTotalRows() {
        return this.rows.length;
    }

    /**
     * Returns the first child Row. If none exists, creates one.
     *
     * @returns {import('../Row/Row.js').Row} The first row instance.
     */
    getFirstRow() {
        const rows = this.rows;
        return rows[0] || this.createRow();
    }

    /**
     * Clears the container, destroying and removing all child Rows.
     *
     * @returns {void}
     */
    clear() {
        const me = this;
        [...me.rows].forEach(row => {
            me.deleteRow(row);
        });
        me._rows = [];
    }

    /**
     * Serializes the Container state (and its child Rows) to JSON.
     *
     * @returns {object} The serialized layout object.
     */
    toJSON() {
        const me = this;
        const fpms = FloatingPanelManagerService.getInstance();

        const layout = {
            rows: me.rows.map(row => row.toJSON()),
            floatingPanels: fpms.toJSON()
        };
        return layout;
    }

    /**
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

        if (me.rows.length === 0) {
            me.createRow();
        }

        me.requestLayoutUpdate();
        me.updateAllResizeBars();
        me._updateAllColumnResizeBars();
    }
}
