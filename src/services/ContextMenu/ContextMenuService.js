import { appBus } from '../../utils/EventBus.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';
import { EventTypes } from '../../constants/EventTypes.js';

/**
 * Description:
 * A Singleton service that manages the creation, display, and lifecycle
 * of dynamic context menus (right-click menus).
 *
 * It attaches a main menu DOM element to the body and dynamically
 * populates it based on the configuration provided by the caller.
 * Submenus are created as separate, independent menu
 * structures (also attached to the body) to escape the main menu's
 * scroll viewport ('overflow: auto').
 *
 * Properties summary:
 * - _instance {ContextMenuService | null} : The private static instance.
 * - _menuElement {HTMLElement} : The main DOM element (<div class="context-menu">).
 * - _listElement {HTMLElement} : The <ul> element that holds the main menu items.
 * - _viewportElement {HTMLElement} : The <div> wrapper for scrolling the main list.
 * - _scrollUpBtn {HTMLElement} : The main menu 'scroll up' button.
 * - _scrollDownBtn {HTMLElement} : The main menu 'scroll down' button.
 * - _activeSubmenus {Map<HTMLElement, HTMLElement>} : Tracks open <li> -> <div> submenu mappings.
 * - _submenuHideTimer {number | null} : The setTimeout ID for delayed submenu closing.
 * - _boundGlobalClick {Function} : The bound listener for closing the menu.
 * - _boundGlobalContextMenu {Function} : The bound listener for context menu prevention.
 * - _scrollIntervals {Map<HTMLElement, number>} : Tracks active scroll intervals (setInterval IDs).
 * - _currentContextDocument {Document | null} : The document where the menu is currently active.
 * - SCROLL_BTN_HEIGHT {number} : The pixel height of one scroll button (CSS).
 * - VIEWPORT_V_PADDING {number} : The total vertical padding of the viewport (CSS).
 * - SUBMENU_HIDE_DELAY {number} : Delay in ms before closing a submenu on mouseleave.
 *
 * Events:
 * - Emits (appBus): EventTypes.CONTEXT_MENU_OPENED
 *
 * Dependencies:
 * - ../../utils/EventBus.js
 * - ../../utils/ThrottleRAF.js
 * - ../../constants/EventTypes.js
 */
export class ContextMenuService {
    /**
     * The private static instance.
     *
     * @type {ContextMenuService | null}
     * @private
     */
    static _instance = null;

    /**
     * The main DOM element (<div class="context-menu">).
     *
     * @type {HTMLElement}
     * @private
     */
    _menuElement = null;

    /**
     * The <ul> element that holds the main menu items.
     *
     * @type {HTMLElement}
     * @private
     */
    _listElement = null;

    /**
     * The <div> wrapper for scrolling the main list.
     *
     * @type {HTMLElement}
     * @private
     */
    _viewportElement = null;

    /**
     * The main menu 'scroll up' button.
     *
     * @type {HTMLElement}
     * @private
     */
    _scrollUpBtn = null;

    /**
     * The main menu 'scroll down' button.
     *
     * @type {HTMLElement}
     * @private
     */
    _scrollDownBtn = null;

    /**
     * Tracks open <li> -> <div> (submenu wrapper) mappings.
     *
     * @type {Map<HTMLElement, HTMLElement>}
     * @private
     */
    _activeSubmenus = new Map();

    /**
     * The setTimeout ID for delayed submenu closing.
     *
     * @type {number | null}
     * @private
     */
    _submenuHideTimer = null;

    /**
     * The bound listener for closing the menu.
     *
     * @type {Function}
     * @private
     */
    _boundGlobalClick = null;

    /**
     * The bound listener for context menu prevention.
     *
     * @type {Function}
     * @private
     */
    _boundGlobalContextMenu = null;

    /**
     * Tracks active scroll intervals (setInterval IDs) keyed by viewport element.
     *
     * @type {Map<HTMLElement, number>}
     * @private
     */
    _scrollIntervals = new Map();

    /**
     * The document where the menu is currently active/attached.
     * Used to remove listeners from the correct window.
     *
     * @type {Document | null}
     * @private
     */
    _currentContextDocument = null;

    /**
     * Height of one scroll button + its border (20px + 1px)
     *
     * @type {number}
     * @private
     */
    SCROLL_BTN_HEIGHT = 21;

    /**
     * Vertical padding of the viewport (4px top + 4px bottom)
     *
     * @type {number}
     * @private
     */
    VIEWPORT_V_PADDING = 8;

    /**
     * Delay in ms before closing a submenu on mouseleave.
     *
     * @type {number}
     * @private
     */
    SUBMENU_HIDE_DELAY = 200;

    /**
     * Description:
     * Private constructor for the Singleton.
     * Initializes the menu DOM structure and listeners.
     *
     * @private
     */
    constructor() {
        if (ContextMenuService._instance) {
            console.warn('ContextMenuService instance already exists. Use getInstance().');
            return ContextMenuService._instance;
        }
        ContextMenuService._instance = this;

        const me = this;
        me._boundGlobalClick = me._onGlobalClick.bind(me);
        me._boundGlobalContextMenu = me._onGlobalContextMenu.bind(me);

        const mainStructure = me._createMenuStructure();
        me._menuElement = mainStructure.wrapper;
        me._listElement = mainStructure.list;
        me._viewportElement = mainStructure.viewport;
        me._scrollUpBtn = mainStructure.upBtn;
        me._scrollDownBtn = mainStructure.downBtn;

        document.body.appendChild(me._menuElement);

        me._initMenuListeners(mainStructure.viewport, mainStructure.upBtn, mainStructure.downBtn);
    }

    /**
     * Description:
     * Gets the single instance of the service.
     *
     * @returns {ContextMenuService} The singleton instance.
     */
    static getInstance() {
        if (!ContextMenuService._instance) {
            ContextMenuService._instance = new ContextMenuService();
        }
        return ContextMenuService._instance;
    }

    /**
     * Description:
     * Creates a complete, self-contained menu DOM structure.
     *
     * @returns {{
     * wrapper: HTMLElement,
     * list: HTMLElement,
     * viewport: HTMLElement,
     * upBtn: HTMLElement,
     * downBtn: HTMLElement
     * }} An object containing the created DOM elements.
     * @private
     */
    _createMenuStructure() {
        const wrapper = document.createElement('div');
        wrapper.className = 'context-menu';

        const upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'context-menu__scroll-btn context-menu__scroll-btn--up';
        upBtn.setAttribute('aria-label', 'Scroll Up');

        const viewport = document.createElement('div');
        viewport.className = 'context-menu__viewport';

        const list = document.createElement('ul');
        list.className = 'context-menu__list';

        const downBtn = document.createElement('button');
        downBtn.type = 'button';
        downBtn.className = 'context-menu__scroll-btn context-menu__scroll-btn--down';
        downBtn.setAttribute('aria-label', 'Scroll Down');

        viewport.appendChild(list);
        wrapper.append(upBtn, viewport, downBtn);

        return { wrapper, list, viewport, upBtn, downBtn };
    }

    /**
     * Description:
     * Attaches scroll-related listeners to a specific menu structure.
     *
     * @param {HTMLElement} viewport - The scrollable container element.
     * @param {HTMLElement} upBtn - The scroll up button element.
     * @param {HTMLElement} downBtn - The scroll down button element.
     * @private
     * @returns {void}
     */
    _initMenuListeners(viewport, upBtn, downBtn) {
        const me = this;
        const throttledUpdate = throttleRAF(() => {
            me._updateScrollButtonsState(viewport, upBtn, downBtn);
        });

        viewport.addEventListener('scroll', throttledUpdate);
        upBtn.addEventListener('mouseenter', () => me._startScroll(-1, viewport, upBtn, downBtn));
        upBtn.addEventListener('mouseleave', () => me._stopScroll(viewport));
        downBtn.addEventListener('mouseenter', () => me._startScroll(1, viewport, upBtn, downBtn));
        downBtn.addEventListener('mouseleave', () => me._stopScroll(viewport));
    }

    /**
     * Description:
     * Handles global clicks to close the menu.
     *
     * @param {MouseEvent} event - The native click event.
     * @private
     * @returns {void}
     */
    _onGlobalClick(event) {
        const me = this;
        if (me._menuElement.style.display === 'none') {
            return;
        }
        if (
            !me._menuElement.contains(event.target) &&
            !event.target.closest('.context-menu__submenu')
        ) {
            me.close();
        }
    }

    /**
     * Description:
     * Closes the active context menu if another one is about to be opened,
     * unless the click is inside the currently open menu.
     *
     * @param {MouseEvent} event - The native contextmenu event.
     * @private
     * @returns {void}
     */
    _onGlobalContextMenu(event) {
        const me = this;
        if (me._menuElement.style.display === 'flex') {
            if (
                !me._menuElement.contains(event.target) &&
                !event.target.closest('.context-menu__submenu')
            ) {
                me.close();
            }
        }
    }

    /**
     * Description:
     * Clears the DOM items from the main menu list.
     *
     * @private
     * @returns {void}
     */
    _clearMenu() {
        this._listElement.innerHTML = '';
    }

    /**
     * Description:
     * Recursively builds the menu item DOM from a JSON structure.
     *
     * @param {Array<object>} items - The array of menu item objects.
     * @param {HTMLElement} parentElement - The <ul> element to append to.
     * @param {object} contextData - The arbitrary data to pass to actions.
     * @private
     * @returns {void}
     */
    _buildMenuRecursive(items, parentElement, contextData) {
        const me = this;
        if (!items || items.length === 0) {
            return;
        }

        items.forEach(item => {
            const listItem = document.createElement('li');

            if (item.isSeparator) {
                listItem.className = 'context-menu__separator';
                parentElement.appendChild(listItem);
                return;
            }

            listItem.className = 'context-menu__item';
            listItem.textContent = item.title;

            if (item.disabled) {
                listItem.classList.add('context-menu__item--disabled');
            }

            if (item.children && item.children.length > 0) {
                listItem.classList.add('context-menu__item--submenu');
                listItem.addEventListener('mouseenter', event => {
                    me._onSubmenuEnter(event, item.children, contextData);
                });
                listItem.addEventListener('mouseleave', () => {
                    me._onSubmenuLeave();
                });
            } else if (!item.disabled) {
                listItem.addEventListener('click', event => {
                    me._handleItemClick(event, item, contextData);
                });
            }

            parentElement.appendChild(listItem);
        });
    }

    /**
     * Description:
     * Handles opening a submenu on mouseenter.
     *
     * @param {MouseEvent} event - The native mouse event.
     * @param {Array<object>} childrenItems - The child items for the new submenu.
     * @param {object} contextData - The context data to pass down.
     * @private
     * @returns {void}
     */
    _onSubmenuEnter(event, childrenItems, contextData) {
        const me = this;
        clearTimeout(me._submenuHideTimer);

        const listItem = event.currentTarget;
        me._closeSubmenus(listItem);

        if (me._activeSubmenus.has(listItem)) {
            return;
        }

        const subStructure = me._createMenuStructure();
        const submenuWrapper = subStructure.wrapper;
        const submenuList = subStructure.list;

        submenuWrapper.classList.add('context-menu__submenu');
        me._buildMenuRecursive(childrenItems, submenuList, contextData);

        if (me._menuElement.ownerDocument) {
            me._menuElement.ownerDocument.body.appendChild(submenuWrapper);
        } else {
            document.body.appendChild(submenuWrapper);
        }

        me._initMenuListeners(subStructure.viewport, subStructure.upBtn, subStructure.downBtn);

        const liRect = listItem.getBoundingClientRect();
        const targetWindow = me._menuElement.ownerDocument.defaultView || window;
        me._positionAndFitMenu(submenuWrapper, 0, 0, true, liRect, targetWindow);

        submenuWrapper.classList.add('context-menu__submenu--visible');
        me._activeSubmenus.set(listItem, submenuWrapper);

        submenuWrapper.addEventListener('mouseenter', () => {
            clearTimeout(me._submenuHideTimer);
        });
        submenuWrapper.addEventListener('mouseleave', () => {
            me._onSubmenuLeave();
        });
    }

    /**
     * Description:
     * Handles starting the timer to close submenus on mouseleave.
     *
     * @private
     * @returns {void}
     */
    _onSubmenuLeave() {
        const me = this;
        clearTimeout(me._submenuHideTimer);
        me._submenuHideTimer = setTimeout(() => {
            me._closeSubmenus();
        }, me.SUBMENU_HIDE_DELAY);
    }

    /**
     * Description:
     * Closes all submenus, or all submenus that are not ancestors
     * of the currently hovered <li>.
     *
     * @param {HTMLElement | null} [currentLi=null] - The <li> currently hovered.
     * @private
     * @returns {void}
     */
    _closeSubmenus(currentLi = null) {
        const me = this;
        const ancestors = new Set();

        if (currentLi) {
            let parentLi = currentLi;
            ancestors.add(parentLi);
            while (parentLi) {
                const parentMenu = parentLi.closest('.context-menu__submenu');
                parentLi = null;
                if (parentMenu) {
                    me._activeSubmenus.forEach((menu, li) => {
                        if (menu === parentMenu) {
                            parentLi = li;
                            ancestors.add(li);
                        }
                    });
                }
            }
        }

        me._activeSubmenus.forEach((submenuEl, li) => {
            if (!ancestors.has(li)) {
                me._stopScroll(submenuEl.querySelector('.context-menu__viewport'));
                submenuEl.remove();
                me._activeSubmenus.delete(li);
            }
        });
    }

    /**
     * Description:
     * Handles the click action on a final menu item.
     *
     * @param {MouseEvent} event - The native click event.
     * @param {object} item - The item configuration object.
     * @param {object} contextData - The data associated with the context.
     * @private
     * @returns {void}
     */
    _handleItemClick(event, item, contextData) {
        const me = this;
        event.preventDefault();
        event.stopPropagation();

        if (item.disabled) {
            return;
        }

        if (typeof item.callback === 'function') {
            item.callback(contextData);
        } else if (typeof item.event === 'string') {
            appBus.emit(item.event, contextData);
        }

        me.close();
    }

    /**
     * Description:
     * Updates the disabled state of scroll buttons based on scroll position.
     *
     * @param {HTMLElement} viewport - The scrollable viewport element.
     * @param {HTMLElement} upBtn - The scroll up button element.
     * @param {HTMLElement} downBtn - The scroll down button element.
     * @private
     * @returns {void}
     */
    _updateScrollButtonsState(viewport, upBtn, downBtn) {
        if (!viewport) {
            return;
        }

        const { scrollTop, scrollHeight, clientHeight } = viewport;

        const isAtTop = scrollTop < 1;
        const isAtBottom = Math.ceil(scrollTop + clientHeight) >= scrollHeight - 1;

        upBtn.classList.toggle('context-menu__scroll-btn--disabled', isAtTop);
        downBtn.classList.toggle('context-menu__scroll-btn--disabled', isAtBottom);
    }

    /**
     * Description:
     * Starts a continuous scroll on hover.
     *
     * @param {number} direction - -1 for up, 1 for down.
     * @param {HTMLElement} viewport - The scrollable viewport.
     * @param {HTMLElement} upBtn - The scroll up button.
     * @param {HTMLElement} downBtn - The scroll down button.
     * @private
     * @returns {void}
     */
    _startScroll(direction, viewport, upBtn, downBtn) {
        const me = this;
        me._stopScroll(viewport);

        const scrollStep = 10;
        const scrollIntervalMs = 50;

        const intervalId = setInterval(() => {
            const currentButton = direction === -1 ? upBtn : downBtn;
            if (currentButton.classList.contains('context-menu__scroll-btn--disabled')) {
                me._stopScroll(viewport);
                return;
            }

            viewport.scrollTop += scrollStep * direction;
        }, scrollIntervalMs);

        me._scrollIntervals.set(viewport, intervalId);
    }

    /**
     * Description:
     * Stops the continuous scroll for a specific viewport.
     *
     * @param {HTMLElement} viewport - The scrollable viewport.
     * @private
     * @returns {void}
     */
    _stopScroll(viewport) {
        const me = this;
        if (viewport && me._scrollIntervals.has(viewport)) {
            clearInterval(me._scrollIntervals.get(viewport));
            me._scrollIntervals.delete(viewport);
        }
    }

    /**
     * Description:
     * Calculates the (x, y) position and max-height for a menu,
     * ensuring it stays within the viewport boundaries of the target window.
     *
     * @param {HTMLElement} menuWrapper - The menu element to position.
     * @param {number} x - The initial clientX (for main menu).
     * @param {number} y - The initial clientY (for main menu).
     * @param {boolean} isSubmenu - If this is a submenu.
     * @param {DOMRect | null} parentRect - The BoundingRect of the parent <li>.
     * @param {Window} targetWindow - The window where the menu is being rendered.
     * @private
     * @returns {void}
     */
    _positionAndFitMenu(menuWrapper, x, y, isSubmenu, parentRect, targetWindow) {
        const me = this;
        const listElement = menuWrapper.querySelector('.context-menu__list');
        const viewportElement = menuWrapper.querySelector('.context-menu__viewport');

        viewportElement.scrollTop = 0;
        menuWrapper.style.maxHeight = 'none';
        menuWrapper.classList.remove('context-menu--scrollable');

        menuWrapper.style.display = 'flex';
        menuWrapper.style.left = '-9999px';
        menuWrapper.style.top = '-9999px';

        const listHeight = listElement.offsetHeight;
        const menuWidth = menuWrapper.offsetWidth;

        const margin = 10;
        const viewportWidth = targetWindow.innerWidth;
        const viewportHeight = targetWindow.innerHeight;

        let availableHeightDown, availableHeightUp, targetY;
        let finalTop, finalLeft, finalMaxHeight;
        let isScrollable = false;

        if (isSubmenu) {
            targetY = parentRect.top;
            availableHeightDown = viewportHeight - parentRect.top - margin;
            availableHeightUp = parentRect.bottom - margin;
        } else {
            targetY = y;
            availableHeightDown = viewportHeight - y - margin;
            availableHeightUp = y - margin;
        }

        const naturalMenuHeight = listHeight + me.VIEWPORT_V_PADDING;
        const scrollMenuHeight = naturalMenuHeight + me.SCROLL_BTN_HEIGHT * 2;
        let requiredHeight = naturalMenuHeight;

        if (naturalMenuHeight > availableHeightDown && naturalMenuHeight > availableHeightUp) {
            isScrollable = true;
            requiredHeight = scrollMenuHeight;
        }

        if (requiredHeight <= availableHeightDown) {
            finalTop = targetY;
            finalMaxHeight = 'none';
        } else if (requiredHeight <= availableHeightUp) {
            finalTop = targetY - requiredHeight;
            finalMaxHeight = 'none';
        } else {
            isScrollable = true;
            if (availableHeightUp > availableHeightDown) {
                finalTop = margin;
                finalMaxHeight = `${availableHeightUp + (targetY - margin)}px`;
            } else {
                finalTop = targetY;
                finalMaxHeight = `${availableHeightDown}px`;
            }
        }

        if (isSubmenu) {
            const spaceRight = viewportWidth - parentRect.right - margin;
            const spaceLeft = parentRect.left - margin;
            if (menuWidth <= spaceRight || spaceRight >= spaceLeft) {
                finalLeft = parentRect.right;
            } else {
                finalLeft = parentRect.left - menuWidth;
            }
        } else {
            if (x + menuWidth > viewportWidth - margin) {
                finalLeft = x - menuWidth;
            } else {
                finalLeft = x;
            }
        }

        finalLeft = Math.max(margin, Math.min(finalLeft, viewportWidth - menuWidth - margin));
        finalTop = Math.max(margin, finalTop);

        menuWrapper.style.maxHeight = finalMaxHeight;
        menuWrapper.classList.toggle('context-menu--scrollable', isScrollable);
        me._updateScrollButtonsState(
            viewportElement,
            menuWrapper.querySelector('.context-menu__scroll-btn--up'),
            menuWrapper.querySelector('.context-menu__scroll-btn--down')
        );

        menuWrapper.style.left = `${finalLeft}px`;
        menuWrapper.style.top = `${finalTop}px`;
    }

    /**
     * Description:
     * Displays the context menu at a specific position.
     * Dynamically moves the menu to the target window (if Popout) and attaches
     * listeners to that specific document.
     *
     * @param {MouseEvent} event - The native 'contextmenu' event.
     * @param {Array<object>} items - The array of item config objects.
     * @param {object} [contextData={}] - Arbitrary data (e.g., the target panel).
     * @returns {void}
     */
    show(event, items, contextData = {}) {
        const me = this;
        event.preventDefault();
        event.stopPropagation();

        me.close();

        const targetWindow = event.view || window;
        const targetDocument = targetWindow.document;

        if (me._menuElement.parentElement !== targetDocument.body) {
            targetDocument.body.appendChild(me._menuElement);
        }

        me._currentContextDocument = targetDocument;

        targetDocument.addEventListener('click', me._boundGlobalClick, true);
        targetDocument.addEventListener('contextmenu', me._boundGlobalContextMenu, true);

        me._clearMenu();
        me._buildMenuRecursive(items, me._listElement, contextData);

        me._positionAndFitMenu(
            me._menuElement,
            event.clientX,
            event.clientY,
            false,
            null,
            targetWindow
        );

        appBus.emit(EventTypes.CONTEXT_MENU_OPENED);
    }

    /**
     * Description:
     * Closes and clears the context menu.
     * Removes listeners from the document where the menu was active.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        me.close();

        if (me._menuElement && me._menuElement.parentElement) {
            me._menuElement.parentElement.removeChild(me._menuElement);
        }
        me._menuElement = null;
        me._listElement = null;
        me._viewportElement = null;
        me._scrollUpBtn = null;
        me._scrollDownBtn = null;
        ContextMenuService._instance = null;
    }

    /**
     * Description:
     * Closes and clears the context menu.
     * Detaches listeners from the current context document.
     *
     * @returns {void}
     */
    close() {
        const me = this;
        clearTimeout(me._submenuHideTimer);
        me._closeSubmenus();

        if (me._menuElement.style.display === 'flex') {
            me._menuElement.style.display = 'none';
            me._stopScroll(me._viewportElement);
            me._clearMenu();
        }

        if (me._currentContextDocument) {
            me._currentContextDocument.removeEventListener('click', me._boundGlobalClick, true);
            me._currentContextDocument.removeEventListener(
                'contextmenu',
                me._boundGlobalContextMenu,
                true
            );
            me._currentContextDocument = null;
        }
    }
}
