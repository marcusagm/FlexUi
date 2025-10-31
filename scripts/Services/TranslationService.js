/**
 * Description:
 * Manages application-wide translations (i18n).
 *
 * This service is a Singleton. It holds language data, provides a fallback
 * mechanism to a default language (English, by default), and handles
 * key lookups, including nested keys and placeholder substitution.
 *
 * It is now responsible for asynchronously fetching translation files (JSON)
 * from provided URLs.
 *
 * Properties summary:
 * - _translations {Object<string, Object>} : Stores all loaded translation data.
 * - _languageSources {Object<string, string>} : Stores URLs for language files.
 * - _isLoading {Set<string>} : Tracks languages currently being fetched.
 * - _currentLanguage {string} : The active language code (e.g., "pt").
 * - _defaultLanguage {string} : The fallback language code (e.g., "en").
 * - _instance {TranslationService|null} : Static property for the singleton instance.
 *
 * Typical usage:
 * // 1. Get the instance
 * const i18n = TranslationService.getInstance();
 *
 * // 2. Register the *sources* (URLs) for your files
 * i18n.registerLanguageSource('en', './i18n/en.json');
 * i18n.registerLanguageSource('pt', './i18n/pt.json');
 *
 * // 3. Load the default language and set it. This MUST be awaited.
 * await i18n.loadLanguage('en');
 * i18n.defaultLanguage = 'en';
 *
 * // 4. Set the active language (this will also load it if needed)
 * await i18n.setLanguage('pt');
 *
 * // 5. Translate
 * const greeting = i18n.translate('greetings.hello', { name: "Marcus" });
 *
 * Notes / Additional:
 * - All loading operations are asynchronous and return Promises.
 * - The app must `await` at least the default language load before translating.
 */
export class TranslationService {
    /**
     * The singleton instance of the TranslationService.
     * @type {TranslationService|null}
     * @private
     */
    static _instance = null;

    /**
     * Stores all loaded translation key/value pairs, nested by language code.
     * @type {Object<string, Object>}
     * @private
     */
    _translations;

    /**
     * Stores the URL paths to the translation JSON files, keyed by language code.
     * e.g., { en: "/i18n/en.json", pt: "/i18n/pt.json" }
     * @type {Object<string, string>}
     * @private
     */
    _languageSources;

    /**
     * Tracks which language codes are currently being fetched to avoid duplicate requests.
     * @type {Set<string>}
     * @private
     */
    _isLoading;

    /**
     * The currently active language code (e.g., "pt").
     * @type {string}
     * @private
     */
    _currentLanguage;

    /**
     * The fallback language code (e.g., "en").
     * @type {string}
     * @private
     */
    _defaultLanguage;

    /**
     * Constructor for the TranslationService.
     * As this is a singleton, this constructor will throw an error if
     * instantiated directly after the first time.
     * Use TranslationService.getInstance() for access.
     */
    constructor() {
        if (TranslationService._instance) {
            console.warn(
                'TranslationService is a singleton. Returning existing instance. Use TranslationService.getInstance().'
            );
            return TranslationService._instance;
        }

        this._translations = {};
        this._languageSources = {};
        this._isLoading = new Set();

        // Initialize properties via setters per user guidelines
        // This invokes the 'set defaultLanguage(code)' and 'set currentLanguage(code)' methods.
        this.defaultLanguage = 'en';
        this.currentLanguage = 'en';

        TranslationService._instance = this;
    }

    /**
     * Gets the singleton instance of the TranslationService.
     * @returns {TranslationService} The singleton instance.
     */
    static getInstance() {
        if (!TranslationService._instance) {
            TranslationService._instance = new TranslationService();
        }
        return TranslationService._instance;
    }

    // --- Getters and Setters ---

    /**
     * Sets the current active language.
     * @param {string} languageCode - The language code (e.g., "en", "pt-BR").
     */
    set currentLanguage(languageCode) {
        if (typeof languageCode !== 'string' || languageCode.trim().length === 0) {
            console.warn(`TranslationService: Invalid language code. Must be a non-empty string.`);
            return;
        }
        const sanitizedCode = languageCode.trim().toLowerCase();
        this._currentLanguage = sanitizedCode;

        if (!this._translations[sanitizedCode] && this._languageSources[sanitizedCode]) {
            console.warn(
                `TranslationService: Language "${sanitizedCode}" is set, but its data is not loaded yet. Call "await setLanguage('${sanitizedCode}')" to load it.`
            );
        }
    }

    /**
     * Gets the current active language code.
     * @returns {string} The current language code.
     */
    get currentLanguage() {
        return this._currentLanguage;
    }

    /**
     * Sets the default (fallback) language.
     * @param {string} languageCode - The language code (e.g., "en").
     */
    set defaultLanguage(languageCode) {
        if (typeof languageCode !== 'string' || languageCode.trim().length === 0) {
            console.warn(
                `TranslationService: Invalid default language code. Must be a non-empty string.`
            );
            return;
        }
        const sanitizedCode = languageCode.trim().toLowerCase();
        this._defaultLanguage = sanitizedCode;

        if (!this._translations[sanitizedCode] && this._languageSources[sanitizedCode]) {
            console.warn(
                `TranslationService: Default language set to "${sanitizedCode}", but its data is not loaded yet. Call "await loadLanguage('${sanitizedCode}')".`
            );
        }
    }

    /**
     * Gets the default (fallback) language code.
     * @returns {string} The default language code.
     */
    get defaultLanguage() {
        return this._defaultLanguage;
    }

    // --- Concrete Methods ---

    /**
     * Registers the source URL for a language's translation file.
     * This does *not* load the file, it only registers its location.
     * @param {string} languageCode - The language code (e.g., "en").
     * @param {string} url - The URL path to the .json file.
     */
    registerLanguageSource(languageCode, url) {
        if (typeof languageCode !== 'string' || languageCode.trim().length === 0) {
            console.warn(`TranslationService: Cannot register source. Invalid language code.`);
            return;
        }
        if (typeof url !== 'string' || url.trim().length === 0) {
            console.warn(
                `TranslationService: Cannot register source for "${languageCode}". Invalid URL.`
            );
            return;
        }
        const sanitizedCode = languageCode.trim().toLowerCase();
        this._languageSources[sanitizedCode] = url;
    }

    /**
     * Registers translation data directly from an object.
     * This can be used if data is loaded by other means (e.g., hardcoded).
     * @param {string} languageCode - The language code (e.g., "en").
     * @param {object} translationData - The key/value pair object.
     */
    registerLanguage(languageCode, translationData) {
        const me = this;

        if (typeof languageCode !== 'string' || languageCode.trim().length === 0) {
            console.warn(`TranslationService: Cannot register language. Invalid language code.`);
            return;
        }
        if (typeof translationData !== 'object' || translationData === null) {
            console.warn(
                `TranslationService: Cannot register language "${languageCode}". Invalid translation data (must be an object).`
            );
            return;
        }

        const sanitizedCode = languageCode.trim().toLowerCase();
        me._translations[sanitizedCode] = {
            ...me._translations[sanitizedCode],
            ...translationData
        };
    }

    /**
     * Asynchronously loads a language file from its registered source URL.
     * @param {string} languageCode - The code of the language to load (e.g., "en").
     * @returns {Promise<boolean>} A promise that resolves to true if loading
     * was successful (or already loaded), and false if it failed.
     */
    async loadLanguage(languageCode) {
        const me = this;
        const sanitizedCode = languageCode.trim().toLowerCase();

        // 1. Check if already loaded
        if (me._translations[sanitizedCode]) {
            return true;
        }

        // 2. Check if currently being loaded
        if (me._isLoading.has(sanitizedCode)) {
            console.warn(
                `TranslationService: Language "${sanitizedCode}" is already being loaded.`
            );
            // We could return a promise that resolves when loading is done,
            // but for simplicity, we'll just return true.
            return true;
        }

        // 3. Check if a source URL exists
        const languageUrl = me._languageSources[sanitizedCode];
        if (!languageUrl) {
            console.error(
                `TranslationService: Cannot load language "${sanitizedCode}". No source URL has been registered.`
            );
            return false;
        }

        // 4. Start loading
        me._isLoading.add(sanitizedCode);
        try {
            const response = await fetch(languageUrl);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for file ${languageUrl}`);
            }

            const translationData = await response.json();

            // Use the existing register method to store the data
            me.registerLanguage(sanitizedCode, translationData);
            console.log(`TranslationService: Successfully loaded language "${sanitizedCode}".`);
            return true;
        } catch (error) {
            console.error(
                `TranslationService: Failed to load language file for "${sanitizedCode}" from ${languageUrl}.`,
                error
            );
            return false;
        } finally {
            // 5. Finished loading (success or fail)
            me._isLoading.delete(sanitizedCode);
        }
    }

    /**
     * Asynchronously loads a language (if needed) and sets it as the
     * current language. This is the preferred method for changing languages.
     * @param {string} languageCode - The code of the language to set.
     * @returns {Promise<boolean>} A promise that resolves to true if the
     * language was successfully loaded and set, and false otherwise.
     */
    async setLanguage(languageCode) {
        const me = this;
        const sanitizedCode = languageCode.trim().toLowerCase();

        // Load the language (this will be fast if already loaded)
        const success = await me.loadLanguage(sanitizedCode);

        if (success) {
            // Use the setter to update the current language
            me.currentLanguage = sanitizedCode;
        } else {
            console.error(
                `TranslationService: Could not set language "${sanitizedCode}" because it failed to load.`
            );
        }
        return success;
    }

    /**
     * The core translation method.
     * Fetches a translation string for a given key.
     * @param {string} key - The translation key (e.g., "panel.title").
     * @param {object} [substitutions={}] - Optional key/value pairs for placeholder
     * substitution (e.g., { name: "User" }).
     * @returns {string} The translated string, or the key if not found.
     */
    translate(key, substitutions = {}) {
        const me = this;

        if (typeof key !== 'string' || key.trim().length === 0) {
            console.warn(`TranslationService: Invalid translation key provided.`);
            return ''; // Return empty string for invalid key
        }

        // 1. Try to find in current language
        let translation = me._findTranslation(me.currentLanguage, key);

        // 2. If not found, try to find in default language (fallback)
        if (translation === null) {
            translation = me._findTranslation(me.defaultLanguage, key);
        }

        // 3. If still not found, return the key itself as a warning
        if (translation === null) {
            console.warn(
                `TranslationService: Missing translation for key "${key}" in both "${me.currentLanguage}" and default "${me.defaultLanguage}".`
            );
            return key;
        }

        // 4. Perform placeholder substitution
        return me._performSubstitution(translation, substitutions);
    }

    // --- Private Methods ---

    /**
     * Finds a translation string for a key, supporting dot notation for nested objects.
     * @param {string} languageCode - The language to search in.
     * @param {string} key - The key (e.g., "greetings.hello").
     * @returns {string|null} The translation string, or null if not found.
     * @private
     */
    _findTranslation(languageCode, key) {
        const me = this;
        const languageData = me._translations[languageCode];

        if (!languageData) {
            // This is expected if the language hasn't been loaded yet
            return null;
        }

        const keyParts = key.split('.');
        let currentObject = languageData;

        for (const part of keyParts) {
            if (
                currentObject === null ||
                typeof currentObject !== 'object' ||
                !Object.prototype.hasOwnProperty.call(currentObject, part)
            ) {
                return null;
            }
            currentObject = currentObject[part];
        }

        if (typeof currentObject === 'string') {
            return currentObject;
        }

        console.warn(
            `TranslationService: Key "${key}" in language "${languageCode}" resolved to an object, not a final string.`
        );
        return null;
    }

    /**
     * Performs placeholder substitution on a string.
     * @param {string} text - The text containing placeholders like {key}.
     * @param {object} substitutions - The key/value pairs to replace.
     * @returns {string} The string with placeholders replaced.
     * @private
     */
    _performSubstitution(text, substitutions) {
        if (typeof text !== 'string') {
            return text;
        }

        return text.replace(/{(\w+)}/g, (match, placeholderKey) => {
            if (Object.prototype.hasOwnProperty.call(substitutions, placeholderKey)) {
                return substitutions[placeholderKey];
            }
            console.warn(
                `TranslationService: Missing substitution for placeholder "${placeholderKey}" in text: "${text}"`
            );
            return match;
        });
    }
}
