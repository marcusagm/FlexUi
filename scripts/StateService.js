import { appBus } from './EventBus.js';
import { appNotifications } from './Services/Notification/Notification.js';
import { TranslationService } from './Services/TranslationService.js';

/**
 * Serviço responsável por persistir e restaurar o estado do PanelContainer.
 * Escuta eventos de salvamento/restauração e delega a lógica de persistência.
 */
export class StateService {
    constructor(container) {
        this.container = container;
        this.STORAGE_KEY = 'panel_state';

        this.initEventListeners();
    }

    initEventListeners() {
        appBus.on('app:save-state', this.saveState.bind(this));
        appBus.on('app:restore-state', this.restoreSavedState.bind(this));
        appBus.on('app:reset-state', this.resetDefaultState.bind(this));
    }

    /**
     * Carrega o estado salvo ou inicializa o layout padrão.
     * @param {function} defaultInitializer - A função que inicializa o layout padrão (App.initDefault).
     */
    loadState(defaultInitializer) {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try {
                this.container.restoreFromState(JSON.parse(saved));
            } catch (e) {
                console.error(
                    'Falha ao carregar estado do localStorage (dados corrompidos). Restaurando padrão.',
                    e
                );
                defaultInitializer();
            }
        } else {
            defaultInitializer();
        }
    }

    /**
     * Salva o estado atual do container no localStorage.
     */
    saveState() {
        const stateData = this.container.getState();
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stateData));
        const i18n = TranslationService.getInstance();
        appNotifications.success(i18n.translate('appstate.save'));
    }

    /**
     * Carrega o estado salvo do localStorage e o aplica.
     */
    restoreSavedState() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        const i18n = TranslationService.getInstance();

        if (saved) {
            try {
                this.container.restoreFromState(JSON.parse(saved));
                appNotifications.success(i18n.translate('appstate.restore'));
            } catch (e) {
                console.error('Falha ao carregar estado do localStorage (dados corrompidos).', e);
                appNotifications.danger(i18n.translate('appstate.restore_fail'));
            }
        } else {
            appNotifications.info(i18n.translate('appstate.no_save'));
        }
    }

    /**
     * Remove o estado do localStorage e solicita ao App para limpar/re-inicializar (Reset).
     */
    resetDefaultState() {
        localStorage.removeItem(this.STORAGE_KEY);
        this.container.clear();
        appBus.emit('app:reinitialize-default-layout');
    }
}
