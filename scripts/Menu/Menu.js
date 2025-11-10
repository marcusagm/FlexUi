import { MenuItem } from './MenuItem.js';
import { appBus } from '../EventBus.js';
import { TranslationService } from '../Services/TranslationService.js';

export class Menu {
    // (NOVO) Propriedades para armazenar referências bindadas
    _boundOnGlobalClick = null;
    _boundCloseAllMenus = null;
    _boundCloseSiblings = null;

    constructor() {
        this.element = document.createElement('div');
        this.element.classList.add('menu');
        // REMOVIDO: this.build() - A construção agora é assíncrona

        // (NOVO) Armazena referências bindadas
        this._boundOnGlobalClick = this._onGlobalClick.bind(this);
        this._boundCloseAllMenus = this.closeAllMenus.bind(this);
        this._boundCloseSiblings = this.closeSiblings.bind(this);

        this.initGlobalListeners();
    }

    /**
     * (NOVO) Método 'destroy' para limpeza de listeners globais.
     */
    destroy() {
        const me = this; // Conforme diretrizes
        document.removeEventListener('click', me._boundOnGlobalClick);
        appBus.off('menu:item-selected', me._boundCloseAllMenus);
        appBus.off('menu:close-siblings', me._boundCloseSiblings);
        me.element.remove();
    }

    /**
     * (NOVO) Listener de clique global extraído da função anônima.
     * @param {MouseEvent} e
     */
    _onGlobalClick(e) {
        if (!this.element.contains(e.target)) {
            this.closeAllMenus();
        }
    }

    /**
     * (NOVO) Carrega, processa e constrói o menu a partir de um módulo de configuração.
     * @param {string} [url='workspaces/menus/menu.js'] - O caminho para o módulo de configuração do menu.
     */
    async load(url = 'workspaces/menus/menu.js') {
        try {
            // Usa importação dinâmica para carregar o módulo JS
            // O caminho relativo sobe dois níveis (de scripts/Menu/ para a raiz)
            const menuModule = await import(`../../${url}`);
            const rawMenuData = menuModule.default;

            // Pega a instância do i18n para processar os títulos
            const i18n = TranslationService.getInstance();
            const processedItems = this._processMenuData(rawMenuData, i18n);

            // Constrói o menu com os dados processados e traduzidos
            this.build(processedItems);
        } catch (error) {
            console.error(`Falha ao carregar o módulo do menu: ${url}`, error);
            this.element.innerHTML = '<div class="menu__item">Erro ao carregar menu.</div>';
        }
    }

    /**
     * (NOVO) Processa recursivamente os dados do menu para traduzir 'titleKey'.
     * @param {Array<object>} items - O array de itens de menu (raw).
     * @param {TranslationService} i18n - A instância do serviço de tradução.
     * @returns {Array<object>} O array de itens processados.
     * @private
     */
    _processMenuData(items, i18n) {
        if (!items || !Array.isArray(items)) {
            return [];
        }

        return items.map(item => {
            // Copia o item original
            const processedItem = { ...item };

            // Traduz o 'titleKey' para 'title'
            // O MenuItem espera uma propriedade 'title'
            if (item.titleKey) {
                processedItem.title = i18n.translate(item.titleKey);
            }

            // Processa recursivamente os filhos
            if (item.children && item.children.length > 0) {
                processedItem.children = this._processMenuData(item.children, i18n);
            }

            return processedItem;
        });
    }

    /**
     * Constrói o DOM do menu com base nos itens processados.
     * @param {Array<object>} items - Os itens de menu processados (com títulos traduzidos).
     */
    build(items) {
        // Limpa qualquer conteúdo anterior (ex: mensagem de erro)
        this.element.innerHTML = '';

        items.forEach(itemData => {
            const mi = new MenuItem(itemData, 1);
            this.element.appendChild(mi.element);
        });
    }

    /**
     * (MODIFICADO) Usa referências bindadas.
     */
    initGlobalListeners() {
        document.addEventListener('click', this._boundOnGlobalClick);
        appBus.on('menu:item-selected', this._boundCloseAllMenus);
        appBus.on('menu:close-siblings', this._boundCloseSiblings);
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
