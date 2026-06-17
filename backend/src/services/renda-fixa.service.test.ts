import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RendaFixaService, ValidationError, ServiceError } from './renda-fixa.service.js';

// Mock the RendaFixaRepository
const mockRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByUserId: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// Mock the module
vi.mock('../repositories/renda-fixa.repository.js', () => ({
  RendaFixaRepository: vi.fn(() => mockRepository),
}));

describe('RendaFixaService', () => {
  let service: RendaFixaService;
  const userId = 'user-123';

  const validData = {
    institution: 'Banco XP',
    investedAmount: 10000,
    maturityDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year from now
    rateType: 'CDI_PERCENTAGE' as const,
    rateValue: 110,
  };

  const mockRecord = {
    id: 'record-1',
    userId,
    institution: 'Banco XP',
    investedAmount: 10000,
    maturityDate: new Date(validData.maturityDate),
    rateType: 'CDI_PERCENTAGE',
    rateValue: 110,
    ipcaPlusRate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RendaFixaService(mockRepository as any);
  });

  describe('create', () => {
    it('should create a renda fixa record with valid data', async () => {
      mockRepository.create.mockResolvedValue(mockRecord);

      const result = await service.create(userId, validData);

      expect(mockRepository.create).toHaveBeenCalledWith({
        userId,
        institution: validData.institution,
        investedAmount: validData.investedAmount,
        maturityDate: expect.any(Date),
        rateType: validData.rateType,
        rateValue: validData.rateValue,
        ipcaPlusRate: null,
      });
      expect(result.id).toBe('record-1');
      expect(result.institution).toBe('Banco XP');
      expect(result.investedAmount).toBe(10000);
    });

    it('should create IPCA_PLUS record with ipcaPlusRate set', async () => {
      const ipcaData = {
        ...validData,
        rateType: 'IPCA_PLUS' as const,
        rateValue: 5.5,
      };
      const ipcaRecord = { ...mockRecord, rateType: 'IPCA_PLUS', rateValue: 5.5, ipcaPlusRate: 5.5 };
      mockRepository.create.mockResolvedValue(ipcaRecord);

      const result = await service.create(userId, ipcaData);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rateType: 'IPCA_PLUS',
          rateValue: 5.5,
          ipcaPlusRate: 5.5,
        })
      );
      expect(result.ipcaPlusRate).toBe(5.5);
    });

    it('should throw ValidationError for empty institution', async () => {
      const invalidData = { ...validData, institution: '' };

      await expect(service.create(userId, invalidData)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for institution > 100 chars', async () => {
      const invalidData = { ...validData, institution: 'A'.repeat(101) };

      await expect(service.create(userId, invalidData)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for investedAmount below 0.01', async () => {
      const invalidData = { ...validData, investedAmount: 0 };

      await expect(service.create(userId, invalidData)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for investedAmount above 999999999.99', async () => {
      const invalidData = { ...validData, investedAmount: 1_000_000_000 };

      await expect(service.create(userId, invalidData)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for past maturity date', async () => {
      const invalidData = { ...validData, maturityDate: '2020-01-01' };

      await expect(service.create(userId, invalidData)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid rate type', async () => {
      const invalidData = { ...validData, rateType: 'INVALID' as any };

      await expect(service.create(userId, invalidData)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for CDI_PERCENTAGE rateValue below 1', async () => {
      const invalidData = { ...validData, rateType: 'CDI_PERCENTAGE' as const, rateValue: 0.5 };

      await expect(service.create(userId, invalidData)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for CDI_PERCENTAGE rateValue above 999', async () => {
      const invalidData = { ...validData, rateType: 'CDI_PERCENTAGE' as const, rateValue: 1000 };

      await expect(service.create(userId, invalidData)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for IPCA_PLUS rateValue below 0.01', async () => {
      const invalidData = { ...validData, rateType: 'IPCA_PLUS' as const, rateValue: 0 };

      await expect(service.create(userId, invalidData)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for IPCA_PLUS rateValue above 99.99', async () => {
      const invalidData = { ...validData, rateType: 'IPCA_PLUS' as const, rateValue: 100 };

      await expect(service.create(userId, invalidData)).rejects.toThrow(ValidationError);
    });
  });

  describe('list', () => {
    it('should return all records for the user', async () => {
      mockRepository.findByUserId.mockResolvedValue([mockRecord]);

      const result = await service.list(userId);

      expect(mockRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('record-1');
    });

    it('should return empty array when user has no records', async () => {
      mockRepository.findByUserId.mockResolvedValue([]);

      const result = await service.list(userId);

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return a record when it exists and belongs to the user', async () => {
      mockRepository.findById.mockResolvedValue(mockRecord);

      const result = await service.findById(userId, 'record-1');

      expect(result.id).toBe('record-1');
    });

    it('should throw ServiceError 404 when record does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.findById(userId, 'non-existent')).rejects.toThrow(ServiceError);
      try {
        await service.findById(userId, 'non-existent');
      } catch (error) {
        expect((error as ServiceError).statusCode).toBe(404);
      }
    });

    it('should throw ServiceError 404 when record belongs to another user', async () => {
      mockRepository.findById.mockResolvedValue({ ...mockRecord, userId: 'other-user' });

      await expect(service.findById(userId, 'record-1')).rejects.toThrow(ServiceError);
    });
  });

  describe('update', () => {
    it('should update a record with valid data', async () => {
      mockRepository.findById.mockResolvedValue(mockRecord);
      const updatedRecord = { ...mockRecord, institution: 'Nubank' };
      mockRepository.update.mockResolvedValue(updatedRecord);

      const result = await service.update(userId, 'record-1', { institution: 'Nubank' });

      expect(mockRepository.update).toHaveBeenCalledWith('record-1', expect.objectContaining({
        institution: 'Nubank',
      }));
      expect(result.institution).toBe('Nubank');
    });

    it('should throw ServiceError 404 when record does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.update(userId, 'non-existent', { institution: 'X' })).rejects.toThrow(ServiceError);
    });

    it('should throw ServiceError 404 when record belongs to another user', async () => {
      mockRepository.findById.mockResolvedValue({ ...mockRecord, userId: 'other-user' });

      await expect(service.update(userId, 'record-1', { institution: 'X' })).rejects.toThrow(ServiceError);
    });

    it('should throw ValidationError when merged data is invalid', async () => {
      mockRepository.findById.mockResolvedValue(mockRecord);

      await expect(service.update(userId, 'record-1', { institution: '' })).rejects.toThrow(ValidationError);
    });
  });

  describe('delete', () => {
    it('should delete an existing record belonging to the user', async () => {
      mockRepository.findById.mockResolvedValue(mockRecord);
      mockRepository.delete.mockResolvedValue(mockRecord);

      await service.delete(userId, 'record-1');

      expect(mockRepository.delete).toHaveBeenCalledWith('record-1');
    });

    it('should throw ServiceError 404 when record does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.delete(userId, 'non-existent')).rejects.toThrow(ServiceError);
    });

    it('should throw ServiceError 404 when record belongs to another user', async () => {
      mockRepository.findById.mockResolvedValue({ ...mockRecord, userId: 'other-user' });

      await expect(service.delete(userId, 'record-1')).rejects.toThrow(ServiceError);
    });
  });
});
