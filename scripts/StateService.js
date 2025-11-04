/**
 * Serviço responsável por persistir e restaurar o estado da aplicação.
 * (REFATORADO) Agora é um serviço genérico e passivo (Singleton) que
 * apenas lê e escreve no localStorage. A orquestração é feita pelo App.js.
 */
export class StateService {
    /**
     * @type {StateService | null}
     * @private
     */
    static _instance = null;

    /**
     * @private
     */
    constructor() {
        if (StateService._instance) {
            console.warn('StateService instance already exists. Use getInstance().');
            return StateService._instance;
        }
        StateService._instance = this;
    }

    /**
     * Obtém a instância Singleton do serviço.
     * @returns {StateService}
     */
    static getInstance() {
        if (!StateService._instance) {
            StateService._instance = new StateService();
        }
        return StateService._instance;
    }

    /**
     * Carrega e analisa dados do localStorage.
     * @param {string} key - A chave para buscar no localStorage.
     * @returns {object | null} O objeto analisado ou nulo se falhar.
     */
    loadState(key) {
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error(
                    'Falha ao carregar estado do localStorage (dados corrompidos). Retornando nulo.',
                    e
                );
                return null;
            }
        }
        return null;
    }

    /**
     * Salva dados no localStorage.
     * @param {string} key - A chave para salvar.
     * @param {object} data - O objeto (estado) a ser salvo (será stringificado).
     */
    saveState(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error('Falha ao salvar estado no localStorage.', e);
        }
    }

    /**
     * Remove uma chave do localStorage.
     * @param {string} key - A chave a ser removida.
     */
    clearState(key) {
        localStorage.removeItem(key);
    }
}
