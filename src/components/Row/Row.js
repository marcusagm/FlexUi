import { Column } from '../Column/Column.js';
import { appBus } from '../../utils/EventBus.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';
import { generateId } from '../../utils/generateId.js';

/**
 * Description:
 * Manages a single horizontal Row, which contains and organizes Columns.
 * It acts as a 'drop zone' (type 'row') to detect drops in the horizontal
 * gaps *between* columns. It also manages its own vertical (height) resizing
 * and collapse state.
 *
 * Properties summary:
 * - _state {object} : Internal state (child Columns, parent Container, height, collapse).
 * - element {HTMLElement} : The main DOM element (<div class="row">).
 * - dropZoneType {string} : The identifier for the DragDropService.
 * - collapseBtn {HTMLElement|null} : The button element to toggle collapse state.
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
 * - Manages its own vertical resize handle and collapse button.
 * - Collapse state is managed locally but disabled by LayoutService.
 *
 * Dependencies:
 * - components/Column/Column.js
 * - utils/EventBus.js
 * - ../../utils/EventBus.js
 * - ../../utils/ThrottleRAF.js
 * - ../../utils/generateId.js
 */
export class Row {
    /**
     * Internal state holding child Column components and dimensions.
     * @type {{
     * children: Array<Column>,
     * parentContainer: import('../Container/Container.js').Container | null,
     * height: number | null,
     * collapsed: boolean,
     * collapsible: boolean
     * }}
     * @private
     */
    _state = {
        children: [],
        parentContainer: null,
        height: null,
        collapsed: false,
        collapsible: true
    };

    /**
     * Unique ID for this instance, used for namespacing events.
     * @type {string}
     * @private
     */
    _id = generateId();

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
     * The button element to toggle collapse state.
     * Stored for access by LayoutService (to disable).
     * @type {HTMLElement | null}
     * @public
     */
    collapseBtn = null;

    /**
     * Stores the bound reference for the collapse button listener.
     * @type {Function | null}
     @private
     */
    _boundOnToggleCollapseRequest = null;

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
        me._boundOnToggleCollapseRequest = me.toggleCollapse.bind(me);

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

        if (me.collapseBtn) {
            me.collapseBtn.removeEventListener('click', me._boundOnToggleCollapseRequest);
        }

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
     * Adds the vertical resize handle and collapse button to this Row.
     * @param {boolean} isLast - True if this is the last Row in the Container.
     * @returns {void}
     */
    addResizeBars(isLast) {
        const me = this;
        me.element.querySelectorAll('.row__resize-handle').forEach(b => b.remove());
        me.element.querySelectorAll('.row__collapse-btn').forEach(b => b.remove());
        me.element.classList.remove('row--resize-bottom');
        me.collapseBtn = null;

        if (me._state.collapsible) {
            me.collapseBtn = document.createElement('button');
            me.collapseBtn.type = 'button';
            me.collapseBtn.className = 'row__collapse-btn';
            me.collapseBtn.setAttribute('aria-label', 'Toggle Row Collapse');
            if (me._state.collapsed) {
                me.collapseBtn.classList.add('row__collapse-btn--collapsed');
            }
            me.collapseBtn.addEventListener('click', me._boundOnToggleCollapseRequest);
            me.element.appendChild(me.collapseBtn);
        }

        if (isLast) {
            return;
        }

        me.element.classList.add('row--resize-bottom');
        const bar = document.createElement('div');
        bar.classList.add('row__resize-handle');
        me.element.appendChild(bar);
        bar.addEventListener('pointerdown', e => me.startResize(e));
    }

    /**
     * Handles the start of a vertical resize drag for this Row.
     * @param {PointerEvent} e - The pointerdown event.
     * @returns {void}
     */
    startResize(e) {
        const me = this;
        if (me._state.collapsed) return;
        const container = me._state.parentContainer;
        if (!container) {
            return;
        }

        const rows = container.getRows();
        const idx = rows.indexOf(me);
        if (rows.length === 1 || idx === rows.length - 1) {
            return;
        }

        e.preventDefault();
        const target = e.target;
        const pointerId = e.pointerId;
        target.setPointerCapture(pointerId);

        const startY = e.clientY;
        const startH = me.element.offsetHeight;

        const onMove = ev => {
            if (ev.pointerId !== pointerId) {
                return;
            }
            const delta = ev.clientY - startY;
            me._state.height = Math.max(me.getMinHeight(), startH + delta);
            me.getThrottledUpdate()();
        };

        const onUp = ev => {
            if (ev.pointerId !== pointerId) {
                return;
            }
            target.releasePointerCapture(pointerId);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            me.getThrottledUpdate()?.cancel();
            container.requestLayoutUpdate();
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    }

    /**
     * Toggles the collapse state and notifies LayoutService.
     * @returns {void}
     */
    toggleCollapse() {
        const me = this;
        if (!me._state.collapsible) return;

        if (me._state.collapsed) {
            me.unCollapse();
        } else {
            me.collapse();
        }

        if (me._state.parentContainer) {
            me._state.parentContainer.requestLayoutUpdate();
        }
    }

    /**
     * Applies the correct visibility state based on the internal state.
     * @returns {void}
     */
    updateCollapse() {
        const me = this;
        if (me._state.collapsed) {
            me.collapse();
        } else {
            me.unCollapse();
        }
    }

    /**
     * Hides the content and applies collapsed styles.
     * @returns {void}
     */
    collapse() {
        const me = this;
        me._state.collapsed = true;
        me.element.classList.add('row--collapsed');
        me.getColumns().forEach(col => (col.element.style.display = 'none'));
        if (me.collapseBtn) {
            me.collapseBtn.classList.add('row__collapse-btn--collapsed');
        }
        me.updateHeight(false);
    }

    /**
     * Shows the content and removes collapsed styles.
     * @returns {void}
     */
    unCollapse() {
        const me = this;
        me._state.collapsed = false;
        me.element.classList.remove('row--collapsed');
        me.getColumns().forEach(col => (col.element.style.display = ''));
        if (me.collapseBtn) {
            me.collapseBtn.classList.remove('row__collapse-btn--collapsed');
        }
        me.updateHeight(false);
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
            // Append before the row resize handle if it exists
            const resizeHandle = me.element.querySelector('.row__resize-handle');
            if (resizeHandle) {
                me.element.insertBefore(column.element, resizeHandle);
            } else {
                me.element.appendChild(column.element);
            }
        } else {
            // Fix: Use _state.children to find the correct sibling element for insertion
            // instead of relying on DOM index which might include buttons/handles.
            me._state.children.splice(index, 0, column);

            const nextSiblingColumn = me._state.children[index + 1]; // The column that was at 'index'
            let nextDomNode = nextSiblingColumn ? nextSiblingColumn.element : null;

            if (!nextDomNode) {
                // If no next column, try to find the resize handle
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

        if (me._state.collapsed) {
            column.element.style.display = 'none';
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
        if (index === -1) {
            return;
        }
        // Remove check for instanceof to ensure we can remove any object in children array
        // if (!(me._state.children[index] instanceof Column)) { return; }

        column.destroy();
        const columnEl = column.element;
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
        me.element.style.minHeight = `${me.getMinHeight()}px`;

        if (me._state.collapsed) {
            me.element.style.flex = '0 0 auto';
            me.element.style.height = 'auto';
            me.element.classList.add('row--collapsed');
            me.element.style.minHeight = 'auto';
            return;
        }

        me.element.classList.remove('row--collapsed');

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
        // Create a copy to avoid modification during iteration issues if delete modifies array
        [...me.getColumns()].forEach(column => {
            me.deleteColumn(column);
        });

        me.element.innerHTML = '';
        me._state.children = [];
        me.collapseBtn = null;
    }

    /**
     * Serializes the Row state (and its child Columns) to JSON.
     * @returns {object}
     */
    toJSON() {
        return {
            height: this._state.height,
            collapsed: this._state.collapsed,
            collapsible: this._state.collapsible,
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
        if (data.collapsed !== undefined) {
            me._state.collapsed = data.collapsed;
        }
        if (data.collapsible !== undefined) {
            me._state.collapsible = data.collapsible;
        }

        const columnsData = data.columns || [];

        columnsData.forEach(colData => {
            const column = me.createColumn();
            column.fromJSON(colData);
        });

        me.requestLayoutUpdate();
        me.updateHeight(false);
        me.updateCollapse();
    }
}
