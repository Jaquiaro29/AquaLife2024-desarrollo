import {
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';

// Tipos de entrada para cálculo y persistencia de facturas
export type InvoiceItemInput = {
  descripcion: string;
  productoId?: string;
  cantidad: number;
  precioUnitario: number;
  impuestosItem?: number;
};

export type InvoiceTotals = {
  subtotal: number;
  impuestos: number;
  total: number;
};

export type InvoiceUser = {
  uid: string;
  email?: string;
  displayName?: string;
};

export type CreateInvoiceParams = {
  pedidoId?: string;
  pedidoIds?: string[];
  pedidoNumeros?: number[];
  clienteId: string;
  clienteNombre?: string;
  clienteDireccion?: string;
  clienteContacto?: string;
  clienteTelefono?: string;
  clienteEmail?: string;
  items: InvoiceItemInput[];
  ivaPercent: number;
  pricesIncludeVAT?: boolean;
  notas?: string;
  externa?: boolean;
  estado?: 'activa' | 'anulada' | 'pagada' | 'pendiente';
  pedidoData?: any;
  user?: InvoiceUser;
};

export type CancelInvoiceParams = {
  facturaId: string;
  motivo: string;
  user: InvoiceUser;
};

// Calcula totales a partir de items
export function calcTotals(items: InvoiceItemInput[], ivaPercent: number, pricesIncludeVAT = false): InvoiceTotals {
  if (!pricesIncludeVAT) {
    const subtotal = items.reduce((acc, item) => acc + item.cantidad * item.precioUnitario, 0);
    const impuestosItems = items.reduce((acc, item) => acc + (item.impuestosItem || 0), 0);
    const impuestos = impuestosItems > 0 ? impuestosItems : subtotal * (ivaPercent / 100);
    const total = subtotal + impuestos;
    return { subtotal, impuestos, total };
  }

  // Precios incluyen IVA: interpretamos precioUnitario como precio final (con IVA)
  // Base = precio / (1 + IVA%); IVA = precio - base
  const factor = 1 + (ivaPercent / 100);
  const totalBruto = items.reduce((acc, item) => acc + item.cantidad * item.precioUnitario, 0);
  const subtotal = totalBruto / factor;
  const impuestos = totalBruto - subtotal;
  const total = totalBruto;
  return { subtotal, impuestos, total };
}

// Obtiene y actualiza el número consecutivo de factura con transacción para evitar duplicados
export async function getNextInvoiceNumber(): Promise<number> {
  const ref = doc(db, 'config', 'facturacion');
  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? snap.data()?.nextNumber || 1 : 1;
    const nextNumber = current + 1;
    tx.set(ref, { nextNumber, updatedAt: serverTimestamp() }, { merge: true });
    return current;
  });
  return next;
}

// Crea factura y su detalle; opcionalmente trae datos del pedido si no se pasan
export async function createInvoiceFromOrder(params: CreateInvoiceParams) {
  const { pedidoId, pedidoIds, pedidoNumeros, clienteId, items, ivaPercent, pricesIncludeVAT, notas, externa, estado = 'activa', pedidoData, user } = params;

  if (!items || items.length === 0) {
    throw new Error('La factura debe tener al menos un item.');
  }

  // Si falta data de pedido pero hay id, intenta cargarla
  let orderData = pedidoData;
  if (!orderData && pedidoId) {
    const orderRef = doc(db, 'Pedidos', pedidoId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) {
      throw new Error('No se encontró el pedido asociado.');
    }
    orderData = orderSnap.data();
  }

  // Validaciones mínimas: pedido(s) entregado(s)/pagado(s) según negocio
  if (orderData) {
    const estadoPedido = orderData.estado;
    const estadoFinanciero = orderData.estadoFinanciero;
    const isPaid = estadoFinanciero === 'pagado' || estadoFinanciero === 'cobrado';
    const isDelivered = estadoPedido === 'entregado' || estadoPedido === 'listo';
    if (!isPaid) {
      throw new Error('El pedido aún no está cobrado; no se puede facturar.');
    }
    if (!isDelivered) {
      throw new Error('El pedido no está entregado/listo; no se puede facturar.');
    }
  }
  if (pedidoIds && pedidoIds.length > 0) {
    // Carga ligera para validar que todos están cobrados/entregados
    const snaps = await Promise.all(pedidoIds.map(id => getDoc(doc(db, 'Pedidos', id))));
    for (const s of snaps) {
      if (!s.exists()) throw new Error('Hay pedidos seleccionados que no existen.');
      const d = s.data() as any;
      const isPaid = d.estadoFinanciero === 'pagado' || d.estadoFinanciero === 'cobrado';
      const isDelivered = d.estado === 'entregado' || d.estado === 'listo';
      if (!isPaid) throw new Error('Uno de los pedidos no está cobrado; no se puede facturar.');
      if (!isDelivered) throw new Error('Uno de los pedidos no está entregado/listo; no se puede facturar.');
      if (d.clienteId !== clienteId) throw new Error('Todos los pedidos deben ser del mismo cliente.');
    }
  }

  const numero = await getNextInvoiceNumber();
  const { subtotal, impuestos, total } = calcTotals(items, ivaPercent, !!pricesIncludeVAT);

  const facturaDoc = {
    numero,
    pedidoId: pedidoId || (pedidoIds && pedidoIds.length === 1 ? pedidoIds[0] : null),
    pedidoIds: pedidoIds && pedidoIds.length > 0 ? pedidoIds : null,
    pedidoNumeros: pedidoNumeros && pedidoNumeros.length > 0 ? pedidoNumeros : null,
    clienteId,
    ivaPercent,
    estado,
    subtotal,
    impuestos,
    total,
    fechaEmision: serverTimestamp(),
    notas: notas || '',
    externa: !!externa,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const facturaRef = await addDoc(collection(db, 'Facturas'), facturaDoc);

  // Guardar detalle
  const factor = 1 + (ivaPercent / 100);
  const detallePromises = items.map((item) => {
    const baseUnit = pricesIncludeVAT ? (item.precioUnitario / factor) : item.precioUnitario;
    const payload = {
      descripcion: item.descripcion,
      productoId: item.productoId || null,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      subtotal: item.cantidad * baseUnit,
      impuestosItem: item.impuestosItem ?? null,
    };
    return addDoc(collection(db, 'Facturas', facturaRef.id, 'detalle'), payload);
  });
  await Promise.all(detallePromises);

  // Historial inicial
  await addDoc(collection(db, 'Facturas', facturaRef.id, 'historial'), {
    cambio: 'creacion',
    user: sanitizeUser(user),
    timestamp: serverTimestamp(),
    diff: { subtotal, impuestos, total, estado, ivaPercent },
  });

  return { id: facturaRef.id, numero, subtotal, impuestos, total };
}

// Anula una factura, bloqueando ediciones posteriores
export async function cancelInvoice({ facturaId, motivo, user }: CancelInvoiceParams) {
  const ref = doc(db, 'Facturas', facturaId);
  await updateDoc(ref, {
    estado: 'anulada',
    anuladaPor: user.uid,
    anuladaEn: serverTimestamp(),
    motivoAnulacion: motivo,
    updatedAt: serverTimestamp(),
  });

  await addDoc(collection(db, 'Facturas', facturaId, 'historial'), {
    cambio: 'anulacion',
    user: sanitizeUser(user),
    timestamp: serverTimestamp(),
    diff: { estado: 'anulada', motivo },
  });
}

// Actualiza campos permitidos de una factura no anulada
export async function updateInvoiceFields(facturaId: string, patch: Record<string, any>, user?: InvoiceUser) {
  const ref = doc(db, 'Facturas', facturaId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Factura no encontrada.');
  const data = snap.data();
  if (data.estado === 'anulada') {
    throw new Error('No se puede editar una factura anulada.');
  }

  const safePatch = { ...patch, updatedAt: serverTimestamp() };
  await updateDoc(ref, safePatch);

  await addDoc(collection(db, 'Facturas', facturaId, 'historial'), {
    cambio: 'actualizacion',
    user: sanitizeUser(user),
    timestamp: serverTimestamp(),
    diff: patch,
  });
}

// Crea una factura externa (sin pedido) y permite adjuntar URLs de PDF/XML ya subidos
export async function addExternalInvoice(params: Omit<CreateInvoiceParams, 'pedidoId' | 'pedidoIds'> & { pdfUrl?: string; xmlUrl?: string }) {
  const { clienteId, clienteNombre, clienteDireccion, clienteContacto, clienteTelefono, clienteEmail, items, ivaPercent, pricesIncludeVAT, notas, pdfUrl, xmlUrl, user } = params;
  const numero = await getNextInvoiceNumber();
  const { subtotal, impuestos, total } = calcTotals(items, ivaPercent, !!pricesIncludeVAT);

  const facturaDoc = {
    numero,
    pedidoId: null,
    clienteId,
    clienteNombre: clienteNombre || null,
    clienteDireccion: clienteDireccion || null,
    clienteContacto: clienteContacto || null,
    clienteTelefono: clienteTelefono || null,
    clienteEmail: clienteEmail || null,
    ivaPercent,
    estado: 'activa',
    subtotal,
    impuestos,
    total,
    fechaEmision: serverTimestamp(),
    notas: notas || '',
    externa: true,
    pdfUrl: pdfUrl || null,
    xmlUrl: xmlUrl || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const facturaRef = await addDoc(collection(db, 'Facturas'), facturaDoc);

  const factor = 1 + (ivaPercent / 100);
  const detallePromises = items.map((item) => addDoc(collection(db, 'Facturas', facturaRef.id, 'detalle'), {
    descripcion: item.descripcion,
    productoId: item.productoId || null,
    cantidad: item.cantidad,
    precioUnitario: item.precioUnitario,
    subtotal: item.cantidad * (pricesIncludeVAT ? (item.precioUnitario / factor) : item.precioUnitario),
    impuestosItem: item.impuestosItem ?? null,
  }));
  await Promise.all(detallePromises);

  await addDoc(collection(db, 'Facturas', facturaRef.id, 'historial'), {
    cambio: 'creacion_externa',
    user: sanitizeUser(user),
    timestamp: serverTimestamp(),
    diff: { subtotal, impuestos, total, ivaPercent, pdfUrl: pdfUrl || null, xmlUrl: xmlUrl || null },
  });

  return { id: facturaRef.id, numero, subtotal, impuestos, total };
}

// Elimina valores undefined para evitar errores de Firestore y normaliza a null
function sanitizeUser(user?: InvoiceUser) {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
  };
}
