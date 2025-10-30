import { appBus } from '../EventBus.js'; // NOVO

export class PanelHeader {
    // ... (state não muda)
    state = {
        title: null
    };

    constructor(panel, title) {
        this.panel = panel; // O painel pai
        this.state.title = title;
        this.element = document.createElement('div');
        this.element.classList.add('panel-header');
        this.build();
    }

    build() {
        this.moveHandle = document.createElement('div');
        this.moveHandle.classList.add('move-handle');
        this.moveHandle.draggable = true;
        // MODIFICADO: Emite eventos em vez de chamar o container
        this.moveHandle.addEventListener('dragstart', this.onDragStart.bind(this));
        this.moveHandle.addEventListener('dragend', this.onDragEnd.bind(this));
        this.moveHandle.setAttribute('role', 'button');
        this.moveHandle.setAttribute('aria-label', `Mover painel ${this.state.title}`);

        this.titleEl = document.createElement('div');
        this.titleEl.classList.add('panel-title');
        this.titleEl.textContent = this.state.title;

        this.collapseBtn = document.createElement('button');
        this.collapseBtn.type = 'button';
        this.collapseBtn.classList.add('collapse-btn');
        // MODIFICADO: Emite um evento
        this.collapseBtn.addEventListener('click', () => {
            appBus.emit('panel:toggle-collapse-request', this.panel);
        });
        this.collapseBtn.setAttribute('aria-label', 'Recolher painel');

        this.closeBtn = document.createElement('button');
        this.closeBtn.type = 'button';
        this.closeBtn.classList.add('close-btn');
        // MODIFICADO: Emite um evento
        this.closeBtn.addEventListener('click', () => {
            appBus.emit('panel:close-request', this.panel);
        });
        this.closeBtn.setAttribute('aria-label', 'Fechar painel');

        this.element.append(this.moveHandle, this.titleEl, this.collapseBtn, this.closeBtn);
    }

    onDragStart(e) {
        // MODIFICADO: Emite o evento com os dados necessários
        appBus.emit('panel:dragstart', { panel: this.panel, event: e });
        this.moveHandle.style.cursor = 'grabbing';
    }

    onDragEnd(e) {
        // MODIFICADO: Emite o evento
        appBus.emit('panel:dragend');
        this.moveHandle.style.cursor = 'grab';
    }
}
