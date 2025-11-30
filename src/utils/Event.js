import { Emitter, CompositeDisposable } from '../core/index.js';
import { debounce } from './Debounce.js';
import { throttleRAF } from './ThrottleRAF.js';

/**
 * Description:
 * A global Event Bus utilizing the Emitter pattern for centralized event management.
 * It provides a decoupled communication channel between components and services.
 *
 * Key features:
 * - Namespace support for batch disposal of listeners (critical for component lifecycle).
 * - Built-in rate limiting (debounce and throttleRAF) options for subscriptions.
 * - Integration with the core Emitter class for standardized event dispatching.
 * - Automatic resource management via CompositeDisposable.
 *
 * Properties summary:
 * - _emitters {Map<string, Emitter>} : Map of event names to Emitter instances.
 * - _namespaces {Map<string, CompositeDisposable>} : Map of namespaces to grouped disposables.
 *
 *
 * Typical usage:
 * // Subscribe
 * Event.on('my-event', (data) => console.log(data), { namespace: 'my-comp-id' });
 *
 * // Emit
 * Event.emit('my-event', { value: 123 });
 *
 * // Cleanup
 * Event.offByNamespace('my-comp-id');
 *
 * Dependencies:
 * - {import('../core/index.js').Emitter}
 * - {import('../core/index.js').CompositeDisposable}
 * - {import('./Debounce.js').debounce}
 * - {import('./ThrottleRAF.js').throttleRAF}
 */
export class EventService {
    /**
     * Map of event names to Emitter instances.
     *
     * @type {Map<string, Emitter>}
     * @private
     */
    _emitters = new Map();

    /**
     * Map of namespaces to CompositeDisposable groups.
     * Used for bulk unsubscription.
     *
     * @type {Map<string, CompositeDisposable>}
     * @private
     */
    _namespaces = new Map();

    /**
     * Retrieves or creates an Emitter for a specific event name.
     *
     * @param {string} eventName - The name of the event.
     * @returns {Emitter} The emitter instance.
     * @private
     */
    _getEmitter(eventName) {
        if (!this._emitters.has(eventName)) {
            this._emitters.set(eventName, new Emitter());
        }
        return this._emitters.get(eventName);
    }

    /**
     * Registers a listener for a specific event.
     *
     * @param {string} eventName - The name of the event.
     * @param {Function} callback - The listener function.
     * @param {object} [options={}] - Configuration options.
     * @param {string} [options.namespace] - A namespace ID to group this listener for easy removal.
     * @param {number} [options.debounceMs] - If set, debounces the callback by N ms.
     * @param {boolean} [options.throttleRAF] - If true, throttles the callback using requestAnimationFrame.
     * @returns {import('../core/Disposable.js').Disposable} A disposable object to unsubscribe the listener.
     */
    on(eventName, callback, options = {}) {
        const me = this;
        const emitter = me._getEmitter(eventName);
        let finalCallback = callback;

        if (options.debounceMs && typeof options.debounceMs === 'number') {
            finalCallback = debounce(callback, options.debounceMs);
        } else if (options.throttleRAF) {
            finalCallback = throttleRAF(callback);
        }

        const disposable = emitter.event(finalCallback);

        if (options.namespace) {
            if (!me._namespaces.has(options.namespace)) {
                me._namespaces.set(options.namespace, new CompositeDisposable());
            }
            me._namespaces.get(options.namespace).add(disposable);
        }

        return disposable;
    }

    /**
     * Emits an event with the provided arguments.
     * Safe to call even if no listeners are registered.
     *
     * @param {string} eventName - The name of the event.
     * @param {...*} args - Arguments to pass to listeners.
     * @returns {void}
     */
    emit(eventName, ...args) {
        const emitter = this._emitters.get(eventName);
        if (emitter) {
            emitter.fire(...args);
        }
    }

    /**
     * Unsubscribes all listeners associated with a specific namespace.
     * This is typically called when a component (like a Panel or Viewport) is destroyed.
     *
     * @param {string} namespace - The namespace identifier to clear.
     * @returns {void}
     */
    offByNamespace(namespace) {
        const group = this._namespaces.get(namespace);
        if (group) {
            group.dispose();
            this._namespaces.delete(namespace);
        }
    }

    /**
     * Registers a one-time listener for a specific event.
     * The listener is automatically removed after the first execution.
     *
     * @param {string} eventName - The name of the event.
     * @param {Function} callback - The listener function.
     * @param {object} [options={}] - Configuration options (namespace, etc.).
     * @returns {import('../core/Disposable.js').Disposable}
     */
    once(eventName, callback, options = {}) {
        const me = this;

        const wrapper = (...args) => {
            try {
                callback(...args);
            } finally {
                if (disposable) {
                    disposable.dispose();
                }
            }
        };

        const disposable = me.on(eventName, wrapper, options);
        return disposable;
    }

    /**
     * Clears all emitters and namespaces.
     * Should be used carefully, primarily for app resets or tests.
     *
     * @returns {void}
     */
    clear() {
        this._namespaces.forEach(group => group.dispose());
        this._namespaces.clear();

        this._emitters.forEach(emitter => emitter.dispose());
        this._emitters.clear();
    }
}

export const Event = new EventService();
