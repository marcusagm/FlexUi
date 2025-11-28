import { Panel } from './Panel.js';
import { stateManager } from '../../services/StateManager.js';

/**
 * Description:
 * A reactive panel that displays a counter.
 * All instances of this panel are synchronized using the StateManager.
 *
 * Properties summary:
 * - _valueElement {HTMLElement|null} : The DOM element that displays the counter value.
 * - _boundOnIncrease {Function|null} : Bound listener for the increase button.
 * - _boundOnDecrease {Function|null} : Bound listener for the decrease button.
 * - _boundOnReset {Function|null} : Bound listener for the reset button.
 *
 * Typical usage:
 * const counter = new CounterPanel('My Counter');
 *
 * Events:
 * - Listens to (stateManager): 'counterValue'
 * - Emits to (stateManager): 'counterValue'
 *
 * Business rules implemented:
 * - Updates UI immediately upon global state change.
 * - Cleans up event listeners on destroy to prevent memory leaks.
 * - Enforces minimum dimensions to fit the controls.
 *
 * Dependencies:
 * - {import('./Panel.js').Panel}
 * - {import('../../services/StateManager.js').stateManager}
 * - {import('../../core/IRenderer.js').IRenderer}
 */
export class CounterPanel extends Panel {
    /**
     * Creates a new CounterPanel instance.
     *
     * @param {string} title - The panel title.
     * @param {object} [config={}] - Configuration overrides.
     * @param {import('../../core/IRenderer.js').IRenderer} [renderer=null] - Optional renderer adapter.
     */
    constructor(title, config = {}, renderer = null) {
        const defaults = {
            collapsible: false,
            minHeight: 130,
            minWidth: 260
        };

        super(title, { ...defaults, ...config }, renderer);
    }

    /**
     * Returns the unique type identifier for this panel class.
     *
     * @returns {string} The type identifier.
     */
    static get panelType() {
        return 'CounterPanel';
    }

    /**
     * Returns the instance type identifier.
     *
     * @returns {string} The type identifier string.
     */
    getPanelType() {
        return 'CounterPanel';
    }

    /**
     * (Overrides Panel.populate) Creates the DOM for the counter.
     *
     * @returns {void}
     */
    populate() {
        const me = this;
        const contentElement = me.contentElement;

        if (!contentElement) return;

        me._boundOnIncrease = me._onIncrease.bind(me);
        me._boundOnDecrease = me._onDecrease.bind(me);
        me._boundOnReset = me._onReset.bind(me);

        me._valueElement = document.createElement('h2');
        me._valueElement.style.fontSize = '2.5rem';
        me._valueElement.style.textAlign = 'center';
        me._valueElement.style.margin = '1rem 0';
        me._valueElement.textContent = stateManager.get('counterValue') ?? 0;

        const increaseButton = document.createElement('button');
        increaseButton.type = 'button';
        increaseButton.className = 'btn btn--primary btn--sm';
        increaseButton.textContent = 'Aumentar';
        increaseButton.dataset.action = 'increase';
        increaseButton.addEventListener('click', me._boundOnIncrease);

        const decreaseButton = document.createElement('button');
        decreaseButton.type = 'button';
        decreaseButton.className = 'btn btn--secondary btn--sm';
        decreaseButton.textContent = 'Diminuir';
        decreaseButton.dataset.action = 'decrease';
        decreaseButton.addEventListener('click', me._boundOnDecrease);

        const resetButton = document.createElement('button');
        resetButton.type = 'button';
        resetButton.className = 'btn btn--sm';
        resetButton.textContent = 'Resetar';
        resetButton.dataset.action = 'reset';
        resetButton.addEventListener('click', me._boundOnReset);

        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'button-group';
        buttonGroup.style.justifyContent = 'center';
        buttonGroup.style.display = 'flex';
        buttonGroup.style.width = '100%';
        buttonGroup.append(decreaseButton, resetButton, increaseButton);

        contentElement.append(me._valueElement, buttonGroup);
    }

    /**
     * (Overrides Panel) Defines which global state keys to observe.
     *
     * @returns {Array<string>} The list of observed keys.
     */
    getObservedStateKeys() {
        return ['counterValue'];
    }

    /**
     * (Overrides Panel) Handles global state updates.
     *
     * @param {string} key - The state key that changed.
     * @param {*} value - The new value.
     * @returns {void}
     */
    onStateUpdate(key, value) {
        const me = this;
        if (key === 'counterValue') {
            const currentValue = value ?? 0;
            if (me._valueElement) {
                me._valueElement.textContent = currentValue;
            }
        }
    }

    /**
     * (Overrides Panel) Cleans up DOM listeners.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        const contentElement = me.contentElement;

        if (contentElement) {
            const increaseButton = contentElement.querySelector('[data-action="increase"]');
            const decreaseButton = contentElement.querySelector('[data-action="decrease"]');
            const resetButton = contentElement.querySelector('[data-action="reset"]');

            if (increaseButton && me._boundOnIncrease) {
                increaseButton.removeEventListener('click', me._boundOnIncrease);
            }
            if (decreaseButton && me._boundOnDecrease) {
                decreaseButton.removeEventListener('click', me._boundOnDecrease);
            }
            if (resetButton && me._boundOnReset) {
                resetButton.removeEventListener('click', me._boundOnReset);
            }
        }
        super.destroy();
    }

    /**
     * Handles the click on the increase button.
     *
     * @private
     * @returns {void}
     */
    _onIncrease() {
        const currentValue = stateManager.get('counterValue') ?? 0;
        stateManager.set('counterValue', currentValue + 1);
    }

    /**
     * Handles the click on the decrease button.
     *
     * @private
     * @returns {void}
     */
    _onDecrease() {
        const currentValue = stateManager.get('counterValue') ?? 0;
        stateManager.set('counterValue', currentValue - 1);
    }

    /**
     * Handles the click on the reset button.
     *
     * @private
     * @returns {void}
     */
    _onReset() {
        stateManager.set('counterValue', 0);
    }
}
