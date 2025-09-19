import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import path from 'path';

const fsMock = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn()
};

jest.unstable_mockModule('fs/promises', () => ({
  __esModule: true,
  default: fsMock,
  readFile: fsMock.readFile,
  writeFile: fsMock.writeFile,
  mkdir: fsMock.mkdir
}));

const fs = await import('fs/promises');
const { ModelRegistry } = await import('../../src/core/Registry.js');

describe('ModelRegistry registration invariants', () => {
  let registry;

  beforeEach(() => {
    fs.readFile.mockResolvedValue('{"models": [], "version": "1.0.0"}');
    fs.writeFile.mockResolvedValue();
    fs.mkdir.mockResolvedValue();

    registry = new ModelRegistry({
      registryPath: path.join(process.cwd(), 'tmp', 'registry.json'),
      maxModels: 2
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('rejects invalid models and preserves metadata', async () => {
    await expect(registry.register(null)).rejects.toThrow('Model definition must be an object');
    await expect(
      registry.register({ id: '', name: 'Broken', format: 'gguf', source: '/tmp/model.gguf' })
    ).rejects.toThrow('Model is missing required field: id');

    const model = {
      id: 'valid-model',
      name: 'Valid Model',
      format: 'gguf',
      source: '/tmp/model.gguf'
    };

    const registered = await registry.register(model);

    expect(registered.status).toBe('registered');
    expect(registered.registered).toBeInstanceOf(Date);
    expect(fs.writeFile).toHaveBeenCalled();
  });

  test('prevents duplicate registrations', async () => {
    const model = {
      id: 'duplicate-model',
      name: 'Duplicate Model',
      format: 'gguf',
      source: '/tmp/model.gguf'
    };

    await registry.register(model);
    await expect(registry.register({ ...model })).rejects.toThrow('already registered');
  });

  test('indexes capability arrays and cleans up on eviction', async () => {
    const models = [
      {
        id: 'indexed-model-1',
        name: 'Indexed Model 1',
        format: 'gguf',
        source: '/tmp/model1.gguf',
        capabilities: ['chat', 'embedding'],
        metrics: { lastUsed: new Date(0) },
        cleanup: jest.fn()
      },
      {
        id: 'indexed-model-2',
        name: 'Indexed Model 2',
        format: 'onnx',
        source: '/tmp/model2.onnx',
        capabilities: { chat: true },
        metrics: { lastUsed: new Date(1) },
        cleanup: jest.fn()
      }
    ];

    await registry.register(models[0]);
    await registry.register(models[1]);

    expect(registry.getByFormat('gguf')).toHaveLength(1);
    expect(registry.indexes.capability.get('chat')).toHaveLength(2);
    expect(registry.indexes.capability.get('embedding')).toHaveLength(1);

    await registry.evictLRU();

    expect(models[0].cleanup).toHaveBeenCalled();
    expect(registry.indexes.capability.get('embedding')).toBeUndefined();
    const chatIndex = registry.indexes.capability.get('chat');
    expect(chatIndex).toHaveLength(1);
    expect(chatIndex[0].id).toBe('indexed-model-2');
  });
});
