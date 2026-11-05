export interface ComicInfo {
  Title?: string;
  Series?: string;
  Number?: string;
  Volume?: string;
  Year?: string;
  Month?: string;
  Day?: string;
  Writer?: string;
  Penciller?: string;
  Inker?: string;
  Colorist?: string;
  Letterer?: string;
  CoverArtist?: string;
  Editor?: string;
  Publisher?: string;
  Genre?: string;
  Tags?: string;
  PageCount?: string;
  LanguageISO?: string;
  ComicBookFormat?: string;
  AgeRating?: string;
  ScanInformation?: string;
  Web?: string;
  Summary?: string;
  Notes?: string;
  Cover?: string;
}

const COMIC_INFO_FIELDS: readonly (keyof ComicInfo)[] = [
  'Title',
  'Series',
  'Number',
  'Volume',
  'Year',
  'Month',
  'Day',
  'Writer',
  'Penciller',
  'Inker',
  'Colorist',
  'Letterer',
  'CoverArtist',
  'Editor',
  'Publisher',
  'Genre',
  'Tags',
  'PageCount',
  'LanguageISO',
  'ComicBookFormat',
  'AgeRating',
  'ScanInformation',
  'Web',
  'Summary',
  'Notes',
  'Cover',
];

function decodeXmlEntities(value: string): string {
  let out = value;
  for (let i = 0; i < 3; i++) {
    const decoded = out
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_m, code: string) => String.fromCharCode(Number(code)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_m, code: string) => String.fromCharCode(parseInt(code, 16)))
      .replace(/&amp;/g, '&');
    if (decoded === out) break;
    out = decoded;
  }
  return out;
}

/**
 * Parser ligero y portable de ComicInfo.xml. No depende de DOMParser para
 * funcionar tanto en Electron como en React Native.
 */
export function parseComicInfoXml(xml: string): ComicInfo {
  const comicInfo: ComicInfo = {};
  for (const field of COMIC_INFO_FIELDS) {
    const match = new RegExp(`<${field}(?:\\s[^>]*)?>([\\s\\S]*?)</${field}>`, 'i').exec(xml);
    if (!match || match[1] === undefined) continue;
    const value = decodeXmlEntities(match[1]).trim();
    if (value.length > 0) {
      comicInfo[field] = value;
    }
  }
  return comicInfo;
}
