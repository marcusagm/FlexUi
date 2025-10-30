import App from './scripts/App.js';

window.addEventListener('DOMContentLoaded', () => {
    try {
        new App();
    } catch (err) {
        console.error('Falha ao iniciar App', err);
        // exibr mensagem de erro amigável ao usuário
    }
});
