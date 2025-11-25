/**
 * Description:
 * Manages the creation, positioning, and destruction of the "Ghost" element
 * during a Drag-and-Drop operation. The ghost is a visual clone of the dragged
 * item that follows the cursor.
 *
 * Properties summary:
 * - _ghostElement {HTMLElement | null} : The active ghost DOM element.
 * - _offsetX {number} : X offset from the cursor to the element's top-left corner.
 * - _offsetY {number} : Y offset from the cursor to the element's top-left corner.
 *
 * Typical usage:
 * const ghostManager = new GhostManager();
 * ghostManager.create(draggedElement, event.clientX, event.clientY, offsetX, offsetY);
 * ghostManager.update(event.clientX, event.clientY, boundingBox);
 * ghostManager.destroy();
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Clones the source element deeply.
 * - Applies fixed positioning and pointer-events: none to avoid interference.
 * - Maintains the visual dimensions of the original element.
 * - Constrains movement to specific bounds if provided (essential for Viewport usability).
 * - Cleans up globally attached styles or classes on destroy.
 *
 * Dependencies:
 * - None
 */
export class GhostManager {
    /**
     * The active ghost DOM element.
     *
     * @type {HTMLElement | null}
     * @private
     */
    _ghostElement = null;

    /**
     * X offset from the cursor.
     *
     * @type {number}
     * @private
     */
    _offsetX = 0;

    /**
     * Y offset from the cursor.
     *
     * @type {number}
     * @private
     */
    _offsetY = 0;

    /**
     * Creates and mounts the ghost element.
     *
     * @param {HTMLElement} sourceElement - The original element to clone.
     * @param {number} clientX - Initial mouse X position.
     * @param {number} clientY - Initial mouse Y position.
     * @param {number} offsetX - Offset X to maintain relative position.
     * @param {number} offsetY - Offset Y to maintain relative position.
     * @returns {void}
     */
    create(sourceElement, clientX, clientY, offsetX = 0, offsetY = 0) {
        const me = this;
        if (!sourceElement) return;

        // Capture dimensions before cloning to prevent style collapse
        const rect = sourceElement.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        me._ghostElement = sourceElement.cloneNode(true);
        me._offsetX = offsetX;
        me._offsetY = offsetY;

        // Apply critical styles for the ghost
        me._ghostElement.style.position = 'fixed';
        me._ghostElement.style.pointerEvents = 'none';
        me._ghostElement.style.zIndex = '9999';
        me._ghostElement.style.opacity = '0.85';
        me._ghostElement.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        me._ghostElement.style.width = `${width}px`;
        me._ghostElement.style.height = `${height}px`;
        me._ghostElement.style.margin = '0';
        me._ghostElement.style.top = '0'; // Reset to allow transform positioning
        me._ghostElement.style.left = '0';

        // Add a class for specific CSS targeting if needed
        me._ghostElement.classList.add('dnd-ghost-active');
        document.body.classList.add('dnd-dragging-active');

        // Initial position
        me.update(clientX, clientY);

        document.body.appendChild(me._ghostElement);
    }

    /**
     * Updates the position of the ghost element.
     * Supports constraining the ghost within a bounding box.
     *
     * @param {number} clientX - Current mouse X position.
     * @param {number} clientY - Current mouse Y position.
     * @param {DOMRect|object|null} [containerBounds=null] - Optional boundaries to constrain the ghost.
     * @returns {void}
     */
    update(clientX, clientY, containerBounds = null) {
        const me = this;
        if (!me._ghostElement) return;

        let x = clientX - me._offsetX;
        let y = clientY - me._offsetY;

        // [RESTORED] Logic to constrain ghost within bounds
        if (containerBounds) {
            // We need the ghost's current dimensions to calculate max boundaries
            // Using getBoundingClientRect is safe here as the element is in DOM
            const ghostRect = me._ghostElement.getBoundingClientRect();
            const ghostWidth = ghostRect.width;
            const ghostHeight = ghostRect.height;

            const minX = containerBounds.left;
            const maxX = containerBounds.right - ghostWidth;
            const minY = containerBounds.top;
            const maxY = containerBounds.bottom - ghostHeight;

            // Clamp values
            x = Math.max(minX, Math.min(x, maxX));
            y = Math.max(minY, Math.min(y, maxY));
        }

        me._ghostElement.style.transform = `translate(${x}px, ${y}px)`;
    }

    /**
     * Removes the ghost element from the DOM and cleans up.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        if (me._ghostElement && me._ghostElement.parentNode) {
            me._ghostElement.parentNode.removeChild(me._ghostElement);
        }
        me._ghostElement = null;
        document.body.classList.remove('dnd-dragging-active');
    }
}
