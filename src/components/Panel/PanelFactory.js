import { Panel } from './Panel.js';

/**
 * Description:
 * A Singleton factory and registry for creating Panel instances.
 * This class uses the Abstract Factory and Registry patterns.
 * Panel types (like TextPanel, ToolbarPanel) must be registered
 * by the application (e.g., in App.js) before they can be created.
 *
 * It acts as a data adapter, normalizing legacy JSON structures into the
 * standardized configuration object expected by the unified Panel constructors.
 * It also handles dependency injection for the rendering engine.
 *
 * Properties summary:
 * - _instance {PanelFactory | null} : The private static instance for the Singleton.
 * - _registry {Map<string, typeof Panel>} : The registry mapping typeName strings to Panel classes.
 * - _defaultRendererFactory {Function | null} : A factory function returning an IRenderer instance.
 *
 * Typical usage:
 * // In App.js (on init):
 * const factory = PanelFactory.getInstance();
 * factory.registerPanelClasses([Panel, TextPanel, ToolbarPanel]);
 *
 * // Inject custom renderer (optional)
 * factory.setDefaultRendererFactory(() => new ReactPanelAdapter());
 *
 * // In PanelGroup.fromJSON (during hydration):
 * const panel = PanelFactory.getInstance().createPanel(panelData);
 *
 * Dependencies:
 * - {import('./Panel.js').Panel}
 */
export class PanelFactory {
    /**
     * The private static instance for the Singleton.
     *
     * @type {PanelFactory | null}
     * @private
     */
    static _instance = null;

    /**
     * The registry mapping typeName strings to Panel classes.
     *
     * @type {Map<string, typeof Panel>}
     * @private
     */
    _registry;

    /**
     * A factory function that returns a default renderer instance for new panels.
     *
     * @type {Function | null}
     * @private
     */
    _defaultRendererFactory = null;

    /**
     * Creates an instance of PanelFactory.
     * Private constructor for Singleton pattern.
     */
    constructor() {
        if (PanelFactory._instance) {
            console.warn('PanelFactory instance already exists. Use getInstance().');
            return PanelFactory._instance;
        }
        this.setRegistry(new Map());
        PanelFactory._instance = this;
    }

    /**
     * Gets the internal class registry.
     *
     * @returns {Map<string, typeof Panel>} The internal class registry.
     */
    getRegistry() {
        return this._registry;
    }

    /**
     * Sets the internal registry map.
     *
     * @param {Map<string, typeof Panel>} map - The new registry map.
     * @returns {void}
     */
    setRegistry(map) {
        if (!(map instanceof Map)) {
            console.warn('PanelFactory: Invalid registry provided. Must be a Map.');
            this._registry = new Map();
            return;
        }
        this._registry = map;
    }

    /**
     * Sets the default renderer factory function.
     * This function will be called to create a renderer instance for each new panel.
     *
     * @param {Function} factoryFunction - A function returning an IRenderer instance.
     * @returns {void}
     */
    setDefaultRendererFactory(factoryFunction) {
        const me = this;
        if (typeof factoryFunction !== 'function') {
            console.warn(
                `[PanelFactory] invalid factoryFunction assignment (${factoryFunction}). Must be a function.`
            );
            return;
        }
        me._defaultRendererFactory = factoryFunction;
    }

    /**
     * Gets the single instance of the PanelFactory.
     *
     * @returns {PanelFactory} The singleton instance.
     */
    static getInstance() {
        if (!PanelFactory._instance) {
            PanelFactory._instance = new PanelFactory();
        }
        return PanelFactory._instance;
    }

    /**
     * Registers a Panel class constructor against a string identifier.
     *
     * @param {string} typeName - The string identifier (e.g., 'TextPanel').
     * @param {typeof Panel} panelClass - The class constructor (e.g., TextPanel).
     * @returns {void}
     */
    registerPanelType(typeName, panelClass) {
        const me = this;
        if (!typeName || !panelClass) {
            console.warn('PanelFactory: registerPanelType requires a typeName and panelClass.');
            return;
        }
        me.getRegistry().set(typeName, panelClass);
    }

    /**
     * Registers multiple Panel classes at once using their static 'panelType' property.
     *
     * @param {Array<typeof Panel>} classList - An array of Panel classes.
     * @returns {void}
     */
    registerPanelClasses(classList) {
        const me = this;
        if (!Array.isArray(classList)) {
            console.warn('PanelFactory: registerPanelClasses requires an array of classes.');
            return;
        }

        classList.forEach(panelClass => {
            if (panelClass && typeof panelClass.panelType === 'string') {
                const typeName = panelClass.panelType;
                me.registerPanelType(typeName, panelClass);
            } else {
                console.warn(
                    'PanelFactory: Attempted to register a class without a static "panelType" property.',
                    panelClass
                );
            }
        });
    }

    /**
     * Creates and hydrates a Panel instance based on its type and saved data.
     * Uses the default renderer factory if configured.
     *
     * @param {object} panelData - The serialized data object for the panel.
     * @returns {Panel | null} An instantiated and hydrated Panel, or null if invalid.
     */
    createPanel(panelData) {
        const me = this;
        if (!panelData || !panelData.type) {
            console.warn(
                'PanelFactory: createPanel failed, invalid panelData or missing type.',
                panelData
            );
            return null;
        }

        const PanelClass = me.getRegistry().get(panelData.type) || Panel;

        let renderer = null;
        if (typeof me._defaultRendererFactory === 'function') {
            renderer = me._defaultRendererFactory();
        }

        // Strict Mode: Use config directly, ensuring it exists.
        // Legacy properties like 'content', 'height', 'width' at root are no longer merged automatically.
        const config = panelData.config || {};

        // Inject ID from persistence if available to ensure ID stability
        if (panelData.id) {
            config.id = panelData.id;
        }

        // Instantiate using the standardized signature: (title, config, renderer)
        const panel = new PanelClass(panelData.title, config, renderer);

        // Hydrate any remaining state (e.g., collapsed status, complex properties)
        if (typeof panel.fromJSON === 'function') {
            panel.fromJSON(panelData);
        }

        return panel;
    }
}
