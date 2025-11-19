import { Panel } from './Panel.js';
import { globalState } from '../../services/GlobalStateService.js';

/**
 * Description:
 * A reactive panel that displays a counter.
 * All instances of this panel are synchronized using the GlobalStateService.
 *
 * Properties summary:
 * - _valueEl {HTMLElement|null} : The DOM element that displays the counter value.
 * - _boundOnIncrease {Function|null} : Bound listener for the increase button.
 * - _boundOnDecrease {Function|null} : Bound listener for the decrease button.
 * - _boundOnReset {Function|null} : Bound listener for the reset button.
 *
 * Events:
 * - Listens to (globalState): 'counterValue'
 * - Emits to (globalState): 'counterValue'
 *
 * Dependencies:
 * - {import('./Panel.js').Panel}
 * - {import('../../services/GlobalStateService.js').globalState}
 */
export class CounterPanel extends Panel {
    /**
     * The DOM element that displays the counter value.
     *
     * @type {HTMLElement | null}
     * @private
     */
    _valueEl = null;

    /**
     * Bound listener for the increase button.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnIncrease = null;

    /**
     * Bound listener for the decrease button.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnDecrease = null;

    /**
     * Bound listener for the reset button.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnReset = null;

    /**
     * Creates a new CounterPanel instance.
     *
     * @param {string} title - The panel title.
     * @param {number|null} [height=null] - The initial height.
     * @param {object} [config={}] - Configuration overrides.
     */
    constructor(title, height = null, config = {}) {
        super(title, height, {
            ...config,
            collapsible: false,
            minHeight: 130,
            minWidth: 260
        });
        const me = this;

        me._boundOnIncrease = me._onIncrease.bind(me);
        me._boundOnDecrease = me._onDecrease.bind(me);
        me._boundOnReset = me._onReset.bind(me);

        me.render();
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
     * (Overrides Panel) Creates the DOM for the counter.
     *
     * @returns {void}
     */
    render() {
        const me = this;
        const contentEl = me.contentElement;

        me._valueEl = document.createElement('h2');
        me._valueEl.style.fontSize = '2.5rem';
        me._valueEl.style.textAlign = 'center';
        me._valueEl.style.margin = '1rem 0';
        me._valueEl.textContent = globalState.get('counterValue') ?? 0;

        const increaseBtn = document.createElement('button');
        increaseBtn.type = 'button';
        increaseBtn.className = 'btn btn--primary btn--sm';
        increaseBtn.textContent = 'Aumentar';
        increaseBtn.dataset.action = 'increase';
        increaseBtn.addEventListener('click', me._boundOnIncrease);

        const decreaseBtn = document.createElement('button');
        decreaseBtn.type = 'button';
        decreaseBtn.className = 'btn btn--secondary btn--sm';
        decreaseBtn.textContent = 'Diminuir';
        decreaseBtn.dataset.action = 'decrease';
        decreaseBtn.addEventListener('click', me._boundOnDecrease);

        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'btn btn--sm';
        resetBtn.textContent = 'Resetar';
        resetBtn.dataset.action = 'reset';
        resetBtn.addEventListener('click', me._boundOnReset);

        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'button-group';
        buttonGroup.style.justifyContent = 'center';
        buttonGroup.style.display = 'flex';
        buttonGroup.style.width = '100%';
        buttonGroup.append(decreaseBtn, resetBtn, increaseBtn);

        contentEl.append(me._valueEl, buttonGroup);
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
            if (me._valueEl) {
                me._valueEl.textContent = currentValue;
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
        const contentEl = me.contentElement;

        if (contentEl) {
            const increaseBtn = contentEl.querySelector('[data-action="increase"]');
            const decreaseBtn = contentEl.querySelector('[data-action="decrease"]');
            const resetBtn = contentEl.querySelector('[data-action="reset"]');

            increaseBtn?.removeEventListener('click', me._boundOnIncrease);
            decreaseBtn?.removeEventListener('click', me._boundOnDecrease);
            resetBtn?.removeEventListener('click', me._boundOnReset);
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
        const currentValue = globalState.get('counterValue') ?? 0;
        globalState.set('counterValue', currentValue + 1);
    }

    /**
     * Handles the click on the decrease button.
     *
     * @private
     * @returns {void}
     */
    _onDecrease() {
        const currentValue = globalState.get('counterValue') ?? 0;
        globalState.set('counterValue', currentValue - 1);
    }

    /**
     * Handles the click on the reset button.
     *
     * @private
     * @returns {void}
     */
    _onReset() {
        globalState.set('counterValue', 0);
    }
}
