import { appBus } from '../EventBus.js';
import { Column } from '../Column/Column.js';
import { Container } from '../Container.js';
import { Row } from '../Row.js';

/**
 * Description:
 * A Singleton service responsible for managing and applying complex layout
 * rules, such as determining which panel fills remaining space or enforcing
 * collapse/uncollapse logic.
 *
 * (Refatorado) Agora também é responsável por aplicar a lógica "fills-space"
 * para Linhas (Rows) e Colunas (Columns), centralizando toda a lógica de layout.
 *
 * Properties summary:
 * - _instance {LayoutService | null} : The private static instance for the Singleton.
 *
 * Typical usage:
 * // In App.js (on init):
 * LayoutService.getInstance();
 *
 * // In components (e.g., Column.js / PanelGroup.js):
 * appBus.emit('layout:panel-groups-changed', { source: this });
 */
export class LayoutService {
    /**
     * @type {LayoutService | null}
     * @private
     */
    static _instance = null;

    /**
     * Private constructor for Singleton pattern.
     * @private
     */
    constructor() {
        if (LayoutService._instance) {
            console.warn('LayoutService instance already exists. Use getInstance().');
            return LayoutService._instance;
        }
        LayoutService._instance = this;
        this._initEventListeners();
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
     */
    _initEventListeners() {
        // (RENOMEADO) Ouve o evento específico para PanelGroups
        appBus.on('layout:panel-groups-changed', this._onPanelGroupsChanged.bind(this));
        // (NOVO) Ouve o evento para Rows (Vertical no Container)
        appBus.on('layout:rows-changed', this._onRowsChanged.bind(this));
        // (NOVO) Ouve o evento para Columns (Horizontal na Row)
        appBus.on('layout:columns-changed', this._onColumnsChanged.bind(this));
    }

    /**
     * (NOVO) Handles the 'layout:rows-changed' event (Vertical).
     * Lógica movida de Container.js -> updateRowsHeights()
     *
     * @param {Container} container - O Container que precisa de atualização.
     * @private
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
     * (NOVO) Handles the 'layout:columns-changed' event (Horizontal).
     * Lógica movida de Row.js -> updateColumnsSizes()
     *
     * @param {Row} row - A Row que precisa de atualização.
     * @private
     */
    _onColumnsChanged(row) {
        if (!row || !(row instanceof Row)) {
            console.warn('LayoutService: "_onColumnsChanged" received an invalid row object.');
            return;
        }

        const columns = row.getColumns();
        columns.forEach((column, idx) => {
            column.updateWidth(idx === columns.length - 1);
        });
    }

    /**
     * (RENOMEADO) Handles the specific 'layout:panel-groups-changed' event.
     * Receives the Column instance directly from the event emitter.
     *
     * @param {Column} column - The column instance needing a layout update.
     * @private
     */
    _onPanelGroupsChanged(column) {
        if (!column || !(column instanceof Column)) {
            // Validação centralizada para garantir que encontramos uma coluna válida
            console.warn(
                'LayoutService: "_onPanelGroupsChanged" received an invalid column object.'
            );
            return;
        }

        // 1. Enforce collapse rules first
        this._checkPanelsGroupsCollapsed(column);

        // 2. Apply sizing rules (like fills-space)
        this._updatePanelGroupsSizes(column);
    }

    /**
     * Ensures at least one PanelGroup is visible in a column.
     * @param {Column} column - The column to check.
     * @private
     */
    _checkPanelsGroupsCollapsed(column) {
        const panelGroups = column.getPanelGroups();

        const uncollapsedGroups = panelGroups.filter(p => !p.state.collapsed);
        const totalGroups = panelGroups.length;

        if (uncollapsedGroups.length === 0 && totalGroups > 0) {
            panelGroups[totalGroups - 1].unCollapse();
        }
    }

    /**
     * Recalculates sizes and applies 'panel-group--fills-space'
     * to the correct PanelGroup in a column.
     * (Logic moved from Column.js)
     * Esta versão usa 1 filter + 1 forEach (em vez de 1 filter + 2 forEach).
     * @param {Column} column - The column to update.
     * @private
     */
    _updatePanelGroupsSizes(column) {
        const panelGroups = column.getPanelGroups();

        const uncollapsedPanelGroups = panelGroups.filter(p => !p.state.collapsed);
        const lastUncollapsedGroup = uncollapsedPanelGroups[uncollapsedPanelGroups.length - 1];

        panelGroups.forEach(panel => {
            const shouldFillSpace = panel === lastUncollapsedGroup;

            if (shouldFillSpace) {
                panel.state.height = null;
                panel.element.classList.add('panel-group--fills-space');
            } else {
                panel.element.classList.remove('panel-group--fills-space');
            }
            panel.updateHeight();
        });
    }
}
