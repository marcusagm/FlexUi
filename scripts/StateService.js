import { appBus } from './EventBus.js';

/**
 * Serviço responsável por persistir e restaurar o estado do PanelContainer.
 * Escuta eventos de salvamento/restauração e delega a lógica de persistência.
 */
export class StateService {
    constructor(container) {
        this.container = container;
        this.STORAGE_KEY = 'panel_state';

        // O StateService escuta os eventos de persistência
        this.initEventListeners();
    }

    initEventListeners() {
        appBus.on('app:save-state', this.saveState.bind(this));
        // Note: restoreState apenas remove o estado e pede ao App para re-inicializar
        appBus.on('app:restore-state', this.restoreState.bind(this));
    }

    /**
     * Carrega o estado salvo ou inicializa o layout padrão.
     * @param {function} defaultInitializer - A função que inicializa o layout padrão (App.initDefault).
     */
    loadState(defaultInitializer) {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try {
                // Usa o método restoreFromState do Container
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
        alert('Estado salvo com sucesso!'); // Feedback simples para o usuário
    }

    /**
     * Remove o estado do localStorage e solicita ao App para limpar/re-inicializar.
     */
    restoreState() {
        localStorage.removeItem(this.STORAGE_KEY);
        this.container.clear();

        // Solicita ao App.js que recrie o layout padrão
        appBus.emit('app:reinitialize-default-layout');
    }
}
