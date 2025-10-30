import { MenuItem } from './MenuItem.js';
import { appBus } from '../EventBus.js';

export class Menu {
    constructor() {
        this.element = document.createElement('div');
        this.element.classList.add('menu');
        this.build();

        this.initGlobalListeners();
        // REMOVIDO: this.initHoverListeners();
    }

    getMenuData() {
        // Estrutura de dados recursiva para o menu
        return [
            {
                title: 'Paineis',
                children: [
                    {
                        title: 'Adicionar novo painel',
                        fn: () => appBus.emit('app:add-new-panel')
                    },
                    {
                        title: 'Opções de Layout',
                        children: [
                            {
                                title: 'Layout Salvo 1',
                                fn: () => console.log('Carregando Layout 1')
                            },
                            {
                                title: 'Layout Salvo 2',
                                children: [
                                    {
                                        title: 'Layout Salvo 1',
                                        fn: () => console.log('Carregando Layout 1')
                                    },
                                    {
                                        title: 'Layout Salvo 2',
                                        fn: () => console.log('Carregando Layout 2')
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                title: 'Container',
                children: [
                    {
                        title: 'Salvar estado atual',
                        fn: () => appBus.emit('app:save-state')
                    },
                    {
                        title: 'Restaurar estado',
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

    /**
     * Inicializa ouvintes para o fechamento global do menu.
     */
    initGlobalListeners() {
        // 1. Fechar ao clicar fora do menu
        document.addEventListener('click', e => {
            if (!this.element.contains(e.target)) {
                this.closeAllMenus();
            }
        });

        // 2. Fechar ao selecionar um item (evento emitido pelo MenuItem folha)
        appBus.on('menu:item-selected', this.closeAllMenus.bind(this));

        // 3. Ouve o evento emitido pelo MenuItem de nível 1 ao ser clicado/hovered
        appBus.on('menu:close-siblings', this.closeSiblings.bind(this));
    }

    /**
     * Método que fecha todos os submenus abertos.
     */
    closeAllMenus() {
        this.element.querySelectorAll('.menu-item.open').forEach(item => {
            item.classList.remove('open');
        });
    }

    /**
     * Fecha apenas os irmãos de um item que acabou de ser clicado/hovered.
     * @param {HTMLElement} target - O elemento .menu-item que foi clicado.
     */
    closeSiblings(target) {
        // Como o target é um elemento de nível 1, seu pai é a barra .menu
        target.parentElement.querySelectorAll('.menu-item.open').forEach(sibling => {
            if (sibling !== target) {
                // Remove a classe 'open' do item irmão
                sibling.classList.remove('open');

                // Remove a classe 'open' dos filhos dos irmãos (garante limpeza completa)
                sibling.querySelectorAll('.menu-item.open').forEach(descendant => {
                    descendant.classList.remove('open');
                });
            }
        });
    }

    // REMOVIDO: initHoverListeners
}
