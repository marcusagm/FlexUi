import { Submenu } from './Submenu.js';
import { appBus } from '../EventBus.js';

export class MenuItem {
    /**
     * @param {Object} itemData - Objeto contendo { title, fn, children }.
     * @param {number} [level=1] - O nível de aninhamento do item (1 = Top Level, 2+ = Submenu).
     */
    constructor(itemData, level = 1) {
        this.itemData = itemData;
        this.level = level; // Armazena o nível
        this.element = document.createElement('li');
        this.element.classList.add('menu-item');

        this.title = document.createElement('div');
        this.title.classList.add('menu-title');
        this.title.textContent = itemData.title;

        this.element.appendChild(this.title);

        // Se o item de dados tiver um array de filhos, ele é um contêiner de submenu.
        if (itemData.children && itemData.children.length > 0) {
            // NOVO: Elemento para o ícone (apenas se houver filhos)
            this.arrow = document.createElement('span');
            this.arrow.classList.add('menu-arrow');
            this.arrow.textContent = '▶';

            // Anexa o ícone após o título
            this.element.appendChild(this.arrow);

            // Passa o próximo nível para a construção do Submenu
            this.submenu = new Submenu(itemData.children, this.level + 1);
            this.element.appendChild(this.submenu.element);
            this.element.classList.add('has-submenu');
        }

        this.initListeners();
    }

    initListeners() {
        if (this.itemData.fn) {
            this.element.addEventListener('click', this.handleClick.bind(this));
        } else if (this.itemData.children) {
            const isTopLevel = this.level === 1;

            if (isTopLevel) {
                // Nível 1: Clique para abrir/fechar
                this.element.addEventListener('click', this.handleTopLevelClick.bind(this));

                // NOVO: Nível 1: Hover para alternar entre menus abertos
                this.element.addEventListener('mouseenter', this.handleTopLevelHover.bind(this));
            } else {
                // Nível 2+: Hover para abrir
                this.element.addEventListener('mouseenter', this.handleSubmenuHover.bind(this));
            }
        }
    }

    /**
     * NOVO: Lógica de hover para itens de Nível 1.
     */
    handleTopLevelHover(e) {
        const menuContainer = this.element.parentElement;
        // Verifica se *algum* menu de nível 1 está aberto (se o estado de navegação foi iniciado)
        const isAnyTopLevelOpen = menuContainer.querySelector('.menu-item.open');

        if (isAnyTopLevelOpen) {
            e.stopPropagation();

            // Se o mouse entrou em um menu que não é o atual, altere
            if (!this.element.classList.contains('open')) {
                // 1. Fecha todos os irmãos abertos
                appBus.emit('menu:close-siblings', this.element);

                // 2. Abre este item
                this.element.classList.add('open');
            }
        }
    }

    /**
     * Lógica para itens contêineres de Nível 1 (clique para abrir/fechar).
     */
    handleTopLevelClick(e) {
        e.stopPropagation();

        // Fecha todos os irmãos (através do Menu.js)
        appBus.emit('menu:close-siblings', this.element);

        // Alterna o estado de abertura/fechamento deste item
        this.element.classList.toggle('open');
    }

    /**
     * Lógica para itens contêineres de Nível 2+ (hover para abrir).
     */
    handleSubmenuHover(e) {
        e.stopPropagation();

        // Fecha todos os irmãos de mesmo nível
        this.element.parentElement.querySelectorAll('.menu-item.open').forEach(sibling => {
            if (sibling !== this.element) {
                sibling.classList.remove('open');
            }
        });

        // Abre este submenu
        this.element.classList.add('open');
    }

    /**
     * Lógica para itens folha (clicáveis).
     */
    handleClick(e) {
        e.stopPropagation();
        if (this.itemData.fn) {
            this.itemData.fn();
        }

        // Emite evento para o Menu fechar todos os submenus
        appBus.emit('menu:item-selected');
    }
}
