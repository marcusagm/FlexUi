export class PanelContent {
    constructor(content = null) {
        this.element = document.createElement('div');
        this.element.classList.add('panel__content');
        if (content) {
            this.element.innerHTML = content;
        }
    }
}
