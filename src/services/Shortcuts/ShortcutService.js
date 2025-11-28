import { ShortcutRegistry } from './ShortcutRegistry.js';
import { GestureRecognizer } from './GestureRecognizer.js';
import { GamepadManager } from './GamepadManager.js';
import { ShortcutDispatcher } from './ShortcutDispatcher.js';

/**
 * Description:
 * Orchestrator service (Singleton) for shortcut registration and dispatch.
 * This service composes and manages:
 * - ShortcutRegistry: The database of shortcuts.
 * - ShortcutDispatcher: The "brain" that matches tokens to shortcuts.
 * - GestureRecognizer: The input source for touch gestures.
 * - GamepadManager: The input source for gamepad events.
 *
 * This service aligns with the FlexUI architecture by attaching its own DOM
 * listeners directly, rather than using a separate EventManager.
 *
 * Properties summary:
 * - _instance {ShortcutService | null} : The static singleton instance.
 * - _registry {ShortcutRegistry} : Instance of the shortcut registry.
 * - _dispatcher {ShortcutDispatcher} : Instance of the shortcut dispatcher.
 * - _gesture {GestureRecognizer} : Instance of the gesture recognizer.
 * - _gamepad {GamepadManager} : Instance of the gamepad manager.
 * - _enabled {boolean} : Whether the service is actively dispatching.
 * - _boundOnKeyDown {Function | null} : Bound handler for 'keydown'.
 * - _boundOnKeyUp {Function | null} : Bound handler for 'keyup'.
 * - _boundOnPointerDown {Function | null} : Bound handler for 'pointerdown'.
 * - _boundOnWheel {Function | null} : Bound handler for 'wheel'.
 * - _boundOnVisibilityChange {Function | null} : Bound handler for 'visibilitychange'.
 *
 * Typical usage:
 * // In App.js
 * const shortcutService = ShortcutService.getInstance();
 * shortcutService.enable();
 * shortcutService.register({ keys: 'Ctrl+S', command: 'app:save' });
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Singleton pattern.
 * - Centralized management of input sources (Keyboard, Mouse, Touch, Gamepad).
 * - Support for attaching/detaching listeners to specific windows (Popout support).
 *
 * Dependencies:
 * - {import('./ShortcutRegistry.js').ShortcutRegistry}
 * - {import('./GestureRecognizer.js').GestureRecognizer}
 * - {import('./GamepadManager.js').GamepadManager}
 * - {import('./ShortcutDispatcher.js').ShortcutDispatcher}
 */
export class ShortcutService {
    /**
     * The static singleton instance.
     *
     * @type {ShortcutService | null}
     * @private
     */
    static _instance = null;

    /**
     * Instance of the shortcut registry.
     *
     * @type {import('./ShortcutRegistry.js').ShortcutRegistry}
     * @private
     */
    _registry = null;

    /**
     * Instance of the shortcut dispatcher.
     *
     * @type {import('./ShortcutDispatcher.js').ShortcutDispatcher}
     * @private
     */
    _dispatcher = null;

    /**
     * Instance of the gesture recognizer.
     *
     * @type {import('./GestureRecognizer.js').GestureRecognizer}
     * @private
     */
    _gesture = null;

    /**
     * Instance of the gamepad manager.
     *
     * @type {import('./GamepadManager.js').GamepadManager}
     * @private
     */
    _gamepad = null;

    /**
     * Whether the service is actively dispatching.
     *
     * @type {boolean}
     * @private
     */
    _enabled = false;

    /**
     * Bound handler for 'keydown'.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnKeyDown = null;

    /**
     * Bound handler for 'keyup'.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnKeyUp = null;

    /**
     * Bound handler for 'pointerdown'.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnPointerDown = null;

    /**
     * Bound handler for 'wheel'.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnWheel = null;

    /**
     * Bound handler for 'visibilitychange'.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnVisibilityChange = null;

    /**
     * Creates or retrieves the singleton instance of the ShortcutService.
     *
     * @param {object} [options={}] - Configuration options.
     * @param {number} [options.sequenceTimeout=800] - Timeout for key sequences.
     * @param {number} [options.gamepadPollInterval=100] - Poll rate for gamepad.
     * @param {number} [options.gestureThrottleMs=50] - Throttle for gestures.
     */
    constructor(options = {}) {
        if (ShortcutService._instance) {
            return ShortcutService._instance;
        }
        const me = this;

        const sequenceTimeoutDefault = 800;
        const gamepadPollIntervalDefault = 100;
        const gestureThrottleMsDefault = 50;

        const sequenceTimeout = options.sequenceTimeout || sequenceTimeoutDefault;
        const gamepadPollInterval = options.gamepadPollInterval || gamepadPollIntervalDefault;
        const gestureThrottleMs = options.gestureThrottleMs || gestureThrottleMsDefault;

        me._registry = new ShortcutRegistry();
        me._dispatcher = new ShortcutDispatcher({
            registry: me._registry,
            sequenceTimeout: sequenceTimeout
        });

        me._gesture = new GestureRecognizer({
            gestureThrottleMs: gestureThrottleMs,
            onGesture: me._onGesture.bind(me)
        });
        me._gesture.attach();

        me._gamepad = new GamepadManager({
            pollIntervalMs: gamepadPollInterval,
            onButton: me._onGamepadButton.bind(me),
            onAxis: me._onGamepadAxis.bind(me)
        });

        me._boundOnKeyDown = me._onKeyDown.bind(me);
        me._boundOnKeyUp = me._onKeyUp.bind(me);
        me._boundOnPointerDown = me._onPointerDown.bind(me);
        me._boundOnWheel = me._onWheel.bind(me);
        me._boundOnVisibilityChange = me._onVisibilityChange.bind(me);

        me._attachDOMListeners();
        me.enable();

        ShortcutService._instance = this;
    }

    /**
     * Gets the singleton instance of the ShortcutService.
     *
     * @returns {ShortcutService} The singleton instance.
     */
    static getInstance() {
        if (!ShortcutService._instance) {
            ShortcutService._instance = new ShortcutService();
        }
        return ShortcutService._instance;
    }

    /**
     * Registers a new shortcut definition.
     *
     * @param {object} definition - The shortcut definition object.
     * @param {Function} [handler] - The direct callback (if not using `command`).
     * @returns {string} The ID of the registered shortcut.
     */
    register(definition, handler) {
        return this._registry.register(definition, handler);
    }

    /**
     * Unregisters a shortcut by its ID.
     *
     * @param {string} id - The ID returned by `register`.
     * @returns {void}
     */
    unregister(id) {
        this._registry.unregister(id);
    }

    /**
     * Edits properties of an existing shortcut.
     *
     * @param {string} id - The ID of the shortcut to edit.
     * @param {object} newProps - The new properties to merge.
     * @returns {void}
     */
    edit(id, newProps) {
        this._registry.edit(id, newProps);
    }

    /**
     * Lists (cloned) copies of all registered shortcut definitions.
     *
     * @returns {Array<object>} An array of definition objects.
     */
    list() {
        return this._registry.list();
    }

    /**
     * Enables the service to dispatch shortcuts.
     *
     * @returns {void}
     */
    enable() {
        const me = this;
        me._enabled = true;
    }

    /**
     * Disables the service and clears all transient state (pressed keys, sequences).
     *
     * @returns {void}
     */
    disable() {
        const me = this;
        const defaultTimeout = 800;
        me._enabled = false;
        if (me._dispatcher) {
            me._dispatcher.dispose();
            me._dispatcher = new ShortcutDispatcher({
                registry: me._registry,
                sequenceTimeout: me._dispatcher ? me._dispatcher.sequenceTimeout : defaultTimeout
            });
        }
    }

    /**
     * Starts the gamepad polling loop.
     *
     * @returns {void}
     */
    startGamepadPolling() {
        if (this._gamepad) {
            this._gamepad.start();
        }
    }

    /**
     * Stops the gamepad polling loop.
     *
     * @returns {void}
     */
    stopGamepadPolling() {
        if (this._gamepad) {
            this._gamepad.stop();
        }
    }

    /**
     * Attaches shortcut listeners to a specific window object.
     * Useful for Popout windows.
     *
     * @param {Window} targetWindow - The window to attach listeners to.
     * @returns {void}
     */
    attachToWindow(targetWindow) {
        const me = this;
        if (!targetWindow || typeof targetWindow.addEventListener !== 'function') {
            console.warn(
                `[ShortcutService] invalid targetWindow assignment (${targetWindow}). Must be a Window object.`
            );
            return;
        }
        targetWindow.addEventListener('keydown', me._boundOnKeyDown, { passive: false });
        targetWindow.addEventListener('keyup', me._boundOnKeyUp, { passive: true });
        targetWindow.addEventListener('pointerdown', me._boundOnPointerDown, { passive: true });
        targetWindow.addEventListener('wheel', me._boundOnWheel, { passive: false });
    }

    /**
     * Detaches shortcut listeners from a specific window object.
     *
     * @param {Window} targetWindow - The window to detach listeners from.
     * @returns {void}
     */
    detachFromWindow(targetWindow) {
        const me = this;
        if (!targetWindow || typeof targetWindow.removeEventListener !== 'function') {
            console.warn(
                `[ShortcutService] invalid targetWindow assignment (${targetWindow}). Must be a Window object.`
            );
            return;
        }
        targetWindow.removeEventListener('keydown', me._boundOnKeyDown);
        targetWindow.removeEventListener('keyup', me._boundOnKeyUp);
        targetWindow.removeEventListener('pointerdown', me._boundOnPointerDown);
        targetWindow.removeEventListener('wheel', me._boundOnWheel);
    }

    /**
     * Cleans up all listeners and child services.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        me.disable();
        me._detachDOMListeners();

        if (me._gesture) {
            me._gesture.dispose();
            me._gesture = null;
        }
        if (me._gamepad) {
            me._gamepad.dispose();
            me._gamepad = null;
        }
        if (me._dispatcher) {
            me._dispatcher.dispose();
            me._dispatcher = null;
        }
        if (me._registry) {
            me._registry.clear();
            me._registry = null;
        }

        me._boundOnKeyDown = null;
        me._boundOnKeyUp = null;
        me._boundOnPointerDown = null;
        me._boundOnWheel = null;
        me._boundOnVisibilityChange = null;

        ShortcutService._instance = null;
    }

    /**
     * Attaches all necessary DOM event listeners to the main window/document.
     *
     * @private
     * @returns {void}
     */
    _attachDOMListeners() {
        const me = this;
        document.addEventListener('keydown', me._boundOnKeyDown, { passive: false });
        document.addEventListener('keyup', me._boundOnKeyUp, { passive: true });
        document.addEventListener('pointerdown', me._boundOnPointerDown, { passive: true });
        window.addEventListener('wheel', me._boundOnWheel, { passive: false });
        document.addEventListener('visibilitychange', me._boundOnVisibilityChange, {
            passive: true
        });
    }

    /**
     * Removes all attached DOM event listeners from the main window/document.
     *
     * @private
     * @returns {void}
     */
    _detachDOMListeners() {
        const me = this;
        document.removeEventListener('keydown', me._boundOnKeyDown);
        document.removeEventListener('keyup', me._boundOnKeyUp);
        document.removeEventListener('pointerdown', me._boundOnPointerDown);
        window.removeEventListener('wheel', me._boundOnWheel);
        document.removeEventListener('visibilitychange', me._boundOnVisibilityChange);
    }

    /**
     * Handles 'keydown' events, normalizes them, and passes them to the dispatcher.
     *
     * @param {KeyboardEvent} event - The native DOM event.
     * @private
     * @returns {void}
     */
    _onKeyDown(event) {
        const me = this;
        if (!me._enabled) {
            return;
        }

        const modifiers = [];
        if (event.ctrlKey) {
            modifiers.push('Ctrl');
        }
        if (event.shiftKey) {
            modifiers.push('Shift');
        }
        if (event.altKey) {
            modifiers.push('Alt');
        }
        if (event.metaKey) {
            modifiers.push('Meta');
        }

        const base = event.code ? event.code : `Key:${event.key}`;
        const id = (modifiers.length ? modifiers.join('+') + '+' : '') + base;
        const tokenObj = {
            kind: 'keyboard',
            id: id,
            raw: id,
            meta: { key: event.key, code: event.code, modifiers: modifiers }
        };
        me._dispatcher.handleToken(tokenObj, event, { type: 'keyboard' });
    }

    /**
     * Handles 'keyup' events to clear the dispatcher's pressed-key state.
     *
     * @param {KeyboardEvent} event - The native DOM event.
     * @private
     * @returns {void}
     */
    _onKeyUp(event) {
        const me = this;
        if (!me._enabled) {
            return;
        }
        const base = event.code ? event.code : `Key:${event.key}`;
        me._dispatcher.keyUp(base);
    }

    /**
     * Handles 'pointerdown' events (mouse clicks) and normalizes them.
     *
     * @param {PointerEvent} event - The native DOM event.
     * @private
     * @returns {void}
     */
    _onPointerDown(event) {
        const me = this;
        if (!me._enabled) {
            return;
        }

        const modifiers = [];
        if (event.ctrlKey) {
            modifiers.push('Ctrl');
        }
        if (event.shiftKey) {
            modifiers.push('Shift');
        }
        if (event.altKey) {
            modifiers.push('Alt');
        }
        if (event.metaKey) {
            modifiers.push('Meta');
        }

        const modPart = modifiers.length ? modifiers.join('+') + '+' : '';

        let buttonName;
        switch (event.button) {
            case 0:
                buttonName = 'Click';
                break;
            case 1:
                buttonName = 'MiddleClick';
                break;
            case 2:
                buttonName = 'RightClick';
                break;
            default:
                buttonName = `Button${event.button}`;
        }

        const penPart = event.pointerType === 'pen' ? 'Pen+' : '';
        const id = `${modPart}${penPart}${buttonName}`;

        const tokenObj = {
            kind: 'pointer',
            id: id,
            raw: id,
            meta: { pointerType: event.pointerType, button: event.button, modifiers: modifiers }
        };
        me._dispatcher.handleToken(tokenObj, event, { type: 'pointer' });
    }

    /**
     * Handles 'wheel' events and normalizes them.
     *
     * @param {WheelEvent} event - The native DOM event.
     * @private
     * @returns {void}
     */
    _onWheel(event) {
        const me = this;
        if (!me._enabled) {
            return;
        }

        const direction = event.deltaY < 0 ? 'WheelUp' : 'WheelDown';
        const modifiers = [];
        if (event.ctrlKey) {
            modifiers.push('Ctrl');
        }
        if (event.shiftKey) {
            modifiers.push('Shift');
        }
        if (event.altKey) {
            modifiers.push('Alt');
        }
        if (event.metaKey) {
            modifiers.push('Meta');
        }

        const id = (modifiers.length ? modifiers.join('+') + '+' : '') + direction;
        const tokenObj = {
            kind: 'wheel',
            id: id,
            raw: id,
            meta: { deltaY: event.deltaY, modifiers: modifiers }
        };
        me._dispatcher.handleToken(tokenObj, event, {
            type: 'wheel',
            deltaY: event.deltaY
        });
    }

    /**
     * Clears transient state (pressed keys) when the window becomes hidden.
     *
     * @private
     * @returns {void}
     */
    _onVisibilityChange() {
        const me = this;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            me.disable();
            me.enable();
        }
    }

    /**
     * Callback passed to GestureRecognizer.
     *
     * @param {object} payload - The gesture payload { gesture, meta, event }.
     * @private
     * @returns {void}
     */
    _onGesture(payload) {
        const me = this;
        if (!me._enabled) {
            return;
        }
        const { gesture, meta, event } = payload;
        const tokenObj = { kind: 'gesture', id: String(gesture).toLowerCase(), raw: gesture, meta };
        me._dispatcher.handleToken(
            tokenObj,
            event,
            Object.assign({ gesture: gesture }, meta || {})
        );
    }

    /**
     * Callback passed to GamepadManager (button).
     *
     * @param {number} gamepadIndex - Index of the gamepad.
     * @param {number} buttonIndex - Index of the button pressed.
     * @private
     * @returns {void}
     */
    _onGamepadButton(gamepadIndex, buttonIndex) {
        const me = this;
        if (!me._enabled) {
            return;
        }
        const key = `Gamepad:${gamepadIndex}:button:${buttonIndex}`;
        const tokenObj = {
            kind: 'gamepad',
            id: key,
            raw: key,
            meta: { gamepadIndex: gamepadIndex, buttonIndex: buttonIndex }
        };
        me._dispatcher.handleToken(tokenObj, null, {
            type: 'gamepad',
            gamepadIndex: gamepadIndex,
            buttonIndex: buttonIndex
        });
    }

    /**
     * Callback passed to GamepadManager (axis).
     *
     * @param {number} gamepadIndex - Index of the gamepad.
     * @param {number} axisIndex - Index of the axis.
     * @param {number} value - Value of the axis.
     * @private
     * @returns {void}
     */
    _onGamepadAxis(gamepadIndex, axisIndex, value) {
        const me = this;
        if (!me._enabled) {
            return;
        }
        const key = `Gamepad:${gamepadIndex}:axis:${axisIndex}:${value > 0 ? 'pos' : 'neg'}`;
        const tokenObj = {
            kind: 'gamepad',
            id: key,
            raw: key,
            meta: { gamepadIndex: gamepadIndex, axisIndex: axisIndex, value: value }
        };
        me._dispatcher.handleToken(tokenObj, null, {
            type: 'gamepad-axis',
            gamepadIndex: gamepadIndex,
            axisIndex: axisIndex,
            value: value
        });
    }
}
