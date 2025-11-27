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
 * adapter.setSimpleMode(headerElement, true);
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Enforces BEM structure for panel group headers.
 * - Provides a dedicated slot for injecting the TabStrip component.
 * - Manages visual states for collapse buttons and ARIA labels.
 * - Supports Popout/Dock button states.
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
     * <div class="panel-group__tab-container-slot"></div>
     * <div class="panel-group__controls">
     * <button class="panel-group__popout-btn">...</button>
     * <button class="panel-group__collapse-btn">...</button>
     * <button class="panel-group__close-btn">...</button>
     * </div>
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

        const tabSlot = me.createElement('div', {
            className: 'panel-group__tab-container-slot'
        });
        me.updateStyles(tabSlot, {
            flexGrow: '1',
            overflow: 'hidden',
            display: 'flex',
            height: '100%'
        });
        me.mount(headerElement, tabSlot);

        const controlsContainer = me.createElement('div', {
            className: 'panel-group__controls',
            style: { display: 'flex', alignItems: 'center' }
        });

        const popoutButton = me.createElement('button', {
            className: 'panel-group__popout-btn panel__popout-btn',
            type: 'button',
            title: 'Popout'
        });
        popoutButton.innerHTML = '&#8599;';
        me.mount(controlsContainer, popoutButton);

        const collapseButton = me.createElement('button', {
            className: 'panel-group__collapse-btn panel__collapse-btn',
            type: 'button'
        });
        me.mount(controlsContainer, collapseButton);

        const closeButton = me.createElement('button', {
            className: 'panel-group__close-btn panel__close-btn',
            type: 'button'
        });
        me.mount(controlsContainer, closeButton);

        me.mount(headerElement, controlsContainer);

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
     * Retrieves the popout button element.
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @returns {HTMLElement|null} The popout button element.
     */
    getPopoutButton(headerElement) {
        if (!headerElement) return null;
        return headerElement.querySelector('.panel-group__popout-btn');
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
     * Toggles between simple mode (single tab styled as title) and normal mode (tabs).
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @param {boolean} isSimple - True for simple mode, False for tab mode.
     * @returns {void}
     */
    setSimpleMode(headerElement, isSimple) {
        if (!headerElement) return;

        if (isSimple) {
            headerElement.classList.add('panel-group__header--simple');
        } else {
            headerElement.classList.remove('panel-group__header--simple');
        }
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
        const popoutButton = me.getPopoutButton(headerElement);
        const collapseButton = me.getCollapseButton(headerElement);
        const closeButton = me.getCloseButton(headerElement);

        if (moveHandle) {
            moveHandle.setAttribute('aria-label', `Move group ${safeTitle}`);
        }
        if (popoutButton) {
            popoutButton.setAttribute('aria-label', `Popout group ${safeTitle}`);
        }
        if (collapseButton) {
            collapseButton.setAttribute('aria-label', `Collapse group ${safeTitle}`);
        }
        if (closeButton) {
            closeButton.setAttribute('aria-label', `Close group ${safeTitle}`);
        }
    }

    /**
     * Updates the visual state of the popout button (Popout vs Dock).
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @param {boolean} isPopout - Whether the group is currently popped out.
     * @returns {void}
     */
    setPopoutState(headerElement, isPopout) {
        const me = this;
        if (!headerElement) return;

        const button = me.getPopoutButton(headerElement);
        if (button) {
            if (isPopout) {
                button.innerHTML = '&#8601;';
                button.title = 'Return to Workspace';
                button.classList.add('panel-group__popout-btn--active');
            } else {
                button.innerHTML = '&#8599;';
                button.title = 'Popout Window';
                button.classList.remove('panel-group__popout-btn--active');
            }
        }
    }

    /**
     * Updates the visual state of the collapse button.
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @param {boolean} isCollapsed - Whether the group is collapsed.
     * @returns {void}
     */
    setCollapsedState(headerElement, isCollapsed) {
        const me = this;
        if (!headerElement) return;

        const button = me.getCollapseButton(headerElement);
        if (button) {
            const collapsedClass = 'panel-group__collapse-btn--collapsed';
            if (isCollapsed) {
                button.classList.add(collapsedClass);
            } else {
                button.classList.remove(collapsedClass);
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

        const button = me.getCollapseButton(headerElement);
        if (button) {
            button.disabled = !!isDisabled;
        }
    }

    /**
     * Sets the visibility of the collapse button.
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @param {boolean} visible - Whether the button should be visible.
     * @returns {void}
     */
    setCollapseButtonVisibility(headerElement, visible) {
        const me = this;
        const button = me.getCollapseButton(headerElement);
        if (button) {
            me.updateStyles(button, { display: visible ? '' : 'none' });
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
        const button = me.getCloseButton(headerElement);
        if (button) {
            me.updateStyles(button, { display: visible ? '' : 'none' });
        }
    }

    /**
     * Sets the visibility of the popout button.
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @param {boolean} visible - Whether the button should be visible.
     * @returns {void}
     */
    setPopoutButtonVisibility(headerElement, visible) {
        const me = this;
        const button = me.getPopoutButton(headerElement);
        if (button) {
            me.updateStyles(button, { display: visible ? '' : 'none' });
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
