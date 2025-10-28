class PanelContent {
    constructor(content) {
        this.element = document.createElement('div');
        this.element.classList.add('panel-content');
        this.element.innerHTML = content;
    }
}

export default PanelContent;
