import { BaseDropStrategy } from './BaseDropStrategy.js';
import { ItemType } from '../../constants/DNDTypes.js';

/**
 * Description:
 * A DND strategy exclusive for the Viewport's Tab Bar.
 * It handles the reordering of docked ApplicationWindow tabs within the Viewport.
 *
 * Properties summary:
 * - _dropIndex {number | null} : The calculated index for the drop.
 *
 * Business rules implemented:
 * - Validates that the dragged item is strictly an ApplicationWindow.
 * - Calculates the insertion index based on the horizontal midpoint of existing tabs.
 * - Shows a 'vertical' placeholder between tabs to indicate position.
 * - Maintains Tab Bar visibility during the operation to prevent layout collapse.
 * - On Drop: Calls `viewport.dockWindow(window, index)` to reorder or dock the window.
 *
 * Dependencies:
 * - {import('./BaseDropStrategy.js').BaseDropStrategy}
 * - {import('../../components/Viewport/Viewport.js').Viewport}
 * - {import('../../constants/DNDTypes.js').ItemType}
 */
export class ViewportTabDropStrategy extends BaseDropStrategy {
    /**
     * The calculated index for the drop.
     *
     * @type {number | null}
     * @private
     */
    _dropIndex = null;

    /**
     * Clears internal cache.
     *
     * @returns {void}
     */
    clearCache() {
        this._dropIndex = null;
    }

    /**
     * Hook called when a drag enters the zone.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Viewport/Viewport.js').Viewport} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDragEnter(point, dropZone, draggedData, dds) {
        // Force visibility stability by adding drag-target class to the container
        if (draggedData.type === ItemType.APPLICATION_WINDOW) {
            if (dropZone.tabBar && dropZone.tabBar.parentElement) {
                dropZone.tabBar.parentElement.classList.add('viewport__tab-bar--drag-target');
            }
        }
        return true;
    }

    /**
     * Hook called when a drag moves over the zone.
     * Calculates insertion index.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Viewport/Viewport.js').Viewport} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDragOver(point, dropZone, draggedData, dds) {
        // [FIX] Prevent visual feedback for non-windows (Panels/Groups)
        if (draggedData.type !== ItemType.APPLICATION_WINDOW) {
            dds.hidePlaceholder();
            return false;
        }

        const stripElement = dropZone.tabBar;
        if (!stripElement) {
            dds.hidePlaceholder();
            return false;
        }

        // Find the inner scrollable container (Viewport of the Strip)
        const scrollContainer = stripElement.querySelector('.ui-strip__viewport');
        const placeholder = dds.getPlaceholder();

        if (!scrollContainer) {
            dds.hidePlaceholder();
            return false;
        }

        // Filter all children (tabs) inside the scroll container
        const tabs = Array.from(scrollContainer.children).filter(
            // Tabs are the direct children elements, and we filter out the placeholder itself
            child => child !== placeholder
        );

        let targetElement = null;
        let placed = false;
        this._dropIndex = tabs.length;

        // Horizontal index calculation
        for (let i = 0; i < tabs.length; i++) {
            const tab = tabs[i];
            const rect = tab.getBoundingClientRect();
            const midX = rect.left + rect.width / 2;

            if (point.x < midX) {
                this._dropIndex = i;
                targetElement = tab;
                placed = true;
                break;
            }
        }

        dds.showPlaceholder('vertical');

        if (placed && targetElement) {
            scrollContainer.insertBefore(placeholder, targetElement);
        } else {
            scrollContainer.appendChild(placeholder);
        }

        return true;
    }

    /**
     * Cleanup on leave.
     */
    onDragLeave(point, dropZone, draggedData, dds) {
        if (dropZone.tabBar && dropZone.tabBar.parentElement) {
            dropZone.tabBar.parentElement.classList.remove('viewport__tab-bar--drag-target');
        }
    }

    /**
     * Hook called when the item is dropped.
     * Executes the reorder/dock logic.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Viewport/Viewport.js').Viewport} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDrop(point, dropZone, draggedData, dds) {
        if (dropZone.tabBar && dropZone.tabBar.parentElement) {
            dropZone.tabBar.parentElement.classList.remove('viewport__tab-bar--drag-target');
        }

        if (draggedData.type !== ItemType.APPLICATION_WINDOW || this._dropIndex === null) {
            return false;
        }

        const windowInstance = draggedData.item;
        dropZone.dockWindow(windowInstance, this._dropIndex);

        return true;
    }
}
