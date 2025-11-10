import { Panel } from './Panel.js';
import { appNotifications } from '../../services/Notification/Notification.js';
import { Modal } from '../../services/Modal/Modal.js';

export class ToolbarPanel extends Panel {
    constructor(title, height = null, collapsed = false) {
        super(title, height, collapsed, {
            closable: true,
            collapsible: false,
            movable: false,
            minHeight: 50
        });
    }

    /**
     * (NOVO) Retorna o identificador de tipo estático para o PanelFactory.
     * @returns {string}
     */
    static get panelType() {
        return 'ToolbarPanel';
    }

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

    getPanelType() {
        return 'ToolbarPanel';
    }

    setContent(htmlString) {
        // Não faz nada. O painel se recria sozinho.
    }

    toJSON() {
        const panelData = super.toJSON();
        const newData = {
            ...panelData
        };
        return newData;
    }

    fromJSON(data) {
        super.fromJSON(data);
    }
}
