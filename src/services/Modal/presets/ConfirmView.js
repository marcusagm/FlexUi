/**
 * Description:
 * Generates the view configuration object for a standard 'confirm' preset.
 * This decouples the view (HTML, buttons) from the ModalService logic.
 *
 * @param {string} message - The message to display in the confirmation.
 * @returns {object} A partial modal options object (content, buttons).
 */
export const ConfirmView = message => {
    return {
        content: `<p class="modal__preset-text">${message}</p>`,
        size: 'small',
        closeOnBackdropClick: false,
        closeOnEscape: false,
        buttons: [
            {
                text: 'Cancel',
                class: 'modal__button modal__button--secondary',
                action: 'resolve',
                value: false
            },
            {
                text: 'OK',
                class: 'modal__button modal__button--primary',
                action: 'resolve',
                value: true
            }
        ]
    };
};
