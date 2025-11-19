import { generateId } from './generateId.js';

/**
 * Description:
 * A utility class designed to encapsulate and manage the logic for resizing
 * UI elements via Pointer Events. It handles the complete lifecycle of a
 * resize operation: initializing capture, calculating movement deltas based
 * on a specified axis, and cleaning up event listeners upon completion.
 *
 * This class aims to eliminate code duplication across components like
 * Rows, Columns, and Panels that require similar resizing behaviors.
 *
 * Properties summary:
 * - _id {string} : Unique ID for this instance.
 * - _targetElement {HTMLElement} : The element being resized (or the reference context).
 * - _direction {string} : The axis of resize ('horizontal', 'vertical', or 'both').
 * - _callbacks {object} : Hook functions for resize lifecycle events.
 * - _startPositionX {number} : The starting cursor coordinate X.
 * - _startPositionY {number} : The starting cursor coordinate Y.
 * - _activePointerId {number|null} : The ID of the pointer currently performing the resize.
 * - _boundOnMove {Function} : Bound event listener for pointer move.
 * - _boundOnUp {Function} : Bound event listener for pointer up.
 *
 * Typical usage:
 * const resizer = new ResizeController(element, 'both', {
 * onStart: () => console.log('Resize started'),
 * onUpdate: (deltaX, deltaY) => {
 * // Handle 2D resize logic
 * },
 * onEnd: () => console.log('Resize ended')
 * });
 *
 * resizeHandle.addEventListener('pointerdown', (event) => {
 * resizer.start(event);
 * });
 *
 * Events:
 * - Subscribes to 'pointermove' and 'pointerup' on the window during an active session.
 *
 * Business rules implemented:
 * - Enforces pointer capture to ensure drag continuity even if the cursor leaves the element.
 * - Calculates delta relative to the initial pointer down position.
 * - Supports horizontal, vertical, and both axes.
 * - Cleans up all global listeners automatically when the drag ends.
 *
 * Dependencies:
 * - None
 */
export class ResizeController {
    /**
     * Unique ID for this instance, used for namespacing events.
     *
     * @type {string}
     * @private
     */
    _id = generateId();

    /**
     * The element associated with this resize controller.
     *
     * @type {HTMLElement}
     * @private
     */
    _targetElement;

    /**
     * The direction of the resize operation ('horizontal' | 'vertical' | 'both').
     *
     * @type {string}
     * @private
     */
    _direction;

    /**
     * Lifecycle callbacks for the resize operation.
     *
     * @type {{
     * onStart?: Function,
     * onUpdate?: Function,
     * onEnd?: Function
     * }}
     * @private
     */
    _callbacks;

    /**
     * The initial cursor X coordinate when dragging starts.
     *
     * @type {number}
     * @private
     */
    _startPositionX = 0;

    /**
     * The initial cursor Y coordinate when dragging starts.
     *
     * @type {number}
     * @private
     */
    _startPositionY = 0;

    /**
     * The ID of the active pointer to track.
     *
     * @type {number|null}
     * @private
     */
    _activePointerId = null;

    /**
     * Bound move event listener.
     *
     * @type {Function}
     * @private
     */
    _boundOnMove;

    /**
     * Bound up event listener.
     *
     * @type {Function}
     * @private
     */
    _boundOnUp;

    /**
     * Creates an instance of ResizeController.
     *
     * @param {HTMLElement} targetElement - The element context for the resize.
     * @param {'horizontal'|'vertical'|'both'} direction - The axis to track.
     * @param {object} callbacks - Lifecycle hooks.
     * @param {Function} [callbacks.onStart] - Called when resize starts.
     * @param {Function} [callbacks.onUpdate] - Called on move with the calculated delta (number, or deltaX, deltaY if direction is 'both').
     * @param {Function} [callbacks.onEnd] - Called when resize ends.
     * @throws {Error} If targetElement is missing or direction is invalid.
     */
    constructor(targetElement, direction, callbacks = {}) {
        const me = this;

        if (!targetElement) {
            throw new Error('ResizeController: targetElement is required.');
        }
        if (direction !== 'horizontal' && direction !== 'vertical' && direction !== 'both') {
            throw new Error(
                'ResizeController: direction must be "horizontal", "vertical" or "both".'
            );
        }

        me._targetElement = targetElement;
        me._direction = direction;
        me._callbacks = callbacks;

        me._boundOnMove = me._onMove.bind(me);
        me._boundOnUp = me._onUp.bind(me);
    }

    /**
     * Cleans up all listeners and stops any ongoing drag operation.
     *
     * @returns {void}
     */
    destroy() {
        this._cleanupDragState();
    }

    /**
     * Initiates the resize operation.
     * Should be called from a 'pointerdown' event handler.
     *
     * @param {PointerEvent} event - The triggering pointer event.
     * @returns {void}
     */
    start(event) {
        const me = this;
        if (!event) {
            return;
        }

        const target = event.target;
        if (target && typeof target.setPointerCapture === 'function') {
            me._activePointerId = event.pointerId;
            target.setPointerCapture(me._activePointerId);
        } else {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        me._startPositionX = event.clientX;
        me._startPositionY = event.clientY;

        if (typeof me._callbacks.onStart === 'function') {
            me._callbacks.onStart();
        }

        window.addEventListener('pointermove', me._boundOnMove);
        window.addEventListener('pointerup', me._boundOnUp);
        window.addEventListener('pointercancel', me._boundOnUp);
    }

    /**
     * Handles the pointer move event to calculate delta.
     *
     * @param {PointerEvent} event - The move event.
     * @private
     * @returns {void}
     */
    _onMove(event) {
        const me = this;
        if (event.pointerId !== me._activePointerId) {
            return;
        }

        if (typeof me._callbacks.onUpdate !== 'function') {
            return;
        }

        const deltaX = event.clientX - me._startPositionX;
        const deltaY = event.clientY - me._startPositionY;

        if (me._direction === 'both') {
            me._callbacks.onUpdate(deltaX, deltaY);
        } else if (me._direction === 'horizontal') {
            me._callbacks.onUpdate(deltaX);
        } else if (me._direction === 'vertical') {
            me._callbacks.onUpdate(deltaY);
        }
    }

    /**
     * Handles the pointer up event to finalize the operation.
     *
     * @param {PointerEvent} event - The up event.
     * @private
     * @returns {void}
     */
    _onUp(event) {
        const me = this;
        if (event.pointerId !== me._activePointerId) {
            return;
        }

        me._cleanupDragState();

        if (typeof me._callbacks.onEnd === 'function') {
            me._callbacks.onEnd();
        }
    }

    /**
     * Performs cleanup of global listeners and pointer capture release.
     *
     * @private
     * @returns {void}
     */
    _cleanupDragState() {
        const me = this;
        const target = me._targetElement;

        if (
            me._activePointerId !== null &&
            target &&
            typeof target.releasePointerCapture === 'function'
        ) {
            try {
                target.releasePointerCapture(me._activePointerId);
            } catch (e) {
                // Ignore if pointer was already released or lost
            }
        }

        me._activePointerId = null;

        window.removeEventListener('pointermove', me._boundOnMove);
        window.removeEventListener('pointerup', me._boundOnUp);
        window.removeEventListener('pointercancel', me._boundOnUp);
    }
}
