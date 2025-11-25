import { UIElement } from '../../core/UIElement.js';
import { VanillaMenuAdapter } from '../../renderers/vanilla/VanillaMenuAdapter.js';
import { TranslationService } from '../../services/TranslationService.js';
import { appBus } from '../../utils/EventBus.js';
import { generateId } from '../../utils/generateId.js';

/**
 * Description:
 * The main Menu controller for the application.
 * It acts as a centralized manager for the application menu bar, handling
 * data loading, internationalization, rendering via adapter, and event delegation
 * for all menu items and submenus.
 *
 * Properties summary:
 * - _menuItemsMap {Map<string, object>} : A lookup map for menu item configurations by ID.
 * - _dataUrl {string} : The URL to load menu configuration from.
 * - _boundGlobalClick {Function} : Bound handler for outside clicks.
 * - _boundOnMouseOver {Function} : Bound handler for hover interactions.
 * - _boundOnClick {Function} : Bound handler for click interactions.
 *
 * Typical usage:
 * const menu = new Menu();
 * await menu.load();
 * document.body.appendChild(menu.element);
 *
 * Events:
 * - Emits events specified in the menu JSON configuration via appBus.
 *
 * Business rules implemented:
 * - Inherits from UIElement -> Disposable.
 * - Loads menu structure from a JSON source.
 * - Translates menu labels using TranslationService.
 * - Delegates DOM rendering to VanillaMenuAdapter.
 * - Uses Event Delegation to handle clicks and hovers for arbitrary depth.
 * - Manages "Active/Open" states for submenus.
 * - Closes submenus when clicking outside.
 *
 * Dependencies:
 * - {import('../../core/UIElement.js').UIElement}
 * - {import('../../renderers/vanilla/VanillaMenuAdapter.js').VanillaMenuAdapter}
 * - {import('../../services/TranslationService.js').TranslationService}
 * - {import('../../utils/EventBus.js').appBus}
 * - {import('../../utils/generateId.js').generateId}
 */
export class Menu extends UIElement {
    /**
     * Map to store menu item data by ID for quick access during event handling.
     *
     * @type {Map<string, object>}
     * @private
     */
    _menuItemsMap = new Map();

    /**
     * The URL source for the menu data.
     *
     * @type {string}
     * @private
     */
    _dataUrl = './workspaces/menus/menu.js'; // Default location

    /**
     * Bound handler for global document clicks (to close menu).
     *
     * @type {Function | null}
     * @private
     */
    _boundGlobalClick = null;

    /**
     * Bound handler for menu clicks (delegated).
     *
     * @type {Function | null}
     * @private
     */
    _boundOnClick = null;

    /**
     * Bound handler for menu hover (delegated).
     *
     * @type {Function | null}
     * @private
     */
    _boundOnMouseOver = null;

    /**
     * Creates an instance of Menu.
     *
     * @param {import('../../core/IRenderer.js').IRenderer} [renderer=null] - Optional renderer adapter.
     */
    constructor(renderer = null) {
        super(generateId(), renderer || new VanillaMenuAdapter());
        const me = this;

        me._boundGlobalClick = me._onGlobalClick.bind(me);
        me._boundOnClick = me._onMenuClick.bind(me);
        me._boundOnMouseOver = me._onMenuMouseOver.bind(me);

        // Initialize DOM structure
        me.render();
    }

    /**
     * Loads the menu configuration from the source URL.
     *
     * @param {string} [url] - Optional URL to override default.
     * @returns {Promise<void>}
     */
    async load(url) {
        const me = this;
        if (url) {
            me._dataUrl = url;
        }

        try {
            // In a real scenario, this might be a fetch().
            // For local files in this architecture, we might use dynamic import.
            // Assuming the file exports 'menuData'.
            const module = await import(`../../../../${me._dataUrl}`);
            const rawData = module.menuData || [];

            const processedData = me._processMenuData(rawData);

            if (me.element) {
                me.renderer.buildMenuStructure(me.element, processedData);
            }
        } catch (error) {
            console.error('[Menu] Failed to load menu data:', error);
        }
    }

    // --- UIElement Overrides ---

    /**
     * Implementation of the rendering logic.
     * Creates the root menu element and attaches delegated listeners.
     *
     * @returns {HTMLElement} The root menu element.
     * @protected
     */
    _doRender() {
        const me = this;
        const element = me.renderer.createMenuElement(me.id);

        // Attach Delegated Events
        me.renderer.on(element, 'click', me._boundOnClick);
        me.renderer.on(element, 'mouseover', me._boundOnMouseOver);

        return element;
    }

    /**
     * Implementation of mount logic.
     * Sets up global listeners.
     *
     * @param {HTMLElement} container
     * @protected
     */
    _doMount(container) {
        const me = this;
        super._doMount(container);
        document.addEventListener('click', me._boundGlobalClick);
    }

    /**
     * Implementation of unmount logic.
     * Cleans up global listeners.
     *
     * @protected
     */
    _doUnmount() {
        const me = this;
        document.removeEventListener('click', me._boundGlobalClick);
        super._doUnmount();
    }

    // --- Logic & Helpers ---

    /**
     * Recursively processes raw menu data.
     * - Translates labels.
     * - Generates IDs.
     * - Populates _menuItemsMap.
     *
     * @param {Array<object>} items - Raw items.
     * @returns {Array<object>} Processed items ready for renderer.
     * @private
     */
    _processMenuData(items) {
        const me = this;
        const i18n = TranslationService.getInstance();

        return items.map(item => {
            const id = item.id || generateId();
            const label = item.label ? i18n.translate(item.label) : '';

            const processedItem = {
                ...item,
                id: id,
                label: label
            };

            // Store reference in map for O(1) lookup during events
            me._menuItemsMap.set(id, processedItem);

            if (item.submenu && Array.isArray(item.submenu)) {
                processedItem.submenu = me._processMenuData(item.submenu);
            }

            return processedItem;
        });
    }

    /**
     * Handles clicks delegated from the root menu element.
     *
     * @param {MouseEvent} event
     * @private
     * @returns {void}
     */
    _onMenuClick(event) {
        const me = this;
        const targetItem = me.renderer.getItemFromEvent(event);

        if (!targetItem) return;

        const id = targetItem.dataset.id;
        const itemConfig = me._menuItemsMap.get(id);

        if (!itemConfig || itemConfig.disabled) return;

        // If it has a submenu, toggle visibility handled by CSS usually (hover),
        // but for click/touch or persistent open, we might toggle a class.
        // Here, we handle Actions.
        if (itemConfig.action) {
            // Execute Action
            appBus.emit(itemConfig.action, itemConfig.payload);

            // Close menus
            me.renderer.closeAllSubmenus(me.element);
        }

        // Prevent bubbling to document which would close the menu immediately
        event.stopPropagation();
    }

    /**
     * Handles mouseover delegated from the root menu element.
     * Manages the "opening" of submenus and closing siblings.
     *
     * @param {MouseEvent} event
     * @private
     * @returns {void}
     */
    _onMenuMouseOver(event) {
        const me = this;
        const targetItem = me.renderer.getItemFromEvent(event);

        if (!targetItem) return;

        // When hovering an item, close all other open items at the SAME level
        const parentList = targetItem.parentNode; // The <ul>
        if (parentList) {
            const siblings = Array.from(parentList.children);
            siblings.forEach(sibling => {
                if (sibling !== targetItem) {
                    me.renderer.setItemActive(sibling, false);
                }
            });
        }

        // Open the current item if it has a submenu
        const id = targetItem.dataset.id;
        const itemConfig = me._menuItemsMap.get(id);

        if (itemConfig && itemConfig.submenu) {
            me.renderer.setItemActive(targetItem, true);
        }
    }

    /**
     * Handles clicks anywhere in the document to close open menus.
     *
     * @param {MouseEvent} event
     * @private
     * @returns {void}
     */
    _onGlobalClick(event) {
        const me = this;
        if (!me.element) return;

        // If click is outside the menu, close all
        if (!me.element.contains(event.target)) {
            me.renderer.closeAllSubmenus(me.element);
        }
    }
}
