import { describe, it, expect, beforeAll } from '@jest/globals';

const skipIfNoWebGPU = () => {
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    console.warn('WebGPU not available; skipping WebGPU engine tests');
    return true;
  }
  return false;
};

describe('WebGPU Engine Integration', () => {
  beforeAll(() => {
    // Ensure production mode so EngineSelector loads full engines
    process.env.NODE_ENV = 'production';
  });

  it('selects WebGPU engine when available', async () => {
    if (skipIfNoWebGPU()) return;
    const { EngineSelector } = await import('../../src/engines/EngineSelector.js');
    // reset selector state for clean test
    EngineSelector.engines.clear();
    EngineSelector.initialized = false;
    const engine = await EngineSelector.getBest();
    expect(engine.name).toBe('WebGPU');
    await engine.cleanup();
  });

  it('runs a simple compute shader', async () => {
    if (skipIfNoWebGPU()) return;
    const { WebGPUEngine } = await import('../../src/engines/WebGPUEngine.js');
    const engine = new WebGPUEngine();
    const data = new Float32Array([1, 2, 3, 4]);
    const result = await engine.execute({ outputSize: data.byteLength }, data);
    expect(Array.from(result)).toEqual([2, 4, 6, 8]);
    await engine.cleanup();
  });
});

