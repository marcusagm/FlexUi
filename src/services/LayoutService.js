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
 * - Applies 'fills-space' logic to the last Row in a Container.
 * - Applies 'fills-space' logic to the last Column in a Row.
 * - Applies 'fills-space' logic to the last *visible* PanelGroup in a Column.
 * - Enforces that at least one PanelGroup in a Column is visible.
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
        rows.forEach((row, idx) => {
            row.updateHeight(idx === rows.length - 1);
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
            // (CORREÇÃO vDND-Bug-Resize)
            // This service is now the source of truth for both width AND resize bars.
            const isLast = idx === columns.length - 1;
            column.updateWidth(isLast);
            column.addResizeBars(isLast);
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

        this._checkPanelsGroupsCollapsed(column);
        this._updatePanelGroupsSizes(column);
    }

    /**
     * Ensures at least one PanelGroup is visible in a column.
     * @param {Column} column - The column to check.
     * @private
     * @returns {void}
     */
    _checkPanelsGroupsCollapsed(column) {
        const panelGroups = column.getPanelGroups();
        const uncollapsedGroups = panelGroups.filter(p => !p._state.collapsed);
        const totalGroups = panelGroups.length;

        if (uncollapsedGroups.length === 0 && totalGroups > 0) {
            panelGroups[totalGroups - 1].unCollapse();
        }
    }

    /**
     * Recalculates sizes and applies 'panel-group--fills-space'
     * to the correct PanelGroup in a column.
     * @param {Column} column - The column to update.
     * @private
     * @returns {void}
     */
    _updatePanelGroupsSizes(column) {
        const panelGroups = column.getPanelGroups();

        const uncollapsedPanelGroups = panelGroups.filter(p => !p._state.collapsed);
        const lastUncollapsedGroup = uncollapsedPanelGroups[uncollapsedPanelGroups.length - 1];

        panelGroups.forEach(panel => {
            const shouldFillSpace = panel === lastUncollapsedGroup;

            if (shouldFillSpace) {
                panel._state.height = null;
                panel.element.classList.add('panel-group--fills-space');
            } else {
                panel.element.classList.remove('panel-group--fills-space');
            }
            panel.updateHeight();
        });
    }
}
