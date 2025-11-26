import { UIItemStrip } from './UIItemStrip.js';
import { ContextMenuService } from '../../services/ContextMenu/ContextMenuService.js';
import { Emitter } from '../../core/Emitter.js';

/**
 * Description:
 * A specialized implementation of UIItemStrip for managing tabbed interfaces.
 * It adds logic for item selection (active state) and a "Simple Mode" behavior,
 * which automatically hides the strip when only one item is present (common in IDE layouts).
 *
 * Properties summary:
 * - activeItem {UIElement|null} : The currently selected tab item.
 * - simpleModeEnabled {boolean} : Whether simple mode behavior is active.
 * - isSimpleModeActive {boolean} : Read-only flag indicating if the strip is currently in simple mode (hidden).
 *
 * Typical usage:
 * const tabs = new TabStrip('main-tabs');
 * tabs.setSimpleModeConfig(true);
 * tabs.addItem(tab1);
 * tabs.addItem(tab2);
 * tabs.setActiveItem(tab1);
 *
 * Events:
 * - (Inherits from UIItemStrip)
 * - Emits 'selectionChange' via onSelectionChange getter.
 *
 * Business rules implemented:
 * - Only one item can be active at a time.
 * - If Simple Mode is enabled and Item Count == 1: The strip hides itself.
 * - If Item Count > 1 or Simple Mode disabled: The strip shows itself.
 * - Updates visual classes on item elements to reflect active state.
 * - Provides an overflow menu listing all tabs for quick navigation.
 *
 * Dependencies:
 * - {import('./UIItemStrip.js').UIItemStrip}
 * - {import('../../core/UIElement.js').UIElement}
 * - {import('../../services/ContextMenu/ContextMenuService.js').ContextMenuService}
 * - {import('../../core/Emitter.js').Emitter}
 */
export class TabStrip extends UIItemStrip {
    /**
     * The currently selected item.
     *
     * @type {import('../../core/UIElement.js').UIElement | null}
     * @private
     */
    _activeItem = null;

    /**
     * Configuration flag for Simple Mode behavior.
     *
     * @type {boolean}
     * @private
     */
    _simpleModeEnabled = false;

    /**
     * Current state of Simple Mode (true = strip is hidden due to single item).
     *
     * @type {boolean}
     * @private
     */
    _isSimpleModeActive = false;

    /**
     * Emitter for selection changes.
     *
     * @type {Emitter}
     * @private
     */
    _onSelectionChange;

    /**
     * Creates an instance of TabStrip.
     *
     * @param {string} [id=null] - Optional unique ID.
     * @param {object} [config={}] - Configuration options.
     * @param {boolean} [config.simpleMode=false] - Initial simple mode config.
     * @param {import('../../core/IRenderer.js').IRenderer} [renderer=null] - Optional renderer.
     */
    constructor(id = null, config = {}, renderer = null) {
        super(id, config, renderer);
        const me = this;

        me._onSelectionChange = new Emitter();

        if (config.simpleMode !== undefined) {
            me.setSimpleModeConfig(Boolean(config.simpleMode));
        }
    }

    /**
     * Retrieves the currently active item.
     *
     * @returns {import('../../core/UIElement.js').UIElement | null}
     */
    get activeItem() {
        return this._activeItem;
    }

    /**
     * Retrieves the simple mode configuration.
     *
     * @returns {boolean}
     */
    get simpleModeEnabled() {
        return this._simpleModeEnabled;
    }

    /**
     * Checks if simple mode is currently effective (strip hidden).
     *
     * @returns {boolean}
     */
    get isSimpleModeActive() {
        return this._isSimpleModeActive;
    }

    /**
     * Public event for selection changes.
     *
     * @returns {Function}
     */
    get onSelectionChange() {
        return this._onSelectionChange.event;
    }

    /**
     * Sets the active item and updates visual states.
     *
     * @param {import('../../core/UIElement.js').UIElement} item - The item to select.
     * @returns {void}
     */
    setActiveItem(item) {
        const me = this;
        // Validation
        if (item && !me.items.includes(item)) {
            console.warn(
                `[TabStrip] Cannot set active item. Item is not part of this strip.`,
                item
            );
            return;
        }

        if (me._activeItem === item) {
            return;
        }

        // Deactivate current
        if (me._activeItem && me._activeItem.element) {
            me._activeItem.element.classList.remove('ui-strip__item--active');
        }

        // Activate new
        me._activeItem = item;
        if (me._activeItem && me._activeItem.element) {
            me._activeItem.element.classList.add('ui-strip__item--active');
            // Ensure element is visible in scroll area
            if (typeof me._activeItem.element.scrollIntoView === 'function') {
                me._activeItem.element.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'nearest'
                });
            }
        }

        // [CORREÇÃO] Notify listeners (e.g. Viewport) that selection changed
        me._onSelectionChange.fire(item);
    }

    /**
     * Configures the Simple Mode behavior.
     *
     * @param {boolean} enabled - True to enable hiding when single item.
     * @returns {void}
     */
    setSimpleModeConfig(enabled) {
        const me = this;
        if (typeof enabled !== 'boolean') {
            console.warn(`[TabStrip] invalid enabled assignment (${enabled}). Must be boolean.`);
            return;
        }
        me._simpleModeEnabled = enabled;
        me._checkSimpleMode();
    }

    /**
     * (Override) Adds an item and triggers Simple Mode check.
     *
     * @param {import('../../core/UIElement.js').UIElement} item - The item to add.
     * @param {number|null} [index=null] - The index.
     * @returns {void}
     */
    addItem(item, index = null) {
        super.addItem(item, index);
        this._checkSimpleMode();
    }

    /**
     * (Override) Removes an item and triggers Simple Mode check.
     * Handles active item reset if the active item is removed.
     *
     * @param {import('../../core/UIElement.js').UIElement} item - The item to remove.
     * @returns {void}
     */
    removeItem(item) {
        const me = this;
        const wasActive = me._activeItem === item;

        super.removeItem(item);

        if (wasActive) {
            me._activeItem = null;
            // Optional: Auto-select neighbour could be implemented here or left to the controller (PanelGroup)
        }

        me._checkSimpleMode();
    }

    /**
     * (Override) Handles the overflow button click.
     * Displays a context menu with a list of all tabs for quick navigation.
     *
     * @param {MouseEvent} event - The click event from the overflow button.
     * @returns {void}
     */
    onOverflowClick(event) {
        const me = this;
        const menuItems = me.items.map(item => {
            // Try to resolve a clean title
            let label = 'Untitled';

            if (item.title) {
                label = item.title;
            } else if (item.element) {
                // Try specific classes to avoid grabbing button text like 'x' (close button)
                const titleEl = item.element.querySelector('.panel__title, .window-header__title');
                if (titleEl) {
                    label = titleEl.textContent;
                } else {
                    // Fallback: use the whole text content
                    label = item.element.textContent;
                }
            }

            const isActive = item === me.activeItem;
            // Add checkmark indicator for active item
            const displayTitle = isActive ? `✔ ${label}` : label;

            return {
                title: displayTitle,
                callback: () => {
                    me.setActiveItem(item);
                }
            };
        });

        if (menuItems.length > 0) {
            ContextMenuService.getInstance().show(event, menuItems);
        }
    }

    /**
     * Evaluates if the strip should be hidden or shown based on item count.
     *
     * @private
     * @returns {void}
     */
    _checkSimpleMode() {
        const me = this;
        if (!me._simpleModeEnabled) {
            if (me._isSimpleModeActive) {
                me.setVisible(true);
                me._isSimpleModeActive = false;
            }
            return;
        }

        const count = me.items.length;
        const shouldBeHidden = count === 1;

        if (shouldBeHidden !== me._isSimpleModeActive) {
            me._isSimpleModeActive = shouldBeHidden;
            // Use inherited setVisible from UIElement
            me.setVisible(!shouldBeHidden);
        }
    }

    /**
     * Dispose emitter on destroy.
     * * @override
     */
    dispose() {
        this._onSelectionChange.dispose();
        super.dispose();
    }
}
