import { describe, test, expect, jest } from '@jest/globals';
import { DatabaseManager } from '../../src/db/DatabaseManager.js';

describe('Database fallback', () => {
  test('sets fallbackMode true and emits ready when connect fails', async () => {
    const database = new DatabaseManager({ type: 'sqlite', fallbackToMemory: true });
    jest.spyOn(database, 'connect').mockRejectedValue(new Error('Connection failed'));

    const readyPromise = new Promise((resolve, reject) => {
      database.once('ready', resolve);
      database.once('error', reject);
    });

    await database.initialize();
    await expect(readyPromise).resolves.toBeUndefined();
    expect(database.fallbackMode).toBe(true);

    await database.close();
  });
});
