/**
 * Uma classe EventBus genérica para um padrão Pub/Sub.
 */
class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Registra um ouvinte para um evento.
     * @param {string} eventName - O nome do evento.
     * @param {function} callback - A função a ser chamada.
     */
    on(eventName, callback) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }
        this.listeners.get(eventName).push(callback);
    }

    /**
     * Remove um ouvinte de um evento.
     * @param {string} eventName - O nome do evento.
     * @param {function} callback - A função a ser removida.
     */
    off(eventName, callback) {
        if (!this.listeners.has(eventName)) {
            return; // Ninguém ouvindo este evento
        }

        const eventListeners = this.listeners.get(eventName);
        // Filtra, mantendo todos os listeners EXCETO o callback a ser removido
        const filteredListeners = eventListeners.filter(listener => listener !== callback);

        if (filteredListeners.length === 0) {
            this.listeners.delete(eventName); // Limpa se for o último
        } else {
            this.listeners.set(eventName, filteredListeners);
        }
    }

    /**
     * Emite (dispara) um evento.
     * @param {string} eventName - O nome do evento.
     * @param {...any} args - Argumentos a serem passados para os ouvintes.
     */
    emit(eventName, ...args) {
        if (!this.listeners.has(eventName)) {
            return; // Ninguém ouvindo, não faz nada
        }
        console.info('Evento:' + eventName);

        // Itera sobre uma cópia, caso um callback modifique a lista (ex: `off`)
        const listeners = [...this.listeners.get(eventName)];
        for (const callback of listeners) {
            try {
                // Chama o callback com os argumentos passados
                callback(...args);
            } catch (e) {
                console.error(`Erro no ouvinte do evento "${eventName}":`, e);
            }
        }
    }

    /**
     * Registra um ouvinte que será executado apenas uma vez.
     * @param {string} eventName - O nome do evento.
     * @param {function} callback - A função a ser chamada.
     */
    once(eventName, callback) {
        // Cria um callback wrapper
        const wrapperCallback = (...args) => {
            // 1. Chama o callback original
            callback(...args);
            // 2. Remove a si mesmo
            this.off(eventName, wrapperCallback);
        };
        // 3. Registra o wrapper
        this.on(eventName, wrapperCallback);
    }

    /**
     * Remove todos os ouvintes de todos os eventos.
     * Útil para um teardown completo da aplicação.
     */
    clear() {
        this.listeners.clear();
    }
}

/**
 * Instância singleton do EventBus para ser usada em toda a aplicação.
 */
export const appBus = new EventBus();
