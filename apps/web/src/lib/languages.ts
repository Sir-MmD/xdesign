// The languages a design can have (docs/plan/03 section 1, 04 section 3): the list of the New
// design dialog and the editor's languages (LANG-01), each with its name in English and in its
// own script. Copied from xWriter's internal/lang/languages.json (CLDR 48.2) with the codes in
// lower case, as Telegram sends them in `language_code` ("en", "fa", "pt-br"), and with its flag
// (FLAG-01, docs/plan/16 section 3: make gen writes styles/flags.gen.css from the `flag` fields).
// The search is xWriter's (web/src/lib/languages.ts).

/** One language of the list. */
export interface Language {
  /** The code in lower case: "en", "fa", "pt-br", "zh-hans". */
  code: string
  /** The name in English: "Persian". */
  english: string
  /** The name in the language itself: "فارسی". */
  native: string
  /**
   * xWriter's flag-icons code of its flag: "ir", "arab". None where a country flag would be
   * wrong ("eo", "la"): LanguageFlag shows a globe.
   */
  flag?: string
  /** Written right to left. */
  rtl?: true
  /** Other names it is searched by: "Farsi". */
  aliases?: readonly string[]
}

/** Every language, sorted by English name. */
export const languages: readonly Language[] = [
  { code: 'af', english: 'Afrikaans', native: 'Afrikaans', flag: 'za' },
  { code: 'ak', english: 'Akan', native: 'Akan', flag: 'gh' },
  { code: 'sq', english: 'Albanian', native: 'Shqip', flag: 'al' },
  { code: 'en-us', english: 'American English', native: 'American English', flag: 'us' },
  { code: 'am', english: 'Amharic', native: 'አማርኛ', flag: 'et' },
  { code: 'blo', english: 'Anii', native: 'Anii kagɩja', flag: 'bj' },
  { code: 'ar', english: 'Arabic', native: 'العربية', flag: 'arab', rtl: true },
  { code: 'hy', english: 'Armenian', native: 'Հայերեն', flag: 'am' },
  { code: 'as', english: 'Assamese', native: 'অসমীয়া', flag: 'in' },
  { code: 'az', english: 'Azerbaijani', native: 'Azərbaycan', flag: 'az' },
  { code: 'bn', english: 'Bangla', native: 'বাংলা', flag: 'bd' },
  { code: 'ba', english: 'Bashkir', native: 'Башҡорт', flag: 'ru' },
  { code: 'eu', english: 'Basque', native: 'Euskara', flag: 'es-pv' },
  { code: 'be', english: 'Belarusian', native: 'Беларуская', flag: 'by' },
  { code: 'bs', english: 'Bosnian', native: 'Bosanski', flag: 'ba' },
  { code: 'pt-br', english: 'Brazilian Portuguese', native: 'Português (Brasil)', flag: 'br' },
  { code: 'br', english: 'Breton', native: 'Brezhoneg', flag: 'fr' },
  { code: 'en-gb', english: 'British English', native: 'British English', flag: 'gb' },
  { code: 'bg', english: 'Bulgarian', native: 'Български', flag: 'bg' },
  { code: 'my', english: 'Burmese', native: 'မြန်မာ', flag: 'mm' },
  { code: 'yue', english: 'Cantonese', native: '粵語', flag: 'hk' },
  { code: 'ca', english: 'Catalan', native: 'Català', flag: 'es-ct' },
  { code: 'ceb', english: 'Cebuano', native: 'Cebuano', flag: 'ph' },
  { code: 'ckb', english: 'Central Kurdish', native: 'کوردیی ناوەندی', rtl: true, aliases: ['Sorani'] },
  { code: 'chr', english: 'Cherokee', native: 'ᏣᎳᎩ', flag: 'us' },
  { code: 'zh', english: 'Chinese', native: '中文', flag: 'cn' },
  { code: 'cv', english: 'Chuvash', native: 'Чӑваш чӗлхи', flag: 'ru' },
  { code: 'hr', english: 'Croatian', native: 'Hrvatski', flag: 'hr' },
  { code: 'cs', english: 'Czech', native: 'Čeština', flag: 'cz' },
  { code: 'da', english: 'Danish', native: 'Dansk', flag: 'dk' },
  { code: 'dv', english: 'Divehi', native: 'ދިވެހިބަސް', flag: 'mv', rtl: true },
  { code: 'nl', english: 'Dutch', native: 'Nederlands', flag: 'nl' },
  { code: 'en', english: 'English', native: 'English', flag: 'us' },
  { code: 'eo', english: 'Esperanto', native: 'Esperanto' },
  { code: 'et', english: 'Estonian', native: 'Eesti', flag: 'ee' },
  { code: 'pt-pt', english: 'European Portuguese', native: 'Português europeu', flag: 'pt' },
  { code: 'es-es', english: 'European Spanish', native: 'Español de España', flag: 'es' },
  { code: 'fo', english: 'Faroese', native: 'Føroyskt', flag: 'fo' },
  { code: 'fil', english: 'Filipino', native: 'Filipino', flag: 'ph', aliases: ['Tagalog'] },
  { code: 'fi', english: 'Finnish', native: 'Suomi', flag: 'fi' },
  { code: 'fr', english: 'French', native: 'Français', flag: 'fr' },
  { code: 'gl', english: 'Galician', native: 'Galego', flag: 'es-ga' },
  { code: 'ka', english: 'Georgian', native: 'ქართული', flag: 'ge' },
  { code: 'de', english: 'German', native: 'Deutsch', flag: 'de' },
  { code: 'el', english: 'Greek', native: 'Ελληνικά', flag: 'gr' },
  { code: 'gu', english: 'Gujarati', native: 'ગુજરાતી', flag: 'in' },
  { code: 'ht', english: 'Haitian Creole', native: 'Kreyòl Ayisyen', flag: 'ht' },
  { code: 'ha', english: 'Hausa', native: 'Hausa', flag: 'ng' },
  { code: 'he', english: 'Hebrew', native: 'עברית', flag: 'il', rtl: true, aliases: ['Ivrit'] },
  { code: 'hi', english: 'Hindi', native: 'हिन्दी', flag: 'in' },
  { code: 'hu', english: 'Hungarian', native: 'Magyar', flag: 'hu' },
  { code: 'is', english: 'Icelandic', native: 'Íslenska', flag: 'is' },
  { code: 'ig', english: 'Igbo', native: 'Igbo', flag: 'ng' },
  { code: 'id', english: 'Indonesian', native: 'Indonesia', flag: 'id', aliases: ['Bahasa Indonesia'] },
  { code: 'ia', english: 'Interlingua', native: 'Interlingua' },
  { code: 'ga', english: 'Irish', native: 'Gaeilge', flag: 'ie' },
  { code: 'it', english: 'Italian', native: 'Italiano', flag: 'it' },
  { code: 'ja', english: 'Japanese', native: '日本語', flag: 'jp' },
  { code: 'jv', english: 'Javanese', native: 'Jawa', flag: 'id' },
  { code: 'kn', english: 'Kannada', native: 'ಕನ್ನಡ', flag: 'in' },
  { code: 'kk', english: 'Kazakh', native: 'Қазақ тілі', flag: 'kz' },
  { code: 'km', english: 'Khmer', native: 'ខ្មែរ', flag: 'kh' },
  { code: 'kok', english: 'Konkani', native: 'कोंकणी', flag: 'in' },
  { code: 'ko', english: 'Korean', native: '한국어', flag: 'kr' },
  { code: 'ku', english: 'Kurdish', native: 'Kurdî (kurmancî)', aliases: ['Kurmanji'] },
  { code: 'ky', english: 'Kyrgyz', native: 'Кыргызча', flag: 'kg' },
  { code: 'lo', english: 'Lao', native: 'ລາວ', flag: 'la' },
  { code: 'la', english: 'Latin', native: 'Latina' },
  { code: 'es-419', english: 'Latin American Spanish', native: 'Español latinoamericano' },
  { code: 'lv', english: 'Latvian', native: 'Latviešu', flag: 'lv' },
  { code: 'lt', english: 'Lithuanian', native: 'Lietuvių', flag: 'lt' },
  { code: 'dsb', english: 'Lower Sorbian', native: 'Dolnoserbšćina', flag: 'de' },
  { code: 'mk', english: 'Macedonian', native: 'Македонски', flag: 'mk' },
  { code: 'ms', english: 'Malay', native: 'Melayu', flag: 'my', aliases: ['Bahasa Melayu'] },
  { code: 'ml', english: 'Malayalam', native: 'മലയാളം', flag: 'in' },
  { code: 'mi', english: 'Māori', native: 'Māori', flag: 'nz' },
  { code: 'mr', english: 'Marathi', native: 'मराठी', flag: 'in' },
  { code: 'mn', english: 'Mongolian', native: 'Монгол', flag: 'mn' },
  { code: 'ne', english: 'Nepali', native: 'नेपाली', flag: 'np' },
  { code: 'pcm', english: 'Nigerian Pidgin', native: 'Naijíriá Píjin', flag: 'ng' },
  { code: 'no', english: 'Norwegian', native: 'Norsk', flag: 'no', aliases: ['Bokmal'] },
  { code: 'nb', english: 'Norwegian Bokmål', native: 'Norsk bokmål', flag: 'no', aliases: ['Norwegian', 'Bokmal'] },
  { code: 'nn', english: 'Norwegian Nynorsk', native: 'Norsk nynorsk', flag: 'no' },
  { code: 'or', english: 'Odia', native: 'ଓଡ଼ିଆ', flag: 'in' },
  { code: 'ps', english: 'Pashto', native: 'پښتو', flag: 'af', rtl: true },
  { code: 'fa', english: 'Persian', native: 'فارسی', flag: 'ir', rtl: true, aliases: ['Farsi'] },
  { code: 'pl', english: 'Polish', native: 'Polski', flag: 'pl' },
  { code: 'pt', english: 'Portuguese', native: 'Português', flag: 'br' },
  { code: 'pa', english: 'Punjabi', native: 'ਪੰਜਾਬੀ', flag: 'in', aliases: ['Panjabi'] },
  { code: 'qu', english: 'Quechua', native: 'Runasimi', flag: 'pe' },
  { code: 'ro', english: 'Romanian', native: 'Română', flag: 'ro' },
  { code: 'rm', english: 'Romansh', native: 'Rumantsch', flag: 'ch' },
  { code: 'ru', english: 'Russian', native: 'Русский', flag: 'ru' },
  { code: 'sc', english: 'Sardinian', native: 'Sardu', flag: 'it' },
  { code: 'gd', english: 'Scottish Gaelic', native: 'Gàidhlig', flag: 'gb-sct' },
  { code: 'sr', english: 'Serbian', native: 'Српски', flag: 'rs' },
  { code: 'sr-cyrl', english: 'Serbian (Cyrillic)', native: 'Српски (ћирилица)', flag: 'rs' },
  { code: 'sr-latn', english: 'Serbian (Latin)', native: 'Srpski (latinica)', flag: 'rs', aliases: ['Serbian Latin'] },
  { code: 'shn', english: 'Shan', native: 'တႆး', flag: 'mm' },
  {
    code: 'zh-hans',
    english: 'Simplified Chinese',
    native: '简体中文',
    flag: 'cn',
    aliases: ['Chinese Simplified', 'Mandarin'],
  },
  { code: 'sd', english: 'Sindhi', native: 'سنڌي', flag: 'pk', rtl: true },
  { code: 'si', english: 'Sinhala', native: 'සිංහල', flag: 'lk' },
  { code: 'sk', english: 'Slovak', native: 'Slovenčina', flag: 'sk' },
  { code: 'sl', english: 'Slovenian', native: 'Slovenščina', flag: 'si' },
  { code: 'so', english: 'Somali', native: 'Soomaali', flag: 'so' },
  { code: 'es', english: 'Spanish', native: 'Español', flag: 'es' },
  { code: 'sw', english: 'Swahili', native: 'Kiswahili', flag: 'tz' },
  { code: 'sv', english: 'Swedish', native: 'Svenska', flag: 'se' },
  { code: 'tg', english: 'Tajik', native: 'Тоҷикӣ', flag: 'tj' },
  { code: 'ta', english: 'Tamil', native: 'தமிழ்', flag: 'in' },
  { code: 'tt', english: 'Tatar', native: 'Татар', flag: 'ru' },
  { code: 'te', english: 'Telugu', native: 'తెలుగు', flag: 'in' },
  { code: 'th', english: 'Thai', native: 'ไทย', flag: 'th' },
  { code: 'ti', english: 'Tigrinya', native: 'ትግርኛ', flag: 'et' },
  { code: 'zh-hant', english: 'Traditional Chinese', native: '繁體中文', flag: 'tw', aliases: ['Chinese Traditional'] },
  { code: 'tr', english: 'Turkish', native: 'Türkçe', flag: 'tr' },
  { code: 'tk', english: 'Turkmen', native: 'Türkmen dili', flag: 'tm' },
  { code: 'uk', english: 'Ukrainian', native: 'Українська', flag: 'ua' },
  { code: 'hsb', english: 'Upper Sorbian', native: 'Hornjoserbšćina', flag: 'de' },
  { code: 'ur', english: 'Urdu', native: 'اردو', flag: 'pk', rtl: true },
  { code: 'ug', english: 'Uyghur', native: 'ئۇيغۇرچە', rtl: true },
  { code: 'uz', english: 'Uzbek', native: 'O‘zbek', flag: 'uz' },
  { code: 'uz-cyrl', english: 'Uzbek (Cyrillic)', native: 'Ўзбекча (Кирил)', flag: 'uz' },
  { code: 'uz-latn', english: 'Uzbek (Latin)', native: 'O‘zbek (lotin)', flag: 'uz' },
  { code: 'vec', english: 'Venetian', native: 'Veneto', flag: 'it' },
  { code: 'vi', english: 'Vietnamese', native: 'Tiếng Việt', flag: 'vn' },
  { code: 'cy', english: 'Welsh', native: 'Cymraeg', flag: 'gb-wls' },
  { code: 'wo', english: 'Wolof', native: 'Wolof', flag: 'sn' },
  { code: 'xh', english: 'Xhosa', native: 'IsiXhosa', flag: 'za' },
  { code: 'yi', english: 'Yiddish', native: 'ייִדיש', rtl: true },
  { code: 'yo', english: 'Yoruba', native: 'Èdè Yorùbá', flag: 'ng' },
  { code: 'zu', english: 'Zulu', native: 'IsiZulu', flag: 'za' },
]

const byCode = new Map(languages.map((language) => [language.code, language]))

/** The language of a code without regard to case, else of its language subtag ("fa-IR" is fa). */
export function findLanguage(code: string | undefined): Language | undefined {
  if (!code) return undefined
  const key = code.trim().replace(/_/g, '-').toLowerCase()
  return byCode.get(key) ?? byCode.get(key.split('-')[0] ?? '')
}

/** The English name of a code ("Persian"), the code itself when the list does not have it. */
export function languageName(code: string): string {
  return findLanguage(code)?.english ?? code
}

/** Lower case without accents and marks, for searching ("Español" matches "espanol"). */
function normalize(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

const index = languages.map((language) => ({
  language,
  english: normalize(language.english),
  native: normalize(language.native),
  aliases: (language.aliases ?? []).map(normalize),
}))

/**
 * The languages for a search: an exact code first, then English names that start with it,
 * native names, aliases, and last any of them that contains it. Within a rank the list keeps
 * its order (English names). An empty search returns everything.
 */
export function searchLanguages(query: string): Language[] {
  const q = normalize(query)
  if (q === '') return [...languages]
  const ranked: { rank: number; language: Language }[] = []
  for (const entry of index) {
    const { code } = entry.language
    let rank = -1
    if (code === q) rank = 0
    else if (entry.english.startsWith(q)) rank = 1
    else if (entry.native.startsWith(q)) rank = 2
    else if (entry.aliases.some((alias) => alias.startsWith(q))) rank = 3
    else if (
      code.includes(q) ||
      entry.english.includes(q) ||
      entry.native.includes(q) ||
      entry.aliases.some((alias) => alias.includes(q))
    ) {
      rank = 4
    }
    if (rank >= 0) ranked.push({ rank, language: entry.language })
  }
  return ranked.sort((a, b) => a.rank - b.rank).map((entry) => entry.language)
}
