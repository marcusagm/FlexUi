import { Column } from '../components/Column/Column.js';
import { Container } from '../components/Container/Container.js';
import { Row } from '../components/Row/Row.js';
import { appBus } from '../utils/EventBus.js';

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
 * appBus.emit('layout:columns-changed', this);
 *
 * Events:
 * - Listens to: 'layout:panel-groups-changed'
 * - Listens to: 'layout:rows-changed'
 * - Listens to: 'layout:columns-changed'
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
 * - Applies dynamic CSS 'min-width' to Columns based on their children.
 *
 * Dependencies:
 * - ../components/Column/Column.js
 * - ../components/Container/Container.js
 * - ../components/Row/Row.js
 * - ../utils/EventBus.js
 */
export class LayoutService {
    /**
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
     * @type {Function | null}
     * @private
     */
    _boundOnPanelGroupsChanged = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnRowsChanged = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnColumnsChanged = null;

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

        appBus.on('layout:panel-groups-changed', me._boundOnPanelGroupsChanged, options);
        appBus.on('layout:rows-changed', me._boundOnRowsChanged, options);
        appBus.on('layout:columns-changed', me._boundOnColumnsChanged, options);
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
        let uncollapsedRows = rows.filter(r => !r._state.collapsed);

        if (uncollapsedRows.length === 0) {
            const lastRow = rows[rows.length - 1];
            lastRow.unCollapse();
            uncollapsedRows = [lastRow];
        }

        const lastUncollapsedRow = uncollapsedRows[uncollapsedRows.length - 1];
        const isOnlyOneUncollapsed = uncollapsedRows.length === 1;

        rows.forEach((row, idx) => {
            const isLast = idx === rows.length - 1;
            const isLastVisible = row === lastUncollapsedRow;

            row.addResizeBars(isLast);
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
        columns.forEach((column, idx) => {
            const isLast = idx === columns.length - 1;
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
        const me = this;
        const panelGroups = column.getPanelGroups();
        if (panelGroups.length === 0) {
            column.element.style.minWidth = `${column.getEffectiveMinWidth()}px`;
            return;
        }

        let uncollapsedPanelGroups = panelGroups.filter(p => !p._state.collapsed);

        if (uncollapsedPanelGroups.length === 0) {
            const lastGroup = panelGroups[panelGroups.length - 1];
            lastGroup.unCollapse();
            uncollapsedPanelGroups = [lastGroup];
        }

        const lastUncollapsedGroup = uncollapsedPanelGroups[uncollapsedPanelGroups.length - 1];
        const isOnlyOneUncollapsed = uncollapsedPanelGroups.length === 1;

        panelGroups.forEach(panel => {
            const shouldFillSpace = panel === lastUncollapsedGroup;

            if (shouldFillSpace) {
                panel._state.height = null;
                panel.element.classList.add('panel-group--fills-space');
            } else {
                panel.element.classList.remove('panel-group--fills-space');
            }

            const collapseButton = panel._state.header?.collapseBtn;
            if (collapseButton) {
                const isThisPanelTheOnlyUncollapsed = isOnlyOneUncollapsed && shouldFillSpace;

                if (!panel._state.collapsible || isThisPanelTheOnlyUncollapsed) {
                    collapseButton.disabled = true;
                } else {
                    collapseButton.disabled = false;
                }
            }

            panel.updateHeight();
        });

        column.element.style.minWidth = `${column.getEffectiveMinWidth()}px`;
    }
}
