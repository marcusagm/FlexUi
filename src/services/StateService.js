/**
 * Description:
 * A Singleton service responsible for persisting and restoring the application
 * state (the layout workspace) to and from localStorage.
 * It provides a fallback to load a default layout JSON if no saved
 * state is found or if the saved data is corrupt.
 *
 * Properties summary:
 * - _instance {StateService | null} : The private static instance for the Singleton.
 *
 * Typical usage:
 * // In App.js
 * const stateService = StateService.getInstance();
 * const layout = await stateService.loadState('my_key');
 * stateService.saveState('my_key', { layout: ... });
 *
 * Dependencies:
 * - None (loads 'workspaces/default.json' via native fetch)
 */
export class StateService {
    /**
     * @type {StateService | null}
     * @private
     */
    static _instance = null;

    /**
     * @private
     */
    constructor() {
        if (StateService._instance) {
            console.warn('StateService instance already exists. Use getInstance().');
            return StateService._instance;
        }
        StateService._instance = this;
    }

    /**
     * Gets the single instance of the StateService.
     * @returns {StateService}
     */
    static getInstance() {
        if (!StateService._instance) {
            StateService._instance = new StateService();
        }
        return StateService._instance;
    }

    /**
     * Loads and parses data from localStorage, or loads the default
     * from 'workspaces/default.json' as a fallback.
     * @param {string} key - The key to fetch from localStorage.
     * @returns {Promise<object | null>} The parsed workspace object or null on failure.
     */
    async loadState(key) {
        const saved = localStorage.getItem(key);

        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error(
                    'Failed to parse state from localStorage (corrupted data). Loading default.',
                    e
                );
            }
        }

        try {
            console.info(
                `StateService: No saved state found (key: ${key}). Loading 'workspaces/default.json'.`
            );

            const response = await fetch('workspaces/default.json');

            if (!response.ok) {
                throw new Error(`Failed to fetch default.json: ${response.statusText}`);
            }
            const defaultWorkspace = await response.json();
            return defaultWorkspace;
        } catch (fetchError) {
            console.error('Critical failure loading default workspace (default.json).', fetchError);
            return null;
        }
    }

    /**
     * Saves data to localStorage.
     * @param {string} key - The key to save under.
     * @param {object} data - The state object to be stringified and saved.
     * @returns {void}
     */
    saveState(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save state to localStorage.', e);
        }
    }

    /**
     * Removes a key from localStorage.
     * @param {string} key - The key to remove.
     * @returns {void}
     */
    clearState(key) {
        localStorage.removeItem(key);
    }
}
