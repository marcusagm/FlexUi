/* === ARQUIVO: PanelFactory.js === */
import { Panel } from './Panel.js';
import { TextPanel } from './TextPanel.js';
import { ToolbarPanel } from './ToolbarPanel.js';
import { PanelGroup } from './PanelGroup.js';

/**
 * Cria uma instância de PAINEL (filho) baseada no tipo.
 */
function createPanel(panelData) {
    const { type, title, height, config } = panelData;

    let panel;
    switch (type) {
        case 'TextPanel':
            panel = new TextPanel(title, '', height, config);
            break;
        case 'ToolbarPanel':
            panel = new ToolbarPanel(title, height, config);
            break;
        default:
            panel = new Panel(title, height, config);
            break;
    }

    // Restaura propriedades salvas
    panel.id = panelData.id || panel.id;
    panel.setContent(panelData.content);
    panel.state.height = panelData.height;

    return panel;
}

/**
 * Cria uma instância de PANELGROUP a partir do estado salvo.
 */
export function createPanelGroupFromState(groupData) {
    let firstPanel = null;
    const panelsToRestore = [];

    groupData.panels.forEach(panelData => {
        const panel = createPanel(panelData);
        panelsToRestore.push(panel);
    });

    if (panelsToRestore.length > 0) {
        firstPanel = panelsToRestore[0];
    }

    if (firstPanel) {
        const group = new PanelGroup(firstPanel, groupData.height, groupData.collapsed);

        panelsToRestore.forEach(panel => {
            group.addPanel(panel, panel.id === groupData.activePanelId);
        });
        return group;
    }
    return null; // Retorna nulo se o grupo estava vazio
}
