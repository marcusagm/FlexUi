import { Menu } from './components/Menu/Menu.js';
import { Container } from './components/Container/Container.js';
import { Panel } from './components/Panel/Panel.js';
import { TextPanel } from './components/Panel/TextPanel.js';
import { ToolbarPanel } from './components/Panel/ToolbarPanel.js';
import { CounterPanel } from './components/Panel/CounterPanel.js';
import { PanelGroup } from './components/Panel/PanelGroup.js';
import { PanelFactory } from './components/Panel/PanelFactory.js';
import { StatusBar } from './components/StatusBar/StatusBar.js';
import { ToolbarContainer } from './components/Toolbar/ToolbarContainer.js';
import { ToolbarGroupFactory } from './components/Toolbar/ToolbarGroupFactory.js';
import { ApplicationGroup } from './components/Toolbar/ApplicationGroup.js';
import { ViewportFactory } from './components/Viewport/ViewportFactory.js';
import { ApplicationWindow } from './components/Viewport/ApplicationWindow.js';
import { NotepadWindow } from './components/Viewport/ConcreteWindows/NotepadWindow.js';
import { Viewport } from './components/Viewport/Viewport.js';

import { ApplicationStateService } from './services/ApplicationStateService.js';
import { appNotifications } from './services/Notification/Notification.js';
import { NotificationUIListener } from './services/Notification/NotificationUIListener.js';
import { TranslationService } from './services/TranslationService.js';
import { DragDropService } from './services/DND/DragDropService.js';
import { ColumnDropStrategy } from './services/DND/ColumnDropStrategy.js';
import { RowDropStrategy } from './services/DND/RowDropStrategy.js';
import { ContainerDropStrategy } from './services/DND/ContainerDropStrategy.js';
import { TabContainerDropStrategy } from './services/DND/TabContainerDropStrategy.js';
import { ToolbarContainerDropStrategy } from './services/DND/ToolbarContainerDropStrategy.js';
import { ViewportDropStrategy } from './services/DND/ViewportDropStrategy.js';
import { ViewportTabDropStrategy } from './services/DND/ViewportTabDropStrategy.js';
import { LayoutService } from './services/LayoutService.js';
import { FloatingPanelManagerService } from './services/DND/FloatingPanelManagerService.js';
import { PopoutManagerService } from './services/PopoutManagerService.js';
import { appShortcuts } from './services/Shortcuts/Shortcuts.js';
import { Loader } from './services/Loader/Loader.js';
import { appBus } from './utils/EventBus.js';
import { stateManager } from './services/StateManager.js';
import { DropZoneType, ItemType } from './constants/DNDTypes.js';
import { EventTypes } from './constants/EventTypes.js';

/**
 * Description:
 * Orchestrates the entire FlexUI application. It is a Singleton responsible
 * for initializing all core services (DND, Layout, State, PanelFactory),
 * instantiating the main UI components (Menu, Container, StatusBar, Toolbars),
 * and handling global application events (like saving, loading, or adding
 * new panels).
 *
 * Properties summary:
 * - STORAGE_KEY {string} : The key used for saving the state in localStorage.
 * - currentWorkspace {object | null} : Holds the currently loaded workspace data.
 * - namespace {string} : A unique namespace for this singleton's appBus listeners.
 * - menu {Menu} : The instance of the main application menu.
 * - container {Container} : The instance of the root layout container component.
 * - statusBar {StatusBar} : The instance of the application status bar.
 * - stateService {ApplicationStateService} : The singleton instance of the ApplicationStateService.
 * - debouncedResize {Function | null} : The debounced window resize handler.
 *
 * Typical usage:
 * // In main.js
 * const app = new App();
 * await app.init();
 *
 * Events:
 * - Listens to: EventTypes.APP_ADD_NEW_PANEL
 * - Listens to: EventTypes.APP_SAVE_STATE
 * - Listens to: EventTypes.APP_RESTORE_STATE
 * - Listens to: EventTypes.APP_RESET_STATE
 * - Listens to: EventTypes.APP_ADD_NEW_WINDOW
 * - Emits: EventTypes.STATUSBAR_SET_PERMANENT_STATUS (on init)
 * - Emits: EventTypes.LAYOUT_INITIALIZED (on init, after load)
 * - Emits: EventTypes.STATUSBAR_SET_STATUS (on reset)
 *
 * Business rules implemented:
 * - Implements the Singleton pattern to ensure only one App instance.
 * - Centralizes service registration (DND strategies, Panel types, Shortcuts).
 * - Manages the top-level application lifecycle (init, destroy).
 * - Orchestrates layout persistence (save, restore, reset) by coordinating
 * ApplicationStateService and the root Container.
 * - Ensures UI components are mounted using the UIElement lifecycle (mount).
 *
 * Dependencies:
 * - {import('./components/Menu/Menu.js').Menu}
 * - {import('./components/Container/Container.js').Container}
 * - {import('./components/Panel/Panel.js').Panel}
 * - {import('./components/Panel/TextPanel.js').TextPanel}
 * - {import('./components/Panel/ToolbarPanel.js').ToolbarPanel}
 * - {import('./components/Panel/CounterPanel.js').CounterPanel}
 * - {import('./components/Panel/PanelGroup.js').PanelGroup}
 * - {import('./components/Panel/PanelFactory.js').PanelFactory}
 * - {import('./components/StatusBar/StatusBar.js').StatusBar}
 * - {import('./components/Toolbar/ToolbarContainer.js').ToolbarContainer}
 * - {import('./components/Toolbar/ToolbarGroupFactory.js').ToolbarGroupFactory}
 * - {import('./components/Toolbar/ApplicationGroup.js').ApplicationGroup}
 * - {import('./components/Viewport/ViewportFactory.js').ViewportFactory}
 * - {import('./components/Viewport/ApplicationWindow.js').ApplicationWindow}
 * - {import('./components/Viewport/ConcreteWindows/NotepadWindow.js').NotepadWindow}
 * - {import('./components/Viewport/Viewport.js').Viewport}
 * - {import('./services/ApplicationStateService.js').ApplicationStateService}
 * - {import('./services/Notification/Notification.js').appNotifications}
 * - {import('./services/Notification/NotificationUIListener.js').NotificationUIListener}
 * - {import('./services/TranslationService.js').TranslationService}
 * - {import('./services/DND/DragDropService.js').DragDropService}
 * - {import('./services/DND/ColumnDropStrategy.js').ColumnDropStrategy}
 * - {import('./services/DND/RowDropStrategy.js').RowDropStrategy}
 * - {import('./services/DND/ContainerDropStrategy.js').ContainerDropStrategy}
 * - {import('./services/DND/TabContainerDropStrategy.js').TabContainerDropStrategy}
 * - {import('./services/DND/ToolbarContainerDropStrategy.js').ToolbarContainerDropStrategy}
 * - {import('./services/DND/ViewportDropStrategy.js').ViewportDropStrategy}
 * - {import('./services/DND/ViewportTabDropStrategy.js').ViewportTabDropStrategy}
 * - {import('./services/LayoutService.js').LayoutService}
 * - {import('./utils/EventBus.js').appBus}
 * - {import('./services/DND/FloatingPanelManagerService.js').FloatingPanelManagerService}
 * - {import('./services/PopoutManagerService.js').PopoutManagerService}
 * - {import('./services/StateManager.js').stateManager}
 * - {import('./services/Shortcuts/Shortcuts.js').appShortcuts}
 * - {import('./services/Loader/Loader.js').Loader}
 * - {import('./constants/DNDTypes.js').DropZoneType}
 * - {import('./constants/EventTypes.js').EventTypes}
 */
export class App {
    /**
     * The main storage key for the layout.
     *
     * @type {string}
     * @public
     */
    STORAGE_KEY = 'panel_state';

    /**
     * Stores the loaded workspace object (including name and layout).
     *
     * @type {object | null}
     * @public
     */
    currentWorkspace = null;

    /**
     * Unique namespace for this singleton's appBus listeners.
     *
     * @type {string}
     * @public
     */
    namespace = 'app_singleton';

    /**
     * The debounced window resize handler.
     *
     * @type {Function | null}
     * @public
     */
    debouncedResize = null;

    /**
     * Loader instance for the workspace (inset).
     *
     * @type {import('./services/Loader/Loader.js').Loader | null}
     * @private
     */
    _workspaceLoader = null;

    /**
     * Main DOM wrapper for Menu and Container.
     *
     * @type {HTMLElement | null}
     * @private
     */
    _mainWrapper = null;

    /**
     * Instance of the top toolbar container.
     *
     * @type {import('./components/Toolbar/ToolbarContainer.js').ToolbarContainer | null}
     * @private
     */
    _toolbarTop = null;

    /**
     * Instance of the bottom toolbar container.
     *
     * @type {import('./components/Toolbar/ToolbarContainer.js').ToolbarContainer | null}
     * @private
     */
    _toolbarBottom = null;

    /**
     * Instance of the left toolbar container.
     *
     * @type {import('./components/Toolbar/ToolbarContainer.js').ToolbarContainer | null}
     * @private
     */
    _toolbarLeft = null;

    /**
     * Instance of the right toolbar container.
     *
     * @type {import('./components/Toolbar/ToolbarContainer.js').ToolbarContainer | null}
     * @private
     */
    _toolbarRight = null;

    /**
     * The singleton instance of the ApplicationStateService.
     *
     * @type {import('./services/ApplicationStateService.js').ApplicationStateService}
     * @public
     */
    stateService;

    /**
     * The main menu component instance.
     *
     * @type {import('./components/Menu/Menu.js').Menu}
     * @public
     */
    menu;

    /**
     * The root layout container component instance.
     *
     * @type {import('./components/Container/Container.js').Container}
     * @public
     */
    container;

    /**
     * The application status bar instance.
     *
     * @type {import('./components/StatusBar/StatusBar.js').StatusBar}
     * @public
     */
    statusBar;

    /**
     * Bound handler for adding a new panel.
     *
     * @type {Function | null}
     * @private
     */
    _boundAddNewPanel = null;

    /**
     * Bound handler for adding a new window.
     *
     * @type {Function | null}
     * @private
     */
    _boundAddNewWindow = null;

    /**
     * Bound handler for saving the layout.
     *
     * @type {Function | null}
     * @private
     */
    _boundSaveLayout = null;

    /**
     * Bound handler for restoring the layout.
     *
     * @type {Function | null}
     * @private
     */
    _boundRestoreLayout = null;

    /**
     * Bound handler for resetting the layout.
     *
     * @type {Function | null}
     * @private
     */
    _boundResetLayout = null;

    /**
     * Creates an instance of App.
     * Implements the Singleton pattern.
     */
    constructor() {
        if (App.instance) {
            return App.instance;
        }
        App.instance = this;

        const me = this;

        me._initializeServices();
        me._registerStrategies();
        me._initializeUI();

        me._boundAddNewPanel = me.addNewPanel.bind(me);
        me._boundAddNewWindow = me.addNewWindow.bind(me);
        me._boundSaveLayout = me.saveLayout.bind(me);
        me._boundRestoreLayout = me.restoreLayout.bind(me);
        me._boundResetLayout = me.resetLayout.bind(me, false);

        me.initEventListeners();
        me._registerGlobalShortcuts();

        const uiListener = new NotificationUIListener(document.body);
        uiListener.listen(appNotifications);
    }

    /**
     * Initializes all core singleton services.
     *
     * @private
     * @returns {void}
     */
    _initializeServices() {
        const me = this;
        me.stateService = ApplicationStateService.getInstance();

        PanelFactory.getInstance();
        ToolbarGroupFactory.getInstance();
        ViewportFactory.getInstance();
        LayoutService.getInstance();
        FloatingPanelManagerService.getInstance();
        PopoutManagerService.getInstance();

        stateManager.set('counterValue', 0);
        stateManager.set('activeTool', 'pointer');
        stateManager.set('activeColor', '#FFFFFF');
    }

    /**
     * Registers all necessary DND strategies and component classes with factories.
     *
     * @private
     * @returns {void}
     */
    _registerStrategies() {
        const dragDropService = DragDropService.getInstance();

        dragDropService.registerStrategy(DropZoneType.COLUMN, new ColumnDropStrategy());
        dragDropService.registerStrategy(
            DropZoneType.TAB_CONTAINER,
            new TabContainerDropStrategy()
        );
        dragDropService.registerStrategy(DropZoneType.ROW, new RowDropStrategy());
        dragDropService.registerStrategy(DropZoneType.CONTAINER, new ContainerDropStrategy());
        dragDropService.registerStrategy(
            DropZoneType.TOOLBAR_CONTAINER,
            new ToolbarContainerDropStrategy()
        );
        dragDropService.registerStrategy(DropZoneType.VIEWPORT, new ViewportDropStrategy());
        dragDropService.registerStrategy(
            DropZoneType.VIEWPORT_TAB_BAR,
            new ViewportTabDropStrategy()
        );

        const panelFactory = PanelFactory.getInstance();
        panelFactory.registerPanelClasses([Panel, TextPanel, ToolbarPanel, CounterPanel]);

        const toolbarFactory = ToolbarGroupFactory.getInstance();
        toolbarFactory.registerToolbarGroupClasses([ApplicationGroup]);

        const viewportFactory = ViewportFactory.getInstance();
        viewportFactory.registerWindowType(DropZoneType.VIEWPORT, Viewport);
        viewportFactory.registerWindowType(ItemType.APPLICATION_WINDOW, ApplicationWindow);
        viewportFactory.registerWindowType('NotepadWindow', NotepadWindow);
    }

    /**
     * Instantiates all main UI components (Menu, Container, Toolbars) and mounts them to the DOM Grid.
     * This method replaces the manual append approach with the UIElement mount lifecycle.
     *
     * @private
     * @returns {void}
     */
    _initializeUI() {
        const me = this;

        me.menu = new Menu();
        me.container = new Container();
        me.statusBar = new StatusBar();
        me._toolbarTop = new ToolbarContainer('top', 'horizontal');
        me._toolbarBottom = new ToolbarContainer('bottom', 'horizontal');
        me._toolbarLeft = new ToolbarContainer('left', 'vertical');
        me._toolbarRight = new ToolbarContainer('right', 'vertical');

        const floatingManager = FloatingPanelManagerService.getInstance();
        floatingManager.registerContainer(me.container.element);

        me._mainWrapper = document.createElement('div');
        me._mainWrapper.className = 'app-wrapper';

        me._workspaceLoader = new Loader(me._mainWrapper, { type: 'inset' });

        me.menu.element.style.gridArea = 'menu';
        me._toolbarTop.element.style.gridArea = 'toolbar-top';
        me._toolbarLeft.element.style.gridArea = 'toolbar-left';
        me.container.element.style.gridArea = 'main';
        me._toolbarRight.element.style.gridArea = 'toolbar-right';
        me._toolbarBottom.element.style.gridArea = 'toolbar-bottom';
        me.statusBar.element.style.gridArea = 'statusbar';

        document.body.append(me._mainWrapper);

        me.menu.mount(me._mainWrapper);
        me._toolbarTop.mount(me._mainWrapper);
        me._toolbarLeft.mount(me._mainWrapper);
        me.container.mount(me._mainWrapper);
        me._toolbarRight.mount(me._mainWrapper);
        me._toolbarBottom.mount(me._mainWrapper);
        me.statusBar.mount(me._mainWrapper);
    }

    /**
     * Registers all global application shortcuts.
     *
     * @private
     * @returns {void}
     */
    _registerGlobalShortcuts() {
        appShortcuts.register({
            keys: 'Ctrl+S',
            command: EventTypes.APP_SAVE_STATE,
            scopes: ['global'],
            preventDefault: true
        });

        appShortcuts.register({
            keys: 'Ctrl+R',
            command: EventTypes.APP_RESTORE_STATE,
            scopes: ['global'],
            preventDefault: true
        });

        appShortcuts.register({
            keys: 'Ctrl+Shift+R',
            command: EventTypes.APP_RESET_STATE,
            scopes: ['global'],
            preventDefault: true
        });

        appShortcuts.register({
            keys: 'Ctrl+N',
            command: EventTypes.APP_ADD_NEW_PANEL,
            scopes: ['global'],
            preventDefault: true
        });
    }

    /**
     * Initializes the application asynchronously, loading the menu and layout.
     * This must be called after instantiation.
     *
     * @returns {Promise<void>}
     */
    async init() {
        const me = this;
        await me.menu.load();
        await me.loadInitialLayout();

        appBus.emit(EventTypes.LAYOUT_INITIALIZED, me.container);

        appBus.emit(EventTypes.STATUSBAR_SET_PERMANENT_STATUS, 'Pronto');
    }

    /**
     * Initializes all global appBus event listeners for this singleton.
     * Uses namespaces for easy cleanup.
     *
     * @returns {void}
     */
    initEventListeners() {
        const me = this;
        const options = { namespace: me.namespace };

        appBus.on(EventTypes.APP_ADD_NEW_PANEL, me._boundAddNewPanel, options);
        appBus.on(EventTypes.APP_ADD_NEW_WINDOW, me._boundAddNewWindow, options);
        appBus.on(EventTypes.APP_SAVE_STATE, me._boundSaveLayout, options);
        appBus.on(EventTypes.APP_RESTORE_STATE, me._boundRestoreLayout, options);
        appBus.on(EventTypes.APP_RESET_STATE, me._boundResetLayout, options);
    }

    /**
     * Cleans up all event listeners and child components.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        appBus.offByNamespace(me.namespace);

        window.removeEventListener('resize', me.debouncedResize);
        me.debouncedResize?.cancel();

        me.menu?.dispose();
        me.container?.dispose();
        me.statusBar?.dispose();
        me._toolbarTop?.dispose();
        me._toolbarBottom?.dispose();
        me._toolbarLeft?.dispose();
        me._toolbarRight?.dispose();

        if (me._mainWrapper) {
            me._mainWrapper.remove();
        }
    }

    /**
     * Loads the initial layout from ApplicationStateService.
     * Handles restoration of standard grid and external popouts.
     * Includes a delay loop to mitigate popup blockers.
     *
     * @returns {Promise<void>}
     */
    async loadInitialLayout() {
        const me = this;
        const workspaceData = await me.stateService.loadState(me.STORAGE_KEY);

        if (workspaceData && workspaceData.layout) {
            me.currentWorkspace = workspaceData;

            me.container.fromJSON(workspaceData.layout);

            me._restoreToolbars(workspaceData.layout.toolbars);
            await me._restorePopouts(workspaceData.popouts);
        } else {
            console.error(
                'App: Falha crítica ao carregar o layout. Nenhum dado de workspace foi encontrado.'
            );
            appNotifications.danger(
                'Falha crítica ao carregar o layout. O arquivo default.json pode estar faltando.'
            );
        }
    }

    /**
     * Serializes the current layout from the container and saves it to localStorage.
     *
     * @returns {Promise<void>}
     */
    async saveLayout() {
        const me = this;
        const translationService = TranslationService.getInstance();
        me._workspaceLoader.show(translationService.translate('actions.saving'));

        try {
            const layoutData = me.container.toJSON();
            layoutData.toolbars = {
                top: me._toolbarTop.toJSON(),
                bottom: me._toolbarBottom.toJSON(),
                left: me._toolbarLeft.toJSON(),
                right: me._toolbarRight.toJSON()
            };

            if (me.currentWorkspace) {
                me.currentWorkspace.layout = layoutData;
            } else {
                console.warn(
                    'App.saveLayout: currentWorkspace é nulo. Criando novo objeto de workspace.'
                );
                me.currentWorkspace = {
                    name: 'Workspace Salvo (Fallback)',
                    layout: layoutData
                };
            }

            await me.stateService.saveState(me.STORAGE_KEY, me.currentWorkspace);

            appNotifications.success(translationService.translate('appstate.save'));
        } catch (err) {
            console.error('App.saveLayout: Falha ao salvar o estado.', err);
            appNotifications.danger('Falha ao salvar o workspace.');
        } finally {
            me._workspaceLoader.hide();
        }
    }

    /**
     * Restores the layout from the last saved state.
     *
     * @returns {Promise<void>}
     */
    async restoreLayout() {
        const me = this;
        const translationService = TranslationService.getInstance();
        me._workspaceLoader.show(translationService.translate('actions.restoring'));

        try {
            FloatingPanelManagerService.getInstance().clearAll();

            const popoutService = PopoutManagerService.getInstance();
            if (popoutService._activePopouts) {
                popoutService._activePopouts.forEach(win => {
                    win.close();
                });
                popoutService._activePopouts.clear();
            }

            me.container.clear();
            await me.loadInitialLayout();

            appNotifications.success(translationService.translate('appstate.restore'));
        } catch (err) {
            console.error('App.restoreLayout: Falha ao restaurar.', err);
            appNotifications.danger('Falha ao restaurar o workspace.');
        } finally {
            me._workspaceLoader.hide();
        }
    }

    /**
     * Clears the saved state from localStorage and reloads the default layout.
     *
     * @param {boolean} [silent=false] - If true, avoids showing a status notification.
     * @returns {Promise<void>}
     */
    async resetLayout(silent = false) {
        const me = this;
        const translationService = TranslationService.getInstance();
        me._workspaceLoader.show(translationService.translate('actions.reseting'));

        try {
            FloatingPanelManagerService.getInstance().clearAll();
            const popoutService = PopoutManagerService.getInstance();
            if (popoutService._activePopouts) {
                popoutService._activePopouts.forEach(win => {
                    win.close();
                });
                popoutService._activePopouts.clear();
            }

            me.stateService.clearState(me.STORAGE_KEY);
            me.container.clear();

            await me.loadInitialLayout();

            if (!silent) {
                appBus.emit(
                    EventTypes.STATUSBAR_SET_STATUS,
                    translationService.translate('appstate.reset')
                );
            }
        } catch (err) {
            console.error('App.resetLayout: Falha ao redefinir.', err);
            appNotifications.danger('Falha ao redefinir o workspace.');
        } finally {
            me._workspaceLoader.hide();
        }
    }

    /**
     * Restores toolbars from the layout data.
     *
     * @param {object} toolbarsData - The toolbars data object.
     * @returns {void}
     * @private
     */
    _restoreToolbars(toolbarsData) {
        const me = this;
        if (!toolbarsData) return;

        me._toolbarTop.fromJSON(toolbarsData.top || []);
        me._toolbarBottom.fromJSON(toolbarsData.bottom || []);
        me._toolbarLeft.fromJSON(toolbarsData.left || []);
        me._toolbarRight.fromJSON(toolbarsData.right || []);
    }

    /**
     * Restores popouts from the workspace data.
     *
     * @param {Array} popoutsData - The array of popout data.
     * @returns {Promise<void>}
     * @private
     */
    async _restorePopouts(popoutsData) {
        const me = this;
        if (!popoutsData || !Array.isArray(popoutsData)) return;

        const targetViewport = me._findFirstViewport();
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

        for (const popoutData of popoutsData) {
            const payload = popoutData.data || popoutData.groupData;
            const geometry = popoutData.geometry;
            const type = popoutData.type || 'PanelGroup';

            if (!payload) continue;

            if (type === 'ApplicationWindow') {
                const factory = ViewportFactory.getInstance();
                const win = factory.createWindow(payload);
                if (win && targetViewport) {
                    targetViewport.addWindow(win);

                    await PopoutManagerService.getInstance().popoutWindow(win, geometry);
                }
            } else {
                const group = new PanelGroup();
                group.fromJSON(payload);
                await PopoutManagerService.getInstance().popoutGroup(group, geometry);
            }

            const defaultDelay = 200;
            await delay(defaultDelay);
        }
    }

    /**
     * Helper to find the first Viewport in the container.
     *
     * @returns {import('./components/Viewport/Viewport.js').Viewport | null}
     * @private
     */
    _findFirstViewport() {
        const me = this;
        let targetViewport = null;

        const traverse = node => {
            if (targetViewport) return;
            if (node instanceof Viewport) {
                targetViewport = node;
                return;
            }
            if (node.children) node.children.forEach(traverse);
            else if (node.columns) node.columns.forEach(traverse);
            else if (node.rows) node.rows.forEach(traverse);
        };
        traverse(me.container);
        return targetViewport;
    }

    /**
     * Handles the 'app:add-new-panel' event by creating a new default
     * TextPanel in the first available column.
     *
     * @returns {void}
     */
    addNewPanel() {
        const me = this;
        const column = me.container.getFirstRow().getFirstColumn();
        const title = `Novo Painel (${new Date().toLocaleTimeString()})`;

        const panel = new TextPanel(title, { content: 'Conteúdo do novo painel.' });
        const panelGroup = new PanelGroup(panel);

        column.addChild(panelGroup);
    }

    /**
     * Handles the 'app:add-new-window' event by creating a new
     * NotepadWindow in the first available Viewport found.
     *
     * @returns {void}
     */
    addNewWindow() {
        const me = this;
        const targetViewport = me._findFirstViewport();

        if (targetViewport) {
            const note = new NotepadWindow('Documento Novo', 'Digite seu texto aqui.', {
                x: 10,
                y: 10,
                width: 200,
                height: 150
            });
            targetViewport.addWindow(note);
            appNotifications.success('Nova janela criada.');
        } else {
            appNotifications.warning(
                'Nenhum Viewport encontrado para abrir a janela. Adicione um Viewport ao layout primeiro.'
            );
        }
    }
}
