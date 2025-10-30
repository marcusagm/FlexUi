import { MenuItem } from './MenuItem.js';
import { appBus } from '../EventBus.js'; // NOVO

export class Menu {
    // MODIFICADO: Não precisa mais do 'app'
    constructor() {
        this.element = document.createElement('div');
        this.element.classList.add('menu');
        this.build();
    }

    build() {
        const items = [
            {
                title: 'Paineis',
                actions: [
                    {
                        title: 'Adicionar novo painel',
                        // MODIFICADO: Emite um evento
                        fn: () => appBus.emit('app:add-new-panel')
                    }
                ]
            },
            {
                title: 'Container',
                actions: [
                    {
                        title: 'Salvar estado atual',
                        // MODIFICADO: Emite um evento
                        fn: () => appBus.emit('app:save-state')
                    },
                    {
                        title: 'Restaurar estado',
                        // MODIFICADO: Emite um evento
                        fn: () => appBus.emit('app:restore-state')
                    }
                ]
            }
        ];
        items.forEach(it => {
            const mi = new MenuItem(it.title);
            it.actions.forEach(act => mi.addSubmenu(act.title, act.fn));
            this.element.appendChild(mi.element);
        });
    }
}
