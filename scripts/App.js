import { Menu } from './Menu/Menu.js';
import { Container } from './Container.js';
import { Panel } from './Panel/Panel.js';
import { TextPanel } from './Panel/TextPanel.js';
import { ToolbarPanel } from './Panel/ToolbarPanel.js';
import { PanelGroup } from './Panel/PanelGroup.js';
import { appBus } from './EventBus.js';
import { StateService } from './StateService.js';
import { debounce } from './Debounce.js';
import { appNotifications } from './Services/Notification/Notification.js';
import { NotificationUIListener } from './Services/Notification/NotificationUIListener.js';
import { TranslationService } from './Services/TranslationService.js';
import { DragDropService } from './Services/DND/DragDropService.js';
import { ColumnDropStrategy } from './Services/DND/ColumnDropStrategy.js';
import { CreateAreaDropStrategy } from './Services/DND/CreateAreaDropStrategy.js';
import { PanelFactory } from './Panel/PanelFactory.js';
import { LayoutService } from './Services/LayoutService.js';

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

    constructor() {
        if (App.instance) {
            return App.instance;
        }
        App.instance = this;

        this.menu = new Menu();
        this.container = new Container();

        this.stateService = StateService.getInstance();

        const dds = DragDropService.getInstance();
        dds.registerStrategy('column', new ColumnDropStrategy());
        dds.registerStrategy('create-area', new CreateAreaDropStrategy());

        const factory = PanelFactory.getInstance();
        factory.registerPanelType('Panel', Panel);
        factory.registerPanelType('TextPanel', TextPanel);
        factory.registerPanelType('ToolbarPanel', ToolbarPanel);

        LayoutService.getInstance();

        document.body.append(this.menu.element, this.container.element);

        this.initEventListeners();
        // this.loadInitialLayout(); // REMOVIDO: A inicialização agora é async e chamada pelo main.js

        const uiListener = new NotificationUIListener(document.body);
        uiListener.listen(appNotifications);
    }

    /**
     * (NOVO) Inicializa a aplicação, carregando o layout assincronamente.
     * Deve ser chamado pelo main.js.
     */
    async init() {
        await this.loadInitialLayout();
    }

    initEventListeners() {
        appBus.on('app:add-new-panel', this.addNewPanel.bind(this));

        appBus.on('app:reinitialize-default-layout', this.resetLayout.bind(this, true));

        appBus.on('app:save-state', this.saveLayout.bind(this));
        appBus.on('app:restore-state', this.restoreLayout.bind(this));
        appBus.on('app:reset-state', this.resetLayout.bind(this, false));

        const debounceDelay = 200;
        this.debouncedResize = debounce(this.onResizeHandler.bind(this), debounceDelay);
        window.addEventListener('resize', this.debouncedResize);
    }

    /**
     * (MODIFICADO) Carrega o layout inicial do StateService (localStorage ou JSON).
     */
    async loadInitialLayout() {
        const workspaceData = await this.stateService.loadState(this.STORAGE_KEY);

        if (workspaceData && workspaceData.layout) {
            // Armazena o objeto de workspace completo (com nome e layout)
            this.currentWorkspace = workspaceData;
            // Passa apenas os dados de layout para o container
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
     * (MODIFICADO) Salva o estado do layout atual no objeto de workspace.
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

    /**
     * (MODIFICADO) Restaura o layout salvo no localStorage (ou o padrão se não houver).
     */
    async restoreLayout() {
        this.container.clear();
        // Recarrega do StateService (que vai ler o localStorage ou o default.json)
        await this.loadInitialLayout();

        const i18n = TranslationService.getInstance();
        // A notificação 'no_save' não é mais necessária, pois o StateService garante o default.json
        appNotifications.success(i18n.translate('appstate.restore'));
    }

    /**
     * (MODIFICADO) Limpa o localStorage e recarrega o layout padrão (do default.json).
     * @param {boolean} [silent=false]
     */
    async resetLayout(silent = false) {
        this.stateService.clearState(this.STORAGE_KEY);
        this.container.clear();

        // Como o localStorage está limpo, o loadInitialLayout vai forçar o StateService
        // a carregar o 'workspaces/default.json'
        await this.loadInitialLayout();

        if (!silent) {
            const i18n = TranslationService.getInstance();
            appNotifications.success(i18n.translate('appstate.reset'));
        }
    }

    addNewPanel() {
        const column = this.container.getFirstColumn();
        const title = `Novo Painel (${new Date().toLocaleTimeString()})`;
        const panel = new TextPanel(title, 'Conteúdo do novo painel.');

        const panelGroup = new PanelGroup(panel);

        column.addPanelGroup(panelGroup);
    }

    /**
     * Manipulador de resize chamado pelo debounce.
     */
    onResizeHandler() {
        this.container.getColumns().forEach(column => {
            appBus.emit('layout:column-changed', column);
        });
    }
}
