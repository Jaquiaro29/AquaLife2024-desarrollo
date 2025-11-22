// getBcvRate.ts
// Utilidad para obtener la tasa USD => Bs desde la web del BCV.
// Nota: hace un scraping sencillo del HTML público. Maneja algunos formatos
// comunes (coma como separador decimal). Usa como fallback si no hay API formal.

export async function getBcvUsdRate(): Promise<{ rate: number | null; date?: string }> {
  try {
    const res = await fetch('https://www.bcv.org.ve/');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    // Buscar patrón 'USD' seguido de un número. BCV suele mostrar "USD 236,83890000"
    // Permitimos espacios y varios separadores.
    const usdRegex = /USD\s*([0-9,.]+)/i;
    const match = text.match(usdRegex);
    let rate: number | null = null;
    if (match && match[1]) {
      // Normalizar: si usan coma como decimal (ej: 236,83890000) => convertir a punto
      let raw = match[1].trim();
      // Si hay punto como separador de miles y coma decimal (ej 1.234,56)
      // eliminamos puntos y cambiamos coma por punto. Si solo hay comas, reemplazar comas por punto.
      if (raw.indexOf('.') !== -1 && raw.indexOf(',') !== -1) {
        raw = raw.replace(/\./g, '').replace(/,/g, '.');
      } else if (raw.indexOf(',') !== -1 && raw.indexOf('.') === -1) {
        raw = raw.replace(/,/g, '.');
      } else {
        // si solo hay puntos, asume punto decimal
        raw = raw.replace(/,/g, '');
      }

      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) rate = parsed;
    }

    // También intentar extraer fecha cercana "Fecha Valor:" si existe
    const dateRegex = /Fecha Valor:\s*([A-Za-z0-9\-,\s]+)/i;
    const dateMatch = text.match(dateRegex);
    const date = dateMatch ? dateMatch[1].trim() : undefined;

    return { rate, date };
  } catch (err) {
    console.error('Error obteniendo tasa BCV:', err);
    return { rate: null };
  }
}
