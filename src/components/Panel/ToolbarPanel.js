import { Panel } from './Panel.js';
import { appNotifications } from '../../services/Notification/Notification.js';
import { Modal } from '../../services/Modal/Modal.js';

/**
 * Description:
 * A concrete implementation of Panel that displays sample buttons
 * for triggering Notification and Modal services.
 *
 * Properties summary:
 * - (Inherits from Panel)
 *
 * Typical usage:
 * const toolbarPanel = new ToolbarPanel('Tools');
 *
 * Business rules implemented:
 * - Identifies itself as 'ToolbarPanel' to the factory.
 * - Overrides default config to be non-collapsible and non-movable.
 * - Content is static and rebuilt in 'populateContent'.
 * - Does not save/load 'content' in toJSON/fromJSON.
 *
 * Dependencies:
 * - ./Panel.js
 * - ../../services/Notification/Notification.js
 * - ../../services/Modal/Modal.js
 */
export class ToolbarPanel extends Panel {
    /**
     * @param {string} title - The panel title.
     * @param {number|null} [height=null] - The initial height.
     * @param {object} [config={}] - Configuration overrides.
     */
    constructor(title, height = null, config = {}) {
        super(title, height, {
            ...config,
            collapsible: false,
            movable: false,
            minHeight: 50
        });
    }

    /**
     * <panelType> static getter.
     * @returns {string}
     */
    static get panelType() {
        return 'ToolbarPanel';
    }

    /**
     * (Overrides Panel) Populates the content element with demo buttons.
     * @returns {void}
     */
    populateContent() {
        const contentEl = this.getContentElement();
        contentEl.classList.add('panel__content--toolbar');

        const btn1 = document.createElement('button');
        btn1.textContent = 'Info';
        btn1.onclick = () => appNotifications.info('Clicou na info!');

        const btn2 = document.createElement('button');
        btn2.textContent = 'Success';
        btn2.onclick = () => appNotifications.success('Clicou em Success');

        const btn3 = document.createElement('button');
        btn3.textContent = 'Warning';
        btn3.onclick = () => appNotifications.warning('Clicou em Warning');

        const btn4 = document.createElement('button');
        btn4.textContent = 'Danger';
        btn4.onclick = () => {
            appNotifications.danger('Connection lost. Cannot save data.', {
                sticky: true,
                buttons: [
                    {
                        text: 'Retry',
                        cssClass: 'notification__button--ok',
                        onClick: id => {
                            appNotifications.dismiss(id);
                            appNotifications.info('Retrying connection...', { duration: 2000 });
                        }
                    },
                    {
                        text: 'Close',
                        cssClass: 'notification__button--cancel',
                        onClick: id => appNotifications.dismiss(id)
                    }
                ]
            });
        };

        const btn5 = document.createElement('button');
        btn5.textContent = 'Preferencias';
        btn5.onclick = () => {
            Modal.open({
                title: 'Preferências',
                content: 'Teste de janela modal mostrando uma tela para editar preferências.',
                footerText: 'Texto de rodapé'
            });
        };

        contentEl.append(btn1, btn2, btn3, btn4, btn5);
    }

    /**
     * <PanelType> getter.
     * @returns {string}
     */
    getPanelType() {
        return 'ToolbarPanel';
    }

    /**
     * Overrides base method; content is static and should not be set externally.
     * @param {string} htmlString
     * @returns {void}
     */
    setContent(htmlString) {
        // Does nothing. Content is populated by populateContent().
    }

    /**
     * Serializes the Panel's state.
     * @returns {object}
     */
    toJSON() {
        return super.toJSON();
    }

    /**
     * Deserializes state.
     * @param {object} data - The state object.
     * @returns {void}
     */
    fromJSON(data) {
        super.fromJSON(data);
    }
}
