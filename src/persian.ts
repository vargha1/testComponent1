const FA = '۰۱۲۳۴۵۶۷۸۹';
const AR = '٠١٢٣٤٥٦٧٨٩';

/** Western digits -> Persian digits (also maps . and , to Persian separators). */
export function toFa(input: string | number): string {
  return String(input)
    .replace(/\d/g, (d) => FA[+d])
    .replace(/,/g, '٬')
    .replace(/\./g, '٫');
}

/** Persian/Arabic-Indic digits -> ASCII digits. */
export function toEn(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)));
}

/** Format a number with Persian digits, grouped thousands, up to `maxFrac` decimals. */
export function formatFa(n: number, maxFrac = 1): string {
  const fixed = Number(n.toFixed(maxFrac));
  const [int, frac] = String(fixed).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return toFa(frac ? `${grouped}.${frac}` : grouped);
}

/**
 * Normalize an Iranian mobile number to ASCII "09xxxxxxxxx".
 * Accepts Persian/Arabic digits, spaces, dashes, and +98 / 0098 / 98 / 9 prefixes.
 * Returns null when invalid.
 */
export function normalizeMobile(raw: string): string | null {
  let s = toEn(raw).replace(/[\s\-().‌‏‎]/g, '');
  if (s.startsWith('+98')) s = '0' + s.slice(3);
  else if (s.startsWith('0098')) s = '0' + s.slice(4);
  else if (/^98\d{10}$/.test(s)) s = '0' + s.slice(2);
  else if (/^9\d{9}$/.test(s)) s = '0' + s;
  return /^09\d{9}$/.test(s) ? s : null;
}
