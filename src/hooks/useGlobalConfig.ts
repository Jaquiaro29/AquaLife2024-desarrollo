import { useEffect, useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, onSnapshot, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';

type GlobalConfig = {
  botellonPrice: number | null;
  botellonPriceHigh: number | null;
  loading: boolean;
};

export function useGlobalConfig() {
  const [botellonPrice, setBotellonPrice] = useState<number | null>(null);
  const [botellonPriceHigh, setBotellonPriceHigh] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, 'config', 'botellon');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setBotellonPrice(typeof data.price === 'number' ? data.price : null);
        setBotellonPriceHigh(typeof data.priceHigh === 'number' ? data.priceHigh : null);
      } else {
        setBotellonPrice(null);
        setBotellonPriceHigh(null);
      }
      setLoading(false);
    }, (err) => {
      console.error('Error listening config botellon:', err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Función para actualizar precio (usa setDoc + añade historial)
  type UpdatePayload = { price?: number; priceHigh?: number; user?: { uid: string; nombre?: string; email?: string } };

  const updateBotellonPrice = async ({ price, priceHigh, user }: UpdatePayload) => {
    const ref = doc(db, 'config', 'botellon');
    const toSave: any = { updatedAt: serverTimestamp() };
    if (typeof price === 'number') toSave.price = price;
    if (typeof priceHigh === 'number') toSave.priceHigh = priceHigh;

    await setDoc(ref, toSave, { merge: true });
    // historial: registrar qué se cambió y quién lo hizo
    const historyEntry: any = { updatedAt: serverTimestamp() };
    if (typeof price === 'number') historyEntry.price = price;
    if (typeof priceHigh === 'number') historyEntry.priceHigh = priceHigh;
    if (user) historyEntry.user = user;
    await addDoc(collection(db, 'config', 'botellon', 'history'), historyEntry);
  };

  return { botellonPrice, botellonPriceHigh, loading, updateBotellonPrice } as GlobalConfig & { updateBotellonPrice: (p: UpdatePayload) => Promise<void> };
}
