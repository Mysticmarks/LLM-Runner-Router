/**
 * Tests for Enterprise Authentication
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import EnterpriseAuthManager, { AuthMethods, UserRoles, Permissions, SessionTypes } from '../../src/enterprise/EnterpriseAuth.js';

describe('EnterpriseAuthManager', () => {
  let authManager;

  beforeEach(() => {
    authManager = new EnterpriseAuthManager({
      jwtSecret: 'test-secret',
      jwtExpiration: '1h',
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      mfaRequired: false,
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: false
      }
    });
  });

  afterEach(() => {
    // Cleanup
  });

  describe('User Registration', () => {
    it('should register a new user', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'TestPass123',
        displayName: 'Test User',
        roles: [UserRoles.USER]
      };

      const user = await authManager.registerUser(userData);

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(user.displayName).toBe('Test User');
      expect(user.roles).toContain(UserRoles.USER);
      expect(user.status).toBe('active');
      expect(user.passwordHash).toBeUndefined(); // Should be filtered out
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        email: 'test@example.com'
        // Missing username
      };

      await expect(authManager.registerUser(incompleteData))
        .rejects.toThrow('Username is required');
    });

    it('should validate email format', async () => {
      const userData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'TestPass123'
      };

      await expect(authManager.registerUser(userData))
        .rejects.toThrow('Invalid email format');
    });

    it('should validate password policy', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'weak' // Doesn't meet policy
      };

      await expect(authManager.registerUser(userData))
        .rejects.toThrow('Password does not meet policy requirements');
    });

    it('should prevent duplicate usernames', async () => {
      const userData = {
        username: 'duplicate',
        email: 'first@example.com',
        password: 'TestPass123'
      };

      await authManager.registerUser(userData);

      // Try to register again with same username
      const duplicateData = {
        username: 'duplicate',
        email: 'second@example.com',
        password: 'TestPass123'
      };

      await expect(authManager.registerUser(duplicateData))
        .rejects.toThrow('Username already exists');
    });

    it('should prevent duplicate emails', async () => {
      const userData = {
        username: 'first',
        email: 'duplicate@example.com',
        password: 'TestPass123'
      };

      await authManager.registerUser(userData);

      // Try to register again with same email
      const duplicateData = {
        username: 'second',
        email: 'duplicate@example.com',
        password: 'TestPass123'
      };

      await expect(authManager.registerUser(duplicateData))
        .rejects.toThrow('Email already exists');
    });
  });

  describe('Authentication', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await authManager.registerUser({
        username: 'authtest',
        email: 'authtest@example.com',
        password: 'AuthTest123',
        roles: [UserRoles.USER]
      });
    });

    it('should authenticate with valid credentials', async () => {
      const result = await authManager.authenticate('authtest', 'AuthTest123');

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.username).toBe('authtest');
      expect(result.session).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should authenticate with email', async () => {
      const result = await authManager.authenticate('authtest@example.com', 'AuthTest123');

      expect(result.user.username).toBe('authtest');
    });

    it('should reject invalid credentials', async () => {
      await expect(
        authManager.authenticate('authtest', 'wrongpassword')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject unknown user', async () => {
      await expect(
        authManager.authenticate('unknown', 'password')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject inactive user', async () => {
      // Deactivate user by updating the stored user object
      const storedUser = authManager.users.get(testUser.id);
      storedUser.status = 'inactive';

      await expect(
        authManager.authenticate('authtest', 'AuthTest123')
      ).rejects.toThrow('Account inactive');
    });

    it('should handle MFA when required', async () => {
      // Enable MFA for user
      await authManager.enableMFA(testUser.id);

      const result = await authManager.authenticate('authtest', 'AuthTest123');

      expect(result.requiresMFA).toBe(true);
      expect(result.mfaMethods).toBeDefined();
      expect(result.tempToken).toBeDefined();
    });

    it('should complete MFA authentication', async () => {
      // Enable MFA for user
      await authManager.enableMFA(testUser.id);

      const result = await authManager.authenticate('authtest', 'AuthTest123', {
        mfaToken: '123456' // Mock MFA token
      });

      expect(result.user).toBeDefined();
      expect(result.token).toBeDefined();
    });

    it('should track failed login attempts', async () => {
      // Make several failed attempts
      for (let i = 0; i < 3; i++) {
        try {
          await authManager.authenticate('authtest', 'wrongpassword');
        } catch (error) {
          // Expected to fail
        }
      }

      const attempts = authManager.loginAttempts.get(testUser.id);
      expect(attempts).toBeDefined();
      expect(attempts.count).toBe(3);
    });

    it('should block user after too many failed attempts', async () => {
      // Make enough failed attempts to trigger block
      for (let i = 0; i < 6; i++) {
        try {
          await authManager.authenticate('authtest', 'wrongpassword');
        } catch (error) {
          // Expected to fail
        }
      }

      // Next attempt should be blocked
      await expect(
        authManager.authenticate('authtest', 'AuthTest123')
      ).rejects.toThrow('Account temporarily locked');
    });
  });

  describe('Token Management', () => {
    let authResult;

    beforeEach(async () => {
      const user = await authManager.registerUser({
        username: 'tokentest',
        email: 'tokentest@example.com',
        password: 'TokenTest123'
      });

      authResult = await authManager.authenticate('tokentest', 'TokenTest123');
    });

    it('should validate valid token', async () => {
      const validation = await authManager.validateToken(authResult.token);

      expect(validation).toBeDefined();
      expect(validation.user).toBeDefined();
      expect(validation.user.username).toBe('tokentest');
      expect(validation.session).toBeDefined();
      expect(validation.permissions).toBeDefined();
    });

    it('should reject invalid token', async () => {
      await expect(
        authManager.validateToken('invalid.token.here')
      ).rejects.toThrow('Invalid token');
    });

    it('should reject expired session', async () => {
      // Manually expire the session
      const session = authResult.session;
      session.expiresAt = new Date(Date.now() - 1000); // 1 second ago

      await expect(
        authManager.validateToken(authResult.token)
      ).rejects.toThrow('Session expired');
    });

    it('should refresh token', async () => {
      const refreshed = await authManager.refreshToken(authResult.session.refreshToken);

      expect(refreshed).toBeDefined();
      expect(refreshed.token).toBeDefined();
      expect(refreshed.token).not.toBe(authResult.token); // Should be different
      expect(refreshed.refreshToken).toBeDefined();
      expect(refreshed.expiresAt).toBeInstanceOf(Date);
    });

    it('should reject invalid refresh token', async () => {
      await expect(
        authManager.refreshToken('invalid-refresh-token')
      ).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('Session Management', () => {
    let user, authResult;

    beforeEach(async () => {
      user = await authManager.registerUser({
        username: 'sessiontest',
        email: 'sessiontest@example.com',
        password: 'SessionTest123'
      });

      authResult = await authManager.authenticate('sessiontest', 'SessionTest123');
    });

    it('should create session on authentication', () => {
      expect(authResult.session).toBeDefined();
      expect(authResult.session.id).toBeDefined();
      expect(authResult.session.userId).toBe(user.id);
      expect(authResult.session.type).toBe(SessionTypes.INTERACTIVE);
      expect(authResult.session.createdAt).toBeInstanceOf(Date);
    });

    it('should logout user', async () => {
      await authManager.logout(authResult.session.id);

      // Session should be removed
      const session = authManager.sessions.get(authResult.session.id);
      expect(session).toBeUndefined();

      // Token should no longer be valid
      await expect(
        authManager.validateToken(authResult.token)
      ).rejects.toThrow('Session not found');
    });

    it('should enforce maximum sessions per user', async () => {
      // Create multiple sessions (assuming maxSessions = 5)
      const sessions = [];
      for (let i = 0; i < 6; i++) {
        const result = await authManager.authenticate('sessiontest', 'SessionTest123');
        sessions.push(result.session);
      }

      // First session should be removed
      const firstSession = authManager.sessions.get(sessions[0].id);
      expect(firstSession).toBeUndefined();
    });
  });

  describe('API Key Management', () => {
    let user;

    beforeEach(async () => {
      user = await authManager.registerUser({
        username: 'apitest',
        email: 'apitest@example.com',
        password: 'ApiTest123',
        roles: [UserRoles.DEVELOPER]
      });
    });

    it('should create API key', async () => {
      const apiKey = await authManager.createAPIKey(user.id, {
        name: 'Test API Key',
        permissions: [Permissions.API_READ, Permissions.API_WRITE]
      });

      expect(apiKey).toBeDefined();
      expect(apiKey.id).toBeDefined();
      expect(apiKey.key).toBeDefined();
      expect(apiKey.userId).toBe(user.id);
      expect(apiKey.name).toBe('Test API Key');
      expect(apiKey.permissions).toContain(Permissions.API_READ);
      expect(apiKey.enabled).toBe(true);
    });

    it('should validate API key', async () => {
      const apiKey = await authManager.createAPIKey(user.id, {
        name: 'Validation Test Key',
        permissions: [Permissions.MODEL_INFERENCE]
      });

      const validation = await authManager.validateAPIKey(apiKey.key);

      expect(validation).toBeDefined();
      expect(validation.user.id).toBe(user.id);
      expect(validation.apiKey.id).toBe(apiKey.id);
      expect(validation.permissions).toContain(Permissions.MODEL_INFERENCE);
    });

    it('should reject invalid API key', async () => {
      await expect(
        authManager.validateAPIKey('invalid-api-key')
      ).rejects.toThrow('Invalid API key');
    });

    it('should reject expired API key', async () => {
      const apiKey = await authManager.createAPIKey(user.id, {
        name: 'Expired Key',
        expiresAt: new Date(Date.now() - 1000) // Already expired
      });

      await expect(
        authManager.validateAPIKey(apiKey.key)
      ).rejects.toThrow('API key expired');
    });

    it('should track API key usage', async () => {
      const apiKey = await authManager.createAPIKey(user.id, {
        name: 'Usage Test Key'
      });

      expect(apiKey.usageCount).toBe(0);
      expect(apiKey.lastUsedAt).toBeNull();

      await authManager.validateAPIKey(apiKey.key);

      expect(apiKey.usageCount).toBe(1);
      expect(apiKey.lastUsedAt).toBeInstanceOf(Date);
    });
  });

  describe('Role-Based Access Control', () => {
    let user;

    beforeEach(async () => {
      user = await authManager.registerUser({
        username: 'rbactest',
        email: 'rbactest@example.com',
        password: 'RbacTest123',
        roles: [UserRoles.USER]
      });
    });

    it('should assign role to user', async () => {
      await authManager.assignRole(user.id, UserRoles.ADMIN);

      expect(user.roles).toContain(UserRoles.ADMIN);
    });

    it('should remove role from user', async () => {
      await authManager.assignRole(user.id, UserRoles.ADMIN);
      await authManager.removeRole(user.id, UserRoles.ADMIN);

      expect(user.roles).not.toContain(UserRoles.ADMIN);
    });

    it('should get user permissions', async () => {
      await authManager.assignRole(user.id, UserRoles.DEVELOPER);

      const permissions = await authManager.getUserPermissions(user);

      expect(permissions).toContain(Permissions.MODEL_INFERENCE);
      expect(permissions).toContain(Permissions.DATA_READ);
      expect(permissions).toContain(Permissions.API_READ);
    });

    it('should check permissions', async () => {
      await authManager.assignRole(user.id, UserRoles.ADMIN);
      const permissions = await authManager.getUserPermissions(user);

      const hasPermission = await authManager.checkPermission(
        { permissions },
        Permissions.USER_CREATE
      );

      expect(hasPermission).toBe(true);
    });

    it('should deny permission for insufficient role', async () => {
      // User role should not have admin permissions
      const permissions = await authManager.getUserPermissions(user);

      const hasPermission = await authManager.checkPermission(
        { permissions },
        Permissions.SYSTEM_ADMIN
      );

      expect(hasPermission).toBe(false);
    });

    it('should support wildcard permissions', async () => {
      // Add wildcard permission
      user.permissions = ['api:*'];
      const permissions = await authManager.getUserPermissions(user);

      const hasReadPermission = await authManager.checkPermission(
        { permissions },
        Permissions.API_READ
      );

      const hasWritePermission = await authManager.checkPermission(
        { permissions },
        Permissions.API_WRITE
      );

      expect(hasReadPermission).toBe(true);
      expect(hasWritePermission).toBe(true);
    });
  });

  describe('Multi-Factor Authentication', () => {
    let user;

    beforeEach(async () => {
      user = await authManager.registerUser({
        username: 'mfatest',
        email: 'mfatest@example.com',
        password: 'MfaTest123'
      });
    });

    it('should enable MFA for user', async () => {
      const result = await authManager.enableMFA(user.id);

      expect(result).toBeDefined();
      expect(result.secret).toBeDefined();
      expect(result.qrCode).toBeDefined();
      
      // Check the stored user object, not the returned clean object
      const storedUser = authManager.users.get(user.id);
      expect(storedUser.mfaEnabled).toBe(true);
      expect(storedUser.mfaSecret).toBeDefined();
    });

    it('should prevent enabling MFA twice', async () => {
      await authManager.enableMFA(user.id);

      await expect(
        authManager.enableMFA(user.id)
      ).rejects.toThrow('MFA already enabled');
    });

    it('should require MFA during authentication', async () => {
      await authManager.enableMFA(user.id);

      const result = await authManager.authenticate('mfatest', 'MfaTest123');

      expect(result.requiresMFA).toBe(true);
      expect(result.tempToken).toBeDefined();
    });
  });

  describe('External Provider Authentication', () => {
    it('should authenticate with external provider', async () => {
      // Mock SAML provider
      authManager.authProviders.set(AuthMethods.SAML, {
        validate: async (data) => ({
          id: 'saml-user-123',
          username: 'samluser',
          email: 'saml@example.com',
          displayName: 'SAML User'
        })
      });

      const result = await authManager.authenticateWithProvider(
        AuthMethods.SAML,
        { assertion: 'mock-saml-assertion' }
      );

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.username).toBe('samluser');
      expect(result.user.authMethod).toBe(AuthMethods.SAML);
      expect(result.token).toBeDefined();
    });

    it('should handle unknown provider', async () => {
      await expect(
        authManager.authenticateWithProvider('unknown-provider', {})
      ).rejects.toThrow('Unknown auth provider');
    });
  });

  describe('Password Policies', () => {
    it('should enforce minimum length', async () => {
      const userData = {
        username: 'policytest',
        email: 'policy@example.com',
        password: 'short' // Too short
      };

      await expect(authManager.registerUser(userData))
        .rejects.toThrow('Password does not meet policy requirements');
    });

    it('should require uppercase when configured', async () => {
      const userData = {
        username: 'policytest',
        email: 'policy@example.com',
        password: 'lowercase123' // No uppercase
      };

      await expect(authManager.registerUser(userData))
        .rejects.toThrow('Password does not meet policy requirements');
    });

    it('should require numbers when configured', async () => {
      const userData = {
        username: 'policytest',
        email: 'policy@example.com',
        password: 'NoNumbers' // No numbers
      };

      await expect(authManager.registerUser(userData))
        .rejects.toThrow('Password does not meet policy requirements');
    });
  });

  describe('Events', () => {
    it('should emit user-registered event', async () => {
      const eventHandler = jest.fn();
      authManager.on('user-registered', eventHandler);

      const user = await authManager.registerUser({
        username: 'eventtest',
        email: 'event@example.com',
        password: 'EventTest123'
      });

      expect(eventHandler).toHaveBeenCalledWith(user);
    });

    it('should emit user-authenticated event', async () => {
      const user = await authManager.registerUser({
        username: 'eventtest',
        email: 'event@example.com',
        password: 'EventTest123'
      });

      const eventHandler = jest.fn();
      authManager.on('user-authenticated', eventHandler);

      await authManager.authenticate('eventtest', 'EventTest123');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.id,
          username: 'eventtest'
        })
      );
    });

    it('should emit authentication-failed event', async () => {
      const user = await authManager.registerUser({
        username: 'eventtest',
        email: 'event@example.com',
        password: 'EventTest123'
      });

      const eventHandler = jest.fn();
      authManager.on('authentication-failed', eventHandler);

      try {
        await authManager.authenticate('eventtest', 'wrongpassword');
      } catch (error) {
        // Expected to fail
      }

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'eventtest',
          error: 'Invalid credentials'
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid user ID in role assignment', async () => {
      await expect(
        authManager.assignRole('invalid-user-id', UserRoles.ADMIN)
      ).rejects.toThrow('User not found');
    });

    it('should handle invalid role assignment', async () => {
      const user = await authManager.registerUser({
        username: 'errortest',
        email: 'error@example.com',
        password: 'ErrorTest123'
      });

      await expect(
        authManager.assignRole(user.id, 'invalid-role')
      ).rejects.toThrow('Role not found');
    });

    it('should handle API key creation for invalid user', async () => {
      await expect(
        authManager.createAPIKey('invalid-user-id')
      ).rejects.toThrow('User not found');
    });

    it('should handle MFA enable for invalid user', async () => {
      await expect(
        authManager.enableMFA('invalid-user-id')
      ).rejects.toThrow('User not found');
    });
  });

  describe('Security Features', () => {
    it('should not expose sensitive data in user objects', async () => {
      const user = await authManager.registerUser({
        username: 'securitytest',
        email: 'security@example.com',
        password: 'SecurityTest123'
      });

      expect(user.passwordHash).toBeUndefined();
      expect(user.mfaSecret).toBeUndefined();
    });

    it('should not expose API keys in validation response', async () => {
      const user = await authManager.registerUser({
        username: 'securitytest',
        email: 'security@example.com',
        password: 'SecurityTest123'
      });

      const apiKey = await authManager.createAPIKey(user.id);
      const validation = await authManager.validateAPIKey(apiKey.key);

      expect(validation.apiKey.key).toBeUndefined();
    });

    it('should handle logout gracefully for invalid session', async () => {
      // Should not throw error
      await authManager.logout('invalid-session-id');
    });
  });
});