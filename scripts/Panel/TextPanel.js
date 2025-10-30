import Panel from './Panel.js';

export default class TextPanel extends Panel {
    constructor(title, initialText, height = null, collapsed = false) {
        super(title, height, collapsed);
        // O construtor base chama this.populateContent(),
        // mas podemos adicionar lógica extra aqui ou
        // simplesmente definir o conteúdo inicial.
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
