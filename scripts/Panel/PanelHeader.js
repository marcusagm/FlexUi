import { appBus } from '../EventBus.js'; // NOVO

export class PanelHeader {
    state = {
        title: null
    };

    constructor(panel, title) {
        this.panel = panel;
        this.state.title = title;
        this.element = document.createElement('div');
        this.element.classList.add('panel-header');
        this.build();
    }

    build() {
        // --- 1. Move Handle
        if (this.panel.state.movable) {
            this.moveHandle = document.createElement('div');
            this.moveHandle.classList.add('move-handle');
            this.moveHandle.draggable = true;
            this.moveHandle.addEventListener('dragstart', this.onDragStart.bind(this));
            this.moveHandle.addEventListener('dragend', this.onDragEnd.bind(this));
            this.moveHandle.setAttribute('role', 'button');
            this.moveHandle.setAttribute('aria-label', `Mover painel ${this.panel.state.title}`);
            this.element.appendChild(this.moveHandle);
        }

        // --- 2. Title
        if (this.panel.state.hasTitle) {
            this.titleEl = document.createElement('div');
            this.titleEl.classList.add('panel-title');
            this.titleEl.textContent = this.state.title;
            this.element.appendChild(this.titleEl);
        }

        // FIX DE LAYOUT: Elemento espaçador (header-spacer)
        this.spacerEl = document.createElement('div');
        this.spacerEl.classList.add('header-spacer');
        this.element.appendChild(this.spacerEl);

        // --- 3. Collapse Button
        if (this.panel.state.collapsible) {
            this.collapseBtn = document.createElement('button');
            this.collapseBtn.type = 'button';
            this.collapseBtn.classList.add('collapse-btn');
            this.collapseBtn.addEventListener('click', () => {
                appBus.emit('panel:toggle-collapse-request', this.panel);
            });
            this.collapseBtn.setAttribute('aria-label', 'Recolher painel');
            this.element.appendChild(this.collapseBtn);
        }

        // --- 4. Close Button
        if (this.panel.state.closable) {
            this.closeBtn = document.createElement('button');
            this.closeBtn.type = 'button';
            this.closeBtn.classList.add('close-btn');
            this.closeBtn.addEventListener('click', () => {
                appBus.emit('panel:close-request', this.panel);
            });
            this.closeBtn.setAttribute('aria-label', 'Fechar painel');
            this.element.appendChild(this.closeBtn);
        }
    }

    onDragStart(e) {
        appBus.emit('panel:dragstart', { panel: this.panel, event: e });
        this.moveHandle.style.cursor = 'grabbing';
    }

    onDragEnd(e) {
        appBus.emit('panel:dragend');
        this.moveHandle.style.cursor = 'grab';
    }
}
