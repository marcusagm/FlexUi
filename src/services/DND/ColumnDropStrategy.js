import { BaseDropStrategy } from './BaseDropStrategy.js';
import { PanelGroup } from '../../components/Panel/PanelGroup.js';
import { FloatingPanelManagerService } from './FloatingPanelManagerService.js';
import { ItemType } from '../../constants/DNDTypes.js';

/**
 * Description:
 * A DND strategy that defines drop behavior for 'column' type drop zones.
 * It handles rearranging PanelGroups and Viewports vertically within a Column, or
 * creating a new PanelGroup wrapper if a single Panel (tab) is dropped.
 *
 * Properties summary:
 * - _dropZoneCache {Array<object>} : Caches the geometry of child components.
 * - _dropIndex {number | null} : The calculated drop index.
 *
 * Business rules implemented:
 * - Caches child (PanelGroup/Viewport) geometry on 'onDragEnter'.
 * - Calculates drop index based on 'midY' (vertical midpoint) of children.
 * - Shows a 'horizontal' placeholder in the calculated gap.
 * - Implements "ghost" logic to prevent flickering when dragging over
 * its own original position.
 * - Validates drop zone strictly: The target MUST be the column element itself
 * or the placeholder. Hovering over children is considered an invalid drop
 * for the Column (allowing specific strategies of the child to take over).
 * - On drop (PanelGroup): Moves the group to the new index using `addChild`.
 * - On drop (Panel): Creates a new PanelGroup wrapper at the index using `addChild`.
 * - Returns boolean indicating if the drop was handled.
 *
 * Dependencies:
 * - {import('./BaseDropStrategy.js').BaseDropStrategy}
 * - {import('../../components/Panel/PanelGroup.js').PanelGroup}
 * - {import('../../components/Viewport/Viewport.js').Viewport}
 * - {import('./FloatingPanelManagerService.js').FloatingPanelManagerService}
 * - {import('../../constants/DNDTypes.js').ItemType}
 */
export class ColumnDropStrategy extends BaseDropStrategy {
    /**
     * Caches the geometry (midY) and index of child components.
     *
     * @type {Array<{element: HTMLElement, midY: number, originalIndex: number}>}
     * @private
     */
    _dropZoneCache = [];

    /**
     * The calculated drop index (state).
     *
     * @type {number | null}
     * @private
     */
    _dropIndex = null;

    /**
     * Clears the internal geometry cache and drop index.
     *
     * @returns {void}
     */
    clearCache() {
        const me = this;
        me._dropZoneCache = [];
        me._dropIndex = null;
    }

    /**
     * Hook called when a drag enters the zone.
     * Caches the geometry of child components (PanelGroups and Viewports).
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Column/Column.js').Column} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDragEnter(point, dropZone, draggedData, dds) {
        const me = this;
        if (
            !draggedData.item ||
            (draggedData.type !== ItemType.PANEL_GROUP && draggedData.type !== ItemType.PANEL)
        ) {
            return false;
        }

        let draggedItem;
        if (draggedData.type === ItemType.PANEL_GROUP) {
            draggedItem = draggedData.item;
        } else if (draggedData.type === ItemType.PANEL) {
            draggedItem = draggedData.item.parentGroup;
            if (!draggedItem) return false;
        }

        me.clearCache();
        // Use children getter directly
        const children = dropZone.children;

        for (let i = 0; i < children.length; i++) {
            const targetChild = children[i];
            // Skip the dragged item itself to avoid calculation errors
            if (draggedItem === targetChild) continue;

            const rect = targetChild.element.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;

            me._dropZoneCache.push({
                element: targetChild.element,
                midY: midY,
                originalIndex: i
            });
        }
        return true;
    }

    /**
     * Hook called when a drag moves over the zone.
     * Calculates the drop position and shows the placeholder.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Column/Column.js').Column} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDragOver(point, dropZone, draggedData, dds) {
        const me = this;
        const placeholder = dds.getPlaceholder();

        // Strict Target Check: Must be column or placeholder
        if (point.target !== dropZone.element && point.target !== placeholder) {
            dds.hidePlaceholder();
            me._dropIndex = null;
            return false;
        }

        if (
            !draggedData.item ||
            (draggedData.type !== ItemType.PANEL_GROUP && draggedData.type !== ItemType.PANEL)
        ) {
            return false;
        }

        let draggedItem;
        let isEffectiveGroupDrag = false;

        if (draggedData.type === ItemType.PANEL_GROUP) {
            draggedItem = draggedData.item;
            isEffectiveGroupDrag = true;
        } else if (draggedData.type === ItemType.PANEL) {
            draggedItem = draggedData.item.parentGroup;
            if (!draggedItem) return false;
            if (draggedItem.panels.length === 1) {
                isEffectiveGroupDrag = true;
            }
        }

        dds.showPlaceholder('horizontal', draggedItem.element.offsetHeight);

        // Check if dragging within the same column to handle ghost logic
        let originalIndex = -1;
        // Safe check for getColumn/parentColumn existence
        const oldColumn =
            typeof draggedItem.getColumn === 'function' ? draggedItem.getColumn() : null;

        if (oldColumn === dropZone) {
            originalIndex = dropZone.getChildIndex(draggedItem);
        }

        let placed = false;
        me._dropIndex = dropZone.children.length;

        for (const cacheItem of me._dropZoneCache) {
            if (point.y < cacheItem.midY) {
                dropZone.element.insertBefore(placeholder, cacheItem.element);
                placed = true;
                me._dropIndex = cacheItem.originalIndex;
                break;
            }
        }

        if (!placed) {
            dropZone.element.appendChild(placeholder);
        }

        const isSameColumn = oldColumn === dropZone;
        const isOriginalPosition = me._dropIndex === originalIndex;
        const isBelowGhost = me._dropIndex === originalIndex + 1;

        if (isSameColumn && isEffectiveGroupDrag && (isOriginalPosition || isBelowGhost)) {
            dds.hidePlaceholder();
            me._dropIndex = null;
            return false;
        }

        return true;
    }

    /**
     * Hook called when the item is dropped.
     * Moves the PanelGroup or creates a new wrapper for a Panel.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Column/Column.js').Column} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDrop(point, dropZone, draggedData, dds) {
        const me = this;
        const targetIndex = me._dropIndex;

        if (
            !draggedData.item ||
            (draggedData.type !== ItemType.PANEL_GROUP && draggedData.type !== ItemType.PANEL)
        ) {
            return false;
        }

        let sourceGroup = null;
        if (draggedData.type === ItemType.PANEL_GROUP) {
            sourceGroup = draggedData.item;
        } else if (draggedData.type === ItemType.PANEL) {
            sourceGroup = draggedData.item.parentGroup;
        }

        // Handle floating state removal
        if (sourceGroup && sourceGroup.isFloating) {
            if (draggedData.type === ItemType.PANEL_GROUP) {
                FloatingPanelManagerService.getInstance().removeFloatingPanel(sourceGroup);
            }
        }

        if (targetIndex === null) {
            // If valid drag but invalid index (ghost logic), force layout update to reset visuals
            const itemToUpdate =
                draggedData.type === ItemType.PANEL_GROUP
                    ? draggedData.item
                    : draggedData.item.parentGroup;

            if (itemToUpdate) {
                const oldColumn =
                    typeof itemToUpdate.getColumn === 'function' ? itemToUpdate.getColumn() : null;
                if (oldColumn) {
                    oldColumn.requestLayoutUpdate();
                }
            }
            return false;
        }

        if (draggedData.type === ItemType.PANEL_GROUP) {
            const draggedItem = draggedData.item;
            const oldColumn =
                typeof draggedItem.getColumn === 'function' ? draggedItem.getColumn() : null;

            if (typeof draggedItem.height === 'number') {
                // Reset height property if it exists
                draggedItem.height = null;
            }

            if (oldColumn) {
                oldColumn.removeChild(draggedItem, true);
            }
            dropZone.addChild(draggedItem, targetIndex);
        } else if (draggedData.type === ItemType.PANEL) {
            const draggedPanel = draggedData.item;
            const sourceParentGroup = draggedPanel.parentGroup;

            // Create new wrapper
            const newPanelGroup = new PanelGroup();
            dropZone.addChild(newPanelGroup, targetIndex);

            if (sourceParentGroup) {
                sourceParentGroup.removePanel(draggedPanel, true);
            }
            newPanelGroup.addPanel(draggedPanel, true);
        }

        return true;
    }
}
