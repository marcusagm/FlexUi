import { MenuItem } from './MenuItem.js';

/**
 * Description:
 * Represents the <ul> container for a list of MenuItems
 * when a parent menu item has children.
 *
 * Properties summary:
 * - element {HTMLUListElement} : The main <ul> DOM element.
 *
 * Typical usage:
 * // Instantiated by MenuItem.js
 * this.submenu = new Submenu(itemData.children, this.level + 1);
 * this.element.appendChild(this.submenu.element);
 *
 * Dependencies:
 * - ./MenuItem.js
 */
export class Submenu {
    /**
     * @param {Array<object>} childrenData - The raw configuration objects for child items.
     * @param {number} parentLevel - The level of the parent MenuItem.
     */
    constructor(childrenData, parentLevel) {
        this.element = document.createElement('ul');
        this.element.classList.add('menu__submenu');
        this.build(childrenData, parentLevel);
    }

    /**
     * Builds the submenu DOM by creating a new MenuItem for each child.
     * @param {Array<object>} childrenData - The raw configuration objects for child items.
     * @param {number} parentLevel - The level of the parent MenuItem.
     * @returns {void}
     */
    build(childrenData, parentLevel) {
        const childLevel = parentLevel + 1;

        childrenData.forEach(itemData => {
            const subItem = new MenuItem(itemData, childLevel);
            this.element.appendChild(subItem.element);
        });
    }
}
