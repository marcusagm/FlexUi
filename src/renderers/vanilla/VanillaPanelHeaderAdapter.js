import { VanillaRenderer } from './VanillaRenderer.js';

/**
 * Description:
 * A specialized adapter for rendering PanelHeader (tab) components in a Vanilla JS environment.
 * It extends the generic VanillaRenderer to encapsulate the creation and state updates
 * of the tab UI, including title updates, close button visibility, and active states.
 *
 * Properties summary:
 * - None
 *
 * Typical usage:
 * const adapter = new VanillaPanelHeaderAdapter();
 * const tabElement = adapter.createTabElement('panel-1');
 * adapter.updateTitle(tabElement, 'My Panel');
 * adapter.updateActiveState(tabElement, true);
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Enforces BEM structure for tabs (.panel-group__tab).
 * - Manages 'simple mode' styling (single panel view vs tabbed view).
 * - Handles visual state attributes (draggable, display).
 *
 * Dependencies:
 * - {import('./VanillaRenderer.js').VanillaRenderer}
 */
export class VanillaPanelHeaderAdapter extends VanillaRenderer {
    /**
     * Creates an instance of VanillaPanelHeaderAdapter.
     */
    constructor() {
        super();
    }

    /**
     * Creates the main DOM structure for a Panel Tab.
     * Structure:
     * <div class="panel-group__tab" draggable="true">
     * <span class="panel__title"></span>
     * <button class="panel-group__tab-close">×</button>
     * </div>
     *
     * @param {string} id - The unique ID of the panel/tab.
     * @returns {HTMLElement} The root tab element.
     * @throws {Error} If the ID is invalid.
     */
    createTabElement(id) {
        const me = this;
        if (typeof id !== 'string' || id.trim() === '') {
            throw new Error(
                `[VanillaPanelHeaderAdapter] Invalid id: "${id}". Must be a non-empty string.`
            );
        }

        const tabElement = me.createElement('div', {
            className: 'panel-group__tab',
            id: `tab-${id}`,
            draggable: 'true'
        });

        // Important for DragTrigger to work correctly without scrolling interference
        me.updateStyles(tabElement, { touchAction: 'none' });

        const titleElement = me.createElement('span', {
            className: 'panel__title'
        });

        const closeButton = me.createElement('button', {
            className: 'panel-group__tab-close',
            type: 'button'
        });
        closeButton.textContent = '×';

        me.mount(tabElement, titleElement);
        me.mount(tabElement, closeButton);

        return tabElement;
    }

    /**
     * Updates the title text of the tab.
     *
     * @param {HTMLElement} element - The tab element.
     * @param {string} title - The title text.
     * @returns {void}
     */
    updateTitle(element, title) {
        if (!element) return;
        const titleElement = element.querySelector('.panel__title');
        if (titleElement) {
            titleElement.textContent = title || 'No title';
        }
    }

    /**
     * Updates the visibility of the close button.
     *
     * @param {HTMLElement} element - The tab element.
     * @param {boolean} visible - Whether the button should be visible.
     * @returns {void}
     */
    updateCloseButtonVisibility(element, visible) {
        const me = this;
        const button = me.getCloseButton(element);
        if (button) {
            me.updateStyles(button, { display: visible ? '' : 'none' });
        }
    }

    /**
     * Updates the active state visual class of the tab.
     *
     * @param {HTMLElement} element - The tab element.
     * @param {boolean} isActive - Whether the tab is active.
     * @returns {void}
     */
    updateActiveState(element, isActive) {
        if (!element) return;
        const activeClass = 'panel-group__tab--active';
        if (isActive) {
            element.classList.add(activeClass);
        } else {
            element.classList.remove(activeClass);
        }
    }

    /**
     * Updates visual classes/attributes for "Simple Mode" (single panel).
     * In simple mode, the tab styling is removed to look like a plain header.
     *
     * @param {HTMLElement} element - The tab element.
     * @param {boolean} isSimple - True for simple mode, False for tab mode.
     * @returns {void}
     */
    setSimpleMode(element, isSimple) {
        const me = this;
        if (!element) return;

        const tabClass = 'panel-group__tab';
        if (isSimple) {
            element.classList.remove(tabClass);
            // Disable dragging in simple mode (header typically handles drag if movable, but tab logic differs)
            element.setAttribute('draggable', 'false');
            me.updateStyles(element, { cursor: 'default' });

            // Usually close button is hidden in simple mode tabs (handled by group header)
            me.updateCloseButtonVisibility(element, false);
        } else {
            element.classList.add(tabClass);
            // Re-enable dragging for tabs (if movable, controller sets this, but default is true)
            element.setAttribute('draggable', 'true');
            me.updateStyles(element, { cursor: 'grab' });
        }
    }

    /**
     * Sets the draggable state and cursor style of the tab.
     *
     * @param {HTMLElement} element - The tab element.
     * @param {boolean} isDraggable - Whether the tab can be dragged.
     * @returns {void}
     */
    setDraggable(element, isDraggable) {
        const me = this;
        if (!element) return;

        if (isDraggable) {
            element.setAttribute('draggable', 'true');
            me.updateStyles(element, { cursor: 'grab' });
        } else {
            element.setAttribute('draggable', 'false');
            me.updateStyles(element, { cursor: 'default' });
        }
    }

    /**
     * Retrieves the close button element.
     *
     * @param {HTMLElement} element - The tab element.
     * @returns {HTMLElement|null} The button element.
     */
    getCloseButton(element) {
        if (!element) return null;
        return element.querySelector('.panel-group__tab-close');
    }
}
