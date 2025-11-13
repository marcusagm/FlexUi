import { Panel } from './Panel.js';
import { globalState } from '../../services/GlobalStateService.js';

/**
 * Description:
 * Um painel reativo que exibe um contador.
 * Todas as instâncias deste painel são sincronizadas usando o GlobalStateService.
 *
 * Properties summary:
 * - _valueEl {HTMLElement} : O elemento DOM que exibe o valor do contador.
 * - _boundOnIncrease {Function} : Listener vinculado para o botão de aumentar.
 * - _boundOnDecrease {Function} : Listener vinculado para o botão de diminuir.
 * - _boundOnReset {Function} : Listener vinculado para o botão de resetar.
 *
 * Events:
 * - Listens to (globalState): 'counterValue'
 * - Emits to (globalState): 'counterValue'
 *
 * Dependencies:
 * - ./Panel.js
 * - ../../services/GlobalStateService.js
 */
export class CounterPanel extends Panel {
    /**
     * @type {HTMLElement | null}
     * @private
     */
    _valueEl = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnIncrease = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnDecrease = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnReset = null;

    /**
     * @param {string} title - O título do painel.
     * @param {number|null} [height=null] - A altura inicial.
     * @param {object} [config={}] - Configurações de override.
     */
    constructor(title, height = null, config = {}) {
        super(title, height, config);
        const me = this;

        me._boundOnIncrease = me._onIncrease.bind(me);
        me._boundOnDecrease = me._onDecrease.bind(me);
        me._boundOnReset = me._onReset.bind(me);

        me.render();
    }

    /**
     * <panelType> static getter.
     * @returns {string}
     */
    static get panelType() {
        return 'CounterPanel';
    }

    /**
     * <PanelType> getter.
     * @returns {string}
     */
    getPanelType() {
        return 'CounterPanel';
    }

    /**
     * (Sobrescreve Panel) Cria o DOM para o contador.
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
     * (Sobrescreve Panel) Define quais chaves do estado global observar.
     * @returns {Array<string>}
     */
    getObservedStateKeys() {
        return ['counterValue'];
    }

    /**
     * (Sobrescreve Panel) Lida com atualizações do estado global.
     * @param {string} key - A chave de estado que mudou.
     * @param {*} value - O novo valor.
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
     * (Sobrescreve Panel) Limpa os listeners do DOM.
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
     * Lida com o clique no botão de aumentar.
     * @private
     * @returns {void}
     */
    _onIncrease() {
        const currentValue = globalState.get('counterValue') ?? 0;
        globalState.set('counterValue', currentValue + 1);
    }

    /**
     * Lida com o clique no botão de diminuir.
     * @private
     * @returns {void}
     */
    _onDecrease() {
        const currentValue = globalState.get('counterValue') ?? 0;
        globalState.set('counterValue', currentValue - 1);
    }

    /**
     * Lida com o clique no botão de resetar.
     * @private
     * @returns {void}
     */
    _onReset() {
        globalState.set('counterValue', 0);
    }
}
