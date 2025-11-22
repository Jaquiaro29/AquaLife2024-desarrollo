// Utilitario simple para formato de moneda y símbolo configurable
export const CURRENCY_SYMBOL = 'Bs';

export function formatCurrency(value: number | null | undefined): string {
  const num = typeof value === 'number' && !isNaN(value) ? value : 0;
  try {
    // Usa formato local para miles y decimales
    const formatted = num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${CURRENCY_SYMBOL} ${formatted}`;
  } catch (e) {
    return `${CURRENCY_SYMBOL} ${num.toFixed(2)}`;
  }
}
