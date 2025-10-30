import Panel from './Panel.js';

export default class ToolbarPanel extends Panel {
    constructor(title, height = null, collapsed = false) {
        // super() chama this.populateContent() automaticamente
        super(title, height, collapsed);
    }

    /**
     * Sobrescreve o método base para preencher com botões.
     */
    populateContent() {
        const contentEl = this.getContentElement();
        contentEl.classList.add('toolbar'); // Adiciona classe para estilização

        const btn1 = document.createElement('button');
        btn1.textContent = 'Ferramenta 1';
        btn1.onclick = () => alert('Clicou na Ferramenta 1');

        const btn2 = document.createElement('button');
        btn2.textContent = 'Editar';
        btn2.onclick = () => alert('Clicou em Editar');

        const btn3 = document.createElement('button');
        btn3.textContent = 'Salvar';
        btn3.onclick = () => alert('Clicou em Salvar');

        contentEl.append(btn1, btn2, btn3);
    }

    getPanelType() {
        return 'ToolbarPanel';
    }

    /**
     * Ao restaurar o estado, o setContent() do painel base
     * irá sobrescrever o conteúdo.
     * Para painéis como este, que se autoconstroem,
     * podemos sobrescrever setContent() para não fazer nada.
     */
    setContent(htmlString) {
        // Não faz nada. O painel se recria sozinho.
        // Se quiséssemos salvar o *estado* dos botões,
        // o `getState` e `restoreState` seriam mais complexos.
        // Para este exemplo, apenas recriamos o padrão.
    }
}
