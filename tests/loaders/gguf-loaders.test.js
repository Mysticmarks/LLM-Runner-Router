import LLMRouter from '../../src/index.js';
import GGUFLoader from '../../src/loaders/GGUFLoader.js';
import NodeLlamaCppLoader from '../../src/loaders/NodeLlamaCppLoader.js';

describe('GGUF loader registration', () => {
  let router;

  beforeAll(async () => {
    router = new LLMRouter({ autoInit: false });
    await router.initialize();
  });

  afterAll(async () => {
    await router.cleanup();
  });

  test('registry contains both loaders under distinct keys', () => {
    const ggufLoader = router.registry.getLoader('gguf');
    const nodeLoader = router.registry.getLoader('gguf-node');

    expect(ggufLoader).toBeInstanceOf(GGUFLoader);
    expect(nodeLoader).toBeInstanceOf(NodeLlamaCppLoader);
    expect(ggufLoader).not.toBe(nodeLoader);
  });

  test('loaders report support for gguf files', async () => {
    const ggufLoader = router.registry.getLoader('gguf');
    const nodeLoader = router.registry.getLoader('gguf-node');

    await expect(ggufLoader.canLoad('model.gguf')).resolves.toBe(true);
    expect(nodeLoader.supports('model.gguf')).toBe(true);
  });
});
