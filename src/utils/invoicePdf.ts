import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { getStorage, ref, uploadString, getDownloadURL, uploadBytes } from 'firebase/storage';
import { formatCurrency } from './currency';

// Modo sin Storage: fuerza generación local (descarga en web, archivo local en nativo) y no sube a la nube.
// Pon en true mientras no tengas un bucket operativo.
export const STORAGE_DISABLED = true;

export type BuildHtmlParams = {
  empresa?: { nombre?: string; rif?: string; direccion?: string; telefono?: string; logoUrl?: string };
  factura: {
    numero: number | string;
    fechaEmision: any;
    clienteId?: string;
    ivaPercent?: number;
    subtotal?: number;
    impuestos?: number;
    total?: number;
    estado?: string;
    notas?: string;
  };
  cliente?: { nombre?: string; direccion?: string; telefono?: string; email?: string; cedula?: string };
  items: Array<{ descripcion: string; cantidad: number; precioUnitario: number; subtotal?: number }>;
};

export function buildInvoiceHtml({ empresa, factura, cliente, items }: BuildHtmlParams): string {
  const fecha = (() => {
    try {
      const d = factura.fechaEmision?.toDate ? factura.fechaEmision.toDate() : new Date();
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
    } catch {
      return 'N/D';
    }
  })();

  const ivaValue = typeof factura.ivaPercent === 'number' ? factura.ivaPercent : 16;
  const subtotalCalc = items.reduce((acc, it) => acc + (it.subtotal ?? it.cantidad * it.precioUnitario), 0);
  const hasStoredSubtotal = typeof factura.subtotal === 'number';
  const hasStoredImpuestos = typeof factura.impuestos === 'number';
  const storedSubtotal = hasStoredSubtotal ? (factura.subtotal as number) : subtotalCalc;
  const storedImpuestos = hasStoredImpuestos ? (factura.impuestos as number) : 0;
  const storedTotal = typeof factura.total === 'number' ? (factura.total as number) : storedSubtotal + storedImpuestos;

  // Si el total ya incluye IVA pero la base/impuestos no vienen, derivamos: base = total / (1+IVA), IVA = total - base
  const derivedBase = storedTotal / (1 + ivaValue / 100);
  const derivedIva = storedTotal - derivedBase;
  const useDerived = !hasStoredSubtotal || !hasStoredImpuestos || storedImpuestos === 0;

  const subtotal = useDerived ? derivedBase : storedSubtotal;
  const impuestos = useDerived ? derivedIva : storedImpuestos;
  const total = storedTotal;
  const ivaLabel = `IVA (${ivaValue}%)`;

  const rows = items.map((it, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${escapeHtml(it.descripcion)}</td>
      <td style="text-align:center">${it.cantidad}</td>
      <td style="text-align:right">${formatCurrency(it.precioUnitario || 0)}</td>
      <td style="text-align:right">${formatCurrency(it.subtotal ?? it.cantidad * it.precioUnitario)}</td>
    </tr>
  `).join('');

  const empresaNombre = empresa?.nombre || 'AquaLife';
  const empresaRif = empresa?.rif ? escapeHtml(empresa.rif) : '';
  const empresaDir = empresa?.direccion ? escapeHtml(empresa.direccion) : '';
  const empresaTel = empresa?.telefono ? escapeHtml(empresa.telefono) : '';
  const logoImg = empresa?.logoUrl ? `<img src="${empresa.logoUrl}" style="height:60px; object-fit:contain;" />` : '';

  const clienteNombre = escapeHtml(cliente?.nombre || 'N/D');
  const clienteCedula = escapeHtml(cliente?.cedula || factura.clienteId || 'N/D');
  const clienteDir = escapeHtml(cliente?.direccion || '');
  const clienteTel = escapeHtml(cliente?.telefono || '');
  const clienteEmail = escapeHtml(cliente?.email || '');

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color:#0F1724; padding:24px; }
          .header { display:flex; justify-content: space-between; align-items:flex-start; gap:20px; border-bottom:2px solid #e2e8f0; padding-bottom:12px; }
          .company { max-width: 60%; }
          .company h1 { margin:4px 0; font-size:18px; }
          .meta { text-align:right; font-size:14px; }
          .meta strong { display:block; font-size:16px; }
          .info-grid { display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin:16px 0; padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; }
          .info-box h3 { margin:0 0 6px 0; font-size:14px; text-transform:uppercase; letter-spacing:0.4px; }
          .info-row { display:flex; justify-content:flex-start; gap:8px; margin-bottom:4px; font-size:13px; align-items:flex-start; }
          .table { width:100%; border-collapse:collapse; margin-top:8px; }
          .table th { background:#eef2ff; color:#0f172a; font-size:13px; padding:10px 8px; text-align:left; border:1px solid #e2e8f0; }
          .table td { font-size:13px; padding:10px 8px; border:1px solid #e2e8f0; }
          .table td:nth-child(1) { width:42px; text-align:center; }
          .table td:nth-child(3) { text-align:center; }
          .table td:nth-child(4), .table td:nth-child(5) { text-align:right; }
          .totals { margin-top:14px; width: 320px; float:right; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; }
          .totals table { width:100%; border-collapse:collapse; }
          .totals td { padding:10px 12px; font-size:13px; border-bottom:1px solid #e2e8f0; }
          .totals tr:last-child td { border-bottom:none; font-weight:bold; font-size:14px; }
          .footer { clear:both; margin-top:28px; font-size:12px; text-align:center; color:#475569; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company">
            ${logoImg}
            <h1>${escapeHtml(empresaNombre)}</h1>
            ${empresaRif ? `<div>RIF: ${empresaRif}</div>` : ''}
            ${empresaDir ? `<div>${empresaDir}</div>` : ''}
            ${empresaTel ? `<div>Tel: ${empresaTel}</div>` : ''}
          </div>
          <div class="meta">
            <strong>FACTURA</strong>
            <div>Nro: ${factura.numero}</div>
            <div>Fecha de emisión: ${fecha}</div>
            ${factura.estado ? `<div>Estado: ${escapeHtml(factura.estado)}</div>` : ''}
          </div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <h3>Cliente</h3>
            <div class="info-row"><span>Nombre:</span><span>${clienteNombre}</span></div>
            <div class="info-row"><span>Cédula/RIF:</span><span>${clienteCedula}</span></div>
            ${clienteDir ? `<div class="info-row"><span>Dirección:</span><span>${clienteDir}</span></div>` : ''}
            ${(clienteTel || clienteEmail) ? `<div class="info-row"><span>Contacto:</span><span>${clienteTel || clienteEmail}</span></div>` : ''}
          </div>
          <div class="info-box">
            <h3>Totales</h3>
            <div class="info-row"><span>Subtotal:</span><span>${formatCurrency(subtotal)}</span></div>
            <div class="info-row"><span>${ivaLabel}:</span><span>${formatCurrency(impuestos)}</span></div>
            <div class="info-row"><span>Total a pagar:</span><span><strong>${formatCurrency(total)}</strong></span></div>
          </div>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Descripción</th>
              <th>Cantidad</th>
              <th>Precio Unitario</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="5" style="text-align:center; padding:16px;">Sin conceptos</td></tr>'}
          </tbody>
        </table>

        <div class="totals">
          <table>
            <tr><td>Base imponible</td><td style="text-align:right">${formatCurrency(subtotal)}</td></tr>
            <tr><td>${ivaLabel}</td><td style="text-align:right">${formatCurrency(impuestos)}</td></tr>
            <tr><td>Total a pagar</td><td style="text-align:right">${formatCurrency(total)}</td></tr>
          </table>
        </div>

        ${factura.notas ? `<p style="margin-top:18px; font-size:12px;"><strong>Notas:</strong> ${escapeHtml(factura.notas)}</p>` : ''}

        <div class="footer">Este documento va sin tachadura ni enmienda. Original - Cliente.</div>
      </body>
    </html>
  `;
}

function escapeHtml(s: any) {
  if (s === null || s === undefined) return '';
  const str = typeof s === 'string' ? s : String(s);
  return str.replace(/[&<>"]+/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' } as any)[c]);
}

export async function generateInvoicePdf(html: string, fileName = `factura_${Date.now()}`): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html });
  const dest = `${FileSystem.documentDirectory}${fileName}.pdf`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export async function uploadInvoicePdf(localUri: string, storagePath: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
  const storage = getStorage();
  const r = ref(storage, storagePath);
  await uploadString(r, base64, 'base64', { contentType: 'application/pdf' });
  const url = await getDownloadURL(r);
  return url;
}

async function generateLocalPdf(html: string, fileName = `factura_${Date.now()}`): Promise<string | null> {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod: any = require('html2pdf.js');
    const html2pdf = mod?.default || mod;
    const opt = {
      margin: 10,
      filename: `${fileName}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };
    await html2pdf().from(html).set(opt).save();
    return null; // sin URL
  }
  // Nativo: genera archivo local y devuelve ruta
  const localUri = await generateInvoicePdf(html, fileName);
  return localUri;
}

// Cross-platform helper: on web, render HTML → PDF via html2pdf.js and upload directly.
export async function generateAndUploadInvoicePdf(html: string, storagePath: string, fileName = `factura_${Date.now()}`): Promise<string> {
  if (STORAGE_DISABLED) {
    await generateLocalPdf(html, fileName);
    return Promise.reject(new Error('STORAGE_DISABLED'));
  }
  if (Platform.OS === 'web') {
    // Require at runtime on web to avoid bundling on native
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod: any = require('html2pdf.js');
    const html2pdf = mod?.default || mod;
    const opt = {
      margin: 10,
      filename: `${fileName}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };
    const storage = getStorage();
    const r = ref(storage, storagePath);
    try {
      // Try uploading as data URL (often simpler for CORS preflight)
      const dataUrl: string = await html2pdf().from(html).set(opt).outputPdf('datauristring');
      await uploadString(r, dataUrl, 'data_url');
      const url = await getDownloadURL(r);
      return url;
    } catch (e) {
      try {
        // Fallback: upload as Blob
        const blob: Blob = await html2pdf().from(html).set(opt).outputPdf('blob');
        await uploadBytes(r, blob, { contentType: 'application/pdf' });
        const url = await getDownloadURL(r);
        return url;
      } catch (err) {
        // Last resort: trigger local download for the user and rethrow
        try { await html2pdf().from(html).set(opt).save(); } catch {}
        throw err;
      }
    }
  }
  // Native: use existing flow
  const localUri = await generateInvoicePdf(html, fileName);
  return uploadInvoicePdf(localUri, storagePath);
}

export function buildAnulacionHtml({ empresa, factura, motivo }: { empresa?: BuildHtmlParams['empresa']; factura: BuildHtmlParams['factura']; motivo: string }): string {
  const fecha = (() => {
    try {
      const d = new Date();
      return d.toISOString().split('T')[0];
    } catch {
      return 'N/D';
    }
  })();
  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style> body{ font-family: Arial; padding:20px } h1{ font-size:20px } </style>
      </head>
      <body>
        <h1>Comprobante de Anulación</h1>
        <p>Factura #${factura.numero} · Fecha: ${fecha}</p>
        ${empresa?.nombre ? `<p>${escapeHtml(empresa.nombre)}</p>` : ''}
        <p><strong>Motivo:</strong> ${escapeHtml(motivo)}</p>
      </body>
    </html>
  `;
}
