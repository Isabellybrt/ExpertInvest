import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default-dev-secret';

// Use vi.hoisted to ensure mock functions are available when vi.mock is hoisted
const { mockFindSession, mockUpdateSessionActivity } = vi.hoisted(() => ({
  mockFindSession: vi.fn(),
  mockUpdateSessionActivity: vi.fn(),
}));

// Mock the UserRepository at the module level
vi.mock('../repositories/user.repository.js', () => {
  return {
    UserRepository: vi.fn().mockImplementation(() => ({
      findSession: mockFindSession,
      updateSessionActivity: mockUpdateSessionActivity,
    })),
  };
});

// Import after mocking
import { authMiddleware, isSessionExpired } from './auth.middleware.js';

function createMockRequest(authHeader?: string) {
  return {
    headers: {
      authorization: authHeader,
    },
    user: undefined,
    sessionId: undefined,
  } as any;
}

function createMockReply() {
  const reply: any = {
    statusCode: 200,
    body: null,
  };
  reply.code = vi.fn((code: number) => {
    reply.statusCode = code;
    return reply;
  });
  reply.send = vi.fn((body: any) => {
    reply.body = body;
    return reply;
  });
  return reply;
}

describe('isSessionExpired', () => {
  it('should return false when lastActivity is within 30 minutes', () => {
    const now = new Date();
    const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);
    expect(isSessionExpired(twentyMinutesAgo)).toBe(false);
  });

  it('should return false when lastActivity is exactly at boundary (just under 30 min)', () => {
    const now = new Date();
    const justUnder30Min = new Date(now.getTime() - 29 * 60 * 1000 - 59 * 1000);
    expect(isSessionExpired(justUnder30Min)).toBe(false);
  });

  it('should return true when lastActivity is more than 30 minutes ago', () => {
    const now = new Date();
    const thirtyOneMinutesAgo = new Date(now.getTime() - 31 * 60 * 1000);
    expect(isSessionExpired(thirtyOneMinutesAgo)).toBe(true);
  });

  it('should return true when lastActivity is far in the past', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(isSessionExpired(twoHoursAgo)).toBe(true);
  });

  it('should return false when lastActivity is now', () => {
    expect(isSessionExpired(new Date())).toBe(false);
  });
});

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when no Authorization header is present', async () => {
    const request = createMockRequest(undefined);
    const reply = createMockReply();

    await authMiddleware(request, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  });

  it('should return 401 when Authorization header does not start with Bearer', async () => {
    const request = createMockRequest('Basic abc123');
    const reply = createMockReply();

    await authMiddleware(request, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  });

  it('should return 401 when token is invalid JWT', async () => {
    const request = createMockRequest('Bearer invalid-token');
    const reply = createMockReply();

    await authMiddleware(request, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  });

  it('should return 401 when session is not found in DB', async () => {
    const token = jwt.sign(
      { userId: 'user-1', sessionId: 'session-1' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const request = createMockRequest(`Bearer ${token}`);
    const reply = createMockReply();

    mockFindSession.mockResolvedValue(null);

    await authMiddleware(request, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  });

  it('should return 401 when session is expired (lastActivity > 30 minutes)', async () => {
    const token = jwt.sign(
      { userId: 'user-1', sessionId: 'session-1' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const request = createMockRequest(`Bearer ${token}`);
    const reply = createMockReply();

    const expiredSession = {
      id: 'session-1',
      userId: 'user-1',
      token,
      lastActivity: new Date(Date.now() - 31 * 60 * 1000), // 31 minutes ago
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: new Date(),
      user: {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      },
    };

    mockFindSession.mockResolvedValue(expiredSession);

    await authMiddleware(request, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  });

  it('should attach user and update session when token and session are valid', async () => {
    const token = jwt.sign(
      { userId: 'user-1', sessionId: 'session-1' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const request = createMockRequest(`Bearer ${token}`);
    const reply = createMockReply();

    const validSession = {
      id: 'session-1',
      userId: 'user-1',
      token,
      lastActivity: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: new Date(),
      user: {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      },
    };

    mockFindSession.mockResolvedValue(validSession);
    mockUpdateSessionActivity.mockResolvedValue({});

    await authMiddleware(request, reply);

    expect(reply.code).not.toHaveBeenCalled();
    expect(request.user).toEqual({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
    });
    expect(request.sessionId).toBe('session-1');
    expect(mockUpdateSessionActivity).toHaveBeenCalledWith('session-1');
  });

  it('should return 401 when JWT token is expired', async () => {
    const token = jwt.sign(
      { userId: 'user-1', sessionId: 'session-1' },
      JWT_SECRET,
      { expiresIn: '-1h' } // already expired
    );
    const request = createMockRequest(`Bearer ${token}`);
    const reply = createMockReply();

    await authMiddleware(request, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  });
});
