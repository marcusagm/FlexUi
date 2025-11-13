/**
 * Description:
 * Generates the view configuration object for a standard 'alert' preset.
 * This decouples the view (HTML, buttons) from the ModalService logic.
 *
 * @param {string} message - The message to display in the alert.
 * @returns {object} A partial modal options object (content, buttons).
 */
export const AlertView = message => {
    return {
        content: `<p class="modal__preset-text">${message}</p>`,
        size: 'small',
        closeOnBackdropClick: false,
        buttons: [
            {
                text: 'OK',
                class: 'modal__button modal__button--primary',
                action: 'resolve',
                value: true
            }
        ]
    };
};
