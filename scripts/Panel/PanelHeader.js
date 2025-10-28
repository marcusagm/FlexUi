import Panel from './Panel.js';

/**
 * Class representing the header of a panel, including title and control buttons.
 * @class
 * @property {Panel} panel - The panel instance this header belongs to.
 * @property {Object} state - The state object holding the title.
 * @property {HTMLElement} element - The DOM element representing the panel header.
 * @property {HTMLElement} moveHandle - The draggable handle for moving the panel.
 * @property {HTMLElement} titleEl - The DOM element displaying the panel title.
 * @property {HTMLElement} collapseBtn - The button to collapse/expand the panel.
 * @property {HTMLElement} closeBtn - The button to close the panel.
 * @static {Panel} dragged - Static reference to the currently dragged panel.
 * @static {HTMLElement} placeholder - Static reference to the placeholder element during drag-and-drop.
 * @method constructor Initializes the panel header with title and sets up event listeners.
 * @method build Constructs the DOM structure of the panel header.
 * @method onDragStart Handles the drag start event for moving the panel.
 * @method onDragEnd Handles the drag end event, finalizing the panel move.
 */
class PanelHeader {
    /**
     * @type {Panel}
     */
    panel = null;

    /**
     * @type {HTMLElement}
     */
    element = null;

    /**
     * @type {HTMLElement}
     */
    moveHandle = null;

    /**
     * @type {HTMLElement}
     */
    titleEl = null;

    /**
     * @type {HTMLElement}
     */
    collapseBtn = null;

    /**
     * @type {HTMLElement}
     */
    closeBtn = null;

    /**
     *
     */
    state = {
        title: null
    };

    constructor(panel, title) {
        this.panel = panel;
        this.state.title = title;
        this.element = document.createElement('div');
        this.element.classList.add('panel-header');
        this.build();
    }

    build() {
        this.moveHandle = document.createElement('div');
        this.moveHandle.classList.add('move-handle');
        this.moveHandle.draggable = true;
        this.moveHandle.addEventListener('dragstart', this.onDragStart.bind(this));
        this.moveHandle.addEventListener('dragend', this.onDragEnd.bind(this));

        this.titleEl = document.createElement('div');
        this.titleEl.classList.add('panel-title');
        this.titleEl.textContent = this.state.title;

        this.collapseBtn = document.createElement('div');
        this.collapseBtn.classList.add('collapse-btn');
        this.collapseBtn.addEventListener('click', () => this.panel.toggleCollapse());

        this.closeBtn = document.createElement('div');
        this.closeBtn.classList.add('close-btn');
        this.closeBtn.addEventListener('click', () => this.panel.close());

        this.element.append(this.moveHandle, this.titleEl, this.collapseBtn, this.closeBtn);
    }

    onDragStart(e) {
        Panel.dragged = this.panel;
        e.dataTransfer.setData('text/plain', '');
        e.dataTransfer.dropEffect = 'move';
        this.panel.element.classList.add('dragging');

        const ph = document.createElement('div');
        ph.classList.add('panel-placeholder');
        ph.style.height = `${this.panel.element.offsetHeight}px`;
        Panel.placeholder = ph;

        e.dataTransfer.setDragImage(this.panel.element, 20, 20);
        this.moveHandle.style.cursor = 'grabbing';
    }

    onDragEnd(e) {
        this.moveHandle.style.cursor = 'grab';
        if (Panel.placeholder && Panel.dragged) {
            Panel.placeholder.replaceWith(Panel.dragged.element);
        }
        this.panel.element.classList.remove('dragging');
        Panel.placeholder = null;
        Panel.dragged = null;
    }
}

export default PanelHeader;
