/**
 * Represents a submenu item in a menu.
 * @class
 *
 * @param {string} title - The text to display for the submenu item.
 * @param {Function} action - The callback function to execute when the submenu item is clicked.
 *
 * @property {HTMLLIElement} element - The DOM element representing the submenu item.
 */
class Submenu {
    /**
     * Creates a submenu item element with the specified title and click action.
     * @param {string} title - The text to display for the submenu item.
     * @param {Function} action - The callback function to execute when the submenu item is clicked.
     */
    constructor(title, action) {
        this.element = document.createElement('li');
        this.element.classList.add('submenu');
        this.element.textContent = title;
        if (typeof action === 'function') {
            this.element.addEventListener('click', action);
        } else {
            console.warn('Submenu action is not a function:', action);
        }
    }
}

export default Submenu;
