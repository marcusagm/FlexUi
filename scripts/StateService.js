/**
 * Serviço responsável por persistir e restaurar o estado da aplicação.
 * (REFATORADO) Agora é um serviço genérico e passivo (Singleton) que
 * apenas lê e escreve no localStorage. A orquestração é feita pelo App.js.
 * (REFATORADO v2) Agora carrega o 'workspaces/default.json' como fallback.
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
     * Carrega e analisa dados do localStorage, ou carrega o padrão
     * de 'workspaces/default.json' como fallback.
     * @param {string} key - A chave para buscar no localStorage.
     * @returns {Promise<object | null>} O objeto de workspace analisado ou nulo se falhar.
     */
    async loadState(key) {
        const saved = localStorage.getItem(key);

        if (saved) {
            try {
                // Tenta carregar do localStorage primeiro
                return JSON.parse(saved);
            } catch (e) {
                // Se estiver corrompido, loga o erro mas continua para carregar o padrão
                console.error(
                    'Falha ao carregar estado do localStorage (dados corrompidos). Carregando o padrão.',
                    e
                );
                // Continua para o fallback (abaixo)
            }
        }

        // Se 'saved' for nulo ou corrompido, carrega o JSON padrão
        try {
            // (ALTERADO DE WARN PARA INFO)
            console.info(
                `StateService: Nenhum estado salvo encontrado (key: ${key}). Carregando 'workspaces/default.json'.`
            );

            // O caminho é relativo à raiz (index.html)
            const response = await fetch('workspaces/default.json');

            if (!response.ok) {
                throw new Error(`Falha ao buscar default.json: ${response.statusText}`);
            }
            const defaultWorkspace = await response.json();
            return defaultWorkspace;
        } catch (fetchError) {
            console.error(
                'Falha crítica ao carregar o workspace padrão (default.json).',
                fetchError
            );
            return null; // A aplicação terá que lidar com um estado nulo
        }
    }

    /**
     * Salva dados no localStorage.
     * (Obs: Este método não precisa mudar, pois ele salva
     * qualquer objeto que o App.js enviar)
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
