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
// (NOVO) Importa as estratégias
import { ColumnDropStrategy } from './Services/DND/ColumnDropStrategy.js';
import { CreateAreaDropStrategy } from './Services/DND/CreateAreaDropStrategy.js';

export class App {
    constructor() {
        if (App.instance) {
            return App.instance;
        }
        App.instance = this;

        this.menu = new Menu();
        this.container = new Container();

        this.stateService = new StateService(this.container);

        // (ALTERADO) Inicializa o DragDropService e injeta as estratégias
        const dds = DragDropService.getInstance();
        dds.registerStrategy('column', new ColumnDropStrategy());
        dds.registerStrategy('create-area', new CreateAreaDropStrategy());

        document.body.append(this.menu.element, this.container.element);

        this.initEventListeners();

        this.stateService.loadState(this.initDefault.bind(this));

        const uiListener = new NotificationUIListener(document.body);
        uiListener.listen(appNotifications);
    }

    initEventListeners() {
        appBus.on('app:add-new-panel', this.addNewPanel.bind(this));

        appBus.on('app:reinitialize-default-layout', this.initDefault.bind(this));

        this.debouncedResize = debounce(this.onResizeHandler.bind(this), 200); // 200ms de atraso
        window.addEventListener('resize', this.debouncedResize);
    }

    initDefault() {
        const c1 = this.container.createColumn();
        const group = new PanelGroup(
            new TextPanel('Painel de Texto 1', 'Este é um painel customizado.')
        );
        group.addPanel(new TextPanel('Aba um', 'este é o conteudo da aba'));
        group.addPanel(
            new TextPanel('Aba Um título muito grande para teste', 'abs 2 este é o conteudo da aba')
        );

        // (Req 3.1) Renomeado de addPanel para addPanelGroup
        c1.addPanelGroup(group);
        c1.addPanelGroup(
            // (Req 3.1)
            new PanelGroup(
                new TextPanel('Painel de Texto 2', 'O conteúdo é gerenciado pela subclasse.', 200)
            )
        );

        const c2 = this.container.createColumn();
        c2.addPanelGroup(new PanelGroup(new ToolbarPanel('Barra de Ferramentas'))); // (Req 3.1)
        c2.addPanelGroup(
            // (Req 3.1)
            new PanelGroup(
                new TextPanel('Painel 3', 'Mais um painel de texto.', null),
                null, // Altura do Grupo
                true // Grupo colapsado
            )
        );

        const c3 = this.container.createColumn();
        c3.addPanelGroup(new PanelGroup(new TextPanel('Painel 4', 'Conteúdo do painel 4.'))); // (Req 3.1)
        c3.addPanelGroup(
            // (Req 3.1)
            new PanelGroup(
                new ToolbarPanel() // Toolbar sem título
            )
        );

        this.container.updateColumnsSizes();

        const i18n = TranslationService.getInstance();
        appNotifications.success(i18n.translate('appstate.restore'));
    }

    addNewPanel() {
        const column = this.container.getFirstColumn();
        const title = `Novo Painel (${new Date().toLocaleTimeString()})`;
        const panel = new TextPanel(title, 'Conteúdo do novo painel.');
        // Envolve o novo painel em um novo grupo
        const panelGroup = new PanelGroup(panel);

        // (Req 3.1) Renomeado de addPanel para addPanelGroup
        column.addPanelGroup(panelGroup);
    }

    /**
     * Manipulador de resize chamado pelo debounce.
     */
    onResizeHandler() {
        this.container.getColumns().forEach(column => {
            // (Req 3.3) Renomeado de updatePanelsSizes para updatePanelGroupsSizes
            column.updatePanelGroupsSizes();
        });
    }
}
