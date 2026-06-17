import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FIIService, FIIServiceError } from './fii.service.js';

// Mock FIIRepository
const mockFIIRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByUserId: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  createQuote: vi.fn(),
  getLatestQuote: vi.fn(),
  createDividend: vi.fn(),
  getLatestDividend: vi.fn(),
};

describe('FIIService', () => {
  let fiiService: FIIService;

  const validFIIData = {
    ticker: 'MXRF11',
    shares: 100,
    averagePrice: 10.5,
    purchaseDate: '2024-01-15T00:00:00.000Z',
  };

  const userId = 'user-123';

  const mockFII = {
    id: 'fii-123',
    userId: 'user-123',
    ticker: 'MXRF11',
    shares: 100,
    averagePrice: 10.5,
    purchaseDate: new Date('2024-01-15T00:00:00.000Z'),
    createdAt: new Date('2024-01-15T00:00:00.000Z'),
    updatedAt: new Date('2024-01-15T00:00:00.000Z'),
    quotes: [],
    dividends: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    fiiService = new FIIService(mockFIIRepository as any);
  });

  describe('create', () => {
    it('should create a FII with valid data', async () => {
      mockFIIRepository.create.mockResolvedValue(mockFII);

      const result = await fiiService.create(userId, validFIIData);

      expect(result.id).toBe('fii-123');
      expect(result.ticker).toBe('MXRF11');
      expect(result.shares).toBe(100);
      expect(result.averagePrice).toBe(10.5);
      expect(mockFIIRepository.create).toHaveBeenCalledWith({
        userId,
        ticker: 'MXRF11',
        shares: 100,
        averagePrice: 10.5,
        purchaseDate: new Date('2024-01-15T00:00:00.000Z'),
      });
    });

    it('should reject ticker with lowercase letters', async () => {
      const invalidData = { ...validFIIData, ticker: 'mxrf11' };

      await expect(fiiService.create(userId, invalidData))
        .rejects.toBeInstanceOf(FIIServiceError);
      await expect(fiiService.create(userId, invalidData))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });

    it('should reject ticker with wrong format (3 letters + 2 digits)', async () => {
      const invalidData = { ...validFIIData, ticker: 'MXR11' };

      await expect(fiiService.create(userId, invalidData))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });

    it('should reject ticker with wrong format (4 letters + 1 digit)', async () => {
      const invalidData = { ...validFIIData, ticker: 'MXRF1' };

      await expect(fiiService.create(userId, invalidData))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });

    it('should reject ticker with wrong format (4 letters + 3 digits)', async () => {
      const invalidData = { ...validFIIData, ticker: 'MXRF111' };

      await expect(fiiService.create(userId, invalidData))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });

    it('should reject ticker with special characters', async () => {
      const invalidData = { ...validFIIData, ticker: 'MXR@11' };

      await expect(fiiService.create(userId, invalidData))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });

    it('should accept valid tickers (HGLG11, XPML11, VISC11)', async () => {
      mockFIIRepository.create.mockResolvedValue(mockFII);

      // These should not throw
      await fiiService.create(userId, { ...validFIIData, ticker: 'HGLG11' });
      await fiiService.create(userId, { ...validFIIData, ticker: 'XPML11' });
      await fiiService.create(userId, { ...validFIIData, ticker: 'VISC11' });

      expect(mockFIIRepository.create).toHaveBeenCalledTimes(3);
    });

    it('should reject shares less than 1', async () => {
      const invalidData = { ...validFIIData, shares: 0 };

      await expect(fiiService.create(userId, invalidData))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });

    it('should reject negative shares', async () => {
      const invalidData = { ...validFIIData, shares: -5 };

      await expect(fiiService.create(userId, invalidData))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });

    it('should reject non-integer shares', async () => {
      const invalidData = { ...validFIIData, shares: 10.5 };

      await expect(fiiService.create(userId, invalidData))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });

    it('should accept shares equal to 1', async () => {
      mockFIIRepository.create.mockResolvedValue({ ...mockFII, shares: 1 });

      const result = await fiiService.create(userId, { ...validFIIData, shares: 1 });
      expect(result.shares).toBe(1);
    });

    it('should reject averagePrice of 0', async () => {
      const invalidData = { ...validFIIData, averagePrice: 0 };

      await expect(fiiService.create(userId, invalidData))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });

    it('should reject negative averagePrice', async () => {
      const invalidData = { ...validFIIData, averagePrice: -10.5 };

      await expect(fiiService.create(userId, invalidData))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });

    it('should accept averagePrice of 0.01', async () => {
      mockFIIRepository.create.mockResolvedValue({ ...mockFII, averagePrice: 0.01 });

      const result = await fiiService.create(userId, { ...validFIIData, averagePrice: 0.01 });
      expect(result.averagePrice).toBe(0.01);
    });

    it('should reject invalid purchaseDate format', async () => {
      const invalidData = { ...validFIIData, purchaseDate: '15/01/2024' };

      await expect(fiiService.create(userId, invalidData))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });

    it('should return validation error details', async () => {
      const invalidData = { ticker: 'bad', shares: -1, averagePrice: 0, purchaseDate: 'invalid' };

      try {
        await fiiService.create(userId, invalidData);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FIIServiceError);
        const fiiError = error as FIIServiceError;
        expect(fiiError.details).toBeDefined();
        expect(fiiError.details!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('update', () => {
    it('should update a FII with valid data', async () => {
      mockFIIRepository.findById.mockResolvedValue(mockFII);
      mockFIIRepository.update.mockResolvedValue({ ...mockFII, shares: 200 });

      const result = await fiiService.update('fii-123', userId, { shares: 200 });

      expect(result.shares).toBe(200);
      expect(mockFIIRepository.update).toHaveBeenCalledWith('fii-123', { shares: 200 });
    });

    it('should return 404 when FII not found', async () => {
      mockFIIRepository.findById.mockResolvedValue(null);

      await expect(fiiService.update('nonexistent', userId, { shares: 200 }))
        .rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('should return 404 when FII belongs to another user', async () => {
      mockFIIRepository.findById.mockResolvedValue({ ...mockFII, userId: 'other-user' });

      await expect(fiiService.update('fii-123', userId, { shares: 200 }))
        .rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('should validate merged data on update', async () => {
      mockFIIRepository.findById.mockResolvedValue(mockFII);

      // Try to update with invalid ticker
      await expect(fiiService.update('fii-123', userId, { ticker: 'bad' }))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });

    it('should update ticker only', async () => {
      mockFIIRepository.findById.mockResolvedValue(mockFII);
      mockFIIRepository.update.mockResolvedValue({ ...mockFII, ticker: 'HGLG11' });

      const result = await fiiService.update('fii-123', userId, { ticker: 'HGLG11' });

      expect(result.ticker).toBe('HGLG11');
      expect(mockFIIRepository.update).toHaveBeenCalledWith('fii-123', { ticker: 'HGLG11' });
    });
  });

  describe('delete', () => {
    it('should delete an existing FII', async () => {
      mockFIIRepository.findById.mockResolvedValue(mockFII);
      mockFIIRepository.delete.mockResolvedValue(mockFII);

      await fiiService.delete('fii-123', userId);

      expect(mockFIIRepository.delete).toHaveBeenCalledWith('fii-123');
    });

    it('should return 404 when FII not found', async () => {
      mockFIIRepository.findById.mockResolvedValue(null);

      await expect(fiiService.delete('nonexistent', userId))
        .rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('should return 404 when FII belongs to another user', async () => {
      mockFIIRepository.findById.mockResolvedValue({ ...mockFII, userId: 'other-user' });

      await expect(fiiService.delete('fii-123', userId))
        .rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });
  });

  describe('list', () => {
    it('should return all FIIs for the user', async () => {
      const fiis = [
        mockFII,
        { ...mockFII, id: 'fii-456', ticker: 'HGLG11' },
      ];
      mockFIIRepository.findByUserId.mockResolvedValue(fiis);

      const result = await fiiService.list(userId);

      expect(result).toHaveLength(2);
      expect(result[0].ticker).toBe('MXRF11');
      expect(result[1].ticker).toBe('HGLG11');
      expect(mockFIIRepository.findByUserId).toHaveBeenCalledWith(userId);
    });

    it('should return empty array when user has no FIIs', async () => {
      mockFIIRepository.findByUserId.mockResolvedValue([]);

      const result = await fiiService.list(userId);

      expect(result).toHaveLength(0);
    });

    it('should convert Decimal and Date fields to proper types', async () => {
      mockFIIRepository.findByUserId.mockResolvedValue([mockFII]);

      const result = await fiiService.list(userId);

      expect(typeof result[0].averagePrice).toBe('number');
      expect(typeof result[0].purchaseDate).toBe('string');
      expect(typeof result[0].createdAt).toBe('string');
      expect(typeof result[0].updatedAt).toBe('string');
    });
  });
});
