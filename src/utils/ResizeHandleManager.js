import { ResizeController } from './ResizeController.js';

/**
 * Enumeration of all 8 resize directions.
 *
 * @private
 * @type {Readonly<Object<string, string>>}
 */
const DIRECTIONS = Object.freeze({
    NORTH: 'n',
    SOUTH: 's',
    EAST: 'e',
    WEST: 'w',
    NORTHEAST: 'ne',
    NORTHWEST: 'nw',
    SOUTHEAST: 'se',
    SOUTHWEST: 'sw'
});

/**
 * Utility mapping resize direction to CSS cursor property.
 *
 * @private
 * @type {Readonly<Object<string, string>>}
 */
const CURSOR_MAP = Object.freeze({
    [DIRECTIONS.NORTH]: 'ns-resize',
    [DIRECTIONS.SOUTH]: 'ns-resize',
    [DIRECTIONS.EAST]: 'ew-resize',
    [DIRECTIONS.WEST]: 'ew-resize',
    [DIRECTIONS.NORTHEAST]: 'nesw-resize',
    [DIRECTIONS.NORTHWEST]: 'nwse-resize',
    [DIRECTIONS.SOUTHEAST]: 'nwse-resize',
    [DIRECTIONS.SOUTHWEST]: 'nesw-resize'
});

/**
 * Description:
 * Manages the creation, attachment, and logic for 8-directional resizing
 * handles on a target DOM element. This manager applies size and boundary
 * constraints (clamping) during the resize operation, coordinating with
 * the ResizeController utility.
 *
 * It is designed to be agnostic, handling the low-level resize mathematics
 * and state propagation via the `onResize` callback.
 *
 * Properties summary:
 * - _targetElement {HTMLElement} : The DOM element being resized.
 * - _options {object} : Configuration options including callbacks and constraints.
 * - _handles {Map<string, object>} : Map of created handles and their controllers.
 * - _initialGeometry {object|null} : Starting position and size before resize.
 *
 * Typical usage:
 * const manager = new ResizeHandleManager(myElement, {
 * handles: ['n', 's', 'e', 'w', 'se'],
 * getConstraints: () => ({
 * minimumWidth: 100,
 * maximumHeight: 500,
 * containerRectangle: myContainer.getBoundingClientRect()
 * }),
 * onResize: (geometry) => {
 * myElement.style.width = `${geometry.width}px`;
 * }
 * });
 *
 * Dependencies:
 * - {import('./ResizeController.js').ResizeController}
 */
export class ResizeHandleManager {
    /**
     * The DOM element being resized.
     *
     * @type {HTMLElement}
     * @private
     */
    _targetElement = null;

    /**
     * Configuration options including callbacks and constraints.
     *
     * @type {object}
     * @private
     */
    _options = {};

    /**
     * Map of created handles and their controllers.
     * Stores objects shaped { element: HTMLElement, controller: ResizeController }.
     *
     * @type {Map<string, object>}
     * @private
     */
    _handles = new Map();

    /**
     * Starting position and size before resize.
     *
     * @type {{xCoordinate: number, yCoordinate: number, width: number, height: number} | null}
     * @private
     */
    _initialGeometry = null;

    /**
     * Creates an instance of ResizeHandleManager.
     *
     * @param {HTMLElement} targetElement - The target HTML element to resize.
     * @param {object} options - Configuration options.
     * @param {Array<string>} options.handles - Array of direction strings to create handles for (e.g., ['n', 'se']).
     * @param {Function} [options.getConstraints] - Function returning current resize limits. Expected return: `{ minimumWidth, maximumWidth, minimumHeight, maximumHeight, containerRectangle }`.
     * @param {Function} options.onResize - Callback fired after calculation. Receives: `{ xCoordinate, yCoordinate, width, height }`.
     * @param {string} [options.customClass=''] - Optional CSS class to add to all handles.
     * @throws {Error} If targetElement is missing.
     */
    constructor(targetElement, options) {
        const me = this;

        if (!targetElement) {
            throw new Error('ResizeHandleManager: targetElement is required.');
        }

        me._targetElement = targetElement;
        me._options = {
            handles: [],
            getConstraints: () => ({
                minimumWidth: 0,
                maximumWidth: Infinity,
                minimumHeight: 0,
                maximumHeight: Infinity,
                containerRectangle: null
            }),
            onResize: () => {},
            customClass: '',
            ...options
        };

        if (typeof me._options.onResize !== 'function') {
            console.error(
                'ResizeHandleManager: The onResize option is mandatory and must be a function.'
            );
            return;
        }

        me._createHandles();
    }

    /**
     * Cleans up all created handles, controllers, and DOM elements.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        me._handles.forEach(handle => {
            handle.controller.destroy();
            handle.element.remove();
        });
        me._handles.clear();
        me._targetElement = null;
        me._initialGeometry = null;
    }

    /**
     * Calculates and returns the element's current position and dimensions.
     * Considers offsetParent scrolling and position for accurate absolute positioning calculations.
     *
     * @returns {{xCoordinate: number, yCoordinate: number, width: number, height: number}} The current geometry.
     * @private
     */
    _calculateInitialGeometry() {
        const me = this;
        const boundingRectangle = me._targetElement.getBoundingClientRect();
        const parentRectangle = me._targetElement.offsetParent
            ? me._targetElement.offsetParent.getBoundingClientRect()
            : { left: 0, top: 0, scrollLeft: 0, scrollTop: 0 };

        const xCoordinate =
            boundingRectangle.left -
            parentRectangle.left +
            (me._targetElement.offsetParent?.scrollLeft || 0);
        const yCoordinate =
            boundingRectangle.top -
            parentRectangle.top +
            (me._targetElement.offsetParent?.scrollTop || 0);

        return {
            xCoordinate: xCoordinate,
            yCoordinate: yCoordinate,
            width: me._targetElement.offsetWidth,
            height: me._targetElement.offsetHeight
        };
    }

    /**
     * Creates the DOM elements for the handles and sets up the ResizeController for each.
     *
     * @returns {void}
     * @private
     */
    _createHandles() {
        const me = this;

        me._options.handles.forEach(direction => {
            const handleElement = document.createElement('div');
            handleElement.classList.add('resize-handle', `resize-handle--${direction}`);
            handleElement.style.cursor = CURSOR_MAP[direction];

            if (me._options.customClass) {
                handleElement.classList.add(me._options.customClass);
            }

            const controller = new ResizeController(handleElement, 'both', {
                onStart: () => {
                    me._initialGeometry = me._calculateInitialGeometry();
                },
                onUpdate: (deltaX, deltaY) => {
                    me._handleResizeUpdate(direction, deltaX, deltaY);
                },
                onEnd: () => {
                    me._initialGeometry = null;
                }
            });

            handleElement.addEventListener('pointerdown', event => {
                controller.start(event);
            });

            me._targetElement.appendChild(handleElement);
            me._handles.set(direction, { element: handleElement, controller });
        });
    }

    /**
     * Applies the complex resize logic: calculates the new geometry, applies size constraints
     * (min/max width/height), and enforces boundary checks (containerRectangle).
     *
     * @param {string} direction - The resize direction (e.g., 'n', 'se').
     * @param {number} deltaX - The horizontal mouse displacement.
     * @param {number} deltaY - The vertical mouse displacement.
     * @returns {void}
     * @private
     */
    _handleResizeUpdate(direction, deltaX, deltaY) {
        const me = this;
        if (!me._initialGeometry) {
            return;
        }

        const initial = me._initialGeometry;
        const { minimumWidth, maximumWidth, minimumHeight, maximumHeight, containerRectangle } =
            me._options.getConstraints();

        let newXCoordinate = initial.xCoordinate;
        let newYCoordinate = initial.yCoordinate;
        let newWidth = initial.width;
        let newHeight = initial.height;

        const isNorthDirection = direction.includes(DIRECTIONS.NORTH);
        const isSouthDirection = direction.includes(DIRECTIONS.SOUTH);
        const isEastDirection = direction.includes(DIRECTIONS.EAST);
        const isWestDirection = direction.includes(DIRECTIONS.WEST);

        if (isNorthDirection) {
            newHeight = initial.height - deltaY;
            newYCoordinate = initial.yCoordinate + deltaY;
        } else if (isSouthDirection) {
            newHeight = initial.height + deltaY;
        }

        if (isWestDirection) {
            newWidth = initial.width - deltaX;
            newXCoordinate = initial.xCoordinate + deltaX;
        } else if (isEastDirection) {
            newWidth = initial.width + deltaX;
        }

        const finalWidth = Math.max(minimumWidth, Math.min(newWidth, maximumWidth));
        const finalHeight = Math.max(minimumHeight, Math.min(newHeight, maximumHeight));

        if (isWestDirection) {
            newXCoordinate = initial.xCoordinate + (initial.width - finalWidth);
        }

        if (isNorthDirection) {
            newYCoordinate = initial.yCoordinate + (initial.height - finalHeight);
        }

        if (containerRectangle) {
            const containerWidth = containerRectangle.width;
            const containerHeight = containerRectangle.height;

            newXCoordinate = Math.max(0, newXCoordinate);
            newYCoordinate = Math.max(0, newYCoordinate);

            const spaceRight = containerWidth - newXCoordinate;
            const spaceBottom = containerHeight - newYCoordinate;

            newWidth = Math.min(finalWidth, spaceRight);
            newHeight = Math.min(finalHeight, spaceBottom);

            const maxXCoordinate = containerWidth - newWidth;
            const maxYCoordinate = containerHeight - newHeight;

            newXCoordinate = Math.min(newXCoordinate, maxXCoordinate);
            newYCoordinate = Math.min(newYCoordinate, maxYCoordinate);
        } else {
            newWidth = finalWidth;
            newHeight = finalHeight;
        }

        me._options.onResize({
            xCoordinate: newXCoordinate,
            yCoordinate: newYCoordinate,
            width: newWidth,
            height: newHeight
        });
    }
}
