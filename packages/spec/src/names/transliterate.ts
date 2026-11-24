// Latin forms of Persian, Arabic, Cyrillic and Greek letters for ID names
// (docs/plan/03-design-model.md section 4). One fixed form per letter, so a name is easy to
// predict from its title:
// - Persian and Arabic: the consonant skeleton, since short vowels are not written (`سلام` gives
//   `slam`). Alef, alef with madda and ayn give `a`; vav gives `v` and yeh `y`, also where they
//   stand for a vowel; heh and teh marbuta give `h`; hamza, tatweel and the zero-width non-joiner
//   give nothing. Letters both languages write take their Persian form (`ث` is `s`, `ق` is `q`).
//   Persian and Arabic digits give 0 to 9. Harakat are dropped as marks (below).
// - Cyrillic: the usual Russian forms (`ж` zh, `х` kh, `ц` ts, `щ` shch, `ю` yu, `я` ya, `ъ` and
//   `ь` nothing), plus the Ukrainian and Serbian letters (`є` ye, `ї` yi, `љ` lj, `џ` dz).
// - Greek: one form per letter (`θ` th, `ξ` x, `υ` y, `φ` f, `χ` ch, `ψ` ps, both sigmas s).
// - Latin letters that do not split into a letter and a mark: `ß` ss, `æ` ae, `ø` o, `ı` i.
// Any other letter with accents or other marks loses them (`é` to `e`, `ά` to `a`); everything
// else is kept as it is, and toIdName turns it into `_`.

const letters: Record<string, string> = {
  // Persian and Arabic
  ا: 'a',
  آ: 'a',
  أ: 'a',
  إ: 'a',
  ٱ: 'a',
  ء: '',
  ب: 'b',
  پ: 'p',
  ت: 't',
  ث: 's',
  ج: 'j',
  چ: 'ch',
  ح: 'h',
  خ: 'kh',
  د: 'd',
  ذ: 'z',
  ر: 'r',
  ز: 'z',
  ژ: 'zh',
  س: 's',
  ش: 'sh',
  ص: 's',
  ض: 'z',
  ط: 't',
  ظ: 'z',
  ع: 'a',
  غ: 'gh',
  ف: 'f',
  ق: 'q',
  ک: 'k',
  ك: 'k',
  گ: 'g',
  ل: 'l',
  م: 'm',
  ن: 'n',
  و: 'v',
  ؤ: 'v',
  ه: 'h',
  ة: 'h',
  ی: 'y',
  ي: 'y',
  ى: 'y',
  ئ: 'y',
  ـ: '',
  '‌': '',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',

  // Cyrillic
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  ґ: 'g',
  д: 'd',
  ђ: 'dj',
  е: 'e',
  ё: 'e',
  є: 'ye',
  ж: 'zh',
  з: 'z',
  и: 'i',
  і: 'i',
  ї: 'yi',
  й: 'y',
  ј: 'j',
  к: 'k',
  л: 'l',
  љ: 'lj',
  м: 'm',
  н: 'n',
  њ: 'nj',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  ћ: 'c',
  у: 'u',
  ў: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  џ: 'dz',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',

  // Greek
  α: 'a',
  β: 'v',
  γ: 'g',
  δ: 'd',
  ε: 'e',
  ζ: 'z',
  η: 'i',
  θ: 'th',
  ι: 'i',
  κ: 'k',
  λ: 'l',
  μ: 'm',
  ν: 'n',
  ξ: 'x',
  ο: 'o',
  π: 'p',
  ρ: 'r',
  σ: 's',
  ς: 's',
  τ: 't',
  υ: 'y',
  φ: 'f',
  χ: 'ch',
  ψ: 'ps',
  ω: 'o',

  // Latin
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  ð: 'd',
  đ: 'd',
  þ: 'th',
  ł: 'l',
  ı: 'i',
}

/** The lower case Latin form of a text, letter by letter (the table above). */
export function toLatin(text: string): string {
  let out = ''
  for (const char of text.toLowerCase().normalize('NFC')) {
    const latin = letters[char]
    if (latin !== undefined) {
      out += latin
      continue
    }
    // Looked up again without its marks: é to e, ά to α and so to a, a lone haraka to nothing.
    for (const bare of char.normalize('NFKD').replace(/\p{M}/gu, '')) {
      out += letters[bare] ?? bare
    }
  }
  return out
}
