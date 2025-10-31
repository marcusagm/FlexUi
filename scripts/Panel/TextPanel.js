import { Panel } from './Panel.js';

export class TextPanel extends Panel {
    constructor(title, initialText, height = null, collapsed = false) {
        // Passa a configuração vazia {} como 4º argumento (FIX CRÍTICO)
        super(title, height, collapsed, {});

        this.getContentElement().textContent = initialText;
    }

    // Opcional: sobrescrever populateContent se a lógica for complexa
    // populateContent() {
    //     this.getContentElement().textContent = 'Texto padrão do TextPanel';
    // }

    getPanelType() {
        return 'TextPanel';
    }
}
