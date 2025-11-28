import { BaseDropStrategy } from './BaseDropStrategy.js';
import { ItemType } from '../../constants/DNDTypes.js';
import { PopoutManagerService } from '../PopoutManagerService.js';

/**
 * Description:
 * A DND strategy that defines drop behavior for 'viewport' type drop zones.
 * It handles the free movement of ApplicationWindows within the Viewport.
 * * Specific Behavior for Docking:
 * - It handles the *initial* creation of the Tab Bar.
 * - If the Viewport has NO tabs, dragging to the top edge shows a horizontal placeholder.
 * - Dropping there creates the first tab.
 * - Once tabs exist, the Tab Bar becomes visible and `ViewportTabDropStrategy` takes over
 * for adding/reordering tabs. This strategy then reverts to purely handling floating windows.
 *
 * Properties summary:
 * - _isDocking {boolean} : State flag indicating if the drop target is the top dock zone.
 * - _dockZoneHeight {number} : Height in pixels of the active dock area.
 *
 * Business rules implemented:
 * - Validates that the dragged item is strictly an ApplicationWindow.
 * - On DragOver:
 * - If item is NOT ApplicationWindow: Hides placeholder (prevents docking visual).
 * - If Viewport has tabs: Logic is purely floating (updates ghost, no docking).
 * - If Viewport empty of tabs: Checks top zone. If inside, shows Horizontal Placeholder.
 * - On Drop:
 * - Handles auto-return of Popout windows (Critical Fix).
 * - If docking: Calls `viewport.dockWindow()`.
 * - If floating: Updates window coordinates/state.
 *
 * Dependencies:
 * - {import('./BaseDropStrategy.js').BaseDropStrategy}
 * - {import('../../components/Viewport/ApplicationWindow.js').ApplicationWindow}
 * - {import('../../constants/DNDTypes.js').ItemType}
 * - {import('../PopoutManagerService.js').PopoutManagerService}
 */
export class ViewportDropStrategy extends BaseDropStrategy {
    /**
     * State flag indicating if the drop target is the top dock zone.
     * @type {boolean}
     * @private
     */
    _isDocking = false;

    /**
     * The height in pixels of the top zone that triggers docking.
     * @type {number}
     * @private
     */
    _dockZoneHeight = 10;

    /**
     * Clears internal state.
     * @returns {void}
     */
    clearCache() {
        this._isDocking = false;
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
        point;
        dropZone;
        draggedData;
        dds;
        return true;
    }

    /**
     * Hook called when a drag moves over the zone.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Viewport/Viewport.js').Viewport} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDragOver(point, dropZone, draggedData, dds) {
        if (draggedData.type !== ItemType.APPLICATION_WINDOW) {
            this._isDocking = false;
            dds.hidePlaceholder();
            return true;
        }

        const viewportRect = dropZone.element.getBoundingClientRect();
        const placeholder = dds.getPlaceholder();

        const hasTabs = dropZone.windows.some(w => w.isTabbed);

        if (hasTabs) {
            this._isDocking = false;
            dds.hidePlaceholder();
            return true;
        }

        const relativeY = point.y - viewportRect.top;

        if (relativeY >= 0 && relativeY <= this._dockZoneHeight) {
            this._isDocking = true;

            dds.showPlaceholder('horizontal');

            if (!dropZone.element.contains(placeholder)) {
                if (dropZone.element.firstChild) {
                    dropZone.element.insertBefore(placeholder, dropZone.element.firstChild);
                } else {
                    dropZone.element.appendChild(placeholder);
                }
            }
        } else {
            this._isDocking = false;
            dds.hidePlaceholder();
        }

        return true;
    }

    /**
     * Template method override to handle placeholder logic specific to this strategy.
     */
    handleDrop(point, dropZone, draggedData, dds) {
        const me = this;

        if (!me._isDocking) {
            dds.hidePlaceholder();
            const result = me.onDrop(point, dropZone, draggedData, dds);
            me.clearCache();
            return result;
        }

        return super.handleDrop(point, dropZone, draggedData, dds);
    }

    /**
     * Hook called when the item is dropped.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Viewport/Viewport.js').Viewport} dropZone
     * @param {{item: object, type: string, offsetX: number, offsetY: number}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDrop(point, dropZone, draggedData, dds) {
        dds;
        if (draggedData.type !== ItemType.APPLICATION_WINDOW) {
            return false;
        }

        const windowInstance = draggedData.item;

        if (windowInstance.isPopout) {
            PopoutManagerService.getInstance().returnWindow(windowInstance);

            if (!dropZone.windows.includes(windowInstance)) {
                dropZone.addWindow(windowInstance, false);
            }
        }

        if (this._isDocking) {
            dropZone.dockWindow(windowInstance);
            return true;
        }

        const viewportRect = dropZone.element.getBoundingClientRect();

        let newX = point.x - viewportRect.left - (draggedData.offsetX || 0);
        let newY = point.y - viewportRect.top - (draggedData.offsetY || 0);

        const defaultMinWidth = 200;
        const defaultMinHeight = 150;
        const isMinimized = windowInstance.isMinimized;
        const winWidth =
            windowInstance.width ||
            (windowInstance.element ? windowInstance.element.offsetWidth : defaultMinWidth);
        const winHeight =
            isMinimized && windowInstance.element
                ? windowInstance.element.offsetHeight
                : windowInstance.height || defaultMinHeight;

        const maxX = Math.max(0, viewportRect.width - winWidth);
        const maxY = Math.max(0, viewportRect.height - winHeight);

        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        if (windowInstance.isTabbed) {
            dropZone.undockWindow(windowInstance, newX, newY);
        } else {
            if ('x' in windowInstance) windowInstance.x = newX;
            if ('y' in windowInstance) windowInstance.y = newY;

            if (windowInstance.element) {
                windowInstance.element.style.left = `${newX}px`;
                windowInstance.element.style.top = `${newY}px`;
            }
            if (typeof windowInstance.constrainToParent === 'function') {
                windowInstance.constrainToParent();
            }
        }

        return true;
    }
}
