import { UIItemStrip } from './UIItemStrip.js';
import { ContextMenuService } from '../../services/ContextMenu/ContextMenuService.js';
import { Emitter } from '../../core/Emitter.js';

/**
 * Description:
 * A specialized implementation of UIItemStrip for managing tabbed interfaces.
 * It adds logic for item selection (active state) and a "Simple Mode" behavior,
 * which styles the strip as a static title header when only one item is present,
 * instead of hiding it.
 *
 * Properties summary:
 * - activeItem {UIElement|null} : The currently selected tab item.
 * - simpleModeEnabled {boolean} : Whether simple mode behavior is active.
 * - isSimpleModeActive {boolean} : Read-only flag indicating if the strip is currently in simple mode.
 * - onSelectionChange: Fired when the active item changes.
 * - onSimpleModeChange: Fired when the simple mode state changes (true/false).
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
 * - Emits 'simpleModeChange' via onSimpleModeChange getter.
 *
 * Business rules implemented:
 * - Only one item can be active at a time.
 * - If Simple Mode is enabled and Item Count == 1: The strip remains visible, but the item is locked (not draggable) and styled as a title.
 * - If Item Count > 1 or Simple Mode disabled: Standard tab behavior (draggable, closable).
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
     * Current state of Simple Mode (true = single item styled as title).
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
     * Emitter for simple mode state changes.
     *
     * @type {Emitter}
     * @private
     */
    _onSimpleModeChange;

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
        me._onSimpleModeChange = new Emitter();

        if (config.simpleMode !== undefined) {
            me.setSimpleModeConfig(Boolean(config.simpleMode));
        }
    }

    /**
     * Retrieves the currently active item.
     *
     * @returns {import('../../core/UIElement.js').UIElement | null} The active item.
     */
    get activeItem() {
        return this._activeItem;
    }

    /**
     * Retrieves the simple mode configuration.
     *
     * @returns {boolean} True if simple mode is enabled.
     */
    get simpleModeEnabled() {
        return this._simpleModeEnabled;
    }

    /**
     * Checks if simple mode is currently effective (single item behavior).
     *
     * @returns {boolean} True if in simple mode.
     */
    get isSimpleModeActive() {
        return this._isSimpleModeActive;
    }

    /**
     * Public event for selection changes.
     *
     * @returns {Function} The subscription function.
     */
    get onSelectionChange() {
        return this._onSelectionChange.event;
    }

    /**
     * Public event for simple mode changes.
     *
     * @returns {Function} The subscription function.
     */
    get onSimpleModeChange() {
        return this._onSimpleModeChange.event;
    }

    /**
     * Sets the active item and updates visual states.
     *
     * @param {import('../../core/UIElement.js').UIElement} item - The item to select.
     * @returns {void}
     */
    setActiveItem(item) {
        const me = this;
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

        if (me._activeItem && me._activeItem.element) {
            me._activeItem.element.classList.remove('ui-strip__item--active');
        }

        me._activeItem = item;
        if (me._activeItem && me._activeItem.element) {
            me._activeItem.element.classList.add('ui-strip__item--active');
            if (typeof me._activeItem.element.scrollIntoView === 'function') {
                me._activeItem.element.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'nearest'
                });
            }
        }

        me._onSelectionChange.fire(item);
    }

    /**
     * Configures the Simple Mode behavior.
     *
     * @param {boolean} enabled - True to enable special handling for single items.
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
     * Adds an item and triggers Simple Mode check.
     * Overrides base method.
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
     * Removes an item and triggers Simple Mode check.
     * Overrides base method.
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
        }
        me._checkSimpleMode();
    }

    /**
     * Handles the overflow button click.
     * Displays a context menu with a list of all tabs for quick navigation.
     * Overrides base method.
     *
     * @param {MouseEvent} event - The click event from the overflow button.
     * @returns {void}
     */
    onOverflowClick(event) {
        const me = this;
        const menuItems = me.items.map(item => {
            let label = 'Untitled';
            if (item.title) {
                label = item.title;
            } else if (item.element) {
                const titleEl = item.element.querySelector('.panel__title, .window-header__title');
                if (titleEl) label = titleEl.textContent;
                else label = item.element.textContent;
            }

            const isActive = item === me.activeItem;
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
     * Evaluates if the strip should be in simple mode based on item count.
     * Updates draggable state of items and notifies listeners.
     *
     * @private
     * @returns {void}
     */
    _checkSimpleMode() {
        const me = this;
        const count = me.items.length;

        // Determine if we are effectively in simple mode (enabled AND exactly one item)
        let isSimple = false;
        if (me._simpleModeEnabled && count === 1) {
            isSimple = true;
        }

        // Change state and notify if changed
        if (isSimple !== me._isSimpleModeActive) {
            me._isSimpleModeActive = isSimple;
            me._onSimpleModeChange.fire(isSimple);
        }

        // Enforce Draggable State on Items
        // In Simple Mode, the single item behaves as a title (not draggable individually)
        me.items.forEach(item => {
            const shouldBeDraggable = !isSimple;

            // Check if the item supports setDraggable (e.g., PanelHeader via adapter)
            if (item && typeof item.setDraggable === 'function') {
                item.setDraggable(shouldBeDraggable);
            }
        });

        // Ensure the strip is always visible (unlike previous logic which hid it)
        if (!me.isVisible) {
            me.setVisible(true);
        }
    }

    /**
     * Disposes resources and emitters.
     * Overrides base method.
     *
     * @returns {void}
     */
    dispose() {
        this._onSelectionChange.dispose();
        this._onSimpleModeChange.dispose();
        super.dispose();
    }
}
