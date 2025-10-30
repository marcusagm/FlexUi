export default class PanelContent {
    constructor(content = null) {
        this.element = document.createElement('div');
        this.element.classList.add('panel-content');
        if (content) {
            this.element.innerHTML = content;
        }
    }
}
