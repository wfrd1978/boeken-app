import { describe, expect, it } from 'vitest';
import { biblionCoverUrl } from '../src/zoeken.js';

describe('covers van Biblion', () => {
  it('maakt een adres met alleen een geldig ISBN', () => {
    expect(biblionCoverUrl('978-90-831-2195-6')).toContain('isbn=9789083121956');
    expect(biblionCoverUrl('903380289X')).toContain('isbn=903380289X');
    expect(biblionCoverUrl('')).toBe('');
    expect(biblionCoverUrl('12345')).toBe('');
    // Rommel erachter: geen adres, liever geen cover dan een vreemd adres.
    expect(biblionCoverUrl('9789083121956&x=<b>')).toBe('');
  });
});
