import { BaseDropStrategy } from './BaseDropStrategy.js';
import { ItemType } from '../../constants/DNDTypes.js';

/**
 * Description:
 * A DND strategy that defines drop behavior for 'viewport' type drop zones.
 * It handles the free movement of ApplicationWindows within the Viewport.
 *
 * Properties summary:
 * - None (Stateless strategy, uses drag data).
 *
 * Business rules implemented:
 * - Validates that the dragged item is strictly an ApplicationWindow.
 * - On DragOver: Hides placeholder (free movement logic).
 * - On Drop: Updates the x/y coordinates of the ApplicationWindow.
 * - Enforces boundaries: Keeps the window fully contained within the Viewport to match Ghost behavior.
 * - Does NOT handle creation of new windows from Panels/Groups (delegated to Undock logic).
 *
 * Dependencies:
 * - {import('./BaseDropStrategy.js').BaseDropStrategy}
 * - {import('../../components/Viewport/ApplicationWindow.js').ApplicationWindow}
 * - {import('../../constants/DNDTypes.js').ItemType}
 */
export class ViewportDropStrategy extends BaseDropStrategy {
    /**
     * Hook called when a drag enters the zone.
     * Validates if the item can be dropped in the viewport.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Viewport/Viewport.js').Viewport} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDragEnter(point, dropZone, draggedData, dds) {
        // Strictly allow only ApplicationWindow
        return draggedData.type === ItemType.APPLICATION_WINDOW;
    }

    /**
     * Hook called when a drag moves over the zone.
     * Allows free movement (floating).
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Viewport/Viewport.js').Viewport} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDragOver(point, dropZone, draggedData, dds) {
        // We don't need a placeholder for floating drops, the ghost element is enough.
        dds.hidePlaceholder();
        return true;
    }

    /**
     * Template method for handling Drop.
     * Overridden to bypass the placeholder check from BaseDropStrategy,
     * as Viewport drops don't use the placeholder element.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {object} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    handleDrop(point, dropZone, draggedData, dds) {
        const me = this;
        // Bypass placeholder check
        dds.hidePlaceholder();

        const result = me.onDrop(point, dropZone, draggedData, dds);

        me.clearCache();
        return result;
    }

    /**
     * Hook called when the item is dropped.
     * Executes the move logic.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Viewport/Viewport.js').Viewport} dropZone
     * @param {{item: object, type: string, offsetX: number, offsetY: number}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDrop(point, dropZone, draggedData, dds) {
        if (draggedData.type !== ItemType.APPLICATION_WINDOW) {
            return false;
        }

        const viewportRect = dropZone.element.getBoundingClientRect();
        const windowInstance = draggedData.item;

        // Calculate relative coordinates
        let newX = point.x - viewportRect.left - (draggedData.offsetX || 0);
        let newY = point.y - viewportRect.top - (draggedData.offsetY || 0);

        // Get window dimensions (fallback to element size if property missing)
        const winWidth =
            windowInstance.width ||
            (windowInstance.element ? windowInstance.element.offsetWidth : 200);
        const winHeight =
            windowInstance.height ||
            (windowInstance.element ? windowInstance.element.offsetHeight : 150);

        // Clamp constraints: Keep the window FULLY inside the viewport
        // This matches the behavior of GhostManager when bounds are provided.
        const maxX = Math.max(0, viewportRect.width - winWidth);
        const maxY = Math.max(0, viewportRect.height - winHeight);

        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        // Update position directly on the instance
        // ApplicationWindow is expected to update its DOM/Styles via these setters
        if ('x' in windowInstance) windowInstance.x = newX;
        if ('y' in windowInstance) windowInstance.y = newY;

        // Fallback if setters don't auto-update styles immediately
        if (windowInstance.element) {
            windowInstance.element.style.left = `${newX}px`;
            windowInstance.element.style.top = `${newY}px`;
        }

        return true;
    }
}
