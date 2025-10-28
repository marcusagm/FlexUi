import MenuItem from './MenuItem.js';

class Menu {
    constructor(app) {
        this.app = app;
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
                        fn: () => this.app.addNewPanel()
                    }
                ]
            },
            {
                title: 'Container',
                actions: [
                    {
                        title: 'Salvar estado atual',
                        fn: () => this.app.saveState()
                    },
                    {
                        title: 'Restaurar estado',
                        fn: () => this.app.restoreState()
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

export default Menu;
