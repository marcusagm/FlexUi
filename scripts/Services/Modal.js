import { ModalService } from './ModalService.js';

// Export the singleton instance
export const Modal = ModalService.getInstance();
Modal.setDefaultOptions({
    backdrop: 'blur'
});
