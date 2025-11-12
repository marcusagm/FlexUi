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
 * - _columnCache {Array<object>} : Caches the geometry of child Columns.
 * - _dropIndex {number | null} : The calculated drop index (column index).
 * - _originalColumnIndex {number | null} : The starting column index (for "ghost" logic).
 * - _originColumnHadOnePanel {boolean} : Flag for "ghost" logic.
 *
 * Business rules implemented:
 * - Caches child Column geometry on 'handleDragEnter'.
 * - Calculates drop index based on 'midX' (horizontal midpoint).
 * - Shows a 'vertical' placeholder in the calculated gap.
 * - On drop: Creates a new Column, creates a new PanelGroup inside it,
 * and moves the dropped Panel or PanelGroup into the new group.
 *
 * Dependencies:
 * - ../../components/Panel/PanelGroup.js
 * - ../../components/Panel/Panel.js
 * - ./DragDropService.js
 */
export class RowDropStrategy {
    /**
     * Caches the geometry (midX) and index of child Columns.
     * @type {Array<{element: HTMLElement, midX: number, index: number}>}
     * @private
     */
    _columnCache = [];

    /**
     * The calculated drop index (state).
     * @type {number | null}
     * @private
     */
    _dropIndex = null;

    /**
     * The starting column index (for "ghost" logic).
     * @type {number | null}
     * @private
     */
    _originalColumnIndex = null;

    /**
     * Flag for "ghost" logic.
     * @type {boolean}
     * @private
     */
    _originColumnHadOnePanel = false;

    /**
     * Clears the internal geometry cache and drop index.
     * @returns {void}
     */
    clearCache() {
        this._columnCache = [];
        this._dropIndex = null;
        this._originalColumnIndex = null;
        this._originColumnHadOnePanel = false;
    }

    /**
     * Caches the geometry of child columns on drag enter.
     * @param {DragEvent} e - The native drag event.
     * @param {import('../../components/Row/Row.js').Row} dropZone - The Row instance.
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
        const columns = dropZone.getColumns();

        this._columnCache = columns.map((col, index) => {
            const rect = col.element.getBoundingClientRect();
            return {
                midX: rect.left + rect.width / 2,
                element: col.element,
                index: index
            };
        });

        const oldColumn = effectiveItem.getColumn();
        if (oldColumn) {
            const oldColCacheItem = this._columnCache.find(
                item => item.element === oldColumn.element
            );

            if (oldColCacheItem) {
                this._originalColumnIndex = oldColCacheItem.index;
                if (draggedData.type === 'PanelGroup' && oldColumn.getTotalPanelGroups() === 1) {
                    this._originColumnHadOnePanel = true;
                } else if (
                    draggedData.type === 'Panel' &&
                    effectiveItem._state.panels.length === 1
                ) {
                    this._originColumnHadOnePanel = true;
                }
            }
        }
    }

    /**
     * Hides the placeholder on drag leave.
     * @param {DragEvent} e - The native drag event.
     * @param {import('../../components/Row/Row.js').Row} dropZone - The Row instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDragLeave(e, dropZone, draggedData, dds) {
        if (
            e.relatedTarget &&
            ((dropZone.element.contains(e.relatedTarget) &&
                e.relatedTarget.classList.contains('container__placeholder')) ||
                e.relatedTarget.classList.contains('row'))
        ) {
            return;
        }
        dds.hidePlaceholder();
        this.clearCache();
    }

    /**
     * Calculates the drop position and shows the placeholder on drag over.
     * @param {DragEvent} e - The native drag event.
     * @param {import('../../components/Row/Row.js').Row} dropZone - The Row instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDragOver(e, dropZone, draggedData, dds) {
        const placeholder = dds.getPlaceholder();
        if (e.target !== dropZone.element && e.target !== placeholder) {
            dds.hidePlaceholder();
            this._dropIndex = null;
            return;
        }

        if (
            !draggedData.item ||
            (draggedData.type !== 'PanelGroup' && draggedData.type !== 'Panel')
        ) {
            return;
        }

        const mouseX = e.clientX;
        let gapFound = false;

        this._dropIndex = this._columnCache.length;
        for (const col of this._columnCache) {
            if (mouseX < col.midX) {
                this._dropIndex = col.index;
                gapFound = true;
                break;
            }
        }

        const isLeftGap = this._dropIndex === this._originalColumnIndex;
        const isRightGap = this._dropIndex === this._originalColumnIndex + 1;

        if (
            this._originalColumnIndex !== null &&
            this._originColumnHadOnePanel &&
            (isLeftGap || isRightGap)
        ) {
            dds.hidePlaceholder();
            this._dropIndex = null;
            return;
        }

        dds.showPlaceholder('vertical');

        if (gapFound) {
            const targetElement = this._columnCache.find(
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
     * Handles the drop logic for the Row (creates a new Column).
     * @param {DragEvent} e - The native drag event.
     * @param {import('../../components/Row/Row.js').Row} dropZone - The Row instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDrop(e, dropZone, draggedData, dds) {
        const panelIndex = this._dropIndex;
        dds.hidePlaceholder();
        this.clearCache();

        if (
            !draggedData.item ||
            (draggedData.type !== 'PanelGroup' && draggedData.type !== 'Panel')
        ) {
            return;
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
            return;
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
                sourceGroup.removePanel(draggedPanel);
            }
            newPanelGroup.addPanel(draggedPanel, true);
        }
    }
}
