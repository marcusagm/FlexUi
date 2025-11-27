import { UIElement } from '../../core/UIElement.js';
import { VanillaLoaderAdapter } from '../../renderers/vanilla/VanillaLoaderAdapter.js';

/**
 * Description:
 * A reusable component for displaying a loading overlay (spinner and message)
 * on top of a target DOM element.
 *
 * It supports two modes:
 * 1. 'fullpage': (Default) Uses position:fixed to cover the entire viewport.
 * 2. 'inset': Uses position:absolute to cover only the targetElement.
 *
 * Properties summary:
 * - targetElement {HTMLElement} : The DOM element this Loader is attached to.
 * - type {string} : The mode of the loader ('fullpage' or 'inset').
 * - message {string} : The current loading message.
 *
 * Typical usage:
 * // For a full-page load
 * const appLoader = new Loader(document.body, { type: 'fullpage' });
 * appLoader.show('Initializing...');
 * // ... later ...
 * appLoader.hide();
 *
 * Events:
 * - (Inherits events from UIElement)
 *
 * Business rules implemented:
 * - Inherits from UIElement -> Disposable.
 * - Delegates DOM creation/manipulation to VanillaLoaderAdapter.
 * - Manages visibility transitions and auto-unmounting on hide.
 * - Applies CSS classes to the target element for proper positioning (inset mode).
 *
 * Dependencies:
 * - {import('../../core/UIElement.js').UIElement}
 * - {import('../../renderers/vanilla/VanillaLoaderAdapter.js').VanillaLoaderAdapter}
 */
export class Loader extends UIElement {
    /**
     * The DOM element this Loader is attached to.
     *
     * @type {HTMLElement | null}
     * @private
     */
    _targetElement = null;

    /**
     * The loader type ('fullpage' or 'inset').
     *
     * @type {string}
     * @private
     */
    _type = 'fullpage';

    /**
     * The current message text.
     *
     * @type {string}
     * @private
     */
    _message = '';

    /**
     * Bound listener for auto-unmount on transition end.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnTransitionEnd = null;

    /**
     * Creates an instance of Loader.
     *
     * @param {HTMLElement} targetElement - The DOM element to attach the loader to.
     * @param {object} [options={}] - Configuration options.
     * @param {string} [options.type='fullpage'] - 'fullpage' (fixed) or 'inset' (absolute).
     * @param {import('../../core/IRenderer.js').IRenderer} [renderer=null] - Optional renderer adapter.
     */
    constructor(targetElement, options = {}, renderer = null) {
        super(null, renderer || new VanillaLoaderAdapter());
        const me = this;

        me.targetElement = targetElement;

        if (options.type) {
            me.type = options.type;
        }

        me._boundOnTransitionEnd = me._onTransitionEnd.bind(me);

        me.render();
    }

    /**
     * Sets the target element.
     *
     * @param {HTMLElement} element - The target DOM element.
     * @returns {void}
     */
    set targetElement(element) {
        if (!(element instanceof HTMLElement)) {
            console.warn(
                `[Loader] invalid targetElement assignment (${element}). Must be an HTMLElement.`
            );
            return;
        }
        this._targetElement = element;
    }

    /**
     * Gets the target element.
     *
     * @returns {HTMLElement | null}
     */
    get targetElement() {
        return this._targetElement;
    }

    /**
     * Sets the loader type.
     *
     * @param {string} value - 'fullpage' or 'inset'.
     * @returns {void}
     */
    set type(value) {
        if (value !== 'fullpage' && value !== 'inset') {
            console.warn(
                `[Loader] invalid type assignment (${value}). Must be 'fullpage' or 'inset'.`
            );
            return;
        }
        this._type = value;
    }

    /**
     * Gets the loader type.
     *
     * @returns {string}
     */
    get type() {
        return this._type;
    }

    /**
     * Implementation of the rendering logic.
     *
     * @returns {HTMLElement} The root loader element.
     * @protected
     */
    _doRender() {
        const me = this;
        return me.renderer.createLoaderElement(me.id, me._type);
    }

    /**
     * Implementation of mount logic.
     *
     * @param {HTMLElement} container - The parent container.
     * @protected
     */
    _doMount(container) {
        const me = this;
        if (me.element && me.element.parentNode !== container) {
            me.renderer.mount(container, me.element);
        }

        if (me._type === 'inset' && me._targetElement) {
            me.renderer.setTargetClass(me._targetElement, true);
        }
    }

    /**
     * Implementation of unmount logic.
     *
     * @protected
     */
    _doUnmount() {
        const me = this;

        if (me._type === 'inset' && me._targetElement) {
            me.renderer.setTargetClass(me._targetElement, false);
        }

        if (me.element) {
            me.renderer.off(me.element, 'transitionend', me._boundOnTransitionEnd);

            if (me.element.parentNode) {
                me.renderer.unmount(me.element.parentNode, me.element);
            }
        }
    }

    /**
     * Shows the loader overlay.
     * Automatically mounts the component if it's not already mounted.
     *
     * @param {string} [message=''] - The message to display.
     * @returns {void}
     */
    show(message = '') {
        const me = this;
        if (!me._targetElement) {
            console.warn('[Loader] Cannot show: targetElement is missing.');
            return;
        }

        me._message = message;

        if (!me.element) {
            me.render();
        }

        if (!me.isMounted) {
            me.mount(me._targetElement);
        }

        me.renderer.updateMessage(me.element, message);
        me.element.offsetHeight;
        me.renderer.setVisible(me.element, true);
    }

    /**
     * Hides the loader overlay.
     * Triggers an exit transition and then unmounts the component.
     *
     * @returns {void}
     */
    hide() {
        const me = this;
        if (!me.element || !me.isMounted) {
            return;
        }

        me.renderer.off(me.element, 'transitionend', me._boundOnTransitionEnd);
        me.renderer.on(me.element, 'transitionend', me._boundOnTransitionEnd, { once: true });
        me.renderer.setVisible(me.element, false);
    }

    /**
     * Callback for CSS transition end.
     * Unmounts the component to clean up the DOM.
     *
     * @private
     * @returns {void}
     */
    _onTransitionEnd() {
        const me = this;
        if (me.isMounted) {
            me.unmount();
        }
    }

    /**
     * Disposes the component.
     *
     * @returns {void}
     */
    dispose() {
        const me = this;
        if (me.element) {
            me.renderer.off(me.element, 'transitionend', me._boundOnTransitionEnd);
        }
        super.dispose();
    }
}
