import { Submenu } from './Submenu.js';

export class MenuItem {
    constructor(title) {
        this.element = document.createElement('div');
        this.element.classList.add('menu-item');
        this.title = document.createElement('div');
        this.title.classList.add('menu-title');
        this.title.textContent = title;
        this.element.appendChild(this.title);
        this.submenuContainer = document.createElement('ul');
        this.submenuContainer.classList.add('submenu-container');
        this.element.appendChild(this.submenuContainer);
    }
    addSubmenu(title, action) {
        const sm = new Submenu(title, action);
        this.submenuContainer.appendChild(sm.element);
    }
}
