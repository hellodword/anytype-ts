const components = require(`prismjs/components.js`);

const IGNORED_LANGUAGES = ['meta'];

const getLanguages = () =>
    Object.keys(components.languages).filter(x => !IGNORED_LANGUAGES.includes(x));

function getComponentRequirements(lang: string) {
    let result = [];
    const required = components.languages[lang].require || [];
    if (Array.isArray(required)) {
        for (const requiredLang of required) {
            result = result.concat(getComponentRequirements(requiredLang));
        }
    } else {
        result = result.concat(getComponentRequirements(required));
    }
    const optionals = components.languages[lang].optional || [];
    if (Array.isArray(optionals)) {
        for (const optional of optionals) {
            result = result.concat(getComponentRequirements(optional));
        }
    } else {
        result = result.concat(getComponentRequirements(optionals));
    }
    result.push(lang);
    return result;
}

function getPrismLanguagesAndAliases() {
    return getLanguages().map(lang => {
        const aliases = components.languages[lang].alias || [];
        const title = components.languages[lang].title || lang;
        return { id: lang, name: title, aliases: Array.isArray(aliases) ? aliases : [aliases] };
    });
};

export const getPrismComponents = (): string[] => {
    let result = [];
    for (const lang of getLanguages()) {
        result = result.concat(getComponentRequirements(lang));
    }
    return [...new Set(result)];
};

export const prismLanguagesAndAliases = getPrismLanguagesAndAliases();
