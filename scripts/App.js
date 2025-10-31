import { Menu } from './Menu/Menu.js';
import { Container } from './Container.js';
import { TextPanel } from './Panel/TextPanel.js';
import { ToolbarPanel } from './Panel/ToolbarPanel.js';
import { appBus } from './EventBus.js';
import { StateService } from './StateService.js';
import { debounce } from './Debounce.js';
import { appNotifications } from './Services/Notification.js';
import { NotificationUIListener } from './Services/NotificationUIListener.js';
import { TranslationService } from './Services/TranslationService.js';

export class App {
    constructor() {
        if (App.instance) {
            return App.instance;
        }
        App.instance = this;

        this.menu = new Menu();
        this.container = new Container();

        this.stateService = new StateService(this.container);

        document.body.append(this.menu.element, this.container.element);

        this.initEventListeners();

        this.stateService.loadState(this.initDefault.bind(this));

        const uiListener = new NotificationUIListener(document.body);
        uiListener.listen(appNotifications);
    }

    // NOVO
    initEventListeners() {
        appBus.on('app:add-new-panel', this.addNewPanel.bind(this));

        appBus.on('app:reinitialize-default-layout', this.initDefault.bind(this));

        this.debouncedResize = debounce(this.onResizeHandler.bind(this), 200); // 200ms de atraso
        window.addEventListener('resize', this.debouncedResize);
    }

    initDefault() {
        const c1 = this.container.createColumn();
        c1.addPanel(new TextPanel('Painel de Texto 1', 'Este é um painel customizado.'));
        c1.addPanel(
            new TextPanel('Painel de Texto 2', 'O conteúdo é gerenciado pela subclasse.', 200)
        );
        const c2 = this.container.createColumn();
        c2.addPanel(new ToolbarPanel('Barra de Ferramentas'));
        c2.addPanel(new TextPanel('Painel 3', 'Mais um painel de texto.', null, true));
        const c3 = this.container.createColumn();
        c3.addPanel(new TextPanel('Painel 4', 'Conteúdo do painel 4.'));
        c3.addPanel(new ToolbarPanel());
        this.container.updateColumnsSizes();

        const i18n = TranslationService.getInstance();
        appNotifications.success(i18n.translate('appstate.restore'));
    }

    addNewPanel() {
        const column = this.container.getFirstColumn();
        const title = `Novo Painel (${new Date().toLocaleTimeString()})`;
        const panel = new TextPanel(title, 'Conteúdo do novo painel.');
        column.addPanel(panel);
    }

    /**
     * Manipulador de resize chamado pelo debounce.
     */
    onResizeHandler() {
        this.container.getColumns().forEach(column => {
            column.updatePanelsSizes();
        });
    }
}
