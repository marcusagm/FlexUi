/**
 * Description:
 * Recognizes touch gestures (swipe, pinch, rotate) from touch events.
 * Emits callbacks provided in constructor. This class will be instantiated
 * by the ShortcutService and does not rely on an external EventManager.
 *
 * Properties summary:
 * - _gestureThrottleMs {number} : minimum milliseconds between gesture dispatches
 * - _lastGestureDispatchTs {number} : timestamp of last dispatched gesture
 * - _touchTracking {Object|null} : tracking object for touch lifecycle
 * - _pinchTracking {Object|null} : tracking object for pinch (startDist, lastDist, startTime)
 * - _rotateTracking {Object|null} : tracking object for rotate (startAngle, lastAngle, startTime)
 * - _attached {boolean} : whether listeners are attached
 * - _onGesture {Function|null} : callback invoked on recognized gestures
 * - _eventManager {Object|null} : (DEPRECATED - Will be removed) optional EventManager
 * - _emListenerIds {Array<string>} : (DEPRECATED - Will be removed) IDs from eventManager
 * - _boundTouchStart {Function} : Bound DOM handler for touchstart
 * - _boundTouchMove {Function} : Bound DOM handler for touchmove
 * - _boundTouchEnd {Function} : Bound DOM handler for touchend
 *
 * Typical usage:
 * // Instantiated by ShortcutService
 * const gr = new GestureRecognizer({
 * gestureThrottleMs: 50,
 * onGesture: (g) => { ... }
 * });
 * gr.attach();
 *
 * Dependencies:
 * - None (self-contained DOM interaction)
 */
export class GestureRecognizer {
    /**
     * Internal gesture throttle (ms).
     * @type {number}
     * @private
     */
    _gestureThrottleMs = 50;

    /**
     * Last dispatched gesture timestamp.
     * @type {number}
     * @private
     */
    _lastGestureDispatchTs = 0;

    /**
     * Touch tracking object (startTime, startTouches[], lastTouches[], moved boolean).
     * @type {Object|null}
     * @private
     */
    _touchTracking = null;

    /**
     * Pinch tracking object (startDist, lastDist, startTime).
     * @type {Object|null}
     * @private
     */
    _pinchTracking = null;

    /**
     * Rotate tracking object (startAngle, lastAngle, startTime).
     * @type {Object|null}
     * @private
     */
    _rotateTracking = null;

    /**
     * Attached flag.
     * @type {boolean}
     * @private
     */
    _attached = false;

    /**
     * onGesture callback function (gesturePayload) or null.
     * @type {Function|null}
     * @private
     */
    _onGesture = null;

    /**
     * Optional EventManager instance with onDOM/off methods.
     * (DEPRECATED - Slated for removal in FlexUI integration)
     * @type {Object|null}
     * @private
     */
    _eventManager = null;

    /**
     * IDs returned by eventManager.onDOM when attached (used to detach).
     * (DEPRECATED - Slated for removal in FlexUI integration)
     * @type {Array<string>}
     * @private
     */
    _emListenerIds = [];

    /**
     * Bound DOM handlers (kept as instance props for removeEventListener).
     * @type {Function}
     * @private
     */
    _boundTouchStart = null;

    /**
     * Bound DOM handlers (kept as instance props for removeEventListener).
     * @type {Function}
     * @private
     */
    _boundTouchMove = null;

    /**
     * Bound DOM handlers (kept as instance props for removeEventListener).
     * @type {Function}
     * @private
     */
    _boundTouchEnd = null;

    /**
     * Description:
     * Creates an instance of the GestureRecognizer.
     *
     * @param {Object} [options] - Configuration options.
     * @param {number} [options.gestureThrottleMs=50] - minimum ms between dispatches (>= 0)
     * @param {Function|null} [options.onGesture=null] - callback({ gesture, meta, event })
     * @param {Object|null} [options.eventManager=null] - (DEPRECATED) optional EventManager instance
     */
    constructor({ gestureThrottleMs = 50, onGesture = null, eventManager = null } = {}) {
        const me = this;
        me.gestureThrottleMs = gestureThrottleMs;
        me.onGesture = typeof onGesture === 'function' ? onGesture : null;
        me.eventManager = eventManager || null;

        me._boundTouchStart = me._handleTouchStart.bind(me);
        me._boundTouchMove = me._handleTouchMove.bind(me);
        me._boundTouchEnd = me._handleTouchEnd.bind(me);
    }

    /* ----------------------
     Getters / setters
    ---------------------- */

    /**
     * <gestureThrottleMs> getter.
     *
     * @returns {number} The current throttle time in milliseconds.
     */
    get gestureThrottleMs() {
        return this._gestureThrottleMs;
    }

    /**
     * <gestureThrottleMs> setter with validation.
     *
     * @param {number} value - milliseconds >= 0
     * @returns {void}
     */
    set gestureThrottleMs(value) {
        const me = this;
        const num = Number(value);
        if (!Number.isFinite(num) || num < 0) {
            console.warn(
                `[GestureRecognizer] invalid gestureThrottleMs assignment (${value}). gestureThrottleMs must be finite >= 0. Keeping previous value: ${me._gestureThrottleMs}`
            );
            return;
        }
        me._gestureThrottleMs = Math.floor(num);
    }

    /**
     * <onGesture> setter.
     *
     * @param {Function|null} fn - callback({ gesture, meta, event }) or null
     * @returns {void}
     */
    set onGesture(fn) {
        this._onGesture = typeof fn === 'function' ? fn : null;
    }

    /**
     * <onGesture> getter.
     *
     * @returns {Function|null} The current onGesture callback.
     */
    get onGesture() {
        return this._onGesture;
    }

    /**
     * <eventManager> getter.
     * (DEPRECATED)
     *
     * @returns {Object|null}
     */
    get eventManager() {
        return this._eventManager;
    }

    /**
     * <eventManager> setter with validation.
     * (DEPRECATED)
     *
     * @param {Object|null} em - must implement onDOM/off if provided
     * @returns {void}
     */
    set eventManager(em) {
        const me = this;
        if (em !== null && typeof em !== 'undefined') {
            if (typeof em.onDOM !== 'function' || typeof em.off !== 'function') {
                console.warn(
                    `[GestureRecognizer] invalid eventManager assignment (${em}). eventManager must implement onDOM/off. Keeping previous value: ${me._eventManager}`
                );
                return;
            }
            me._eventManager = em;
            return;
        }
        me._eventManager = null;
    }

    /* ----------------------
     Concrete methods
    ---------------------- */

    /**
     * Description:
     * Attach listeners. If an EventManager was provided, it registers
     * via eventManager.onDOM. Otherwise attaches directly to window/document.
     *
     * @returns {void}
     */
    attach() {
        const me = this;
        if (me._attached) {
            return;
        }

        if (me._eventManager && typeof me._eventManager.onDOM === 'function') {
            try {
                me._emListenerIds = [
                    me._eventManager.onDOM('touchstart', me._boundTouchStart, { passive: true }),
                    me._eventManager.onDOM('touchmove', me._boundTouchMove, { passive: false }),
                    me._eventManager.onDOM('touchend', me._boundTouchEnd, { passive: true })
                ];
                me._attached = true;
                return;
            } catch (e) {
                console.warn(
                    `[GestureRecognizer] EventManager attach failed: ${e}. Falling back to direct listeners.`
                );
            }
        }

        if (typeof window === 'undefined' || !window.addEventListener) {
            return;
        }
        try {
            window.addEventListener('touchstart', me._boundTouchStart, { passive: true });
            window.addEventListener('touchmove', me._boundTouchMove, { passive: false });
            window.addEventListener('touchend', me._boundTouchEnd, { passive: true });
            me._attached = true;
        } catch (e) {
            console.warn(`[GestureRecognizer] failed to add direct touch listeners: ${e}`);
        }
    }

    /**
     * Description:
     * Detach listeners. Works for both EventManager-backed and direct attachment.
     *
     * @returns {void}
     */
    detach() {
        const me = this;
        if (!me._attached) {
            return;
        }

        if (me._eventManager && Array.isArray(me._emListenerIds) && me._emListenerIds.length > 0) {
            try {
                for (const id of me._emListenerIds) {
                    try {
                        me._eventManager.off(id);
                    } catch (err) {
                        /* ignore individual off errors */
                    }
                }
            } catch (err) {
                /* ignore */
            } finally {
                me._emListenerIds = [];
                me._attached = false;
            }
        }

        if (typeof window === 'undefined' || !window.removeEventListener) {
            me._attached = false;
            return;
        }
        try {
            window.removeEventListener('touchstart', me._boundTouchStart);
            window.removeEventListener('touchmove', me._boundTouchMove);
            window.removeEventListener('touchend', me._boundTouchEnd);
        } catch (e) {
            /* ignore removal errors */
        }
        me._attached = false;
    }

    /**
     * Description:
     * Dispose recognizer and clear internal state.
     *
     * @returns {void}
     */
    dispose() {
        const me = this;
        me.detach();
        me._onGesture = null;
        me._touchTracking = null;
        me._pinchTracking = null;
        me._rotateTracking = null;
        me._eventManager = null;
        me._emListenerIds = [];
        me._boundTouchStart = null;
        me._boundTouchMove = null;
        me._boundTouchEnd = null;
    }

    /**
     * Description:
     * Internal throttle check.
     *
     * @private
     * @returns {boolean} whether a gesture should be dispatched now
     */
    _shouldDispatchGesture() {
        const me = this;
        if (me._gestureThrottleMs <= 0) {
            return true;
        }
        const now = Date.now();
        if (now - me._lastGestureDispatchTs >= me._gestureThrottleMs) {
            me._lastGestureDispatchTs = now;
            return true;
        }
        return false;
    }

    /**
     * Description:
     * Compute average point of an array of touch-like points.
     *
     * @private
     * @param {Array<Object>} points - array of { x, y }
     * @returns {Object} { x, y }
     */
    _computeAveragePoint(points) {
        const me = this;
        let sumX = 0;
        let sumY = 0;
        for (const p of points) {
            sumX += p.x;
            sumY += p.y;
        }
        return { x: sumX / points.length, y: sumY / points.length };
    }

    /**
     * Description:
     * Internal touchstart handler.
     *
     * @private
     * @param {TouchEvent} ev
     * @returns {void}
     */
    _handleTouchStart(ev) {
        const me = this;
        if (!ev || !ev.touches || ev.touches.length === 0) {
            return;
        }
        const now = Date.now();
        const touches = Array.from(ev.touches).map(t => ({
            id: t.identifier,
            x: t.clientX,
            y: t.clientY
        }));

        me._touchTracking = {
            startTime: now,
            startTouches: touches,
            lastTouches: touches.slice(),
            moved: false
        };

        if (touches.length === 2) {
            const firstTouch = touches[0];
            const secondTouch = touches[1];
            const deltaX = secondTouch.x - firstTouch.x;
            const deltaY = secondTouch.y - firstTouch.y;
            const distance = Math.hypot(deltaX, deltaY);
            me._pinchTracking = { startDist: distance, lastDist: distance, startTime: now };
            const angle = Math.atan2(deltaY, deltaX);
            me._rotateTracking = { startAngle: angle, lastAngle: angle, startTime: now };
        } else {
            me._pinchTracking = null;
            me._rotateTracking = null;
        }
    }

    /**
     * Description:
     * Internal touchmove handler.
     *
     * @private
     * @param {TouchEvent} ev
     * @returns {void}
     */
    _handleTouchMove(ev) {
        const me = this;
        if (!me._touchTracking || !ev || !ev.touches) {
            return;
        }
        const touches = Array.from(ev.touches).map(t => ({
            id: t.identifier,
            x: t.clientX,
            y: t.clientY
        }));
        me._touchTracking.lastTouches = touches;
        me._touchTracking.moved = true;

        if (touches.length === 2 && me._pinchTracking && me._shouldDispatchGesture()) {
            const firstTouch = touches[0];
            const secondTouch = touches[1];
            const deltaX = secondTouch.x - firstTouch.x;
            const deltaY = secondTouch.y - firstTouch.y;
            const distance = Math.hypot(deltaX, deltaY);
            const scale = distance / (me._pinchTracking.startDist || distance || 1);
            me._pinchTracking.lastDist = distance;

            if (me._onGesture) {
                try {
                    me._onGesture({
                        gesture: 'pinch',
                        meta: {
                            scale,
                            center: {
                                x: (firstTouch.x + secondTouch.x) / 2,
                                y: (firstTouch.y + secondTouch.y) / 2
                            },
                            incremental: true
                        },
                        event: ev
                    });
                } catch (err) {
                    console.error(`[GestureRecognizer] onGesture callback error:`, err);
                }
            }
        }

        if (touches.length === 2 && me._rotateTracking && me._shouldDispatchGesture()) {
            const firstTouch = touches[0];
            const secondTouch = touches[1];
            const angle = Math.atan2(secondTouch.y - firstTouch.y, secondTouch.x - firstTouch.x);
            const deltaRad = angle - me._rotateTracking.startAngle;
            const deltaDeg = deltaRad * (180 / Math.PI);
            me._rotateTracking.lastAngle = angle;

            if (me._onGesture) {
                try {
                    me._onGesture({
                        gesture: 'rotate',
                        meta: {
                            angle: deltaDeg,
                            center: {
                                x: (firstTouch.x + secondTouch.x) / 2,
                                y: (firstTouch.y + secondTouch.y) / 2
                            },
                            incremental: true
                        },
                        event: ev
                    });
                } catch (err) {
                    console.error(`[GestureRecognizer] onGesture callback error:`, err);
                }
            }
        }
    }

    /**
     * Description:
     * Internal touchend handler.
     *
     * @private
     * @param {TouchEvent} ev
     * @returns {void}
     */
    _handleTouchEnd(ev) {
        const me = this;
        if (!me._touchTracking) {
            return;
        }

        const data = me._touchTracking;
        const startTouches = data.startTouches;
        const lastTouches = data.lastTouches || startTouches;
        const fingers = Math.min(startTouches.length, lastTouches.length);
        if (fingers <= 0) {
            me._touchTracking = null;
            return;
        }

        const startAvg = me._computeAveragePoint(startTouches);
        const endAvg = me._computeAveragePoint(lastTouches);
        const deltaX = endAvg.x - startAvg.x;
        const deltaY = endAvg.y - startAvg.y;
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);
        const minSwipe = 30;

        if (!data.moved || (absDeltaX < minSwipe && absDeltaY < minSwipe)) {
            if (me._pinchTracking && me._pinchTracking.startDist) {
                const finalScale =
                    (me._pinchTracking.lastDist || me._pinchTracking.startDist) /
                    (me._pinchTracking.startDist || 1);
                if (me._onGesture) {
                    try {
                        me._onGesture({
                            gesture: 'pinch',
                            meta: { scale: finalScale, final: true },
                            event: ev
                        });
                    } catch (err) {
                        console.error(`[GestureRecognizer] onGesture callback error:`, err);
                    }
                }
            }

            if (me._rotateTracking && typeof me._rotateTracking.lastAngle === 'number') {
                const deltaDeg =
                    (me._rotateTracking.lastAngle - me._rotateTracking.startAngle) *
                    (180 / Math.PI);
                if (me._onGesture) {
                    try {
                        me._onGesture({
                            gesture: 'rotate',
                            meta: { angle: deltaDeg, final: true },
                            event: ev
                        });
                    } catch (err) {
                        console.error(`[GestureRecognizer] onGesture callback error:`, err);
                    }
                }
            }

            me._touchTracking = null;
            me._pinchTracking = null;
            me._rotateTracking = null;
            return;
        }

        let direction;
        if (absDeltaX >= absDeltaY) {
            if (deltaX > 0) {
                direction = 'right';
            } else {
                direction = 'left';
            }
        } else {
            if (deltaY > 0) {
                direction = 'down';
            } else {
                direction = 'up';
            }
        }

        if (me._onGesture) {
            try {
                me._onGesture({
                    gesture: 'swipe',
                    meta: {
                        fingers,
                        direction,
                        dx: deltaX,
                        dy: deltaY,
                        duration: Date.now() - data.startTime,
                        final: true
                    },
                    event: ev
                });
            } catch (err) {
                console.error(`[GestureRecognizer] onGesture callback error:`, err);
            }
        }

        if (me._pinchTracking && me._pinchTracking.startDist) {
            const finalScale =
                (me._pinchTracking.lastDist || me._pinchTracking.startDist) /
                (me._pinchTracking.startDist || 1);
            if (me._onGesture) {
                try {
                    me._onGesture({
                        gesture: 'pinch',
                        meta: { scale: finalScale, final: true },
                        event: ev
                    });
                } catch (err) {
                    console.error(`[GestureRecognizer] onGesture callback error:`, err);
                }
            }
        }

        if (me._rotateTracking && typeof me._rotateTracking.lastAngle === 'number') {
            const deltaDeg =
                (me._rotateTracking.lastAngle - me._rotateTracking.startAngle) * (180 / Math.PI);
            if (me._onGesture) {
                try {
                    me._onGesture({
                        gesture: 'rotate',
                        meta: { angle: deltaDeg, final: true },
                        event: ev
                    });
                } catch (err) {
                    console.error(`[GestureRecognizer] onGesture callback error:`, err);
                }
            }
        }

        me._touchTracking = null;
        me._pinchTracking = null;
        me._rotateTracking = null;
    }
}
