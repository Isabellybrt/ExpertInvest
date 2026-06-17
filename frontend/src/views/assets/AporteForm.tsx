/**
 * Aporte registration form view.
 * Supports both new position creation and existing position top-up.
 * Mobile First design with inline validation, toast notifications.
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 13.4, 13.5
 */

import { useState, useEffect } from 'react';
import { useAporteViewModel } from '../../viewmodels/useAporteViewModel';
import type { AporteFormData } from '../../viewmodels/useAporteViewModel';
import { ToastContainer } from '../../components/Toast';

interface AssetOption {
  id: string;
  label: string;
}

interface AporteFormProps {
  /** List of existing Renda Fixa assets for selection */
  rendaFixaAssets?: AssetOption[];
  /** List of existing FII assets for selection */
  fiiAssets?: AssetOption[];
}

export function AporteForm({ rendaFixaAssets = [], fiiAssets = [] }: AporteFormProps) {
  const {
    aporteHistory,
    isLoading,
    validationErrors,
    toasts,
    loadAportes,
    registerAporte,
    deleteAporte,
    dismissToast,
    clearValidationErrors,
  } = useAporteViewModel();

  // Form state
  const [assetType, setAssetType] = useState<'RENDA_FIXA' | 'FII'>('RENDA_FIXA');
  const [isNewPosition, setIsNewPosition] = useState(false);
  const [assetId, setAssetId] = useState('');
  const [date, setDate] = useState('');

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Renda Fixa fields
  const [amount, setAmount] = useState('');

  // FII fields
  const [shares, setShares] = useState('');
  const [pricePerShare, setPricePerShare] = useState('');

  // New position — Renda Fixa
  const [institution, setInstitution] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [rateType, setRateType] = useState<'CDI_PERCENTAGE' | 'IPCA_PLUS'>('CDI_PERCENTAGE');
  const [rateValue, setRateValue] = useState('');

  // New position — FII
  const [ticker, setTicker] = useState('');

  useEffect(() => {
    loadAportes();
  }, [loadAportes]);

  const resetForm = () => {
    setAssetId('');
    setDate('');
    setAmount('');
    setShares('');
    setPricePerShare('');
    setInstitution('');
    setMaturityDate('');
    setRateType('CDI_PERCENTAGE');
    setRateValue('');
    setTicker('');
  };

  const handleAssetTypeChange = (type: 'RENDA_FIXA' | 'FII') => {
    setAssetType(type);
    setIsNewPosition(false);
    resetForm();
    clearValidationErrors();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData: AporteFormData = {
      assetType,
      isNewPosition,
      assetId: isNewPosition ? undefined : assetId,
      date,
      ...(assetType === 'RENDA_FIXA' && {
        amount: amount ? parseFloat(amount) : undefined,
        ...(isNewPosition && {
          institution,
          maturityDate,
          rateType,
          rateValue: rateValue ? parseFloat(rateValue) : undefined,
        }),
      }),
      ...(assetType === 'FII' && {
        shares: shares ? parseInt(shares, 10) : undefined,
        pricePerShare: pricePerShare ? parseFloat(pricePerShare) : undefined,
        ...(isNewPosition && {
          ticker: ticker.toUpperCase(),
        }),
      }),
    };

    const success = await registerAporte(formData);
    if (success) {
      resetForm();
    }
  };

  const currentAssets = assetType === 'RENDA_FIXA' ? rendaFixaAssets : fiiAssets;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
        Registrar Aporte
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Adicione um novo aporte a uma posição existente ou crie uma nova posição
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
        {/* Asset Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Tipo de ativo
          </label>
          <div className="mt-2 flex gap-4">
            <button
              type="button"
              onClick={() => handleAssetTypeChange('RENDA_FIXA')}
              className={`flex-1 rounded-md px-4 py-3 text-base font-medium sm:py-2 sm:text-sm ${
                assetType === 'RENDA_FIXA'
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Renda Fixa
            </button>
            <button
              type="button"
              onClick={() => handleAssetTypeChange('FII')}
              className={`flex-1 rounded-md px-4 py-3 text-base font-medium sm:py-2 sm:text-sm ${
                assetType === 'FII'
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              FII
            </button>
          </div>
        </div>

        {/* Position Type: New or Existing */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Tipo de operação
          </label>
          <div className="mt-2 flex gap-4">
            <button
              type="button"
              onClick={() => {
                setIsNewPosition(false);
                clearValidationErrors();
              }}
              className={`flex-1 rounded-md px-4 py-3 text-base font-medium sm:py-2 sm:text-sm ${
                !isNewPosition
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Posição existente
            </button>
            <button
              type="button"
              onClick={() => {
                setIsNewPosition(true);
                setAssetId('');
                clearValidationErrors();
              }}
              className={`flex-1 rounded-md px-4 py-3 text-base font-medium sm:py-2 sm:text-sm ${
                isNewPosition
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Nova posição
            </button>
          </div>
        </div>

        {/* Asset Selection (existing position only) */}
        {!isNewPosition && (
          <div>
            <label htmlFor="assetId" className="block text-sm font-medium text-gray-700">
              Selecione o ativo
            </label>
            <select
              id="assetId"
              name="assetId"
              value={assetId}
              onChange={(e) => {
                setAssetId(e.target.value);
                clearValidationErrors();
              }}
              aria-invalid={!!validationErrors.assetId}
              aria-describedby={validationErrors.assetId ? 'assetId-error' : undefined}
              className={`mt-1 block w-full rounded-md border px-3 py-2 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm ${
                validationErrors.assetId ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">-- Selecione --</option>
              {currentAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.label}
                </option>
              ))}
            </select>
            {validationErrors.assetId && (
              <p id="assetId-error" className="mt-1 text-sm text-red-600" role="alert">
                {validationErrors.assetId}
              </p>
            )}
          </div>
        )}

        {/* Date */}
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700">
            Data do aporte
          </label>
          <input
            id="date"
            name="date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              clearValidationErrors();
            }}
            aria-invalid={!!validationErrors.date}
            aria-describedby={validationErrors.date ? 'date-error' : undefined}
            className={`mt-1 block w-full rounded-md border px-3 py-2 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm ${
              validationErrors.date ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
            }`}
          />
          {validationErrors.date && (
            <p id="date-error" className="mt-1 text-sm text-red-600" role="alert">
              {validationErrors.date}
            </p>
          )}
        </div>

        {/* Renda Fixa: Amount */}
        {assetType === 'RENDA_FIXA' && (
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
              Valor do aporte (R$)
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              min="0.01"
              max="999999999.99"
              step="0.01"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                clearValidationErrors();
              }}
              placeholder="Ex: 1000.00"
              aria-invalid={!!validationErrors.amount}
              aria-describedby={validationErrors.amount ? 'amount-error' : undefined}
              className={`mt-1 block w-full rounded-md border px-3 py-2 text-base shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm ${
                validationErrors.amount ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
              }`}
            />
            {validationErrors.amount && (
              <p id="amount-error" className="mt-1 text-sm text-red-600" role="alert">
                {validationErrors.amount}
              </p>
            )}
          </div>
        )}

        {/* FII: Shares */}
        {assetType === 'FII' && (
          <>
            <div>
              <label htmlFor="shares" className="block text-sm font-medium text-gray-700">
                Quantidade de cotas
              </label>
              <input
                id="shares"
                name="shares"
                type="number"
                min="1"
                step="1"
                value={shares}
                onChange={(e) => {
                  setShares(e.target.value);
                  clearValidationErrors();
                }}
                placeholder="Ex: 10"
                aria-invalid={!!validationErrors.shares}
                aria-describedby={validationErrors.shares ? 'shares-error' : undefined}
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-base shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm ${
                  validationErrors.shares ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                }`}
              />
              {validationErrors.shares && (
                <p id="shares-error" className="mt-1 text-sm text-red-600" role="alert">
                  {validationErrors.shares}
                </p>
              )}
            </div>

            {/* FII: Price Per Share */}
            <div>
              <label htmlFor="pricePerShare" className="block text-sm font-medium text-gray-700">
                Preço por cota (R$)
              </label>
              <input
                id="pricePerShare"
                name="pricePerShare"
                type="number"
                min="0.01"
                step="0.01"
                value={pricePerShare}
                onChange={(e) => {
                  setPricePerShare(e.target.value);
                  clearValidationErrors();
                }}
                placeholder="Ex: 10.50"
                aria-invalid={!!validationErrors.pricePerShare}
                aria-describedby={validationErrors.pricePerShare ? 'pricePerShare-error' : undefined}
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-base shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm ${
                  validationErrors.pricePerShare ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                }`}
              />
              {validationErrors.pricePerShare && (
                <p id="pricePerShare-error" className="mt-1 text-sm text-red-600" role="alert">
                  {validationErrors.pricePerShare}
                </p>
              )}
            </div>
          </>
        )}

        {/* New Position — Renda Fixa fields */}
        {isNewPosition && assetType === 'RENDA_FIXA' && (
          <>
            <div>
              <label htmlFor="institution" className="block text-sm font-medium text-gray-700">
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
                placeholder="Ex: Nubank"
                aria-invalid={!!validationErrors.institution}
                aria-describedby={validationErrors.institution ? 'institution-error' : undefined}
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-base shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm ${
                  validationErrors.institution ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                }`}
              />
              {validationErrors.institution && (
                <p id="institution-error" className="mt-1 text-sm text-red-600" role="alert">
                  {validationErrors.institution}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="maturityDate" className="block text-sm font-medium text-gray-700">
                Data de vencimento
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
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm ${
                  validationErrors.maturityDate ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                }`}
              />
              {validationErrors.maturityDate && (
                <p id="maturityDate-error" className="mt-1 text-sm text-red-600" role="alert">
                  {validationErrors.maturityDate}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="rateType" className="block text-sm font-medium text-gray-700">
                Tipo de taxa
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
                aria-invalid={!!validationErrors.rateType}
                aria-describedby={validationErrors.rateType ? 'rateType-error' : undefined}
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm ${
                  validationErrors.rateType ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                }`}
              >
                <option value="CDI_PERCENTAGE">% do CDI</option>
                <option value="IPCA_PLUS">IPCA +</option>
              </select>
              {validationErrors.rateType && (
                <p id="rateType-error" className="mt-1 text-sm text-red-600" role="alert">
                  {validationErrors.rateType}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="rateValue" className="block text-sm font-medium text-gray-700">
                {rateType === 'CDI_PERCENTAGE' ? 'Percentual do CDI (%)' : 'Taxa fixa IPCA+ (%)'}
              </label>
              <input
                id="rateValue"
                name="rateValue"
                type="number"
                min={rateType === 'CDI_PERCENTAGE' ? '1' : '0.01'}
                max={rateType === 'CDI_PERCENTAGE' ? '999' : '99.99'}
                step={rateType === 'CDI_PERCENTAGE' ? '1' : '0.01'}
                value={rateValue}
                onChange={(e) => {
                  setRateValue(e.target.value);
                  clearValidationErrors();
                }}
                placeholder={rateType === 'CDI_PERCENTAGE' ? 'Ex: 110' : 'Ex: 5.50'}
                aria-invalid={!!validationErrors.rateValue}
                aria-describedby={validationErrors.rateValue ? 'rateValue-error' : undefined}
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-base shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm ${
                  validationErrors.rateValue ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                }`}
              />
              {validationErrors.rateValue && (
                <p id="rateValue-error" className="mt-1 text-sm text-red-600" role="alert">
                  {validationErrors.rateValue}
                </p>
              )}
            </div>
          </>
        )}

        {/* New Position — FII fields */}
        {isNewPosition && assetType === 'FII' && (
          <div>
            <label htmlFor="ticker" className="block text-sm font-medium text-gray-700">
              Ticker
            </label>
            <input
              id="ticker"
              name="ticker"
              type="text"
              maxLength={6}
              value={ticker}
              onChange={(e) => {
                setTicker(e.target.value.toUpperCase());
                clearValidationErrors();
              }}
              placeholder="Ex: MXRF11"
              aria-invalid={!!validationErrors.ticker}
              aria-describedby={validationErrors.ticker ? 'ticker-error' : undefined}
              className={`mt-1 block w-full rounded-md border px-3 py-2 text-base shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm ${
                validationErrors.ticker ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
              }`}
            />
            {validationErrors.ticker && (
              <p id="ticker-error" className="mt-1 text-sm text-red-600" role="alert">
                {validationErrors.ticker}
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="mt-4 flex w-full justify-center rounded-md bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:py-2 sm:text-sm"
        >
          {isLoading ? 'Registrando...' : 'Registrar Aporte'}
        </button>
      </form>

      {/* Aporte History */}
      {aporteHistory.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Histórico de Aportes</h2>
          <ul className="mt-4 divide-y divide-gray-200 rounded-md border border-gray-200">
            {aporteHistory.map((aporte) => (
              <li key={aporte.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">
                      {aporte.assetType === 'RENDA_FIXA' ? 'Renda Fixa' : 'FII'}
                      <span className="ml-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {aporte.operationType === 'NEW_POSITION' ? 'Nova posição' : 'Posição existente'}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {new Date(aporte.date).toLocaleDateString('pt-BR')}
                      {aporte.shares && ` · ${aporte.shares} cotas`}
                      {aporte.pricePerShare && ` @ R$ ${aporte.pricePerShare.toFixed(2)}`}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center gap-3">
                    <p className="font-semibold text-gray-900">
                      R$ {aporte.amount.toFixed(2)}
                    </p>
                    {deletingId === aporte.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteAporte(aporte.id);
                            setDeletingId(null);
                          }}
                          disabled={isLoading}
                          className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          aria-label="Confirmar exclusão"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          className="rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300"
                          aria-label="Cancelar exclusão"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeletingId(aporte.id)}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Excluir aporte"
                        title="Excluir aporte"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default AporteForm;
