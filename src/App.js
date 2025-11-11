import { Menu } from './components/Menu/Menu.js';
import { Container } from './components/Container/Container.js';
import { Panel } from './components/Panel/Panel.js';
import { TextPanel } from './components/Panel/TextPanel.js';
import { ToolbarPanel } from './components/Panel/ToolbarPanel.js';
import { PanelGroup } from './components/Panel/PanelGroup.js';
import { PanelFactory } from './components/Panel/PanelFactory.js';
import { StatusBar } from './components/StatusBar/StatusBar.js';
import { StateService } from './services/StateService.js';
import { appNotifications } from './services/Notification/Notification.js';
import { NotificationUIListener } from './services/Notification/NotificationUIListener.js';
import { TranslationService } from './services/TranslationService.js';
import { DragDropService } from './services/DND/DragDropService.js';
import { ColumnDropStrategy } from './services/DND/ColumnDropStrategy.js';
import { RowDropStrategy } from './services/DND/RowDropStrategy.js';
import { ContainerDropStrategy } from './services/DND/ContainerDropStrategy.js';
import { TabContainerDropStrategy } from './services/DND/TabContainerDropStrategy.js';
import { LayoutService } from './services/LayoutService.js';
import { appBus } from './utils/EventBus.js';
import { debounce } from './utils/Debounce.js';

export class App {
    /**
     * Chave de armazenamento principal para o layout.
     * @type {string}
     */
    STORAGE_KEY = 'panel_state';

    /**
     * Armazena o objeto de workspace carregado (incluindo nome e layout)
     * @type {object | null}
     */
    currentWorkspace = null;

    // (NOVO) Namespace estático para este Singleton
    namespace = 'app_singleton';

    // (NOVO) Referências bindadas para listeners (Correção de Memory Leak)
    _boundAddNewPanel = null;
    _boundResetLayoutSilent = null;
    _boundSaveLayout = null;
    _boundRestoreLayout = null;
    _boundResetLayout = null;
    debouncedResize = null; // (Já era armazenado)

    constructor() {
        if (App.instance) {
            return App.instance;
        }
        App.instance = this;

        this.menu = new Menu();
        // (MODIFICADO) 'this.container' é agora o novo Container (gestor de linhas)
        this.container = new Container();
        this.statusBar = new StatusBar();

        this.stateService = StateService.getInstance();

        // (MODIFICADO) Regista as 4 estratégias
        const dds = DragDropService.getInstance();
        dds.registerStrategy('column', new ColumnDropStrategy());
        dds.registerStrategy('TabContainer', new TabContainerDropStrategy());
        dds.registerStrategy('row', new RowDropStrategy()); // (Renomeado)
        dds.registerStrategy('container', new ContainerDropStrategy()); // (Novo)

        const factory = PanelFactory.getInstance();
        factory.registerPanelClasses([Panel, TextPanel, ToolbarPanel]);

        LayoutService.getInstance();

        document.body.append(this.menu.element, this.container.element, this.statusBar.element);

        // (NOVO) Armazena referências bindadas
        this._boundAddNewPanel = this.addNewPanel.bind(this);
        this._boundResetLayoutSilent = this.resetLayout.bind(this, true);
        this._boundSaveLayout = this.saveLayout.bind(this);
        this._boundRestoreLayout = this.restoreLayout.bind(this);
        this._boundResetLayout = this.resetLayout.bind(this, false);

        const debounceDelay = 200;
        this.debouncedResize = debounce(this.onResizeHandler.bind(this), debounceDelay);

        this.initEventListeners();

        const uiListener = new NotificationUIListener(document.body);
        uiListener.listen(appNotifications);
    }

    /**
     * Inicializa a aplicação, carregando o menu e o layout assincronamente.
     * Deve ser chamado pelo main.js.
     */
    async init() {
        await this.menu.load();
        // Carrega o layout (do localStorage ou do default.json)
        await this.loadInitialLayout();

        appBus.emit('app:set-permanent-status', 'Pronto');
    }

    /**
     * (MODIFICADO) Usa referências bindadas e adiciona namespace
     */
    initEventListeners() {
        const me = this;
        const options = { namespace: me.namespace };

        appBus.on('app:add-new-panel', me._boundAddNewPanel, options);
        appBus.on('app:reinitialize-default-layout', me._boundResetLayoutSilent, options);
        appBus.on('app:save-state', me._boundSaveLayout, options);
        appBus.on('app:restore-state', me._boundRestoreLayout, options);
        appBus.on('app:reset-state', me._boundResetLayout, options);

        window.addEventListener('resize', me.debouncedResize);
    }

    /**
     * (NOVO) Limpa todos os listeners para permitir "teardown" (ex: testes).
     * (MODIFICADO) Usa offByNamespace.
     */
    destroy() {
        const me = this;
        // (INÍCIO DA MODIFICAÇÃO - Etapa 3)
        // Remove todos os listeners deste componente de uma vez
        appBus.offByNamespace(me.namespace);
        // (FIM DA MODIFICAÇÃO)

        window.removeEventListener('resize', me.debouncedResize);
        me.debouncedResize?.cancel(); // Cancela qualquer debounce pendente

        // Destrói os componentes principais
        me.menu?.destroy();
        me.container?.destroy();
        // me.statusBar?.destroy(); // (StatusBar não tem destroy, mas poderia ter)
    }

    /**
     * Carrega o layout inicial do StateService (localStorage ou JSON).
     */
    async loadInitialLayout() {
        const workspaceData = await this.stateService.loadState(this.STORAGE_KEY);

        if (workspaceData && workspaceData.layout) {
            // Armazena o objeto de workspace completo (com nome e layout)
            this.currentWorkspace = workspaceData;
            // Passa apenas os dados de layout para o container (que agora suporta 'rows')
            this.container.fromJSON(workspaceData.layout);
        } else {
            // Isso só deve acontecer se o default.json falhar ao carregar
            console.error(
                'App: Falha crítica ao carregar o layout. Nenhum dado de workspace foi encontrado.'
            );
            appNotifications.danger(
                'Falha crítica ao carregar o layout. O arquivo default.json pode estar faltando.'
            );
        }
    }

    /**
     * Salva o estado do layout atual no objeto de workspace.
     */
    saveLayout() {
        // 1. Pega os dados de layout atuais do container
        const layoutData = this.container.toJSON();

        // 2. Atualiza o objeto de workspace em memória
        if (this.currentWorkspace) {
            this.currentWorkspace.layout = layoutData;
        } else {
            // Fallback caso a inicialização tenha falhado
            console.warn(
                'App.saveLayout: currentWorkspace é nulo. Criando novo objeto de workspace.'
            );
            this.currentWorkspace = {
                name: 'Workspace Salvo (Fallback)', // Nome padrão
                layout: layoutData
            };
        }

        // 3. Salva o objeto de workspace completo (com nome e layout) no localStorage
        this.stateService.saveState(this.STORAGE_KEY, this.currentWorkspace);

        const i18n = TranslationService.getInstance();
        appNotifications.success(i18n.translate('appstate.save'));
    }

    async restoreLayout() {
        this.container.clear();
        await this.loadInitialLayout();

        const i18n = TranslationService.getInstance();
        appNotifications.success(i18n.translate('appstate.restore'));
    }

    /**
     * @param {boolean} [silent=false]
     */
    async resetLayout(silent = false) {
        this.stateService.clearState(this.STORAGE_KEY);
        this.container.clear();

        await this.loadInitialLayout();

        if (!silent) {
            const i18n = TranslationService.getInstance();
            appBus.emit('app:set-status-message', i18n.translate('appstate.reset'));
        }
    }

    addNewPanel() {
        // (MODIFICADO) Navega pela nova estrutura: Container -> Row -> Column
        const column = this.container.getFirstRow().getFirstColumn();
        const title = `Novo Painel (${new Date().toLocaleTimeString()})`;
        const panel = new TextPanel(title, 'Conteúdo do novo painel.');

        const panelGroup = new PanelGroup(panel);

        column.addPanelGroup(panelGroup);
    }

    /**
     * (MODIFICADO) Manipulador de resize chamado pelo debounce.
     */
    onResizeHandler() {
        // Esta função é mantida (pois o listener está nela),
        // mas a lógica O(N*M) foi removida.
        // O layout Flexbox (CSS) e os ResizeObservers (JS)
        // gerenciam o redimensionamento de forma passiva e eficiente.
    }
}
