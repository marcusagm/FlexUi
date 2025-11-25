import { UIItemStrip } from './UIItemStrip.js';

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
 * - Emits 'selectionChanged' (via Emitter if implemented, currently managing state directly).
 *
 * Business rules implemented:
 * - Only one item can be active at a time.
 * - If Simple Mode is enabled and Item Count == 1: The strip hides itself.
 * - If Item Count > 1 or Simple Mode disabled: The strip shows itself.
 * - Updates visual classes on item elements to reflect active state.
 *
 * Dependencies:
 * - {import('./UIItemStrip.js').UIItemStrip}
 * - {import('../../core/UIElement.js').UIElement}
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
}
