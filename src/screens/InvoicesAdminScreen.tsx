import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Switch,
  Modal,
  ScrollView,
  Image,
  Linking,
  Platform,
  ViewStyle,
} from 'react-native';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import Toast from 'react-native-toast-message';
import { db } from '../../firebaseConfig';
import { colors, globalStyles } from '../styles/globalStyles';
import { formatCurrency } from '../utils/currency';
import { buildInvoiceHtml, buildAnulacionHtml, generateAndUploadInvoicePdf } from '../utils/invoicePdf';
import {
  addExternalInvoice,
  cancelInvoice,
  createInvoiceFromOrder,
  updateInvoiceFields,
  InvoiceItemInput,
} from '../utils/facturacion';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type Factura = {
  id: string;
  numero?: number;
  clienteId?: string;
  clienteNombre?: string;
  clienteDireccion?: string;
  clienteContacto?: string;
  clienteTelefono?: string;
  clienteEmail?: string;
  notas?: string;
  pedidoId?: string;
  pedidoIds?: string[];
  pedidoNumeros?: number[];
  ivaPercent?: number;
  estado?: string;
  subtotal?: number;
  impuestos?: number;
  total?: number;
  fechaEmision?: any;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
  externa?: boolean;
};

type Cliente = {
  nombre?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  cedula?: string;
};

type Pedido = {
  id: string;
  clienteId: string;
  estado: string;
  estadoFinanciero?: string;
  numeroPedido?: number;
  fecha?: string;
  cantidadConAsa?: number;
  cantidadSinAsa?: number;
  costoUnitario?: number;
  total?: number;
};

const InvoicesAdminScreen = () => {
  const auth = getAuth();
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [clienteFiltro, setClienteFiltro] = useState('');
  const [numeroFiltro, setNumeroFiltro] = useState('');
  const [clientesMap, setClientesMap] = useState<Record<string, Cliente>>({});

  const estadoOptions = [
    { value: '', label: 'Todas' },
    { value: 'activa', label: 'Activas' },
    { value: 'pagada', label: 'Pagadas' },
    { value: 'pendiente', label: 'Pendientes' },
    { value: 'anulada', label: 'Anuladas' },
    { value: 'externa', label: 'Externas' },
  ];

  const [ivaPercent, setIvaPercent] = useState(16);
  const [pricesIncludeVAT, setPricesIncludeVAT] = useState(true); // default: los precios ya incluyen IVA
  const [empresaCfg, setEmpresaCfg] = useState<any | null>(null);
  const [orders, setOrders] = useState<Pedido[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [modalCrearPedido, setModalCrearPedido] = useState(false);
  const [modalCrearExterna, setModalCrearExterna] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [modalAnular, setModalAnular] = useState(false);

  const [ordersSeleccionados, setOrdersSeleccionados] = useState<string[]>([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [notaFactura, setNotaFactura] = useState('');

  const [preciosIncluyenIvaExterna, setPreciosIncluyenIvaExterna] = useState<boolean>(true);

  const [rifPrefix, setRifPrefix] = useState<'V' | 'J'>('V');
  const [rifNumber, setRifNumber] = useState('');
  const [descExterna, setDescExterna] = useState('');
  const [cantExterna, setCantExterna] = useState('1');
  const [precioExterna, setPrecioExterna] = useState('0');
  const [notaExterna, setNotaExterna] = useState('');
  const [ivaExterna, setIvaExterna] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [xmlUrl, setXmlUrl] = useState('');
  const [nombreExterna, setNombreExterna] = useState('');
  const [direccionExterna, setDireccionExterna] = useState('');
  const [telefonoExterna, setTelefonoExterna] = useState('');
  const [correoExterna, setCorreoExterna] = useState('');

  const [detalleFactura, setDetalleFactura] = useState<any | null>(null);
  const [detalleItems, setDetalleItems] = useState<any[]>([]);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [anularReason, setAnularReason] = useState('');

  // Escucha de facturas
  useEffect(() => {
    const q = query(collection(db, 'Facturas'), orderBy('fechaEmision', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setFacturas(data);
      setLoading(false);
    }, (err) => {
      console.error('Error cargando facturas:', err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Configuración de facturación (IVA, precios incluyen IVA)
  useEffect(() => {
    const ref = doc(db, 'config', 'facturacion');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (typeof data.ivaPercent === 'number') setIvaPercent(data.ivaPercent);
        if (typeof data.pricesIncludeVAT === 'boolean') setPricesIncludeVAT(!!data.pricesIncludeVAT);
        if (data.pricesIncludeVAT === undefined) setPricesIncludeVAT(true);
      } else {
        setPricesIncludeVAT(true);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setPreciosIncluyenIvaExterna(pricesIncludeVAT);
  }, [pricesIncludeVAT]);

  // Configuración de empresa (branding)
  useEffect(() => {
    const ref = doc(db, 'config', 'empresa');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setEmpresaCfg(snap.data());
      else setEmpresaCfg(null);
    }, () => setEmpresaCfg(null));
    return () => unsub();
  }, []);

  // Mapear clientes (para mostrar nombre/dirección/contacto)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'Clientes'), (snap) => {
      const map: Record<string, Cliente> = {};
      snap.forEach((d) => {
        map[d.id] = d.data() as Cliente;
      });
      setClientesMap(map);
    });
    return () => unsub();
  }, []);

  // Carga de pedidos elegibles (pagados y entregados/listos)
  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const snap = await getDocs(collection(db, 'Pedidos'));
      const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Pedido));
      const elegibles = data.filter((p) => {
        const paid = p.estadoFinanciero === 'pagado' || p.estadoFinanciero === 'cobrado';
        const delivered = p.estado === 'entregado' || p.estado === 'listo';
        return paid && delivered;
      });
      setOrders(elegibles);
    } catch (err) {
      console.error('Error cargando pedidos:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const filteredFacturas = useMemo(() => {
    return facturas.filter((f) => {
      const matchEstado = estadoFiltro === 'externa' ? !!f.externa : (estadoFiltro ? f.estado === estadoFiltro : true);
      const matchCliente = clienteFiltro ? (f.clienteId || '').includes(clienteFiltro) : true;
      const matchNumero = numeroFiltro ? String(f.numero || '').includes(numeroFiltro) : true;
      return matchEstado && matchCliente && matchNumero;
    });
  }, [facturas, estadoFiltro, clienteFiltro, numeroFiltro]);

  const filteredOrdersModal = useMemo(() => {
    if (!orderSearch.trim()) return orders;
    const q = orderSearch.trim().toLowerCase();
    return orders.filter((o) => {
      const cliente = clientesMap[o.clienteId] || {} as any;
      const nombre = String(cliente.nombre ?? '').toLowerCase();
      const cedula = String(cliente.cedula ?? '').toLowerCase();
      const numeroPedido = o.numeroPedido ? String(o.numeroPedido) : '';
      return nombre.includes(q) || cedula.includes(q) || numeroPedido.includes(q);
    });
  }, [orderSearch, orders, clientesMap]);

  const totalsPreview = useMemo(() => {
    const qty = Number(cantExterna);
    const price = Number(precioExterna);
    const iva = ivaExterna ? Number(ivaExterna) : ivaPercent;
    if (!(qty > 0) || !(price > 0) || Number.isNaN(iva)) return null;
    const factor = 1 + (iva / 100);
    if (preciosIncluyenIvaExterna) {
      const total = qty * price;
      const subtotal = total / factor;
      const impuestos = total - subtotal;
      return { subtotal, impuestos, total };
    }
    const subtotal = qty * price;
    const impuestos = subtotal * (iva / 100);
    const total = subtotal + impuestos;
    return { subtotal, impuestos, total };
  }, [cantExterna, precioExterna, ivaExterna, ivaPercent, preciosIncluyenIvaExterna]);

  const clienteIdPreview = useMemo(() => {
    if (!rifNumber) return '';
    return `${rifPrefix}${rifNumber}`;
  }, [rifPrefix, rifNumber]);


  const resumen = useMemo(() => {
    const total = facturas.length;
    const activas = facturas.filter((f) => f.estado === 'activa').length;
    const pagadas = facturas.filter((f) => f.estado === 'pagada').length;
    const pendientes = facturas.filter((f) => f.estado === 'pendiente').length;
    const anuladas = facturas.filter((f) => f.estado === 'anulada').length;
    const montoTotal = facturas.reduce((acc, f) => acc + (f.total || 0), 0);
    return { total, activas, pagadas, pendientes, anuladas, montoTotal };
  }, [facturas]);

  const userInfo = () => {
    const u = auth.currentUser;
    return u ? { uid: u.uid, email: u.email || undefined, displayName: u.displayName || undefined } : undefined;
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    Toast.show({ type, text1: type === 'success' ? 'Listo' : 'Error', text2: message, position: 'top' });
  };

  const handleOrderSearchChange = (text: string) => {
    const sanitized = text.replace(/[^a-zA-Z0-9]/g, '');
    setOrderSearch(sanitized);
  };

  const resolveLogo = () => {
    // Fallback: pequeño PNG transparente embebido para evitar fallo de bundling si el asset falta
    const transparentPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3WZfkAAAAASUVORK5CYII=';
    return transparentPng;
  };

  // Genera PDF sin abrir el modal (carga detalle y cliente on-demand)
  const handleGenerarPdfDesdeLista = async (factura: Factura) => {
    try {
      // Cargar items del detalle
      const detSnap = await getDocs(collection(db, 'Facturas', factura.id, 'detalle'));
      const items = detSnap.docs.map((d) => ({
        descripcion: String(d.data().descripcion || ''),
        cantidad: Number(d.data().cantidad || 0),
        precioUnitario: Number(d.data().precioUnitario || 0),
        subtotal: Number(d.data().subtotal || (Number(d.data().cantidad || 0) * Number(d.data().precioUnitario || 0))),
      }));

      // Cliente
      let cliente: any = undefined;
      if (factura.clienteId) {
        const cSnap = await getDoc(doc(db, 'Clientes', factura.clienteId));
        cliente = cSnap.exists() ? cSnap.data() : undefined;
      }

      const html = buildInvoiceHtml({
        empresa: {
          nombre: empresaCfg?.nombre || 'AquaLife',
          rif: empresaCfg?.rif,
          direccion: empresaCfg?.direccion,
          telefono: empresaCfg?.telefono,
          logoUrl: empresaCfg?.logoDataUrl || empresaCfg?.logoUrl || resolveLogo(),
        },
        factura: {
          numero: factura.numero || factura.id,
          fechaEmision: factura.fechaEmision,
          clienteId: factura.clienteId,
          ivaPercent: factura.ivaPercent ?? ivaPercent,
          subtotal: factura.subtotal,
          impuestos: factura.impuestos,
          total: factura.total,
          estado: factura.estado,
          notas: factura.notas,
        },
        cliente: cliente
          ? { nombre: cliente.nombre, direccion: cliente.direccion, telefono: cliente.telefono, email: cliente.email, cedula: cliente.cedula }
          : (factura.clienteNombre || factura.clienteId
              ? { nombre: factura.clienteNombre || 'Cliente externo', cedula: factura.clienteId, direccion: factura.clienteDireccion, telefono: factura.clienteTelefono || factura.clienteContacto, email: factura.clienteEmail }
              : undefined),
        items,
      });

      const storagePath = `facturas/${factura.id}.pdf`;
      const url = await generateAndUploadInvoicePdf(html, storagePath, `factura_${factura.numero || factura.id}`);
      await updateInvoiceFields(factura.id, { pdfUrl: url });
      showToast('success', 'PDF generado y subido.');
    } catch (e: any) {
      console.error('Error generando PDF:', e);
      if (e?.message === 'STORAGE_DISABLED') {
        showToast('success', 'PDF generado localmente. Revisa la descarga o el archivo local.');
        return;
      }
      showToast('error', e?.message || 'No se pudo generar el PDF');
    }
  };

  const handleCrearDesdePedido = async () => {
    if (!ordersSeleccionados || ordersSeleccionados.length === 0) {
      showToast('error', 'Selecciona al menos un pedido.');
      return;
    }
    const seleccionados = orders.filter(o => ordersSeleccionados.includes(o.id));
    if (seleccionados.length === 0) {
      showToast('error', 'Pedidos no encontrados.');
      return;
    }
    const clienteId = seleccionados[0].clienteId;
    const allSameCliente = seleccionados.every(o => o.clienteId === clienteId);
    if (!allSameCliente) {
      showToast('error', 'Todos los pedidos deben ser del mismo cliente.');
      return;
    }

    const invalidEstados = seleccionados.filter((o) => !(o.estado === 'entregado' || o.estado === 'listo'));
    if (invalidEstados.length) {
      showToast('error', 'Solo se pueden facturar pedidos entregados o listos.');
      return;
    }
    const invalidPagos = seleccionados.filter((o) => !(o.estadoFinanciero === 'pagado' || o.estadoFinanciero === 'cobrado'));
    if (invalidPagos.length) {
      showToast('error', 'Solo se pueden facturar pedidos pagados/cobrados.');
      return;
    }

    const items: InvoiceItemInput[] = [];
    for (const order of seleccionados) {
      const precio = order.costoUnitario || 0;
      if (order.cantidadConAsa && order.cantidadConAsa > 0) {
        items.push({ descripcion: `Botellon con asa (Pedido ${order.numeroPedido || order.id})`, cantidad: order.cantidadConAsa, precioUnitario: precio });
      }
      if (order.cantidadSinAsa && order.cantidadSinAsa > 0) {
        items.push({ descripcion: `Botellon sin asa (Pedido ${order.numeroPedido || order.id})`, cantidad: order.cantidadSinAsa, precioUnitario: precio });
      }
      if (!order.cantidadConAsa && !order.cantidadSinAsa) {
        items.push({ descripcion: `Servicio (Pedido ${order.numeroPedido || order.id})`, cantidad: 1, precioUnitario: order.total || precio });
      }
    }

    const hasPositiveLine = items.some((i) => (i.cantidad || 0) > 0 && (i.precioUnitario || 0) > 0);
    if (!hasPositiveLine) {
      showToast('error', 'Los pedidos seleccionados no tienen cantidades o precios válidos (> 0).');
      return;
    }

    try {
      await createInvoiceFromOrder({
        pedidoIds: seleccionados.map(o => o.id),
        pedidoNumeros: seleccionados.map(o => o.numeroPedido).filter((n) => typeof n === 'number') as number[],
        clienteId,
        items,
        ivaPercent,
        pricesIncludeVAT,
        notas: notaFactura,
        user: userInfo(),
      });
      showToast('success', 'Factura creada.');
      setModalCrearPedido(false);
      setOrdersSeleccionados([]);
      setNotaFactura('');
    } catch (err: any) {
      console.error(err);
      showToast('error', err?.message || 'No se pudo crear la factura.');
    }
  };

  const handleCrearExterna = async () => {
    const cantidad = Number(cantExterna);
    const precio = Number(precioExterna);
    const iva = ivaExterna ? Number(ivaExterna) : ivaPercent;
    const clienteId = `${rifPrefix}${rifNumber}`;
    const contactoCompuesto = [telefonoExterna.trim(), correoExterna.trim()].filter(Boolean).join(' / ');
    if (!rifNumber || !nombreExterna || !direccionExterna || (!telefonoExterna && !correoExterna) || !descExterna || !(cantidad > 0) || !(precio > 0)) {
      showToast('error', 'Completa C.I/RIF, nombre, dirección, teléfono o correo, descripción, cantidad y precio.');
      return;
    }
    if (Number.isNaN(iva) || iva < 0 || iva > 100) {
      showToast('error', 'IVA debe ser un numero entre 0 y 100.');
      return;
    }
    if (pdfUrl && !/^https?:\/\//i.test(pdfUrl)) {
      showToast('error', 'PDF URL debe iniciar con http o https.');
      return;
    }
    if (xmlUrl && !/^https?:\/\//i.test(xmlUrl)) {
      showToast('error', 'XML URL debe iniciar con http o https.');
      return;
    }
    const items: InvoiceItemInput[] = [
      { descripcion: descExterna.trim(), cantidad, precioUnitario: precio },
    ];
    try {
      await addExternalInvoice({
        clienteId,
        clienteNombre: nombreExterna.trim(),
        clienteDireccion: direccionExterna.trim(),
        clienteContacto: contactoCompuesto || undefined,
        clienteTelefono: telefonoExterna.trim() || undefined,
        clienteEmail: correoExterna.trim() || undefined,
        items,
        ivaPercent: iva,
        pricesIncludeVAT: preciosIncluyenIvaExterna,
        notas: notaExterna,
        pdfUrl: pdfUrl || undefined,
        xmlUrl: xmlUrl || undefined,
        user: userInfo(),
      });
      showToast('success', 'Factura externa creada.');
      setModalCrearExterna(false);
      setRifNumber('');
      setNombreExterna('');
      setDireccionExterna('');
      setTelefonoExterna('');
      setCorreoExterna('');
      setDescExterna('');
      setCantExterna('1');
      setPrecioExterna('0');
      setNotaExterna('');
      setPdfUrl('');
      setXmlUrl('');
    } catch (err: any) {
      console.error(err);
      showToast('error', err?.message || 'No se pudo crear la factura externa.');
    }
  };

  const handleDetalle = async (factura: Factura) => {
    setDetalleFactura(factura);
    setDetalleLoading(true);
    setModalDetalle(true);
    try {
      const itemsSnap = await getDocs(collection(db, 'Facturas', factura.id, 'detalle'));
      const items = itemsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setDetalleItems(items);
    } catch (err) {
      console.error('Error cargando detalle:', err);
      setDetalleItems([]);
    } finally {
      setDetalleLoading(false);
    }
  };

  const handleGenerarPdf = async () => {
    if (!detalleFactura) return;
    try {
      // cargar cliente para el PDF
      let cliente: any = undefined;
      if (detalleFactura.clienteId) {
        const cSnap = await getDoc(doc(db, 'Clientes', detalleFactura.clienteId));
        cliente = cSnap.exists() ? cSnap.data() : undefined;
      }
      const html = buildInvoiceHtml({
        empresa: {
          nombre: empresaCfg?.nombre || 'AquaLife',
          rif: empresaCfg?.rif || 'J-00000000-0',
          direccion: empresaCfg?.direccion || 'Domicilio Fiscal',
          telefono: empresaCfg?.telefono || '',
          logoUrl: empresaCfg?.logoDataUrl || empresaCfg?.logoUrl || resolveLogo(),
        },
        factura: {
          numero: detalleFactura.numero || detalleFactura.id,
          fechaEmision: detalleFactura.fechaEmision,
          clienteId: detalleFactura.clienteId,
          ivaPercent: detalleFactura.ivaPercent ?? ivaPercent,
          subtotal: detalleFactura.subtotal,
          impuestos: detalleFactura.impuestos,
          total: detalleFactura.total,
          estado: detalleFactura.estado,
          notas: detalleFactura.notas,
        },
        cliente: cliente
          ? {
              nombre: cliente.nombre,
              direccion: cliente.direccion,
              telefono: cliente.telefono,
              email: cliente.email,
              cedula: cliente.cedula,
            }
          : (detalleFactura.clienteNombre || detalleFactura.clienteId
              ? {
                  nombre: detalleFactura.clienteNombre || 'Cliente externo',
                  cedula: detalleFactura.clienteId,
                  direccion: detalleFactura.clienteDireccion,
                  telefono: detalleFactura.clienteContacto,
                }
              : undefined),
        items: detalleItems.map((it) => ({ descripcion: it.descripcion, cantidad: it.cantidad, precioUnitario: it.precioUnitario, subtotal: it.subtotal })),
      });
      const storagePath = `facturas/${detalleFactura.id}.pdf`;
      const url = await generateAndUploadInvoicePdf(html, storagePath, `factura_${detalleFactura.numero || detalleFactura.id}`);
      await updateInvoiceFields(detalleFactura.id, { pdfUrl: url });
      showToast('success', 'PDF generado y guardado.');
    } catch (err: any) {
      if (err?.message === 'STORAGE_DISABLED') {
        showToast('success', 'PDF generado localmente. Revisa la descarga o el archivo local.');
        return;
      }
      console.error(err);
      showToast('error', err?.message || 'No se pudo generar el PDF.');
    }
  };

  const handleAnular = async () => {
    if (!detalleFactura) return;
    if (!anularReason.trim()) {
      showToast('error', 'Agrega un motivo para anular.');
      return;
    }
    try {
      await cancelInvoice({ facturaId: detalleFactura.id, motivo: anularReason, user: userInfo()! });
      // Generar comprobante de anulación
      const html = buildAnulacionHtml({ empresa: { nombre: empresaCfg?.nombre || 'AquaLife' }, factura: { numero: detalleFactura.numero || detalleFactura.id, fechaEmision: detalleFactura.fechaEmision }, motivo: anularReason });
      const storagePath = `facturas/${detalleFactura.id}_anulacion.pdf`;
      const url = await generateAndUploadInvoicePdf(html, storagePath, `anulacion_${detalleFactura.numero || detalleFactura.id}`);
      await updateInvoiceFields(detalleFactura.id, { cancelPdfUrl: url });
      showToast('success', 'Factura anulada y comprobante generado.');
      setModalAnular(false);
      setModalDetalle(false);
      setAnularReason('');
    } catch (err: any) {
      if (err?.message === 'STORAGE_DISABLED') {
        showToast('success', 'Factura anulada. Comprobante generado localmente.');
        setModalAnular(false);
        setModalDetalle(false);
        setAnularReason('');
        return;
      }
      console.error(err);
      showToast('error', err?.message || 'No se pudo anular la factura.');
    }
  };

  const handleMarcarPagada = async () => {
    if (!detalleFactura) return;
    try {
      await updateInvoiceFields(detalleFactura.id, { estado: 'pagada' }, userInfo());
      showToast('success', 'Factura marcada como pagada.');
    } catch (err: any) {
      console.error(err);
      showToast('error', err?.message || 'No se pudo actualizar.');
    }
  };

  const renderItem = ({ item }: { item: Factura }) => (
    <View style={styles.invoiceCard}>
      <View style={styles.invoiceHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.invoiceTitle}>Factura #{item.numero || item.id}</Text>
          <Text style={styles.invoiceSubtitle}>
            Cliente: {clientesMap[item.clienteId || '']?.nombre || item.clienteNombre || clientesMap[item.clienteId || '']?.cedula || 'N/D'}
          </Text>
          <Text style={styles.invoiceCaption}>Cédula: {clientesMap[item.clienteId || '']?.cedula || item.clienteId || 'N/D'}</Text>
        </View>
        <View style={[styles.badge, badgeStyle(item.estado)]}>
          <Text style={[styles.badgeText, badgeTextStyle(item.estado)]}>{item.estado || 'sin-estado'}</Text>
        </View>
      </View>

      <View style={styles.invoiceRow}>
        <View>
          <Text style={styles.label}>Total</Text>
          <Text style={styles.amount}>{formatCurrency(item.total || 0)}</Text>
        </View>
        <View>
          <Text style={styles.label}>Emisión</Text>
          <Text style={styles.value}>{formatDate(item.fechaEmision)}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        {item.pedidoNumeros && item.pedidoNumeros.length > 0 ? (
          <View style={styles.metaPill}>
            <Ionicons name="cube-outline" size={16} color={colors.secondaryDark} />
            <Text style={styles.metaText}>
              {item.pedidoNumeros.length === 1
                ? `Pedido #${item.pedidoNumeros[0]}`
                : `Pedidos #${item.pedidoNumeros.map((n) => `#${n}`).join(', ')}`}
            </Text>
          </View>
        ) : item.pedidoId ? (
          <View style={styles.metaPill}>
            <Ionicons name="cube-outline" size={16} color={colors.secondaryDark} />
            <Text style={styles.metaText}>Pedido sin número</Text>
          </View>
        ) : null}
        {clientesMap[item.clienteId || '']?.cedula || item.clienteId ? (
          <View style={styles.metaPill}>
            <Ionicons name="id-card-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.metaText}>Cédula {clientesMap[item.clienteId || '']?.cedula || item.clienteId}</Text>
          </View>
        ) : null}
        {item.externa ? (
          <View style={styles.metaPill}>
            <Ionicons name="earth-outline" size={16} color={colors.secondaryDark} />
            <Text style={styles.metaText}>Externa</Text>
          </View>
        ) : null}
        {item.pdfUrl ? (
          <View style={styles.metaPill}>
            <Ionicons name="document-text-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.metaText}>PDF listo</Text>
          </View>
        ) : null}
        {item.xmlUrl ? (
          <View style={styles.metaPill}>
            <Ionicons name="code-slash-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.metaText}>XML</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.invoiceActions}>
        <TouchableOpacity style={styles.ghostButton} onPress={() => handleDetalle(item)}>
          <Ionicons name="eye-outline" size={18} color={colors.primary} />
          <Text style={styles.ghostButtonText}>Ver detalle</Text>
        </TouchableOpacity>
        {item.estado !== 'anulada' ? (
          <TouchableOpacity style={styles.ghostButton} onPress={() => handleGenerarPdfDesdeLista(item)}>
            <Ionicons name="download-outline" size={18} color={colors.primary} />
            <Text style={styles.ghostButtonText}>Generar PDF</Text>
          </TouchableOpacity>
        ) : null}
        {item.pdfUrl ? (
          <TouchableOpacity style={styles.ghostButton} onPress={() => Linking.openURL(item.pdfUrl as string).catch(() => {})}>
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            <Text style={styles.ghostButtonText}>Abrir PDF</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={filteredFacturas}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No hay facturas.</Text>}
          ListHeaderComponent={
            <>
              <LinearGradient colors={colors.gradientPrimary} style={styles.hero}>
                <View style={styles.heroTop}>
                  <View>
                    <Text style={styles.heroKicker}>Panel de facturación</Text>
                    <Text style={styles.heroTitle}>Gestión de Facturas</Text>
                    <Text style={styles.heroSubtitle}>Crea, filtra y supervisa el estado de tus comprobantes.</Text>
                  </View>
                  <View style={styles.heroBadge}>
                    <Ionicons name="document-text-outline" size={24} color={colors.textInverse} />
                    <Text style={styles.heroBadgeText}>{resumen.total} facturas</Text>
                  </View>
                </View>
                <View style={styles.heroStats}>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Monto total</Text>
                    <Text style={styles.statValue}>{formatCurrency(resumen.montoTotal)}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Activas</Text>
                    <Text style={styles.statValue}>{resumen.activas}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Pagadas</Text>
                    <Text style={styles.statValue}>{resumen.pagadas}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Pendientes</Text>
                    <Text style={styles.statValue}>{resumen.pendientes}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Anuladas</Text>
                    <Text style={styles.statValue}>{resumen.anuladas}</Text>
                  </View>
                </View>
              </LinearGradient>

              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Filtros</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
                  {estadoOptions.map((opt) => {
                    const active = estadoFiltro === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setEstadoFiltro(opt.value)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={styles.filtersRow}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Cliente ID</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Buscar cliente"
                      value={clienteFiltro}
                      onChangeText={setClienteFiltro}
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Número</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0001"
                      value={numeroFiltro}
                      onChangeText={setNumeroFiltro}
                      keyboardType="numeric"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                </View>

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[globalStyles.button, globalStyles.buttonPrimary, styles.actionButton]}
                    onPress={() => {
                      loadOrders();
                      setModalCrearPedido(true);
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={colors.textInverse} />
                    <Text style={[globalStyles.buttonText, globalStyles.buttonTextPrimary, styles.actionButtonText]}>Facturar pedido</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[globalStyles.button, globalStyles.buttonSecondary, styles.actionButton]}
                    onPress={() => setModalCrearExterna(true)}
                  >
                    <Ionicons name="receipt-outline" size={18} color={colors.textInverse} />
                    <Text style={[globalStyles.buttonText, globalStyles.buttonTextPrimary, styles.actionButtonText]}>Factura externa</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          }
        />
      )}

      {/* Modal crear desde pedido */}
      <Modal visible={modalCrearPedido} animationType="fade" transparent onRequestClose={() => setModalCrearPedido(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCardWide}>
            <Text style={styles.modalTitle}>Crear factura desde pedido</Text>
            {loadingOrders ? <ActivityIndicator color={colors.primary} /> : null}

            <View style={[styles.inputGroup, { marginTop: 8 }]}> 
              <Text style={styles.inputLabel}>Buscar pedido por cliente o número</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: cedula o nombre del cliente"
                value={orderSearch}
                onChangeText={handleOrderSearchChange}
                autoCapitalize="none"
                placeholderTextColor={colors.textSecondary}
              />
              <Text style={[styles.inputLabel, { marginTop: 4 }]}>Solo letras y números</Text>
            </View>

            <ScrollView style={{ maxHeight: '60%' }}>
              {filteredOrdersModal.map((o) => {
                const selected = ordersSeleccionados.includes(o.id);
                const cliente = clientesMap[o.clienteId] || {} as any;
                return (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.orderItem, selected && styles.orderItemSelected]}
                  onPress={() => setOrdersSeleccionados((prev) => {
                    if (prev.length === 0) return [o.id];
                    const firstOrder = orders.find(ord => ord.id === prev[0]);
                    if (firstOrder && firstOrder.clienteId !== o.clienteId) {
                      showToast('error', 'No se pueden mezclar pedidos de distintos clientes.');
                      return prev;
                    }
                    return prev.includes(o.id) ? prev.filter(id => id !== o.id) : [...prev, o.id];
                  })}
                >
                  <Text style={[styles.text, { fontWeight: '700' }]}>Pedido #{o.numeroPedido || 's/n'}</Text>
                  <Text style={styles.text}>Cliente: {cliente.nombre || 'Sin nombre'} · Cédula: {cliente.cedula || 'N/D'}</Text>
                  <Text style={styles.text}>Estado: {o.estado} · Fin: {o.estadoFinanciero || 'N/D'}</Text>
                  <Text style={[styles.text, { color: colors.primary }]}>Total pedido: {formatCurrency(o.total || 0)}</Text>
                </TouchableOpacity>
              )})}
            </ScrollView>

            <TextInput
              style={styles.input}
              placeholder="Notas"
              value={notaFactura}
              onChangeText={setNotaFactura}
            />
            <View style={[styles.modalActions, { justifyContent: 'space-between' }]}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setModalCrearPedido(false)}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.primaryButton, ordersSeleccionados.length === 0 && { opacity: 0.5 }]}
                  onPress={handleCrearDesdePedido}
                  disabled={ordersSeleccionados.length === 0}
                >
                  <Text style={styles.primaryButtonText}>Crear</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal factura externa (estilo y validaciones) */}
      <Modal visible={modalCrearExterna} animationType="fade" transparent onRequestClose={() => setModalCrearExterna(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCardWide}>
            <Text style={styles.modalTitle}>Factura externa</Text>
            <ScrollView style={{ maxHeight: '72%' }} contentContainerStyle={{ paddingBottom: 12 }}>
              <View style={[styles.inputGroup, { marginTop: 4 }]}>
                <Text style={styles.inputLabel}>C.I / RIF</Text>
                <View style={styles.rifRow}>
                  <View style={styles.rifPrefixGroup}>
                    {(['V', 'J'] as const).map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[styles.rifPrefixButton, rifPrefix === p && styles.rifPrefixButtonActive]}
                        onPress={() => setRifPrefix(p)}
                      >
                        <Text style={[styles.rifPrefixText, rifPrefix === p && styles.rifPrefixTextActive]}>{p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="C.I. o RIF sin guiones"
                    value={rifNumber}
                    onChangeText={(t) => setRifNumber(t.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    autoCapitalize="none"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                {rifNumber ? (
                  <Text style={[styles.helperText, { marginTop: 6 }]}>
                    {clientesMap[clienteIdPreview]?.nombre ? `Cliente registrado: ${clientesMap[clienteIdPreview]?.nombre}` : 'No coincide con cliente registrado (se guardará como externo).'}
                  </Text>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nombre</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nombre o razón social"
                  value={nombreExterna}
                  onChangeText={setNombreExterna}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Dirección</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Dirección fiscal o de entrega"
                  value={direccionExterna}
                  onChangeText={setDireccionExterna}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Descripción</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Detalle del servicio o producto"
                  value={descExterna}
                  onChangeText={setDescExterna}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.filtersRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Teléfono</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: 0414-0000000"
                    value={telefonoExterna}
                    onChangeText={setTelefonoExterna}
                    keyboardType="phone-pad"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Correo</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="correo@ejemplo.com"
                    value={correoExterna}
                    onChangeText={setCorreoExterna}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.filtersRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Cantidad</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1"
                    value={cantExterna}
                    onChangeText={setCantExterna}
                    keyboardType="numeric"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Precio unitario</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    value={precioExterna}
                    onChangeText={setPrecioExterna}
                    keyboardType="numeric"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>IVA (%)</Text>
                <TextInput
                  style={styles.input}
                  placeholder={`IVA (% , default ${ivaPercent})`}
                  value={ivaExterna}
                  onChangeText={setIvaExterna}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                />
                
              </View>

              <View style={[styles.filtersRow, { alignItems: 'center', marginBottom: 6 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Precios incluyen IVA</Text>
                  <Text style={styles.helperText}>Actívalo si los precios ingresados ya traen IVA incluido.</Text>
                </View>
                <Switch
                  value={preciosIncluyenIvaExterna}
                  onValueChange={setPreciosIncluyenIvaExterna}
                  thumbColor={preciosIncluyenIvaExterna ? colors.primary : '#f4f3f4'}
                  trackColor={{ false: '#d1d5db', true: colors.primaryLight }}
                />
              </View>

              <View style={[styles.infoCard, { marginBottom: 6 }]}>
                <Text style={styles.infoTitle}>Resumen (previo)</Text>
                {totalsPreview ? (
                  <>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Subtotal</Text>
                      <Text style={styles.infoValue}>{formatCurrency(totalsPreview.subtotal)}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>IVA</Text>
                      <Text style={styles.infoValue}>{formatCurrency(totalsPreview.impuestos)}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, { fontWeight: '700' }]}>Total</Text>
                      <Text style={[styles.infoValue, { fontWeight: '700' }]}>{formatCurrency(totalsPreview.total)}</Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.text}>Ingresa cantidad, precio e IVA para ver el cálculo.</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Notas</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Notas internas (opcional)"
                  value={notaExterna}
                  onChangeText={setNotaExterna}
                  multiline
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>PDF URL (opcional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://..."
                  value={pdfUrl}
                  onChangeText={setPdfUrl}
                  autoCapitalize="none"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>XML URL (opcional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://..."
                  value={xmlUrl}
                  onChangeText={setXmlUrl}
                  autoCapitalize="none"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </ScrollView>

            <View style={[styles.modalActions, { justifyContent: 'space-between' }]}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setModalCrearExterna(false)}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleCrearExterna}
              >
                <Text style={styles.primaryButtonText}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal detalle (estilo mejorado como crear factura) */}
      <Modal visible={modalDetalle} animationType="fade" transparent onRequestClose={() => setModalDetalle(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCardWide}>
            <Text style={styles.modalTitle}>Detalle factura {detalleFactura?.numero || detalleFactura?.id}</Text>
            {detalleFactura?.estado ? (
              <View style={[styles.badge, badgeStyle(detalleFactura?.estado)]}>
                <Text style={[styles.badgeText, badgeTextStyle(detalleFactura?.estado)]}>
                  {String(detalleFactura?.estado).toUpperCase()}
                </Text>
              </View>
            ) : null}

            {detalleLoading ? <ActivityIndicator color={colors.primary} /> : (
              <ScrollView style={{ maxHeight: '60%' }}>
                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>Cliente</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Nombre</Text>
                    <Text style={styles.infoValue}>{clientesMap[detalleFactura?.clienteId || '']?.nombre || detalleFactura?.clienteNombre || 'N/D'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Cédula</Text>
                    <Text style={styles.infoValue}>{clientesMap[detalleFactura?.clienteId || '']?.cedula || detalleFactura?.clienteId || 'N/D'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Dirección</Text>
                    <Text style={styles.infoValue}>{clientesMap[detalleFactura?.clienteId || '']?.direccion || detalleFactura?.clienteDireccion || 'N/D'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Contacto</Text>
                    <Text style={styles.infoValue}>
                      {clientesMap[detalleFactura?.clienteId || '']?.telefono
                        || detalleFactura?.clienteTelefono
                        || clientesMap[detalleFactura?.clienteId || '']?.email
                        || detalleFactura?.clienteEmail
                        || detalleFactura?.clienteContacto
                        || 'N/D'}
                    </Text>
                  </View>
                  {clientesMap[detalleFactura?.clienteId || '']?.email || detalleFactura?.clienteEmail ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Correo</Text>
                      <Text style={styles.infoValue}>{clientesMap[detalleFactura?.clienteId || '']?.email || detalleFactura?.clienteEmail}</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={[styles.infoTitle, { marginBottom: 8 }]}>Ítems</Text>
                {detalleItems.map((it) => (
                  <View key={it.id} style={styles.orderItem}>
                    <Text style={[styles.text, { fontWeight: '600' }]}>{it.descripcion}</Text>
                    <Text style={styles.text}>Cant: {it.cantidad} · P.U: {formatCurrency(it.precioUnitario || 0)}</Text>
                    <Text style={[styles.text, { color: colors.primary }]}>Subtotal: {formatCurrency(it.subtotal || 0)}</Text>
                  </View>
                ))}

                <View style={[styles.infoCard, { marginTop: 10 }]}> 
                  <Text style={styles.infoTitle}>Totales</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Subtotal</Text>
                    <Text style={styles.infoValue}>{formatCurrency(detalleFactura?.subtotal || 0)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Impuestos</Text>
                    <Text style={styles.infoValue}>{formatCurrency(detalleFactura?.impuestos || 0)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { fontWeight: '700' }]}>Total</Text>
                    <Text style={[styles.infoValue, { fontWeight: '700' }]}>{formatCurrency(detalleFactura?.total || 0)}</Text>
                  </View>
                </View>

                {detalleFactura?.estado === 'anulada' && detalleFactura?.motivoAnulacion ? (
                  <View style={[styles.infoCard, { marginTop: 10 }]}> 
                    <Text style={styles.infoTitle}>Motivo de anulación</Text>
                    <Text style={[styles.text, { color: colors.danger }]}>{detalleFactura.motivoAnulacion}</Text>
                  </View>
                ) : null}

                {detalleFactura?.notas ? (
                  <View style={[styles.infoCard, { marginTop: 10 }]}> 
                    <Text style={styles.infoTitle}>Notas</Text>
                    <Text style={styles.text}>{String(detalleFactura?.notas)}</Text>
                  </View>
                ) : null}
              </ScrollView>
            )}

            <View style={[styles.modalActions, { justifyContent: 'space-between' }]}> 
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setModalDetalle(false)}>
                <Text style={styles.secondaryButtonText}>Cerrar</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {detalleFactura?.estado !== 'anulada' ? (
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {
                      if (detalleFactura?.estado === 'pagada') {
                        showToast('error', 'Estás anulando una factura ya pagada. Se generará comprobante de anulación.');
                      }
                      setModalAnular(true);
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>Anular</Text>
                  </TouchableOpacity>
                ) : null}

                {detalleFactura?.estado !== 'pagada' && detalleFactura?.estado !== 'anulada' ? (
                  <TouchableOpacity style={styles.primaryButton} onPress={handleMarcarPagada}>
                    <Text style={styles.primaryButtonText}>Marcar pagada</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity style={styles.primaryButton} onPress={handleGenerarPdf}>
                  <Text style={styles.primaryButtonText}>Generar PDF</Text>
                </TouchableOpacity>
                {detalleFactura?.pdfUrl ? (
                  <TouchableOpacity style={styles.primaryButton} onPress={() => Linking.openURL(String(detalleFactura?.pdfUrl)).catch(() => {})}>
                    <Text style={styles.primaryButtonText}>Abrir PDF</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal anular */}
      <Modal visible={modalAnular} transparent animationType="fade" onRequestClose={() => setModalAnular(false)}>
        <View style={styles.overlay}>
          <View style={styles.anularCard}>
            <Text style={styles.modalTitle}>Motivo de anulación</Text>
            <TextInput
              style={styles.input}
              placeholder="Motivo"
              value={anularReason}
              onChangeText={setAnularReason}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setModalAnular(false)}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={handleAnular}>
                <Text style={styles.primaryButtonText}>Anular</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const formatDate = (ts: any) => {
  if (!ts) return 'N/D';
  try {
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toISOString().split('T')[0];
  } catch (e) {
    return 'N/D';
  }
};

const badgeStyle = (estado?: string) => {
  switch (estado) {
    case 'pagada':
      return { backgroundColor: '#DCFCE7', color: '#166534' };
    case 'anulada':
      return { backgroundColor: '#FEE2E2', color: '#991B1B' };
    case 'pendiente':
      return { backgroundColor: '#FEF9C3', color: '#92400E' };
    default:
      return { backgroundColor: '#E0F2FE', color: '#075985' };
  }
};

const badgeTextStyle = (estado?: string) => {
  switch (estado) {
    case 'pagada':
      return { color: '#166534' };
    case 'anulada':
      return { color: '#991B1B' };
    case 'pendiente':
      return { color: '#92400E' };
    default:
      return { color: '#075985' };
  }
};

const cardShadow: ViewStyle = Platform.select({
  web: { boxShadow: '0 6px 20px rgba(0,0,0,0.08)' } as ViewStyle,
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  } as ViewStyle,
}) as ViewStyle;

const modalShadow: ViewStyle = Platform.select({
  web: { boxShadow: '0 12px 30px rgba(0,0,0,0.14)' } as ViewStyle,
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  } as ViewStyle,
}) as ViewStyle;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },

  // Hero / resumen
  hero: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroKicker: {
    color: colors.textInverse,
    fontSize: 12,
    opacity: 0.9,
    marginBottom: 4,
  },
  heroTitle: {
    color: colors.textInverse,
    fontSize: 22,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: colors.textInverse,
    opacity: 0.9,
    marginTop: 6,
  },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  heroBadgeText: {
    color: colors.textInverse,
    marginTop: 6,
    fontWeight: '600',
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  statCard: {
    flexGrow: 1,
    minWidth: 120,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 12,
    padding: 12,
  },
  statLabel: {
    color: colors.textInverse,
    opacity: 0.85,
    fontSize: 12,
  },
  statValue: {
    color: colors.textInverse,
    fontWeight: '700',
    fontSize: 18,
    marginTop: 4,
  },

  // Panel filtros y acciones
  panel: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    ...cardShadow,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: colors.primaryShades[100],
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.primaryDark,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputGroup: {
    flex: 1,
    marginBottom: 12,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  rifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rifPrefixGroup: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: 10,
    overflow: 'hidden',
  },
  rifPrefixButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
  },
  rifPrefixButtonActive: {
    backgroundColor: colors.primaryShades[100],
  },
  rifPrefixText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  rifPrefixTextActive: {
    color: colors.primaryDark,
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    gap: 8,
  },
  actionButtonText: {
    marginLeft: 6,
  },

  // Cards de facturas
  invoiceCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    ...cardShadow,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  invoiceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  invoiceSubtitle: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  invoiceCaption: {
    color: colors.textSecondary,
    marginTop: 2,
    fontSize: 12,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  text: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  amount: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 18,
    marginTop: 2,
  },
  value: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  metaText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  invoiceActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  ghostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghostButtonText: {
    color: colors.primary,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 12,
  },
  infoLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  infoValue: {
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },

  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: 24,
  },

  // Modales
  modalContainer: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 16,
  },
  modalCardWide: {
    width: '90%',
    maxWidth: 960,
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    ...modalShadow,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: colors.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  orderItem: {
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  orderItemSelected: {
    borderColor: colors.primary,
    backgroundColor: '#E0F2FE',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  anularCard: {
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 10,
    width: '100%',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.textInverse,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: colors.borderDark,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
});

export default InvoicesAdminScreen;
