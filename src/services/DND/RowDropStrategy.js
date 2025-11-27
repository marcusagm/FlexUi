import { BaseDropStrategy } from './BaseDropStrategy.js';
import { PanelGroup } from '../../components/Panel/PanelGroup.js';
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
 * - Validates drop zone strictly: The target MUST be inside the row element.
 * - On drop: Creates a new Column, creates a new PanelGroup inside it (or adds existing),
 * and moves the dropped Panel or PanelGroup into the new Column.
 * - Supports the new Column API (addChild, removeChild, getChildCount).
 *
 * Dependencies:
 * - {import('./BaseDropStrategy.js').BaseDropStrategy}
 * - {import('../../components/Panel/PanelGroup.js').PanelGroup}
 * - {import('../../components/Panel/Panel.js').Panel}
 * - {import('./FloatingPanelManagerService.js').FloatingPanelManagerService}
 * - {import('../../constants/DNDTypes.js').ItemType}
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
        dds;
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

        if (!dropZone.element.contains(point.target)) {
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

        let effectiveItem;
        if (draggedData.type === ItemType.PANEL_GROUP) {
            effectiveItem = draggedData.item;
        } else {
            effectiveItem = draggedData.item.parentGroup;
            if (!effectiveItem) return false;
        }

        let originalColumnIndex = -1;
        let isOriginSingle = false;

        const oldColumn =
            typeof effectiveItem.getColumn === 'function' ? effectiveItem.getColumn() : null;
        const columns = dropZone.getColumns();

        if (oldColumn && oldColumn.parentContainer === dropZone) {
            originalColumnIndex = columns.indexOf(oldColumn);

            if (originalColumnIndex !== -1) {
                const childCount = oldColumn.getChildCount();

                if (draggedData.type === ItemType.PANEL_GROUP && childCount === 1) {
                    isOriginSingle = true;
                } else if (
                    draggedData.type === ItemType.PANEL &&
                    effectiveItem.panels.length === 1 &&
                    childCount === 1
                ) {
                    isOriginSingle = true;
                }
            }
        }

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

        const isLeftGap = me._dropIndex === originalColumnIndex;
        const isRightGap = me._dropIndex === originalColumnIndex + 1;

        if (isOriginSingle && (isLeftGap || isRightGap)) {
            dds.hidePlaceholder();
            me._dropIndex = null;
            return false;
        }

        dds.showPlaceholder('vertical');

        if (placed && targetElement) {
            if (dropZone.element.contains(targetElement)) {
                dropZone.element.insertBefore(placeholder, targetElement);
            } else {
                dropZone.element.appendChild(placeholder);
            }
        } else {
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
        dds;
        const me = this;
        const initialPanelIndex = me._dropIndex;

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

        if (sourceGroup && sourceGroup.isFloating) {
            if (draggedData.type === ItemType.PANEL_GROUP) {
                FloatingPanelManagerService.getInstance().removeFloatingPanel(sourceGroup);
            }
        }

        if (initialPanelIndex === null) {
            return false;
        }

        if (draggedData.type === ItemType.PANEL_GROUP) {
            const draggedItem = draggedData.item;
            const oldColumn =
                typeof draggedItem.getColumn === 'function' ? draggedItem.getColumn() : null;

            const newColumn = dropZone.createColumn(null, initialPanelIndex);

            if (oldColumn) {
                oldColumn.removeChild(draggedItem, true);
            }
            draggedItem.height = null;

            newColumn.addChild(draggedItem);
        } else if (draggedData.type === ItemType.PANEL) {
            const draggedPanel = draggedData.item;
            const sourceParentGroup = draggedPanel.parentGroup;

            const newColumn = dropZone.createColumn(null, initialPanelIndex);
            const newPanelGroup = new PanelGroup(null);

            newColumn.addChild(newPanelGroup);

            if (sourceParentGroup) {
                sourceParentGroup.removePanel(draggedPanel, true);
            }
            draggedPanel.height = null;
            newPanelGroup.addPanel(draggedPanel, true);
        }

        return true;
    }
}
