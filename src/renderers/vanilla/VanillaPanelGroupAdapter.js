import { VanillaRenderer } from './VanillaRenderer.js';

/**
 * Description:
 * A specialized adapter for rendering PanelGroup components in a Vanilla JS environment.
 * It extends the generic VanillaRenderer to encapsulate the creation and manipulation
 * of the panel group structure, including content containers and layout states
 * (floating, collapsed, geometry, fill-space).
 *
 * Properties summary:
 * - None
 *
 * Typical usage:
 * const adapter = new VanillaPanelGroupAdapter();
 * const groupElement = adapter.createGroupElement('group-1');
 * adapter.setFloatingMode(groupElement, true);
 * adapter.setFillSpace(groupElement, true);
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Enforces BEM structure for panel groups (.panel-group, .panel-group__content).
 * - Manages visual transitions between floating and docked states.
 * - Handles collapse state visuals (hiding content, adjusting height).
 * - Manages 'fills-space' class for flex layout logic.
 *
 * Dependencies:
 * - {import('./VanillaRenderer.js').VanillaRenderer}
 */
export class VanillaPanelGroupAdapter extends VanillaRenderer {
    /**
     * Creates an instance of VanillaPanelGroupAdapter.
     */
    constructor() {
        super();
    }

    /**
     * Creates the main DOM structure for a Panel Group.
     * Structure:
     * <div class="panel-group panel">
     * <div class="panel-group__content"></div>
     * </div>
     *
     * @param {string} id - The unique ID of the panel group.
     * @returns {HTMLElement} The root group element.
     * @throws {Error} If the ID is invalid.
     */
    createGroupElement(id) {
        const me = this;
        if (typeof id !== 'string' || id.trim() === '') {
            throw new Error(
                `[VanillaPanelGroupAdapter] Invalid id: "${id}". Must be a non-empty string.`
            );
        }

        const groupElement = me.createElement('div', {
            className: 'panel-group panel',
            id: `panel-group-${id}`
        });

        const contentContainer = me.createElement('div', {
            className: 'panel-group__content'
        });

        me.mount(groupElement, contentContainer);

        return groupElement;
    }

    /**
     * Retrieves the content container element where panels are mounted.
     *
     * @param {HTMLElement} groupElement - The root group element.
     * @returns {HTMLElement|null} The content container.
     */
    getContentContainer(groupElement) {
        if (!groupElement) return null;
        return groupElement.querySelector('.panel-group__content');
    }

    /**
     * Updates the geometry (position and size) of the panel group.
     * Useful primarily for floating panels.
     *
     * @param {HTMLElement} element - The group element.
     * @param {number|null} x - The X coordinate.
     * @param {number|null} y - The Y coordinate.
     * @param {number|null} width - The width in pixels.
     * @param {number|null} height - The height in pixels.
     * @returns {void}
     */
    updateGeometry(element, x, y, width, height) {
        const me = this;
        if (!element) return;

        const styles = {};

        if (x !== null && x !== undefined) {
            const xNum = Number(x);
            if (!Number.isNaN(xNum)) styles.left = `${xNum}px`;
        }

        if (y !== null && y !== undefined) {
            const yNum = Number(y);
            if (!Number.isNaN(yNum)) styles.top = `${yNum}px`;
        }

        if (width !== null && width !== undefined) {
            const wNum = Number(width);
            if (!Number.isNaN(wNum)) styles.width = `${wNum}px`;
        }

        if (height !== null && height !== undefined) {
            const hNum = Number(height);
            if (!Number.isNaN(hNum)) styles.height = `${hNum}px`;
        }

        me.updateStyles(element, styles);
    }

    /**
     * Sets the visual mode of the panel group (Floating vs Docked).
     *
     * @param {HTMLElement} element - The group element.
     * @param {boolean} isFloating - True for floating, false for docked.
     * @returns {void}
     */
    setFloatingMode(element, isFloating) {
        const me = this;
        if (!element) return;

        if (isFloating) {
            element.classList.add('panel-group--floating');
            element.classList.remove('panel-group--fills-space');
            me.updateStyles(element, { position: 'absolute' });
        } else {
            element.classList.remove('panel-group--floating');
            me.updateStyles(element, {
                position: '',
                left: '',
                top: '',
                width: '',
                height: '',
                zIndex: ''
            });
        }
    }

    /**
     * Updates the collapsed state visuals.
     *
     * @param {HTMLElement} element - The group element.
     * @param {boolean} isCollapsed - Whether the group is collapsed.
     * @returns {void}
     */
    setCollapsed(element, isCollapsed) {
        const me = this;
        if (!element) return;

        const contentContainer = me.getContentContainer(element);

        if (isCollapsed) {
            element.classList.add('panel--collapsed');
            if (contentContainer) {
                me.updateStyles(contentContainer, { display: 'none' });
            }
            me.updateStyles(element, {
                height: 'auto',
                minHeight: 'auto',
                flex: '0 0 auto'
            });
        } else {
            element.classList.remove('panel--collapsed');
            if (contentContainer) {
                me.updateStyles(contentContainer, { display: '' });
            }
            me.updateStyles(element, {
                minHeight: ''
            });
        }
    }

    /**
     * Sets whether the group should expand to fill available space (flex-grow).
     *
     * @param {HTMLElement} element - The group element.
     * @param {boolean} fillsSpace - True to fill space.
     * @returns {void}
     */
    setFillSpace(element, fillsSpace) {
        if (!element) return;

        if (fillsSpace) {
            element.classList.add('panel-group--fills-space');
        } else {
            element.classList.remove('panel-group--fills-space');
        }
    }

    /**
     * Mounts the header element into the group structure.
     * Ensures the header is always the first child.
     *
     * @param {HTMLElement} groupElement - The root group element.
     * @param {HTMLElement} headerElement - The header DOM element.
     * @returns {void}
     */
    mountHeader(groupElement, headerElement) {
        const me = this;
        if (!(groupElement instanceof HTMLElement) || !(headerElement instanceof HTMLElement)) {
            console.warn('[VanillaPanelGroupAdapter] Invalid elements provided to mountHeader.');
            return;
        }

        if (groupElement.firstChild) {
            groupElement.insertBefore(headerElement, groupElement.firstChild);
        } else {
            me.mount(groupElement, headerElement);
        }
    }
}
