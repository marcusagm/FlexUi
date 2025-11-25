import { VanillaRenderer } from './VanillaRenderer.js';

/**
 * Description:
 * A specialized adapter for rendering PanelGroupHeader components in a Vanilla JS environment.
 * It extends the generic VanillaRenderer to encapsulate the creation and manipulation
 * of the panel group header structure, including move handles, tab slots, and control buttons.
 *
 * Properties summary:
 * - None
 *
 * Typical usage:
 * const adapter = new VanillaPanelGroupHeaderAdapter();
 * const headerElement = adapter.createHeaderElement('group-1');
 * const tabSlot = adapter.getTabContainerSlot(headerElement);
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Enforces BEM structure for panel group headers.
 * - Provides a dedicated slot for injecting the TabStrip component.
 * - Manages visual states for collapse buttons and ARIA labels.
 *
 * Dependencies:
 * - {import('./VanillaRenderer.js').VanillaRenderer}
 */
export class VanillaPanelGroupHeaderAdapter extends VanillaRenderer {
    /**
     * Creates an instance of VanillaPanelGroupHeaderAdapter.
     */
    constructor() {
        super();
    }

    /**
     * Creates the main DOM structure for a Panel Group Header.
     * Structure:
     * <div class="panel-group__header">
     * <div class="panel-group__move-handle">...</div>
     * <div class="panel-group__tab-container-slot"></div> * <button class="panel-group__collapse-btn">...</button>
     * <button class="panel-group__close-btn">...</button>
     * </div>
     *
     * @param {string} id - The unique ID of the panel group.
     * @returns {HTMLElement} The root header element.
     * @throws {Error} If the ID is invalid.
     */
    createHeaderElement(id) {
        const me = this;
        if (typeof id !== 'string' || id.trim() === '') {
            throw new Error(
                `[VanillaPanelGroupHeaderAdapter] Invalid id: "${id}". Must be a non-empty string.`
            );
        }

        const headerElement = me.createElement('div', {
            className: 'panel-group__header',
            id: `panel-group-header-${id}`
        });

        // 1. Move Handle
        const moveHandle = me.createElement('div', {
            className: 'panel-group__move-handle panel__move-handle',
            style: { touchAction: 'none' }
        });
        moveHandle.setAttribute('role', 'button');
        moveHandle.setAttribute('tabindex', '0');

        const handleIcon = me.createElement('span', {
            className: 'icon icon-handle'
        });
        handleIcon.setAttribute('aria-hidden', 'true');

        me.mount(moveHandle, handleIcon);
        me.mount(headerElement, moveHandle);

        // 2. Tab Container Slot (Where TabStrip will be mounted)
        const tabSlot = me.createElement('div', {
            className: 'panel-group__tab-container-slot'
        });

        // Styles to ensure it fills the space between handle and buttons
        me.updateStyles(tabSlot, {
            flexGrow: '1',
            overflow: 'hidden',
            display: 'flex',
            height: '100%'
        });

        me.mount(headerElement, tabSlot);

        // 3. Collapse Button
        const collapseButton = me.createElement('button', {
            className: 'panel-group__collapse-btn panel__collapse-btn',
            type: 'button'
        });
        me.mount(headerElement, collapseButton);

        // 4. Close Button
        const closeButton = me.createElement('button', {
            className: 'panel-group__close-btn panel__close-btn',
            type: 'button'
        });
        me.mount(headerElement, closeButton);

        return headerElement;
    }

    /**
     * Retrieves the element where the TabStrip should be mounted.
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @returns {HTMLElement|null} The tab container slot.
     */
    getTabContainerSlot(headerElement) {
        if (!headerElement) return null;
        return headerElement.querySelector('.panel-group__tab-container-slot');
    }

    /**
     * Retrieves the move handle element.
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @returns {HTMLElement|null} The move handle element.
     */
    getMoveHandle(headerElement) {
        if (!headerElement) return null;
        return headerElement.querySelector('.panel-group__move-handle');
    }

    /**
     * Retrieves the collapse button element.
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @returns {HTMLElement|null} The collapse button element.
     */
    getCollapseButton(headerElement) {
        if (!headerElement) return null;
        return headerElement.querySelector('.panel-group__collapse-btn');
    }

    /**
     * Retrieves the close button element.
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @returns {HTMLElement|null} The close button element.
     */
    getCloseButton(headerElement) {
        if (!headerElement) return null;
        return headerElement.querySelector('.panel-group__close-btn');
    }

    /**
     * Updates ARIA labels for the controls based on the current group title.
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @param {string} title - The title of the active panel/group.
     * @returns {void}
     */
    updateAriaLabels(headerElement, title) {
        const me = this;
        if (!headerElement) return;

        const safeTitle = title || 'Group';

        const moveHandle = me.getMoveHandle(headerElement);
        const collapseBtn = me.getCollapseButton(headerElement);
        const closeBtn = me.getCloseButton(headerElement);

        if (moveHandle) {
            moveHandle.setAttribute('aria-label', `Move group ${safeTitle}`);
        }
        if (collapseBtn) {
            collapseBtn.setAttribute('aria-label', `Collapse group ${safeTitle}`);
        }
        if (closeBtn) {
            closeBtn.setAttribute('aria-label', `Close group ${safeTitle}`);
        }
    }

    /**
     * Updates the visual state of the collapse button (collapsed/expanded style).
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @param {boolean} isCollapsed - Whether the group is collapsed.
     * @returns {void}
     */
    setCollapsedState(headerElement, isCollapsed) {
        const me = this;
        if (!headerElement) return;

        const btn = me.getCollapseButton(headerElement);
        if (btn) {
            const collapsedClass = 'panel-group__collapse-btn--collapsed';
            if (isCollapsed) {
                btn.classList.add(collapsedClass);
            } else {
                btn.classList.remove(collapsedClass);
            }
        }
    }

    /**
     * Sets the disabled state of the collapse button.
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @param {boolean} isDisabled - Whether the button is disabled.
     * @returns {void}
     */
    setCollapseButtonDisabled(headerElement, isDisabled) {
        const me = this;
        if (!headerElement) return;

        const btn = me.getCollapseButton(headerElement);
        if (btn) {
            btn.disabled = !!isDisabled;
        }
    }

    /**
     * Sets the visibility of the close button.
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @param {boolean} visible - Whether the button should be visible.
     * @returns {void}
     */
    setCloseButtonVisibility(headerElement, visible) {
        const me = this;
        const btn = me.getCloseButton(headerElement);
        if (btn) {
            me.updateStyles(btn, { display: visible ? '' : 'none' });
        }
    }

    /**
     * Sets the visibility of the move handle.
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @param {boolean} visible - Whether the handle should be visible.
     * @returns {void}
     */
    setMoveHandleVisibility(headerElement, visible) {
        const me = this;
        const handle = me.getMoveHandle(headerElement);
        if (handle) {
            me.updateStyles(handle, { display: visible ? '' : 'none' });
        }
    }
}
