import Panel from './Panel.js';
import TextPanel from './TextPanel.js';
import ToolbarPanel from './ToolbarPanel.js';

/**
 * Cria uma instância de Painel baseada nos dados salvos.
 * @param {object} panelData - O objeto de estado salvo para o painel.
 * @returns {Panel} Uma instância da subclasse de Painel correta.
 */
export default function createPanel(panelData) {
    const { type, title, height, collapsed } = panelData;

    switch (type) {
        case 'TextPanel':
            // O conteúdo será definido por setContent() no PanelContainer
            return new TextPanel(title, '', height, collapsed);

        case 'ToolbarPanel':
            // O conteúdo é recriado pela classe, setContent() não é necessário
            // mas o faremos mesmo assim para consistência.
            return new ToolbarPanel(title, height, collapsed);

        case 'Panel':
        default:
            // Painel base genérico
            return new Panel(title, height, collapsed);
    }
}
