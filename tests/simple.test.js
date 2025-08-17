/**
 * Simple test to verify basic functionality
 */

import { describe, it, expect } from '@jest/globals';

describe('Simple Tests', () => {
  it('should pass basic math', () => {
    expect(1 + 1).toBe(2);
  });
  
  it('should import LLMRouter', async () => {
    const { LLMRouter } = await import('../src/index.js');
    expect(LLMRouter).toBeDefined();
  });
});