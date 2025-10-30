import { MenuItem } from './MenuItem.js';

export class Submenu {
    /**
     * @param {Array<Object>} childrenData - Um array de objetos de dados de menu para os filhos.
     * @param {number} parentLevel - O nível de aninhamento do item pai.
     */
    constructor(childrenData, parentLevel) {
        this.element = document.createElement('ul');
        this.element.classList.add('submenu-container');

        // Passa o nível do pai para garantir que os filhos sejam construídos corretamente
        this.build(childrenData, parentLevel);
    }

    build(childrenData, parentLevel) {
        // O nível dos filhos é o nível do pai + 1
        const childLevel = parentLevel + 1;

        childrenData.forEach(itemData => {
            // A recursão ocorre aqui, passando o nível atualizado (childLevel)
            const subItem = new MenuItem(itemData, childLevel);
            this.element.appendChild(subItem.element);
        });
    }
}
