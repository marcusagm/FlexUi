import { appBus } from '../EventBus.js';
import { PanelGroup } from '../Panel/PanelGroup.js';
// (NOVO) Adicionada importação da Column para verificação
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
 * // (ALTERADO) In components (e.g., Column.js / PanelGroup.js):
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
        // (ALTERADO) Ouve o evento genérico 'layout:changed'
        appBus.on('layout:changed', this._onLayoutChanged.bind(this));
    }

    /**
     * (NOVO) Handles the generic 'layout:changed' event.
     * Determines the source Column and triggers the layout update.
     *
     * @param {object} event - The event object, expected { source: Component }.
     * @private
     */
    _onLayoutChanged(event) {
        if (!event || !event.source) {
            console.warn('LayoutService: "_onLayoutChanged" received an invalid event.');
            return;
        }

        let column = null;

        if (event.source instanceof Column) {
            column = event.source;
        } else if (event.source instanceof PanelGroup) {
            column = event.source.state.column;
        }

        // Validação centralizada para garantir que encontramos uma coluna válida
        if (!column || !(column instanceof Column)) {
            // (Este console.warn substitui a verificação anterior)
            console.warn(
                'LayoutService: Could not determine valid column from "layout:changed" event source.'
            );
            return;
        }

        // 1. Enforce collapse rules first
        this._checkPanelsGroupsCollapsed(column);

        // 2. Apply sizing rules (like fills-space)
        this._updatePanelGroupsSizes(column);
    }

    /* O método _onLayoutUpdate(column) foi removido */

    /**
     * Ensures at least one PanelGroup is visible in a column.
     * (Logic moved from Column.js)
     * @param {Column} column - The column to check.
     * @private
     */
    _checkPanelsGroupsCollapsed(column) {
        // Helper logic (previously getPanelGroupsUncollapsed)
        const uncollapsedGroups = column.state.panelGroups.filter(p => !p.state.collapsed);
        const totalGroups = column.state.panelGroups.length;

        if (uncollapsedGroups.length === 0 && totalGroups > 0) {
            // Force the last panel to uncollapse
            column.state.panelGroups[totalGroups - 1].unCollapse();
        }
    }

    /**
     * Recalculates sizes and applies 'panel-group--fills-space'
     * to the correct PanelGroup in a column.
     * (Logic moved from Column.js)
     * @param {Column} column - The column to update.
     * @private
     */
    _updatePanelGroupsSizes(column) {
        // Helper logic (previously getPanelGroupsUncollapsed)
        const uncollapsedPanelGroups = column.state.panelGroups.filter(p => !p.state.collapsed);
        const lastUncollapsedPanelGroup = uncollapsedPanelGroups[uncollapsedPanelGroups.length - 1];

        column.state.panelGroups.forEach(panel => {
            panel.element.classList.remove('panel-group--fills-space');
        });

        // Allow the last panel to grow
        if (lastUncollapsedPanelGroup) {
            lastUncollapsedPanelGroup.state.height = null;
        }

        // Update all individual panel heights (respecting 'null' for the last one)
        column.state.panelGroups.forEach(panel => {
            panel.updateHeight();
        });

        // Apply the fill class to the one we set to null
        if (lastUncollapsedPanelGroup && lastUncollapsedPanelGroup.state.height === null) {
            lastUncollapsedPanelGroup.element.classList.add('panel-group--fills-space');
        }
    }
}
