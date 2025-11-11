import { Panel } from './Panel.js';

/**
 * Description:
 * A Singleton factory and registry for creating Panel instances.
 * This class uses the Abstract Factory and Registry patterns.
 * Panel types (like TextPanel, ToolbarPanel) must be registered
 * by the application (e.g., in App.js) before they can be created.
 *
 * Properties summary:
 * - _instance {PanelFactory | null} : The private static instance for the Singleton.
 * - _registry {Map<string, Panel>} : The registry mapping typeName strings to Panel classes.
 *
 * Typical usage:
 * // In App.js (on init):
 * const factory = PanelFactory.getInstance();
 * factory.registerPanelClasses([Panel, TextPanel, ToolbarPanel]);
 *
 * // In PanelGroup.fromJSON (during hydration):
 * const panel = PanelFactory.getInstance().createPanel(panelData);
 *
 * Dependencies:
 * - ./Panel.js
 */
export class PanelFactory {
    /**
     * @type {PanelFactory | null}
     * @private
     */
    static _instance = null;

    /**
     * @type {Map<string, typeof Panel>}
     * @private
     */
    _registry;

    /**
     * @private
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
     * <Registry> getter.
     * @returns {Map<string, typeof Panel>} The internal class registry.
     */
    getRegistry() {
        return this._registry;
    }

    /**
     * <Registry> setter with validation.
     * @param {Map<string, typeof Panel>} map
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
     * Gets the single instance of the PanelFactory.
     * @returns {PanelFactory}
     */
    static getInstance() {
        if (!PanelFactory._instance) {
            PanelFactory._instance = new PanelFactory();
        }
        return PanelFactory._instance;
    }

    /**
     * Registers a Panel class constructor against a string identifier.
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
        const panel = new PanelClass(panelData.title, panelData.height, panelData.config || {});
        panel.fromJSON(panelData);

        return panel;
    }
}
