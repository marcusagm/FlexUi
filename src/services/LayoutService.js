import { Column } from '../components/Column/Column.js';
import { Container } from '../components/Container/Container.js';
import { Row } from '../components/Row/Row.js';
import { appBus } from '../utils/EventBus.js';
import { EventTypes } from '../constants/EventTypes.js';

/**
 * Description:
 * A Singleton service responsible for managing and applying complex layout
 * rules that components cannot manage on their own (e.g., rules that
 * depend on siblings). It listens to appBus events and orchestrates
 * layout updates.
 *
 * Properties summary:
 * - _instance {LayoutService | null} : The private static instance for the Singleton.
 * - _namespace {string} : Unique namespace for appBus listeners.
 *
 * Typical usage:
 * // In App.js (on init):
 * LayoutService.getInstance();
 *
 * // Components emit events:
 * appBus.emit(EventTypes.LAYOUT_COLUMNS_CHANGED, this);
 *
 * Events:
 * - Listens to: EventTypes.LAYOUT_INITIALIZED (to run full check after load)
 * - Listens to: EventTypes.LAYOUT_PANELGROUPS_CHANGED
 * - Listens to: EventTypes.LAYOUT_ROWS_CHANGED
 * - Listens to: EventTypes.LAYOUT_COLUMNS_CHANGED
 *
 * Business rules implemented:
 * - Manages 'disabled' *and* 'visibility' state of Row collapse buttons,
 * and orchestrates their creation via 'row.addResizeBars()'.
 * - Applies 'fills-space' logic to the last *visible* Row in a Container.
 * - Applies 'fills-space' logic to the last Column in a Row.
 * - Applies 'fills-space' logic to the last *visible* PanelGroup in a Column.
 * - Enforces that at least one Row in a Container is visible.
 * - Enforces that at least one PanelGroup in a Column is visible.
 * - Manages the 'disabled' state of PanelGroup collapse buttons.
 * - Manages 'disabled' *and* 'visibility' state of Row collapse buttons
 * (assumes Container/Row created the button elements).
 * - Applies dynamic CSS 'min-width' to Columns based on their children.
 *
 * Dependencies:
 * - ../components/Column/Column.js
 * - ../components/Container/Container.js
 * - ../components/Row/Row.js
 * - ../utils/EventBus.js
 * - ../constants/EventTypes.js
 */
export class LayoutService {
    /**
     * The private static instance for the Singleton.
     * @type {LayoutService | null}
     * @private
     */
    static _instance = null;

    /**
     * Unique namespace for appBus listeners.
     * @type {string}
     * @private
     */
    _namespace = 'layout-service';

    /**
     * Bound handler for the 'layout:panel-groups-changed' event.
     * @type {Function | null}
     * @private
     */
    _boundOnPanelGroupsChanged = null;

    /**
     * Bound handler for the 'layout:rows-changed' event.
     * @type {Function | null}
     * @private
     */
    _boundOnRowsChanged = null;

    /**
     * Bound handler for the 'layout:columns-changed' event.
     * @type {Function | null}
     * @private
     */
    _boundOnColumnsChanged = null;

    /**
     * Bound handler for the 'app:layout-initialized' event.
     * @type {Function | null}
     * @private
     */
    _boundOnLayoutInitialized = null;

    /**
     * @private
     */
    constructor() {
        if (LayoutService._instance) {
            console.warn('LayoutService instance already exists. Use getInstance().');
            return LayoutService._instance;
        }
        LayoutService._instance = this;

        const me = this;
        me._boundOnPanelGroupsChanged = me._onPanelGroupsChanged.bind(me);
        me._boundOnRowsChanged = me._onRowsChanged.bind(me);
        me._boundOnColumnsChanged = me._onColumnsChanged.bind(me);
        me._boundOnLayoutInitialized = me._onLayoutInitialized.bind(me);

        me._initEventListeners();
    }

    /**
     * Gets the single instance of the LayoutService.
     * @returns {LayoutService}
     */
    static getInstance() {
        if (!LayoutService._instance) {
            LayoutService._instance = new LayoutService();
        }
        return LayoutService._instance;
    }

    /**
     * Subscribes to layout-related events on the appBus.
     * @private
     * @returns {void}
     */
    _initEventListeners() {
        const me = this;
        const options = { namespace: me._namespace };

        appBus.on(EventTypes.LAYOUT_INITIALIZED, me._boundOnLayoutInitialized, options);
        appBus.on(EventTypes.LAYOUT_PANELGROUPS_CHANGED, me._boundOnPanelGroupsChanged, options);
        appBus.on(EventTypes.LAYOUT_ROWS_CHANGED, me._boundOnRowsChanged, options);
        appBus.on(EventTypes.LAYOUT_COLUMNS_CHANGED, me._boundOnColumnsChanged, options);
    }

    /**
     * Cleans up all appBus listeners.
     * @returns {void}
     */
    destroy() {
        const me = this;
        appBus.offByNamespace(me._namespace);
    }

    /**
     * Handles the 'app:layout-initialized' event.
     * Runs a full, cascading layout check on the entire container
     * to ensure all UI (buttons, sizes, min-widths) is correct on load.
     * @param {Container} container - The root Container instance.
     * @private
     * @returns {void}
     */
    _onLayoutInitialized(container) {
        if (!container || !(container instanceof Container)) {
            console.warn('LayoutService: "_onLayoutInitialized" received invalid container.');
            return;
        }

        this._onRowsChanged(container);

        container.getRows().forEach(row => {
            this._onColumnsChanged(row);

            row.getColumns().forEach(column => {
                this._updatePanelGroupsSizes(column);
            });
        });
    }

    /**
     * Handles the 'layout:rows-changed' event (Vertical).
     * Applies space-filling logic and collapse button rules.
     * @param {Container} container - The Container needing an update.
     * @private
     * @returns {void}
     */
    _onRowsChanged(container) {
        if (!container || !(container instanceof Container)) {
            console.warn('LayoutService: "_onRowsChanged" received an invalid container object.');
            return;
        }

        const rows = container.getRows();
        if (rows.length === 0) {
            return;
        }

        const totalRows = rows.length;
        let uncollapsedRows = rows.filter(row => !row._state.collapsed);

        if (uncollapsedRows.length === 0) {
            const lastRow = rows[rows.length - 1];
            lastRow.unCollapse();
            uncollapsedRows = [lastRow];
        }

        const lastUncollapsedRow = uncollapsedRows[uncollapsedRows.length - 1];
        const isOnlyOneUncollapsed = uncollapsedRows.length === 1;

        rows.forEach(row => {
            const isLastVisible = row === lastUncollapsedRow;
            row.updateHeight(isLastVisible);

            if (row.collapseBtn) {
                if (totalRows === 1) {
                    row.collapseBtn.style.display = 'none';
                } else {
                    row.collapseBtn.style.display = '';
                    const isThisRowTheOnlyUncollapsed = isOnlyOneUncollapsed && isLastVisible;

                    if (!row._state.collapsible || isThisRowTheOnlyUncollapsed) {
                        row.collapseBtn.disabled = true;
                    } else {
                        row.collapseBtn.disabled = false;
                    }
                }
            }
        });
    }

    /**
     * Handles the 'layout:columns-changed' event (Horizontal).
     * @param {Row} row - The Row needing an update.
     * @private
     * @returns {void}
     */
    _onColumnsChanged(row) {
        if (!row || !(row instanceof Row)) {
            console.warn('LayoutService: "_onColumnsChanged" received an invalid row object.');
            return;
        }

        const columns = row.getColumns();
        columns.forEach((column, index) => {
            const isLast = index === columns.length - 1;
            column.updateWidth(isLast);
            column.addResizeBars(isLast);

            column.element.style.minWidth = `${column.getEffectiveMinWidth()}px`;
        });
    }

    /**
     * Handles the 'layout:panel-groups-changed' event (Vertical in Column).
     * @param {Column} column - The column instance needing a layout update.
     * @private
     * @returns {void}
     */
    _onPanelGroupsChanged(column) {
        if (!column || !(column instanceof Column)) {
            console.warn(
                'LayoutService: "_onPanelGroupsChanged" received an invalid column object.'
            );
            return;
        }

        this._updatePanelGroupsSizes(column);
    }

    /**
     * Recalculates sizes, applies 'panel-group--fills-space',
     * and manages the collapse button state for all PanelGroups in a column.
     * @param {Column} column - The column to update.
     * @private
     * @returns {void}
     */
    _updatePanelGroupsSizes(column) {
        const panelGroups = column.getPanelGroups();
        if (panelGroups.length === 0) {
            column.element.style.minWidth = `${column.getEffectiveMinWidth()}px`;
            return;
        }

        let uncollapsedPanelGroups = panelGroups.filter(panelGroup => !panelGroup._state.collapsed);

        if (uncollapsedPanelGroups.length === 0) {
            const lastGroup = panelGroups[panelGroups.length - 1];
            lastGroup.unCollapse();
            uncollapsedPanelGroups = [lastGroup];
        }

        const lastUncollapsedGroup = uncollapsedPanelGroups[uncollapsedPanelGroups.length - 1];
        const isOnlyOneUncollapsed = uncollapsedPanelGroups.length === 1;

        panelGroups.forEach(panelGroup => {
            const shouldFillSpace = panelGroup === lastUncollapsedGroup;

            if (shouldFillSpace) {
                panelGroup._state.height = null;
                panelGroup.element.classList.add('panel-group--fills-space');
            } else {
                panelGroup.element.classList.remove('panel-group--fills-space');
            }

            const collapseButton = panelGroup._state.header?.collapseBtn;
            if (collapseButton) {
                const isThisPanelTheOnlyUncollapsed = isOnlyOneUncollapsed && shouldFillSpace;

                if (!panelGroup._state.collapsible || isThisPanelTheOnlyUncollapsed) {
                    collapseButton.disabled = true;
                } else {
                    collapseButton.disabled = false;
                }
            }

            panelGroup.updateHeight();
        });

        column.element.style.minWidth = `${column.getEffectiveMinWidth()}px`;
    }
}
