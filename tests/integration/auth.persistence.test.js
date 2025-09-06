import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import jwt from 'jsonwebtoken';
import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { AuthenticationManager } from '../../src/api/Auth.js';
import { PersistentMap } from '../../src/db/PersistentMap.js';

describe('Auth Persistence - Production Tests', () => {
  let tempDir;
  
  beforeEach(async () => {
    // Create a unique temp directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'auth-test-'));
  });
  
  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('User Persistence', () => {
    test('persists users across auth manager restarts', async () => {
      const config = {
        jwtSecret: 'test-secret-key',
        bcryptRounds: 4,
        sessionSecret: 'test-session-secret',
        dataDir: tempDir
      };

      // Create first auth manager instance
      const auth1 = new AuthenticationManager(config);
      await new Promise(resolve => auth1.on('initialized', resolve));

      // Create multiple users
      const users = [
        { username: 'alice', password: 'pass123', email: 'alice@test.com', role: 'admin' },
        { username: 'bob', password: 'pass456', email: 'bob@test.com', role: 'user' },
        { username: 'charlie', password: 'pass789', email: 'charlie@test.com', role: 'viewer' }
      ];

      const createdUsers = [];
      for (const userData of users) {
        const user = await auth1.createUser(userData);
        expect(user).toBeDefined();
        expect(user.id).toBeDefined();
        expect(user.username).toBe(userData.username);
        createdUsers.push(user);
      }

      // Verify users exist in first instance
      expect(auth1.users.size).toBe(3);
      
      // Clean up first instance
      auth1.removeAllListeners();

      // Create second auth manager instance with same data directory
      const auth2 = new AuthenticationManager(config);
      await new Promise(resolve => auth2.on('initialized', resolve));

      // Verify all users were persisted
      expect(auth2.users.size).toBe(3);

      // Verify each user's data
      for (const originalUser of createdUsers) {
        const persistedUser = Array.from(auth2.users.values()).find(
          u => u.username === originalUser.username
        );
        expect(persistedUser).toBeDefined();
        expect(persistedUser.id).toBe(originalUser.id);
        expect(persistedUser.email).toBe(originalUser.email);
        expect(persistedUser.role).toBe(originalUser.role);
      }

      // Verify authentication still works
      for (const userData of users) {
        const authUser = await auth2.authenticateUser(userData.username, userData.password);
        expect(authUser).toBeDefined();
        expect(authUser.username).toBe(userData.username);
      }

      auth2.removeAllListeners();
    });

    test('handles user updates with persistence', async () => {
      const config = {
        jwtSecret: 'update-secret',
        bcryptRounds: 4,
        sessionSecret: 'update-session',
        dataDir: tempDir
      };

      const auth1 = new AuthenticationManager(config);
      await new Promise(resolve => auth1.on('initialized', resolve));

      // Create user
      const user = await auth1.createUser({
        username: 'updateuser',
        password: 'oldpass',
        email: 'old@test.com',
        role: 'user'
      });

      // Update user
      const updated = await auth1.updateUser(user.id, {
        email: 'new@test.com',
        role: 'admin'
      });

      expect(updated.email).toBe('new@test.com');
      expect(updated.role).toBe('admin');

      auth1.removeAllListeners();

      // Reload and verify updates persisted
      const auth2 = new AuthenticationManager(config);
      await new Promise(resolve => auth2.on('initialized', resolve));

      const persistedUser = Array.from(auth2.users.values()).find(
        u => u.username === 'updateuser'
      );

      expect(persistedUser.email).toBe('new@test.com');
      expect(persistedUser.role).toBe('admin');

      auth2.removeAllListeners();
    });

    test('handles user deletion with persistence', async () => {
      const config = {
        jwtSecret: 'delete-secret',
        bcryptRounds: 4,
        sessionSecret: 'delete-session',
        dataDir: tempDir
      };

      const auth1 = new AuthenticationManager(config);
      await new Promise(resolve => auth1.on('initialized', resolve));

      // Create users
      const user1 = await auth1.createUser({
        username: 'keeper',
        password: 'pass1',
        email: 'keeper@test.com',
        role: 'user'
      });

      const user2 = await auth1.createUser({
        username: 'deleter',
        password: 'pass2',
        email: 'deleter@test.com',
        role: 'user'
      });

      expect(auth1.users.size).toBe(2);

      // Delete one user
      const deleted = await auth1.deleteUser(user2.id);
      expect(deleted).toBe(true);
      expect(auth1.users.size).toBe(1);

      auth1.removeAllListeners();

      // Reload and verify deletion persisted
      const auth2 = new AuthenticationManager(config);
      await new Promise(resolve => auth2.on('initialized', resolve));

      expect(auth2.users.size).toBe(1);

      const remainingUser = Array.from(auth2.users.values())[0];
      expect(remainingUser.username).toBe('keeper');

      auth2.removeAllListeners();
    });
  });

  describe('Token Persistence', () => {
    test('persists refresh tokens across restarts', async () => {
      const config = {
        jwtSecret: 'token-secret',
        bcryptRounds: 4,
        sessionSecret: 'token-session',
        dataDir: tempDir
      };

      const auth1 = new AuthenticationManager(config);
      await new Promise(resolve => auth1.on('initialized', resolve));

      // Create user and generate tokens
      const user = await auth1.createUser({
        username: 'tokenuser',
        password: 'tokenpass',
        email: 'token@test.com',
        role: 'user'
      });

      const tokens = auth1.generateTokens(user);
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();

      // Decode refresh token to get JTI
      const decoded = jwt.decode(tokens.refreshToken);
      expect(decoded.jti).toBeDefined();

      // Verify token is stored
      const storedToken = auth1.refreshTokens.get(decoded.jti);
      expect(storedToken).toBeDefined();
      expect(storedToken.userId).toBe(user.id);

      auth1.removeAllListeners();

      // Reload and verify token persisted
      const auth2 = new AuthenticationManager(config);
      await new Promise(resolve => auth2.on('initialized', resolve));

      const persistedToken = auth2.refreshTokens.get(decoded.jti);
      expect(persistedToken).toBeDefined();
      expect(persistedToken.userId).toBe(user.id);
      expect(persistedToken.expiresAt).toBe(storedToken.expiresAt);

      // Verify token can still be used for refresh
      const newTokens = await auth2.refreshAccessToken(tokens.refreshToken);
      expect(newTokens.accessToken).toBeDefined();

      auth2.removeAllListeners();
    });

    test('persists token revocation', async () => {
      const config = {
        jwtSecret: 'revoke-secret',
        bcryptRounds: 4,
        sessionSecret: 'revoke-session',
        dataDir: tempDir
      };

      const auth1 = new AuthenticationManager(config);
      await new Promise(resolve => auth1.on('initialized', resolve));

      // Create user and generate tokens
      const user = await auth1.createUser({
        username: 'revokeuser',
        password: 'revokepass',
        email: 'revoke@test.com',
        role: 'user'
      });

      const tokens = auth1.generateTokens(user);
      const decoded = jwt.decode(tokens.refreshToken);

      // Verify token exists
      expect(auth1.refreshTokens.get(decoded.jti)).toBeDefined();

      // Revoke token
      auth1.revokeToken(tokens.refreshToken);
      expect(auth1.refreshTokens.get(decoded.jti)).toBeUndefined();

      auth1.removeAllListeners();

      // Reload and verify revocation persisted
      const auth2 = new AuthenticationManager(config);
      await new Promise(resolve => auth2.on('initialized', resolve));

      expect(auth2.refreshTokens.get(decoded.jti)).toBeUndefined();

      // Verify token cannot be used
      await expect(
        auth2.refreshAccessToken(tokens.refreshToken)
      ).rejects.toThrow();

      auth2.removeAllListeners();
    });

    test('handles multiple token operations', async () => {
      const config = {
        jwtSecret: 'multi-token-secret',
        bcryptRounds: 4,
        sessionSecret: 'multi-session',
        dataDir: tempDir
      };

      const auth1 = new AuthenticationManager(config);
      await new Promise(resolve => auth1.on('initialized', resolve));

      // Create multiple users with multiple tokens each
      const usersData = [];
      for (let i = 0; i < 3; i++) {
        const user = await auth1.createUser({
          username: `user${i}`,
          password: `pass${i}`,
          email: `user${i}@test.com`,
          role: 'user'
        });

        const userTokens = [];
        for (let j = 0; j < 3; j++) {
          const tokens = auth1.generateTokens(user);
          userTokens.push(tokens);
        }

        usersData.push({ user, tokens: userTokens });
      }

      // Verify all tokens are stored
      expect(auth1.refreshTokens.size).toBe(9); // 3 users * 3 tokens

      // Revoke some tokens
      auth1.revokeToken(usersData[0].tokens[0].refreshToken);
      auth1.revokeToken(usersData[1].tokens[1].refreshToken);

      expect(auth1.refreshTokens.size).toBe(7);

      auth1.removeAllListeners();

      // Reload and verify state
      const auth2 = new AuthenticationManager(config);
      await new Promise(resolve => auth2.on('initialized', resolve));

      expect(auth2.refreshTokens.size).toBe(7);

      // Verify specific tokens
      const decoded0 = jwt.decode(usersData[0].tokens[0].refreshToken);
      const decoded1 = jwt.decode(usersData[1].tokens[1].refreshToken);
      const decoded2 = jwt.decode(usersData[2].tokens[0].refreshToken);

      expect(auth2.refreshTokens.get(decoded0.jti)).toBeUndefined(); // Revoked
      expect(auth2.refreshTokens.get(decoded1.jti)).toBeUndefined(); // Revoked
      expect(auth2.refreshTokens.get(decoded2.jti)).toBeDefined(); // Still valid

      auth2.removeAllListeners();
    });
  });

  describe('Session Persistence', () => {
    test('maintains session data across restarts', async () => {
      const config = {
        jwtSecret: 'session-secret',
        bcryptRounds: 4,
        sessionSecret: 'session-key',
        dataDir: tempDir
      };

      const auth1 = new AuthenticationManager(config);
      await new Promise(resolve => auth1.on('initialized', resolve));

      // Create user
      const user = await auth1.createUser({
        username: 'sessionuser',
        password: 'sessionpass',
        email: 'session@test.com',
        role: 'admin'
      });

      // Generate tokens (creates session)
      const tokens = auth1.generateTokens(user);

      auth1.removeAllListeners();

      // Reload
      const auth2 = new AuthenticationManager(config);
      await new Promise(resolve => auth2.on('initialized', resolve));

      // Verify user can still authenticate
      const authUser = await auth2.authenticateUser('sessionuser', 'sessionpass');
      expect(authUser).toBeDefined();

      // Verify tokens can be refreshed
      const newTokens = await auth2.refreshAccessToken(tokens.refreshToken);
      expect(newTokens.accessToken).toBeDefined();

      auth2.removeAllListeners();
    });
  });

  describe('PersistentMap Functionality', () => {
    test('PersistentMap saves and loads data correctly', async () => {
      const mapPath = path.join(tempDir, 'test-map.json');
      const map = new PersistentMap(mapPath);

      await map.load();

      // Add data
      map.set('key1', { value: 'data1' });
      map.set('key2', { value: 'data2' });
      map.set('key3', { value: 'data3' });

      expect(map.size).toBe(3);

      // Create new instance and load
      const map2 = new PersistentMap(mapPath);
      await map2.load();

      expect(map2.size).toBe(3);
      expect(map2.get('key1')).toEqual({ value: 'data1' });
      expect(map2.get('key2')).toEqual({ value: 'data2' });
      expect(map2.get('key3')).toEqual({ value: 'data3' });
    });

    test('PersistentMap handles deletion correctly', async () => {
      const mapPath = path.join(tempDir, 'delete-map.json');
      const map = new PersistentMap(mapPath);

      await map.load();

      map.set('keep', 'keepValue');
      map.set('delete', 'deleteValue');

      expect(map.size).toBe(2);

      map.delete('delete');
      expect(map.size).toBe(1);
      expect(map.has('delete')).toBe(false);

      // Reload and verify
      const map2 = new PersistentMap(mapPath);
      await map2.load();

      expect(map2.size).toBe(1);
      expect(map2.get('keep')).toBe('keepValue');
      expect(map2.has('delete')).toBe(false);
    });

    test('PersistentMap handles clear operation', async () => {
      const mapPath = path.join(tempDir, 'clear-map.json');
      const map = new PersistentMap(mapPath);

      await map.load();

      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 3);

      expect(map.size).toBe(3);

      map.clear();
      expect(map.size).toBe(0);

      // Reload and verify
      const map2 = new PersistentMap(mapPath);
      await map2.load();

      expect(map2.size).toBe(0);
    });

    test('PersistentMap iteration methods work correctly', async () => {
      const mapPath = path.join(tempDir, 'iter-map.json');
      const map = new PersistentMap(mapPath);

      await map.load();

      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 3);

      // Test values()
      const values = Array.from(map.values());
      expect(values).toEqual(expect.arrayContaining([1, 2, 3]));

      // Test entries()
      const entries = Array.from(map.entries());
      expect(entries).toEqual(expect.arrayContaining([
        ['a', 1],
        ['b', 2],
        ['c', 3]
      ]));

      // Test Symbol.iterator
      const items = [];
      for (const [key, value] of map) {
        items.push([key, value]);
      }
      expect(items).toEqual(expect.arrayContaining([
        ['a', 1],
        ['b', 2],
        ['c', 3]
      ]));
    });
  });

  describe('Error Handling and Recovery', () => {
    test('handles corrupted user data gracefully', async () => {
      const config = {
        jwtSecret: 'corrupt-secret',
        bcryptRounds: 4,
        sessionSecret: 'corrupt-session',
        dataDir: tempDir
      };

      // Write corrupted data
      const usersPath = path.join(tempDir, 'users.json');
      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(usersPath, '{"invalid": json data}');

      // Should handle corruption and initialize empty
      const auth = new AuthenticationManager(config);
      await new Promise(resolve => auth.on('initialized', resolve));

      // Should be able to create users despite corruption
      const user = await auth.createUser({
        username: 'recovery',
        password: 'pass',
        email: 'recovery@test.com',
        role: 'user'
      });

      expect(user).toBeDefined();
      expect(auth.users.size).toBeGreaterThanOrEqual(1);

      auth.removeAllListeners();
    });

    test('handles missing data directory', async () => {
      const missingDir = path.join(tempDir, 'non', 'existent', 'path');
      
      const config = {
        jwtSecret: 'missing-secret',
        bcryptRounds: 4,
        sessionSecret: 'missing-session',
        dataDir: missingDir
      };

      const auth = new AuthenticationManager(config);
      await new Promise(resolve => auth.on('initialized', resolve));

      // Should create directory structure
      const dirExists = await fs.stat(missingDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);

      // Should function normally
      const user = await auth.createUser({
        username: 'dirtest',
        password: 'pass',
        email: 'dir@test.com',
        role: 'user'
      });

      expect(user).toBeDefined();

      auth.removeAllListeners();
    });

    test('handles concurrent access', async () => {
      const config = {
        jwtSecret: 'concurrent-secret',
        bcryptRounds: 4,
        sessionSecret: 'concurrent-session',
        dataDir: tempDir
      };

      // Create multiple auth instances
      const auth1 = new AuthenticationManager(config);
      const auth2 = new AuthenticationManager(config);

      await Promise.all([
        new Promise(resolve => auth1.on('initialized', resolve)),
        new Promise(resolve => auth2.on('initialized', resolve))
      ]);

      // Create users concurrently
      const [user1, user2] = await Promise.all([
        auth1.createUser({
          username: 'concurrent1',
          password: 'pass1',
          email: 'c1@test.com',
          role: 'user'
        }),
        auth2.createUser({
          username: 'concurrent2',
          password: 'pass2',
          email: 'c2@test.com',
          role: 'user'
        })
      ]);

      expect(user1).toBeDefined();
      expect(user2).toBeDefined();

      auth1.removeAllListeners();
      auth2.removeAllListeners();

      // Verify both users exist in new instance
      const auth3 = new AuthenticationManager(config);
      await new Promise(resolve => auth3.on('initialized', resolve));

      const users = Array.from(auth3.users.values());
      const usernames = users.map(u => u.username);

      expect(usernames).toContain('concurrent1');
      expect(usernames).toContain('concurrent2');

      auth3.removeAllListeners();
    });
  });

  describe('Performance and Scalability', () => {
    test('handles large number of users efficiently', async () => {
      const config = {
        jwtSecret: 'scale-secret',
        bcryptRounds: 4,
        sessionSecret: 'scale-session',
        dataDir: tempDir
      };

      const auth = new AuthenticationManager(config);
      await new Promise(resolve => auth.on('initialized', resolve));

      const startTime = Date.now();
      const userCount = 100;

      // Create many users
      const users = [];
      for (let i = 0; i < userCount; i++) {
        const user = await auth.createUser({
          username: `user${i}`,
          password: `pass${i}`,
          email: `user${i}@test.com`,
          role: i % 3 === 0 ? 'admin' : 'user'
        });
        users.push(user);
      }

      const createTime = Date.now() - startTime;
      expect(createTime).toBeLessThan(10000); // Should complete in under 10 seconds

      expect(auth.users.size).toBe(userCount);

      auth.removeAllListeners();

      // Test reload performance
      const reloadStart = Date.now();
      const auth2 = new AuthenticationManager(config);
      await new Promise(resolve => auth2.on('initialized', resolve));
      const reloadTime = Date.now() - reloadStart;

      expect(reloadTime).toBeLessThan(2000); // Should load in under 2 seconds
      expect(auth2.users.size).toBe(userCount);

      auth2.removeAllListeners();
    });

    test('handles large number of tokens efficiently', async () => {
      const config = {
        jwtSecret: 'token-scale-secret',
        bcryptRounds: 4,
        sessionSecret: 'token-scale-session',
        dataDir: tempDir
      };

      const auth = new AuthenticationManager(config);
      await new Promise(resolve => auth.on('initialized', resolve));

      // Create user
      const user = await auth.createUser({
        username: 'tokenscale',
        password: 'pass',
        email: 'scale@test.com',
        role: 'user'
      });

      // Generate many tokens
      const tokenCount = 100;
      const tokens = [];
      
      const startTime = Date.now();
      for (let i = 0; i < tokenCount; i++) {
        const token = auth.generateTokens(user);
        tokens.push(token);
      }
      const generateTime = Date.now() - startTime;

      expect(generateTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(auth.refreshTokens.size).toBe(tokenCount);

      auth.removeAllListeners();

      // Test reload with many tokens
      const reloadStart = Date.now();
      const auth2 = new AuthenticationManager(config);
      await new Promise(resolve => auth2.on('initialized', resolve));
      const reloadTime = Date.now() - reloadStart;

      expect(reloadTime).toBeLessThan(2000); // Should load in under 2 seconds
      expect(auth2.refreshTokens.size).toBe(tokenCount);

      auth2.removeAllListeners();
    });
  });

  describe('Data Integrity', () => {
    test('maintains data integrity across multiple operations', async () => {
      const config = {
        jwtSecret: 'integrity-secret',
        bcryptRounds: 4,
        sessionSecret: 'integrity-session',
        dataDir: tempDir
      };

      const auth = new AuthenticationManager(config);
      await new Promise(resolve => auth.on('initialized', resolve));

      // Perform various operations
      const user1 = await auth.createUser({
        username: 'integrity1',
        password: 'pass1',
        email: 'int1@test.com',
        role: 'admin'
      });

      const user2 = await auth.createUser({
        username: 'integrity2',
        password: 'pass2',
        email: 'int2@test.com',
        role: 'user'
      });

      const tokens1 = auth.generateTokens(user1);
      const tokens2 = auth.generateTokens(user2);

      await auth.updateUser(user1.id, { role: 'superadmin' });
      auth.revokeToken(tokens1.refreshToken);

      const state1 = {
        userCount: auth.users.size,
        tokenCount: auth.refreshTokens.size,
        user1Role: auth.users.get(user1.id).role
      };

      auth.removeAllListeners();

      // Reload and verify state matches
      const auth2 = new AuthenticationManager(config);
      await new Promise(resolve => auth2.on('initialized', resolve));

      const state2 = {
        userCount: auth2.users.size,
        tokenCount: auth2.refreshTokens.size,
        user1Role: auth2.users.get(user1.id).role
      };

      expect(state2).toEqual(state1);

      // Verify specific data points
      expect(auth2.users.get(user1.id).role).toBe('superadmin');
      expect(auth2.refreshTokens.get(jwt.decode(tokens1.refreshToken).jti)).toBeUndefined();
      expect(auth2.refreshTokens.get(jwt.decode(tokens2.refreshToken).jti)).toBeDefined();

      auth2.removeAllListeners();
    });

    test('handles edge cases in persistence', async () => {
      const config = {
        jwtSecret: 'edge-secret',
        bcryptRounds: 4,
        sessionSecret: 'edge-session',
        dataDir: tempDir
      };

      const auth = new AuthenticationManager(config);
      await new Promise(resolve => auth.on('initialized', resolve));

      // Test with special characters in usernames
      const specialUser = await auth.createUser({
        username: 'user@special#chars$',
        password: 'pass!@#$%',
        email: 'special@test.com',
        role: 'user'
      });

      expect(specialUser).toBeDefined();

      // Test with very long values
      const longEmail = 'a'.repeat(200) + '@test.com';
      const longUser = await auth.createUser({
        username: 'longuser',
        password: 'pass',
        email: longEmail,
        role: 'user'
      });

      expect(longUser.email).toBe(longEmail);

      auth.removeAllListeners();

      // Reload and verify special cases
      const auth2 = new AuthenticationManager(config);
      await new Promise(resolve => auth2.on('initialized', resolve));

      const reloadedSpecial = Array.from(auth2.users.values()).find(
        u => u.username === 'user@special#chars$'
      );
      expect(reloadedSpecial).toBeDefined();

      const reloadedLong = Array.from(auth2.users.values()).find(
        u => u.username === 'longuser'
      );
      expect(reloadedLong.email).toBe(longEmail);

      auth2.removeAllListeners();
    });
  });

  describe('Cleanup and Expiration', () => {
    test('cleans up expired tokens on load', async () => {
      const config = {
        jwtSecret: 'expire-secret',
        bcryptRounds: 4,
        sessionSecret: 'expire-session',
        dataDir: tempDir,
        refreshTokenExpiry: '1ms' // Very short expiry for testing
      };

      const auth1 = new AuthenticationManager(config);
      await new Promise(resolve => auth1.on('initialized', resolve));

      const user = await auth1.createUser({
        username: 'expireuser',
        password: 'pass',
        email: 'expire@test.com',
        role: 'user'
      });

      // Generate tokens that will expire immediately
      const tokens = auth1.generateTokens(user);
      const decoded = jwt.decode(tokens.refreshToken);

      // Token should exist initially
      expect(auth1.refreshTokens.get(decoded.jti)).toBeDefined();

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      auth1.removeAllListeners();

      // Reload - expired tokens should be cleaned up
      const auth2 = new AuthenticationManager(config);
      await new Promise(resolve => auth2.on('initialized', resolve));

      // Expired token should not be loaded
      expect(auth2.refreshTokens.get(decoded.jti)).toBeUndefined();

      auth2.removeAllListeners();
    });

    test('periodic cleanup removes expired tokens', async () => {
      const config = {
        jwtSecret: 'cleanup-secret',
        bcryptRounds: 4,
        sessionSecret: 'cleanup-session',
        dataDir: tempDir,
        refreshTokenExpiry: '100ms'
      };

      const auth = new AuthenticationManager(config);
      await new Promise(resolve => auth.on('initialized', resolve));

      const user = await auth.createUser({
        username: 'cleanupuser',
        password: 'pass',
        email: 'cleanup@test.com',
        role: 'user'
      });

      // Generate multiple tokens
      const tokens = [];
      for (let i = 0; i < 5; i++) {
        const token = auth.generateTokens(user);
        tokens.push(token);
      }

      expect(auth.refreshTokens.size).toBe(5);

      // Wait for tokens to expire and cleanup to run
      await new Promise(resolve => setTimeout(resolve, 200));

      // Manually trigger cleanup
      auth.cleanupExpiredTokens();

      expect(auth.refreshTokens.size).toBe(0);

      auth.removeAllListeners();
    });
  });
});