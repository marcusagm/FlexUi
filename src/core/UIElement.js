import { Disposable } from './Disposable.js';
import { Emitter } from './Emitter.js';
import { generateId } from '../utils/generateId.js';
import { VanillaRenderer } from '../renderers/vanilla/VanillaRenderer.js';

/**
 * Description:
 * The abstract base class for all visual components in the application.
 * It extends the Disposable pattern to manage resources and provides a standardized
 * lifecycle (Render -> Mount -> Unmount -> Dispose) with extensive event hooks.
 * This class decouples the component state from the DOM implementation via an IRenderer.
 *
 * Properties summary:
 * - id {string} : Unique identifier for the component.
 * - element {HTMLElement} : The root DOM element of the component.
 * - renderer {IRenderer} : The renderer instance used for DOM manipulation.
 * - isMounted {boolean} : Whether the component is currently attached to the DOM.
 * - isVisible {boolean} : Whether the component is visually visible.
 * - isFocused {boolean} : Whether the component has focus.
 *
 * Typical usage:
 * class MyButton extends UIElement {
 * _doRender() {
 * return this._renderer.createElement('button', { className: 'btn' }, ['Click me']);
 * }
 * }
 *
 * Events:
 * - onWillMount: Fired before mounting.
 * - onDidMount: Fired after mounting.
 * - onWillUnmount: Fired before unmounting.
 * - onDidUnmount: Fired after unmounting.
 * - onWillRender: Fired before rendering.
 * - onDidRender: Fired after rendering.
 * - onWillFocus: Fired before setting focus.
 * - onDidFocus: Fired after setting focus.
 * - onWillBlur: Fired before removing focus.
 * - onDidBlur: Fired after removing focus.
 * - onWillVisibilityChange: Fired before visibility changes.
 * - onDidVisibilityChange: Fired after visibility changes.
 * - onWillDispose: Fired before disposal.
 * - onDidDispose: Fired after disposal.
 * - onWillMove: Fired before moving.
 * - onDidMove: Fired after moving.
 *
 * Business rules implemented:
 * - Enforces a strict lifecycle sequence.
 * - Guarantees that 'Will' events fire before action and 'Did' events fire after state update.
 * - Manages internal state flags automatically.
 * - Prevents operations on disposed or invalid states.
 *
 * Dependencies:
 * - {import('./Disposable.js').Disposable}
 * - {import('./Emitter.js').Emitter}
 * - {import('../utils/generateId.js').generateId}
 * - {import('../renderers/vanilla/VanillaRenderer.js').VanillaRenderer}
 *
 * Notes / Additional:
 * - Subclasses must implement the protected `_doRender` method.
 */
export class UIElement extends Disposable {
    /**
     * Unique identifier for the component.
     *
     * @type {string}
     * @private
     */
    _id;

    /**
     * The renderer instance used for DOM manipulation.
     *
     * @type {import('./IRenderer.js').IRenderer}
     * @private
     */
    _renderer;

    /**
     * The root DOM element of the component.
     *
     * @type {HTMLElement | null}
     * @private
     */
    _element = null;

    /**
     * State flag indicating if the component is mounted.
     *
     * @type {boolean}
     * @private
     */
    _isMounted = false;

    /**
     * State flag indicating if the component is visible.
     *
     * @type {boolean}
     * @private
     */
    _isVisible = true;

    /**
     * State flag indicating if the component is focused.
     *
     * @type {boolean}
     * @private
     */
    _isFocused = false;

    /**
     * Emitter for the 'willMount' lifecycle event.
     *
     * @type {Emitter}
     * @private
     */
    _onWillMount = this._createEmitter();

    /**
     * Emitter for the 'didMount' lifecycle event.
     *
     * @type {Emitter}
     * @private
     */
    _onDidMount = this._createEmitter();

    /**
     * Emitter for the 'willUnmount' lifecycle event.
     *
     * @type {Emitter}
     * @private
     */
    _onWillUnmount = this._createEmitter();

    /**
     * Emitter for the 'didUnmount' lifecycle event.
     *
     * @type {Emitter}
     * @private
     */
    _onDidUnmount = this._createEmitter();

    /**
     * Emitter for the 'willRender' lifecycle event.
     *
     * @type {Emitter}
     * @private
     */
    _onWillRender = this._createEmitter();

    /**
     * Emitter for the 'didRender' lifecycle event.
     *
     * @type {Emitter}
     * @private
     */
    _onDidRender = this._createEmitter();

    /**
     * Emitter for the 'willFocus' lifecycle event.
     *
     * @type {Emitter}
     * @private
     */
    _onWillFocus = this._createEmitter();

    /**
     * Emitter for the 'didFocus' lifecycle event.
     *
     * @type {Emitter}
     * @private
     */
    _onDidFocus = this._createEmitter();

    /**
     * Emitter for the 'willBlur' lifecycle event.
     *
     * @type {Emitter}
     * @private
     */
    _onWillBlur = this._createEmitter();

    /**
     * Emitter for the 'didBlur' lifecycle event.
     *
     * @type {Emitter}
     * @private
     */
    _onDidBlur = this._createEmitter();

    /**
     * Emitter for the 'willVisibilityChange' lifecycle event.
     *
     * @type {Emitter}
     * @private
     */
    _onWillVisibilityChange = this._createEmitter();

    /**
     * Emitter for the 'didVisibilityChange' lifecycle event.
     *
     * @type {Emitter}
     * @private
     */
    _onDidVisibilityChange = this._createEmitter();

    /**
     * Emitter for the 'willDispose' lifecycle event.
     *
     * @type {Emitter}
     * @private
     */
    _onWillDispose = this._createEmitter();

    /**
     * Emitter for the 'didDispose' lifecycle event.
     *
     * @type {Emitter}
     * @private
     */
    _onDidDispose = this._createEmitter();

    /**
     * Emitter for the 'willMove' lifecycle event.
     *
     * @type {Emitter}
     * @private
     */
    _onWillMove = this._createEmitter();

    /**
     * Emitter for the 'didMove' lifecycle event.
     *
     * @type {Emitter}
     * @private
     */
    _onDidMove = this._createEmitter();

    /**
     * Creates an instance of UIElement.
     *
     * @param {string} [id=null] - Optional unique ID. Generated if not provided.
     * @param {import('./IRenderer.js').IRenderer} [renderer=null] - Optional custom renderer. Defaults to VanillaRenderer.
     */
    constructor(id = null, renderer = null) {
        super();
        const me = this;

        me._id = id || generateId();
        me._renderer = renderer || new VanillaRenderer();
    }

    /**
     * Gets the component ID.
     *
     * @returns {string} The unique identifier.
     */
    get id() {
        return this._id;
    }

    /**
     * Gets the root DOM element.
     *
     * @returns {HTMLElement | null} The DOM element or null if not rendered.
     */
    get element() {
        return this._element;
    }

    /**
     * Gets the renderer instance.
     *
     * @returns {import('./IRenderer.js').IRenderer} The renderer instance.
     */
    get renderer() {
        return this._renderer;
    }

    /**
     * Checks if component is mounted.
     *
     * @returns {boolean} True if mounted.
     */
    get isMounted() {
        return this._isMounted;
    }

    /**
     * Checks if component is visible.
     *
     * @returns {boolean} True if visible.
     */
    get isVisible() {
        return this._isVisible;
    }

    /**
     * Checks if component is focused.
     *
     * @returns {boolean} True if focused.
     */
    get isFocused() {
        return this._isFocused;
    }

    /**
     * Accessor for the onWillMount event.
     *
     * @returns {Function} The subscription function.
     */
    get onWillMount() {
        return this._onWillMount.event;
    }

    /**
     * Accessor for the onDidMount event.
     *
     * @returns {Function} The subscription function.
     */
    get onDidMount() {
        return this._onDidMount.event;
    }

    /**
     * Accessor for the onWillUnmount event.
     *
     * @returns {Function} The subscription function.
     */
    get onWillUnmount() {
        return this._onWillUnmount.event;
    }

    /**
     * Accessor for the onDidUnmount event.
     *
     * @returns {Function} The subscription function.
     */
    get onDidUnmount() {
        return this._onDidUnmount.event;
    }

    /**
     * Accessor for the onWillRender event.
     *
     * @returns {Function} The subscription function.
     */
    get onWillRender() {
        return this._onWillRender.event;
    }

    /**
     * Accessor for the onDidRender event.
     *
     * @returns {Function} The subscription function.
     */
    get onDidRender() {
        return this._onDidRender.event;
    }

    /**
     * Accessor for the onWillFocus event.
     *
     * @returns {Function} The subscription function.
     */
    get onWillFocus() {
        return this._onWillFocus.event;
    }

    /**
     * Accessor for the onDidFocus event.
     *
     * @returns {Function} The subscription function.
     */
    get onDidFocus() {
        return this._onDidFocus.event;
    }

    /**
     * Accessor for the onWillBlur event.
     *
     * @returns {Function} The subscription function.
     */
    get onWillBlur() {
        return this._onWillBlur.event;
    }

    /**
     * Accessor for the onDidBlur event.
     *
     * @returns {Function} The subscription function.
     */
    get onDidBlur() {
        return this._onDidBlur.event;
    }

    /**
     * Accessor for the onWillVisibilityChange event.
     *
     * @returns {Function} The subscription function.
     */
    get onWillVisibilityChange() {
        return this._onWillVisibilityChange.event;
    }

    /**
     * Accessor for the onDidVisibilityChange event.
     *
     * @returns {Function} The subscription function.
     */
    get onDidVisibilityChange() {
        return this._onDidVisibilityChange.event;
    }

    /**
     * Accessor for the onWillDispose event.
     *
     * @returns {Function} The subscription function.
     */
    get onWillDispose() {
        return this._onWillDispose.event;
    }

    /**
     * Accessor for the onDidDispose event.
     *
     * @returns {Function} The subscription function.
     */
    get onDidDispose() {
        return this._onDidDispose.event;
    }

    /**
     * Accessor for the onWillMove event.
     *
     * @returns {Function} The subscription function.
     */
    get onWillMove() {
        return this._onWillMove.event;
    }

    /**
     * Accessor for the onDidMove event.
     *
     * @returns {Function} The subscription function.
     */
    get onDidMove() {
        return this._onDidMove.event;
    }

    /**
     * Renders the component content.
     * This method manages the event lifecycle and delegates the actual creation to _doRender.
     *
     * @returns {void}
     */
    render() {
        const me = this;
        if (me.isDisposed) return;

        me._onWillRender.fire(me);

        me._element = me._doRender();

        me._onDidRender.fire(me);
    }

    /**
     * Mounts the component to a parent container.
     *
     * @param {HTMLElement} container - The parent container.
     * @returns {void}
     */
    mount(container) {
        const me = this;
        if (me.isDisposed) {
            console.warn(`[UIElement] Cannot mount disposed component ${me.id}.`);
            return;
        }
        if (me._isMounted) {
            console.warn(`[UIElement] Component ${me.id} is already mounted.`);
            return;
        }
        if (!container) {
            console.warn(`[UIElement] Invalid container provided for mount.`);
            return;
        }
        if (!me._element) {
            me.render();
        }

        me._onWillMount.fire({ component: me, container });

        me._doMount(container);
        me._isMounted = true;

        me._onDidMount.fire({ component: me, container });
    }

    /**
     * Unmounts the component from the DOM.
     *
     * @returns {void}
     */
    unmount() {
        const me = this;
        if (me.isDisposed || !me._isMounted) {
            return;
        }

        me._onWillUnmount.fire(me);

        me._doUnmount();
        me._isMounted = false;

        me._onDidUnmount.fire(me);
    }

    /**
     * Toggles visibility of the component.
     *
     * @param {boolean} visible - True to show, false to hide.
     * @returns {void}
     */
    setVisible(visible) {
        const me = this;
        const isVisible = Boolean(visible);

        if (me._isVisible === isVisible) {
            return;
        }

        me._onWillVisibilityChange.fire({ component: me, visible: isVisible });

        if (me._element) {
            if (isVisible) {
                me._renderer.updateStyles(me._element, { display: '' });
            } else {
                me._renderer.updateStyles(me._element, { display: 'none' });
            }
        }
        me._isVisible = isVisible;

        me._onDidVisibilityChange.fire({ component: me, visible: isVisible });
    }

    /**
     * Sets focus to the component.
     *
     * @returns {void}
     */
    focus() {
        const me = this;
        if (me.isDisposed || !me._element) return;

        me._onWillFocus.fire(me);

        me._element.focus();
        me._isFocused = true;

        me._onDidFocus.fire(me);
    }

    /**
     * Removes focus from the component.
     *
     * @returns {void}
     */
    blur() {
        const me = this;
        if (me.isDisposed || !me._element) return;

        me._onWillBlur.fire(me);

        me._element.blur();
        me._isFocused = false;

        me._onDidBlur.fire(me);
    }

    /**
     * Disposes the component and cleans up resources.
     *
     * @returns {void}
     */
    dispose() {
        const me = this;
        if (me.isDisposed) return;

        me._onWillDispose.fire(me);

        if (me._isMounted) {
            me.unmount();
        }

        if (me._element) {
            me._element = null;
        }

        me._onDidDispose.fire(me);

        super.dispose();
    }

    /**
     * Helper to create and register an emitter.
     *
     * @returns {Emitter} The created emitter.
     * @private
     */
    _createEmitter() {
        const emitter = new Emitter();
        this.addDisposable(emitter);
        return emitter;
    }

    /**
     * Internal render logic. Subclasses must implement this.
     *
     * @returns {HTMLElement} The created DOM element.
     * @protected
     * @throws {Error} If not implemented by subclass.
     */
    _doRender() {
        throw new Error(`[UIElement] _doRender not implemented by ${this.constructor.name}.`);
    }

    /**
     * Internal mount logic.
     *
     * @param {HTMLElement} container - The parent container.
     * @protected
     */
    _doMount(container) {
        const me = this;
        if (me._element && me._element.parentNode !== container) {
            me._renderer.mount(container, me._element);
        }
    }

    /**
     * Internal unmount logic.
     *
     * @protected
     */
    _doUnmount() {
        const me = this;
        if (me._element && me._element.parentNode) {
            me._renderer.unmount(me._element.parentNode, me._element);
        }
    }
}
