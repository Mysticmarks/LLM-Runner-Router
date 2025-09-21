import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';

const modelDir = path.join(process.cwd(), 'models', 'smollm3-3b');

async function loadServer() {
  jest.resetModules();
  const mod = await import('../server.js');
  return mod;
}

describe('server bootstrap environment validation', () => {
  it('validates environment during module import', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    const getSummary = jest.fn(() => ({ valid: true, warningCount: 0, errorCount: 0 }));
    const validateMock = jest.fn(() => ({ getSummary }));

    try {
      await jest.isolateModulesAsync(async () => {
        jest.unstable_mockModule('../src/utils/EnvValidator.js', () => ({
          __esModule: true,
          default: { validate: validateMock },
          EnvValidator: { validate: validateMock }
        }));

        await import('../server.js');
      });

      expect(validateMock).toHaveBeenCalledWith('test');
      expect(getSummary).toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = originalEnv;
      jest.resetModules();
    }
  });
});

describe('initializeRouter smollm3 directory check', () => {
  beforeEach(async () => {
    // remove directory before each
    await fs.rm(modelDir, { recursive: true, force: true });
  });

  afterAll(async () => {
    await fs.rm(modelDir, { recursive: true, force: true });
  });

  it('skips loading when model directory missing', async () => {
    const { initializeRouter, router } = await loadServer();
    const loadSpy = jest.spyOn(router, 'load').mockResolvedValue({});
    await initializeRouter();
    expect(loadSpy).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'simple-smollm3' }));
    await router.cleanup();
  });

  it('loads model when directory present', async () => {
    await fs.mkdir(modelDir, { recursive: true });
    const { initializeRouter, router } = await loadServer();
    const loadSpy = jest.spyOn(router, 'load').mockResolvedValue({});
    await initializeRouter();
    expect(loadSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'simple-smollm3' }));
    await router.cleanup();
  });
});
