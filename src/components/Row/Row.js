import { Column } from '../Column/Column.js';
import { appBus } from '../../utils/EventBus.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';
import { generateId } from '../../utils/generateId.js';
import { ResizeHandleManager } from '../../utils/ResizeHandleManager.js';
import { DropZoneType } from '../../constants/DNDTypes.js';
import { EventTypes } from '../../constants/EventTypes.js';
import { UIElement } from '../../core/UIElement.js';
import { VanillaRowAdapter } from '../../renderers/vanilla/VanillaRowAdapter.js';

/**
 * Description:
 * Manages a single horizontal Row, which contains and organizes Columns.
 * It acts as a 'drop zone' (type 'row') to detect drops in the horizontal
 * gaps *between* columns. It also manages its own vertical (height) resizing
 * and collapse state using the unified ResizeHandleManager and VanillaRowAdapter.
 *
 * It extends UIElement to participate in the application lifecycle.
 *
 * Properties summary:
 * - id {string} : Unique ID for this instance.
 * - parentContainer {Container} : The parent Container instance.
 * - columns {Array<Column>} : List of child Columns.
 * - height {number|null} : The height of the row.
 * - collapsed {boolean} : Whether the row is collapsed.
 * - collapsible {boolean} : Whether the row can be collapsed.
 * - minHeight {number} : Minimum height constraint.
 * - collapseBtn {HTMLElement|null} : The DOM element for the collapse button.
 * - dropZoneType {string} : The identifier for the DragDropService.
 *
 * Typical usage:
 * const row = new Row(parentContainer, 200);
 * row.createColumn();
 *
 * Events:
 * - Listens to: EventTypes.COLUMN_EMPTY
 * - Emits: EventTypes.LAYOUT_COLUMNS_CHANGED
 * - Emits: EventTypes.ROW_EMPTY
 *
 * Business rules implemented:
 * - Manages children (Columns) and their lifecycle.
 * - Handles vertical resizing logic.
 * - Manages collapse state affecting visual height and child visibility.
 * - Integrates with LayoutService for sibling-dependent logic (e.g. disabling collapse button).
 *
 * Dependencies:
 * - {import('../../core/UIElement.js').UIElement}
 * - {import('../../renderers/vanilla/VanillaRowAdapter.js').VanillaRowAdapter}
 * - {import('../Column/Column.js').Column}
 * - {import('../../utils/ResizeHandleManager.js').ResizeHandleManager}
 * - {import('../../utils/EventBus.js').appBus}
 * - {import('../Container/Container.js').Container}
 *
 * Notes / Additional:
 * - None
 */
export class Row extends UIElement {
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
     * Unique namespace for appBus listeners.
     *
     * @type {string | null}
     * @private
     */
    _namespace = null;

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
     * @type {import('../../utils/ResizeHandleManager.js').ResizeHandleManager | null}
     * @private
     */
    _resizeHandleManager = null;

    /**
     * The DOM element for the collapse button.
     *
     * @type {HTMLElement | null}
     * @private
     */
    _collapseBtnElement = null;

    /**
     * The drop zone type identifier.
     *
     * @type {string}
     * @public
     */
    dropZoneType = DropZoneType.ROW;

    /**
     * Creates an instance of Row.
     *
     * @param {import('../Container/Container.js').Container} container - The parent Container instance.
     * @param {number|null} [height=null] - The initial height of the row.
     * @param {import('../../core/IRenderer.js').IRenderer} [renderer=null] - Optional renderer.
     */
    constructor(container, height = null, renderer = null) {
        super(generateId(), renderer || new VanillaRowAdapter());
        const me = this;

        me._namespace = me.id;
        me.parentContainer = container;
        me.height = height;
        me.minHeight = me._minHeight;

        me.setThrottledUpdate(
            throttleRAF(() => {
                me.updateHeight(false);
            })
        );

        me._boundOnColumnEmpty = me.onColumnEmpty.bind(me);
        me._boundOnToggleCollapseRequest = me.toggleCollapse.bind(me);

        // Initialize DOM via UIElement lifecycle
        me.render();
        me.initEventListeners();

        // Initial update (visual only if rendered)
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
     *
     * @param {import('../Container/Container.js').Container | null} value - The new parent container.
     * @returns {void}
     */
    set parentContainer(value) {
        const me = this;
        if (value !== null && typeof value !== 'object') {
            console.warn(
                `[Row] invalid parentContainer assignment (${value}). Must be an object. Keeping previous value: ${me._parentContainer}`
            );
            return;
        }
        me._parentContainer = value;
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
     *
     * @param {number | null} value - The new height.
     * @returns {void}
     */
    set height(value) {
        const me = this;
        if (value !== null) {
            const num = Number(value);
            if (!Number.isFinite(num) || num < 0) {
                console.warn(
                    `[Row] invalid height assignment (${value}). Must be a positive number or null. Keeping previous value: ${me._height}`
                );
                return;
            }
            me._height = num;
        } else {
            me._height = null;
        }
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
     * Manages UI state: updates adapter, toggles column visibility, updates button state.
     *
     * @param {boolean} value - The new collapsed state.
     * @returns {void}
     */
    set collapsed(value) {
        const me = this;
        if (typeof value !== 'boolean') {
            console.warn(
                `[Row] invalid collapsed assignment (${value}). Must be boolean. Keeping previous value: ${me._collapsed}`
            );
            return;
        }
        me._collapsed = value;

        // Update UI via adapter
        if (me.element) {
            me.updateHeight(false); // Re-apply height logic with new collapsed state

            // Toggle visibility of children
            me._columns.forEach(column => column.setVisible(!value));

            if (me._collapseBtnElement) {
                me.renderer.setCollapseButtonState(me._collapseBtnElement, value, false);
            }
        }
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
     * @param {boolean} value - The new collapsible state.
     * @returns {void}
     */
    set collapsible(value) {
        const me = this;
        if (typeof value !== 'boolean') {
            console.warn(
                `[Row] invalid collapsible assignment (${value}). Must be boolean. Keeping previous value: ${me._collapsible}`
            );
            return;
        }
        me._collapsible = value;
        me._setupCollapseButton();
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
     * @param {number} value - The new minimum height.
     * @returns {void}
     */
    set minHeight(value) {
        const me = this;
        const num = Number(value);
        if (!Number.isFinite(num) || num < 0) {
            console.warn(
                `[Row] invalid minHeight assignment (${value}). Must be a positive number. Keeping previous value: ${me._minHeight}`
            );
            return;
        }
        me._minHeight = num;
    }

    /**
     * Accessor for the collapse button element.
     *
     * @returns {HTMLElement | null}
     */
    get collapseBtn() {
        return this._collapseBtnElement;
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
     * Implementation of the rendering logic.
     * Uses the adapter to create the row DOM structure.
     *
     * @returns {HTMLElement} The root row element.
     * @protected
     */
    _doRender() {
        const me = this;
        const element = me.renderer.createRowElement(me.id);

        element.dataset.dropzone = me.dropZoneType;
        element.dropZoneInstance = me;

        return element;
    }

    /**
     * Implementation of the mounting logic.
     * Mounts children and sets up resize handles.
     *
     * @param {HTMLElement} container - The parent container.
     * @protected
     */
    _doMount(container) {
        const me = this;
        if (me.element) {
            if (me.element.parentNode !== container) {
                me.renderer.mount(container, me.element);
            }

            me._columns.forEach(column => {
                if (!column.element) column.render();

                const resizeHandle = me.element.querySelector('.row__resize-handle');
                const collapseBtn = me.element.querySelector('.row__collapse-btn');
                const referenceNode = resizeHandle || collapseBtn;

                if (referenceNode) {
                    me.element.insertBefore(column.element, referenceNode);
                } else {
                    me.renderer.mount(me.element, column.element);
                }
                column.mount(me.element);
            });

            me.updateAllResizeBars();
            me.updateHeight(false);
        }
    }

    /**
     * Implementation of the unmounting logic.
     *
     * @protected
     */
    _doUnmount() {
        const me = this;
        if (me.getThrottledUpdate()) {
            me.getThrottledUpdate().cancel();
        }

        // Cleanup button listener
        if (me._collapseBtnElement) {
            me.renderer.off(me._collapseBtnElement, 'click', me._boundOnToggleCollapseRequest);
        }

        if (me._resizeHandleManager) {
            me._resizeHandleManager.destroy();
            me._resizeHandleManager = null;
        }

        me._columns.forEach(column => column.unmount());

        if (me.element && me.element.parentNode) {
            me.renderer.unmount(me.element.parentNode, me.element);
        }
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

        [...me.columns].forEach(column => column.dispose());

        super.dispose();
    }

    /**
     * Event handler for when a child Column reports it is empty.
     *
     * @param {import('../Column/Column.js').Column} column - The Column instance.
     * @returns {void}
     */
    onColumnEmpty(column) {
        const me = this;
        me.deleteColumn(column);

        if (me.getTotalColumns() === 0 && me.parentContainer) {
            appBus.emit(EventTypes.ROW_EMPTY, me);
        }
    }

    /**
     * Updates the horizontal resize bars for all child Columns.
     * This is called by LayoutService.
     *
     * @returns {void}
     */
    updateAllResizeBars() {
        const me = this;
        const columns = me.columns;
        columns.forEach((column, index) => {
            column.addResizeBars(index === columns.length - 1);
        });
    }

    /**
     * Sets up the collapse button logic and DOM using the adapter.
     *
     * @private
     * @returns {void}
     */
    _setupCollapseButton() {
        const me = this;

        // Cleanup existing button
        if (me._collapseBtnElement) {
            me.renderer.off(me._collapseBtnElement, 'click', me._boundOnToggleCollapseRequest);
            me.renderer.unmountCollapseButton(me._collapseBtnElement);
            me._collapseBtnElement = null;
        }

        if (me.collapsible && me.element) {
            me._collapseBtnElement = me.renderer.createCollapseButton();
            me.renderer.on(me._collapseBtnElement, 'click', me._boundOnToggleCollapseRequest);
            me.renderer.mountCollapseButton(me.element, me._collapseBtnElement);

            // Sync initial state
            me.renderer.setCollapseButtonState(me._collapseBtnElement, me.collapsed, false);
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
        if (!me.element) return;

        // Remove existing handles manual query or track?
        // ResizeHandleManager appends div.resize-handle.
        const existingHandles = me.element.querySelectorAll('.row__resize-handle');
        existingHandles.forEach(el => el.remove());
        me.element.classList.remove('row--resize-bottom');

        if (me._resizeHandleManager) {
            me._resizeHandleManager.destroy();
            me._resizeHandleManager = null;
        }

        // Re-create collapse button logic as it might depend on handle position visually
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
                if (me.getThrottledUpdate()) {
                    me.getThrottledUpdate()();
                }
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
        me.collapsed = !me.collapsed;

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

        const safeIndex = index === undefined || index === null ? null : Number(index);

        if (safeIndex === null) {
            me._columns.push(column);
        } else {
            me._columns.splice(safeIndex, 0, column);
        }

        if (me.isMounted) {
            if (!column.element) column.render();

            let referenceNode = null;

            if (safeIndex !== null) {
                const nextCol = me._columns[safeIndex + 1];
                if (nextCol) {
                    referenceNode = nextCol.element;
                }
            }

            if (!referenceNode) {
                const resizeHandle = me.element.querySelector('.row__resize-handle');
                const collapseBtn = me.element.querySelector('.row__collapse-btn');
                referenceNode = resizeHandle || collapseBtn;
            }

            if (referenceNode) {
                me.element.insertBefore(column.element, referenceNode);
            } else {
                me.renderer.mount(me.element, column.element);
            }

            column.mount(me.element);
        }

        if (me.collapsed) {
            column.setVisible(false);
        }

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

        column.unmount();
        column.dispose();

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
        const me = this;
        const columns = me.columns;
        return columns[0] || me.createColumn();
    }

    /**
     * Returns the last child Column. If none exists, creates one.
     *
     * @returns {import('../Column/Column.js').Column} The last column instance.
     */
    getLastColumn() {
        const me = this;
        const columns = me.columns;
        return columns[columns.length - 1] || me.createColumn();
    }

    /**
     * Updates the CSS flex properties and height based on the row's state.
     * Delegates styling to adapter.
     *
     * @param {boolean} isLast - True if this is the last Row in the Container.
     * @returns {void}
     */
    updateHeight(isLast) {
        const me = this;
        if (!me.element) return;

        me.renderer.updateHeight(me.element, me.height, me._minHeight, me._collapsed, isLast);
    }

    /**
     * Enables or disables the collapse button.
     * Used by LayoutService.
     *
     * @param {boolean} disabled - Whether the button should be disabled.
     * @returns {void}
     */
    setCollapseButtonDisabled(disabled) {
        const me = this;
        if (me._collapseBtnElement && me.element) {
            me.renderer.setCollapseButtonState(me._collapseBtnElement, me._collapsed, disabled);
        }
    }

    /**
     * Wrapper method for minHeight getter (compatibility).
     *
     * @returns {number}
     */
    getMinHeight() {
        return this.minHeight;
    }

    /**
     * Wrapper method for minHeight setter (compatibility).
     *
     * @param {number} height
     * @returns {void}
     */
    setMinHeight(height) {
        this.minHeight = height;
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
        me._columns = [];
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

        if (data.collapsed !== undefined) {
            me.collapsed = data.collapsed;
        }
    }
}
