import { PanelContent } from './PanelContent.js';
import { PanelHeader } from './PanelHeader.js';
import { appBus } from '../EventBus.js';

export class Panel {
    state = {
        column: null,
        header: null,
        content: null,
        collapsed: false,
        height: null,
        floater: false,
        minHeight: 100
    };

    constructor(title, height = null, collapsed = false) {
        this.state.content = new PanelContent();
        this.state.collapsed = collapsed;
        this.element = document.createElement('div');
        this.element.classList.add('panel');

        this.state.header = new PanelHeader(this, title);
        if (height !== null) {
            this.state.height = height;
        }

        this.build();
        this.populateContent();
        this.initEventListeners();
    }

    initEventListeners() {
        appBus.on('panel:close-request', this.onCloseRequest.bind(this));
        appBus.on('panel:toggle-collapse-request', this.onToggleCollapseRequest.bind(this));
    }

    onCloseRequest(panel) {
        if (panel === this) {
            this.close();
        }
    }

    onToggleCollapseRequest(panel) {
        if (panel === this) {
            this.toggleCollapse();
        }
    }

    destroy() {
        appBus.off('panel:close-request', this.onCloseRequest.bind(this));
        appBus.off('panel:toggle-collapse-request', this.onToggleCollapseRequest.bind(this));
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
     * @abstract
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
        appBus.emit('panel:removed', { panel: this, column: this.state.column });
        this.destroy();
    }

    updateHeight() {
        if (this.state.collapsed) {
            this.element.style.height = 'auto';
            this.element.style.flex = '0 0 auto';
            this.element.classList.add('collapsed');
            return;
        }

        this.element.classList.remove('collapsed');

        if (this.state.height !== null) {
            this.element.style.height = `${this.state.height}px`;
            this.element.style.flex = '0 0 auto';
        } else {
            this.element.style.height = 'auto';
            this.element.style.flex = '0 0 auto';
        }
    }

    startResize(e) {
        e.preventDefault();
        const startY = e.clientY;
        const startH = this.element.offsetHeight;

        const onMove = ev => {
            const delta = ev.clientY - startY;
            this.state.height = Math.max(this.state.minHeight, startH + delta);
            this.state.column?.updatePanelsSizes();
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }
}
