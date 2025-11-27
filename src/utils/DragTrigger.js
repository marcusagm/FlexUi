/**
 * Description:
 * A utility class that encapsulates the logic to differentiate between a simple "Click"
 * and a "Drag Start" gesture based on a movement threshold.
 *
 * It handles the 'pointerdown' event, monitors movement, and either triggers
 * 'onDragStart' (if the threshold is exceeded) or 'onClick' (if the pointer is released beforehand).
 *
 * Properties summary:
 * - _element {HTMLElement} : The target element to listen to.
 * - _threshold {number} : The pixel distance required to trigger a drag.
 * - _callbacks {object} : Registered callbacks for drag start and click.
 * - _startState {object|null} : Stores initial pointer coordinates and ID.
 * - _boundOnPointerDown {Function} : Bound handler for pointer down.
 * - _boundOnPointerMove {Function} : Bound handler for pointer move.
 * - _boundOnPointerUp {Function} : Bound handler for pointer up.
 *
 * Typical usage:
 * const trigger = new DragTrigger(myElement, {
 * threshold: 5,
 * onDragStart: (event, coords) => { console.log('Drag started', coords); },
 * onClick: (event) => { console.log('Clicked'); }
 * });
 *
 * Events:
 * - Listens to 'pointerdown' on the element.
 * - Listens to 'pointermove', 'pointerup', 'pointercancel' on window during interaction.
 *
 * Business rules implemented:
 * - Validates input element and callbacks.
 * - Differentiates drag vs click based on threshold.
 * - Manages pointer capture to ensure drag continuity.
 * - Cleans up global listeners automatically after interaction.
 *
 * Dependencies:
 * - None
 *
 * Notes / Additional:
 * - Ensure the element has 'touch-action: none' via CSS or it is applied here.
 */
export class DragTrigger {
    /**
     * The target element to listen to.
     *
     * @type {HTMLElement}
     * @private
     */
    _element;

    /**
     * The pixel distance required to trigger a drag.
     *
     * @type {number}
     * @private
     */
    _threshold = 5;

    /**
     * Registered callbacks for drag start and click.
     *
     * @type {{
     * onDragStart: Function,
     * onClick?: Function
     * }}
     * @private
     */
    _callbacks;

    /**
     * Stores initial pointer coordinates and ID.
     *
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
     *
     * @type {Function}
     * @private
     */
    _boundOnPointerDown;

    /**
     * Bound handler for pointer move.
     *
     * @type {Function}
     * @private
     */
    _boundOnPointerMove;

    /**
     * Bound handler for pointer up.
     *
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

        if (!element || !(element instanceof HTMLElement)) {
            throw new Error('[DragTrigger] element is required and must be an HTMLElement.');
        }
        if (typeof onDragStart !== 'function') {
            throw new Error('[DragTrigger] onDragStart callback is required.');
        }

        me._element = element;
        me._callbacks = { onDragStart, onClick };

        me.threshold = threshold;

        me._boundOnPointerDown = me._onPointerDown.bind(me);
        me._boundOnPointerMove = me._onPointerMove.bind(me);
        me._boundOnPointerUp = me._onPointerUp.bind(me);

        me._init();
    }

    /**
     * Sets the drag threshold distance.
     *
     * @param {number} value - The threshold in pixels.
     * @returns {void}
     */
    set threshold(value) {
        const me = this;
        const numberValue = Number(value);
        if (Number.isNaN(numberValue) || numberValue < 0) {
            console.warn(
                `[DragTrigger] invalid threshold assignment (${value}). Must be a positive number. Keeping previous value: ${me._threshold}`
            );
            return;
        }
        me._threshold = numberValue;
    }

    /**
     * Gets the drag threshold distance.
     *
     * @returns {number} The threshold in pixels.
     */
    get threshold() {
        return this._threshold;
    }

    /**
     * Cleans up listeners and destroys the instance.
     *
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
     * Attaches the initial pointerdown listener.
     *
     * @private
     * @returns {void}
     */
    _init() {
        const me = this;
        me._element.style.touchAction = 'none';
        me._element.addEventListener('pointerdown', me._boundOnPointerDown);
    }

    /**
     * Handles the initial pointer down event.
     *
     * @param {PointerEvent} event - The native pointer event.
     * @private
     * @returns {void}
     */
    _onPointerDown(event) {
        const me = this;

        if (event.button !== 0) {
            return;
        }

        if (me._element.getAttribute('draggable') === 'false') {
            return;
        }

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
     *
     * @param {PointerEvent} event - The native pointer event.
     * @private
     * @returns {void}
     */
    _onPointerMove(event) {
        const me = this;
        if (!me._startState || event.pointerId !== me._startState.pointerId) {
            return;
        }

        const deltaX = Math.abs(event.clientX - me._startState.startX);
        const deltaY = Math.abs(event.clientY - me._startState.startY);

        if (deltaX > me._threshold || deltaY > me._threshold) {
            if (typeof me._callbacks.onDragStart === 'function') {
                me._callbacks.onDragStart(event, {
                    startX: me._startState.startX,
                    startY: me._startState.startY
                });
            }

            me._cleanupGlobalListeners();
        }
    }

    /**
     * Handles pointer up (release) before threshold was met.
     * This counts as a Click.
     *
     * @param {PointerEvent} event - The native pointer event.
     * @private
     * @returns {void}
     */
    _onPointerUp(event) {
        const me = this;
        if (!me._startState || event.pointerId !== me._startState.pointerId) {
            return;
        }

        if (typeof me._callbacks.onClick === 'function') {
            me._callbacks.onClick(event);
        }

        me._cleanupGlobalListeners();
    }

    /**
     * Removes temporary global listeners used during the interaction.
     *
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
                } catch (error) {
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
