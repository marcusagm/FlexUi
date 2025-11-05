import { App } from './scripts/App.js';
import { TranslationService } from './scripts/Services/TranslationService.js';

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const i18n = TranslationService.getInstance();

        i18n.registerLanguageSource('en', './i18n/en.json');
        i18n.registerLanguageSource('pt', './i18n/pt.json');

        await i18n.loadLanguage('en');
        i18n.defaultLanguage = 'en';

        await i18n.setLanguage('pt');

        const app = new App();
        await app.init();
    } catch (err) {
        console.error('Falha ao iniciar App', err);
        // exibr mensagem de erro amigável ao usuário
    }
});
