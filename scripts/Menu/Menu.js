import { MenuItem } from './MenuItem.js';
import { appBus } from '../EventBus.js';
import { TranslationService } from '../Services/TranslationService.js';

export class Menu {
    constructor() {
        this.element = document.createElement('div');
        this.element.classList.add('menu');
        this.build();

        this.initGlobalListeners();
    }

    getMenuData() {
        const i18n = TranslationService.getInstance();

        return [
            {
                title: i18n.translate('panels.menu'),
                children: [
                    {
                        title: i18n.translate('panels.add'),
                        fn: () => appBus.emit('app:add-new-panel')
                    }
                ]
            },
            {
                title: i18n.translate('workspace.menu'),
                children: [
                    {
                        title: i18n.translate('workspace.save'),
                        fn: () => appBus.emit('app:save-state')
                    },
                    {
                        title: i18n.translate('workspace.restore'),
                        fn: () => appBus.emit('app:restore-state')
                    },
                    {
                        title: i18n.translate('workspace.reset'),
                        fn: () => appBus.emit('app:reset-state')
                    }
                ]
            }
        ];
    }

    build() {
        const items = this.getMenuData();

        items.forEach(itemData => {
            const mi = new MenuItem(itemData, 1);
            this.element.appendChild(mi.element);
        });
    }

    initGlobalListeners() {
        document.addEventListener('click', e => {
            if (!this.element.contains(e.target)) {
                this.closeAllMenus();
            }
        });
        appBus.on('menu:item-selected', this.closeAllMenus.bind(this));
        appBus.on('menu:close-siblings', this.closeSiblings.bind(this));
    }

    closeAllMenus() {
        this.element.querySelectorAll('.menu__item--open').forEach(item => {
            item.classList.remove('menu__item--open');
        });
    }

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


