import Submenu from './Submenu.js';

class MenuItem {
    /**
     * Creates a new MenuItem.
     * @param {string} title - The text to display as the menu item's title.
     */
    constructor(title) {
        this.element = document.createElement('div');
        this.element.classList.add('menu-item');

        this.titleElement = document.createElement('div');
        this.titleElement.classList.add('menu-title');
        this.titleElement.textContent = title;
        this.element.appendChild(this.titleElement);

        this.submenuContainer = document.createElement('ul');
        this.submenuContainer.classList.add('submenu-container');
        this.element.appendChild(this.submenuContainer);
    }

    /**
     * Adds a submenu to this menu item.
     * @param {string} title - The title of the submenu.
     * @param {Function} action - The action to execute when the submenu is selected.
     */
    addSubmenu(title, action) {
        const sm = new Submenu(title, action);
        this.submenuContainer.appendChild(sm.element);
    }
}

export default MenuItem;
