import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import bcrypt from 'bcryptjs';
import { AuthService, AuthError } from '../auth.service.js';
import { isSessionExpired } from '../../middleware/auth.middleware.js';

// Mock environment variables
vi.stubEnv('JWT_SECRET', 'test-jwt-secret');
vi.stubEnv('JWT_REFRESH_SECRET', 'test-refresh-secret');
vi.stubEnv('GOOGLE_CLIENT_ID', 'test-google-client-id');

// Mock google-auth-library
vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    verifyIdToken: vi.fn(),
  })),
}));

// Mock bcrypt to avoid slow hash operations in property tests
vi.mock('bcryptjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('bcryptjs')>();
  return {
    ...actual,
    default: {
      ...actual,
      hash: vi.fn().mockResolvedValue('$2b$10$mockedhash'),
      compare: vi.fn(),
    },
  };
});

/**
 * Property 14: Bloqueio de Conta após Tentativas Falhas
 *
 * For any conta de usuário, após exatamente 5 tentativas consecutivas de login com falha,
 * a conta SHALL ser bloqueada por 15 minutos. Antes de 5 tentativas, a conta SHALL
 * permanecer desbloqueada. Após o período de bloqueio, a conta SHALL ser desbloqueada.
 *
 * **Validates: Requirements 14.2**
 */
describe('Property 14: Bloqueio de Conta após Tentativas Falhas', () => {
  const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  const MAX_FAILED_ATTEMPTS = 5;

  let mockUserRepository: any;
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockUserRepository = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updateLoginAttempts: vi.fn(),
      createSession: vi.fn(),
      findSession: vi.fn(),
      updateSessionActivity: vi.fn(),
      deleteSession: vi.fn(),
    };

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

  it('should NOT lock account before 5 consecutive failed attempts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 3 }), // failedLoginAttempts before this attempt (0-3)
        async (currentFailedAttempts) => {
          mockUserRepository.findByEmail.mockReset();
          mockUserRepository.updateLoginAttempts.mockReset();

          const user = {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            passwordHash: '$2b$10$somevalidhash',
            failedLoginAttempts: currentFailedAttempts,
            lockedUntil: null,
            googleId: null,
          };

          mockUserRepository.findByEmail.mockResolvedValue(user);
          mockUserRepository.updateLoginAttempts.mockResolvedValue(undefined);
          // Simulate wrong password
          (bcrypt.compare as any).mockResolvedValue(false);

          // Attempt login with wrong password
          try {
            await authService.login('test@example.com', 'WrongPass1');
          } catch (error: any) {
            // Should get INVALID_CREDENTIALS, NOT ACCOUNT_LOCKED
            expect(error.code).toBe('INVALID_CREDENTIALS');
          }

          // Verify the account was NOT locked (lockedUntil should be null)
          expect(mockUserRepository.updateLoginAttempts).toHaveBeenCalledWith(
            'user-123',
            currentFailedAttempts + 1,
            null // no lockout
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should lock account after exactly 5 consecutive failed attempts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(4), // 4 previous failed attempts (the 5th triggers lockout)
        async (currentFailedAttempts) => {
          mockUserRepository.findByEmail.mockReset();
          mockUserRepository.updateLoginAttempts.mockReset();

          const user = {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            passwordHash: '$2b$10$somevalidhash',
            failedLoginAttempts: currentFailedAttempts,
            lockedUntil: null,
            googleId: null,
          };

          mockUserRepository.findByEmail.mockResolvedValue(user);
          mockUserRepository.updateLoginAttempts.mockResolvedValue(undefined);
          // Simulate wrong password
          (bcrypt.compare as any).mockResolvedValue(false);

          const beforeLogin = Date.now();

          // Attempt login with wrong password (5th attempt)
          try {
            await authService.login('test@example.com', 'WrongPass1');
            expect.fail('Expected ACCOUNT_LOCKED error');
          } catch (error: any) {
            expect(error.code).toBe('ACCOUNT_LOCKED');
          }

          const afterLogin = Date.now();

          // Verify the account WAS locked with lockedUntil ~15 min from now
          expect(mockUserRepository.updateLoginAttempts).toHaveBeenCalledTimes(1);
          expect(mockUserRepository.updateLoginAttempts).toHaveBeenCalledWith(
            'user-123',
            MAX_FAILED_ATTEMPTS,
            expect.any(Date)
          );

          const lockedUntilArg = mockUserRepository.updateLoginAttempts.mock.calls[0][2] as Date;
          const lockExpiry = lockedUntilArg.getTime();

          // lockedUntil should be approximately now + 15 minutes
          expect(lockExpiry).toBeGreaterThanOrEqual(beforeLogin + LOCKOUT_DURATION_MS);
          expect(lockExpiry).toBeLessThanOrEqual(afterLogin + LOCKOUT_DURATION_MS);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject login while account is locked (within 15 min window)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Time remaining in lockout (1ms to just under 15 min)
        fc.integer({ min: 1, max: LOCKOUT_DURATION_MS - 1 }),
        async (remainingLockMs) => {
          mockUserRepository.findByEmail.mockReset();

          const user = {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            passwordHash: '$2b$10$somevalidhash',
            failedLoginAttempts: MAX_FAILED_ATTEMPTS,
            lockedUntil: new Date(Date.now() + remainingLockMs),
            googleId: null,
          };

          mockUserRepository.findByEmail.mockResolvedValue(user);

          try {
            await authService.login('test@example.com', 'ValidPass1');
            expect.fail('Expected ACCOUNT_LOCKED error');
          } catch (error: any) {
            expect(error.code).toBe('ACCOUNT_LOCKED');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should unlock account after lockout period expires (>= 15 min elapsed)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Time past the lockout expiry (1ms to 60 min past)
        fc.integer({ min: 1, max: 60 * 60 * 1000 }),
        async (timeAfterExpiry) => {
          mockUserRepository.findByEmail.mockReset();
          mockUserRepository.updateLoginAttempts.mockReset();
          mockUserRepository.createSession.mockReset();

          const user = {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            passwordHash: '$2b$10$somevalidhash',
            failedLoginAttempts: MAX_FAILED_ATTEMPTS,
            lockedUntil: new Date(Date.now() - timeAfterExpiry), // lockout already expired
            googleId: null,
          };

          mockUserRepository.findByEmail.mockResolvedValue(user);
          mockUserRepository.updateLoginAttempts.mockResolvedValue(undefined);
          mockUserRepository.createSession.mockResolvedValue({
            id: 'session-123',
            userId: 'user-123',
            token: 'session-token',
            expiresAt: new Date(Date.now() + 86400000),
            createdAt: new Date(),
            lastActivity: new Date(),
          });
          // Simulate correct password
          (bcrypt.compare as any).mockResolvedValue(true);

          // Login with correct password should succeed after lockout expired
          const result = await authService.login('test@example.com', 'ValidPass1');

          expect(result.accessToken).toBeDefined();
          expect(result.refreshToken).toBeDefined();
          // Should have reset the failed attempts (first call resets lockout, second resets after success)
          expect(mockUserRepository.updateLoginAttempts).toHaveBeenCalledWith(
            'user-123', 0, null
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 15: Expiração de Sessão por Inatividade
 *
 * For any sessão autenticada com última atividade no timestamp T,
 * a sessão SHALL ser considerada válida se e somente se (now - T) ≤ 30 minutos.
 *
 * **Validates: Requirements 14.4**
 */
describe('Property 15: Expiração de Sessão por Inatividade', () => {
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  it('session is valid (not expired) when (now - lastActivity) <= 30 minutes', () => {
    fc.assert(
      fc.property(
        // Offset from now: 0 to 30 minutes in the past (in milliseconds)
        fc.integer({ min: 0, max: SESSION_TIMEOUT_MS }),
        (elapsedMs) => {
          const lastActivity = new Date(Date.now() - elapsedMs);
          const result = isSessionExpired(lastActivity);
          // Session should NOT be expired (valid)
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('session is expired (invalid) when (now - lastActivity) > 30 minutes', () => {
    fc.assert(
      fc.property(
        // Offset from now: more than 30 minutes in the past (30min+1ms to 24h)
        fc.integer({ min: SESSION_TIMEOUT_MS + 1, max: 24 * 60 * 60 * 1000 }),
        (elapsedMs) => {
          const lastActivity = new Date(Date.now() - elapsedMs);
          const result = isSessionExpired(lastActivity);
          // Session SHOULD be expired
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('session expiration is determined exactly at 30-minute boundary', () => {
    fc.assert(
      fc.property(
        fc.constant(0), // dummy value to use fc.assert structure
        () => {
          // At exactly 30 minutes, session should still be valid
          const exactlyAtBoundary = new Date(Date.now() - SESSION_TIMEOUT_MS);
          expect(isSessionExpired(exactlyAtBoundary)).toBe(false);

          // At 30 minutes + 1ms, session should be expired
          const justPastBoundary = new Date(Date.now() - SESSION_TIMEOUT_MS - 1);
          expect(isSessionExpired(justPastBoundary)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isSessionExpired returns boolean for any valid timestamp', () => {
    fc.assert(
      fc.property(
        // Any timestamp within reasonable range (1 year ago to now)
        fc.integer({ min: 0, max: 365 * 24 * 60 * 60 * 1000 }),
        (elapsedMs) => {
          const lastActivity = new Date(Date.now() - elapsedMs);
          const result = isSessionExpired(lastActivity);

          // Result should always be a boolean
          expect(typeof result).toBe('boolean');

          // Core property: expired iff elapsed > 30 minutes
          if (elapsedMs > SESSION_TIMEOUT_MS) {
            expect(result).toBe(true);
          } else {
            expect(result).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
