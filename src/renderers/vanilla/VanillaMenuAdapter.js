import { VanillaRenderer } from './VanillaRenderer.js';

/**
 * Description:
 * A specialized adapter for rendering the hierarchical application Menu.
 * It encapsulates the recursive creation of menu items and submenus,
 * along with DOM utilities for handling hover states, active classes,
 * and event delegation.
 *
 * Properties summary:
 * - None
 *
 * Typical usage:
 * const adapter = new VanillaMenuAdapter();
 * const menuRoot = adapter.createMenuElement('main-menu');
 * adapter.buildMenuStructure(menuRoot, menuItemsData);
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Enforces BEM structure (.menu, .menu__item, .menu__submenu).
 * - Recursively builds the DOM tree from a nested data structure.
 * - Manages visual states for dropdowns (active/open).
 *
 * Dependencies:
 * - {import('./VanillaRenderer.js').VanillaRenderer}
 */
export class VanillaMenuAdapter extends VanillaRenderer {
    /**
     * Creates an instance of VanillaMenuAdapter.
     */
    constructor() {
        super();
    }

    /**
     * Creates the root DOM element for the Menu.
     *
     * @param {string} id - The unique ID of the menu.
     * @returns {HTMLElement} The root menu element.
     * @throws {Error} If the ID is invalid.
     */
    createMenuElement(id) {
        const me = this;
        if (typeof id !== 'string' || id.trim() === '') {
            throw new Error(
                `[VanillaMenuAdapter] Invalid id: "${id}". Must be a non-empty string.`
            );
        }

        const element = me.createElement('nav', {
            className: 'menu',
            id: `menu-${id}`
        });

        // Accessibility
        element.setAttribute('role', 'menubar');

        return element;
    }

    /**
     * Recursively builds the menu structure (items and submenus).
     * Clears existing content before building.
     *
     * @param {HTMLElement} container - The parent container (root or submenu).
     * @param {Array<object>} items - The list of item configuration objects.
     * @returns {void}
     */
    buildMenuStructure(container, items) {
        const me = this;
        if (!container || !Array.isArray(items)) return;

        container.innerHTML = '';

        const listElement = me.createElement('ul', {
            className: container.classList.contains('menu') ? 'menu__list' : 'menu__submenu'
        });

        if (container.classList.contains('menu')) {
            listElement.setAttribute('role', 'menubar');
        } else {
            listElement.setAttribute('role', 'menu');
        }

        items.forEach(itemData => {
            const itemElement = me._createMenuItemElement(itemData);

            // Recursion for submenus
            if (itemData.submenu && Array.isArray(itemData.submenu)) {
                // Make the item a container for the submenu
                itemElement.classList.add('menu__item--has-submenu');
                itemElement.setAttribute('aria-haspopup', 'true');
                itemElement.setAttribute('aria-expanded', 'false');

                // Build children
                me.buildMenuStructure(itemElement, itemData.submenu);
            }

            me.mount(listElement, itemElement);
        });

        me.mount(container, listElement);
    }

    /**
     * Helper to create a single LI element with its internal content (Title, Shortcut, Icon).
     *
     * @param {object} itemData - The item configuration.
     * @returns {HTMLElement} The list item element.
     * @private
     */
    _createMenuItemElement(itemData) {
        const me = this;
        const item = me.createElement('li', {
            className: 'menu__item',
            dataset: {
                id: itemData.id || '',
                action: itemData.action || ''
            }
        });
        item.setAttribute('role', 'menuitem');

        // Separator Logic
        if (itemData.type === 'separator') {
            item.classList.add('menu__separator');
            item.setAttribute('role', 'separator');
            return item;
        }

        // Disabled Logic
        if (itemData.disabled) {
            item.classList.add('menu__item--disabled');
            item.setAttribute('aria-disabled', 'true');
        }

        // Content Container (Title/Label)
        const titleDiv = me.createElement('div', {
            className: 'menu__title'
        });
        titleDiv.textContent = itemData.label || 'Untitled';

        // Icon (Optional)
        if (itemData.icon) {
            const iconSpan = me.createElement('span', {
                className: `icon ${itemData.icon}`
            });
            // Prepend icon
            if (titleDiv.firstChild) {
                titleDiv.insertBefore(iconSpan, titleDiv.firstChild);
            } else {
                titleDiv.appendChild(iconSpan);
            }
        }

        me.mount(item, titleDiv);

        // Shortcut hint (Optional)
        if (itemData.shortcut) {
            const shortcutSpan = me.createElement('span', {
                className: 'menu__shortcut'
            });
            shortcutSpan.textContent = itemData.shortcut;
            me.mount(item, shortcutSpan);
        }

        // Submenu Arrow Indicator (if applicable)
        if (itemData.submenu && itemData.submenu.length > 0) {
            const arrow = me.createElement('span', {
                className: 'menu__arrow'
            });
            // Simple CSS arrow or icon
            arrow.innerHTML = '&#9656;';
            me.mount(item, arrow);
        }

        return item;
    }

    /**
     * Sets an item as active (open submenu).
     *
     * @param {HTMLElement} itemElement - The menu item LI.
     * @param {boolean} isActive - True to open, false to close.
     * @returns {void}
     */
    setItemActive(itemElement, isActive) {
        if (!itemElement) return;

        if (isActive) {
            itemElement.classList.add('menu__item--open');
            itemElement.setAttribute('aria-expanded', 'true');
        } else {
            itemElement.classList.remove('menu__item--open');
            itemElement.setAttribute('aria-expanded', 'false');
        }
    }

    /**
     * Closes all submenus within a container (deeply).
     *
     * @param {HTMLElement} containerElement - The root menu or submenu container.
     * @returns {void}
     */
    closeAllSubmenus(containerElement) {
        if (!containerElement) return;

        const openItems = containerElement.querySelectorAll('.menu__item--open');
        openItems.forEach(item => {
            item.classList.remove('menu__item--open');
            item.setAttribute('aria-expanded', 'false');
        });
    }

    /**
     * Utilities to find the closest menu item from an event target (Delegation).
     *
     * @param {Event} event - The DOM event.
     * @returns {HTMLElement|null} The closest .menu__item element.
     */
    getItemFromEvent(event) {
        const target = event.target;
        if (target instanceof HTMLElement) {
            return target.closest('.menu__item');
        }
        return null;
    }
}
