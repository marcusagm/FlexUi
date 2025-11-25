import { ToolbarGroup } from './ToolbarGroup.js';

/**
 * Description:
 * A Singleton factory and registry for creating ToolbarGroup instances.
 * This class uses the Abstract Factory and Registry patterns.
 * ToolbarGroup types (like ApplicationGroup) must be registered
 * by the application (e.g., in App.js) before they can be created.
 *
 * It now supports dependency injection for the rendering engine via setDefaultRendererFactory.
 *
 * Properties summary:
 * - _instance {ToolbarGroupFactory | null} : The private static instance.
 * - _registry {Map<string, typeof ToolbarGroup>} : The registry mapping typeName to classes.
 * - _defaultRendererFactory {Function | null} : A factory function returning an IRenderer instance.
 *
 * Typical usage:
 * // In App.js (on init):
 * const factory = ToolbarGroupFactory.getInstance();
 * factory.registerToolbarGroupClasses([ApplicationGroup]);
 * factory.setDefaultRendererFactory(() => new ReactToolbarAdapter());
 *
 * // In ToolbarContainer.fromJSON (during hydration):
 * const group = ToolbarGroupFactory.getInstance().createToolbarGroup(groupData);
 *
 * Dependencies:
 * - ./ToolbarGroup.js
 */
export class ToolbarGroupFactory {
    /**
     * The private static instance.
     *
     * @type {ToolbarGroupFactory | null}
     * @private
     */
    static _instance = null;

    /**
     * The registry mapping typeName to classes.
     *
     * @type {Map<string, typeof ToolbarGroup>}
     * @private
     */
    _registry;

    /**
     * A factory function that returns a default renderer instance for new groups.
     *
     * @type {Function | null}
     * @private
     */
    _defaultRendererFactory = null;

    /**
     * Private constructor for Singleton.
     */
    constructor() {
        if (ToolbarGroupFactory._instance) {
            console.warn('ToolbarGroupFactory instance already exists. Use getInstance().');
            return ToolbarGroupFactory._instance;
        }
        this.setRegistry(new Map());
        ToolbarGroupFactory._instance = this;
    }

    /**
     * Gets the single instance of the ToolbarGroupFactory.
     *
     * @returns {ToolbarGroupFactory} The singleton instance.
     */
    static getInstance() {
        if (!ToolbarGroupFactory._instance) {
            ToolbarGroupFactory._instance = new ToolbarGroupFactory();
        }
        return ToolbarGroupFactory._instance;
    }

    /**
     * Registry getter.
     *
     * @returns {Map<string, typeof ToolbarGroup>}
     */
    getRegistry() {
        return this._registry;
    }

    /**
     * Registry setter with validation.
     *
     * @param {Map<string, typeof ToolbarGroup>} map
     * @returns {void}
     */
    setRegistry(map) {
        if (!(map instanceof Map)) {
            console.warn('ToolbarGroupFactory: Invalid registry provided. Must be a Map.');
            this._registry = new Map();
            return;
        }
        this._registry = map;
    }

    /**
     * Sets the default renderer factory function.
     * This function will be called to create a renderer instance for each new toolbar group.
     *
     * @param {Function} factoryFunction - A function returning an IRenderer instance.
     * @returns {void}
     */
    setDefaultRendererFactory(factoryFunction) {
        const me = this;
        if (typeof factoryFunction !== 'function') {
            console.warn(
                `[ToolbarGroupFactory] invalid factoryFunction assignment (${factoryFunction}). Must be a function.`
            );
            return;
        }
        me._defaultRendererFactory = factoryFunction;
    }

    /**
     * Registers a ToolbarGroup class constructor against a string identifier.
     *
     * @param {string} typeName - The string identifier (e.g., 'ApplicationGroup').
     * @param {typeof ToolbarGroup} groupClass - The class constructor.
     * @returns {void}
     */
    registerToolbarGroupType(typeName, groupClass) {
        const me = this;
        if (!typeName || !groupClass) {
            console.warn(
                'ToolbarGroupFactory: registerToolbarGroupType requires a typeName and groupClass.'
            );
            return;
        }
        me.getRegistry().set(typeName, groupClass);
    }

    /**
     * Registers multiple ToolbarGroup classes using their static 'toolbarGroupType'.
     *
     * @param {Array<typeof ToolbarGroup>} classList - An array of ToolbarGroup classes.
     * @returns {void}
     */
    registerToolbarGroupClasses(classList) {
        const me = this;
        if (!Array.isArray(classList)) {
            console.warn(
                'ToolbarGroupFactory: registerToolbarGroupClasses requires an array of classes.'
            );
            return;
        }

        classList.forEach(groupClass => {
            if (groupClass && typeof groupClass.toolbarGroupType === 'string') {
                const typeName = groupClass.toolbarGroupType;
                me.registerToolbarGroupType(typeName, groupClass);
            } else {
                console.warn(
                    'ToolbarGroupFactory: Attempted to register class without static "toolbarGroupType".',
                    groupClass
                );
            }
        });
    }

    /**
     * Creates and hydrates a ToolbarGroup instance based on its type and saved data.
     * Uses the default renderer factory if configured.
     *
     * @param {object} groupData - The serialized data object for the group.
     * @returns {ToolbarGroup | null} An instantiated and hydrated ToolbarGroup, or null.
     */
    createToolbarGroup(groupData) {
        const me = this;
        if (!groupData || !groupData.type) {
            console.warn(
                'ToolbarGroupFactory: createToolbarGroup failed, invalid data or missing type.',
                groupData
            );
            return null;
        }

        const GroupClass = me.getRegistry().get(groupData.type);

        if (!GroupClass) {
            console.warn(`ToolbarGroupFactory: No group registered for type "${groupData.type}".`);
            return null;
        }

        let renderer = null;
        if (typeof me._defaultRendererFactory === 'function') {
            renderer = me._defaultRendererFactory();
        }

        // Instantiate with basic title/config from data and injected renderer (3rd arg)
        const group = new GroupClass(groupData.title, groupData.config || {}, renderer);
        group.fromJSON(groupData);

        return group;
    }
}
