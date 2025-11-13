/**
 * Description:
 * Manages gamepadconnected/gamepaddisconnected events and a RAF-based polling loop.
 * Emits callbacks when a button is newly pressed and when an axis value
 * crosses a configured threshold.
 *
 * Properties summary:
 * - _pollIntervalMs {number} : Poll interval in milliseconds (RAF loop uses this to throttle)
 * - _rafId {number|null} : requestAnimationFrame id for the polling loop
 * - _lastPollTs {number} : timestamp of last poll
 * - _cache {Object} : internal cache for button/axis previous values
 * - _onButton {Function|null} : callback(gamepadIndex, buttonIndex)
 * - _onAxis {Function|null} : callback(gamepadIndex, axisIndex, value)
 * - _axisThreshold {number} : absolute threshold for axis event emission
 * - _boundConnected {Function} : Bound handler for 'gamepadconnected'
 * - _boundDisconnected {Function} : Bound handler for 'gamepaddisconnected'
 *
 * Typical usage:
 * // Instantiated by ShortcutService
 * const gm = new GamepadManager({
 * pollIntervalMs: 100,
 * onButton: (g,b) => {},
 * onAxis: (g,a,v) => {}
 * });
 * gm.start();
 *
 * Dependencies:
 * - None (self-contained DOM interaction)
 */
export class GamepadManager {
    /**
     * Internal poll interval backing field (ms).
     * @type {number}
     * @private
     */
    _pollIntervalMs = 100;

    /**
     * requestAnimationFrame id (or null).
     * @type {number|null}
     * @private
     */
    _rafId = null;

    /**
     * Timestamp of last poll run.
     * @type {number}
     * @private
     */
    _lastPollTs = 0;

    /**
     * Internal cache storing previous button/axis states.
     * @type {Object}
     * @private
     */
    _cache = {};

    /**
     * Button callback: function(gamepadIndex, buttonIndex)
     * @type {Function|null}
     * @private
     */
    _onButton = null;

    /**
     * Axis callback: function(gamepadIndex, axisIndex, value)
     * @type {Function|null}
     * @private
     */
    _onAxis = null;

    /**
     * Axis threshold absolute value to trigger axis events.
     * @type {number}
     * @private
     */
    _axisThreshold = 0.9;

    /**
     * Bound handlers for connect/disconnect events.
     * @type {Function|null}
     * @private
     */
    _boundConnected = null;

    /**
     * Bound handlers for connect/disconnect events.
     * @type {Function|null}
     * @private
     */
    _boundDisconnected = null;

    /**
     * Description:
     * Creates an instance of the GamepadManager.
     *
     * @param {Object} [options] - Configuration options.
     * @param {number} [options.pollIntervalMs=100] - desired poll throttle in milliseconds (minimum 16ms)
     * @param {Function|null} [options.onButton=null] - callback(gamepadIndex, buttonIndex)
     * @param {Function|null} [options.onAxis=null] - callback(gamepadIndex, axisIndex, value)
     * @param {number} [options.axisThreshold=0.9] - absolute axis threshold for emission (between 0 and 1)
     */
    constructor({
        pollIntervalMs = 100,
        onButton = null,
        onAxis = null,
        axisThreshold = 0.9
    } = {}) {
        const me = this;
        me.pollIntervalMs = pollIntervalMs;
        me.onButton = onButton;
        me.onAxis = onAxis;
        me.axisThreshold = axisThreshold;

        me._cache = {};

        me._boundConnected = me._onConnected.bind(me);
        me._boundDisconnected = me._onDisconnected.bind(me);

        if (typeof window !== 'undefined' && window.addEventListener) {
            try {
                window.addEventListener('gamepadconnected', me._boundConnected);
                window.addEventListener('gamepaddisconnected', me._boundDisconnected);
            } catch (e) {
                console.warn(`[GamepadManager] failed to add gamepad event listeners: ${e}`);
            }
        }
    }

    /* ----------------------
     Getters / setters
    ---------------------- */

    /**
     * <pollIntervalMs> getter.
     *
     * @returns {number} The current poll interval in milliseconds.
     */
    get pollIntervalMs() {
        return this._pollIntervalMs;
    }

    /**
     * <pollIntervalMs> setter with validation.
     *
     * @param {number} value - milliseconds, finite number >= 16
     * @returns {void}
     */
    set pollIntervalMs(value) {
        const me = this;
        const num = Number(value);
        if (!Number.isFinite(num) || num < 16) {
            console.warn(
                `[GamepadManager] invalid pollIntervalMs assignment (${value}). pollIntervalMs must be a finite number >= 16. Keeping previous value: ${me._pollIntervalMs}`
            );
            return;
        }
        me._pollIntervalMs = Math.floor(num);
    }

    /**
     * <axisThreshold> getter.
     *
     * @returns {number} The current axis threshold (0-1).
     */
    get axisThreshold() {
        return this._axisThreshold;
    }

    /**
     * <axisThreshold> setter with validation.
     *
     * @param {number} value - absolute threshold in range [0, 1]
     * @returns {void}
     */
    set axisThreshold(value) {
        const me = this;
        const num = Number(value);
        if (!Number.isFinite(num) || num < 0 || num > 1) {
            console.warn(
                `[GamepadManager] invalid axisThreshold assignment (${value}). axisThreshold must be a finite number between 0 and 1. Keeping previous value: ${me._axisThreshold}`
            );
            return;
        }
        me._axisThreshold = num;
    }

    /**
     * <onButton> setter.
     *
     * @param {Function|null} fn - function(gamepadIndex, buttonIndex) or null
     * @returns {void}
     */
    set onButton(fn) {
        this._onButton = typeof fn === 'function' ? fn : null;
    }

    /**
     * <onButton> getter.
     *
     * @returns {Function|null} The current onButton callback.
     */
    get onButton() {
        return this._onButton;
    }

    /**
     * <onAxis> setter.
     *
     * @param {Function|null} fn - function(gamepadIndex, axisIndex, value) or null
     * @returns {void}
     */
    set onAxis(fn) {
        this._onAxis = typeof fn === 'function' ? fn : null;
    }

    /**
     * <onAxis> getter.
     *
     * @returns {Function|null} The current onAxis callback.
     */
    get onAxis() {
        return this._onAxis;
    }

    /* ----------------------
     Concrete methods
    ---------------------- */

    /**
     * Description:
     * Start polling loop. If navigator.getGamepads is not available this is a no-op.
     *
     * @returns {void}
     */
    start() {
        const me = this;
        if (me._rafId) {
            return;
        }
        if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
            return;
        }

        me._lastPollTs = 0;

        const loop = timestamp => {
            try {
                if (!me._rafId) {
                    return;
                }
                if (!me._lastPollTs || timestamp - me._lastPollTs >= me._pollIntervalMs) {
                    me._lastPollTs = timestamp;
                    me._pollOnce();
                }
            } catch (e) {
                console.warn(`[GamepadManager] error in polling loop: ${e}`);
            } finally {
                me._rafId = requestAnimationFrame(loop);
            }
        };

        me._rafId = requestAnimationFrame(loop);
    }

    /**
     * Description:
     * Stop polling loop and clear internal caches.
     *
     * @returns {void}
     */
    stop() {
        const me = this;
        if (me._rafId) {
            try {
                cancelAnimationFrame(me._rafId);
            } catch (e) {
                /* ignore cancel errors */
            }
            me._rafId = null;
        }
        me._lastPollTs = 0;
        me._cache = {};
    }

    /**
     * Description:
     * Internal single poll pass. Separated for testability.
     *
     * @private
     * @returns {void}
     */
    _pollOnce() {
        const me = this;
        if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
            return;
        }
        let gamepads = [];
        try {
            const raw = navigator.getGamepads ? navigator.getGamepads() : [];
            gamepads = Array.from(raw || []);
        } catch (e) {
            console.warn(`[GamepadManager] error fetching gamepads: ${e}`);
            return;
        }

        for (let gpIndex = 0; gpIndex < gamepads.length; gpIndex += 1) {
            const gamepad = gamepads[gpIndex];
            if (!gamepad) {
                continue;
            }

            for (let buttonIndex = 0; buttonIndex < gamepad.buttons.length; buttonIndex += 1) {
                const pressed = !!gamepad.buttons[buttonIndex].pressed;
                const key = `Gamepad:${gpIndex}:button:${buttonIndex}`;
                const prev = !!me._cache[key];
                if (pressed && !prev) {
                    try {
                        if (me._onButton) {
                            me._onButton(gpIndex, buttonIndex);
                        }
                    } catch (err) {
                        console.error(`[GamepadManager] onButton handler error:`, err);
                    }
                }
                me._cache[key] = pressed;
            }

            for (let axisIndex = 0; axisIndex < gamepad.axes.length; axisIndex += 1) {
                const value = Number(gamepad.axes[axisIndex]) || 0;
                const key = `Gamepad:${gpIndex}:axis:${axisIndex}`;
                const prev = typeof me._cache[key] === 'number' ? me._cache[key] : 0;
                const absValue = Math.abs(value);
                const absPrev = Math.abs(prev);
                if (absValue > me._axisThreshold && absPrev <= me._axisThreshold) {
                    try {
                        if (me._onAxis) {
                            me._onAxis(gpIndex, axisIndex, value);
                        }
                    } catch (err) {
                        console.error(`[GamepadManager] onAxis handler error:`, err);
                    }
                }
                me._cache[key] = value;
            }
        }
    }

    /**
     * Description:
     * Internal: handle gamepadconnected event (starts polling).
     *
     * @private
     * @param {Event} ev
     * @returns {void}
     */
    _onConnected(ev) {
        const me = this;
        try {
            me.start();
        } catch (e) {
            console.warn(`[GamepadManager] onConnected error: ${e}`);
        }
    }

    /**
     * Description:
     * Internal: handle gamepaddisconnected event (stops polling if none present).
     *
     * @private
     * @param {Event} ev
     * @returns {void}
     */
    _onDisconnected(ev) {
        const me = this;
        try {
            const raw =
                typeof navigator !== 'undefined' && navigator.getGamepads
                    ? navigator.getGamepads()
                    : [];
            const anyConnected = Array.from(raw || []).some(gp => !!gp);
            if (!anyConnected) {
                me.stop();
            }
        } catch (e) {
            console.warn(`[GamepadManager] onDisconnected error: ${e}`);
        }
    }

    /**
     * Description:
     * Dispose manager and detach any global listeners.
     *
     * @returns {void}
     */
    dispose() {
        const me = this;
        me.stop();
        if (typeof window !== 'undefined' && window.removeEventListener) {
            try {
                if (me._boundConnected) {
                    window.removeEventListener('gamepadconnected', me._boundConnected);
                }
                if (me._boundDisconnected) {
                    window.removeEventListener('gamepaddisconnected', me._boundDisconnected);
                }
            } catch (e) {
                /* ignore removal errors */
            }
        }
        me._onButton = null;
        me._onAxis = null;
        me._boundConnected = null;
        me._boundDisconnected = null;
        me._cache = {};
    }
}
