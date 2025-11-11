import { PanelGroup } from '../../components/Panel/PanelGroup.js';
import { Row } from '../../components/Row/Row.js';
import { Panel } from '../../components/Panel/Panel.js';
import { DragDropService } from './DragDropService.js';

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
 * - Caches child Row geometry on 'handleDragEnter'.
 * - Calculates drop index based on 'midY' (vertical midpoint).
 * - Shows a 'horizontal' placeholder in the calculated gap.
 * - On drop: Creates a new Row, creates a new Column inside it,
 * and moves the dropped Panel or PanelGroup into the new Column.
 *
 * Dependencies:
 * - ../../components/Panel/PanelGroup.js
 * - ../../components/Row/Row.js
 * - ../../components/Panel/Panel.js
 * - ./DragDropService.js
 */
export class ContainerDropStrategy {
    /**
     * Caches the geometry (midY) and index of child Rows.
     * @type {Array<{element: HTMLElement, midY: number, index: number}>}
     * @private
     */
    _rowCache = [];

    /**
     * The calculated drop index (state).
     * @type {number | null}
     * @private
     */
    _dropIndex = null;

    /**
     * The starting row index (for "ghost" logic).
     * @type {number | null}
     * @private
     */
    _originalRowIndex = null;

    /**
     * Flag for "ghost" logic.
     * @type {boolean}
     * @private
     */
    _originRowHadOneColumn = false;

    /**
     * Clears the internal geometry cache and drop index.
     * @returns {void}
     */
    clearCache() {
        this._rowCache = [];
        this._dropIndex = null;
        this._originalRowIndex = null;
        this._originRowHadOneColumn = false;
    }

    /**
     * Caches the geometry of child rows on drag enter.
     * @param {DragEvent} e - The native drag event.
     * @param {import('../../components/Container/Container.js').Container} dropZone - The Container instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDragEnter(e, dropZone, draggedData, dds) {
        if (
            !draggedData.item ||
            (draggedData.type !== 'PanelGroup' && draggedData.type !== 'Panel')
        ) {
            return;
        }

        let effectiveItem;
        if (draggedData.type === 'PanelGroup') {
            effectiveItem = draggedData.item;
        } else {
            effectiveItem = draggedData.item._state.parentGroup;
            if (!effectiveItem) return;
        }

        this.clearCache();
        const rows = dropZone.getRows();

        this._rowCache = rows.map((row, index) => {
            const rect = row.element.getBoundingClientRect();
            return {
                midY: rect.top + rect.height / 2,
                element: row.element,
                index: index
            };
        });

        const oldColumn = effectiveItem.getColumn();
        if (oldColumn) {
            const oldRow = oldColumn._state.parentContainer;
            if (oldRow && oldRow instanceof Row) {
                const oldRowCacheItem = this._rowCache.find(
                    item => item.element === oldRow.element
                );

                if (oldRowCacheItem) {
                    this._originalRowIndex = oldRowCacheItem.index;
                    if (oldRow.getTotalColumns() === 1) {
                        if (
                            draggedData.type === 'PanelGroup' &&
                            oldColumn.getTotalPanelGroups() === 1
                        ) {
                            this._originRowHadOneColumn = true;
                        } else if (
                            draggedData.type === 'Panel' &&
                            effectiveItem._state.panels.length === 1
                        ) {
                            this._originRowHadOneColumn = true;
                        }
                    }
                }
            }
        }
    }

    /**
     * Hides the placeholder on drag leave.
     * @param {DragEvent} e - The native drag event.
     * @param {import('../../components/Container/Container.js').Container} dropZone - The Container instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDragLeave(e, dropZone, draggedData, dds) {
        if (e.relatedTarget && dropZone.element.contains(e.relatedTarget)) {
            return;
        }
        dds.hidePlaceholder();
        this.clearCache();
    }

    /**
     * Calculates the drop position and shows the placeholder on drag over.
     * @param {DragEvent} e - The native drag event.
     * @param {import('../../components/Container/Container.js').Container} dropZone - The Container instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDragOver(e, dropZone, draggedData, dds) {
        if (
            !draggedData.item ||
            (draggedData.type !== 'PanelGroup' && draggedData.type !== 'Panel')
        ) {
            return;
        }

        let effectiveItem;
        if (draggedData.type === 'PanelGroup') {
            effectiveItem = draggedData.item;
        } else {
            effectiveItem = draggedData.item._state.parentGroup;
            if (!effectiveItem) return;
        }

        if (this._rowCache.length === 0 && dropZone.getRows().length > 0) {
            this.handleDragEnter(e, dropZone, draggedData, dds);
        }

        const mouseY = e.clientY;
        let gapFound = false;

        this._dropIndex = this._rowCache.length;
        for (const row of this._rowCache) {
            if (mouseY < row.midY) {
                this._dropIndex = row.index;
                gapFound = true;
                break;
            }
        }

        const isTopGap = this._dropIndex === this._originalRowIndex;
        const isBottomGap = this._dropIndex === this._originalRowIndex + 1;

        if (
            this._originalRowIndex !== null &&
            this._originRowHadOneColumn &&
            (isTopGap || isBottomGap)
        ) {
            dds.hidePlaceholder();
            this._dropIndex = null;
            return;
        }

        dds.showPlaceholder('horizontal', effectiveItem.element.offsetHeight);
        const placeholder = dds.getPlaceholder();

        if (gapFound) {
            const targetElement = this._rowCache.find(
                item => item.index === this._dropIndex
            )?.element;

            if (targetElement && dropZone.element.contains(targetElement)) {
                dropZone.element.insertBefore(placeholder, targetElement);
            }
        } else {
            dropZone.element.appendChild(placeholder);
        }
    }

    /**
     * Handles the drop logic for the Container (creates a new Row).
     * @param {DragEvent} e - The native drag event.
     * @param {import('../../components/Container/Container.js').Container} dropZone - The Container instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDrop(e, dropZone, draggedData, dds) {
        const rowIndex = this._dropIndex;
        dds.hidePlaceholder();
        this.clearCache();

        if (
            !draggedData.item ||
            (draggedData.type !== 'PanelGroup' && draggedData.type !== 'Panel')
        ) {
            return;
        }

        if (rowIndex === null) {
            return;
        }

        if (draggedData.type === 'PanelGroup') {
            const draggedItem = draggedData.item;
            const oldColumn = draggedItem.getColumn();

            const newRow = dropZone.createRow(null, rowIndex);
            const newColumn = newRow.createColumn();

            if (oldColumn) {
                oldColumn.removePanelGroup(draggedItem, true);
            }
            draggedItem._state.height = null;
            newColumn.addPanelGroup(draggedItem);
        } else if (draggedData.type === 'Panel') {
            const draggedPanel = draggedData.item;
            const sourceGroup = draggedPanel._state.parentGroup;

            const newRow = dropZone.createRow(null, rowIndex);
            const newColumn = newRow.createColumn();
            const newPanelGroup = new PanelGroup(null);
            newColumn.addPanelGroup(newPanelGroup);

            if (sourceGroup) {
                sourceGroup.removePanel(draggedPanel);
            }
            draggedPanel._state.height = null;
            newPanelGroup.addPanel(draggedPanel, true);
        }
    }
}
