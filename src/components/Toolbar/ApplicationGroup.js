import { ToolbarGroup } from './ToolbarGroup.js';
import { appBus } from '../../utils/EventBus.js';
import { EventTypes } from '../../constants/EventTypes.js';

/**
 * Description:
 * A concrete implementation of ToolbarGroup that renders main application
 * action buttons (Add Panel, Save, Restore, Reset).
 *
 * Properties summary:
 * - (Inherits properties from ToolbarGroup)
 *
 * Typical usage:
 * const appGroup = new ApplicationGroup('Actions');
 *
 * Events:
 * - Emits: APP_ADD_NEW_PANEL
 * - Emits: APP_ADD_NEW_WINDOW
 * - Emits: APP_SAVE_STATE
 * - Emits: APP_RESTORE_STATE
 * - Emits: APP_RESET_STATE
 *
 * Business rules implemented:
 * - Defines specific buttons for application-level commands.
 * - Uses 'populate' hook to inject content into the standardized toolbar structure.
 *
 * Dependencies:
 * - {import('./ToolbarGroup.js').ToolbarGroup}
 * - {import('../../utils/EventBus.js').appBus}
 * - {import('../../constants/EventTypes.js').EventTypes}
 */
export class ApplicationGroup extends ToolbarGroup {
    /**
     * Creates a new ApplicationGroup instance.
     *
     * @param {string} [title=''] - The title for the group.
     * @param {object} [config={}] - Configuration overrides (e.g., movable).
     */
    constructor(title = '', config = {}) {
        super(title, config);
        // Note: super() calls ToolbarGroup constructor, which calls render(),
        // which calls populate(). No need to call them here manually.
    }

    /**
     * Returns the unique type identifier for this toolbar group class.
     *
     * @returns {string} The type identifier.
     */
    static get toolbarGroupType() {
        return 'ApplicationGroup';
    }

    /**
     * Returns the type identifier for this instance.
     *
     * @returns {string} The type identifier.
     */
    getToolbarGroupType() {
        return 'ApplicationGroup';
    }

    /**
     * Populates the group content with application buttons.
     * Overrides the abstract method from ToolbarGroup.
     *
     * @returns {void}
     */
    populate() {
        const me = this;
        const contentElement = me.contentElement;

        // Guard clause in case contentElement is not yet available
        if (!contentElement) return;

        const addButton = me._createButton(
            EventTypes.APP_ADD_NEW_PANEL,
            'icon-add-panel',
            'Adicionar Novo Painel'
        );

        const addWindowButton = me._createButton(
            EventTypes.APP_ADD_NEW_WINDOW,
            'icon-add-panel', // Reusing existing icon
            'Novo Documento'
        );

        const saveButton = me._createButton(
            EventTypes.APP_SAVE_STATE,
            'icon-save',
            'Salvar Workspace (Ctrl+S)'
        );
        const restoreButton = me._createButton(
            EventTypes.APP_RESTORE_STATE,
            'icon-restore',
            'Restaurar Workspace (Ctrl+R)'
        );
        const resetButton = me._createButton(
            EventTypes.APP_RESET_STATE,
            'icon-reset',
            'Resetar Workspace (Ctrl+Shift+R)'
        );

        const dividerFirst = me._createDivider();
        const dividerSecond = me._createDivider();

        contentElement.append(
            addButton,
            addWindowButton,
            dividerFirst,
            saveButton,
            restoreButton,
            dividerSecond,
            resetButton
        );
    }

    /**
     * Helper to create a standardized toolbar button.
     *
     * @param {string} eventName - The appBus event to emit on click.
     * @param {string} iconClass - The CSS class for the icon (e.g., 'icon-save').
     * @param {string} title - The tooltip text (aria-label).
     * @returns {HTMLButtonElement} The created button element.
     * @private
     */
    _createButton(eventName, iconClass, title) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'toolbar-button';
        button.setAttribute('aria-label', title);
        button.title = title; // Tooltip
        button.addEventListener('click', () => appBus.emit(eventName));

        const icon = document.createElement('span');
        icon.className = `icon ${iconClass}`;
        button.appendChild(icon);

        return button;
    }

    /**
     * Helper to create a visual divider.
     *
     * @returns {HTMLDivElement} The divider element.
     * @private
     */
    _createDivider() {
        const divider = document.createElement('div');
        divider.className = 'toolbar-divider';
        return divider;
    }
}
