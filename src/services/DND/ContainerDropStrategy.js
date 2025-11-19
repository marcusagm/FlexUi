import { BaseDropStrategy } from './BaseDropStrategy.js';
import { Row } from '../../components/Row/Row.js';
import { PanelGroup } from '../../components/Panel/PanelGroup.js';
import { FloatingPanelManagerService } from './FloatingPanelManagerService.js';
import { ItemType } from '../../constants/DNDTypes.js';

/**
 * Description:
 * A DND strategy that defines drop behavior for 'container' type drop zones.
 * It handles dropping panels into the vertical gaps *between* Rows,
 * creating a new Row for the dropped item.
 *
 * Properties summary:
 * - _rowCache {Array<object>} : Caches the geometry of child Rows.
 * - _dropIndex {number | null} : The calculated drop index (row index).
 * - _originalRowIndex {number | null} : The starting row index (for "ghost" logic).
 * - _originRowHadOneColumn {boolean} : Flag for "ghost" logic.
 *
 * Business rules implemented:
 * - Caches child Row geometry on 'onDragEnter'.
 * - Calculates drop index based on 'midY' (vertical midpoint).
 * - Shows a 'horizontal' placeholder in the calculated gap.
 * - Validates drop zone strictly: The target MUST be the container element itself
 * or the placeholder. Hovering over children (Rows) is considered an invalid
 * drop for the Container (allowing specific Row strategies or Undock to take over).
 * - On drop: Creates a new Row, creates a new Column inside it,
 * and moves the dropped Panel or PanelGroup into the new Column.
 *
 * Dependencies:
 * - {import('./BaseDropStrategy.js').BaseDropStrategy}
 * - {import('../../components/Panel/PanelGroup.js').PanelGroup}
 * - {import('../../components/Row/Row.js').Row}
 * - {import('./FloatingPanelManagerService.js').FloatingPanelManagerService}
 * - {import('../../constants/DNDTypes.js').ItemType}
 */
export class ContainerDropStrategy extends BaseDropStrategy {
    /**
     * Caches the geometry (midY) and index of child Rows.
     *
     * @type {Array<{element: HTMLElement, midY: number, index: number}>}
     * @private
     */
    _rowCache = [];

    /**
     * The calculated drop index (state).
     *
     * @type {number | null}
     * @private
     */
    _dropIndex = null;

    /**
     * The starting row index (for "ghost" logic).
     *
     * @type {number | null}
     * @private
     */
    _originalRowIndex = null;

    /**
     * Flag for "ghost" logic.
     *
     * @type {boolean}
     * @private
     */
    _originRowHadOneColumn = false;

    /**
     * Clears the internal geometry cache and resets the drop index.
     *
     * @returns {void}
     */
    clearCache() {
        const me = this;
        me._rowCache = [];
        me._dropIndex = null;
        me._originalRowIndex = null;
        me._originRowHadOneColumn = false;
    }

    /**
     * Hook called when a drag enters the zone.
     * Caches the geometry of child rows.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Container/Container.js').Container} dropZone
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

        let effectiveItem;
        if (draggedData.type === ItemType.PANEL_GROUP) {
            effectiveItem = draggedData.item;
        } else {
            effectiveItem = draggedData.item.parentGroup;
            if (!effectiveItem) return false;
        }

        me.clearCache();
        me._dropIndex = null;
        const rows = dropZone.getRows();

        me._rowCache = rows.map((row, index) => {
            const rect = row.element.getBoundingClientRect();
            return {
                midY: rect.top + rect.height / 2,
                element: row.element,
                index: index
            };
        });

        const oldColumn = effectiveItem.getColumn();
        if (oldColumn) {
            const oldRow = oldColumn.parentContainer;
            if (oldRow && oldRow instanceof Row) {
                const oldRowCacheItem = me._rowCache.find(item => item.element === oldRow.element);

                if (oldRowCacheItem) {
                    me._originalRowIndex = oldRowCacheItem.index;
                    if (oldRow.getTotalColumns() === 1) {
                        if (
                            draggedData.type === ItemType.PANEL_GROUP &&
                            oldColumn.getTotalPanelGroups() === 1
                        ) {
                            me._originRowHadOneColumn = true;
                        } else if (
                            draggedData.type === ItemType.PANEL &&
                            effectiveItem.panels.length === 1
                        ) {
                            me._originRowHadOneColumn = true;
                        }
                    }
                }
            }
        }
        return true;
    }

    /**
     * Hook called when a drag moves over the zone.
     * Calculates the drop position and shows the placeholder.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Container/Container.js').Container} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDragOver(point, dropZone, draggedData, dds) {
        const me = this;
        const placeholder = dds.getPlaceholder();

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

        let effectiveItem;
        if (draggedData.type === ItemType.PANEL_GROUP) {
            effectiveItem = draggedData.item;
        } else {
            effectiveItem = draggedData.item.parentGroup;
            if (!effectiveItem) return false;
        }

        if (me._rowCache.length === 0 && dropZone.getRows().length > 0) {
            me.onDragEnter(point, dropZone, draggedData, dds);
        }

        const mouseY = point.y;
        let gapFound = false;

        me._dropIndex = me._rowCache.length;
        for (const row of me._rowCache) {
            if (mouseY < row.midY) {
                me._dropIndex = row.index;
                gapFound = true;
                break;
            }
        }

        const isTopGap = me._dropIndex === me._originalRowIndex;
        const isBottomGap = me._dropIndex === me._originalRowIndex + 1;

        if (
            me._originalRowIndex !== null &&
            me._originRowHadOneColumn &&
            (isTopGap || isBottomGap)
        ) {
            dds.hidePlaceholder();
            me._dropIndex = null;
            return false;
        }

        dds.showPlaceholder('horizontal', effectiveItem.element.offsetHeight);

        if (gapFound) {
            const targetElement = me._rowCache.find(item => item.index === me._dropIndex)?.element;

            if (targetElement && dropZone.element.contains(targetElement)) {
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
     * Creates a new Row/Column/PanelGroup structure.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Container/Container.js').Container} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDrop(point, dropZone, draggedData, dds) {
        const me = this;
        const rowIndex = me._dropIndex;

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

        if (rowIndex === null) {
            return false;
        }

        if (draggedData.type === ItemType.PANEL_GROUP) {
            const draggedItem = draggedData.item;
            const oldColumn = draggedItem.getColumn();

            const newRow = dropZone.createRow(null, rowIndex);
            const newColumn = newRow.createColumn();

            if (oldColumn) {
                oldColumn.removePanelGroup(draggedItem, true);
            }
            draggedItem.height = null;
            newColumn.addPanelGroup(draggedItem);
        } else if (draggedData.type === ItemType.PANEL) {
            const draggedPanel = draggedData.item;
            const sourceParentGroup = draggedPanel.parentGroup;

            const newRow = dropZone.createRow(null, rowIndex);
            const newColumn = newRow.createColumn();
            const newPanelGroup = new PanelGroup(null);
            newColumn.addPanelGroup(newPanelGroup);

            if (sourceParentGroup) {
                sourceParentGroup.removePanel(draggedPanel, true);
            }
            draggedPanel.height = null;
            newPanelGroup.addPanel(draggedPanel, true);
        }

        return true;
    }
}
