import { ToolbarGroup } from './ToolbarGroup.js';
import { appBus } from '../../utils/EventBus.js';
import { EventTypes } from '../../constants/EventTypes.js';

/**
 * Description:
 * A concrete implementation of ToolbarGroup that renders main application
 * action buttons (Add Panel, Save, Restore, Reset).
 *
 * Dependencies:
 * - ./ToolbarGroup.js
 * - ../../utils/EventBus.js
 * - ../../constants/EventTypes.js
 */
export class ApplicationGroup extends ToolbarGroup {
    /**
     * @param {string} [title=''] - The title for the group.
     * @param {object} [config={}] - Configuration overrides (e.g., movable).
     */
    constructor(title = '', config = {}) {
        super(title, config);
        const me = this;
        me.render();
    }

    /**
     * toolbarGroupType static getter.
     *
     * @returns {string}
     */
    static get toolbarGroupType() {
        return 'ApplicationGroup';
    }

    /**
     * ToolbarGroupType getter.
     *
     * @returns {string}
     */
    getToolbarGroupType() {
        return 'ApplicationGroup';
    }

    /**
     * (Overrides ToolbarGroup) Creates the DOM for the buttons.
     *
     * @returns {void}
     */
    render() {
        const me = this;
        const contentEl = me.contentElement;

        const btnAdd = me._createButton(
            EventTypes.APP_ADD_NEW_PANEL,
            'icon-add-panel',
            'Adicionar Novo Painel'
        );
        const btnSave = me._createButton(
            EventTypes.APP_SAVE_STATE,
            'icon-save',
            'Salvar Workspace (Ctrl+S)'
        );
        const btnRestore = me._createButton(
            EventTypes.APP_RESTORE_STATE,
            'icon-restore',
            'Restaurar Workspace (Ctrl+R)'
        );
        const btnReset = me._createButton(
            EventTypes.APP_RESET_STATE,
            'icon-reset',
            'Resetar Workspace (Ctrl+Shift+R)'
        );

        const divider1 = me._createDivider();
        const divider2 = me._createDivider();

        contentEl.append(btnAdd, divider1, btnSave, btnRestore, divider2, btnReset);
    }

    /**
     * Helper to create a standardized toolbar button.
     *
     * @param {string} eventName - The appBus event to emit on click.
     * @param {string} iconClass - The CSS class for the icon (e.g., 'icon-save').
     * @param {string} title - The tooltip text (aria-label).
     * @returns {HTMLButtonElement}
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
     * @returns {HTMLDivElement}
     * @private
     */
    _createDivider() {
        const divider = document.createElement('div');
        divider.className = 'toolbar-divider';
        return divider;
    }
}
