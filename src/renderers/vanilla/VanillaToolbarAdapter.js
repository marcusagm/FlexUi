import { VanillaRenderer } from './VanillaRenderer.js';

/**
 * Description:
 * A specialized adapter for rendering ToolbarGroup components in a Vanilla JS environment.
 * It extends the generic VanillaRenderer to encapsulate the creation and manipulation
 * of the toolbar group DOM structure, including handles, titles, and content containers.
 *
 * Properties summary:
 * - None
 *
 * Typical usage:
 * const adapter = new VanillaToolbarAdapter();
 * const groupElement = adapter.createGroupElement('group-1');
 * adapter.updateTitle(groupElement, 'My Tools');
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Enforces BEM structure for toolbar groups (.toolbar-group, .toolbar-group__handle, etc.).
 * - Manages ARIA attributes for accessibility.
 * - Handles visibility states for drag handles.
 *
 * Dependencies:
 * - {import('./VanillaRenderer.js').VanillaRenderer}
 */
export class VanillaToolbarAdapter extends VanillaRenderer {
    /**
     * Creates an instance of VanillaToolbarAdapter.
     */
    constructor() {
        super();
    }

    /**
     * Creates the main DOM structure for a ToolbarGroup.
     * Structure:
     * <div class="toolbar-group">
     * <div class="toolbar-group__handle">...</div>
     * <span class="toolbar-group__title"></span>
     * <div class="toolbar-group__content"></div>
     * </div>
     *
     * @param {string} id - The unique ID of the group.
     * @returns {HTMLElement} The root group element.
     * @throws {Error} If the ID is invalid.
     */
    createGroupElement(id) {
        const me = this;
        if (typeof id !== 'string' || id.trim() === '') {
            throw new Error(
                `[VanillaToolbarAdapter] Invalid id: "${id}". Must be a non-empty string.`
            );
        }

        // Root Container
        const groupElement = me.createElement('div', {
            className: 'toolbar-group',
            id: `toolbar-group-${id}`
        });

        // 1. Drag Handle
        const dragHandle = me.createElement('div', {
            className: 'toolbar-group__handle',
            style: { touchAction: 'none' }
        });
        dragHandle.setAttribute('role', 'button');
        dragHandle.setAttribute('tabindex', '0');
        dragHandle.setAttribute('aria-roledescription', 'draggable item');

        const handleIcon = me.createElement('span', {
            className: 'icon icon-handle'
        });
        handleIcon.setAttribute('aria-hidden', 'true');

        me.mount(dragHandle, handleIcon);
        me.mount(groupElement, dragHandle);

        // 2. Title
        const titleElement = me.createElement('span', {
            className: 'toolbar-group__title'
        });
        me.mount(groupElement, titleElement);

        // 3. Content Container
        const contentElement = me.createElement('div', {
            className: 'toolbar-group__content'
        });
        me.mount(groupElement, contentElement);

        return groupElement;
    }

    /**
     * Updates the title text and the drag handle's ARIA label.
     *
     * @param {HTMLElement} element - The root group element.
     * @param {string} title - The title text.
     * @returns {void}
     */
    updateTitle(element, title) {
        const me = this;
        if (!element) return;

        const titleElement = element.querySelector('.toolbar-group__title');
        const dragHandle = me.getDragHandle(element);
        const safeTitle = title || '';

        if (titleElement) {
            titleElement.textContent = safeTitle;
        }

        if (dragHandle) {
            dragHandle.setAttribute('aria-label', `Move ${safeTitle || 'Group'}`);
        }
    }

    /**
     * Toggles the visibility of the drag handle.
     *
     * @param {HTMLElement} element - The root group element.
     * @param {boolean} isMovable - Whether the group is movable.
     * @returns {void}
     */
    setMovable(element, isMovable) {
        const me = this;
        const dragHandle = me.getDragHandle(element);
        if (!dragHandle) return;

        const displayValue = isMovable ? '' : 'none';
        me.updateStyles(dragHandle, { display: displayValue });
    }

    /**
     * Retrieves the content container element.
     *
     * @param {HTMLElement} element - The root group element.
     * @returns {HTMLElement|null} The content container.
     */
    getContentElement(element) {
        if (!element) return null;
        return element.querySelector('.toolbar-group__content');
    }

    /**
     * Retrieves the drag handle element.
     *
     * @param {HTMLElement} element - The root group element.
     * @returns {HTMLElement|null} The drag handle.
     */
    getDragHandle(element) {
        if (!element) return null;
        return element.querySelector('.toolbar-group__handle');
    }
}
