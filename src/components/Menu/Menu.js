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
 * - Closes submenus when clicking outside (left or right click).
 * - Implements "Click-to-Open" behavior for top-level items.
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
    _dataUrl = './workspaces/menus/menu.js';

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
            const module = await import(`../../../../${me._dataUrl}`);
            const rawData = module.default || module.menuData || [];

            const processedData = me._processMenuData(rawData);

            if (me.element) {
                me.element.innerHTML = '';
                me.renderer.buildMenuStructure(me.element, processedData);
            }
        } catch (error) {
            console.error('[Menu] Failed to load menu data:', error);
        }
    }

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
        document.addEventListener('contextmenu', me._boundGlobalClick);
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
        document.removeEventListener('contextmenu', me._boundGlobalClick);
        super._doUnmount();
    }

    /**
     * Recursively processes raw menu data.
     * - Translates labels using titleKey or label.
     * - Generates IDs.
     * - Normalizes 'children' to 'submenu'.
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
            let label = '';

            if (item.titleKey) {
                label = i18n.translate(item.titleKey);
            } else if (item.label) {
                label = i18n.translate(item.label);
            } else if (item.title) {
                label = item.title;
            }

            const processedItem = {
                ...item,
                id: id,
                label: label
            };

            me._menuItemsMap.set(id, processedItem);

            const childrenSource = item.children || item.submenu;
            if (childrenSource && Array.isArray(childrenSource)) {
                processedItem.submenu = me._processMenuData(childrenSource);
            }

            return processedItem;
        });
    }

    /**
     * Handles clicks delegated from the root menu element.
     * Implements toggle logic for top-level items.
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

        if (itemConfig.submenu) {
            const isOpen = targetItem.classList.contains('menu__item--open');

            if (isOpen) {
                me.renderer.setItemActive(targetItem, false);
            } else {
                const parentList = targetItem.parentNode;
                if (parentList && parentList.classList.contains('menu__list')) {
                    me.renderer.closeAllSubmenus(me.element);
                }
                me.renderer.setItemActive(targetItem, true);
            }
        }

        const eventName = itemConfig.event || itemConfig.action;
        if (eventName) {
            appBus.emit(eventName, itemConfig.payload);
            me.renderer.closeAllSubmenus(me.element);
        }

        event.stopPropagation();
    }

    /**
     * Handles mouseover delegated from the root menu element.
     * Implements "Click-to-Open" logic: Top-level items only open on hover
     * if the menu is already "active" (another top-level item is open).
     *
     * @param {MouseEvent} event
     * @private
     * @returns {void}
     */
    _onMenuMouseOver(event) {
        const me = this;
        const targetItem = me.renderer.getItemFromEvent(event);

        if (!targetItem) return;

        const parentList = targetItem.parentNode;

        const isTopLevel = parentList && parentList.classList.contains('menu__list');

        if (isTopLevel) {
            const activeItem = me.element.querySelector('.menu__list > .menu__item--open');

            if (!activeItem) {
                return;
            }
        }

        if (parentList) {
            const siblings = Array.from(parentList.children);
            siblings.forEach(sibling => {
                if (sibling !== targetItem) {
                    me.renderer.setItemActive(sibling, false);
                }
            });
        }

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

        if (!me.element.contains(event.target)) {
            me.renderer.closeAllSubmenus(me.element);
        }
    }
}
