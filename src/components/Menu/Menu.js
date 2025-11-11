import { MenuItem } from './MenuItem.js';
import { TranslationService } from '../../services/TranslationService.js';
import { appBus } from '../../utils/EventBus.js';

/**
 * Description:
 * Manages the main application menu bar at the top of the UI.
 * It dynamically loads the menu structure from a configuration file,
 * processes it (e.g., translation), and builds the DOM using MenuItem
 * components. It also handles global click logic to close open menus.
 *
 * Properties summary:
 * - element {HTMLElement} : The main DOM element (<div class="menu">).
 * - _namespace {string} : Unique namespace for appBus listeners.
 * - _bound... {Function | null} : Bound event handlers for cleanup.
 *
 * Typical usage:
 * // In App.js
 * this.menu = new Menu();
 * document.body.append(this.menu.element);
 * await this.menu.load();
 *
 * Events:
 * - Listens to (native): 'click' (on document)
 * - Listens to (appBus): 'menu:item-selected', 'menu:close-siblings'
 *
 * Dependencies:
 * - components/Menu/MenuItem.js
 * - services/TranslationService.js
 * - utils/EventBus.js
 */
export class Menu {
    /**
     * Unique namespace for appBus listeners.
     * @type {string}
     * @private
     */
    _namespace = 'app-menu';

    /**
     * Stores the bound reference for the global click listener.
     * @type {Function | null}
     * @private
     */
    _boundOnGlobalClick = null;

    /**
     * Stores the bound reference for the 'closeAllMenus' listener.
     * @type {Function | null}
     * @private
     */
    _boundCloseAllMenus = null;

    /**
     * Stores the bound reference for the 'closeSiblings' listener.
     * @type {Function | null}
     * @private
     */
    _boundCloseSiblings = null;

    constructor() {
        const me = this;
        me.element = document.createElement('div');
        me.element.classList.add('menu');

        me._boundOnGlobalClick = me._onGlobalClick.bind(me);
        me._boundCloseAllMenus = me.closeAllMenus.bind(me);
        me._boundCloseSiblings = me.closeSiblings.bind(me);

        me.initGlobalListeners();
    }

    /**
     * Cleans up all global document and appBus event listeners.
     * @returns {void}
     */
    destroy() {
        const me = this;
        document.removeEventListener('click', me._boundOnGlobalClick);
        appBus.offByNamespace(me._namespace);
        me.element.remove();
    }

    /**
     * Handles global clicks on the document to close the menu.
     * @param {MouseEvent} e
     * @private
     * @returns {void}
     */
    _onGlobalClick(e) {
        const me = this;
        if (!me.element.contains(e.target)) {
            me.closeAllMenus();
        }
    }

    /**
     * Asynchronously loads, processes, and builds the menu from a config file.
     * @param {string} [url='workspaces/menus/menu.js'] - The path to the menu config module.
     * @returns {Promise<void>}
     */
    async load(url = 'workspaces/menus/menu.js') {
        const me = this;
        try {
            const menuModule = await import(`../../../${url}`);
            const rawMenuData = menuModule.default;

            const i18n = TranslationService.getInstance();
            const processedItems = me._processMenuData(rawMenuData, i18n);

            me.build(processedItems);
        } catch (error) {
            console.error(`Failed to load menu module: ${url}`, error);
            me.element.innerHTML = '<div class="menu__item">Error loading menu.</div>';
        }
    }

    /**
     * Recursively processes menu data to translate 'titleKey' properties.
     * @param {Array<object>} items - The raw menu items array.
     * @param {TranslationService} i18n - The translation service instance.
     * @returns {Array<object>} The processed items array.
     * @private
     */
    _processMenuData(items, i18n) {
        if (!items || !Array.isArray(items)) {
            return [];
        }

        return items.map(item => {
            const processedItem = { ...item };

            if (item.titleKey) {
                processedItem.title = i18n.translate(item.titleKey);
            }

            if (item.children && item.children.length > 0) {
                processedItem.children = this._processMenuData(item.children, i18n);
            }

            return processedItem;
        });
    }

    /**
     * Builds the menu DOM from processed menu items.
     * @param {Array<object>} items - The processed (translated) menu items.
     * @returns {void}
     */
    build(items) {
        const me = this;
        me.element.innerHTML = '';

        items.forEach(itemData => {
            const mi = new MenuItem(itemData, 1);
            me.element.appendChild(mi.element);
        });
    }

    /**
     * Initializes all global document and appBus listeners.
     * @returns {void}
     */
    initGlobalListeners() {
        const me = this;
        const options = { namespace: me._namespace };

        document.addEventListener('click', me._boundOnGlobalClick);
        appBus.on('menu:item-selected', me._boundCloseAllMenus, options);
        appBus.on('menu:close-siblings', me._boundCloseSiblings, options);
    }

    /**
     * Closes all currently open submenus.
     * @returns {void}
     */
    closeAllMenus() {
        this.element.querySelectorAll('.menu__item--open').forEach(item => {
            item.classList.remove('menu__item--open');
        });
    }

    /**
     * Closes sibling menus when a new menu item is hovered or clicked.
     * @param {HTMLElement} target - The target MenuItem element.
     * @returns {void}
     */
    closeSiblings(target) {
        target.parentElement.querySelectorAll('.menu__item--open').forEach(sibling => {
            if (sibling !== target) {
                sibling.classList.remove('menu__item--open');
                sibling.querySelectorAll('.menu__item--open').forEach(descendant => {
                    descendant.classList.remove('menu__item--open');
                });
            }
        });
    }
}
