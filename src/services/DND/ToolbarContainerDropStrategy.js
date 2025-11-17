import { ToolbarGroup } from '../../components/Toolbar/ToolbarGroup.js';
import { DragDropService } from './DragDropService.js';
import { ToolbarContainer } from '../../components/Toolbar/ToolbarContainer.js';

/**
 * Description:
 * A DND strategy that defines drop behavior for 'toolbar-container' type drop zones.
 * It handles rearranging ToolbarGroups within a ToolbarContainer, or moving them
 * between different ToolbarContainers (e.g., from 'top' to 'left').
 *
 * Properties summary:
 * - _groupCache {Array<object>} : Caches geometry of child ToolbarGroups.
 * - _dropIndex {number | null} : The calculated drop index.
 * - _originalIndex {number | null} : The starting index (for "ghost" logic).
 * - _sourceContainer {ToolbarContainer | null} : The container where the drag originated.
 * - _orientation {'horizontal' | 'vertical'} : The orientation of the current drop zone.
 *
 * Business rules implemented:
 * - Caches child ToolbarGroup geometry on 'handleDragEnter'.
 * - Calculates drop index based on 'midX' (horizontal) or 'midY' (vertical).
 * - Shows a 'vertical' (if H) or 'horizontal' (if V) placeholder.
 * - Implements "ghost" logic to prevent dropping adjacent to the start position.
 * - On drop: Calls 'removeGroup' on the source and 'addGroup' on the target.
 *
 * Dependencies:
 * - ../../components/Toolbar/ToolbarGroup.js
 * - ./DragDropService.js
 * - ../../components/Toolbar/ToolbarContainer.js
 */
export class ToolbarContainerDropStrategy {
    /**
     * Caches the geometry (midX/midY) and index of child ToolbarGroups.
     * @type {Array<{element: HTMLElement, mid: number, index: number}>}
     * @private
     */
    _groupCache = [];

    /**
     * The calculated drop index (state).
     * @type {number | null}
     * @private
     */
    _dropIndex = null;

    /**
     * The starting state index (for "ghost" logic).
     * @type {number | null}
     * @private
     */
    _originalIndex = null;

    /**
     * The container where the drag originated.
     * @type {ToolbarContainer | null}
     * @private
     */
    _sourceContainer = null;

    /**
     * The orientation of the current drop zone.
     * @type {'horizontal' | 'vertical'}
     * @private
     */
    _orientation = 'horizontal';

    /**
     * Clears the internal geometry cache and drop index.
     * @returns {void}
     */
    clearCache() {
        const me = this;
        me._groupCache = [];
        me._dropIndex = null;
        me._originalIndex = null;
        me._sourceContainer = null;
        me._orientation = 'horizontal';
    }

    /**
     * Caches the geometry of child groups on drag enter.
     * @param {DragEvent} e - The native drag event.
     * @param {ToolbarContainer} dropZone - The ToolbarContainer instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDragEnter(e, dropZone, draggedData, dds) {
        const me = this;
        if (!draggedData.item || draggedData.type !== 'ToolbarGroup') {
            return;
        }

        me.clearCache();
        const draggedItem = draggedData.item;
        me._sourceContainer = draggedItem._state.parentContainer;
        me._orientation = dropZone._state.orientation;

        const groups = dropZone._state.groups;

        groups.forEach((group, index) => {
            const rect = group.element.getBoundingClientRect();
            let mid;
            if (me._orientation === 'horizontal') {
                mid = rect.left + rect.width / 2;
            } else {
                mid = rect.top + rect.height / 2;
            }

            me._groupCache.push({
                element: group.element,
                mid: mid,
                index: index
            });
        });

        if (me._sourceContainer === dropZone) {
            me._originalIndex = groups.indexOf(draggedItem);
        }
    }

    /**
     * Hides the placeholder on drag leave.
     * @param {DragEvent} e - The native drag event.
     * @param {ToolbarContainer} dropZone - The ToolbarContainer instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDragLeave(e, dropZone, draggedData, dds) {
        const me = this;
        if (
            e.relatedTarget &&
            ((dropZone.element.contains(e.relatedTarget) &&
                e.relatedTarget.classList.contains('container__placeholder')) ||
                e.relatedTarget.classList.contains('toolbar__scroll-container') ||
                e.relatedTarget.classList.contains('toolbar-container'))
        ) {
            return;
        }
        dds.hidePlaceholder();
        me.clearCache();
    }

    /**
     * Calculates the drop position and shows the placeholder on drag over.
     * @param {DragEvent} e - The native drag event.
     * @param {ToolbarContainer} dropZone - The ToolbarContainer instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDragOver(e, dropZone, draggedData, dds) {
        const me = this;
        const placeholder = dds.getPlaceholder();
        const scrollContainer = dropZone._scrollContainer;

        const isOverContainer = e.target === dropZone.element;
        const isOverScroll = e.target === scrollContainer || scrollContainer.contains(e.target);
        const isOverPlaceholder = e.target === placeholder;

        if (!isOverContainer && !isOverScroll && !isOverPlaceholder) {
            dds.hidePlaceholder();
            me._dropIndex = null;
            return;
        }

        if (draggedData.type !== 'ToolbarGroup') {
            return;
        }

        const clientPos = me._orientation === 'horizontal' ? e.clientX : e.clientY;
        let gapFound = false;

        me._dropIndex = me._groupCache.length;
        for (const group of me._groupCache) {
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
            return;
        }

        const placeholderMode = me._orientation === 'horizontal' ? 'vertical' : 'horizontal';
        dds.showPlaceholder(placeholderMode);

        if (gapFound) {
            const targetElement = me._groupCache.find(
                item => item.index === me._dropIndex
            )?.element;

            if (targetElement && scrollContainer.contains(targetElement)) {
                scrollContainer.insertBefore(placeholder, targetElement);
            }
        } else {
            scrollContainer.appendChild(placeholder);
        }
    }

    /**
     * Handles the drop logic for the ToolbarContainer.
     * @param {DragEvent} e - The native drag event.
     * @param {ToolbarContainer} dropZone - The ToolbarContainer instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDrop(e, dropZone, draggedData, dds) {
        const me = this;
        const dropIndex = me._dropIndex;
        const sourceContainer = me._sourceContainer;
        const targetContainer = dropZone;

        dds.hidePlaceholder();
        me.clearCache();

        if (draggedData.type !== 'ToolbarGroup' || dropIndex === null) {
            return;
        }

        const draggedItem = draggedData.item;

        if (sourceContainer === targetContainer) {
            targetContainer.moveGroup(draggedItem, dropIndex);
        } else if (sourceContainer) {
            sourceContainer.removeGroup(draggedItem);
            targetContainer.addGroup(draggedItem, dropIndex);
        }
    }
}
