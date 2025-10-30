import Menu from './Menu/Menu.js';
import Container from './Container.js';
import TextPanel from './Panel/TextPanel.js';
import ToolbarPanel from './Panel/ToolbarPanel.js';

export default class App {
    constructor() {
        App.instance = this;
        this.menu = new Menu(this);
        this.container = new Container();
        document.body.append(this.menu.element, this.container.element);
        this.loadState();
        window.addEventListener('resize', () => this.onResize());
    }

    initDefault() {
        // Usa os novos painéis customizados
        const c1 = this.container.createColumn();
        c1.addPanel(new TextPanel('Painel de Texto 1', 'Este é um painel customizado.'));
        c1.addPanel(
            new TextPanel('Painel de Texto 2', 'O conteúdo é gerenciado pela subclasse.', 200)
        );

        const c2 = this.container.createColumn();
        c2.addPanel(new ToolbarPanel('Barra de Ferramentas'));
        c2.addPanel(new TextPanel('Painel 3', 'Mais um painel de texto.', null, true)); // collapsed

        const c3 = this.container.createColumn();
        c3.addPanel(new TextPanel('Painel 4', 'Conteúdo do painel 4.'));

        this.container.updateColumnsSizes();
    }

    loadState() {
        const saved = localStorage.getItem('panel_state');
        if (saved) {
            try {
                this.container.restoreFromState(JSON.parse(saved));
            } catch (e) {
                console.error('Falha ao carregar estado, restaurando padrão.', e);
                this.restoreState();
            }
        } else {
            this.initDefault();
        }
    }

    saveState() {
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
        const title = `Novo Painel (${new Date().toLocaleTimeString()})`;
        const panel = new TextPanel(title, 'Conteúdo do novo painel.');
        column.addPanel(panel);
    }

    onResize() {
        this.container.state.columns.forEach(column => {
            column.updatePanelsSizes();
        });
    }
}
