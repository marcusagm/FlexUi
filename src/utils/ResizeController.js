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
 * - _targetElement {HTMLElement} : The element being resized (or the reference context).
 * - _direction {string} : The axis of resize ('horizontal' or 'vertical').
 * - _callbacks {object} : Hook functions for resize lifecycle events.
 * - _startPosition {number} : The starting cursor coordinate (X or Y).
 * - _activePointerId {number|null} : The ID of the pointer currently performing the resize.
 * - _boundOnMove {Function} : Bound event listener for pointer move.
 * - _boundOnUp {Function} : Bound event listener for pointer up.
 *
 * Typical usage:
 * const resizer = new ResizeController(element, 'horizontal', {
 * onStart: () => console.log('Resize started'),
 * onUpdate: (delta) => {
 * const newWidth = initialWidth + delta;
 * element.style.width = `${newWidth}px`;
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
 * - Supports both horizontal and vertical axes.
 * - Cleans up all global listeners automatically when the drag ends.
 *
 * Dependencies:
 * - None
 */
export class ResizeController {
    /**
     * The element associated with this resize controller.
     * @type {HTMLElement}
     * @private
     */
    _targetElement;

    /**
     * The direction of the resize operation ('horizontal' | 'vertical').
     * @type {string}
     * @private
     */
    _direction;

    /**
     * Lifecycle callbacks for the resize operation.
     * @type {{
     * onStart?: Function,
     * onUpdate?: Function,
     * onEnd?: Function
     * }}
     * @private
     */
    _callbacks;

    /**
     * The initial coordinate (clientX or clientY) when dragging starts.
     * @type {number}
     * @private
     */
    _startPosition = 0;

    /**
     * The ID of the active pointer to track.
     * @type {number|null}
     * @private
     */
    _activePointerId = null;

    /**
     * Bound move event listener.
     * @type {Function}
     * @private
     */
    _boundOnMove;

    /**
     * Bound up event listener.
     * @type {Function}
     * @private
     */
    _boundOnUp;

    /**
     * Creates an instance of ResizeController.
     *
     * @param {HTMLElement} targetElement - The element context for the resize.
     * @param {'horizontal'|'vertical'} direction - The axis to track.
     * @param {object} callbacks - Lifecycle hooks.
     * @param {Function} [callbacks.onStart] - Called when resize starts.
     * @param {Function} [callbacks.onUpdate] - Called on move with the calculated delta (number).
     * @param {Function} [callbacks.onEnd] - Called when resize ends.
     */
    constructor(targetElement, direction, callbacks = {}) {
        const me = this;
        if (!targetElement) {
            throw new Error('ResizeController: targetElement is required.');
        }
        if (direction !== 'horizontal' && direction !== 'vertical') {
            throw new Error('ResizeController: direction must be "horizontal" or "vertical".');
        }

        me._targetElement = targetElement;
        me._direction = direction;
        me._callbacks = callbacks;

        me._boundOnMove = me._onMove.bind(me);
        me._boundOnUp = me._onUp.bind(me);
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

        // Prevent default browser behavior (text selection, scrolling)
        event.preventDefault();
        event.stopPropagation();

        const target = event.target;

        // Corrected Validation: Check setPointerCapture on the TARGET, not the event object
        if (target && typeof target.setPointerCapture === 'function') {
            me._activePointerId = event.pointerId;
            target.setPointerCapture(me._activePointerId);
        } else {
            // Fallback if target is invalid, though unlikely in pointerdown
            return;
        }

        // Record initial position
        if (me._direction === 'horizontal') {
            me._startPosition = event.clientX;
        } else {
            me._startPosition = event.clientY;
        }

        // Notify start
        if (typeof me._callbacks.onStart === 'function') {
            me._callbacks.onStart();
        }

        // Attach global listeners
        window.addEventListener('pointermove', me._boundOnMove);
        window.addEventListener('pointerup', me._boundOnUp);
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

        let currentPosition;
        if (me._direction === 'horizontal') {
            currentPosition = event.clientX;
        } else {
            currentPosition = event.clientY;
        }

        const delta = currentPosition - me._startPosition;

        if (typeof me._callbacks.onUpdate === 'function') {
            // We pass the raw delta. The consumer is expected to handle
            // any heavy throttling (e.g., requestAnimationFrame) if
            // the update operation is expensive.
            me._callbacks.onUpdate(delta);
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

        const target = event.target;
        if (target && typeof target.releasePointerCapture === 'function') {
            target.releasePointerCapture(me._activePointerId);
        }

        me._activePointerId = null;

        window.removeEventListener('pointermove', me._boundOnMove);
        window.removeEventListener('pointerup', me._boundOnUp);

        if (typeof me._callbacks.onEnd === 'function') {
            me._callbacks.onEnd();
        }
    }
}
