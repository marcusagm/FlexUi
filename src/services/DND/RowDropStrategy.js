import { BaseDropStrategy } from './BaseDropStrategy.js';
import { PanelGroup } from '../../components/Panel/PanelGroup.js';
import { Panel } from '../../components/Panel/Panel.js';
import { FloatingPanelManagerService } from './FloatingPanelManagerService.js';
import { ItemType } from '../../constants/DNDTypes.js';

/**
 * Description:
 * A DND strategy that defines drop behavior for 'row' type drop zones.
 * It handles dropping panels into the horizontal gaps *between* Columns,
 * creating a new Column for the dropped item.
 *
 * Properties summary:
 * - _dropIndex {number | null} : The calculated drop index (column index).
 *
 * Business rules implemented:
 * - Uses "Live Geometry" in onDragOver to handle layout shifts caused by the placeholder.
 * - Calculates drop index based on 'midX' (horizontal midpoint) of current columns.
 * - Shows a 'vertical' placeholder in the calculated gap.
 * - Implements "ghost" logic in real-time within onDragOver to prevent
 * redundant drops (e.g., dropping the sole content of a column next to itself).
 * - Validates drop zone strictly: The target MUST be the row element itself
 * or the placeholder.
 * - On drop: Creates a new Column, creates a new PanelGroup inside it,
 * and moves the dropped Panel or PanelGroup into the new group.
 *
 * Dependencies:
 * - ./BaseDropStrategy.js
 * - ../../components/Panel/PanelGroup.js
 * - ../../components/Panel/Panel.js
 * - ./FloatingPanelManagerService.js
 * - ../../constants/DNDTypes.js
 */
export class RowDropStrategy extends BaseDropStrategy {
    /**
     * The calculated drop index (state).
     *
     * @type {number | null}
     * @private
     */
    _dropIndex = null;

    /**
     * Clears the internal state and drop index.
     *
     * @returns {void}
     */
    clearCache() {
        const me = this;
        me._dropIndex = null;
    }

    /**
     * Hook called when a drag enters the zone.
     * Sets up initial state and validates the item type.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Row/Row.js').Row} dropZone
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

        me.clearCache();
        return true;
    }

    /**
     * Hook called when a drag moves over the zone.
     * Calculates the drop position using Live Geometry and handles Ghost logic.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Row/Row.js').Row} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDragOver(point, dropZone, draggedData, dds) {
        const me = this;
        const placeholder = dds.getPlaceholder();

        // Strict Target Check:
        // We only accept the drag if the pointer is directly over the Row element
        // or the Placeholder. If it is over a child (like a Column), we assume
        // that specific child's strategy should handle it.
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

        // 1. Identify effective item (PanelGroup)
        let effectiveItem;
        if (draggedData.type === ItemType.PANEL_GROUP) {
            effectiveItem = draggedData.item;
        } else {
            effectiveItem = draggedData.item._state.parentGroup;
            if (!effectiveItem) return false;
        }

        // 2. Calculate Source State (Live)
        // This determines if the item being dragged is the ONLY content of its current column.
        let originalColumnIndex = -1;
        let isOriginSingle = false;

        const oldColumn = effectiveItem.getColumn();
        const columns = dropZone.getColumns();

        if (oldColumn && oldColumn._state.parentContainer === dropZone) {
            originalColumnIndex = columns.indexOf(oldColumn);

            if (originalColumnIndex !== -1) {
                if (
                    draggedData.type === ItemType.PANEL_GROUP &&
                    oldColumn.getTotalPanelGroups() === 1
                ) {
                    // Dragging the only group of the column
                    isOriginSingle = true;
                } else if (
                    draggedData.type === ItemType.PANEL &&
                    effectiveItem._state.panels.length === 1 && // Group has 1 panel
                    oldColumn.getTotalPanelGroups() === 1 // Column has 1 group
                ) {
                    // Dragging the only panel of the only group of the column
                    isOriginSingle = true;
                }
            }
        }

        // 3. Live Geometry Calculation for Drop Index
        const mouseX = point.x;
        let targetElement = null;
        let placed = false;
        me._dropIndex = columns.length;

        for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            const rect = col.element.getBoundingClientRect();
            const midX = rect.left + rect.width / 2;

            if (mouseX < midX) {
                me._dropIndex = i;
                targetElement = col.element;
                placed = true;
                break;
            }
        }

        // 4. Ghost Logic (Block redundant drops)
        const isLeftGap = me._dropIndex === originalColumnIndex;
        const isRightGap = me._dropIndex === originalColumnIndex + 1;

        if (isOriginSingle && (isLeftGap || isRightGap)) {
            dds.hidePlaceholder();
            me._dropIndex = null;
            return false;
        }

        // 5. Render Placeholder
        dds.showPlaceholder('vertical');

        if (placed && targetElement) {
            // Live insert before the target element (column)
            if (dropZone.element.contains(targetElement)) {
                dropZone.element.insertBefore(placeholder, targetElement);
            } else {
                dropZone.element.appendChild(placeholder);
            }
        } else {
            // Append to end if no split point found
            dropZone.element.appendChild(placeholder);
        }

        return true;
    }

    /**
     * Hook called when the item is dropped.
     * Creates a new Column/PanelGroup and moves the item.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Row/Row.js').Row} dropZone
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

        // Handle floating panel removal
        if (sourceGroup && sourceGroup._state.isFloating) {
            if (draggedData.type === ItemType.PANEL_GROUP) {
                FloatingPanelManagerService.getInstance().removeFloatingPanel(sourceGroup);
            }
        }

        if (panelIndex === null) {
            return false;
        }

        if (draggedData.type === ItemType.PANEL_GROUP) {
            const draggedItem = draggedData.item;
            const oldColumn = draggedItem.getColumn();

            const newColumn = dropZone.createColumn(null, panelIndex);

            if (oldColumn) {
                oldColumn.removePanelGroup(draggedItem, true);
            }
            draggedItem._state.height = null;
            newColumn.addPanelGroup(draggedItem);
        } else if (draggedData.type === ItemType.PANEL) {
            const draggedPanel = draggedData.item;
            const sourceParentGroup = draggedPanel._state.parentGroup;

            const newColumn = dropZone.createColumn(null, panelIndex);
            const newPanelGroup = new PanelGroup(null);
            newColumn.addPanelGroup(newPanelGroup);

            if (sourceParentGroup) {
                sourceParentGroup.removePanel(draggedPanel, true);
            }
            newPanelGroup.addPanel(draggedPanel, true);
        }

        return true;
    }
}
