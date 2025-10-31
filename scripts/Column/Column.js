import { appBus } from '../EventBus.js'; // NOVO

export class Column {
    state = {
        container: null,
        panels: [],
        width: null
    };

    constructor(container, width = null) {
        this.state.container = container;
        this.element = document.createElement('div');
        this.element.classList.add('column');
        this.state.width = width;
        this.initDragDrop();

        // O local onde addResizeBars é chamado deve ser verificado para garantir
        // que painéis e resize-bars estejam na ordem desejada no DOM.
        // Assumindo que addResizeBars existe e adiciona os elementos ao this.element.
        // this.addResizeBars();

        this.initEventListeners();
    }

    initEventListeners() {
        appBus.on('panel:removed', this.onPanelRemoved.bind(this));
    }

    onPanelRemoved({ panel, column }) {
        if (column === this) {
            this.removePanel(panel, true);
        }
    }

    destroy() {
        appBus.off('panel:removed', this.onPanelRemoved.bind(this));
        [...this.state.panels].forEach(panel => panel.destroy());
    }

    setParentContainer(container) {
        this.state.container = container;
    }

    initDragDrop() {
        this.element.addEventListener('dragover', this.onDragOver.bind(this));
        this.element.addEventListener('drop', this.onDrop.bind(this));
    }

    /**
     * Adiciona barras de redimensionamento.
     * @param {boolean} isLast - Indica se esta é a última coluna no container.
     */
    addResizeBars(isLast) {
        this.element.querySelectorAll('.resize-bar').forEach(b => b.remove());
        this.element.classList.remove('resize-right');

        if (isLast) return;

        this.element.classList.add('resize-right');
        const bar = document.createElement('div');
        bar.classList.add('resize-bar');
        this.element.appendChild(bar);
        bar.addEventListener('mousedown', e => this.startResize(e, 'right'));
    }

    startResize(e, side) {
        const container = this.state.container;

        const columns = container.state.children.filter(c => c instanceof Column);
        const cols = columns.map(c => c.element);

        const idx = cols.indexOf(this.element);
        if (cols.length === 1 || idx === cols.length - 1) return;

        e.preventDefault();
        const startX = e.clientX;
        const startW = this.element.offsetWidth;

        const onMove = ev => {
            const delta = ev.clientX - startX;
            this.state.width = Math.max(150, startW + delta);
            container.updateColumnsSizes();
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    /**
     * Atualiza a largura da coluna.
     * @param {boolean} isLast - Indica se esta é a última coluna no container.
     */
    updateWidth(isLast) {
        if (isLast) {
            this.element.style.flex = `1 1 auto`;
            return;
        }
        if (this.state.width !== null) {
            this.element.style.flex = `0 0 ${this.state.width}px`;
        }
    }

    onDragOver(e) {
        e.preventDefault();
        const draggedPanel = this.state.container.getDraggedPanel();
        const placeholder = this.state.container.getPlaceholder();
        if (!draggedPanel) return;

        const oldColumn = draggedPanel.state.column;
        const originalIndex = oldColumn.getPanelIndex(draggedPanel);

        // 1. Garante que o placeholder esteja nesta coluna
        if (placeholder.parentElement !== this.element) {
            placeholder.parentElement?.removeChild(placeholder);
            this.element.appendChild(placeholder);
        }

        const panels = Array.from(this.element.querySelectorAll('.panel'));
        let placed = false;
        let dropIndex = panels.length; // Índice de destino padrão (final da coluna)

        // 2. Encontra o índice de drop e posiciona o placeholder
        for (let i = 0; i < panels.length; i++) {
            const ch = panels[i];
            const rect = ch.getBoundingClientRect();
            if (e.clientY < rect.top + rect.height / 2) {
                this.element.insertBefore(placeholder, ch);
                placed = true;
                dropIndex = i;
                break;
            }
        }
        if (!placed) {
            this.element.appendChild(placeholder);
            // dropIndex permanece como panels.length (final da coluna)
        }

        // 3. LÓGICA CRÍTICA: Esconder o placeholder se for na posição original
        // Esta é a mesma verificação usada no onDrop para prevenir movimentos indesejados.
        const isSameColumn = oldColumn === this;
        const isOriginalPosition = dropIndex === originalIndex;
        const isBelowGhost = dropIndex === originalIndex + 1;

        if (isSameColumn && (isOriginalPosition || isBelowGhost)) {
            // Se o painel está sendo solto em sua área original, escondemos o placeholder.
            // Para escondê-lo, vamos temporariamente removê-lo da coluna.
            placeholder.remove();
        }
        // Se não estiver na posição original, ele já foi inserido acima (passos 1 e 2).
    }

    onDrop(e) {
        e.preventDefault();
        const draggedPanel = this.state.container.getDraggedPanel();
        const placeholder = this.state.container.getPlaceholder();
        if (!draggedPanel) return;

        const oldColumn = draggedPanel.state.column;

        // Se o placeholder não estiver na coluna, significa que o drop foi na área original
        // e o placeholder foi removido em onDragOver. Fazemos a limpeza e saímos.
        if (placeholder.parentElement !== this.element) {
            // Este caso só ocorre se o drop for feito na área "original" após onDragOver ter removido o ghost
            const originalIndex = oldColumn.getPanelIndex(draggedPanel);

            // Replicamos a lógica de saída do onDrop para garantir que o layout seja atualizado
            draggedPanel.state.height = null;
            oldColumn.updatePanelsSizes();
            return;
        }

        // Se o placeholder está aqui, continuamos com o cálculo e a movimentação

        // FIX CRÍTICO 1: Calcula o índice lógico do painel (ignorando resize-bar).
        const allChildren = Array.from(this.element.children);
        let panelIndex = 0;
        for (const child of allChildren) {
            if (child === placeholder) {
                break; // Paramos de contar painéis ao encontrar o placeholder
            }
            if (child.classList.contains('panel')) {
                panelIndex++; // Contamos apenas os painéis
            }
        }

        // RECUPERAÇÃO DO ÍNDICE ORIGINAL:
        const originalIndex = oldColumn.getPanelIndex(draggedPanel);

        placeholder.remove();

        // FIX CRÍTICO 2: Prevenir movimentos redundantes/indesejados dentro da mesma coluna.
        if (
            oldColumn === this &&
            (panelIndex === originalIndex || panelIndex === originalIndex + 1)
        ) {
            // Drop no local original: cancela o movimento.
            draggedPanel.state.height = null;
            oldColumn.updatePanelsSizes();
            return;
        }

        // Se o painel for movido:

        // FIX DE MOVIMENTAÇÃO: Ao mover, sempre resetamos a altura.
        draggedPanel.state.height = null;

        // Remove da coluna antiga (emite 'column:empty' se ficar vazia)
        oldColumn.removePanel(draggedPanel, true);

        // Passa o índice lógico calculado
        this.addPanel(draggedPanel, panelIndex);
    }

    /**
     * Adiciona múltiplos painéis à coluna de uma só vez, tipicamente usado na restauração de estado.
     * Posterga a chamada de updatePanelsSizes para o final, para evitar resets de altura.
     * @param {Array<Panel>} panels - Lista de instâncias de Panel já inicializadas.
     */
    addPanelsBulk(panels) {
        panels.forEach(panel => {
            this.state.panels.push(panel);
            this.element.appendChild(panel.element);
            panel.setParentColumn(this);
        });

        // 1. Verifica o estado de colapso da coluna (para garantir que um painel esteja aberto).
        this.checkPanelsCollapsed();

        // 2. Garante que o layout seja refeito, UMA VEZ, após todos serem adicionados.
        // O updatePanelsSizes irá garantir que o último painel uncollapsed fique com height: null.
        this.updatePanelsSizes();
    }

    /**
     * Adiciona um painel à coluna.
     */
    addPanel(panel, index = null) {
        if (index === null) {
            this.state.panels.push(panel);
            this.element.appendChild(panel.element);
        } else {
            this.state.panels.splice(index, 0, panel);

            // FIX CRÍTICO: Usa a lista de painéis (a fonte de verdade) para determinar o próximo irmão.
            const nextSiblingPanel = this.state.panels[index + 1];
            const nextSiblingElement = nextSiblingPanel ? nextSiblingPanel.element : null;

            // Insere o painel antes do próximo painel encontrado (ou no final se for null).
            this.element.insertBefore(panel.element, nextSiblingElement);
        }
        panel.setParentColumn(this);

        // REMOVIDO: LÓGICA INCORRETA DE RESET DE ALTURA PARA O PRIMEIRO PAINEL
        // Esta lógica é AGORA tratada corretamente em updatePanelsSizes, onde deve estar.
        // if (this.getTotalPanels() === 1) {
        //     panel.state.height = null;
        // }

        // 1. Verifica o estado de colapso da coluna.
        this.checkPanelsCollapsed();

        // 2. Garante que o layout seja refeito, UMA VEZ.
        this.updatePanelsSizes();
    }

    /**
     * Gerencia a lógica de preenchimento de espaço (flex: 1).
     * Garante que o último painel visível sempre preencha o espaço (height=null).
     */
    updatePanelsSizes() {
        const uncollapsedPanels = this.getPanelsUncollapsed();
        const lastUncollapsedPanel = uncollapsedPanels[uncollapsedPanels.length - 1];

        // 1. PREPARAÇÃO: Limpa a classe de todos
        this.state.panels.forEach(panel => {
            panel.element.classList.remove('panel--fills-space');
        });

        // 2. Ação Crítica: Se houver um último painel visível, force seu estado de altura para NULO.
        if (lastUncollapsedPanel) {
            lastUncollapsedPanel.state.height = null;
        }

        // 3. APLICAR ALTURAS NO DOM: Itera e aplica a altura do estado para todos.
        this.state.panels.forEach(panel => {
            // Isto respeita a altura fixa dos demais e aplica 'auto' (null) ao último.
            panel.updateHeight();
        });

        // 4. APLICAÇÃO FINAL: Adicionar a classe de preenchimento
        if (lastUncollapsedPanel && lastUncollapsedPanel.state.height === null) {
            lastUncollapsedPanel.element.classList.add('panel--fills-space');
        }
    }

    getPanelsCollapsed() {
        return this.state.panels.filter(p => p.state.collapsed);
    }

    getPanelsUncollapsed() {
        return this.state.panels.filter(p => !p.state.collapsed);
    }

    /**
     * Garante que a coluna nunca esteja totalmente colapsada.
     */
    checkPanelsCollapsed() {
        const uncollapsed = this.getPanelsUncollapsed().length;
        const total = this.getTotalPanels();

        if (uncollapsed === 0 && total > 0) {
            // Se todos estiverem colapsados, força o último a descolapsar
            this.state.panels[total - 1].unCollapse();
        }
    }

    removePanel(panel, emitEmpty = true) {
        const index = this.getPanelIndex(panel);
        if (index === -1) return;

        this.state.panels.splice(index, 1);
        panel.setParentColumn(null);

        if (this.element.contains(panel.element)) {
            this.element.removeChild(panel.element);
        }

        // 1. Verifica se a coluna está totalmente colapsada e força um painel a abrir
        this.checkPanelsCollapsed();

        // 2. Atualiza o layout
        this.updatePanelsSizes();

        // 3. Emite o evento de remoção de coluna se estiver vazia
        if (emitEmpty && this.getTotalPanels() === 0) {
            appBus.emit('column:empty', this);
        }
    }

    getPanelIndex(panel) {
        return this.state.panels.findIndex(p => p === panel);
    }

    getTotalPanels() {
        return this.state.panels.length;
    }
}
