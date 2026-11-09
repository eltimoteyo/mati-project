import { describe, expect, it } from 'vitest';

import { normalizePhone } from '../src/whatsapp/phone';

describe('Normalización de teléfonos', () => {
  it.each([
    ['987 654 321', '51987654321'],
    ['+51 987 654 321', '51987654321'],
    ['0051987654321', '51987654321'],
    ['51987654321', '51987654321'],
    ['(01) 234-5678', '012345678'],
    ['+34 612 345 678', '34612345678'],
    ['', ''],
  ])('%s se compara como %s', (raw, expected) => expect(normalizePhone(raw)).toBe(expected));
});
