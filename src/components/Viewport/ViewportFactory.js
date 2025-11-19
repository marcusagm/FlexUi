import { ApplicationWindow } from './ApplicationWindow.js';

/**
 * Description:
 * A Singleton factory and registry for creating ApplicationWindow instances.
 * This class uses the Abstract Factory and Registry patterns.
 * Window types must be registered by the application before they can be created
 * from serialized data (e.g., during workspace restoration).
 *
 * Properties summary:
 * - _instance {ViewportFactory | null} : The private static instance.
 * - _registry {Map<string, typeof ApplicationWindow>} : The registry mapping typeName to classes.
 *
 * Typical usage:
 * // In App.js (on init):
 * const factory = ViewportFactory.getInstance();
 * factory.registerWindowType('MyCustomWindow', MyCustomWindow);
 *
 * // In Viewport.fromJSON:
 * const window = ViewportFactory.getInstance().createWindow(windowData);
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Implements Singleton pattern to ensure a single registry instance.
 * - Validates that registered classes are valid constructors.
 * - Registers the base ApplicationWindow class by default.
 * - Hydrates created windows with saved state (maximized, minimized, pinned) if available.
 *
 * Dependencies:
 * - ./ApplicationWindow.js
 *
 * Notes / Additional:
 * - None
 */
export class ViewportFactory {
    /**
     * The private static instance.
     *
     * @type {ViewportFactory | null}
     * @private
     */
    static _instance = null;

    /**
     * The registry mapping typeName to classes.
     *
     * @type {Map<string, typeof ApplicationWindow>}
     * @private
     */
    _registry;

    /**
     * Private constructor for Singleton.
     */
    constructor() {
        if (ViewportFactory._instance) {
            console.warn('ViewportFactory instance already exists. Use getInstance().');
            return ViewportFactory._instance;
        }
        this.setRegistry(new Map());
        // Register the base class by default
        this.registerWindowType('ApplicationWindow', ApplicationWindow);
        ViewportFactory._instance = this;
    }

    /**
     * Gets the single instance of the ViewportFactory.
     *
     * @returns {ViewportFactory} The singleton instance.
     */
    static getInstance() {
        if (!ViewportFactory._instance) {
            ViewportFactory._instance = new ViewportFactory();
        }
        return ViewportFactory._instance;
    }

    /**
     * Registry getter.
     *
     * @returns {Map<string, typeof ApplicationWindow>}
     */
    getRegistry() {
        return this._registry;
    }

    /**
     * Registry setter with validation.
     *
     * @param {Map<string, typeof ApplicationWindow>} map
     * @returns {void}
     */
    setRegistry(map) {
        if (!(map instanceof Map)) {
            console.warn('ViewportFactory: Invalid registry provided. Must be a Map.');
            this._registry = new Map();
            return;
        }
        this._registry = map;
    }

    /**
     * Registers a Window class constructor against a string identifier.
     *
     * @param {string} typeName - The string identifier.
     * @param {typeof ApplicationWindow} windowClass - The class constructor.
     * @returns {void}
     */
    registerWindowType(typeName, windowClass) {
        const me = this;
        if (!typeName || !windowClass) {
            console.warn(
                'ViewportFactory: registerWindowType requires a typeName and windowClass.'
            );
            return;
        }
        me.getRegistry().set(typeName, windowClass);
    }

    /**
     * Creates and hydrates an ApplicationWindow instance based on its type and saved data.
     *
     * @param {object} windowData - The serialized data object for the window.
     * @returns {ApplicationWindow | null} An instantiated and hydrated window, or null.
     */
    createWindow(windowData) {
        const me = this;
        if (!windowData || !windowData.type) {
            console.warn(
                'ViewportFactory: createWindow failed, invalid data or missing type.',
                windowData
            );
            return null;
        }

        const WindowClass = me.getRegistry().get(windowData.type);

        if (!WindowClass) {
            console.warn(`ViewportFactory: No window registered for type "${windowData.type}".`);
            return null;
        }

        // Extract basic config to pass to constructor for initial state
        const config = {};
        if (windowData.geometry) {
            config.x = windowData.geometry.x;
            config.y = windowData.geometry.y;
            config.width = windowData.geometry.width;
            config.height = windowData.geometry.height;
        }

        // Instantiate with basic title/config from data
        const windowInstance = new WindowClass(windowData.title, null, config);

        // Hydrate full state (maximized, minimized, pinned, etc.)
        if (typeof windowInstance.fromJSON === 'function') {
            windowInstance.fromJSON(windowData);
        }

        return windowInstance;
    }
}
