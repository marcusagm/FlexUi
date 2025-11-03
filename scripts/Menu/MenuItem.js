import { Submenu } from './Submenu.js';
import { appBus } from '../EventBus.js';

export class MenuItem {
    constructor(itemData, level = 1) {
        this.itemData = itemData;
        this.level = level;
        this.element = document.createElement('li');
        this.element.classList.add('menu__item');

        this.title = document.createElement('div');
        this.title.classList.add('menu__title');
        this.title.textContent = itemData.title;

        this.element.appendChild(this.title);

        if (itemData.children && itemData.children.length > 0) {
            this.arrow = document.createElement('span');
            this.arrow.classList.add('menu__arrow');
            this.arrow.textContent = '▶';

            this.element.appendChild(this.arrow);

            this.submenu = new Submenu(itemData.children, this.level + 1);
            this.element.appendChild(this.submenu.element);
            this.element.classList.add('menu__item--has-submenu');
        }

        this.initListeners();
    }

    initListeners() {
        if (this.itemData.fn) {
            this.element.addEventListener('click', this.handleClick.bind(this));
        } else if (this.itemData.children) {
            const isTopLevel = this.level === 1;

            if (isTopLevel) {
                this.element.addEventListener('click', this.handleTopLevelClick.bind(this));
                this.element.addEventListener('mouseenter', this.handleTopLevelHover.bind(this));
            } else {
                this.element.addEventListener('mouseenter', this.handleSubmenuHover.bind(this));
            }
        }
    }

    handleTopLevelHover(e) {
        const menuContainer = this.element.parentElement;
        const isAnyTopLevelOpen = menuContainer.querySelector('.menu__item--open');

        if (isAnyTopLevelOpen) {
            e.stopPropagation();
            if (!this.element.classList.contains('menu__item--open')) {
                appBus.emit('menu:close-siblings', this.element);
                this.element.classList.add('menu__item--open');
            }
        }
    }

    handleTopLevelClick(e) {
        e.stopPropagation();

        appBus.emit('menu:close-siblings', this.element);
        this.element.classList.toggle('menu__item--open');
    }

    handleSubmenuHover(e) {
        e.stopPropagation();

        this.element.parentElement.querySelectorAll('.menu__item--open').forEach(sibling => {
            if (sibling !== this.element) {
                sibling.classList.remove('menu__item--open');
            }
        });
        this.element.classList.add('menu__item--open');
    }

    handleClick(e) {
        e.stopPropagation();
        if (this.itemData.fn) {
            this.itemData.fn();
        }
        appBus.emit('menu:item-selected');
    }
}


