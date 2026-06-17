/**
 * FII registration form view.
 * Mobile First design with inline validation, toast notifications and confirmation modal.
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 13.2, 13.4, 13.5
 */

import { useState, useEffect } from 'react';
import { useFIIViewModel } from '../../viewmodels/useFIIViewModel';
import { ToastContainer } from '../../components/Toast';
import { ConfirmModal } from '../../components/ConfirmModal';

export function FIIForm() {
  const {
    fiiList,
    isLoading,
    validationErrors,
    toasts,
    confirmModal,
    loadFIIs,
    createFII,
    deleteFII,
    confirmDelete,
    cancelDelete,
    dismissToast,
    clearError,
  } = useFIIViewModel();

  const [ticker, setTicker] = useState('');
  const [shares, setShares] = useState('');
  const [averagePrice, setAveragePrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');

  useEffect(() => {
    loadFIIs();
  }, [loadFIIs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      ticker: ticker.toUpperCase(),
      shares: shares ? parseInt(shares, 10) : 0,
      averagePrice: averagePrice ? parseFloat(averagePrice) : 0,
      purchaseDate: purchaseDate ? new Date(purchaseDate).toISOString() : '',
    };

    const success = await createFII(data);
    if (success) {
      setTicker('');
      setShares('');
      setAveragePrice('');
      setPurchaseDate('');
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Confirmar exclusão"
        message="Tem certeza que deseja excluir este FII? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
        Cadastrar FII
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Adicione um Fundo Imobiliário à sua carteira
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
        {/* Ticker */}
        <div>
          <label htmlFor="ticker" className="block text-sm font-medium text-gray-700">
            Ticker
          </label>
          <input
            id="ticker"
            name="ticker"
            type="text"
            value={ticker}
            onChange={(e) => {
              setTicker(e.target.value.toUpperCase());
              clearError();
            }}
            placeholder="Ex: MXRF11"
            maxLength={6}
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

        {/* Shares */}
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
              clearError();
            }}
            placeholder="Ex: 100"
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

        {/* Average Price */}
        <div>
          <label htmlFor="averagePrice" className="block text-sm font-medium text-gray-700">
            Preço médio (R$)
          </label>
          <input
            id="averagePrice"
            name="averagePrice"
            type="number"
            min="0.01"
            step="0.01"
            value={averagePrice}
            onChange={(e) => {
              setAveragePrice(e.target.value);
              clearError();
            }}
            placeholder="Ex: 10.50"
            aria-invalid={!!validationErrors.averagePrice}
            aria-describedby={validationErrors.averagePrice ? 'averagePrice-error' : undefined}
            className={`mt-1 block w-full rounded-md border px-3 py-2 text-base shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm ${
              validationErrors.averagePrice ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
            }`}
          />
          {validationErrors.averagePrice && (
            <p id="averagePrice-error" className="mt-1 text-sm text-red-600" role="alert">
              {validationErrors.averagePrice}
            </p>
          )}
        </div>

        {/* Purchase Date */}
        <div>
          <label htmlFor="purchaseDate" className="block text-sm font-medium text-gray-700">
            Data de compra
          </label>
          <input
            id="purchaseDate"
            name="purchaseDate"
            type="date"
            value={purchaseDate}
            onChange={(e) => {
              setPurchaseDate(e.target.value);
              clearError();
            }}
            aria-invalid={!!validationErrors.purchaseDate}
            aria-describedby={validationErrors.purchaseDate ? 'purchaseDate-error' : undefined}
            className={`mt-1 block w-full rounded-md border px-3 py-2 text-base shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm ${
              validationErrors.purchaseDate ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
            }`}
          />
          {validationErrors.purchaseDate && (
            <p id="purchaseDate-error" className="mt-1 text-sm text-red-600" role="alert">
              {validationErrors.purchaseDate}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="mt-4 flex w-full justify-center rounded-md bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:py-2 sm:text-sm"
        >
          {isLoading ? 'Cadastrando...' : 'Cadastrar FII'}
        </button>
      </form>

      {/* FII List */}
      {fiiList.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Seus FIIs</h2>
          <ul className="mt-4 divide-y divide-gray-200 rounded-md border border-gray-200">
            {fiiList.map((fii) => (
              <li key={fii.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-gray-900">{fii.ticker}</p>
                  <p className="text-sm text-gray-500">
                    {fii.shares} cotas · PM: R$ {fii.averagePrice.toFixed(2)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteFII(fii.id)}
                  className="rounded p-2 text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                  aria-label={`Excluir ${fii.ticker}`}
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
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

export default FIIForm;
