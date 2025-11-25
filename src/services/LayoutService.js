import { appBus } from '../utils/EventBus.js';
import { throttleRAF } from '../utils/ThrottleRAF.js';
import { EventTypes } from '../constants/EventTypes.js';

/**
 * Description:
 * A Singleton service responsible for calculating and enforcing layout constraints
 * across the application. It listens for structural changes (Rows/Columns/Groups added or removed)
 * and updates visual properties like min-width, fill-space behavior, and collapse button availability.
 *
 * Properties summary:
 * - _instance {LayoutService} : The singleton instance.
 * - _throttledUpdate {Function} : A throttled function to batch layout updates.
 *
 * Typical usage:
 * LayoutService.getInstance(); // Starts listening automatically
 *
 * Events:
 * - Listens to: LAYOUT_ROWS_CHANGED
 * - Listens to: LAYOUT_COLUMNS_CHANGED
 * - Listens to: LAYOUT_PANELGROUPS_CHANGED
 *
 * Business rules implemented:
 * - Enforces that at least one row (usually the last) fills the available vertical space.
 * - Disables row collapse if it is the only row.
 * - Disables panel group collapse if it is the only item in a column.
 * - Calculates minimum widths for columns based on their children's constraints.
 * - Determines which child in a column should expand to fill available vertical space.
 *
 * Dependencies:
 * - {import('../utils/EventBus.js').appBus}
 * - {import('../utils/ThrottleRAF.js').throttleRAF}
 * - {import('../constants/EventTypes.js').EventTypes}
 */
export class LayoutService {
    /**
     * The singleton instance.
     *
     * @type {LayoutService | null}
     * @private
     */
    static _instance = null;

    /**
     * Throttled update function.
     *
     * @type {Function | null}
     * @private
     */
    _throttledUpdate = null;

    /**
     * Private constructor for Singleton.
     */
    constructor() {
        if (LayoutService._instance) {
            return LayoutService._instance;
        }
        LayoutService._instance = this;

        const me = this;
        me._throttledUpdate = throttleRAF(me._performLayoutUpdate.bind(me));
        me._initListeners();
    }

    /**
     * Gets the singleton instance.
     *
     * @returns {LayoutService}
     */
    static getInstance() {
        if (!LayoutService._instance) {
            LayoutService._instance = new LayoutService();
        }
        return LayoutService._instance;
    }

    /**
     * Initializes event listeners.
     *
     * @private
     * @returns {void}
     */
    _initListeners() {
        const me = this;
        appBus.on(EventTypes.LAYOUT_ROWS_CHANGED, container => me._onRowsChanged(container));
        appBus.on(EventTypes.LAYOUT_COLUMNS_CHANGED, row => me._onColumnsChanged(row));
        appBus.on(EventTypes.LAYOUT_PANELGROUPS_CHANGED, column =>
            me._onPanelGroupsChanged(column)
        );
    }

    /**
     * Placeholder for the throttled update logic if needed globally.
     * Currently updates are triggered per component event.
     *
     * @private
     * @returns {void}
     */
    _performLayoutUpdate() {
        // Global re-flow logic could go here if needed
    }

    /**
     * Handles changes in the list of rows within a container.
     *
     * @param {import('../components/Container/Container.js').Container} container
     * @private
     * @returns {void}
     */
    _onRowsChanged(container) {
        if (!container) return;

        const rows = container.rows;
        if (!rows || rows.length === 0) return;

        // Business Rule: If there is only one row, it shouldn't be collapsible.
        const shouldDisableCollapse = rows.length <= 1;

        rows.forEach((row, index) => {
            const isLast = index === rows.length - 1;

            // Update resize bars availability
            if (typeof row.updateAllResizeBars === 'function') {
                row.updateAllResizeBars();
            }

            // Update height styles (last row usually fills space)
            if (typeof row.updateHeight === 'function') {
                row.updateHeight(isLast);
            }

            // Enable/Disable collapse button using public API
            if (typeof row.setCollapseButtonDisabled === 'function') {
                row.setCollapseButtonDisabled(shouldDisableCollapse);
            }
        });
    }

    /**
     * Handles changes in the list of columns within a row.
     *
     * @param {import('../components/Row/Row.js').Row} row
     * @private
     * @returns {void}
     */
    _onColumnsChanged(row) {
        if (!row) return;

        const columns = row.columns;
        if (!columns) return;

        columns.forEach((column, index) => {
            const isLast = index === columns.length - 1;

            // Update resize handles
            if (typeof column.addResizeBars === 'function') {
                column.addResizeBars(isLast);
            }

            // Update width styles (last column fills space)
            if (typeof column.updateWidth === 'function') {
                column.updateWidth(isLast);
            }

            // Recalculate constraints based on children
            this._updateChildrenSizes(column);
        });
    }

    /**
     * Handles changes in the list of panel groups/viewports within a column.
     *
     * @param {import('../components/Column/Column.js').Column} column
     * @private
     * @returns {void}
     */
    _onPanelGroupsChanged(column) {
        this._updateChildrenSizes(column);
    }

    /**
     * Calculates constraints and layout classes for children of a column.
     *
     * @param {import('../components/Column/Column.js').Column} column
     * @private
     * @returns {void}
     */
    _updateChildrenSizes(column) {
        if (!column) return;

        const children = column.children; // PanelGroups or Viewports
        if (!children || children.length === 0) return;

        let maxMinWidth = 0;

        // 1. Calculate the maximum minimum width required by any child
        children.forEach(child => {
            let childMin = 0;
            // Use public API to get min width constraint
            if (typeof child.getMinPanelWidth === 'function') {
                childMin = child.getMinPanelWidth();
            } else if (child.minWidth !== undefined) {
                childMin = child.minWidth;
            }

            if (childMin > maxMinWidth) {
                maxMinWidth = childMin;
            }
        });

        // 2. Apply this constraint to the column using public API
        if (typeof column.setComputedMinWidth === 'function') {
            column.setComputedMinWidth(maxMinWidth);
        }

        // 3. Determine layout logic (Fill Space & Collapse)
        const uncollapsedChildren = children.filter(child => {
            return typeof child.collapsed !== 'boolean' || !child.collapsed;
        });

        const lastUncollapsed = uncollapsedChildren[uncollapsedChildren.length - 1];

        // Prevent collapsing if it's the only item in the column
        const shouldDisableCollapse = children.length <= 1;

        children.forEach(child => {
            const shouldFill = child === lastUncollapsed;

            // [API Use] Set Fill Space behavior
            if (typeof child.setFillSpace === 'function') {
                // Ensure floating panels don't get layout classes from parent flow
                if (child.isFloating) {
                    child.setFillSpace(false);
                } else {
                    child.setFillSpace(shouldFill);
                }
            }

            // [API Use] Set Collapse Button State
            if (typeof child.setCollapseButtonDisabled === 'function') {
                child.setCollapseButtonDisabled(shouldDisableCollapse);
            }
        });
    }
}
