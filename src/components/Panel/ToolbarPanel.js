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
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Identifies itself as 'ToolbarPanel' to the factory.
 * - Overrides default config to be non-collapsible and non-movable via constructor.
 * - Content is static and rebuilt in 'populate'.
 * - Does not save/load 'content' in toJSON/fromJSON.
 *
 * Dependencies:
 * - {import('./Panel.js').Panel}
 * - {import('../../services/Notification/Notification.js').appNotifications}
 * - {import('../../services/Modal/Modal.js').Modal}
 * - {import('../../core/IRenderer.js').IRenderer}
 */
export class ToolbarPanel extends Panel {
    /**
     * Creates a new ToolbarPanel instance.
     *
     * @param {string} title - The panel title.
     * @param {number|null} [height=null] - The initial height.
     * @param {object} [config={}] - Configuration overrides.
     * @param {import('../../core/IRenderer.js').IRenderer} [renderer=null] - Optional renderer adapter.
     */
    constructor(title, height = null, config = {}, renderer = null) {
        super(
            title,
            height,
            {
                ...config,
                collapsible: false,
                movable: false,
                minHeight: 75
            },
            renderer
        );
        // super() calls render() -> populate()
    }

    /**
     * Returns the unique type identifier for this panel class.
     *
     * @returns {string} The type identifier.
     */
    static get panelType() {
        return 'ToolbarPanel';
    }

    /**
     * Returns the instance type identifier.
     *
     * @returns {string} The type identifier string.
     */
    getPanelType() {
        return 'ToolbarPanel';
    }

    /**
     * (Overrides Panel.populate) Populates the content element with demo buttons.
     *
     * @returns {void}
     */
    populate() {
        const me = this;
        const contentElement = me.contentElement;

        // Safety check
        if (!contentElement) return;

        contentElement.classList.add('panel__content--toolbar');

        const infoButton = document.createElement('button');
        infoButton.textContent = 'Info';
        infoButton.onclick = () => appNotifications.info('Clicou na info!');

        const successButton = document.createElement('button');
        successButton.textContent = 'Success';
        successButton.onclick = () => appNotifications.success('Clicou em Success');

        const warningButton = document.createElement('button');
        warningButton.textContent = 'Warning';
        warningButton.onclick = () => appNotifications.warning('Clicou em Warning');

        const dangerButton = document.createElement('button');
        dangerButton.textContent = 'Danger';
        dangerButton.onclick = () => {
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

        const modalButton = document.createElement('button');
        modalButton.textContent = 'Modal';
        modalButton.onclick = () => {
            Modal.open({
                title: 'Modal',
                content: 'Teste de janela modal comum.',
                footerText: 'Texto de rodapé'
            });
        };

        const alertButton = document.createElement('button');
        alertButton.textContent = 'Alert';
        alertButton.onclick = () => {
            Modal.alert('Exemplo de alerta', 'Alerta');
        };

        const confirmButton = document.createElement('button');
        confirmButton.textContent = 'Confirm';
        confirmButton.onclick = () => {
            Modal.confirm('Are you sure you want to continue?', 'Confirmation');
        };

        const promptButton = document.createElement('button');
        promptButton.textContent = 'Prompt';
        promptButton.onclick = () => {
            Modal.prompt('What is your name?', 'Prompt', 'Anonymous');
        };

        contentElement.append(
            infoButton,
            successButton,
            warningButton,
            dangerButton,
            modalButton,
            alertButton,
            confirmButton,
            promptButton
        );
    }

    /**
     * Overrides base method; content is static and should not be set externally.
     *
     * @param {string} htmlString - The HTML content.
     * @returns {void}
     */
    setContent(htmlString) {
        // Does nothing to prevent overwriting the toolbar buttons.
        // Content is populated exclusively by populate().
    }

    /**
     * Serializes the Panel's state.
     *
     * @returns {object} The serialized data.
     */
    toJSON() {
        return super.toJSON();
    }

    /**
     * Deserializes state.
     *
     * @param {object} data - The state object.
     * @returns {void}
     */
    fromJSON(data) {
        super.fromJSON(data);
    }
}
