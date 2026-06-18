/**
 * Renda Fixa form view for creating/editing fixed income assets.
 * Mobile First design with inline validation errors.
 * Fields: institution, amount, maturity date, rate type selector, rate value.
 */

import { useState, useEffect } from 'react';
import { useRendaFixaViewModel } from '../../viewmodels/useRendaFixaViewModel';
import { ToastContainer } from '../../components/Toast';
import { ConfirmModal } from '../../components/ConfirmModal';
import type { CreateRendaFixaDTO } from '@shared';
import type { RendaFixaAsset } from '../../services/rendaFixaService';

interface RendaFixaFormProps {
  editingAsset?: RendaFixaAsset | null;
  onSuccess?: () => void;
}

export function RendaFixaForm({ editingAsset, onSuccess }: RendaFixaFormProps) {
  const {
    rendaFixaList,
    isLoading,
    validationErrors,
    toasts,
    deleteConfirm,
    loadRendaFixa,
    createRendaFixa,
    updateRendaFixa,
    requestDelete,
    cancelDelete,
    confirmDelete,
    dismissToast,
    clearValidationErrors,
  } = useRendaFixaViewModel();

  const [institution, setInstitution] = useState('');
  const [investedAmount, setInvestedAmount] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [rateType, setRateType] = useState<'CDI_PERCENTAGE' | 'IPCA_PLUS'>('CDI_PERCENTAGE');
  const [rateValue, setRateValue] = useState('');

  useEffect(() => {
    loadRendaFixa();
  }, [loadRendaFixa]);

  useEffect(() => {
    if (editingAsset) {
      setInstitution(editingAsset.institution);
      setInvestedAmount(String(editingAsset.investedAmount));
      setMaturityDate(editingAsset.maturityDate.split('T')[0] ?? '');
      setRateType(editingAsset.rateType);
      setRateValue(String(editingAsset.rateValue));
    }
  }, [editingAsset]);

  const resetForm = () => {
    setInstitution('');
    setInvestedAmount('');
    setMaturityDate('');
    setRateType('CDI_PERCENTAGE');
    setRateValue('');
    clearValidationErrors();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data: CreateRendaFixaDTO = {
      institution: institution.trim(),
      investedAmount: parseFloat(investedAmount) || 0,
      maturityDate: maturityDate ? new Date(maturityDate + 'T00:00:00').toISOString() : '',
      rateType,
      rateValue: parseFloat(rateValue) || 0,
    };

    let success: boolean;
    if (editingAsset) {
      success = await updateRendaFixa(editingAsset.id, data);
    } else {
      success = await createRendaFixa(data);
    }

    if (success) {
      resetForm();
      onSuccess?.();
    }
  };

  const getRateTypeLabel = (type: 'CDI_PERCENTAGE' | 'IPCA_PLUS') => {
    return type === 'CDI_PERCENTAGE' ? '% do CDI' : 'IPCA +';
  };

  const getRateValuePlaceholder = () => {
    return rateType === 'CDI_PERCENTAGE' ? 'Ex: 110' : 'Ex: 5.50';
  };

  const getRateValueHint = () => {
    return rateType === 'CDI_PERCENTAGE'
      ? 'Entre 1% e 999% do CDI'
      : 'Entre 0,01% e 99,99% ao ano';
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {deleteConfirm && (
        <ConfirmModal
          isOpen={deleteConfirm.isOpen}
          title="Excluir título"
          message={`Tem certeza que deseja excluir o título "${deleteConfirm.institution}"? Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          cancelLabel="Cancelar"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          isLoading={isLoading}
        />
      )}

      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
        {editingAsset ? 'Editar Título de Renda Fixa' : 'Cadastrar Título de Renda Fixa'}
      </h1>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
        {/* Institution */}
        <div>
          <label
            htmlFor="institution"
            className="block text-base font-medium text-gray-700 sm:text-sm"
          >
            Instituição
          </label>
          <input
            id="institution"
            name="institution"
            type="text"
            maxLength={100}
            value={institution}
            onChange={(e) => {
              setInstitution(e.target.value);
              clearValidationErrors();
            }}
            aria-invalid={!!validationErrors.institution}
            aria-describedby={validationErrors.institution ? 'institution-error' : undefined}
            className={`mt-1 block w-full rounded-md border px-3 py-3 text-base shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:py-2 sm:text-sm ${
              validationErrors.institution
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300'
            }`}
            placeholder="Ex: Banco Inter"
          />
          {validationErrors.institution && (
            <p id="institution-error" className="mt-1 text-sm text-red-600" role="alert">
              {validationErrors.institution}
            </p>
          )}
        </div>

        {/* Invested Amount */}
        <div>
          <label
            htmlFor="investedAmount"
            className="block text-base font-medium text-gray-700 sm:text-sm"
          >
            Valor Investido (R$)
          </label>
          <input
            id="investedAmount"
            name="investedAmount"
            type="number"
            step="0.01"
            min="0.01"
            max="999999999.99"
            value={investedAmount}
            onChange={(e) => {
              setInvestedAmount(e.target.value);
              clearValidationErrors();
            }}
            aria-invalid={!!validationErrors.investedAmount}
            aria-describedby={validationErrors.investedAmount ? 'investedAmount-error' : undefined}
            className={`mt-1 block w-full rounded-md border px-3 py-3 text-base shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:py-2 sm:text-sm ${
              validationErrors.investedAmount
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300'
            }`}
            placeholder="Ex: 10000.00"
          />
          {validationErrors.investedAmount && (
            <p id="investedAmount-error" className="mt-1 text-sm text-red-600" role="alert">
              {validationErrors.investedAmount}
            </p>
          )}
        </div>

        {/* Maturity Date */}
        <div>
          <label
            htmlFor="maturityDate"
            className="block text-base font-medium text-gray-700 sm:text-sm"
          >
            Data de Vencimento
          </label>
          <input
            id="maturityDate"
            name="maturityDate"
            type="date"
            value={maturityDate}
            onChange={(e) => {
              setMaturityDate(e.target.value);
              clearValidationErrors();
            }}
            aria-invalid={!!validationErrors.maturityDate}
            aria-describedby={validationErrors.maturityDate ? 'maturityDate-error' : undefined}
            className={`mt-1 block w-full rounded-md border px-3 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:py-2 sm:text-sm ${
              validationErrors.maturityDate
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300'
            }`}
          />
          {validationErrors.maturityDate && (
            <p id="maturityDate-error" className="mt-1 text-sm text-red-600" role="alert">
              {validationErrors.maturityDate}
            </p>
          )}
        </div>

        {/* Rate Type Selector */}
        <div>
          <label
            htmlFor="rateType"
            className="block text-base font-medium text-gray-700 sm:text-sm"
          >
            Tipo de Taxa
          </label>
          <select
            id="rateType"
            name="rateType"
            value={rateType}
            onChange={(e) => {
              setRateType(e.target.value as 'CDI_PERCENTAGE' | 'IPCA_PLUS');
              setRateValue('');
              clearValidationErrors();
            }}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:py-2 sm:text-sm"
          >
            <option value="CDI_PERCENTAGE">% do CDI</option>
            <option value="IPCA_PLUS">IPCA + Taxa Fixa</option>
          </select>
        </div>

        {/* Rate Value */}
        <div>
          <label
            htmlFor="rateValue"
            className="block text-base font-medium text-gray-700 sm:text-sm"
          >
            Taxa ({getRateTypeLabel(rateType)})
          </label>
          <input
            id="rateValue"
            name="rateValue"
            type="number"
            step="0.01"
            min="0.01"
            value={rateValue}
            onChange={(e) => {
              setRateValue(e.target.value);
              clearValidationErrors();
            }}
            aria-invalid={!!validationErrors.rateValue || !!validationErrors._root}
            aria-describedby={
              validationErrors.rateValue
                ? 'rateValue-error'
                : validationErrors._root
                ? 'rateValue-error'
                : 'rateValue-hint'
            }
            className={`mt-1 block w-full rounded-md border px-3 py-3 text-base shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:py-2 sm:text-sm ${
              validationErrors.rateValue || validationErrors._root
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300'
            }`}
            placeholder={getRateValuePlaceholder()}
          />
          <p id="rateValue-hint" className="mt-1 text-xs text-gray-500">
            {getRateValueHint()}
          </p>
          {(validationErrors.rateValue || validationErrors._root) && (
            <p id="rateValue-error" className="mt-1 text-sm text-red-600" role="alert">
              {validationErrors.rateValue || validationErrors._root}
            </p>
          )}
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full min-h-[44px] justify-center rounded-md bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:py-2 sm:text-sm"
        >
          {isLoading
            ? 'Salvando...'
            : editingAsset
            ? 'Atualizar Título'
            : 'Cadastrar Título'}
        </button>
      </form>

      {/* Asset List */}
      {rendaFixaList.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Títulos Cadastrados</h2>
          <ul className="mt-4 divide-y divide-gray-200 rounded-md border border-gray-200">
            {rendaFixaList.map((asset) => (
              <li
                key={asset.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-gray-900 sm:text-sm">
                    {asset.institution}
                  </p>
                  <p className="text-sm text-gray-500">
                    R$ {asset.investedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} •{' '}
                    {asset.rateType === 'CDI_PERCENTAGE'
                      ? `${asset.rateValue}% CDI`
                      : `IPCA + ${asset.rateValue}%`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => requestDelete(asset.id, asset.institution)}
                  className="ml-4 min-h-[44px] min-w-[44px] rounded-md p-2 text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                  aria-label={`Excluir título ${asset.institution}`}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default RendaFixaForm;
