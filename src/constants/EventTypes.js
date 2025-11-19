/**
 * Description:
 * Defines constants for all application-wide event names (event strings)
 * used with the internal EventBus (appBus).
 *
 * Centralizing event names prevents hardcoded string literals and improves
 * maintainability, refactoring, and code discoverability across the system's
 * service-oriented architecture.
 *
 * Properties summary:
 * - STATUSBAR_SET_STATUS {string} : Request to set a temporary status message.
 * - STATUSBAR_SET_PERMANENT_STATUS {string} : Request to set the permanent status message.
 * - STATUSBAR_CLEAR_STATUS {string} : Request to clear the temporary status message.
 * - NOTIFICATION_SHOW {string} : Request to show a new notification (toast/snackbar).
 * - NOTIFICATION_DISMISS {string} : Request to dismiss a specific notification by ID.
 * - LAYOUT_INITIALIZED {string} : Signals the root layout components are loaded and initialized.
 * - LAYOUT_ROWS_CHANGED {string} : Signals a change in the Row structure (vertical layout).
 * - LAYOUT_COLUMNS_CHANGED {string} : Signals a change in the Column structure (horizontal layout).
 * - LAYOUT_PANELGROUPS_CHANGED {string} : Signals a change in PanelGroup structure within a Column.
 * - APP_SAVE_STATE {string} : Command to save the current workspace state.
 * - APP_RESTORE_STATE {string} : Command to restore the last saved workspace state.
 * - APP_RESET_STATE {string} : Command to clear saved state and load default workspace.
 * - APP_ADD_NEW_PANEL {string} : Command to create and add a new default panel.
 * - APP_CLOSE_PANEL_REQUEST {string} : Request to close a panel, typically from a context menu.
 * - APP_UNDOCK_PANEL_REQUEST {string} : Request to convert a docked panel to a floating one.
 * - PANEL_TOGGLE_COLLAPSE {string} : Request to toggle the collapse state of a PanelGroup.
 * - PANEL_CLOSE_REQUEST {string} : Request to close a PanelGroup (or the last panel in it).
 * - PANEL_GROUP_CHILD_CLOSE {string} : Internal request from a Panel to its parent PanelGroup to close.
 * - PANEL_GROUP_REMOVED {string} : Signals a PanelGroup has been removed from a Column.
 * - COLUMN_EMPTY {string} : Signals a Column has become empty of PanelGroups.
 * - ROW_EMPTY {string} : Signals a Row has become empty of Columns.
 * - DND_DRAG_START {string} : Signals the start of a drag operation.
 * - DND_DRAG_END {string} : Signals the end of a drag or undock operation.
 * - MENU_ITEM_SELECTED {string} : Signals a final menu item was clicked (used to close all menus).
 * - MENU_CLOSE_SIBLINGS {string} : Signals a menu item is hovering, requesting siblings to close.
 * - CONTEXT_MENU_OPENED {string} : Signals a context menu was opened (used to close other menus).
 *
 * Typical usage:
 * // Instead of: appBus.emit('app:save-state');
 * // Use: appBus.emit(EventTypes.APP_SAVE_STATE);
 *
 * Dependencies:
 * - None
 *
 * Notes / Additional:
 * - None
 */
export const EventTypes = Object.freeze({
    // --- StatusBar Events ---
    STATUSBAR_SET_STATUS: 'statusbar:set-status-message',
    STATUSBAR_SET_PERMANENT_STATUS: 'statusbar:set-permanent-status',
    STATUSBAR_CLEAR_STATUS: 'statusbar:clear-status',

    // --- Notification Events (Handled by NotificationService) ---
    NOTIFICATION_SHOW: 'notification:show',
    NOTIFICATION_DISMISS: 'notification:dismiss',

    // --- Layout / App Lifecycle Events (Emitted by Container, Row, Column, etc.) ---
    LAYOUT_INITIALIZED: 'app:layout-initialized',
    LAYOUT_ROWS_CHANGED: 'layout:rows-changed',
    LAYOUT_COLUMNS_CHANGED: 'layout:columns-changed',
    LAYOUT_PANELGROUPS_CHANGED: 'layout:panel-groups-changed',

    // --- App Commands (Triggered by Toolbar, Menu, Shortcuts) ---
    APP_SAVE_STATE: 'app:save-state',
    APP_RESTORE_STATE: 'app:restore-state',
    APP_RESET_STATE: 'app:reset-state',
    APP_ADD_NEW_PANEL: 'app:add-new-panel',
    APP_CLOSE_PANEL_REQUEST: 'app:close-panel-request',
    APP_UNDOCK_PANEL_REQUEST: 'app:undock-panel-request',

    // --- Panel Structural Operations (Emitted by PanelGroup, Column, Row) ---
    PANEL_TOGGLE_COLLAPSE: 'panel:toggle-collapse-request',
    PANEL_CLOSE_REQUEST: 'panel:close-request',
    PANEL_GROUP_CHILD_CLOSE: 'panel:group-child-close-request',
    PANEL_GROUP_REMOVED: 'panelgroup:removed',
    COLUMN_EMPTY: 'column:empty',
    ROW_EMPTY: 'row:empty',

    // --- Drag and Drop Events ---
    DND_DRAG_START: 'dnd:dragstart',
    DND_DRAG_END: 'dnd:dragend',

    // --- Menu / Context Menu Events ---
    MENU_ITEM_SELECTED: 'menu:item-selected',
    MENU_CLOSE_SIBLINGS: 'menu:close-siblings',
    CONTEXT_MENU_OPENED: 'contextmenu:opened'
});
