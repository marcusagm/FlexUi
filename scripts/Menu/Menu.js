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
                    }
                ]
            }
        ];
    }

    build() {
        const items = this.getMenuData();

        items.forEach(itemData => {
            // Passa o nível 1 para o MenuItem
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
        this.element.querySelectorAll('.menu-item.open').forEach(item => {
            item.classList.remove('open');
        });
    }

    closeSiblings(target) {
        target.parentElement.querySelectorAll('.menu-item.open').forEach(sibling => {
            if (sibling !== target) {
                sibling.classList.remove('open');
                sibling.querySelectorAll('.menu-item.open').forEach(descendant => {
                    descendant.classList.remove('open');
                });
            }
        });
    }
}
