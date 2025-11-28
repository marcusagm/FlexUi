import { Window } from './Window.js';
import { Viewport } from './Viewport.js'; // Novo import
import { DropZoneType, ItemType } from '../../constants/DNDTypes.js';

/**
 * Description:
 * A Singleton factory and registry for creating Window instances and Viewport components.
 * This class uses the Abstract Factory and Registry patterns.
 * Window types must be registered by the application before they can be created
 * from serialized data (e.g., during workspace restoration).
 *
 * It now supports dependency injection for the rendering engine via setDefaultRendererFactory.
 *
 * Properties summary:
 * - _instance {ViewportFactory | null} : The private static instance.
 * - _registry {Map<string, typeof Window>} : The registry mapping typeName to classes.
 * - _defaultRendererFactory {Function | null} : A factory function returning an IRenderer instance.
 *
 * Typical usage:
 * // In App.js (on init):
 * const factory = ViewportFactory.getInstance();
 * factory.registerWindowType('MyCustomWindow', MyCustomWindow);
 *
 * // In Column.js fromJSON:
 * const viewport = ViewportFactory.getInstance().createViewport(viewportData);
 *
 * Dependencies:
 * - ./Window.js
 * - ./Viewport.js
 * - {import('../../constants/DNDTypes.js').DropZoneType}
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
     * @type {Map<string, typeof Window>}
     * @private
     */
    _registry;

    /**
     * A factory function that returns a default renderer instance for new components.
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
        // Register classes
        this.registerWindowType('Window', Window);
        this.registerWindowType(DropZoneType.VIEWPORT, Viewport); // NEW: Register Viewport type
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
     * @returns {Map<string, typeof Window>}
     */
    getRegistry() {
        return this._registry;
    }

    /**
     * Registry setter with validation.
     *
     * @param {Map<string, typeof Window>} map
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
     * Registers a Window or Viewport class constructor against a string identifier.
     *
     * @param {string} typeName - The string identifier.
     * @param {typeof Window | typeof Viewport} windowClass - The class constructor.
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
     * Creates and hydrates a Viewport instance.
     *
     * @param {object} viewportData - The serialized data object for the viewport.
     * @returns {Viewport | null} An instantiated and hydrated Viewport, or null.
     */
    createViewport(viewportData) {
        const me = this;
        if (!viewportData || !viewportData.type) {
            console.warn(
                'ViewportFactory: createViewport failed, invalid data or missing type.',
                viewportData
            );
            return null;
        }

        // Ensure type is correct, defaulting if legacy Viewport dropzone is used
        const type =
            viewportData.type === ItemType.VIEWPORT ? DropZoneType.VIEWPORT : viewportData.type;

        const ViewportClass = me.getRegistry().get(type);

        if (!ViewportClass) {
            console.warn(`ViewportFactory: No class registered for type "${type}".`);
            return null;
        }

        let renderer = null;
        if (typeof me._defaultRendererFactory === 'function') {
            renderer = me._defaultRendererFactory();
        }

        // Viewport constructor is: constructor(id = null, renderer = null)
        const viewportInstance = new ViewportClass(viewportData.id, renderer);

        // Hydrate state (windows, config, etc.)
        if (typeof viewportInstance.fromJSON === 'function') {
            viewportInstance.fromJSON(viewportData);
        }

        return viewportInstance;
    }

    /**
     * Creates and hydrates an Window instance based on its type and saved data.
     *
     * @param {object} windowData - The serialized data object for the window.
     * @returns {Window | null} An instantiated and hydrated window, or null.
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

        // Instantiate with basic title/config from data and injected renderer
        const windowInstance = new WindowClass(windowData.title, null, config, renderer);

        // Hydrate full state (maximized, minimized, pinned, etc.)
        if (typeof windowInstance.fromJSON === 'function') {
            windowInstance.fromJSON(windowData);
        }

        return windowInstance;
    }
}
