import { ZodError, ZodSchema } from 'zod';
import { rendaFixaSchema, fiiSchema, aporteRendaFixaSchema, aporteFIISchema } from './schemas';
import type { CreateAporteDTO } from './types';

export interface ValidationResult {
  success: boolean;
  errors: Record<string, string>;
}

function validate<T>(schema: ZodSchema<T>, data: unknown): ValidationResult {
  try {
    schema.parse(data);
    return { success: true, errors: {} };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors: Record<string, string> = {};
      for (const issue of error.issues) {
        const path = issue.path.length > 0 ? issue.path.join('.') : '_root';
        errors[path] = issue.message;
      }
      return { success: false, errors };
    }
    return { success: false, errors: { _root: 'Erro de validação desconhecido' } };
  }
}

export function validateRendaFixa(data: unknown): ValidationResult {
  return validate(rendaFixaSchema, data);
}

export function validateFII(data: unknown): ValidationResult {
  return validate(fiiSchema, data);
}

export function validateAporteRendaFixa(data: unknown): ValidationResult {
  return validate(aporteRendaFixaSchema, data);
}

export function validateAporteFII(data: unknown): ValidationResult {
  return validate(aporteFIISchema, data);
}

export function validateAporte(data: unknown): ValidationResult {
  const parsed = data as Partial<CreateAporteDTO>;
  if (parsed?.assetType === 'RENDA_FIXA') {
    return validateAporteRendaFixa(data);
  }
  if (parsed?.assetType === 'FII') {
    return validateAporteFII(data);
  }
  return {
    success: false,
    errors: { assetType: 'Tipo de ativo deve ser RENDA_FIXA ou FII' },
  };
}
