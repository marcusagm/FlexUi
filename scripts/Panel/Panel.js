import PanelContent from './PanelContent.js';
import PanelHeader from './PanelHeader.js';

export default class Panel {
    state = {
        column: null,
        header: null,
        content: null,
        collapsed: false,
        height: null,
        floater: false
    };

    constructor(title, height = null, collapsed = false) {
        // Cria um wrapper de conteúdo VAZIO
        this.state.content = new PanelContent();
        this.state.collapsed = collapsed;
        this.element = document.createElement('div');
        this.element.classList.add('panel');
        this.state.header = new PanelHeader(this, title);
        if (height !== null) {
            this.state.height = height;
        }
        this.build();
        // Permite que subclasses preencham o conteúdo
        this.populateContent();
    }

    build() {
        this.resizeHandle = document.createElement('div');
        this.resizeHandle.classList.add('resize-handle');
        this.resizeHandle.addEventListener('mousedown', this.startResize.bind(this));
        this.element.append(
            this.state.header.element,
            this.state.content.element,
            this.resizeHandle
        );
        this.updateCollapse();
        this.updateHeight();
    }

    /**
     * Método para subclasses preencherem o conteúdo.
     * A classe base não faz nada.
     */
    populateContent() {
        // Ex: this.state.content.element.innerHTML = 'Conteúdo Padrão';
    }

    /**
     * Define o conteúdo HTML do painel.
     * Usado para restaurar o estado.
     * @param {string} htmlString
     */
    setContent(htmlString) {
        this.state.content.element.innerHTML = htmlString;
    }

    /**
     * Retorna o elemento DOM do conteúdo para subclasses.
     * @returns {HTMLElement}
     */
    getContentElement() {
        return this.state.content.element;
    }

    /**
     * Retorna o tipo de painel, usado para salvar/restaurar.
     * @returns {string}
     */
    getPanelType() {
        return 'Panel';
    }

    canCollapse() {
        if (!this.state.column) return false;
        return this.state.column.getPanelsUncollapsed().length > 1;
    }

    setParentColumn(column) {
        this.state.column = column;
    }

    toggleCollapse() {
        if (this.state.collapsed) {
            this.unCollapse();
        } else {
            if (!this.canCollapse()) {
                return;
            }
            this.collapse();
        }
        this.state.column?.updatePanelsSizes();
    }

    updateCollapse() {
        if (this.state.collapsed) {
            this.collapse();
        } else {
            this.unCollapse();
        }
    }

    collapse() {
        this.state.collapsed = true;
        this.element.classList.add('collapsed');
        this.state.content.element.style.display = 'none';
        this.resizeHandle.style.display = 'none';
        this.updateHeight();
    }

    unCollapse() {
        this.state.collapsed = false;
        this.element.classList.remove('collapsed');
        this.state.content.element.style.display = '';
        this.resizeHandle.style.display = '';
        this.updateHeight();
    }

    close() {
        const column = this.state.column;
        column?.removePanel(this);
    }

    updateHeight() {
        if (this.state.column !== null && this.state.collapsed === false) {
            const nonCollapsed = this.state.column.getPanelsUncollapsed();
            const idx = nonCollapsed.indexOf(this);

            if (idx === nonCollapsed.length - 1) {
                this.element.style.flex = '1 0 auto';
                return;
            }
        }
        if (this.state.height === null || this.state.collapsed === true) {
            this.element.style.flex = '0 0 auto';
            return;
        }
        if (this.state.height !== null) {
            this.element.style.flex = '0 0 ' + this.state.height + 'px';
        }
    }

    startResize(e) {
        const col = this.element.parentElement;
        const nonCollapsed = Array.from(col.children).filter(
            c => c.classList.contains('panel') && !c.classList.contains('collapsed')
        );
        if (nonCollapsed.length < 2) return;
        e.preventDefault();
        const panelEl = this.element;
        const startY = e.clientY;
        const startH = panelEl.offsetHeight;
        const onMove = ev => {
            const newH = Math.max(100, startH + ev.clientY - startY);
            this.state.height = newH;
            this.updateHeight();
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }
}
