import { debounce } from './Debounce.js';
import { throttleRAF } from './ThrottleRAF.js';

/**
 * Description:
 * A generic publish/subscribe EventBus class.
 * It allows decoupled communication between different parts of the application.
 * This evolved version includes support for namespaces (for bulk listener removal)
 * and declarative rate limiting (debounce and throttle) on listeners.
 *
 * Properties summary:
 * - _listeners {Map<string, Array<object>>} : Stores listeners by eventName.
 *
 * Typical usage:
 * // In component A (listener)
 * import { appBus } from './EventBus.js';
 *
 * class ComponentA {
 * constructor() {
 * this.id = 'componentA';
 * appBus.on('data:updated', this.onDataUpdated.bind(this), {
 * namespace: this.id,
 * debounceMs: 100
 * });
 * }
 * onDataUpdated(data) {
 * console.log('Data updated:', data);
 * }
 * destroy() {
 * appBus.offByNamespace(this.id);
 * }
 * }
 *
 * // In component B (emitter)
 * import { appBus } from './EventBus.js';
 * appBus.emit('data:updated', { value: 123 });
 *
 * Dependencies:
 * - ./Debounce.js
 * - ./ThrottleRAF.js
 */
class EventBus {
    /**
     * Stores all listeners keyed by eventName.
     * Each listener is an object: { callback, originalCallback, namespace, isOnce }
     * @type {Map<string, Array<object>>}
     * @private
     */
    _listeners = new Map();

    constructor() {
        // Constructor is intentionally empty
    }

    /**
     * Registers a listener for an event, with options.
     *
     * @param {string} eventName - The name of the event.
     * @param {Function} callback - The function to be called.
     * @param {object} [options={}] - Configuration for the listener.
     * @param {string} [options.namespace] - A namespace for bulk removal.
     * @param {number} [options.debounceMs] - Debounce delay in milliseconds.
     * @param {boolean} [options.throttleRAF] - Throttle using requestAnimationFrame.
     * @param {boolean} [options.isOnce] - Internal flag for 'once'.
     * @returns {void}
     */
    on(eventName, callback, options = {}) {
        const me = this;
        if (!me._listeners.has(eventName)) {
            me._listeners.set(eventName, []);
        }

        let finalCallback = callback;

        if (options.throttleRAF) {
            finalCallback = throttleRAF(callback);
        } else if (options.debounceMs) {
            finalCallback = debounce(callback, options.debounceMs);
        }

        const listener = {
            callback: finalCallback,
            originalCallback: callback,
            namespace: options.namespace || null,
            isOnce: options.isOnce || false
        };

        me._listeners.get(eventName).push(listener);
    }

    /**
     * Removes a specific listener for an event.
     *
     * @param {string} eventName - The name of the event.
     * @param {Function} callback - The *original* function that was registered.
     * @returns {void}
     */
    off(eventName, callback) {
        const me = this;
        if (!me._listeners.has(eventName)) {
            return;
        }

        const eventListeners = me._listeners.get(eventName);
        const filteredListeners = eventListeners.filter(
            listener => listener.originalCallback !== callback
        );

        if (filteredListeners.length === 0) {
            me._listeners.delete(eventName);
        } else {
            me._listeners.set(eventName, filteredListeners);
        }
    }

    /**
     * Emits (dispatches) an event to all registered listeners.
     *
     * @param {string} eventName - The name of the event.
     * @param {...*} args - Arguments to be passed to the listeners.
     * @returns {void}
     */
    emit(eventName, ...args) {
        const me = this;
        if (!me._listeners.has(eventName)) {
            return;
        }

        const listeners = [...me._listeners.get(eventName)];
        for (const listener of listeners) {
            try {
                listener.callback(...args);
            } catch (e) {
                console.error(`Erro no ouvinte do evento "${eventName}":`, e);
            }

            if (listener.isOnce) {
                me.off(eventName, listener.originalCallback);
            }
        }
    }

    /**
     * Registers a listener that will be executed only once.
     *
     * @param {string} eventName - The name of the event.
     * @param {Function} callback - The function to be called.
     * @param {object} [options={}] - Configuration (namespace, debounce, throttle).
     * @returns {void}
     */
    once(eventName, callback, options = {}) {
        this.on(eventName, callback, { ...options, isOnce: true });
    }

    /**
     * Removes all listeners associated with a specific namespace.
     *
     * @param {string} namespace - The namespace to clear.
     * @returns {void}
     */
    offByNamespace(namespace) {
        const me = this;
        if (!namespace) return;

        me._listeners.forEach((listeners, eventName) => {
            const filtered = listeners.filter(l => l.namespace !== namespace);

            if (filtered.length === 0) {
                me._listeners.delete(eventName);
            } else {
                me._listeners.set(eventName, filtered);
            }
        });
    }

    /**
     * Removes all listeners for all events.
     * @returns {void}
     */
    clear() {
        this._listeners.clear();
    }
}

/**
 * Singleton instance of the EventBus used throughout the application.
 */
export const appBus = new EventBus();
