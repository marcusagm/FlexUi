/**
 * Description:
 * Defines constant values used throughout the Drag-and-Drop (DND) system.
 * This file serves as the single source of truth for identifying Drop Zones and
 * Draggable Item types, preventing magic strings and facilitating refactoring across the application.
 *
 * Properties summary:
 * - DropZoneType {object} : Enumeration of supported drop zone identifiers (standardized to kebab-case).
 * - ItemType {object} : Enumeration of supported draggable item identifiers (standardized to PascalCase matching classes).
 *
 * Typical usage:
 * import { DropZoneType, ItemType } from '../constants/DNDTypes.js';
 *
 * if (dropZone.type === DropZoneType.COLUMN) {
 * // Handle column drop logic
 * }
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Centralizes type definitions to ensure consistency in DND logic.
 * - Uses immutable objects (frozen) to prevent runtime modifications.
 * - DropZoneType values are standardized to 'kebab-case' for HTML attribute consistency.
 *
 * Dependencies:
 * - None
 *
 * Notes / Additional:
 * - None
 */

/**
 * Enumeration of all supported Drop Zone types in the application.
 * Used to identify the target area where an item can be dropped.
 * Standardized to lowercase kebab-case.
 *
 * @type {Readonly<{
 * COLUMN: 'column',
 * ROW: 'row',
 * CONTAINER: 'container',
 * TAB_CONTAINER: 'tab-container',
 * TOOLBAR_CONTAINER: 'toolbar-container'
 * }>}
 */
export const DropZoneType = Object.freeze({
    COLUMN: 'column',
    ROW: 'row',
    CONTAINER: 'container',
    TAB_CONTAINER: 'tab-container',
    TOOLBAR_CONTAINER: 'toolbar-container'
});

/**
 * Enumeration of all supported Draggable Item types.
 * Used to identify the nature of the object being dragged.
 * Kept as PascalCase to match the Component Class names.
 *
 * @type {Readonly<{
 * PANEL: 'Panel',
 * PANEL_GROUP: 'PanelGroup',
 * TOOLBAR_GROUP: 'ToolbarGroup'
 * }>}
 */
export const ItemType = Object.freeze({
    PANEL: 'Panel',
    PANEL_GROUP: 'PanelGroup',
    TOOLBAR_GROUP: 'ToolbarGroup'
});
