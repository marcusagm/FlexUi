import { appBus } from '../EventBus.js';
import { Column } from '../Column/Column.js';

/**
 * Description:
 * A Singleton service responsible for managing and applying complex layout
 * rules, such as determining which panel fills remaining space or enforcing
 * collapse/uncollapse logic.
 *
 * Properties summary:
 * - _instance {LayoutService | null} : The private static instance for the Singleton.
 *
 * Typical usage:
 * // In App.js (on init):
 * LayoutService.getInstance();
 *
 * // In components (e.g., Column.js / PanelGroup.js):
 * appBus.emit('layout:changed', { source: this });
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
        // (ALTERADO) Ouve o evento específico 'layout:column-changed'
        appBus.on('layout:column-changed', this._onColumnChanged.bind(this));
    }

    /**
     * Handles the specific 'layout:column-changed' event.
     * Receives the Column instance directly from the event emitter.
     *
     * @param {Column} column - The column instance needing a layout update.
     * @private
     */
    _onColumnChanged(column) {
        if (!column || !(column instanceof Column)) {
            // Validação centralizada para garantir que encontramos uma coluna válida
            console.warn('LayoutService: "_onColumnChanged" received an invalid column object.');
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
