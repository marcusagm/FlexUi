import { PanelGroupHeader } from './PanelGroupHeader.js';
import { PanelFactory } from './PanelFactory.js';
import { Panel } from './Panel.js';
import { appBus } from '../../utils/EventBus.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';
import { generateId } from '../../utils/generateId.js';

/**
 * Description:
 * Manages a group of Panel (tabs) within a Column. This class acts as an
 * "Orchestrator" for its child Panel components. It does not render tabs
 * itself; instead, it retrieves the header element (the tab) and the content
 * element from each child Panel and appends them to its own internal
 * containers (TabContainer and ContentContainer).
 *
 * Properties summary:
 * - _state {object} : Internal state (child Panels, layout, parent Column).
 * - element {HTMLElement} : The main DOM element (<div class="panel-group">).
 * - id {string} : Unique ID for this instance.
 * - _namespace {string} : Unique namespace for appBus listeners (uses this.id).
 *
 * Typical usage:
 * // In Column.js
 * const panel = new TextPanel(...);
 * const panelGroup = new PanelGroup(panel);
 * column.addPanelGroup(panelGroup);
 *
 * Events:
 * - Listens to: 'panel:group-child-close-request' (from PanelHeader via Panel)
 * - Listens to: 'panel:close-request' (from PanelGroupHeader)
 * - Listens to: 'panel:toggle-collapse-request' (from PanelGroupHeader)
 * - Emits: 'panelgroup:removed' (when closed or empty)
 * - Emits: 'layout:panel-groups-changed' (to notify LayoutService)
 *
 * Business rules implemented:
 * - Orchestrates Panel DOM (header vs. content).
 * - Manages active tab state ('setActive').
 * - Renders in "simple mode" (no tabs) if only one child Panel exists.
 * - Manages its own vertical resize ('startResize').
 * - Enforces 'canCollapse' rule (must not be the last visible group).
 * - If last Panel is removed, destroys itself ('removePanel' -> 'close').
 *
 * Dependencies:
 * - ./PanelGroupHeader.js
 * - ./PanelFactory.js
 * - ./Panel.js
 * - ../../utils/EventBus.js
 * - ../../utils/ThrottleRAF.js
 * - ../../utils/generateId.js
 */
export class PanelGroup {
    /**
     * @type {{
     * column: import('../Column/Column.js').Column | null,
     * header: PanelGroupHeader | null,
     * contentContainer: HTMLElement | null,
     * panels: Array<Panel>,
     * activePanel: Panel | null,
     * collapsed: boolean,
     * height: number | null,
     * minHeight: number,
     * closable: boolean,
     * collapsible: boolean,
     * movable: boolean,
     * title: string | null
     * }}
     * @private
     */
    _state = {
        column: null,
        header: null,
        contentContainer: null,
        panels: [],
        activePanel: null,
        collapsed: false,
        height: null,
        minHeight: 100,
        closable: true,
        collapsible: true,
        movable: true,
        hasTitle: true,
        title: null
    };

    /**
     * Unique ID for this PanelGroup instance.
     * Also used as the appBus namespace.
     * @type {string}
     * @public
     */
    id = generateId();

    /**
     * Unique namespace for appBus listeners.
     * @type {string}
     * @private
     */
    _namespace = this.id;

    /**
     * The throttled (rAF) update function for resizing.
     * @type {Function | null}
     * @private
     */
    _throttledUpdate = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnChildCloseRequest = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnCloseRequest = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnToggleCollapseRequest = null;

    /**
     * @param {Panel | null} [initialPanel=null] - The optional first panel.
     * @param {number|null} [height=null] - The initial height of the group.
     * @param {boolean} [collapsed=false] - The initial collapsed state.
     * @param {object} [config={}] - Configuration overrides for the group.
     */
    constructor(initialPanel = null, height = null, collapsed = false, config = {}) {
        const me = this;
        Object.assign(me._state, config);

        me.dropZoneType = 'TabContainer';

        me._state.contentContainer = document.createElement('div');
        me._state.contentContainer.classList.add('panel-group__content');

        me._state.contentContainer.addEventListener('dragenter', e => e.stopPropagation());
        me._state.contentContainer.addEventListener('dragover', e => e.stopPropagation());
        me._state.contentContainer.addEventListener('dragleave', e => e.stopPropagation());
        me._state.contentContainer.addEventListener('drop', e => e.stopPropagation());

        me._state.collapsed = collapsed;
        me.element = document.createElement('div');
        me.element.classList.add('panel-group');
        me.element.classList.add('panel');

        me._state.header = new PanelGroupHeader(me);

        if (height !== null) {
            me._state.height = height;
        }

        me._boundOnChildCloseRequest = me.onChildCloseRequest.bind(me);
        me._boundOnCloseRequest = me.onCloseRequest.bind(me);
        me._boundOnToggleCollapseRequest = me.onToggleCollapseRequest.bind(me);

        me.build();

        if (initialPanel) {
            me.addPanel(initialPanel, true);
        }

        me.initEventListeners();

        me.setThrottledUpdate(
            throttleRAF(() => {
                me.updateHeight();
            })
        );
    }

    /**
     * <ThrottledUpdate> setter.
     * @param {Function} throttledFunction
     * @returns {void}
     */
    setThrottledUpdate(throttledFunction) {
        this._throttledUpdate = throttledFunction;
    }

    /**
     * <ThrottledUpdate> getter.
     * @returns {Function | null}
     */
    getThrottledUpdate() {
        return this._throttledUpdate;
    }

    /**
     * <HeaderHeight> getter.
     * @returns {number} The height of the header element.
     */
    getHeaderHeight() {
        return this._state.header ? this._state.header.element.offsetHeight : 0;
    }

    /**
     * <MinPanelHeight> getter.
     * @returns {number} The calculated minimum panel height.
     */
    getMinPanelHeight() {
        const me = this;
        const headerHeight = me.getHeaderHeight();
        const activeMinHeight = me._state.activePanel
            ? me._state.activePanel.getMinPanelHeight()
            : 0;

        return Math.max(me._state.minHeight, activeMinHeight) + headerHeight;
    }

    /**
     * <ParentColumn> setter.
     * @param {import('../Column/Column.js').Column} column - The parent column instance.
     * @returns {void}
     */
    setParentColumn(column) {
        this._state.column = column;
    }

    /**
     * <Column> getter.
     * @returns {import('../Column/Column.js').Column | null}
     */
    getColumn() {
        return this._state.column;
    }

    /**
     * Initializes appBus event listeners for this component.
     * @returns {void}
     */
    initEventListeners() {
        const me = this;
        const options = { namespace: me._namespace };

        appBus.on('panel:group-child-close-request', me._boundOnChildCloseRequest, options);
        appBus.on('panel:close-request', me._boundOnCloseRequest, options);
        appBus.on('panel:toggle-collapse-request', me._boundOnToggleCollapseRequest, options);
    }

    /**
     * Event handler for when a child Panel (tab) requests to close.
     * @param {object} eventData
     * @param {Panel} eventData.panel - The child Panel.
     * @param {PanelGroup} eventData.group - The parent PanelGroup.
     * @returns {void}
     */
    onChildCloseRequest({ panel, group }) {
        if (group === this && this._state.panels.includes(panel)) {
            this.removePanel(panel);
        }
    }

    /**
     * Event handler for when this entire PanelGroup requests to close.
     * @param {Panel | PanelGroup} panel
     * @returns {void}
     */
    onCloseRequest(panel) {
        if (panel === this) {
            this.close();
        }
    }

    /**
     * Event handler to toggle the collapse state of this PanelGroup.
     * @param {Panel | PanelGroup} panel
     * @returns {void}
     */
    onToggleCollapseRequest(panel) {
        if (panel === this) {
            this.toggleCollapse();
        }
    }

    /**
     * Cleans up appBus listeners and destroys child components.
     * @returns {void}
     */
    destroy() {
        const me = this;
        appBus.offByNamespace(me._namespace);

        me._state.header?.destroy();
        me._state.panels.forEach(panel => panel.destroy());
        me.getThrottledUpdate()?.cancel();
    }

    /**
     * Builds the component's main DOM structure.
     * @returns {void}
     */
    build() {
        const me = this;
        me.resizeHandle = document.createElement('div');
        me.resizeHandle.classList.add('panel-group__resize-handle');
        me.resizeHandle.addEventListener('mousedown', me.startResize.bind(me));

        me.element.append(me._state.header.element, me._state.contentContainer, me.resizeHandle);

        if (!me._state.movable) {
            me.element.classList.add('panel--not-movable');
        }

        me.updateCollapse();
    }

    /**
     * Gets the panel type identifier.
     * @returns {string}
     */
    getPanelType() {
        return 'PanelGroup';
    }

    /**
     * Checks if this panel group is allowed to collapse.
     * @returns {boolean}
     */
    canCollapse() {
        const me = this;
        if (!me._state.column) return false;
        if (!me._state.collapsible) return false;

        const uncollapsedGroups = me._state.column.getPanelGroupsUncollapsed();
        return uncollapsedGroups.length > 1 || me._state.collapsed;
    }

    /**
     * Toggles the collapse state and requests a layout update.
     * @returns {void}
     */
    toggleCollapse() {
        const me = this;
        if (me._state.collapsed) {
            me.unCollapse();
        } else {
            if (!me.canCollapse()) {
                return;
            }
            me.collapse();
        }

        me.requestLayoutUpdate();
    }

    /**
     * Applies the correct visibility state based on the internal state.
     * @returns {void}
     */
    updateCollapse() {
        const me = this;
        if (me._state.collapsed) {
            me.collapse();
        } else {
            me.unCollapse();
        }
    }

    /**
     * Hides the content and applies collapsed styles.
     * @returns {void}
     */
    collapse() {
        const me = this;
        me._state.collapsed = true;
        me.element.classList.add('panel--collapsed');
        me._state.contentContainer.style.display = 'none';
        me.resizeHandle.style.display = 'none';
        me.updateHeight();
    }

    /**
     * Shows the content and removes collapsed styles.
     * @returns {void}
     */
    unCollapse() {
        const me = this;
        me._state.collapsed = false;
        me.element.classList.remove('panel--collapsed');
        me._state.contentContainer.style.display = '';
        me.resizeHandle.style.display = '';
        me.updateHeight();
    }

    /**
     * Closes the entire PanelGroup and notifies its parent Column.
     * @returns {void}
     */
    close() {
        const me = this;
        if (!me._state.closable) return;

        appBus.emit('panelgroup:removed', { panel: me, column: me._state.column });
        me.destroy();
    }

    /**
     * Updates the CSS height/flex properties based on the current state.
     * @returns {void}
     */
    updateHeight() {
        const me = this;
        if (me._state.collapsed) {
            me.element.style.height = 'auto';
            me.element.style.flex = '0 0 auto';
            me.element.classList.add('panel--collapsed');
            me.element.style.minHeight = 'auto';

            if (me._state.header) {
                me._state.header.updateScrollButtons();
            }
            return;
        }

        me.element.classList.remove('panel--collapsed');

        const minPanelHeight = me.getMinPanelHeight();
        me.element.style.minHeight = `${minPanelHeight}px`;

        if (me._state.height !== null) {
            me.element.style.height = `${me._state.height}px`;
            me.element.style.flex = '0 0 auto';
        } else {
            me.element.style.height = 'auto';
            me.element.style.flex = '0 0 auto';
        }

        if (me._state.header) {
            me._state.header.updateScrollButtons();
        }
    }

    /**
     * Handles the start of a vertical resize drag for this PanelGroup.
     * @param {MouseEvent} e - The mousedown event.
     * @returns {void}
     */
    startResize(e) {
        e.preventDefault();
        const me = this;
        const startY = e.clientY;
        const startH = me.element.offsetHeight;

        const minPanelHeight = me.getMinPanelHeight();

        const onMove = ev => {
            const delta = ev.clientY - startY;
            me._state.height = Math.max(minPanelHeight, startH + delta);
            me.getThrottledUpdate()();
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('mouseleave', onUp);

            me.getThrottledUpdate()?.cancel();
            me.requestLayoutUpdate();
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('mouseleave', onUp);
    }

    /**
     * Updates the header's visual mode (simple vs. tabs).
     * @private
     * @returns {void}
     */
    _updateHeaderMode() {
        const me = this;
        if (!me._state.header) return;

        const isSimpleMode = me._state.panels.length === 1;

        me._state.header.element.classList.toggle('panel-group__header--simple', isSimpleMode);

        if (isSimpleMode && me._state.panels.length === 1) {
            const panel = me._state.panels[0];
            me._state.header.collapseBtn.style.display =
                panel._state.collapsible && me._state.collapsible ? '' : 'none';
            me._state.header.closeBtn.style.display =
                panel._state.closable && me._state.closable ? '' : 'none';
            me._state.header.moveHandle.style.display =
                panel._state.movable && me._state.movable ? '' : 'none';
        } else {
            me._state.header.collapseBtn.style.display = me._state.collapsible ? '' : 'none';
            me._state.header.closeBtn.style.display = me._state.closable ? '' : 'none';
            me._state.header.moveHandle.style.display = me._state.movable ? '' : 'none';
        }
    }

    /**
     * Adds a child Panel (tab) to this group.
     * @param {Panel} panel - The panel instance to add.
     * @param {boolean} [makeActive=false] - Whether to make this panel active.
     * @returns {void}
     */
    addPanel(panel, makeActive = false) {
        const me = this;
        if (!panel || !(panel instanceof Panel)) {
            console.warn('PanelGroup.addPanel: item is not an instance of Panel.', panel);
            return;
        }
        if (me._state.panels.includes(panel)) {
            if (makeActive) me.setActive(panel);
            return;
        }

        const currentPanelCount = me._state.panels.length;

        if (currentPanelCount === 0) {
            panel._state.header.setMode(true);
        } else if (currentPanelCount === 1) {
            me._state.panels[0]._state.header.setMode(false);
            panel._state.header.setMode(false);
        } else {
            panel._state.header.setMode(false);
        }

        me._state.panels.push(panel);
        panel.setParentGroup(me);

        me._state.header.tabContainer.appendChild(panel._state.header.element);
        me._state.contentContainer.appendChild(panel.getContentElement());

        me._updateHeaderMode();
        me._state.header.updateScrollButtons();

        if (makeActive || me._state.panels.length === 1) {
            me.setActive(panel);
        } else {
            panel.getContentElement().style.display = 'none';
            me.requestLayoutUpdate();
        }
    }

    /**
     * Removes a child Panel (tab) from this group.
     * @param {Panel} panel - The panel instance to remove.
     * @returns {void}
     */
    removePanel(panel) {
        const me = this;
        const index = me._state.panels.indexOf(panel);
        if (index === -1) return;

        panel._state.header.element.classList.remove('panel-group__tab--active');
        panel._state.header.element.remove();
        panel.getContentElement().remove();

        me._state.panels.splice(index, 1);
        panel.setParentGroup(null);

        const newPanelCount = me._state.panels.length;
        if (newPanelCount === 1) {
            const remainingPanel = me._state.panels[0];
            remainingPanel._state.header.setMode(true);
            me.setActive(remainingPanel);
        }

        me._updateHeaderMode();
        me._state.header.updateScrollButtons();

        if (me._state.panels.length === 0) {
            me.close();
            return;
        }

        if (panel === me._state.activePanel) {
            const newActive = me._state.panels[index] || me._state.panels[index - 1];
            me.setActive(newActive);
        } else {
            if (newPanelCount > 1) {
                me.requestLayoutUpdate();
            }
        }
    }

    /**
     * Sets a child Panel (tab) as the active one, showing its content.
     * @param {Panel} panel - The panel instance to activate.
     * @returns {void}
     */
    setActive(panel) {
        const me = this;
        if (!panel) return;

        const isSimpleMode = me._state.panels.length === 1;

        me._state.panels.forEach(p => {
            p._state.header.element.classList.remove('panel-group__tab--active');
            p.getContentElement().style.display = 'none';
        });

        if (!isSimpleMode) {
            panel._state.header.element.classList.add('panel-group__tab--active');
        }

        panel.getContentElement().style.display = '';

        me._state.activePanel = panel;
        me._state.title = panel._state.title;
        me._state.header.updateAriaLabels();

        me.requestLayoutUpdate();
    }

    /**
     * Emits an event to the LayoutService if this group is attached to a column.
     * @returns {void}
     */
    requestLayoutUpdate() {
        const column = this.getColumn();
        if (column) {
            appBus.emit('layout:panel-groups-changed', column);
        }
    }

    /**
     * Serializes the PanelGroup state (and its child Panels) to JSON.
     * @returns {object}
     */
    toJSON() {
        const me = this;
        return {
            id: me.id,
            type: me.getPanelType(),
            height: me._state.height,
            collapsed: me._state.collapsed,
            activePanelId: me._state.activePanel ? me._state.activePanel.id : null,
            config: {
                closable: me._state.closable,
                collapsible: me._state.collapsible,
                movable: me._state.movable,
                minHeight: me._state.minHeight
            },
            panels: me._state.panels.map(panel => panel.toJSON())
        };
    }

    /**
     * Deserializes state from JSON data.
     * @param {object} data - The state object.
     * @returns {void}
     */
    fromJSON(data) {
        const me = this;
        if (data.id) {
            me.id = data.id;
            me._namespace = me.id;
        }
        if (data.height !== undefined) {
            me._state.height = data.height;
        }
        if (data.collapsed !== undefined) {
            me._state.collapsed = data.collapsed;
        }
        if (data.config) {
            Object.assign(me._state, data.config);
        }

        const activePanelId = data.activePanelId;
        let activePanelInstance = null;

        if (data.panels && Array.isArray(data.panels)) {
            const factory = PanelFactory.getInstance();

            data.panels.forEach(panelData => {
                const panel = factory.createPanel(panelData);

                if (panel) {
                    me.addPanel(panel, false);
                    if (panel.id === activePanelId) {
                        activePanelInstance = panel;
                    }
                }
            });
        }

        if (!activePanelInstance && me._state.panels.length > 0) {
            activePanelInstance = me._state.panels[0];
        }

        if (activePanelInstance) {
            me.setActive(activePanelInstance);
        }

        me.updateHeight();
        me.updateCollapse();
    }
}
