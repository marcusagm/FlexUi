import { PanelApi } from './PanelApi.js';

/**
 * Description:
 * A Facade class that exposes a safe subset of the PanelGroup's functionality.
 * It allows external control over the group's panels (adding, removing, activating)
 * and window-like states (maximize) without exposing internal DOM or renderer logic.
 *
 * Properties summary:
 * - _group {PanelGroup} : The internal panel group instance.
 *
 * Typical usage:
 * const groupApi = myPanel.parentGroup.api;
 * groupApi.openPanel(newPanelApi);
 * groupApi.maximize();
 *
 * Events:
 * - None directly (proxies events from the group if needed).
 *
 * Business rules implemented:
 * - Wraps PanelGroup operations.
 * - Unwraps PanelApi instances to pass internal Panel objects to the group.
 * - Validates inputs.
 *
 * Dependencies:
 * - {import('../components/Panel/PanelGroup.js').PanelGroup}
 * - {import('./PanelApi.js').PanelApi}
 */
export class GroupApi {
    /**
     * The internal panel group instance.
     *
     * @type {import('../components/Panel/PanelGroup.js').PanelGroup}
     * @private
     */
    _group;

    /**
     * Creates an instance of GroupApi.
     *
     * @param {import('../components/Panel/PanelGroup.js').PanelGroup} group - The group instance.
     */
    constructor(group) {
        if (!group || typeof group !== 'object') {
            throw new Error('[GroupApi] Constructor requires a valid PanelGroup instance.');
        }
        this._group = group;
    }

    /**
     * Adds and activates a panel in the group.
     * Accepts a PanelApi instance or a raw Panel (though Api is preferred).
     *
     * @param {PanelApi|import('../components/Panel/Panel.js').Panel} panelOrApi - The panel to open.
     * @returns {void}
     */
    openPanel(panelOrApi) {
        const me = this;
        const panel = me._resolvePanel(panelOrApi);

        if (panel) {
            // 'true' second argument implies making it active
            me._group.addPanel(panel, null, true);
        } else {
            console.warn('[GroupApi] openPanel: Invalid panel provided.');
        }
    }

    /**
     * Removes a panel from the group.
     *
     * @param {PanelApi|import('../components/Panel/Panel.js').Panel} panelOrApi - The panel to remove.
     * @returns {void}
     */
    removePanel(panelOrApi) {
        const me = this;
        const panel = me._resolvePanel(panelOrApi);

        if (panel) {
            me._group.removePanel(panel);
        } else {
            console.warn('[GroupApi] removePanel: Invalid panel provided.');
        }
    }

    /**
     * Sets the specified panel as the active (visible) tab.
     *
     * @param {PanelApi|import('../components/Panel/Panel.js').Panel} panelOrApi - The panel to activate.
     * @returns {void}
     */
    setActivePanel(panelOrApi) {
        const me = this;
        const panel = me._resolvePanel(panelOrApi);

        if (panel) {
            me._group.activePanel = panel;
        } else {
            console.warn('[GroupApi] setActivePanel: Invalid panel provided.');
        }
    }

    /**
     * Toggles the maximized state of the group (if supported/floating).
     *
     * @returns {void}
     */
    maximize() {
        const me = this;
        if (typeof me._group.toggleMaximize === 'function') {
            me._group.toggleMaximize();
        } else {
            console.warn(
                '[GroupApi] maximize: The underlying group does not support maximization.'
            );
        }
    }

    /**
     * Checks if the group is currently maximized.
     *
     * @returns {boolean} True if maximized.
     */
    get isMaximized() {
        return !!this._group.isMaximized;
    }

    /**
     * Helper to extract the internal Panel instance from a PanelApi or validate a raw Panel.
     *
     * @param {PanelApi|object} input - The input object.
     * @returns {import('../components/Panel/Panel.js').Panel | null} The internal panel or null.
     * @private
     */
    _resolvePanel(input) {
        if (!input) return null;

        // Check if it's an instance of PanelApi (duck typing or instanceof if circular deps allowed)
        // We use a property check for '_panel' which is standard in our Facade pattern.
        if (input instanceof PanelApi || (typeof input === 'object' && input._panel)) {
            return input._panel;
        }

        // Check if it looks like a Panel (has getPanelType)
        if (typeof input.getPanelType === 'function') {
            return input;
        }

        return null;
    }
}
