/**
 * Authentication service interface.
 * Defines the contract for user authentication operations including
 * registration, login (email/password and Google OAuth), session management,
 * and token refresh.
 */

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

export interface UserSession {
  userId: string;
  sessionId: string;
  email: string;
  name: string | null;
}

export interface IAuthService {
  /**
   * Register a new user with email and password.
   * Password requirements: min 8 chars, max 128, at least one uppercase, one lowercase, one digit.
   * Email must conform to RFC 5322 format.
   */
  register(email: string, password: string): Promise<AuthResult>;

  /**
   * Login with email and password.
   * Implements account lockout after 5 failed attempts (15 min block).
   * Returns generic error message without revealing which field is incorrect.
   */
  login(email: string, password: string): Promise<AuthResult>;

  /**
   * Login or register using a Google OAuth ID token.
   */
  loginWithGoogle(token: string): Promise<AuthResult>;

  /**
   * End a user session by session ID.
   * Must complete within 2 seconds (Req 14.6).
   */
  logout(sessionId: string): Promise<void>;

  /**
   * Rotate a refresh token and return new access/refresh tokens.
   */
  refreshToken(refreshToken: string): Promise<AuthResult>;

  /**
   * Validate a session token and check for 30-minute inactivity timeout.
   * Updates lastActivity on successful validation.
   */
  validateSession(token: string): Promise<UserSession>;
}
