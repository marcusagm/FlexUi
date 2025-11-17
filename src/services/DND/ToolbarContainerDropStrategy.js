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
 * - _dropZoneCache {Array<object>} : Caches geometry of child ToolbarGroups.
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
 * - Returns false on drop if the placeholder is not active (enables undock fallback).
 *
 * Dependencies:
 * - ../../components/Toolbar/ToolbarGroup.js
 * - ./DragDropService.js
 * - ../../components/Toolbar/ToolbarContainer.js
 */
export class ToolbarContainerDropStrategy {
    /**
     * Caches the geometry (midX/midY) and index of child ToolbarGroups.
     * Renamed from _groupCache to _dropZoneCache to align with DragDropService protocol.
     * @type {Array<{element: HTMLElement, mid: number, index: number}>}
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
        me._dropZoneCache = [];
        me._dropIndex = null;
        me._originalIndex = null;
        me._sourceContainer = null;
        me._orientation = 'horizontal';
    }

    /**
     * Caches the geometry of child groups on drag enter.
     * @param {{x: number, y: number, target: HTMLElement}} point - The coordinates and target.
     * @param {ToolbarContainer} dropZone - The ToolbarContainer instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDragEnter(point, dropZone, draggedData, dds) {
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

            me._dropZoneCache.push({
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
     * @param {{x: number, y: number, target: HTMLElement}} point - The coordinates and target.
     * @param {ToolbarContainer} dropZone - The ToolbarContainer instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDragLeave(point, dropZone, draggedData, dds) {
        dds.hidePlaceholder();
        this.clearCache();
    }

    /**
     * Calculates the drop position and shows the placeholder on drag over.
     * @param {{x: number, y: number, target: HTMLElement}} point - The coordinates and target.
     * @param {ToolbarContainer} dropZone - The ToolbarContainer instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDragOver(point, dropZone, draggedData, dds) {
        const me = this;

        // Validation: Only handle ToolbarGroups
        if (draggedData.type !== 'ToolbarGroup') {
            dds.hidePlaceholder();
            return;
        }

        // Recalculate cache if empty (e.g., rapid entry or empty toolbar)
        if (me._dropZoneCache.length === 0 && dropZone._state.groups.length > 0) {
            me.handleDragEnter(point, dropZone, draggedData, dds);
        }

        const scrollContainer = dropZone._scrollContainer;

        // Containment Check
        if (!dropZone.element.contains(point.target)) {
            dds.hidePlaceholder();
            return;
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

        // Ghost Logic: Prevent drop on self or immediate neighbor (no-op)
        const isSameContainer = me._sourceContainer === dropZone;
        const isLeftGap = me._dropIndex === me._originalIndex;
        const isRightGap = me._dropIndex === me._originalIndex + 1;

        if (isSameContainer && (isLeftGap || isRightGap)) {
            dds.hidePlaceholder();
            me._dropIndex = null;
            return;
        }

        const placeholderMode = me._orientation === 'horizontal' ? 'vertical' : 'horizontal';
        const placeholder = dds.getPlaceholder();
        dds.showPlaceholder(placeholderMode);

        // Place placeholder in DOM
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
    }

    /**
     * Handles the drop logic for the ToolbarContainer.
     * @param {{x: number, y: number, target: HTMLElement}} point - The coordinates and target.
     * @param {ToolbarContainer} dropZone - The ToolbarContainer instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {DragDropService} dds - The DND service instance.
     * @returns {boolean} True if handled.
     */
    handleDrop(point, dropZone, draggedData, dds) {
        const me = this;

        // Gatekeeper: If placeholder is not visible, drop is invalid.
        if (!dds.getPlaceholder().parentElement) {
            me.clearCache();
            return false;
        }

        const dropIndex = me._dropIndex;
        const targetContainer = dropZone;
        const draggedItem = draggedData.item;

        // Fallback: Try to get source from item if handleDragEnter didn't run correctly
        const sourceContainer = me._sourceContainer || draggedItem._state.parentContainer;

        dds.hidePlaceholder();
        me.clearCache();

        if (draggedData.type !== 'ToolbarGroup' || dropIndex === null) {
            return false;
        }

        if (sourceContainer === targetContainer) {
            targetContainer.moveGroup(draggedItem, dropIndex);
        } else if (sourceContainer) {
            sourceContainer.removeGroup(draggedItem);
            targetContainer.addGroup(draggedItem, dropIndex);
        }

        return true;
    }
}
