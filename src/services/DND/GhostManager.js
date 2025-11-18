/**
 * Description:
 * Manages the visual "ghost" element that follows the cursor during a drag operation.
 * It encapsulates creation, styling, positioning (including constrained movement),
 * and destruction of the drag proxy, ensuring visual isolation from the rest of the UI.
 *
 * Properties summary:
 * - _ghostElement {HTMLElement | null} : The cloned DOM element acting as the ghost.
 * - _offsetX {number} : The horizontal offset from the cursor to the element's top-left.
 * - _offsetY {number} : The vertical offset from the cursor to the element's top-left.
 *
 * Typical usage:
 * const ghostManager = new GhostManager();
 * ghostManager.create(sourceEl, clientX, clientY, offsetX, offsetY);
 * ghostManager.update(newX, newY, boundingBox);
 * ghostManager.destroy();
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Creates a visual clone of the dragged element attached to the document body.
 * - Enforces 'position: fixed', high z-index, and 'pointer-events: none' to ensure
 * it floats above content and acts as a purely visual element without blocking hit-testing.
 * - Maintains exact dimensions of the original element.
 * - Supports clamping logic to constrain the ghost within specific container bounds
 * (e.g., keeping panels within the main workspace).
 *
 * Dependencies:
 * - None
 *
 * Notes / Additional:
 * - This class is designed to be used by DragDropService to offload visual management.
 */
export class GhostManager {
    /**
     * The cloned DOM element acting as the ghost.
     * @type {HTMLElement | null}
     * @private
     */
    _ghostElement = null;

    /**
     * The horizontal offset from the cursor to the element's top-left.
     * @type {number}
     * @private
     */
    _offsetX = 0;

    /**
     * The vertical offset from the cursor to the element's top-left.
     * @type {number}
     * @private
     */
    _offsetY = 0;

    /**
     * Description:
     * Creates the ghost element by cloning the source.
     * Applies rigorous inline styles to ensure the ghost behaves correctly
     * (fixed positioning, ignored by pointer events, high z-index).
     *
     * @param {HTMLElement} sourceElement - The original DOM element being dragged.
     * @param {number} x - The initial pointer X coordinate.
     * @param {number} y - The initial pointer Y coordinate.
     * @param {number} [offsetX=0] - The offset X from the pointer to the element's origin.
     * @param {number} [offsetY=0] - The offset Y from the pointer to the element's origin.
     * @returns {void}
     */
    create(sourceElement, x, y, offsetX = 0, offsetY = 0) {
        const me = this;
        if (!sourceElement) return;

        me._offsetX = offsetX;
        me._offsetY = offsetY;

        const clone = sourceElement.cloneNode(true);
        const rect = sourceElement.getBoundingClientRect();

        // Apply structural styles to ensure isolation
        clone.style.position = 'fixed';
        clone.style.zIndex = '99999';
        clone.style.pointerEvents = 'none'; // CRITICAL: Allows drops on elements below
        clone.style.margin = '0';
        clone.style.top = '0';
        clone.style.left = '0';
        clone.style.bottom = 'auto';
        clone.style.right = 'auto';
        clone.style.opacity = '0.9'; // Slight transparency for feedback

        // Enforce dimensions
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;

        // Remove potential interference classes if necessary, or add specific ghost class
        clone.classList.add('dnd-ghost');

        document.body.appendChild(clone);
        me._ghostElement = clone;

        // Set initial position immediately
        me.update(x, y, null);
    }

    /**
     * Description:
     * Updates the ghost's position on the screen based on the new pointer coordinates.
     * If `containerBounds` is provided, the ghost's position is clamped to stay
     * within those bounds.
     *
     * @param {number} x - The current pointer X coordinate.
     * @param {number} y - The current pointer Y coordinate.
     * @param {DOMRect|null} [containerBounds=null] - Optional bounds to restrict movement.
     * @returns {void}
     */
    update(x, y, containerBounds = null) {
        const me = this;
        if (!me._ghostElement) return;

        let left = x - me._offsetX;
        let top = y - me._offsetY;

        // Apply clamping logic if bounds are provided (e.g., for Panels)
        if (containerBounds) {
            const ghostWidth = me._ghostElement.offsetWidth;
            const ghostHeight = me._ghostElement.offsetHeight;

            const minX = containerBounds.left;
            const minY = containerBounds.top;
            const maxX = containerBounds.right - ghostWidth;
            const maxY = containerBounds.bottom - ghostHeight;

            left = Math.max(minX, Math.min(left, maxX));
            top = Math.max(minY, Math.min(top, maxY));
        }

        // Use translate3d for hardware acceleration
        me._ghostElement.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    }

    /**
     * Description:
     * Removes the ghost element from the DOM and cleans up internal references.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        if (me._ghostElement && me._ghostElement.parentNode) {
            me._ghostElement.parentNode.removeChild(me._ghostElement);
        }
        me._ghostElement = null;
        me._offsetX = 0;
        me._offsetY = 0;
    }
}
