/**
 * Description:
 * Generates the view configuration object for a standard 'prompt' preset.
 * This decouples the view (HTML, buttons, focus logic) from the ModalService.
 *
 * @param {string} message - The message to display in the prompt.
 * @param {string} [defaultValue=''] - The default value for the input.
 * @returns {object} A partial modal options object.
 */
export const PromptView = (message, defaultValue = '') => {
    const inputId = `modal-prompt-input-${Date.now()}`;
    const content = `
      <div class="modal__prompt">
        <label for="${inputId}" class="modal__prompt-label">${message}</label>
        <input type="text" id="${inputId}" class="modal__prompt-input" value="${defaultValue}">
      </div>
    `;

    return {
        content: content,
        size: 'small',
        closeOnBackdropClick: false,
        closeOnEscape: false,
        initialFocus: `#${inputId}`, // Focus the input
        buttons: [
            {
                text: 'Cancel',
                class: 'modal__button modal__button--secondary',
                action: 'resolve',
                value: null
            },
            {
                text: 'OK',
                class: 'modal__button modal__button--primary',
                action: api => {
                    const value = api.contentElement.querySelector('input').value;
                    api.close(value);
                }
            }
        ]
    };
};
