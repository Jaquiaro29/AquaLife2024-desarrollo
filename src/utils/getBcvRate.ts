// getBcvRate.ts
// Utilidad para obtener la tasa USD => Bs desde la web del BCV.
// Nota: hace un scraping sencillo del HTML público. Maneja algunos formatos
// comunes (coma como separador decimal). Usa como fallback si no hay API formal.

export async function getBcvUsdRate(): Promise<{ rate: number | null; date?: string }> {
  const parseNumeric = (value: any): number | null => {
    if (typeof value === 'number') return isNaN(value) ? null : value;
    if (typeof value === 'string') {
      let raw = value.trim();
      raw = raw.replace(/[^0-9,.-]/g, '');
      if (raw.indexOf('.') !== -1 && raw.indexOf(',') !== -1) raw = raw.replace(/\./g, '').replace(/,/g, '.');
      else if (raw.indexOf(',') !== -1) raw = raw.replace(/,/g, '.');
      else raw = raw.replace(/,/g, '');
      const parsed = parseFloat(raw);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const scrapeSite = async () => {
    const res = await fetch('https://www.bcv.org.ve/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AquaLifeBot/1.0) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    const usdRegex = /USD\s*([0-9,.]+)/i;
    const match = text.match(usdRegex);
    const rate = match?.[1] ? parseNumeric(match[1]) : null;

    const dateRegex = /Fecha Valor:\s*([A-Za-z0-9\-,\s]+)/i;
    const dateMatch = text.match(dateRegex);
    const date = dateMatch ? dateMatch[1].trim() : undefined;
    return { rate, date } as { rate: number | null; date?: string };
  };

  const fallbackApi1 = async () => {
    const res = await fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar');
    if (!res.ok) throw new Error(`Fallback1 HTTP ${res.status}`);
    const data = await res.json();
    const rate = parseNumeric(
      data?.monitors?.bcv?.price ??
      data?.bcv?.price ??
      data?.usd?.bcv ??
      data?.price,
    );
    const date = data?.monitors?.bcv?.last_update ?? data?.bcv?.last_update ?? data?.last_update ?? undefined;
    return { rate, date } as { rate: number | null; date?: string };
  };

  const fallbackApi2 = async () => {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
    if (!res.ok) throw new Error(`Fallback2 HTTP ${res.status}`);
    const data = await res.json();
    const rate = parseNumeric(data?.promedio ?? data?.precio ?? data?.price);
    const date = data?.fechaActualizacion ?? data?.fecha ?? data?.last_update ?? undefined;
    return { rate, date } as { rate: number | null; date?: string };
  };

  try {
    const primary = await scrapeSite();
    if (primary.rate) return primary;
  } catch (err) {
    console.error('Error obteniendo tasa BCV (primario):', err);
  }

  try {
    const fb1 = await fallbackApi1();
    if (fb1.rate) return fb1;
  } catch (err) {
    console.error('Error obteniendo tasa BCV (fallback1):', err);
  }

  try {
    const fb2 = await fallbackApi2();
    return fb2;
  } catch (err) {
    console.error('Error obteniendo tasa BCV (fallback2):', err);
    return { rate: null };
  }
}
