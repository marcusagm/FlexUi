/**
 * Description:
 * A utility class that encapsulates the logic to differentiate between a simple "Click"
 * and a "Drag Start" gesture based on a movement threshold.
 *
 * It handles the `pointerdown` event, monitors movement, and either triggers
 * `onDragStart` (if the threshold is exceeded) or `onClick` (if the pointer is released beforehand).
 *
 * Properties summary:
 * - _element {HTMLElement} : The target element to listen to.
 * - _threshold {number} : The pixel distance required to trigger a drag.
 * - _callbacks {object} : Registered callbacks for drag start and click.
 * - _startState {object|null} : Stores initial pointer coordinates and ID.
 * - _bound... {Function} : Bound event listeners for cleanup.
 *
 * Typical usage:
 * const trigger = new DragTrigger(myElement, {
 * threshold: 5,
 * onDragStart: (e) => { console.log('Drag started!'); },
 * onClick: (e) => { console.log('Clicked!'); }
 * });
 *
 * Events:
 * - Listens to 'pointerdown' on the element.
 * - Listens to 'pointermove', 'pointerup', 'pointercancel' on window during interaction.
 *
 * Dependencies:
 * - None
 */
export class DragTrigger {
    /**
     * The target element to listen to.
     * @type {HTMLElement}
     * @private
     */
    _element;

    /**
     * The pixel distance required to trigger a drag.
     * @type {number}
     * @private
     */
    _threshold;

    /**
     * Registered callbacks.
     * @type {{
     * onDragStart: Function,
     * onClick?: Function
     * }}
     * @private
     */
    _callbacks;

    /**
     * Stores initial pointer coordinates and ID.
     * @type {{
     * startX: number,
     * startY: number,
     * pointerId: number,
     * originalEvent: PointerEvent
     * } | null}
     * @private
     */
    _startState = null;

    /**
     * Bound handler for pointer down.
     * @type {Function}
     * @private
     */
    _boundOnPointerDown;

    /**
     * Bound handler for pointer move.
     * @type {Function}
     * @private
     */
    _boundOnPointerMove;

    /**
     * Bound handler for pointer up.
     * @type {Function}
     * @private
     */
    _boundOnPointerUp;

    /**
     * Creates an instance of DragTrigger.
     *
     * @param {HTMLElement} element - The element to attach the trigger to.
     * @param {object} options - Configuration options.
     * @param {number} [options.threshold=5] - Pixels to move before triggering drag.
     * @param {Function} options.onDragStart - Callback fired when drag is detected. Receives (event, { startX, startY }).
     * @param {Function} [options.onClick] - Callback fired if pointer is released before threshold.
     */
    constructor(element, { threshold = 5, onDragStart, onClick } = {}) {
        const me = this;

        if (!element) {
            throw new Error('DragTrigger: element is required.');
        }
        if (typeof onDragStart !== 'function') {
            throw new Error('DragTrigger: onDragStart callback is required.');
        }

        me._element = element;
        me._threshold = threshold;
        me._callbacks = { onDragStart, onClick };

        me._boundOnPointerDown = me._onPointerDown.bind(me);
        me._boundOnPointerMove = me._onPointerMove.bind(me);
        me._boundOnPointerUp = me._onPointerUp.bind(me);

        me._init();
    }

    /**
     * Attaches the initial pointerdown listener.
     * @private
     * @returns {void}
     */
    _init() {
        const me = this;
        // Ensure touch-action is none to prevent native scrolling interference
        me._element.style.touchAction = 'none';
        me._element.addEventListener('pointerdown', me._boundOnPointerDown);
    }

    /**
     * Cleans up listeners and destroys the instance.
     * @returns {void}
     */
    destroy() {
        const me = this;
        me._cleanupGlobalListeners();
        if (me._element) {
            me._element.removeEventListener('pointerdown', me._boundOnPointerDown);
        }
        me._startState = null;
    }

    /**
     * Handles the initial pointer down event.
     * @param {PointerEvent} event
     * @private
     * @returns {void}
     */
    _onPointerDown(event) {
        const me = this;
        // Only left mouse button or touch
        if (event.button !== 0) {
            return;
        }

        // Ignore if draggable is explicitly disabled on the element
        if (me._element.getAttribute('draggable') === 'false') {
            return;
        }

        // Prevent default to avoid text selection/scrolling
        event.preventDefault();
        event.stopPropagation();

        const target = event.target;
        if (target && typeof target.setPointerCapture === 'function') {
            target.setPointerCapture(event.pointerId);
        }

        me._startState = {
            startX: event.clientX,
            startY: event.clientY,
            pointerId: event.pointerId,
            originalEvent: event
        };

        window.addEventListener('pointermove', me._boundOnPointerMove);
        window.addEventListener('pointerup', me._boundOnPointerUp);
        window.addEventListener('pointercancel', me._boundOnPointerUp);
    }

    /**
     * Monitors movement to detect if the threshold is exceeded.
     * @param {PointerEvent} event
     * @private
     * @returns {void}
     */
    _onPointerMove(event) {
        const me = this;
        if (!me._startState || event.pointerId !== me._startState.pointerId) {
            return;
        }

        const dx = Math.abs(event.clientX - me._startState.startX);
        const dy = Math.abs(event.clientY - me._startState.startY);

        if (dx > me._threshold || dy > me._threshold) {
            // Threshold exceeded: It is a Drag.
            // We invoke the callback with the CURRENT event (to have up-to-date coordinates)
            if (typeof me._callbacks.onDragStart === 'function') {
                me._callbacks.onDragStart(event, {
                    startX: me._startState.startX,
                    startY: me._startState.startY
                });
            }

            // Once drag starts, this utility's job is done.
            // The external handler (e.g., DragDropService) takes over tracking.
            me._cleanupGlobalListeners();
        }
    }

    /**
     * Handles pointer up (release) before threshold was met.
     * This counts as a Click.
     * @param {PointerEvent} event
     * @private
     * @returns {void}
     */
    _onPointerUp(event) {
        const me = this;
        if (!me._startState || event.pointerId !== me._startState.pointerId) {
            return;
        }

        // If we reached here, threshold was NOT exceeded. It is a Click.
        if (typeof me._callbacks.onClick === 'function') {
            me._callbacks.onClick(event);
        }

        me._cleanupGlobalListeners();
    }

    /**
     * Removes temporary global listeners used during the interaction.
     * @private
     * @returns {void}
     */
    _cleanupGlobalListeners() {
        const me = this;
        if (me._startState && me._startState.originalEvent) {
            const target = me._startState.originalEvent.target;
            if (target && typeof target.releasePointerCapture === 'function') {
                try {
                    target.releasePointerCapture(me._startState.pointerId);
                } catch (e) {
                    // Ignore if pointer was already released or lost
                }
            }
        }

        me._startState = null;
        window.removeEventListener('pointermove', me._boundOnPointerMove);
        window.removeEventListener('pointerup', me._boundOnPointerUp);
        window.removeEventListener('pointercancel', me._boundOnPointerUp);
    }
}
