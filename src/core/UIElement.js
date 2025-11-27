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
 * - Implements Lazy Initialization for events to optimize memory usage.
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
     * Map to store lazily initialized event emitters.
     *
     * @type {Map<string, Emitter>}
     * @private
     */
    _emitters = new Map();

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
        return this._getEmitter('willMount').event;
    }

    /**
     * Accessor for the onDidMount event.
     *
     * @returns {Function} The subscription function.
     */
    get onDidMount() {
        return this._getEmitter('didMount').event;
    }

    /**
     * Accessor for the onWillUnmount event.
     *
     * @returns {Function} The subscription function.
     */
    get onWillUnmount() {
        return this._getEmitter('willUnmount').event;
    }

    /**
     * Accessor for the onDidUnmount event.
     *
     * @returns {Function} The subscription function.
     */
    get onDidUnmount() {
        return this._getEmitter('didUnmount').event;
    }

    /**
     * Accessor for the onWillRender event.
     *
     * @returns {Function} The subscription function.
     */
    get onWillRender() {
        return this._getEmitter('willRender').event;
    }

    /**
     * Accessor for the onDidRender event.
     *
     * @returns {Function} The subscription function.
     */
    get onDidRender() {
        return this._getEmitter('didRender').event;
    }

    /**
     * Accessor for the onWillFocus event.
     *
     * @returns {Function} The subscription function.
     */
    get onWillFocus() {
        return this._getEmitter('willFocus').event;
    }

    /**
     * Accessor for the onDidFocus event.
     *
     * @returns {Function} The subscription function.
     */
    get onDidFocus() {
        return this._getEmitter('didFocus').event;
    }

    /**
     * Accessor for the onWillBlur event.
     *
     * @returns {Function} The subscription function.
     */
    get onWillBlur() {
        return this._getEmitter('willBlur').event;
    }

    /**
     * Accessor for the onDidBlur event.
     *
     * @returns {Function} The subscription function.
     */
    get onDidBlur() {
        return this._getEmitter('didBlur').event;
    }

    /**
     * Accessor for the onWillVisibilityChange event.
     *
     * @returns {Function} The subscription function.
     */
    get onWillVisibilityChange() {
        return this._getEmitter('willVisibilityChange').event;
    }

    /**
     * Accessor for the onDidVisibilityChange event.
     *
     * @returns {Function} The subscription function.
     */
    get onDidVisibilityChange() {
        return this._getEmitter('didVisibilityChange').event;
    }

    /**
     * Accessor for the onWillDispose event.
     *
     * @returns {Function} The subscription function.
     */
    get onWillDispose() {
        return this._getEmitter('willDispose').event;
    }

    /**
     * Accessor for the onDidDispose event.
     *
     * @returns {Function} The subscription function.
     */
    get onDidDispose() {
        return this._getEmitter('didDispose').event;
    }

    /**
     * Accessor for the onWillMove event.
     *
     * @returns {Function} The subscription function.
     */
    get onWillMove() {
        return this._getEmitter('willMove').event;
    }

    /**
     * Accessor for the onDidMove event.
     *
     * @returns {Function} The subscription function.
     */
    get onDidMove() {
        return this._getEmitter('didMove').event;
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

        me._fire('willRender', me);

        me._element = me._doRender();

        me._fire('didRender', me);
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

        me._fire('willMount', { component: me, container });

        me._doMount(container);
        me._isMounted = true;

        me._fire('didMount', { component: me, container });
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

        me._fire('willUnmount', me);

        me._doUnmount();
        me._isMounted = false;

        me._fire('didUnmount', me);
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

        me._fire('willVisibilityChange', { component: me, visible: isVisible });

        if (me._element) {
            if (isVisible) {
                me._renderer.updateStyles(me._element, { display: '' });
            } else {
                me._renderer.updateStyles(me._element, { display: 'none' });
            }
        }
        me._isVisible = isVisible;

        me._fire('didVisibilityChange', { component: me, visible: isVisible });
    }

    /**
     * Sets focus to the component.
     *
     * @returns {void}
     */
    focus() {
        const me = this;
        if (me.isDisposed || !me._element) return;

        me._fire('willFocus', me);

        me._element.focus();
        me._isFocused = true;

        me._fire('didFocus', me);
    }

    /**
     * Removes focus from the component.
     *
     * @returns {void}
     */
    blur() {
        const me = this;
        if (me.isDisposed || !me._element) return;

        me._fire('willBlur', me);

        me._element.blur();
        me._isFocused = false;

        me._fire('didBlur', me);
    }

    /**
     * Disposes the component and cleans up resources.
     *
     * @returns {void}
     */
    dispose() {
        const me = this;
        if (me.isDisposed) return;

        me._fire('willDispose', me);

        if (me._isMounted) {
            me.unmount();
        }

        if (me._element) {
            me._element = null;
        }

        me._fire('didDispose', me);

        me._emitters.clear();
        super.dispose();
    }

    /**
     * Retrieves or creates an emitter for the specified event key.
     * Implements lazy initialization to save memory.
     *
     * @param {string} key - The unique key for the event (e.g., 'willMount').
     * @returns {Emitter} The emitter instance.
     * @private
     */
    _getEmitter(key) {
        const me = this;
        if (!me._emitters.has(key)) {
            const emitter = new Emitter();
            me.addDisposable(emitter);
            me._emitters.set(key, emitter);
        }
        return me._emitters.get(key);
    }

    /**
     * Safely fires an event if the emitter exists.
     *
     * @param {string} key - The event key.
     * @param {*} [data] - The event data.
     * @returns {void}
     * @private
     */
    _fire(key, data) {
        const me = this;
        const emitter = me._emitters.get(key);
        if (emitter) {
            emitter.fire(data);
        }
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
