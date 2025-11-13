/**
 * Description:
 * A Singleton service for global, reactive state management.
 * Implements an Observable Store pattern. Components can subscribe
 * to specific state keys and will be notified upon changes.
 *
 * This service is also responsible for managing the application's
 * 'activeScopes' for use by the ShortcutService.
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
 * // In ModalService (Scope Management)
 * globalState.addScope('modal-open');
 *
 * Dependencies:
 * - None
 */
export class GlobalStateService {
    /**
     * The private static instance.
     * @type {GlobalStateService | null}
     * @private
     */
    static _instance = null;

    /**
     * Private store for the state values.
     * @type {object}
     * @private
     */
    _state = {};

    /**
     * Map keying state keys to listener arrays.
     * @type {Map<string, Array<Function>>}
     * @private
     */
    _subscribers = new Map();

    /**
     * Description:
     * Private constructor for the Singleton.
     * Initializes the default 'global' scope.
     * @private
     */
    constructor() {
        if (GlobalStateService._instance) {
            console.warn('GlobalStateService is a singleton. Use getInstance().');
            return GlobalStateService._instance;
        }
        GlobalStateService._instance = this;

        const me = this;
        me._state.activeScopes = ['global'];
    }

    /**
     * Description:
     * Gets the singleton instance of the GlobalStateService.
     *
     * @returns {GlobalStateService} The singleton instance.
     * @static
     */
    static getInstance() {
        if (!GlobalStateService._instance) {
            GlobalStateService._instance = new GlobalStateService();
        }
        return GlobalStateService._instance;
    }

    /**
     * Description:
     * Retrieves the current value for a state key.
     *
     * @param {string} key - The state key.
     * @returns {*} The current value (or undefined if not set).
     */
    get(key) {
        return this._state[key];
    }

    /**
     * Description:
     * Sets the value for a state key and notifies subscribers.
     * Lazily registers the key if it doesn't exist.
     *
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
     * Description:
     * Adds a scope to the global 'activeScopes' list.
     * Notifies subscribers if the scope was added.
     *
     * @param {string} scope - The scope string to add (e.g., 'modal-open').
     * @returns {void}
     */
    addScope(scope) {
        const me = this;
        if (!scope || typeof scope !== 'string') {
            console.warn('[GlobalStateService] addScope: scope must be a non-empty string.');
            return;
        }

        const currentScopes = me.get('activeScopes') || [];
        if (currentScopes.includes(scope)) {
            return;
        }

        const newScopes = [...currentScopes, scope];
        me.set('activeScopes', newScopes);
    }

    /**
     * Description:
     * Removes a scope from the global 'activeScopes' list.
     * Notifies subscribers if the scope was removed.
     *
     * @param {string} scope - The scope string to remove (e.g., 'modal-open').
     * @returns {void}
     */
    removeScope(scope) {
        const me = this;
        if (!scope || typeof scope !== 'string') {
            console.warn('[GlobalStateService] removeScope: scope must be a non-empty string.');
            return;
        }

        const currentScopes = me.get('activeScopes') || [];
        if (!currentScopes.includes(scope)) {
            return;
        }

        const newScopes = currentScopes.filter(s => s !== scope);
        me.set('activeScopes', newScopes);
    }

    /**
     * Description:
     * Checks if a specific scope is currently active.
     *
     * @param {string} scope - The scope string to check.
     * @returns {boolean} True if the scope is in the 'activeScopes' list.
     */
    hasScope(scope) {
        const currentScopes = this.get('activeScopes') || [];
        return currentScopes.includes(scope);
    }

    /**
     * Description:
     * Subscribes to changes for a specific state key.
     * The callback is immediately invoked with the current value.
     *
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
     * Description:
     * Unsubscribes from changes for a specific state key.
     *
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

    /**
     * Description:
     * Ensures a key is initialized in the subscribers map.
     *
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
     * Description:
     * Notifies all subscribers of a specific key.
     *
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
}

export const globalState = GlobalStateService.getInstance();
