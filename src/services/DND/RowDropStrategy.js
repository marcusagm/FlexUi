import { PanelGroup } from '../../components/Panel/PanelGroup.js';
import { Panel } from '../../components/Panel/Panel.js';
import { DragDropService } from './DragDropService.js';
import { FloatingPanelManagerService } from './FloatingPanelManagerService.js';

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
 * - Uses "Live Geometry" in handleDragOver to handle layout shifts caused by the placeholder.
 * - Calculates drop index based on 'midX' (horizontal midpoint) of current columns.
 * - Shows a 'vertical' placeholder in the calculated gap.
 * - Implements "ghost" logic in real-time within handleDragOver to prevent
 * redundant drops (e.g., dropping the sole content of a column next to itself).
 * - Validates drop zone strictly: The target MUST be the row element itself
 * or the placeholder.
 * - On drop: Creates a new Column, creates a new PanelGroup inside it,
 * and moves the dropped Panel or PanelGroup into the new group.
 * - Returns boolean indicating if the drop was handled.
 *
 * Dependencies:
 * - ../../components/Panel/PanelGroup.js
 * - ../../components/Panel/Panel.js
 * - ./DragDropService.js
 */
export class RowDropStrategy {
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
        this._dropIndex = null;
    }

    /**
     * Setup initial state on drag enter.
     * Currently mostly a pass-through as logic is handled live in DragOver.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point - The coordinates and target.
     * @param {import('../../components/Row/Row.js').Row} dropZone - The Row instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDragEnter(point, dropZone, draggedData, dds) {
        this.clearCache();
    }

    /**
     * Hides the placeholder on drag leave.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point - The coordinates and target.
     * @param {import('../../components/Row/Row.js').Row} dropZone - The Row instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDragLeave(point, dropZone, draggedData, dds) {
        dds.hidePlaceholder();
        this.clearCache();
    }

    /**
     * Calculates the drop position and shows the placeholder on drag over using Live Geometry.
     * Contains logic to identify and block redundant moves (Ghost Logic).
     *
     * @param {{x: number, y: number, target: HTMLElement}} point - The coordinates and target.
     * @param {import('../../components/Row/Row.js').Row} dropZone - The Row instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDragOver(point, dropZone, draggedData, dds) {
        const me = this;
        const placeholder = dds.getPlaceholder();

        // Strict Target Check:
        // We only accept the drag if the pointer is directly over the Row element
        // or the Placeholder. If it is over a child (like a Column), we assume
        // that specific child's strategy should handle it.
        // We use 'contains' check but ensure we are not deep inside a child.
        // Actually, simply checking if target is dropZone or placeholder is safest for "gaps".
        if (point.target !== dropZone.element && point.target !== placeholder) {
            dds.hidePlaceholder();
            me._dropIndex = null;
            return;
        }

        if (
            !draggedData.item ||
            (draggedData.type !== 'PanelGroup' && draggedData.type !== 'Panel')
        ) {
            return;
        }

        // 1. Identify effective item (PanelGroup)
        let effectiveItem;
        if (draggedData.type === 'PanelGroup') {
            effectiveItem = draggedData.item;
        } else {
            effectiveItem = draggedData.item._state.parentGroup;
            if (!effectiveItem) return;
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
                if (draggedData.type === 'PanelGroup' && oldColumn.getTotalPanelGroups() === 1) {
                    // Dragging the only group of the column
                    isOriginSingle = true;
                } else if (
                    draggedData.type === 'Panel' &&
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
            return;
        }

        // 5. Render Placeholder
        dds.showPlaceholder('vertical');

        if (placed && targetElement) {
            // Live insert before the target element (column)
            if (dropZone.element.contains(targetElement)) {
                dropZone.element.insertBefore(placeholder, targetElement);
            }
        } else {
            // Append to end if no split point found
            dropZone.element.appendChild(placeholder);
        }
    }

    /**
     * Handles the drop logic for the Row (creates a new Column).
     *
     * @param {{x: number, y: number, target: HTMLElement}} point - The coordinates and target.
     * @param {import('../../components/Row/Row.js').Row} dropZone - The Row instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {DragDropService} dds - The DND service instance.
     * @returns {boolean} True if drop was handled; false if it should fall through.
     */
    handleDrop(point, dropZone, draggedData, dds) {
        const me = this;

        // Gatekeeper: If placeholder is not visible, drop is invalid.
        if (!dds.getPlaceholder().parentElement) {
            me.clearCache();
            return false;
        }

        const panelIndex = me._dropIndex;
        dds.hidePlaceholder();
        me.clearCache();

        if (
            !draggedData.item ||
            (draggedData.type !== 'PanelGroup' && draggedData.type !== 'Panel')
        ) {
            return false;
        }

        let sourceGroup = null;
        if (draggedData.type === 'PanelGroup') {
            sourceGroup = draggedData.item;
        } else if (draggedData.type === 'Panel') {
            sourceGroup = draggedData.item._state.parentGroup;
        }

        if (sourceGroup && sourceGroup._state.isFloating) {
            if (draggedData.type === 'PanelGroup') {
                FloatingPanelManagerService.getInstance().removeFloatingPanel(sourceGroup);
            }
        }

        if (panelIndex === null) {
            return false;
        }

        if (draggedData.type === 'PanelGroup') {
            const draggedItem = draggedData.item;
            const oldColumn = draggedItem.getColumn();

            const newColumn = dropZone.createColumn(null, panelIndex);

            if (oldColumn) {
                oldColumn.removePanelGroup(draggedItem, true);
            }
            draggedItem._state.height = null;
            newColumn.addPanelGroup(draggedItem);
        } else if (draggedData.type === 'Panel') {
            const draggedPanel = draggedData.item;
            const sourceGroup = draggedPanel._state.parentGroup;

            const newColumn = dropZone.createColumn(null, panelIndex);
            const newPanelGroup = new PanelGroup(null);
            newColumn.addPanelGroup(newPanelGroup);

            if (sourceGroup) {
                sourceGroup.removePanel(draggedPanel, true);
            }
            newPanelGroup.addPanel(draggedPanel, true);
        }

        return true;
    }
}
