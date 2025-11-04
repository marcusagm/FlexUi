import { Menu } from './Menu/Menu.js';
import { Container } from './Container.js';
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

export class App {
    /**
     * Chave de armazenamento principal para o layout.
     * @type {string}
     */
    STORAGE_KEY = 'panel_state';

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

        document.body.append(this.menu.element, this.container.element);

        this.initEventListeners();
        this.loadInitialLayout();

        const uiListener = new NotificationUIListener(document.body);
        uiListener.listen(appNotifications);
    }

    initEventListeners() {
        appBus.on('app:add-new-panel', this.addNewPanel.bind(this));

        appBus.on('app:reinitialize-default-layout', this.resetLayout.bind(this, true));

        appBus.on('app:save-state', this.saveLayout.bind(this));
        appBus.on('app:restore-state', this.restoreLayout.bind(this));
        appBus.on('app:reset-state', this.resetLayout.bind(this, false));

        this.debouncedResize = debounce(this.onResizeHandler.bind(this), 200);
        window.addEventListener('resize', this.debouncedResize);
    }

    loadInitialLayout() {
        const data = this.stateService.loadState(this.STORAGE_KEY);
        if (data) {
            this.container.fromJSON(data);
        } else {
            this.initDefault();
        }
    }

    saveLayout() {
        const stateData = this.container.toJSON();
        this.stateService.saveState(this.STORAGE_KEY, stateData);

        const i18n = TranslationService.getInstance();
        appNotifications.success(i18n.translate('appstate.save'));
    }

    restoreLayout() {
        const data = this.stateService.loadState(this.STORAGE_KEY);
        const i18n = TranslationService.getInstance();

        if (data) {
            this.container.fromJSON(data);
            appNotifications.success(i18n.translate('appstate.restore'));
        } else {
            appNotifications.info(i18n.translate('appstate.no_save'));
        }
    }

    resetLayout(silent = false) {
        this.stateService.clearState(this.STORAGE_KEY);
        this.container.clear();
        this.initDefault();

        if (!silent) {
            const i18n = TranslationService.getInstance();
            appNotifications.success(i18n.translate('appstate.reset'));
        }
    }

    initDefault() {
        const c1 = this.container.createColumn();
        const group = new PanelGroup(
            new TextPanel('Painel de Texto 1', 'Este é um painel customizado.')
        );
        group.addPanel(new TextPanel('Aba um', 'este é o conteudo da aba'), false);
        group.addPanel(
            new TextPanel(
                'Aba Um título muito grande para teste',
                'abs 2 este é o conteudo da aba'
            ),
            false
        );

        c1.addPanelGroup(group);
        c1.addPanelGroup(
            new PanelGroup(
                new TextPanel('Painel de Texto 2', 'O conteúdo é gerenciado pela subclasse.', 200)
            )
        );

        const c2 = this.container.createColumn();
        c2.addPanelGroup(new PanelGroup(new ToolbarPanel('Barra de Ferramentas')));
        c2.addPanelGroup(
            new PanelGroup(new TextPanel('Painel 3', 'Mais um painel de texto.', null), null, true)
        );

        const c3 = this.container.createColumn();
        c3.addPanelGroup(new PanelGroup(new TextPanel('Painel 4', 'Conteúdo do painel 4.')));
        c3.addPanelGroup(new PanelGroup(new ToolbarPanel()));

        this.container.updateColumnsSizes();
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
            column.updatePanelGroupsSizes();
        });
    }
}
