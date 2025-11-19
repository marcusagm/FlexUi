/**
 * Configuração da estrutura do menu principal.
 *
 * Este arquivo exporta um array que define a estrutura do menu.
 * A classe 'Menu.js' irá carregar este módulo dinamicamente.
 *
 * Estrutura do Objeto:
 * - titleKey {string}: A chave de tradução (i18n) para o título.
 * - event {string} (Opcional): O evento a ser disparado no appBus quando clicado.
 * - children {Array} (Opcional): Um array de sub-itens com a mesma estrutura.
 */
export default [
    {
        titleKey: 'documents.menu',
        children: [
            {
                titleKey: 'documents.new',
                event: 'app:add-new-window'
            }
        ]
    },
    {
        titleKey: 'windows.menu',
        children: [
            {
                titleKey: 'windows.cascade',
                event: 'viewport:arrange-cascade'
            },
            {
                titleKey: 'windows.tile',
                event: 'viewport:arrange-tile'
            }
        ]
    },
    {
        titleKey: 'panels.menu',
        children: [
            {
                titleKey: 'panels.add',
                event: 'app:add-new-panel'
            }
        ]
    },
    {
        titleKey: 'workspace.menu',
        children: [
            {
                titleKey: 'workspace.save',
                event: 'app:save-state'
            },
            {
                titleKey: 'workspace.restore',
                event: 'app:restore-state'
            },
            {
                titleKey: 'workspace.reset',
                event: 'app:reset-state'
            }
        ]
    }
];
