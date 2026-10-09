import { describe, expect, it } from 'vitest';
import { formatFa, normalizeMobile, toEn, toFa } from '../src/persian';

describe('digits', () => {
  it('converts both directions', () => {
    expect(toFa('0912')).toBe('۰۹۱۲');
    expect(toEn('۰۹۱۲٣')).toBe('09123');
  });
  it('formats numbers', () => {
    expect(formatFa(1234.5)).toBe('۱٬۲۳۴٫۵');
    expect(formatFa(18)).toBe('۱۸');
    expect(formatFa(18.04)).toBe('۱۸');
  });
});

describe('normalizeMobile', () => {
  it.each([
    ['09123456789', '09123456789'],
    ['۰۹۱۲۳۴۵۶۷۸۹', '09123456789'],
    ['٠٩١٢٣٤٥٦٧٨٩', '09123456789'],
    ['0912 345 6789', '09123456789'],
    ['+98 912 345 6789', '09123456789'],
    ['00989123456789', '09123456789'],
    ['9123456789', '09123456789'],
  ])('accepts %s', (input, out) => expect(normalizeMobile(input)).toBe(out));

  it.each(['', '0812345678', '0912345678', '091234567890', 'abc', '02112345678'])('rejects %s', (v) =>
    expect(normalizeMobile(v)).toBeNull(),
  );
});
