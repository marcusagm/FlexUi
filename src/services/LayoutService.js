import { Column } from '../components/Column/Column.js';
import { Container } from '../components/Container/Container.js';
import { Row } from '../components/Row/Row.js';
import { Viewport } from '../components/Viewport/Viewport.js';
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
 * - _boundOnPanelGroupsChanged {Function | null} : Bound handler for panel groups changed event.
 * - _boundOnRowsChanged {Function | null} : Bound handler for rows changed event.
 * - _boundOnColumnsChanged {Function | null} : Bound handler for columns changed event.
 * - _boundOnLayoutInitialized {Function | null} : Bound handler for layout initialized event.
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
 * - Applies 'fills-space' logic to the last *visible* child (PanelGroup or Viewport) in a Column.
 * - Prioritizes Viewport for filling space if present.
 * - Enforces that at least one Row in a Container is visible.
 * - Enforces that at least one child in a Column is visible.
 * - Manages the 'disabled' state of PanelGroup collapse buttons.
 * - Manages 'disabled' *and* 'visibility' state of Row collapse buttons
 * (assumes Container/Row created the button elements).
 * - Applies dynamic CSS 'min-width' to Columns based on their children.
 *
 * Dependencies:
 * - {import '../components/Column/Column.js'.Column}
 * - {import '../components/Container/Container.js'.Container}
 * - {import '../components/Row/Row.js'.Row}
 * - {import '../components/Viewport/Viewport.js'.Viewport}
 * - {import '../utils/EventBus.js'.appBus}
 * - {import '../constants/EventTypes.js'.EventTypes}
 */
export class LayoutService {
    /**
     * The private static instance for the Singleton.
     *
     * @type {LayoutService | null}
     * @private
     */
    static _instance = null;

    /**
     * Unique namespace for appBus listeners.
     *
     * @type {string}
     * @private
     */
    _namespace = 'layout-service';

    /**
     * Bound handler for the 'layout:panel-groups-changed' event.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnPanelGroupsChanged = null;

    /**
     * Bound handler for the 'layout:rows-changed' event.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnRowsChanged = null;

    /**
     * Bound handler for the 'layout:columns-changed' event.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnColumnsChanged = null;

    /**
     * Bound handler for the 'app:layout-initialized' event.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnLayoutInitialized = null;

    /**
     * Creates a new LayoutService instance.
     *
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
     *
     * @returns {LayoutService} The singleton instance.
     */
    static getInstance() {
        if (!LayoutService._instance) {
            LayoutService._instance = new LayoutService();
        }
        return LayoutService._instance;
    }

    /**
     * Subscribes to layout-related events on the appBus.
     *
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
     *
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
     *
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
                this._updateChildrenSizes(column);
            });
        });
    }

    /**
     * Handles the 'layout:rows-changed' event (Vertical).
     * Applies space-filling logic and collapse button rules.
     *
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
        let uncollapsedRows = rows.filter(row => !row.collapsed);

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

                    if (!row.collapsible || isThisRowTheOnlyUncollapsed) {
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
     *
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
     *
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

        this._updateChildrenSizes(column);
    }

    /**
     * Recalculates sizes, applies 'fills-space' logic, and manages collapse button state
     * for all children (PanelGroups and Viewports) in a column.
     *
     * Viewports are prioritized for space filling and are never collapsible.
     *
     * @param {Column} column - The column to update.
     * @private
     * @returns {void}
     */
    _updateChildrenSizes(column) {
        // Use generic 'children' accessor which includes both PanelGroups and Viewports
        const children = column.children;

        if (children.length === 0) {
            column.element.style.minWidth = `${column.getEffectiveMinWidth()}px`;
            return;
        }

        // Filter uncollapsed children. Viewports are always considered uncollapsed.
        let uncollapsedChildren = children.filter(child => {
            // Viewports are never collapsed
            if (child instanceof Viewport) return true;
            // Check collapsed property for PanelGroups
            return !child.collapsed;
        });

        // Safety check: Ensure at least one item is visible
        if (uncollapsedChildren.length === 0) {
            const lastChild = children[children.length - 1];
            // Only uncollapse if it supports it (PanelGroup)
            if (lastChild && typeof lastChild.unCollapse === 'function') {
                lastChild.unCollapse();
            }
            uncollapsedChildren = [lastChild];
        }

        // Determine which child should fill the remaining space.
        // Logic: The last uncollapsed child usually fills space.
        // Exception: If a Viewport exists, it might be preferred (business rule dependent).
        // Current rule: Last visible child fills space.
        const lastUncollapsedChild = uncollapsedChildren[uncollapsedChildren.length - 1];
        const isOnlyOneUncollapsed = uncollapsedChildren.length === 1;

        children.forEach(child => {
            const shouldFillSpace = child === lastUncollapsedChild;

            // Handle Fill Space Logic
            if (shouldFillSpace) {
                // Remove fixed height to allow flex-grow
                if (typeof child.height === 'number') {
                    // We don't delete the property, just ensure style is auto/flex
                    // But for PanelGroup, setting height=null is the convention
                    if ('height' in child) child.height = null;
                }

                // Add class for styling
                child.element.classList.add(
                    child instanceof Viewport ? 'viewport--fills-space' : 'panel-group--fills-space'
                );
            } else {
                child.element.classList.remove('panel-group--fills-space');
                child.element.classList.remove('viewport--fills-space');
            }

            // Handle Collapse Button Logic (Only for PanelGroups)
            if (child.header && child.header.collapseBtn) {
                const collapseButton = child.header.collapseBtn;

                // Logic: Disable collapse if this is the ONLY visible item AND it is filling space
                // Viewports don't have headers with collapse buttons generally, but good to check instance
                const isThisPanelTheOnlyUncollapsed = isOnlyOneUncollapsed && shouldFillSpace;

                // Also check internal collapsible config
                const isCollapsible = child.collapsible !== false;

                if (!isCollapsible || isThisPanelTheOnlyUncollapsed) {
                    collapseButton.disabled = true;
                } else {
                    collapseButton.disabled = false;
                }
            }

            // Trigger internal update for the child to apply styles
            if (typeof child.updateHeight === 'function') {
                child.updateHeight();
            }
        });

        column.element.style.minWidth = `${column.getEffectiveMinWidth()}px`;
    }
}
