/**
 * Tests for Universal Tokenizer
 */

import { jest } from '@jest/globals';
import UniversalTokenizer, { 
  TokenizerConfig, 
  TokenizationResult, 
  TokenizerType 
} from '../../src/utils/UniversalTokenizer.js';

// Mock fs/promises
jest.mock('fs/promises', () => ({
  access: jest.fn(),
  readFile: jest.fn(),
  stat: jest.fn(),
  mkdir: jest.fn()
}));

// Mock tiktoken
jest.mock('tiktoken', () => ({
  tiktoken: {
    getEncoding: jest.fn(() => ({
      encode: jest.fn((text) => [1, 2, 3, 4]),
      decode: jest.fn((ids) => 'decoded text')
    }))
  }
}));

// Mock @xenova/transformers
jest.mock('@xenova/transformers', () => ({
  AutoTokenizer: {
    from_pretrained: jest.fn(() => Promise.resolve({
      model: { vocab: { 'test': 1, 'token': 2 } },
      tokenToId: jest.fn((token) => 1),
      decode: jest.fn((ids) => Promise.resolve('decoded text'))
    }))
  }
}));

describe('TokenizerConfig', () => {
  test('should create config with default values', () => {
    const config = new TokenizerConfig();
    
    expect(config.type).toBe(TokenizerType.AUTO);
    expect(config.model).toBe('gpt2');
    expect(config.maxLength).toBe(2048);
    expect(config.addSpecialTokens).toBe(true);
  });

  test('should create config with custom values', () => {
    const options = {
      type: TokenizerType.BPE,
      model: 'custom-model',
      maxLength: 1024,
      addSpecialTokens: false
    };
    
    const config = new TokenizerConfig(options);
    
    expect(config.type).toBe(TokenizerType.BPE);
    expect(config.model).toBe('custom-model');
    expect(config.maxLength).toBe(1024);
    expect(config.addSpecialTokens).toBe(false);
  });
});

describe('TokenizationResult', () => {
  test('should create result with default values', () => {
    const result = new TokenizationResult();
    
    expect(result.ids).toEqual([]);
    expect(result.tokens).toEqual([]);
    expect(result.attentionMask).toEqual([]);
    expect(result.length).toBe(0);
  });

  test('should create result with provided data', () => {
    const data = {
      ids: [1, 2, 3],
      tokens: ['hello', 'world', '!'],
      attentionMask: [1, 1, 1]
    };
    
    const result = new TokenizationResult(data);
    
    expect(result.ids).toEqual([1, 2, 3]);
    expect(result.tokens).toEqual(['hello', 'world', '!']);
    expect(result.length).toBe(3);
  });

  test('should truncate tokens correctly', () => {
    const result = new TokenizationResult({
      ids: [1, 2, 3, 4, 5],
      tokens: ['a', 'b', 'c', 'd', 'e'],
      attentionMask: [1, 1, 1, 1, 1]
    });
    
    const truncated = result.truncate(3);
    
    expect(truncated.ids).toEqual([1, 2, 3]);
    expect(truncated.tokens).toEqual(['a', 'b', 'c']);
    expect(truncated.attentionMask).toEqual([1, 1, 1]);
    expect(truncated.metadata.truncated).toBe(true);
  });

  test('should pad tokens correctly', () => {
    const result = new TokenizationResult({
      ids: [1, 2],
      tokens: ['hello', 'world'],
      attentionMask: [1, 1]
    });
    
    const padded = result.pad(5, 0, '[PAD]');
    
    expect(padded.ids).toEqual([1, 2, 0, 0, 0]);
    expect(padded.tokens).toEqual(['hello', 'world', '[PAD]', '[PAD]', '[PAD]']);
    expect(padded.attentionMask).toEqual([1, 1, 0, 0, 0]);
    expect(padded.metadata.padded).toBe(true);
  });
});

describe('UniversalTokenizer', () => {
  let tokenizer;

  beforeEach(() => {
    tokenizer = new UniversalTokenizer();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (tokenizer.initialized) {
      await tokenizer.cleanup?.();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(tokenizer.config.type).toBe(TokenizerType.AUTO);
      expect(tokenizer.config.model).toBe('gpt2');
      expect(tokenizer.initialized).toBe(false);
    });

    test('should initialize with custom configuration', () => {
      const config = { 
        type: TokenizerType.TIKTOKEN, 
        model: 'gpt-4',
        maxLength: 4096 
      };
      const customTokenizer = new UniversalTokenizer(config);
      
      expect(customTokenizer.config.type).toBe(TokenizerType.TIKTOKEN);
      expect(customTokenizer.config.model).toBe('gpt-4');
      expect(customTokenizer.config.maxLength).toBe(4096);
    });
  });

  describe('Format Detection', () => {
    test('should detect tiktoken models', async () => {
      const format = await tokenizer.detectTokenizerType();
      // Mock model is 'gpt2' which should be detected as tiktoken
      expect(format).toBe(TokenizerType.TIKTOKEN);
    });

    test('should detect BERT models as WordPiece', async () => {
      tokenizer.config.model = 'bert-base-uncased';
      const format = await tokenizer.detectTokenizerType();
      expect(format).toBe(TokenizerType.WORDPIECE);
    });

    test('should detect T5 models as SentencePiece', async () => {
      tokenizer.config.model = 't5-small';
      const format = await tokenizer.detectTokenizerType();
      expect(format).toBe(TokenizerType.SENTENCEPIECE);
    });

    test('should fallback to HuggingFace for unknown models', async () => {
      tokenizer.config.model = 'unknown-model';
      const format = await tokenizer.detectTokenizerType();
      expect(format).toBe(TokenizerType.HUGGINGFACE);
    });
  });

  describe('Encoding', () => {
    beforeEach(async () => {
      tokenizer.config.type = TokenizerType.TIKTOKEN;
      await tokenizer.initialize();
    });

    test('should encode text successfully', async () => {
      const text = 'Hello, world!';
      const result = await tokenizer.encode(text);
      
      expect(result).toBeInstanceOf(TokenizationResult);
      expect(result.ids).toEqual([1, 2, 3, 4]);
      expect(result.tokens).toHaveLength(4);
      expect(result.attentionMask).toEqual([1, 1, 1, 1]);
    });

    test('should use cache for repeated encoding', async () => {
      const text = 'Hello, world!';
      
      // First encoding
      await tokenizer.encode(text);
      expect(tokenizer.stats.cacheMisses).toBe(1);
      expect(tokenizer.stats.cacheHits).toBe(0);
      
      // Second encoding (should hit cache)
      await tokenizer.encode(text);
      expect(tokenizer.stats.cacheHits).toBe(1);
    });

    test('should handle encoding errors gracefully', async () => {
      // Mock tokenizer to throw error
      tokenizer.tokenizer.encode = jest.fn(() => {
        throw new Error('Encoding failed');
      });
      
      await expect(tokenizer.encode('test')).rejects.toThrow('Encoding failed');
    });

    test('should apply truncation when configured', async () => {
      tokenizer.config.truncation = true;
      tokenizer.config.maxLength = 2;
      
      const result = await tokenizer.encode('Hello, world!');
      expect(result.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Decoding', () => {
    beforeEach(async () => {
      tokenizer.config.type = TokenizerType.TIKTOKEN;
      await tokenizer.initialize();
    });

    test('should decode token IDs successfully', async () => {
      const ids = [1, 2, 3, 4];
      const result = await tokenizer.decode(ids);
      
      expect(result).toBe('decoded text');
    });

    test('should handle decoding errors gracefully', async () => {
      tokenizer.tokenizer.decode = jest.fn(() => {
        throw new Error('Decoding failed');
      });
      
      await expect(tokenizer.decode([1, 2, 3])).rejects.toThrow('Decoding failed');
    });
  });

  describe('Batch Processing', () => {
    beforeEach(async () => {
      tokenizer.config.type = TokenizerType.TIKTOKEN;
      await tokenizer.initialize();
    });

    test('should encode multiple texts', async () => {
      const texts = ['Hello', 'World', 'Test'];
      const results = await tokenizer.encodeBatch(texts);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeInstanceOf(TokenizationResult);
        expect(result.ids).toEqual([1, 2, 3, 4]);
      });
    });

    test('should handle batch encoding errors', async () => {
      tokenizer.encode = jest.fn().mockRejectedValue(new Error('Batch encoding failed'));
      
      await expect(tokenizer.encodeBatch(['test'])).rejects.toThrow('Batch encoding failed');
    });
  });

  describe('Vocabulary Operations', () => {
    beforeEach(async () => {
      tokenizer.config.type = TokenizerType.HUGGINGFACE;
      await tokenizer.initialize();
    });

    test('should get vocabulary size', async () => {
      const vocabSize = await tokenizer.getVocabSize();
      expect(typeof vocabSize).toBe('number');
      expect(vocabSize).toBeGreaterThan(0);
    });

    test('should convert token to ID', async () => {
      const id = await tokenizer.tokenToId('test');
      expect(id).toBe(1);
    });

    test('should convert ID to token', async () => {
      const token = await tokenizer.idToToken(1);
      expect(token).toBeDefined();
    });
  });

  describe('Statistics and Cache Management', () => {
    beforeEach(async () => {
      await tokenizer.initialize();
    });

    test('should provide statistics', () => {
      const stats = tokenizer.getStats();
      
      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('cacheMisses');
      expect(stats).toHaveProperty('totalTokenizations');
      expect(stats).toHaveProperty('cacheHitRate');
    });

    test('should clear cache', () => {
      tokenizer.cache.set('test', new TokenizationResult());
      expect(tokenizer.cache.size).toBeGreaterThan(0);
      
      tokenizer.clearCache();
      expect(tokenizer.cache.size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle initialization errors', async () => {
      const badTokenizer = new UniversalTokenizer({ model: 'nonexistent-model' });
      
      // Mock to throw error during initialization
      jest.spyOn(badTokenizer, 'initializeTokenizer').mockImplementation(() => {
        throw new Error('Initialization failed');
      });
      
      await expect(badTokenizer.initialize()).rejects.toThrow('Initialization failed');
    });

    test('should handle unsupported tokenizer types', async () => {
      tokenizer.config.type = 'unsupported';
      
      await expect(tokenizer.initializeTokenizer()).rejects.toThrow('Unsupported tokenizer type');
    });
  });

  describe('Multiple Format Support', () => {
    test('should support BPE tokenizer', async () => {
      const bpeTokenizer = new UniversalTokenizer({ 
        type: TokenizerType.BPE,
        vocabFile: 'vocab.json',
        mergesFile: 'merges.txt'
      });
      
      // Mock file existence
      const fs = await import('fs/promises');
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue('token1\ntoken2\ntoken3');
      
      await expect(bpeTokenizer.initialize()).resolves.not.toThrow();
    });

    test('should support WordPiece tokenizer', async () => {
      const wpTokenizer = new UniversalTokenizer({ 
        type: TokenizerType.WORDPIECE 
      });
      
      await expect(wpTokenizer.initialize()).resolves.not.toThrow();
    });

    test('should support SentencePiece tokenizer', async () => {
      const spTokenizer = new UniversalTokenizer({ 
        type: TokenizerType.SENTENCEPIECE 
      });
      
      await expect(spTokenizer.initialize()).resolves.not.toThrow();
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await tokenizer.initialize();
    });

    test('should process large batches efficiently', async () => {
      const largeBatch = Array(100).fill().map((_, i) => `Test text ${i}`);
      
      const startTime = Date.now();
      const results = await tokenizer.encodeBatch(largeBatch);
      const endTime = Date.now();
      
      expect(results).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    test('should cache frequently used tokens', async () => {
      const commonText = 'common text';
      
      // Encode multiple times
      for (let i = 0; i < 10; i++) {
        await tokenizer.encode(commonText);
      }
      
      const stats = tokenizer.getStats();
      expect(stats.cacheHits).toBeGreaterThan(0);
    });
  });
});