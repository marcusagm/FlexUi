import { App } from './src/App.js';
import { TranslationService } from './src/services/TranslationService.js';
import { Loader } from './src/services/Loader/Loader.js';

window.addEventListener('DOMContentLoaded', async () => {
    const i18n = TranslationService.getInstance();
    const appLoader = new Loader(document.body, { type: 'fullpage' });
    let initMessage = 'Initializing Application...';

    try {
        i18n.registerLanguageSource('en', './i18n/en.json');
        i18n.registerLanguageSource('pt', './i18n/pt.json');

        await i18n.loadLanguage('en');
        i18n.defaultLanguage = 'en';

        await i18n.setLanguage('pt');

        initMessage = i18n.translate('actions.initializing');
        appLoader.show(initMessage);

        const app = new App();
        await app.init();
    } catch (err) {
        console.error('Falha ao iniciar App', err);
    } finally {
        appLoader.hide();
    }
});
