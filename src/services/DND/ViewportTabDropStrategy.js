import { BaseDropStrategy } from './BaseDropStrategy.js';
import { FastDOM } from '../../utils/FastDOM.js';
import { ItemType } from '../../constants/DNDTypes.js';
import { PopoutManagerService } from '../PopoutManagerService.js';

/**
 * Description:
 * A DND strategy exclusive for the Viewport's Tab Bar.
 * It handles the reordering of docked Window tabs within the Viewport.
 *
 * Properties summary:
 * - _dropIndex {number | null} : The calculated index for the drop.
 *
 * Business rules implemented:
 * - Validates that the dragged item is strictly an Window.
 * - Calculates the insertion index by iterating over logical docked windows and measuring their headers.
 * - Inserts a vertical placeholder to indicate the drop position within the TabStrip's viewport.
 * - Maintains Tab Bar visibility during the operation.
 * - On Drop: Calls `viewport.dockWindow(window, index)` to reorder or dock the window.
 * - Handles auto-return of Popout windows when dropped onto the tab bar.
 *
 * Dependencies:
 * - {import('./BaseDropStrategy.js').BaseDropStrategy}
 * - {import('../../components/Viewport/Viewport.js').Viewport}
 * - {import('../../constants/DNDTypes.js').ItemType}
 * - {import('../PopoutManagerService.js').PopoutManagerService}
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
        if (draggedData.type !== ItemType.WINDOW) return false;

        // Ensure tab bar is visible and stable during drag
        if (dropZone.tabBar && dropZone.tabBar.parentElement) {
            dropZone.tabBar.parentElement.classList.add('viewport__tab-bar--drag-target');
        }
        return true;
    }

    /**
     * Hook called when a drag moves over the zone.
     * Calculates insertion index based on logical window headers.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Viewport/Viewport.js').Viewport} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDragOver(point, dropZone, draggedData, dds) {
        if (draggedData.type !== ItemType.WINDOW) {
            dds.hidePlaceholder();
            return false;
        }

        const stripElement = dropZone.tabBar;
        if (!stripElement) {
            dds.hidePlaceholder();
            return false;
        }

        // Locate the inner scrollable container where tabs actually live
        const scrollContainer = stripElement.querySelector('.ui-strip__viewport') || stripElement;
        const placeholder = dds.getPlaceholder();

        // Get logically docked windows to determine order
        const dockedWindows = dropZone.windows.filter(win => win.isTabbed);

        let targetHeaderElement = null;
        let placed = false;
        this._dropIndex = dockedWindows.length;

        // Calculate index by checking geometry of each docked window's header
        for (let i = 0; i < dockedWindows.length; i++) {
            const win = dockedWindows[i];
            // Skip the item being dragged to avoid self-reference issues in calculation
            if (win === draggedData.item) continue;

            // Access the header UIElement (WindowHeaderWrapper or direct header element)
            const headerElement = win.header ? win.header.element : null;

            if (headerElement && document.body.contains(headerElement)) {
                const rect = headerElement.getBoundingClientRect();
                const midX = rect.left + rect.width / 2;

                if (point.x < midX) {
                    this._dropIndex = i;
                    targetHeaderElement = headerElement;
                    placed = true;
                    break;
                }
            }
        }

        dds.showPlaceholder('vertical');

        // Visual insertion
        if (placed && targetHeaderElement) {
            if (scrollContainer.contains(targetHeaderElement)) {
                scrollContainer.insertBefore(placeholder, targetHeaderElement);
            } else {
                scrollContainer.appendChild(placeholder);
            }
        } else {
            scrollContainer.appendChild(placeholder);
        }

        return true;
    }

    /**
     * Cleanup on leave.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Viewport/Viewport.js').Viewport} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
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
        const me = this;
        this.onDragLeave(point, dropZone, draggedData, dds);

        if (draggedData.type !== ItemType.WINDOW || this._dropIndex === null) {
            return false;
        }

        const windowInstance = draggedData.item;

        const dropIndex = me._dropIndex;

        FastDOM.mutate(() => {
            if (windowInstance.isPopout) {
                PopoutManagerService.getInstance().returnWindow(windowInstance);

                if (!dropZone.windows.includes(windowInstance)) {
                    dropZone.addWindow(windowInstance, false);
                }
            }

            dropZone.dockWindow(windowInstance, dropIndex);
        });

        return true;
    }
}
