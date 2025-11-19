import { Menu } from './components/Menu/Menu.js';
import { Container } from './components/Container/Container.js';
import { Panel } from './components/Panel/Panel.js';
import { TextPanel } from './components/Panel/TextPanel.js';
import { ToolbarPanel } from './components/Panel/ToolbarPanel.js';
import { PanelGroup } from './components/Panel/PanelGroup.js';
import { PanelFactory } from './components/Panel/PanelFactory.js';
import { StatusBar } from './components/StatusBar/StatusBar.js';
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
import { LayoutService } from './services/LayoutService.js';
import { appBus } from './utils/EventBus.js';
import { FloatingPanelManagerService } from './services/DND/FloatingPanelManagerService.js';
import { globalState } from './services/GlobalStateService.js';
import { CounterPanel } from './components/Panel/CounterPanel.js';
import { appShortcuts } from './services/Shortcuts/Shortcuts.js';
import { Loader } from './services/Loader/Loader.js';
import { ToolbarContainer } from './components/Toolbar/ToolbarContainer.js';
import { ToolbarGroupFactory } from './components/Toolbar/ToolbarGroupFactory.js';
import { ApplicationGroup } from './components/Toolbar/ApplicationGroup.js';
import { DropZoneType } from './constants/DNDTypes.js';
import { EventTypes } from './constants/EventTypes.js';

/**
 * Description:
 * Orchestrates the entire FlexUI application. It is a Singleton responsible
 * for initializing all core services (DND, Layout, State, PanelFactory),
 * instantiating the main UI components (Menu, Container, StatusBar),
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
 * - _toolbarTop {ToolbarContainer} : Instance of the top toolbar container.
 * - _toolbarBottom {ToolbarContainer} : Instance of the bottom toolbar container.
 * - _toolbarLeft {ToolbarContainer} : Instance of the left toolbar container.
 * - _toolbarRight {ToolbarContainer} : Instance of the right toolbar container.
 * - stateService {ApplicationStateService} : The singleton instance of the ApplicationStateService.
 * - _workspaceLoader {Loader} : The loader instance for the main container.
 * - _mainWrapper {HTMLElement} : The DOM wrapper for Menu and Container.
 * - _bound... {Function | null} : Bound event handlers for robust cleanup.
 * - debouncedResize {Function | null} : The debounced window resize handler.
 *
 * Typical usage:
 * // In main.js
 * const app = new App();
 * await app.init();
 *
 * Events:
 * - Listens to: EventTypes.APP_ADD_NEW_PANEL, EventTypes.APP_SAVE_STATE, EventTypes.APP_RESTORE_STATE, EventTypes.APP_RESET_STATE
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
 *
 * Dependencies:
 * - components/Menu/Menu.js
 * - components/Container/Container.js
 * - components/StatusBar/StatusBar.js
 * - components/Toolbar/ToolbarContainer.js
 * - components/Toolbar/ToolbarGroupFactory.js
 * - components/Toolbar/ApplicationGroup.js
 * - services/ApplicationStateService.js
 * - services/LayoutService.js
 * - services/DND/DragDropService.js (and all strategies)
 * - components/Panel/PanelFactory.js (and all Panel types)
 * - services/Notification/NotificationUIListener.js
 * - services/Shortcuts/Shortcuts.js
 * - utils/EventBus.js
 * - utils/Debounce.js
 * - services/Loader/Loader.js
 * - constants/EventTypes.js
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
     * Bound handler for resetting the layout silently.
     *
     * @type {Function | null}
     * @private
     */
    _boundResetLayoutSilent = null;

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
        me._boundResetLayoutSilent = me.resetLayout.bind(me, true);
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

        // Initialize factories and layout service for registration
        PanelFactory.getInstance();
        ToolbarGroupFactory.getInstance();
        LayoutService.getInstance();
        FloatingPanelManagerService.getInstance();

        // Initialize global state keys for the application
        globalState.set('counterValue', 0);
        globalState.set('activeTool', 'pointer');
        globalState.set('activeColor', '#FFFFFF');
    }

    /**
     * Registers all necessary DND strategies and component classes with factories.
     *
     * @private
     * @returns {void}
     */
    _registerStrategies() {
        const dds = DragDropService.getInstance();

        dds.registerStrategy(DropZoneType.COLUMN, new ColumnDropStrategy());
        dds.registerStrategy(DropZoneType.TAB_CONTAINER, new TabContainerDropStrategy());
        dds.registerStrategy(DropZoneType.ROW, new RowDropStrategy());
        dds.registerStrategy(DropZoneType.CONTAINER, new ContainerDropStrategy());
        dds.registerStrategy(DropZoneType.TOOLBAR_CONTAINER, new ToolbarContainerDropStrategy());

        const panelFactory = PanelFactory.getInstance();
        panelFactory.registerPanelClasses([Panel, TextPanel, ToolbarPanel, CounterPanel]);

        const toolbarFactory = ToolbarGroupFactory.getInstance();
        toolbarFactory.registerToolbarGroupClasses([ApplicationGroup]);
    }

    /**
     * Instantiates all main UI components (Menu, Container, Toolbars) and mounts them to the DOM Grid.
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

        const fpms = FloatingPanelManagerService.getInstance();
        fpms.registerContainer(me.container.element);

        me._mainWrapper = document.createElement('div');
        me._mainWrapper.className = 'app-wrapper';

        me._workspaceLoader = new Loader(me._mainWrapper, { type: 'inset' });

        // Assign grid-areas
        me.menu.element.style.gridArea = 'menu';
        me._toolbarTop.element.style.gridArea = 'toolbar-top';
        me._toolbarLeft.element.style.gridArea = 'toolbar-left';
        me.container.element.style.gridArea = 'main';
        me._toolbarRight.element.style.gridArea = 'toolbar-right';
        me._toolbarBottom.element.style.gridArea = 'toolbar-bottom';
        me.statusBar.element.style.gridArea = 'statusbar';

        // Append all 7 components to the grid wrapper
        me._mainWrapper.append(
            me.menu.element,
            me._toolbarTop.element,
            me._toolbarLeft.element,
            me.container.element,
            me._toolbarRight.element,
            me._toolbarBottom.element,
            me.statusBar.element
        );
        // Append only the wrapper to the body
        document.body.append(me._mainWrapper);
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
        appBus.on(EventTypes.APP_RESET_STATE, me._boundResetLayoutSilent, options);
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

        me.menu?.destroy();
        me.container?.destroy();
        me.statusBar?.destroy();
        me._toolbarTop?.destroy();
        me._toolbarBottom?.destroy();
        me._toolbarLeft?.destroy();
        me._toolbarRight?.destroy();
    }

    /**
     * Loads the initial layout from ApplicationStateService (localStorage or default JSON).
     *
     * @returns {Promise<void>}
     */
    async loadInitialLayout() {
        const me = this;
        const workspaceData = await me.stateService.loadState(me.STORAGE_KEY);

        if (workspaceData && workspaceData.layout) {
            me.currentWorkspace = workspaceData;

            // Restore Panels, Rows, Columns, Floating
            me.container.fromJSON(workspaceData.layout);

            // Restore Toolbars
            if (workspaceData.layout.toolbars) {
                me._toolbarTop.fromJSON(workspaceData.layout.toolbars.top || []);
                me._toolbarBottom.fromJSON(workspaceData.layout.toolbars.bottom || []);
                me._toolbarLeft.fromJSON(workspaceData.layout.toolbars.left || []);
                me._toolbarRight.fromJSON(workspaceData.layout.toolbars.right || []);
            }
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
        const i18n = TranslationService.getInstance();
        me._workspaceLoader.show(i18n.translate('actions.saving'));

        try {
            const layoutData = me.container.toJSON(); // { rows, floatingPanels }
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

            appNotifications.success(i18n.translate('appstate.save'));
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
        const i18n = TranslationService.getInstance();
        me._workspaceLoader.show(i18n.translate('actions.restoring'));

        try {
            FloatingPanelManagerService.getInstance().clearAll();
            me.container.clear();
            await me.loadInitialLayout();

            appNotifications.success(i18n.translate('appstate.restore'));
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
        const i18n = TranslationService.getInstance();
        me._workspaceLoader.show(i18n.translate('actions.reseting'));

        try {
            FloatingPanelManagerService.getInstance().clearAll();
            me.stateService.clearState(me.STORAGE_KEY);
            me.container.clear();

            await me.loadInitialLayout();

            if (!silent) {
                appBus.emit(EventTypes.STATUSBAR_SET_STATUS, i18n.translate('appstate.reset'));
            }
        } catch (err) {
            console.error('App.resetLayout: Falha ao redefinir.', err);
            appNotifications.danger('Falha ao redefinir o workspace.');
        } finally {
            me._workspaceLoader.hide();
        }
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
        const panel = new TextPanel(title, 'Conteúdo do novo painel.');

        const panelGroup = new PanelGroup(panel);

        column.addPanelGroup(panelGroup);
    }
}
