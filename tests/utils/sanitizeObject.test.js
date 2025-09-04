import { validateInput } from '../../src/middleware/security.js';

describe('sanitizeObject array handling', () => {
  test('sanitizes nested arrays while preserving structure', () => {
    const req = {
      body: {
        arr: [
          '<script>alert(1)</script>',
          ['javascript:attack()', '<img src=x onerror=alert(2)>'],
          { nested: ['safe', '<script>bad()</script>'] }
        ]
      }
    };

    validateInput(req, {}, () => {});

    expect(Array.isArray(req.body.arr)).toBe(true);
    expect(Array.isArray(req.body.arr[1])).toBe(true);
    expect(Array.isArray(req.body.arr[2].nested)).toBe(true);
    expect(req.body).toEqual({
      arr: ['', ['attack()', '<img src=x alert(2)>'], { nested: ['safe', ''] }]
    });
  });
});
