/**
 * Description:
 * Abstract base class for all Drag-and-Drop (DND) strategies.
 * It implements the "Template Method" pattern to enforce a consistent lifecycle
 * for drag operations (Enter, Over, Leave, Drop) and standardizes the return
 * contract (boolean) for handling events.
 *
 * Properties summary:
 * - None (Stateless base, but subclasses usually maintain cache).
 *
 * Typical usage:
 * class MyStrategy extends BaseDropStrategy {
 * onDragOver(point, dropZone, draggedData, dds) {
 * // Implementation logic
 * return true;
 * }
 * }
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Enforces a specific execution order for 'drop' events (Gatekeeper validation -> Execution -> Cleanup).
 * - Automatically cleans up visual placeholders and internal caches on 'Leave' and 'Drop'.
 * - Provides hook methods (onDragEnter, onDragOver, onDrop) with default 'false' returns.
 *
 * Dependencies:
 * - None
 *
 * Notes / Additional:
 * - Subclasses must override the 'on...' hooks to provide specific logic.
 * - Subclasses should override 'clearCache' to clean up their specific state.
 *
 * @abstract
 */
export class BaseDropStrategy {
    /**
     * Constructor.
     * Prevents direct instantiation of the abstract class.
     */
    constructor() {
        if (this.constructor === BaseDropStrategy) {
            throw new Error('BaseDropStrategy is abstract and cannot be instantiated.');
        }
    }

    /**
     * Template method for handling Drag Enter.
     * Delegates to the 'onDragEnter' hook.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point - The coordinates and target.
     * @param {object} dropZone - The drop zone instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {import('./DragDropService.js').DragDropService} dds - The DND service instance.
     * @returns {boolean} True if the strategy handled the enter event, false otherwise.
     */
    handleDragEnter(point, dropZone, draggedData, dds) {
        const me = this;
        return me.onDragEnter(point, dropZone, draggedData, dds);
    }

    /**
     * Template method for handling Drag Over.
     * Delegates to the 'onDragOver' hook.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point - The coordinates and target.
     * @param {object} dropZone - The drop zone instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {import('./DragDropService.js').DragDropService} dds - The DND service instance.
     * @returns {boolean} True if the strategy handled the over event (and position is valid), false otherwise.
     */
    handleDragOver(point, dropZone, draggedData, dds) {
        const me = this;
        return me.onDragOver(point, dropZone, draggedData, dds);
    }

    /**
     * Template method for handling Drag Leave.
     * Performs standard cleanup (hide placeholder, clear cache) and calls 'onDragLeave'.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point - The coordinates and target.
     * @param {object} dropZone - The drop zone instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {import('./DragDropService.js').DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDragLeave(point, dropZone, draggedData, dds) {
        const me = this;
        dds.hidePlaceholder();
        me.clearCache();
        me.onDragLeave(point, dropZone, draggedData, dds);
    }

    /**
     * Template method for handling Drop.
     * Implements the Gatekeeper pattern to ensure valid drops.
     * Executes the drop logic via 'onDrop' FIRST, capturing the result,
     * and THEN performs cleanup via 'clearCache'. This ensures 'onDrop'
     * has access to the cached state (like dropIndex) before it is cleared.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point - The coordinates and target.
     * @param {object} dropZone - The drop zone instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {import('./DragDropService.js').DragDropService} dds - The DND service instance.
     * @returns {boolean} True if the drop was successful, false otherwise.
     */
    handleDrop(point, dropZone, draggedData, dds) {
        const me = this;
        if (!dds.getPlaceholder().parentElement) {
            dds.hidePlaceholder();
            me.clearCache();
            return false;
        }

        dds.hidePlaceholder();

        const result = me.onDrop(point, dropZone, draggedData, dds);

        me.clearCache();

        return result;
    }

    /**
     * Hook called when a drag enters the zone.
     * Subclasses should override this to initialize cache or state.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {object} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDragEnter(point, dropZone, draggedData, dds) {
        return false;
    }

    /**
     * Hook called when a drag moves over the zone.
     * Subclasses should override this to calculate drop position and update the placeholder.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {object} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDragOver(point, dropZone, draggedData, dds) {
        return false;
    }

    /**
     * Hook called when the item is dropped.
     * Subclasses should override this to apply the structural changes.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {object} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDrop(point, dropZone, draggedData, dds) {
        return false;
    }

    /**
     * Hook called when a drag leaves the zone.
     * Subclasses can override this for specific cleanup (optional).
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {object} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {void}
     */
    onDragLeave(point, dropZone, draggedData, dds) {
        // Default: No-op
    }

    /**
     * Clears any internal cache or state used by the strategy.
     * Subclasses should override this to reset their specific geometry caches.
     *
     * @returns {void}
     */
    clearCache() {
        // Default: No-op
    }
}
