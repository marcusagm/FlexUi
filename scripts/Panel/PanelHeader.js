export default class PanelHeader {
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
        this.moveHandle = document.createElement('div'); // Deve ser <button>
        this.moveHandle.classList.add('move-handle');
        this.moveHandle.draggable = true;
        this.moveHandle.addEventListener('dragstart', this.onDragStart.bind(this));
        this.moveHandle.addEventListener('dragend', this.onDragEnd.bind(this));
        // bônus: acessibilidade
        this.moveHandle.setAttribute('role', 'button');
        this.moveHandle.setAttribute('aria-label', `Mover painel ${this.state.title}`);

        this.titleEl = document.createElement('div');
        this.titleEl.classList.add('panel-title');
        this.titleEl.textContent = this.state.title;

        this.collapseBtn = document.createElement('button'); // Trocado para <button>
        this.collapseBtn.type = 'button';
        this.collapseBtn.classList.add('collapse-btn');
        this.collapseBtn.addEventListener('click', () => this.panel.toggleCollapse());
        this.collapseBtn.setAttribute('aria-label', 'Recolher painel');

        this.closeBtn = document.createElement('button'); // Trocado para <button>
        this.closeBtn.type = 'button';
        this.closeBtn.classList.add('close-btn');
        this.closeBtn.addEventListener('click', () => this.panel.close());
        this.closeBtn.setAttribute('aria-label', 'Fechar painel');

        this.element.append(this.moveHandle, this.titleEl, this.collapseBtn, this.closeBtn);
    }

    onDragStart(e) {
        // Delega o início do "arrastar" ao container
        this.panel.state.column.state.container.startDrag(this.panel, e);
        this.moveHandle.style.cursor = 'grabbing';
    }

    onDragEnd(e) {
        // Delega o fim do "arrastar" ao container
        this.panel.state.column.state.container.endDrag();
        this.moveHandle.style.cursor = 'grab';
    }
}
