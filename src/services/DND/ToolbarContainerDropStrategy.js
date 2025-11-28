import { BaseDropStrategy } from './BaseDropStrategy.js';
import { FastDOM } from '../../utils/FastDOM.js';
import { ItemType } from '../../constants/DNDTypes.js';

/**
 * Description:
 * A DND strategy that defines drop behavior for 'toolbar-container' type drop zones.
 * It handles rearranging ToolbarGroups within a ToolbarContainer, or moving them
 * between different ToolbarContainers (e.g., from 'top' to 'left').
 *
 * Properties summary:
 * - _dropZoneCache {Array<object>} : Caches geometry of child ToolbarGroups.
 * - _dropIndex {number | null} : The calculated drop index.
 * - _originalIndex {number | null} : The starting index (for "ghost" logic).
 * - _sourceContainer {ToolbarContainer | null} : The container where the drag originated.
 * - _orientation {'horizontal' | 'vertical'} : The orientation of the current drop zone.
 *
 * Business rules implemented:
 * - Caches child ToolbarGroup geometry on 'onDragEnter'.
 * - Calculates drop index based on 'midX' (horizontal) or 'midY' (vertical).
 * - Shows a 'vertical' (if H) or 'horizontal' (if V) placeholder.
 * - Implements "ghost" logic to prevent dropping adjacent to the start position.
 * - Returns false on drop if the placeholder is not active (enables undock fallback).
 *
 * Dependencies:
 * - {import('./BaseDropStrategy.js').BaseDropStrategy}
 * - {import('../../components/Toolbar/ToolbarGroup.js').ToolbarGroup}
 * - {import('../../components/Toolbar/ToolbarContainer.js').ToolbarContainer}
 * - {import('../../constants/DNDTypes.js').ItemType}
 */
export class ToolbarContainerDropStrategy extends BaseDropStrategy {
    /**
     * Caches the geometry (midX/midY) and index of child ToolbarGroups.
     *
     * @type {Array<{element: HTMLElement, mid: number, index: number}>}
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
     * The starting state index (for "ghost" logic).
     *
     * @type {number | null}
     * @private
     */
    _originalIndex = null;

    /**
     * The container where the drag originated.
     *
     * @type {import('../../components/Toolbar/ToolbarContainer.js').ToolbarContainer | null}
     * @private
     */
    _sourceContainer = null;

    /**
     * The orientation of the current drop zone.
     *
     * @type {'horizontal' | 'vertical'}
     * @private
     */
    _orientation = 'horizontal';

    /**
     * Clears the internal geometry cache and drop index.
     *
     * @returns {void}
     */
    clearCache() {
        const me = this;
        me._dropZoneCache = [];
        me._dropIndex = null;
        me._originalIndex = null;
        me._sourceContainer = null;
        me._orientation = 'horizontal';
    }

    /**
     * Hook called when a drag enters the zone.
     * Caches the geometry of child groups.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Toolbar/ToolbarContainer.js').ToolbarContainer} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDragEnter(point, dropZone, draggedData, dds) {
        const me = this;
        if (!draggedData.item || draggedData.type !== ItemType.TOOLBAR_GROUP) {
            return false;
        }

        me.clearCache();
        const draggedItem = draggedData.item;

        me._sourceContainer = draggedItem.parentContainer;
        me._orientation = dropZone.orientation;

        const groups = dropZone.groups;

        groups.forEach((group, index) => {
            const rect = group.element.getBoundingClientRect();
            let mid;
            if (me._orientation === 'horizontal') {
                mid = rect.left + rect.width / 2;
            } else {
                mid = rect.top + rect.height / 2;
            }

            me._dropZoneCache.push({
                element: group.element,
                mid: mid,
                index: index
            });
        });

        if (me._sourceContainer === dropZone) {
            me._originalIndex = groups.indexOf(draggedItem);
        }

        return true;
    }

    /**
     * Hook called when a drag moves over the zone.
     * Calculates the drop position and shows the placeholder.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Toolbar/ToolbarContainer.js').ToolbarContainer} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDragOver(point, dropZone, draggedData, dds) {
        const me = this;

        if (draggedData.type !== ItemType.TOOLBAR_GROUP) {
            dds.hidePlaceholder();
            return false;
        }

        if (me._dropZoneCache.length === 0 && dropZone.groups.length > 0) {
            me.onDragEnter(point, dropZone, draggedData, dds);
        }

        const scrollContainer = dropZone.scrollContainer;

        if (!dropZone.element.contains(point.target)) {
            dds.hidePlaceholder();
            return false;
        }

        const clientPos = me._orientation === 'horizontal' ? point.x : point.y;
        let gapFound = false;

        me._dropIndex = me._dropZoneCache.length;
        for (const group of me._dropZoneCache) {
            if (clientPos < group.mid) {
                me._dropIndex = group.index;
                gapFound = true;
                break;
            }
        }

        const isSameContainer = me._sourceContainer === dropZone;
        const isLeftGap = me._dropIndex === me._originalIndex;
        const isRightGap = me._dropIndex === me._originalIndex + 1;

        if (isSameContainer && (isLeftGap || isRightGap)) {
            dds.hidePlaceholder();
            me._dropIndex = null;
            return false;
        }

        const placeholderMode = me._orientation === 'horizontal' ? 'vertical' : 'horizontal';
        const placeholder = dds.getPlaceholder();
        dds.showPlaceholder(placeholderMode);

        if (gapFound) {
            const targetElement = me._dropZoneCache.find(
                item => item.index === me._dropIndex
            )?.element;

            if (targetElement && scrollContainer.contains(targetElement)) {
                scrollContainer.insertBefore(placeholder, targetElement);
            } else {
                scrollContainer.appendChild(placeholder);
            }
        } else {
            scrollContainer.appendChild(placeholder);
        }

        return true;
    }

    /**
     * Hook called when the item is dropped.
     * Moves the ToolbarGroup to the new container/index.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Toolbar/ToolbarContainer.js').ToolbarContainer} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDrop(point, dropZone, draggedData, dds) {
        const me = this;
        const dropIndex = me._dropIndex;
        const targetContainer = dropZone;
        const draggedItem = draggedData.item;

        const sourceContainer = me._sourceContainer || draggedItem.parentContainer;

        if (draggedData.type !== ItemType.TOOLBAR_GROUP || dropIndex === null) {
            return false;
        }

        const itemToMove = draggedData.item;

        FastDOM.mutate(() => {
            if (sourceContainer === targetContainer) {
                targetContainer.moveGroup(itemToMove, dropIndex);
            } else if (sourceContainer) {
                sourceContainer.removeGroup(itemToMove);
                targetContainer.addGroup(itemToMove, dropIndex);
            }
        });

        return true;
    }
}
