import Container from './Container.js';
import Menu from './Menu/Menu.js';
import Panel from './Panel/Panel.js';

/**
 * Main application class for managing the UI layout, state persistence, and user interactions.
 *
 * @class
 * @property {Menu} menu - The menu instance associated with the app.
 * @property {Container} container - The container instance holding columns and panels.
 * @static {App} instance - Singleton reference to the current App instance.
 *
 * @method constructor Initializes the App, sets up UI elements, loads state, and attaches resize event.
 * @method initDefault Initializes the default layout with three columns and four panels.
 * @method loadState Loads the panel layout state from localStorage or initializes default layout.
 * @method saveState Saves the current panel layout state to localStorage.
 * @method restoreState Clears saved state and restores the default layout.
 * @method addNewPanel Adds a new panel to the first column.
 * @method onResize Handles window resize events and updates panel sizes.
 */
class App {
    /**
     * Initializes the App instance, sets up the menu and container,
     * appends them to the document body, loads the application state,
     * and adds a window resize event listener.
     *
     * @constructor
     */
    constructor() {
        App.instance = this;
        this.menu = new Menu(this);
        this.container = new Container();
        document.body.append(this.menu.element, this.container.element);
        this.loadState();
        window.addEventListener('resize', () => this.onResize());
    }

    /**
     * Initializes the default layout by creating three columns and adding panels to each.
     *
     * - Column 1: Adds "Painel 1" and "Painel 2".
     * - Column 2: Adds "Painel 3".
     * - Column 3: Adds "Painel 4".
     *
     * @returns {void}
     */
    initDefault() {
        const c1 = this.container.createColumn();
        c1.addPanel(new Panel('Painel 1', 'Conteúdo 1'));
        c1.addPanel(new Panel('Painel 2', 'Conteúdo 2'));
        const c2 = this.container.createColumn();
        c2.addPanel(new Panel('Painel 3', 'Conteúdo 3'));
        const c3 = this.container.createColumn();
        c3.addPanel(new Panel('Painel 4', 'Conteúdo 4'));
    }

    /**
     * Loads the panel state from localStorage and restores it.
     * If no saved state is found, initializes the default state.
     *
     * @returns {void}
     */
    loadState() {
        const saved = localStorage.getItem('panel_state');
        if (saved) this.container.restoreFromState(JSON.parse(saved));
        else this.initDefault();
    }

    saveState() {
        // console.log(this.container.getState());
        localStorage.setItem('panel_state', JSON.stringify(this.container.getState()));
        alert('Estado salvo com sucesso!');
    }

    restoreState() {
        localStorage.removeItem('panel_state');
        this.container.clear();
        this.initDefault();
    }

    addNewPanel() {
        const column = this.container.getFirstColumn();
        const panel = new Panel('Novo Painel' + Date(), 'Conteúdo novo');
        column.addPanel(panel);
    }

    onResize() {
        this.container.state.columns.forEach(column => {
            column.updatePanelsSizes();
        });
    }
}

export default App;
