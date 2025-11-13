/**
 * Description:
 * A Singleton service for global, reactive state management.
 * Implements an Observable Store pattern. Components can subscribe
 * to specific state keys and will be notified upon changes.
 *
 * Properties summary:
 * - _instance {GlobalStateService | null} : The private static instance.
 * - _state {object} : Private store for the state values.
 * - _subscribers {Map<string, Array<Function>>} : Map keying state keys to listener arrays.
 *
 * Typical usage:
 * // In Component A (e.g., ColorWheelPanel)
 * globalState.subscribe('activeColor', (color) => {
 * this.updateColor(color);
 * });
 *
 * // In Component B (e.g., ToolbarPanel)
 * globalState.set('activeColor', '#FF0000');
 *
 * // In Component C (e.g., BackgroundPanel)
 * const currentColor = globalState.get('activeColor');
 *
 * Dependencies:
 * - None
 *
 * Notes / Additional:
 * - Keys are registered lazily (on first 'set' or 'subscribe').
 */
class GlobalStateService {
    /**
     * @type {GlobalStateService | null}
     * @private
     */
    static _instance = null;

    /**
     * @type {object}
     * @private
     */
    _state = {};

    /**
     * @type {Map<string, Array<Function>>}
     * @private
     */
    _subscribers = new Map();

    /**
     * @private
     */
    constructor() {
        if (GlobalStateService._instance) {
            console.warn('GlobalStateService is a singleton. Use getInstance().');
            return GlobalStateService._instance;
        }
        GlobalStateService._instance = this;
    }

    /**
     * Gets the singleton instance of the GlobalStateService.
     * @returns {GlobalStateService} The singleton instance.
     */
    static getInstance() {
        if (!GlobalStateService._instance) {
            GlobalStateService._instance = new GlobalStateService();
        }
        return GlobalStateService._instance;
    }

    /**
     * Ensures a key is initialized in the subscribers map.
     * @param {string} key - The state key.
     * @private
     * @returns {void}
     */
    _ensureKey(key) {
        const me = this;
        if (!me._subscribers.has(key)) {
            me._subscribers.set(key, []);
        }
    }

    /**
     * Retrieves the current value for a state key.
     * @param {string} key - The state key.
     * @returns {*} The current value (or undefined if not set).
     */
    get(key) {
        return this._state[key];
    }

    /**
     * Sets the value for a state key and notifies subscribers.
     * Lazily registers the key if it doesn't exist.
     * @param {string} key - The state key to set.
     * @param {*} value - The new value.
     * @returns {void}
     */
    set(key, value) {
        const me = this;
        me._ensureKey(key);

        if (me._state[key] === value) {
            return;
        }

        me._state[key] = value;
        me._notify(key, value);
    }

    /**
     * Notifies all subscribers of a specific key.
     * @param {string} key - The state key that changed.
     * @param {*} value - The new value to broadcast.
     * @private
     * @returns {void}
     */
    _notify(key, value) {
        const me = this;
        const callbacks = me._subscribers.get(key);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(value);
                } catch (e) {
                    console.error(`Error in GlobalStateService subscriber for key "${key}":`, e);
                }
            });
        }
    }

    /**
     * Subscribes to changes for a specific state key.
     * The callback is immediately invoked with the current value.
     * @param {string} key - The state key to observe.
     * @param {Function} callback - The function to call on change (receives the new value).
     * @returns {void}
     */
    subscribe(key, callback) {
        const me = this;
        me._ensureKey(key);

        if (typeof callback !== 'function') {
            console.warn(
                `GlobalStateService.subscribe: callback for key "${key}" is not a function.`
            );
            return;
        }

        me._subscribers.get(key).push(callback);
        callback(me._state[key]);
    }

    /**
     * Unsubscribes from changes for a specific state key.
     * @param {string} key - The state key.
     * @param {Function} callback - The specific callback function to remove.
     * @returns {void}
     */
    unsubscribe(key, callback) {
        const me = this;
        if (!me._subscribers.has(key)) {
            return;
        }

        const callbacks = me._subscribers.get(key);
        const filteredCallbacks = callbacks.filter(cb => cb !== callback);
        me._subscribers.set(key, filteredCallbacks);
    }
}

export const globalState = GlobalStateService.getInstance();
