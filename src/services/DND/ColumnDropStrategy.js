import { BaseDropStrategy } from './BaseDropStrategy.js';
import { PanelGroup } from '../../components/Panel/PanelGroup.js';
import { Panel } from '../../components/Panel/Panel.js';
import { FloatingPanelManagerService } from './FloatingPanelManagerService.js';
import { ItemType } from '../../constants/DNDTypes.js';

/**
 * Description:
 * A DND strategy that defines drop behavior for 'column' type drop zones.
 * It handles rearranging PanelGroups vertically within a Column, or
 * creating a new PanelGroup wrapper if a single Panel (tab) is dropped.
 *
 * Properties summary:
 * - _dropZoneCache {Array<object>} : Caches the geometry of child PanelGroups.
 * - _dropIndex {number | null} : The calculated drop index.
 *
 * Business rules implemented:
 * - Caches child PanelGroup geometry on 'onDragEnter'.
 * - Calculates drop index based on 'midY' (vertical midpoint).
 * - Shows a 'horizontal' placeholder in the calculated gap.
 * - Implements "ghost" logic to prevent flickering when dragging over
 * its own original position.
 * - Validates drop zone strictly: The target MUST be the column element itself
 * or the placeholder. Hovering over children (PanelGroups) is considered an
 * invalid drop for the Column (allowing specific PanelGroup strategies or Undock to take over).
 * - On drop (PanelGroup): Moves the group to the new index.
 * - On drop (Panel): Creates a new PanelGroup wrapper at the index
 * and moves the Panel into it.
 * - Returns boolean indicating if the drop was handled.
 *
 * Dependencies:
 * - ./BaseDropStrategy.js
 * - ../../components/Panel/PanelGroup.js
 * - ../../components/Panel/Panel.js
 * - ./FloatingPanelManagerService.js
 * - ../../constants/DNDTypes.js
 */
export class ColumnDropStrategy extends BaseDropStrategy {
    /**
     * Caches the geometry (midY) and index of child PanelGroups.
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
     * Caches the geometry of child panel groups.
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
            draggedItem = draggedData.item._state.parentGroup;
            if (!draggedItem) return false;
        }

        me.clearCache();
        const panelGroups = dropZone.getPanelGroups();

        for (let i = 0; i < panelGroups.length; i++) {
            const targetGroup = panelGroups[i];
            if (draggedItem === targetGroup) continue;

            const rect = targetGroup.element.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;

            me._dropZoneCache.push({
                element: targetGroup.element,
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

        // Strict Target Check
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
            draggedItem = draggedData.item._state.parentGroup;
            if (!draggedItem) return false;
            if (draggedItem._state.panels.length === 1) {
                isEffectiveGroupDrag = true;
            }
        }

        dds.showPlaceholder('horizontal', draggedItem.element.offsetHeight);

        const oldColumn = draggedItem.getColumn();
        const originalIndex = oldColumn ? oldColumn.getPanelGroupIndex(draggedItem) : -1;

        let placed = false;
        me._dropIndex = dropZone.getPanelGroups().length;

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
        const panelIndex = me._dropIndex;

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
            sourceGroup = draggedData.item._state.parentGroup;
        }

        if (sourceGroup && sourceGroup._state.isFloating) {
            if (draggedData.type === ItemType.PANEL_GROUP) {
                FloatingPanelManagerService.getInstance().removeFloatingPanel(sourceGroup);
            }
        }

        if (panelIndex === null) {
            const itemToUpdate =
                draggedData.type === ItemType.PANEL_GROUP
                    ? draggedData.item
                    : draggedData.item._state.parentGroup;

            if (itemToUpdate) {
                const oldColumn = itemToUpdate.getColumn();
                if (oldColumn) {
                    oldColumn.requestLayoutUpdate();
                }
            }
            return false;
        }

        if (draggedData.type === ItemType.PANEL_GROUP) {
            const draggedItem = draggedData.item;
            const oldColumn = draggedItem.getColumn();

            draggedItem._state.height = null;
            if (oldColumn) {
                oldColumn.removePanelGroup(draggedItem, true);
            }
            dropZone.addPanelGroup(draggedItem, panelIndex);
        } else if (draggedData.type === ItemType.PANEL) {
            const draggedPanel = draggedData.item;
            const sourceParentGroup = draggedPanel._state.parentGroup;

            const newPanelGroup = new PanelGroup();
            dropZone.addPanelGroup(newPanelGroup, panelIndex);

            if (sourceParentGroup) {
                sourceParentGroup.removePanel(draggedPanel, true);
            }
            newPanelGroup.addPanel(draggedPanel, true);
        }

        return true;
    }
}
