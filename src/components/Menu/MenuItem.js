import { Submenu } from './Submenu.js';
import { appBus } from '../../utils/EventBus.js';

/**
 * Description:
 * Represents a single clickable item within a Menu or Submenu.
 * It handles its own rendering (title, arrow), click/hover logic,
 * and the creation of its Submenu if it has children.
 *
 * Properties summary:
 * - itemData {object} : The raw configuration object for this item.
 * - level {number} : The depth level of this item (1 for top-level).
 * - element {HTMLElement} : The main <li> DOM element.
 * - title {HTMLElement} : The <div> element holding the title.
 * - arrow {HTMLElement} : The <span> element for the submenu arrow.
 * - submenu {Submenu} : The Submenu instance (if children exist).
 *
 * Typical usage:
 * // Instantiated by Menu.js or Submenu.js
 * const mi = new MenuItem(itemData, 1);
 * parentElement.appendChild(mi.element);
 *
 * Events:
 * - Emits (appBus): 'app:add-new-panel' (or other custom event from itemData.event)
 * - Emits (appBus): 'menu:item-selected'
 * - Emits (appBus): 'menu:close-siblings'
 *
 * Dependencies:
 * - ./Submenu.js
 * - ../../utils/EventBus.js
 */
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

    /**
     * Initializes event listeners based on whether the item is a
     * command (has callback/event) or a dropdown (has children).
     * @returns {void}
     */
    initListeners() {
        const me = this;
        if (me.itemData.callback || me.itemData.event) {
            me.element.addEventListener('click', me.handleClick.bind(me));
        } else if (me.itemData.children) {
            const isTopLevel = me.level === 1;

            if (isTopLevel) {
                me.element.addEventListener('click', me.handleTopLevelClick.bind(me));
                me.element.addEventListener('mouseenter', me.handleTopLevelHover.bind(me));
            } else {
                me.element.addEventListener('mouseenter', me.handleSubmenuHover.bind(me));
            }
        }
    }

    /**
     * Handles hover on a top-level (L1) menu item.
     * If another menu is already open, this will open this item's menu.
     * @param {MouseEvent} e
     * @returns {void}
     */
    handleTopLevelHover(e) {
        const me = this;
        const menuContainer = me.element.parentElement;
        const isAnyTopLevelOpen = menuContainer.querySelector('.menu__item--open');

        if (isAnyTopLevelOpen) {
            e.stopPropagation();
            if (!me.element.classList.contains('menu__item--open')) {
                appBus.emit('menu:close-siblings', me.element);
                me.element.classList.add('menu__item--open');
            }
        }
    }

    /**
     * Handles click on a top-level (L1) menu item (to toggle its submenu).
     * @param {MouseEvent} e
     * @returns {void}
     */
    handleTopLevelClick(e) {
        const me = this;
        e.stopPropagation();

        appBus.emit('menu:close-siblings', me.element);
        me.element.classList.toggle('menu__item--open');
    }

    /**
     * Handles hover on a non-top-level (L2+) menu item.
     * @param {MouseEvent} e
     * @returns {void}
     */
    handleSubmenuHover(e) {
        const me = this;
        e.stopPropagation();

        me.element.parentElement.querySelectorAll('.menu__item--open').forEach(sibling => {
            if (sibling !== me.element) {
                sibling.classList.remove('menu__item--open');
            }
        });
        me.element.classList.add('menu__item--open');
    }

    /**
     * Handles a click on a final command item (an item with an action).
     * @param {MouseEvent} e
     * @returns {void}
     */
    handleClick(e) {
        const me = this;
        e.stopPropagation();

        if (typeof me.itemData.callback === 'function') {
            me.itemData.callback();
        } else if (me.itemData.event) {
            appBus.emit(me.itemData.event);
        }

        appBus.emit('menu:item-selected');
    }
}
