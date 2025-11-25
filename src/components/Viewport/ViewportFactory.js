import { ApplicationWindow } from './ApplicationWindow.js';

/**
 * Description:
 * A Singleton factory and registry for creating ApplicationWindow instances.
 * This class uses the Abstract Factory and Registry patterns.
 * Window types must be registered by the application before they can be created
 * from serialized data (e.g., during workspace restoration).
 *
 * It now supports dependency injection for the rendering engine via setDefaultRendererFactory.
 *
 * Properties summary:
 * - _instance {ViewportFactory | null} : The private static instance.
 * - _registry {Map<string, typeof ApplicationWindow>} : The registry mapping typeName to classes.
 * - _defaultRendererFactory {Function | null} : A factory function returning an IRenderer instance.
 *
 * Typical usage:
 * // In App.js (on init):
 * const factory = ViewportFactory.getInstance();
 * factory.registerWindowType('MyCustomWindow', MyCustomWindow);
 * factory.setDefaultRendererFactory(() => new ReactWindowAdapter());
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
 * - Injects the configured renderer into new window instances.
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
     * A factory function that returns a default renderer instance for new windows.
     *
     * @type {Function | null}
     * @private
     */
    _defaultRendererFactory = null;

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
     * Sets the default renderer factory function.
     * This function will be called to create a renderer instance for each new window.
     *
     * @param {Function} factoryFunction - A function returning an IRenderer instance.
     * @returns {void}
     */
    setDefaultRendererFactory(factoryFunction) {
        const me = this;
        if (typeof factoryFunction !== 'function') {
            console.warn(
                `[ViewportFactory] invalid factoryFunction assignment (${factoryFunction}). Must be a function.`
            );
            return;
        }
        me._defaultRendererFactory = factoryFunction;
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

        let renderer = null;
        if (typeof me._defaultRendererFactory === 'function') {
            renderer = me._defaultRendererFactory();
        }

        // Instantiate with basic title/config from data and injected renderer (4th arg)
        const windowInstance = new WindowClass(windowData.title, null, config, renderer);

        // Hydrate full state (maximized, minimized, pinned, etc.)
        if (typeof windowInstance.fromJSON === 'function') {
            windowInstance.fromJSON(windowData);
        }

        return windowInstance;
    }
}
