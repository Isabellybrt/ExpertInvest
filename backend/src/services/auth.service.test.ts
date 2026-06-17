import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { AuthService, AuthError } from './auth.service.js';

// Mock environment variables
vi.stubEnv('JWT_SECRET', 'test-jwt-secret');
vi.stubEnv('JWT_REFRESH_SECRET', 'test-refresh-secret');
vi.stubEnv('GOOGLE_CLIENT_ID', 'test-google-client-id');

// Mock UserRepository
const mockUserRepository = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  updateLoginAttempts: vi.fn(),
  createSession: vi.fn(),
  findSession: vi.fn(),
  updateSessionActivity: vi.fn(),
  deleteSession: vi.fn(),
};

// Mock google-auth-library
vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    verifyIdToken: vi.fn(),
  })),
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRepository.createSession.mockResolvedValue({
      id: 'session-123',
      userId: 'user-123',
      token: 'session-token',
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      lastActivity: new Date(),
    });
    authService = new AuthService(mockUserRepository as any);
  });

  describe('register', () => {
    it('should register a new user with valid email and password', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: null,
        passwordHash: 'hashed',
      });

      const result = await authService.register('test@example.com', 'Password1');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com' })
      );
    });

    it('should reject invalid email format', async () => {
      await expect(authService.register('invalid', 'Password1'))
        .rejects.toThrow(AuthError);
      await expect(authService.register('invalid', 'Password1'))
        .rejects.toMatchObject({ code: 'INVALID_EMAIL' });
    });

    it('should reject password shorter than 8 characters', async () => {
      await expect(authService.register('test@example.com', 'Pass1'))
        .rejects.toThrow(AuthError);
      await expect(authService.register('test@example.com', 'Pass1'))
        .rejects.toMatchObject({ code: 'INVALID_PASSWORD' });
    });

    it('should reject password longer than 128 characters', async () => {
      const longPassword = 'Aa1' + 'x'.repeat(126);
      await expect(authService.register('test@example.com', longPassword))
        .rejects.toThrow(AuthError);
    });

    it('should reject password without uppercase letter', async () => {
      await expect(authService.register('test@example.com', 'password1'))
        .rejects.toMatchObject({ code: 'INVALID_PASSWORD' });
    });

    it('should reject password without lowercase letter', async () => {
      await expect(authService.register('test@example.com', 'PASSWORD1'))
        .rejects.toMatchObject({ code: 'INVALID_PASSWORD' });
    });

    it('should reject password without digit', async () => {
      await expect(authService.register('test@example.com', 'Passwordx'))
        .rejects.toMatchObject({ code: 'INVALID_PASSWORD' });
    });

    it('should reject duplicate email', async () => {
      mockUserRepository.findByEmail.mockResolvedValue({ id: 'existing' });

      await expect(authService.register('test@example.com', 'Password1'))
        .rejects.toMatchObject({ code: 'EMAIL_EXISTS' });
    });

    it('should hash the password before storing', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockImplementation(async (data: any) => ({
        id: 'user-123',
        email: data.email,
        name: null,
        passwordHash: data.passwordHash,
      }));

      await authService.register('test@example.com', 'Password1');

      const createCall = mockUserRepository.create.mock.calls[0]![0];
      expect(createCall.passwordHash).not.toBe('Password1');
      const isValid = await bcrypt.compare('Password1', createCall.passwordHash);
      expect(isValid).toBe(true);
    });
  });

  describe('login', () => {
    const validUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      passwordHash: '',
      failedLoginAttempts: 0,
      lockedUntil: null,
      googleId: null,
    };

    beforeEach(async () => {
      validUser.passwordHash = await bcrypt.hash('Password1', 10);
    });

    it('should login successfully with valid credentials', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(validUser);

      const result = await authService.login('test@example.com', 'Password1');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.id).toBe('user-123');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should return generic error for invalid email', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login('wrong@example.com', 'Password1'))
        .rejects.toMatchObject({
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        });
    });

    it('should return generic error for invalid password', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(validUser);

      await expect(authService.login('test@example.com', 'WrongPass1'))
        .rejects.toMatchObject({
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        });
    });

    it('should increment failed attempts on wrong password', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(validUser);

      await expect(authService.login('test@example.com', 'WrongPass1'))
        .rejects.toThrow();

      expect(mockUserRepository.updateLoginAttempts).toHaveBeenCalledWith(
        'user-123', 1, null
      );
    });

    it('should lock account after 5 failed attempts', async () => {
      const userWith4Failures = { ...validUser, failedLoginAttempts: 4 };
      mockUserRepository.findByEmail.mockResolvedValue(userWith4Failures);

      await expect(authService.login('test@example.com', 'WrongPass1'))
        .rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' });

      expect(mockUserRepository.updateLoginAttempts).toHaveBeenCalledWith(
        'user-123',
        5,
        expect.any(Date)
      );
    });

    it('should reject login when account is locked', async () => {
      const lockedUser = {
        ...validUser,
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 600000), // locked for 10 more minutes
      };
      mockUserRepository.findByEmail.mockResolvedValue(lockedUser);

      await expect(authService.login('test@example.com', 'Password1'))
        .rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' });
    });

    it('should allow login after lockout period expires', async () => {
      const expiredLockUser = {
        ...validUser,
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() - 1000), // lock expired
      };
      mockUserRepository.findByEmail.mockResolvedValue(expiredLockUser);

      const result = await authService.login('test@example.com', 'Password1');

      expect(result.accessToken).toBeDefined();
      expect(mockUserRepository.updateLoginAttempts).toHaveBeenCalledWith(
        'user-123', 0, null
      );
    });

    it('should reset failed attempts on successful login', async () => {
      const userWith3Failures = { ...validUser, failedLoginAttempts: 3 };
      mockUserRepository.findByEmail.mockResolvedValue(userWith3Failures);

      await authService.login('test@example.com', 'Password1');

      expect(mockUserRepository.updateLoginAttempts).toHaveBeenCalledWith(
        'user-123', 0, null
      );
    });
  });

  describe('logout', () => {
    it('should delete the session', async () => {
      mockUserRepository.deleteSession.mockResolvedValue(undefined);

      await authService.logout('session-123');

      expect(mockUserRepository.deleteSession).toHaveBeenCalledWith('session-123');
    });
  });

  describe('refreshToken', () => {
    it('should return new tokens with valid refresh token', async () => {
      const refreshToken = jwt.sign(
        { userId: 'user-123', email: 'test@example.com' },
        'test-refresh-secret',
        { expiresIn: '7d' }
      );
      mockUserRepository.findById.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test',
      });

      const result = await authService.refreshToken(refreshToken);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.id).toBe('user-123');
    });

    it('should reject invalid refresh token', async () => {
      await expect(authService.refreshToken('invalid-token'))
        .rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    });

    it('should reject expired refresh token', async () => {
      const expiredToken = jwt.sign(
        { userId: 'user-123', email: 'test@example.com' },
        'test-refresh-secret',
        { expiresIn: '0s' }
      );
      // Wait a tiny bit for the token to expire
      await new Promise(r => setTimeout(r, 10));

      await expect(authService.refreshToken(expiredToken))
        .rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    });
  });

  describe('validateSession', () => {
    it('should validate an active session and update activity', async () => {
      const token = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', sessionId: 'session-123' },
        'test-jwt-secret',
        { expiresIn: '15m' }
      );
      mockUserRepository.findSession.mockResolvedValue({
        id: 'session-123',
        userId: 'user-123',
        token: 'session-token',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        lastActivity: new Date(), // just now
        user: { email: 'test@example.com', name: 'Test' },
      });
      mockUserRepository.updateSessionActivity.mockResolvedValue(undefined);

      const session = await authService.validateSession(token);

      expect(session.userId).toBe('user-123');
      expect(session.sessionId).toBe('session-123');
      expect(session.email).toBe('test@example.com');
      expect(mockUserRepository.updateSessionActivity).toHaveBeenCalledWith('session-123');
    });

    it('should reject session inactive for more than 30 minutes', async () => {
      const token = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', sessionId: 'session-123' },
        'test-jwt-secret',
        { expiresIn: '15m' }
      );
      mockUserRepository.findSession.mockResolvedValue({
        id: 'session-123',
        userId: 'user-123',
        token: 'session-token',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        lastActivity: new Date(Date.now() - 31 * 60 * 1000), // 31 minutes ago
        user: { email: 'test@example.com', name: 'Test' },
      });
      mockUserRepository.deleteSession.mockResolvedValue(undefined);

      await expect(authService.validateSession(token))
        .rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
      expect(mockUserRepository.deleteSession).toHaveBeenCalledWith('session-123');
    });

    it('should reject an invalid JWT token', async () => {
      await expect(authService.validateSession('invalid-token'))
        .rejects.toMatchObject({ code: 'INVALID_TOKEN' });
    });

    it('should reject when session not found in DB', async () => {
      const token = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', sessionId: 'missing-session' },
        'test-jwt-secret',
        { expiresIn: '15m' }
      );
      mockUserRepository.findSession.mockResolvedValue(null);

      await expect(authService.validateSession(token))
        .rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
    });
  });
});
