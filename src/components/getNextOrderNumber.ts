// getNextOrderNumber.ts
import { doc, runTransaction, Firestore } from 'firebase/firestore';

/**
 * Retorna el siguiente número de pedido (correlativo) y lo incrementa en "Counters/pedidos".
 * Usamos una transacción para evitar duplicados si varios usuarios crean pedidos simultáneamente.
 */
export async function getNextOrderNumber(db: Firestore): Promise<number> {
  const countersRef = doc(db, 'Counters', 'pedidos');

  const nextNumber = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(countersRef);
    if (!snap.exists()) {
      // Si no existe, se crea con current=1
      transaction.set(countersRef, { current: 1 });
      return 1;
    } else {
      // Si existe, incrementamos en 1
      const data = snap.data();
      const currentValue = data.current ?? 0;
      const newValue = currentValue + 1;
      transaction.update(countersRef, { current: newValue });
      return newValue;
    }
  });

  return nextNumber;
}
