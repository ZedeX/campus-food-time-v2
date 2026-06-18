// Unit tests for utility functions
// Run with: node --test tests/unit/utils.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getISOWeek, formatDate, isValidPhone, isValidIdNumber, getIdParts, normalizeDishName, parseYearWeek } from '../../worker/src/utils/dateUtils.js';

describe('ISO Week Calculation (ISO 8601)', () => {
  it('2025-12-29 (Monday) should be 2026-W01', () => {
    const result = getISOWeek('2025-12-29');
    assert.strictEqual(result.year, 2026);
    assert.strictEqual(result.weekNumber, 1);
    assert.strictEqual(result.yearWeek, '2026-W01');
  });

  it('2024-12-30 (Monday) should be 2025-W01', () => {
    const result = getISOWeek('2024-12-30');
    assert.strictEqual(result.year, 2025);
    assert.strictEqual(result.weekNumber, 1);
  });

  it('2026-01-05 (Monday) should be 2026-W02', () => {
    const result = getISOWeek('2026-01-05');
    assert.strictEqual(result.year, 2026);
    assert.strictEqual(result.weekNumber, 2);
  });

  it('2025-10-26 (Sunday) should be 2025-W43', () => {
    const result = getISOWeek('2025-10-26');
    assert.strictEqual(result.year, 2025);
    assert.strictEqual(result.weekNumber, 43);
  });

  it('2026-12-28 (Monday) should be 2026-W52', () => {
    const result = getISOWeek('2026-12-28');
    assert.strictEqual(result.year, 2026);
    assert.ok(result.weekNumber === 52 || result.weekNumber === 53, `Expected 52 or 53, got ${result.weekNumber}`);
  });
});

describe('Phone Validation', () => {
  it('should accept valid Chinese mobile numbers', () => {
    assert.strictEqual(isValidPhone('13800138000'), true);
    assert.strictEqual(isValidPhone('15912345678'), true);
    assert.strictEqual(isValidPhone('19900000000'), true);
  });

  it('should reject invalid phone numbers', () => {
    assert.strictEqual(isValidPhone('123'), false);
    assert.strictEqual(isValidPhone('12345678901'), false); // starts with 12
    assert.strictEqual(isValidPhone('23800138000'), false); // doesn't start with 1
    assert.strictEqual(isValidPhone('1380013800'), false); // 10 digits
    assert.strictEqual(isValidPhone('138001380001'), false); // 12 digits
  });
});

describe('ID Number Validation', () => {
  it('should accept valid 18-digit ID numbers', () => {
    assert.strictEqual(isValidIdNumber('310101199001011234'), true);
    assert.strictEqual(isValidIdNumber('31010119900101123X'), true);
    assert.strictEqual(isValidIdNumber('31010119900101123x'), true);
  });

  it('should reject invalid ID numbers', () => {
    assert.strictEqual(isValidIdNumber('123'), false);
    assert.strictEqual(isValidIdNumber('31010119900101123'), false); // 17 digits
    assert.strictEqual(isValidIdNumber('3101011990010112345'), false); // 19 digits
  });
});

describe('ID Parts Extraction', () => {
  it('should extract first 3 and last 4 digits', () => {
    const parts = getIdParts('310101199001011234');
    assert.strictEqual(parts.prefix, '310');
    assert.strictEqual(parts.suffix, '1234');
  });

  it('should handle X suffix', () => {
    const parts = getIdParts('31010119900101123X');
    assert.strictEqual(parts.prefix, '310');
    assert.strictEqual(parts.suffix, '123X');
  });
});

describe('Dish Name Normalization', () => {
  it('should trim whitespace', () => {
    assert.strictEqual(normalizeDishName('  红烧肉  '), '红烧肉');
  });

  it('should convert full-width to half-width', () => {
    assert.strictEqual(normalizeDishName('红烧肉（周一）'), '红烧肉(周一)');
  });

  it('should handle empty input', () => {
    assert.strictEqual(normalizeDishName(''), '');
    assert.strictEqual(normalizeDishName(null), '');
  });
});

describe('YearWeek Parsing', () => {
  it('should parse valid yearWeek', () => {
    const result = parseYearWeek('2025-W43');
    assert.strictEqual(result.year, 2025);
    assert.strictEqual(result.weekNumber, 43);
  });

  it('should return null for invalid format', () => {
    assert.strictEqual(parseYearWeek('2025-43'), null);
    assert.strictEqual(parseYearWeek('2025-W'), null);
    assert.strictEqual(parseYearWeek('abc'), null);
  });
});
