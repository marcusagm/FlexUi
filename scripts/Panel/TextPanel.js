import { Panel } from './Panel.js';

export class TextPanel extends Panel {
    constructor(title, initialText, height = null, collapsed = false) {
        // Passa a configuração vazia {} como 4º argumento (FIX CRÍTICO)
        super(title, height, collapsed, {});

        this.getContentElement().textContent = initialText;
    }

    /**
     * (NOVO) Retorna o identificador de tipo estático para o PanelFactory.
     * @returns {string}
     */
    static get panelType() {
        return 'TextPanel';
    }

    // Opcional: sobrescrever populateContent se a lógica for complexa
    // populateContent() {
    //     this.getContentElement().textContent = 'Texto padrão do TextPanel';
    // }

    getPanelType() {
        return 'TextPanel';
    }

    toJSON() {
        const panelData = super.toJSON();
        const newData = {
            ...panelData,
            content: this.getContentElement().textContent
        };
        return newData;
    }

    fromJSON(data) {
        this.getContentElement().textContent = data.content;
        super.fromJSON(data);
    }
}
