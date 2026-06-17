import { describe, it, expect } from 'vitest';
import {
  UserRepository,
  RendaFixaRepository,
  FIIRepository,
  AporteRepository,
  MarketIndexRepository,
  CronLogRepository,
  userRepository,
  rendaFixaRepository,
  fiiRepository,
  aporteRepository,
  marketIndexRepository,
  cronLogRepository,
  withTransaction,
} from './index.js';

describe('Repository Layer', () => {
  describe('Repository classes are instantiated', () => {
    it('exports singleton instances of all repositories', () => {
      expect(userRepository).toBeInstanceOf(UserRepository);
      expect(rendaFixaRepository).toBeInstanceOf(RendaFixaRepository);
      expect(fiiRepository).toBeInstanceOf(FIIRepository);
      expect(aporteRepository).toBeInstanceOf(AporteRepository);
      expect(marketIndexRepository).toBeInstanceOf(MarketIndexRepository);
      expect(cronLogRepository).toBeInstanceOf(CronLogRepository);
    });

    it('withTransaction is a function', () => {
      expect(typeof withTransaction).toBe('function');
    });
  });

  describe('UserRepository methods', () => {
    it('has all required methods', () => {
      expect(typeof userRepository.findByEmail).toBe('function');
      expect(typeof userRepository.findById).toBe('function');
      expect(typeof userRepository.create).toBe('function');
      expect(typeof userRepository.updateLoginAttempts).toBe('function');
      expect(typeof userRepository.createSession).toBe('function');
      expect(typeof userRepository.findSession).toBe('function');
      expect(typeof userRepository.updateSessionActivity).toBe('function');
      expect(typeof userRepository.deleteSession).toBe('function');
    });
  });

  describe('RendaFixaRepository methods', () => {
    it('has all required methods', () => {
      expect(typeof rendaFixaRepository.create).toBe('function');
      expect(typeof rendaFixaRepository.findById).toBe('function');
      expect(typeof rendaFixaRepository.findByUserId).toBe('function');
      expect(typeof rendaFixaRepository.update).toBe('function');
      expect(typeof rendaFixaRepository.delete).toBe('function');
    });
  });

  describe('FIIRepository methods', () => {
    it('has all required methods', () => {
      expect(typeof fiiRepository.create).toBe('function');
      expect(typeof fiiRepository.findById).toBe('function');
      expect(typeof fiiRepository.findByUserId).toBe('function');
      expect(typeof fiiRepository.findByUserIdWithAllDividends).toBe('function');
      expect(typeof fiiRepository.update).toBe('function');
      expect(typeof fiiRepository.delete).toBe('function');
      expect(typeof fiiRepository.createQuote).toBe('function');
      expect(typeof fiiRepository.getLatestQuote).toBe('function');
      expect(typeof fiiRepository.createDividend).toBe('function');
      expect(typeof fiiRepository.getLatestDividend).toBe('function');
    });
  });

  describe('AporteRepository methods', () => {
    it('has all required methods', () => {
      expect(typeof aporteRepository.create).toBe('function');
      expect(typeof aporteRepository.findByUserId).toBe('function');
      expect(typeof aporteRepository.findByAssetId).toBe('function');
    });
  });

  describe('MarketIndexRepository methods', () => {
    it('has all required methods', () => {
      expect(typeof marketIndexRepository.getLatest).toBe('function');
      expect(typeof marketIndexRepository.create).toBe('function');
      expect(typeof marketIndexRepository.findByTypeAndDate).toBe('function');
    });
  });

  describe('CronLogRepository methods', () => {
    it('has all required methods', () => {
      expect(typeof cronLogRepository.create).toBe('function');
      expect(typeof cronLogRepository.getLatest).toBe('function');
    });
  });
});
