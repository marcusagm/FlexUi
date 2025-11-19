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
 * - Overrides base handleDrop to bypass placeholder check (since we don't use one).
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

        // Calculate relative coordinates
        let newX = point.x - viewportRect.left - (draggedData.offsetX || 0);
        let newY = point.y - viewportRect.top - (draggedData.offsetY || 0);

        // Clamp constraints (prevent dropping completely outside)
        // Allow title bar to be visible at minimum (assuming ~20px grab area)
        newX = Math.max(0, Math.min(newX, viewportRect.width - 20));
        newY = Math.max(0, Math.min(newY, viewportRect.height - 20));

        const windowInstance = draggedData.item;

        // Update position directly on the instance
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
