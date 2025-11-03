import { Panel } from './Panel.js';
import { appNotifications } from '../Services/Notification.js';

export class ToolbarPanel extends Panel {
    constructor(title, height = null, collapsed = false) {
        // PASSANDO A CONFIGURAÇÃO PARA O CONSTRUTOR BASE (FIX CRÍTICO)
        super(title, height, collapsed, {
            closable: false,
            collapsible: false,
            movable: false,
            minHeight: 50
        });
    }

    /**
     * Sobrescreve o método base para preencher com botões.
     */
    populateContent() {
        const contentEl = this.getContentElement();
        contentEl.classList.add('toolbar'); // Adiciona classe para estilização

        const btn1 = document.createElement('button');
        btn1.textContent = 'Ferramenta 1';
        btn1.onclick = () => appNotifications.info('Clicou na Ferramenta 1');

        const btn2 = document.createElement('button');
        btn2.textContent = 'Editar';
        btn2.onclick = () => appNotifications.success('Clicou em Editar');

        const btn3 = document.createElement('button');
        btn3.textContent = 'Salvar';
        btn3.onclick = () => appNotifications.warning('Clicou em Salvar');

        contentEl.append(btn1, btn2, btn3);
    }

    getPanelType() {
        return 'ToolbarPanel';
    }

    setContent(htmlString) {
        // Não faz nada. O painel se recria sozinho.
    }
}
