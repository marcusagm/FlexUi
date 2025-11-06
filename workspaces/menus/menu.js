/**
 * Configuração da estrutura do menu principal.
 *
 * Este arquivo exporta um array que define a estrutura do menu.
 * A classe 'Menu.js' irá carregar este módulo dinamicamente.
 *
 * Estrutura do Objeto:
 * - titleKey {string}: A chave de tradução (i18n) para o título (Ex: "panels.menu").
 * - event {string} (Opcional): O evento a ser disparado no appBus quando clicado.
 * - callback {function} (Opcional): Uma função a ser executada diretamente (preferir 'event' se possível).
 * - children {Array} (Opcional): Um array de sub-itens com a mesma estrutura.
 */
export default [
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
            // Exemplo de como 'callback' (solicitado por você) seria usado:
            // {
            //     titleKey: 'actions.complex', // Chave de tradução fictícia
            //     callback: () => {
            //         console.log('Uma ação complexa foi executada!');
            //         // import { appBus } from '../scripts/EventBus.js';
            //         // appBus.emit('evento:complexo');
            //     }
            // }
        ]
    }
];
