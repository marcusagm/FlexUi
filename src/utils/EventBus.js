import { debounce } from './Debounce.js';
import { throttleRAF } from './ThrottleRAF.js';

/**
 * Uma classe EventBus genérica para um padrão Pub/Sub.
 *
 * (Refatorado vDND-Bridge-Fix) Evoluído para incluir namespaces,
 * rate limiting declarativo (debounce/throttle) e prevenção
 * de memory leaks.
 */
class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Registra um ouvinte para um evento.
     * @param {string} eventName - O nome do evento.
     * @param {function} callback - A função a ser chamada.
     * @param {object} [options={}] - Opções (namespace, debounceMs, throttleRAF, isOnce).
     */
    on(eventName, callback, options = {}) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }

        let finalCallback = callback;

        // 1. Aplicar Rate Limiting (se solicitado)
        if (options.throttleRAF) {
            finalCallback = throttleRAF(callback);
        } else if (options.debounceMs) {
            finalCallback = debounce(callback, options.debounceMs);
        }
        // (Nota: throttleMs (baseado em timer) não foi implementado conforme plano)

        // 2. Armazena o listener como um objeto
        const listener = {
            callback: finalCallback,
            originalCallback: callback, // Referência para o 'off()' funcionar
            namespace: options.namespace || null,
            isOnce: options.isOnce || false
        };

        this.listeners.get(eventName).push(listener);
    }

    /**
     * Remove um ouvinte de um evento.
     * (MODIFICADO) Agora compara usando o 'originalCallback'.
     * @param {string} eventName - O nome do evento.
     * @param {function} callback - A função original a ser removida.
     */
    off(eventName, callback) {
        if (!this.listeners.has(eventName)) {
            return;
        }

        const eventListeners = this.listeners.get(eventName);
        // (CORREÇÃO) Filtra comparando o callback original
        const filteredListeners = eventListeners.filter(
            listener => listener.originalCallback !== callback
        );

        if (filteredListeners.length === 0) {
            this.listeners.delete(eventName);
        } else {
            this.listeners.set(eventName, filteredListeners);
        }
    }

    /**
     * Emite (dispara) um evento.
     * (MODIFICADO) Itera sobre objetos 'listener' e verifica 'isOnce'.
     * @param {string} eventName - O nome do evento.
     * @param {...any} args - Argumentos a serem passados para os ouvintes.
     */
    emit(eventName, ...args) {
        if (!this.listeners.has(eventName)) {
            return;
        }
        // Linha de log removida

        // Itera sobre uma cópia, caso um callback modifique a lista (ex: `once`)
        const listeners = [...this.listeners.get(eventName)];
        for (const listener of listeners) {
            try {
                console.info(eventName, args);
                listener.callback(...args); // Chama o callback (possivelmente wrapped)
            } catch (e) {
                console.error(`Erro no ouvinte do evento "${eventName}":`, e);
            }

            // (NOVO) Se for 'once', remove-o após a execução
            if (listener.isOnce) {
                this.off(eventName, listener.originalCallback);
            }
        }
    }

    /**
     * Registra um ouvinte que será executado apenas uma vez.
     * (MODIFICADO) Agora passa 'options' para o 'on()'.
     * @param {string} eventName - O nome do evento.
     * @param {function} callback - A função a ser chamada.
     * @param {object} [options={}] - Opções (namespace, debounceMs, throttleRAF).
     */
    once(eventName, callback, options = {}) {
        // (MODIFICADO) Apenas chama 'on' com a flag isOnce
        this.on(eventName, callback, { ...options, isOnce: true });
    }

    /**
     * (NOVO) Remove todos os ouvintes associados a um namespace.
     * @param {string} namespace - O namespace a ser limpo.
     */
    offByNamespace(namespace) {
        if (!namespace) return;

        this.listeners.forEach((listeners, eventName) => {
            const filtered = listeners.filter(l => l.namespace !== namespace);

            if (filtered.length === 0) {
                this.listeners.delete(eventName);
            } else {
                this.listeners.set(eventName, filtered);
            }
        });
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
