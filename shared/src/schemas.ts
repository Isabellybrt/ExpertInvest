import { z } from 'zod';

export const rendaFixaSchema = z.object({
  institution: z.string().min(1, 'Instituição é obrigatória').max(100, 'Instituição deve ter no máximo 100 caracteres'),
  investedAmount: z.number().min(0.01, 'Valor deve ser no mínimo R$0,01').max(999_999_999.99, 'Valor deve ser no máximo R$999.999.999,99'),
  maturityDate: z.string().refine(
    (date) => new Date(date) > new Date(),
    { message: 'Data de vencimento deve ser futura' }
  ),
  rateType: z.enum(['CDI_PERCENTAGE', 'IPCA_PLUS']),
  rateValue: z.number().positive('Taxa deve ser positiva'),
}).refine(
  (data) => {
    if (data.rateType === 'CDI_PERCENTAGE') {
      return data.rateValue >= 1 && data.rateValue <= 999;
    }
    if (data.rateType === 'IPCA_PLUS') {
      return data.rateValue >= 0.01 && data.rateValue <= 99.99;
    }
    return false;
  },
  { message: 'Taxa fora do intervalo permitido para o tipo selecionado' }
);

export const fiiSchema = z.object({
  ticker: z.string().regex(/^[A-Z]{4}\d{2}$/, 'Ticker deve seguir formato: 4 letras + 2 dígitos (ex: MXRF11)'),
  shares: z.number().int('Quantidade de cotas deve ser um número inteiro').min(1, 'Quantidade de cotas deve ser no mínimo 1'),
  averagePrice: z.number().positive('Preço médio deve ser positivo'),
  purchaseDate: z.string().datetime({ message: 'Data de compra deve estar no formato ISO 8601' }),
});

export const aporteRendaFixaSchema = z.object({
  assetType: z.literal('RENDA_FIXA'),
  assetId: z.string().uuid('ID do ativo deve ser um UUID válido').optional(),
  amount: z.number().min(0.01, 'Valor deve ser no mínimo R$0,01').max(999_999_999.99, 'Valor deve ser no máximo R$999.999.999,99'),
  date: z.string().datetime({ message: 'Data deve estar no formato ISO 8601' }),
});

export const aporteFIISchema = z.object({
  assetType: z.literal('FII'),
  assetId: z.string().uuid('ID do ativo deve ser um UUID válido').optional(),
  shares: z.number().int('Quantidade de cotas deve ser um número inteiro').min(1, 'Quantidade de cotas deve ser no mínimo 1'),
  pricePerShare: z.number().positive('Preço por cota deve ser positivo'),
  date: z.string().datetime({ message: 'Data deve estar no formato ISO 8601' }),
});
