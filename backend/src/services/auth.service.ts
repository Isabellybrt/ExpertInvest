import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { UserRepository } from '../repositories/user.repository.js';
import type { IAuthService, AuthResult, UserSession } from './interfaces/auth.interface.js';

// Constants
const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// Validation patterns
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

export class AuthService implements IAuthService {
  private userRepository: UserRepository;
  private googleClient: OAuth2Client;
  private jwtSecret: string;
  private jwtRefreshSecret: string;
  private googleClientId: string;

  constructor(userRepository?: UserRepository) {
    this.userRepository = userRepository ?? new UserRepository();

    this.jwtSecret = process.env.JWT_SECRET ?? '';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET ?? '';
    this.googleClientId = process.env.GOOGLE_CLIENT_ID ?? '';

    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    if (!this.jwtRefreshSecret) {
      throw new Error('JWT_REFRESH_SECRET environment variable is required');
    }

    this.googleClient = new OAuth2Client(this.googleClientId);
  }

  async register(email: string, password: string): Promise<AuthResult> {
    this.validateEmail(email);
    this.validatePassword(password);

    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new AuthError('Email already registered', 'EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await this.userRepository.create({
      email,
      passwordHash,
    });

    return this.createSessionAndTokens(user.id, user.email, user.name);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    // Generic error message to avoid revealing which field is incorrect (Req 14.2)
    const genericError = new AuthError(
      'Invalid email or password',
      'INVALID_CREDENTIALS'
    );

    if (!email || !password) {
      throw genericError;
    }

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw genericError;
    }

    // Check if account is locked (Req 14.2)
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AuthError(
        'Account temporarily locked. Please try again later.',
        'ACCOUNT_LOCKED'
      );
    }

    // If lockout has expired, reset the counter
    if (user.lockedUntil && user.lockedUntil <= new Date()) {
      await this.userRepository.updateLoginAttempts(user.id, 0, null);
    }

    // User registered via Google only (no password set)
    if (!user.passwordHash) {
      throw genericError;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      const newAttempts = user.failedLoginAttempts + 1;

      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        // Lock account for 15 minutes (Req 14.2)
        const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await this.userRepository.updateLoginAttempts(user.id, newAttempts, lockedUntil);
        throw new AuthError(
          'Account temporarily locked. Please try again later.',
          'ACCOUNT_LOCKED'
        );
      }

      await this.userRepository.updateLoginAttempts(user.id, newAttempts, null);
      throw genericError;
    }

    // Successful login: reset failed attempts (Req 14.3)
    if (user.failedLoginAttempts > 0) {
      await this.userRepository.updateLoginAttempts(user.id, 0, null);
    }

    return this.createSessionAndTokens(user.id, user.email, user.name);
  }

  async loginWithGoogle(token: string): Promise<AuthResult> {
    if (!this.googleClientId) {
      throw new AuthError('Google OAuth is not configured', 'OAUTH_NOT_CONFIGURED');
    }

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: token,
        audience: this.googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new AuthError('Invalid Google token', 'INVALID_GOOGLE_TOKEN');
    }

    if (!payload || !payload.email) {
      throw new AuthError('Invalid Google token payload', 'INVALID_GOOGLE_TOKEN');
    }

    const { email, sub: googleId, name } = payload;

    // Check if user already exists by email
    let user = await this.userRepository.findByEmail(email);

    if (user) {
      // Link Google account if not already linked
      if (!user.googleId) {
        // We would update the user's googleId here, but the repository
        // currently doesn't have an update method for this.
        // For now, proceed with existing user.
      }
    } else {
      // Create new user via Google
      user = await this.userRepository.create({
        email,
        googleId,
        name: name ?? null,
      });
    }

    return this.createSessionAndTokens(user.id, user.email, user.name);
  }

  async logout(sessionId: string): Promise<void> {
    // Must complete within 2 seconds (Req 14.6)
    await this.userRepository.deleteSession(sessionId);
  }

  async refreshToken(refreshToken: string): Promise<AuthResult> {
    let decoded: jwt.JwtPayload;
    try {
      decoded = jwt.verify(refreshToken, this.jwtRefreshSecret) as jwt.JwtPayload;
    } catch {
      throw new AuthError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }

    if (!decoded.userId || !decoded.email) {
      throw new AuthError('Invalid refresh token payload', 'INVALID_REFRESH_TOKEN');
    }

    const user = await this.userRepository.findById(decoded.userId as string);
    if (!user) {
      throw new AuthError('User not found', 'USER_NOT_FOUND');
    }

    // Issue new token pair (rotation)
    return this.generateTokens(user.id, user.email, user.name);
  }

  async validateSession(token: string): Promise<UserSession> {
    let decoded: jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, this.jwtSecret) as jwt.JwtPayload;
    } catch {
      throw new AuthError('Invalid or expired token', 'INVALID_TOKEN');
    }

    if (!decoded.sessionId) {
      throw new AuthError('Invalid token payload', 'INVALID_TOKEN');
    }

    const session = await this.userRepository.findSession(decoded.sessionId as string);
    if (!session) {
      throw new AuthError('Session not found', 'SESSION_NOT_FOUND');
    }

    // Check 30-minute inactivity timeout (Req 14.4)
    const now = new Date();
    const lastActivity = new Date(session.lastActivity);
    const inactiveMs = now.getTime() - lastActivity.getTime();

    if (inactiveMs > SESSION_INACTIVITY_TIMEOUT_MS) {
      // Session expired due to inactivity - clean up
      await this.userRepository.deleteSession(session.id);
      throw new AuthError('Session expired due to inactivity', 'SESSION_EXPIRED');
    }

    // Update last activity
    await this.userRepository.updateSessionActivity(session.id);

    return {
      userId: session.userId,
      sessionId: session.id,
      email: session.user.email,
      name: session.user.name,
    };
  }

  // --- Private helpers ---

  private validateEmail(email: string): void {
    if (!email || !EMAIL_REGEX.test(email)) {
      throw new AuthError(
        'Invalid email format',
        'INVALID_EMAIL'
      );
    }
  }

  private validatePassword(password: string): void {
    if (!password) {
      throw new AuthError(
        'Password is required',
        'INVALID_PASSWORD'
      );
    }
    if (password.length < 8) {
      throw new AuthError(
        'Password must be at least 8 characters',
        'INVALID_PASSWORD'
      );
    }
    if (password.length > 128) {
      throw new AuthError(
        'Password must be at most 128 characters',
        'INVALID_PASSWORD'
      );
    }
    if (!PASSWORD_REGEX.test(password)) {
      throw new AuthError(
        'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
        'INVALID_PASSWORD'
      );
    }
  }

  private async createSessionAndTokens(
    userId: string,
    email: string,
    name: string | null
  ): Promise<AuthResult> {
    // Create session with 30-minute inactivity-based expiry
    // We set expiresAt to a generous maximum (e.g., 24h) but enforce inactivity timeout via lastActivity
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const sessionToken = this.generateSessionToken(userId);

    const session = await this.userRepository.createSession({
      userId,
      token: sessionToken,
      expiresAt,
    });

    // Generate JWT tokens with session reference
    const accessToken = jwt.sign(
      { userId, email, sessionId: session.id },
      this.jwtSecret,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { userId, email, sessionId: session.id },
      this.jwtRefreshSecret,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    return {
      accessToken,
      refreshToken,
      user: { id: userId, email, name },
    };
  }

  private generateTokens(
    userId: string,
    email: string,
    name: string | null
  ): AuthResult {
    const accessToken = jwt.sign(
      { userId, email },
      this.jwtSecret,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { userId, email },
      this.jwtRefreshSecret,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    return {
      accessToken,
      refreshToken,
      user: { id: userId, email, name },
    };
  }

  private generateSessionToken(userId: string): string {
    return jwt.sign(
      { userId, purpose: 'session', iat: Date.now() },
      this.jwtSecret
    );
  }
}

/**
 * Custom authentication error with error codes for programmatic handling.
 */
export class AuthError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}
