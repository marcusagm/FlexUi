import { Disposable, toDisposable } from './Disposable.js';
import { LeakageMonitor } from './LeakageMonitor.js';

/**
 * Description:
 * A strongly-typed event emitter that provides a subscription mechanism via
 * the `event` property. It integrates with the Disposable pattern to ensure
 * listeners can be easily unsubscribed and resources cleaned up.
 *
 * Properties summary:
 * - _listeners {Set<Function>} : A set of registered callback functions.
 * - event {Function} : The public API to register a listener. Returns a Disposable.
 *
 * Typical usage:
 * const changeEmitter = new Emitter();
 * const onDidChange = changeEmitter.event;
 * const listener = onDidChange((event) => console.log(event));
 * changeEmitter.fire({ value: 1 });
 * listener.dispose();
 *
 * Events:
 * - None (It is the engine for events).
 *
 * Business rules implemented:
 * - Listeners are unique (Set-based).
 * - Firing an event executes all listeners safely (errors are caught).
 * - Disposing the emitter clears all listeners.
 * - Integrates with LeakageMonitor for debug diagnostics.
 *
 * Dependencies:
 * - ./Disposable.js
 * - ./LeakageMonitor.js
 */
export class Emitter extends Disposable {
    /**
     * A set of registered callback functions.
     *
     * @type {Set<Function>}
     * @private
     */
    _listeners;

    /**
     * Creates an instance of Emitter.
     */
    constructor() {
        super();
        const me = this;
        me._listeners = new Set();
    }

    /**
     * The public interface for subscribing to this emitter.
     * Returns a function that accepts a listener and returns a Disposable.
     *
     * @returns {Function} A subscription function: (listener) => Disposable.
     */
    get event() {
        const me = this;
        return listener => {
            if (me.isDisposed) {
                console.warn('[Emitter] Attempted to subscribe to a disposed emitter.');
                return toDisposable(() => {});
            }

            if (typeof listener !== 'function') {
                console.warn(
                    `[Emitter] invalid listener assignment (${listener}). Listener must be a function.`
                );
                return toDisposable(() => {});
            }

            me._listeners.add(listener);

            // Debug: Monitor Leakage
            if (typeof window !== 'undefined' && window.FLEXUI_DEBUG) {
                const trace = new Error('[LeakageMonitor] Emitter subscription').stack;
                LeakageMonitor.getInstance().add(listener, trace);
            }

            return toDisposable(() => {
                if (!me.isDisposed) {
                    me._listeners.delete(listener);

                    // Debug: Remove from Monitor
                    if (typeof window !== 'undefined' && window.FLEXUI_DEBUG) {
                        LeakageMonitor.getInstance().delete(listener);
                    }
                }
            });
        };
    }

    /**
     * Triggers the event, executing all registered listeners with the provided data.
     *
     * @param {*} [eventData] - The data to pass to the listeners.
     * @returns {void}
     */
    fire(eventData) {
        const me = this;
        if (me.isDisposed) {
            return;
        }

        // Execute safely to prevent one listener from breaking the loop
        me._listeners.forEach(listener => {
            try {
                listener.call(undefined, eventData);
            } catch (error) {
                console.error('[Emitter] Error executing listener:', error);
            }
        });
    }

    /**
     * Clears all listeners and disposes the emitter.
     *
     * @returns {void}
     */
    dispose() {
        const me = this;
        if (!me.isDisposed) {
            // Debug: Batch cleanup for Monitor
            if (typeof window !== 'undefined' && window.FLEXUI_DEBUG) {
                const monitor = LeakageMonitor.getInstance();
                me._listeners.forEach(listener => monitor.delete(listener));
            }

            me._listeners.clear();
            super.dispose();
        }
    }
}

/**
 * Description:
 * An extension of Emitter that can pause event firing.
 * When paused, events are queued and flushed upon resumption.
 * Useful for batch operations to prevent event storms.
 *
 * Properties summary:
 * - _isPaused {boolean} : Indicates if the emitter is currently paused.
 * - _eventQueue {Array<*>} : A queue of event data waiting to be fired.
 *
 * Typical usage:
 * const emitter = new PauseableEmitter();
 * emitter.pause();
 * emitter.fire(1); // Queued
 * emitter.fire(2); // Queued
 * emitter.resume(); // Fires 1, then 2
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - While paused, `fire()` pushes data to a queue instead of executing listeners.
 * - `resume()` flushes the queue in FIFO order.
 * - Inherits disposal logic from Emitter.
 *
 * Dependencies:
 * - Emitter
 */
export class PauseableEmitter extends Emitter {
    /**
     * Indicates if the emitter is currently paused.
     *
     * @type {boolean}
     * @private
     */
    _isPaused = false;

    /**
     * A queue of event data waiting to be fired.
     *
     * @type {Array<*>}
     * @private
     */
    _eventQueue;

    /**
     * Creates an instance of PauseableEmitter.
     */
    constructor() {
        super();
        const me = this;
        me._eventQueue = [];
    }

    /**
     * Pauses the emitter. Subsequent calls to fire() will be queued.
     *
     * @returns {void}
     */
    pause() {
        this._isPaused = true;
    }

    /**
     * Resumes the emitter and flushes any queued events.
     *
     * @returns {void}
     */
    resume() {
        const me = this;
        me._isPaused = false;

        if (me._eventQueue.length > 0) {
            // Flush queue
            me._eventQueue.forEach(eventData => {
                super.fire(eventData);
            });
            me._eventQueue = [];
        }
    }

    /**
     * Fires an event or queues it if paused.
     *
     * @param {*} [eventData] - The data to pass to listeners.
     * @returns {void}
     */
    fire(eventData) {
        const me = this;
        if (me.isDisposed) {
            return;
        }

        if (me._isPaused) {
            me._eventQueue.push(eventData);
        } else {
            super.fire(eventData);
        }
    }
}
