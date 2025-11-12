import { PanelGroup } from '../../components/Panel/PanelGroup.js';
import { Panel } from '../../components/Panel/Panel.js';
import { DragDropService } from './DragDropService.js';
import { FloatingPanelManagerService } from './FloatingPanelManagerService.js';

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
 * - Caches child PanelGroup geometry on 'handleDragEnter'.
 * - Calculates drop index based on 'midY' (vertical midpoint).
 * - Shows a 'horizontal' placeholder in the calculated gap.
 * - Implements "ghost" logic to prevent flickering when dragging over
 * its own original position.
 * - On drop (PanelGroup): Moves the group to the new index.
 * - On drop (Panel): Creates a new PanelGroup wrapper at the index
 * and moves the Panel into it.
 *
 * Dependencies:
 * - ../../components/Panel/PanelGroup.js
 * - ../../components/Panel/Panel.js
 * - ./DragDropService.js
 */
export class ColumnDropStrategy {
    /**
     * Caches the geometry (midY) and index of child PanelGroups.
     * @type {Array<{element: HTMLElement, midY: number, originalIndex: number}>}
     * @private
     */
    _dropZoneCache = [];

    /**
     * The calculated drop index (state).
     * @type {number | null}
     * @private
     */
    _dropIndex = null;

    /**
     * Clears the internal geometry cache and drop index.
     * @returns {void}
     */
    clearCache() {
        this._dropZoneCache = [];
        this._dropIndex = null;
    }

    /**
     * Caches the geometry of child panel groups on drag enter.
     * @param {DragEvent} e - The native drag event.
     * @param {import('../../components/Column/Column.js').Column} dropZone - The Column instance.
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

        let draggedItem;
        if (draggedData.type === 'PanelGroup') {
            draggedItem = draggedData.item;
        } else if (draggedData.type === 'Panel') {
            draggedItem = draggedData.item._state.parentGroup;
            if (!draggedItem) return;
        }

        this.clearCache();
        const panelGroups = dropZone.getPanelGroups();

        for (let i = 0; i < panelGroups.length; i++) {
            const targetGroup = panelGroups[i];
            if (draggedItem === targetGroup) continue;

            const rect = targetGroup.element.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;

            this._dropZoneCache.push({
                element: targetGroup.element,
                midY: midY,
                originalIndex: i
            });
        }
    }

    /**
     * Calculates the drop position and shows the placeholder on drag over.
     * @param {DragEvent} e - The native drag event.
     * @param {import('../../components/Column/Column.js').Column} dropZone - The Column instance.
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

        let draggedItem;
        let isEffectiveGroupDrag = false;

        if (draggedData.type === 'PanelGroup') {
            draggedItem = draggedData.item;
            isEffectiveGroupDrag = true;
        } else if (draggedData.type === 'Panel') {
            draggedItem = draggedData.item._state.parentGroup;
            if (!draggedItem) return;
            if (draggedItem._state.panels.length === 1) {
                isEffectiveGroupDrag = true;
            }
        }

        dds.showPlaceholder('horizontal', draggedItem.element.offsetHeight);

        const oldColumn = draggedItem.getColumn();
        const originalIndex = oldColumn ? oldColumn.getPanelGroupIndex(draggedItem) : -1;

        let placed = false;
        this._dropIndex = dropZone.getPanelGroups().length;

        for (const cacheItem of this._dropZoneCache) {
            if (e.clientY < cacheItem.midY) {
                dropZone.element.insertBefore(placeholder, cacheItem.element);
                placed = true;
                this._dropIndex = cacheItem.originalIndex;
                break;
            }
        }

        if (!placed) {
            dropZone.element.appendChild(placeholder);
        }

        const isSameColumn = oldColumn === dropZone;
        const isOriginalPosition = this._dropIndex === originalIndex;
        const isBelowGhost = this._dropIndex === originalIndex + 1;

        if (isSameColumn && isEffectiveGroupDrag && (isOriginalPosition || isBelowGhost)) {
            dds.hidePlaceholder();
            this._dropIndex = null;
        }
    }

    /**
     * Hides the placeholder on drag leave.
     * @param {DragEvent} e - The native drag event.
     * @param {import('../../components/Column/Column.js').Column} dropZone - The Column instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDragLeave(e, dropZone, draggedData, dds) {
        if (
            e.relatedTarget &&
            ((dropZone.element.contains(e.relatedTarget) &&
                e.relatedTarget.classList.contains('container__placeholder')) ||
                e.relatedTarget.classList.contains('column'))
        ) {
            return;
        }
        dds.hidePlaceholder();
        this.clearCache();
    }

    /**
     * Handles the drop logic for the Column.
     * @param {DragEvent} e - The native drag event.
     * @param {import('../../components/Column/Column.js').Column} dropZone - The Column instance.
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
            const itemToUpdate =
                draggedData.type === 'PanelGroup'
                    ? draggedData.item
                    : draggedData.item._state.parentGroup;

            if (itemToUpdate) {
                const oldColumn = itemToUpdate.getColumn();
                if (oldColumn) {
                    oldColumn.requestLayoutUpdate();
                }
            }
            return;
        }

        if (draggedData.type === 'PanelGroup') {
            const draggedItem = draggedData.item;
            const oldColumn = draggedItem.getColumn();

            draggedItem._state.height = null;
            if (oldColumn) {
                oldColumn.removePanelGroup(draggedItem, true);
            }
            dropZone.addPanelGroup(draggedItem, panelIndex);
        } else if (draggedData.type === 'Panel') {
            const draggedPanel = draggedData.item;
            const sourceGroup = draggedPanel._state.parentGroup;

            const newPanelGroup = new PanelGroup();
            dropZone.addPanelGroup(newPanelGroup, panelIndex);

            if (sourceGroup) {
                sourceGroup.removePanel(draggedPanel);
            }
            newPanelGroup.addPanel(draggedPanel, true);
        }
    }
}
