/**
 * Retorna uma função debounced, que atrasa a execução até que tenha
 * passado um certo tempo (delay) sem novas chamadas.
 * @param {function} func - A função a ser executada.
 * @param {number} delay - O tempo de atraso em milissegundos (ex: 200ms).
 * @returns {function} A função debounced.
 */
export const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            // Usa apply para garantir que o contexto (this) e os argumentos sejam passados corretamente
            func.apply(this, args);
        }, delay);
    };
};
