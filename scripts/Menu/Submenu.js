import { MenuItem } from './MenuItem.js';

export class Submenu {
    constructor(childrenData, parentLevel) {
        this.element = document.createElement('ul');
        this.element.classList.add('menu__submenu');
        this.build(childrenData, parentLevel);
    }

    build(childrenData, parentLevel) {
        const childLevel = parentLevel + 1;

        childrenData.forEach(itemData => {
            const subItem = new MenuItem(itemData, childLevel);
            this.element.appendChild(subItem.element);
        });
    }
}

