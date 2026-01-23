import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Linking, TextInput, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { collection, onSnapshot, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getDownloadURL, getStorage, ref } from 'firebase/storage';
import Toast from 'react-native-toast-message';
import { db } from '../../firebaseConfig';
import { colors } from '../styles/globalStyles';
import { formatCurrency } from '../utils/currency';
import { buildInvoiceHtml, generateInvoicePdf } from '../utils/invoicePdf';

// Tipos
 type Factura = {
  id: string;
  numero?: number;
  clienteId?: string;
  clienteNombre?: string;
  clienteDireccion?: string;
  clienteTelefono?: string;
  clienteEmail?: string;
  pedidoId?: string;
  estado?: string;
  subtotal?: number;
  impuestos?: number;
  total?: number;
  ivaPercent?: number;
  notas?: string;
  externa?: boolean;
  fechaEmision?: any;
  pdfUrl?: string | null;
  cancelPdfUrl?: string | null;
};

const UserInvoicesScreen = () => {
  const auth = getAuth();
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const [estadoFiltro, setEstadoFiltro] = useState('');

  const [modalDetalle, setModalDetalle] = useState(false);
  const [detalleFactura, setDetalleFactura] = useState<any | null>(null);
  const [detalleItems, setDetalleItems] = useState<any[]>([]);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [clienteInfo, setClienteInfo] = useState<any | null>(null);

  // Cargar ID de cliente del usuario actual
  useEffect(() => {
    const loadCliente = async () => {
      try {
        const u = auth.currentUser;
        if (!u || !u.email) {
          setClienteId(null);
          setLoading(false);
          return;
        }
        const clientesQuery = query(collection(db, 'Clientes'), where('email', '==', u.email));
        const snap = await getDocs(clientesQuery);
        if (!snap.empty) {
          const cid = snap.docs[0].id;
          setClienteId(cid);
          try {
            const cdoc = await getDoc(doc(db, 'Clientes', cid));
            setClienteInfo(cdoc.exists() ? cdoc.data() : null);
          } catch (e) {
            setClienteInfo(null);
          }
        } else {
          setClienteId(null);
        }
      } catch (err) {
        console.error('Error obteniendo cliente:', err);
        setClienteId(null);
      }
    };
    loadCliente();
  }, []);

  // Escucha de facturas del cliente
  useEffect(() => {
    if (!clienteId) return;
    setLoading(true);

    const handleSnapshot = (snap: any) => {
      const data = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));
      // Ordenar localmente si usamos la consulta sin orderBy
      const sorted = data.sort((a: any, b: any) => {
        const da = a.fechaEmision?.toDate ? a.fechaEmision.toDate() : new Date(a.fechaEmision || 0);
        const dbb = b.fechaEmision?.toDate ? b.fechaEmision.toDate() : new Date(b.fechaEmision || 0);
        return dbb.getTime() - da.getTime();
      });
      setFacturas(sorted);
      setLoading(false);
    };

    const q = query(
      collection(db, 'Facturas'),
      where('clienteId', '==', clienteId),
      orderBy('fechaEmision', 'desc')
    );

    let cleanup: (() => void) | undefined;

    const unsub = onSnapshot(
      q,
      handleSnapshot,
      (err) => {
        // Si falta índice, hacemos fallback sin orderBy y avisamos.
        const code = (err as any)?.code;
        const msg = String((err as any)?.message || '');
        if (code === 'failed-precondition' || msg.includes('requires an index')) {
          const fallback = query(collection(db, 'Facturas'), where('clienteId', '==', clienteId));
          cleanup = onSnapshot(fallback, handleSnapshot, () => setLoading(false));
          Toast.show({ type: 'info', text1: 'Índice requerido', text2: 'Se usa orden local hasta crear el índice en Firestore.' });
        } else {
          console.error('Error cargando facturas:', err);
          Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudieron cargar tus facturas.' });
          setLoading(false);
        }
      }
    );

    return () => {
      unsub();
      if (cleanup) cleanup();
    };
  }, [clienteId]);

  const showToast = (type: 'success' | 'error', message: string) => {
    Toast.show({ type, text1: type === 'success' ? 'Listo' : 'Error', text2: message, position: 'top' });
  };

  const normalizePdfUrl = (raw?: string | null) => {
    if (!raw) return null;
    const url = String(raw);
    if (url.startsWith('gs://')) {
      const without = url.replace('gs://', '');
      const [bucket, ...rest] = without.split('/');
      const path = rest.join('/');
      if (!bucket || !path) return null;
      return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
    }
    return url;
  };

  // Resuelve la URL real del PDF desde Storage (gs://, rutas relativas o http directo)
  const resolvePdfUrl = async (raw?: string | null) => {
    if (!raw) return null;
    const asString = String(raw);
    if (/^https?:\/\//i.test(asString)) return asString;
    try {
      const storage = getStorage();
      const r = ref(storage, asString);
      const downloadUrl = await getDownloadURL(r);
      return downloadUrl;
    } catch (err: any) {
      console.error('No se pudo resolver la URL desde Storage, se usa fallback:', err);
      Toast.show({ type: 'error', text1: 'PDF no accesible', text2: err?.message || 'No se pudo obtener el archivo.' });
      return normalizePdfUrl(raw);
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

  const abrirUrl = async (url?: string | null) => {
    const resolved = await resolvePdfUrl(url);
    if (!resolved) {
      showToast('error', 'No hay documento disponible.');
      return;
    }
    try {
      await Linking.openURL(resolved);
    } catch (err) {
      console.error('No se pudo abrir la URL:', err);
      showToast('error', 'No se pudo abrir el documento.');
    }
  };

  const filteredFacturas = useMemo(() => {
    return facturas.filter((f) => {
      const matchEstado = estadoFiltro ? f.estado === estadoFiltro : true;
      return matchEstado;
    });
  }, [facturas, estadoFiltro]);

  const generatePdfOnTheFly = async (factura: Factura) => {
    try {
      const empresaSnap = await getDoc(doc(db, 'config', 'empresa'));
      const empresa = empresaSnap.exists() ? empresaSnap.data() : {};
      const itemsSnap = await getDocs(collection(db, 'Facturas', factura.id, 'detalle'));
      const items = itemsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      if (!items.length) {
        showToast('error', 'La factura no tiene ítems para generar PDF.');
        return;
      }

      const html = buildInvoiceHtml({
        empresa: {
          nombre: empresa?.nombre || 'AquaLife',
          rif: empresa?.rif || 'J-00000000-0',
          direccion: empresa?.direccion || 'Domicilio fiscal',
          telefono: empresa?.telefono || '',
          logoUrl: empresa?.logoDataUrl || empresa?.logoUrl || undefined,
        },
        factura: {
          numero: factura.numero || factura.id,
          fechaEmision: factura.fechaEmision,
          clienteId: factura.clienteId,
          ivaPercent: factura.ivaPercent || 16,
          subtotal: factura.subtotal,
          impuestos: factura.impuestos,
          total: factura.total,
          estado: factura.estado,
          notas: factura.notas,
          externa: factura.externa,
        } as any,
        cliente: {
          nombre: clienteInfo?.nombre || factura.clienteNombre,
          direccion: clienteInfo?.direccion || factura.clienteDireccion,
          telefono: clienteInfo?.telefono || factura.clienteTelefono,
          email: clienteInfo?.email || factura.clienteEmail,
          cedula: clienteInfo?.cedula || factura.clienteId,
        },
        items,
      });

      if (Platform.OS === 'web') {
        // Genera y descarga directo en el navegador (sin subir a Storage)
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod: any = require('html2pdf.js');
        const html2pdf = mod?.default || mod;
        await html2pdf()
          .from(html)
          .set({
            margin: 10,
            filename: `factura_${factura.numero || factura.id}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          })
          .save();
        showToast('success', 'PDF generado. Revisa tus descargas.');
        return;
      }

      const filePath = await generateInvoicePdf(html, `factura_${factura.numero || factura.id}`);
      await Linking.openURL(filePath).catch(() => {});
      showToast('success', 'PDF generado localmente.');
    } catch (err) {
      console.error('No se pudo generar PDF on-demand:', err);
      showToast('error', 'No se pudo generar el PDF.');
    }
  };

  const descargarPdf = async (factura: Factura) => {
    const resolved = await resolvePdfUrl(factura.pdfUrl);
    console.log('descargarPdf -> resolved URL', resolved, 'raw', factura.pdfUrl);
    if (!resolved) {
      // Si no hay PDF guardado, intentamos generarlo y descargarlo on-the-fly
      await generatePdfOnTheFly(factura);
      return;
    }
    if (Platform.OS === 'web') {
      try {
        const win = window.open(resolved, '_blank');
        if (win === null) {
          // Algunos navegadores bloquean window.open; fallback a anchor con download.
          const fileName = `factura_${factura.numero || factura.id || Date.now()}.pdf`;
          const anchor = document.createElement('a');
          anchor.href = resolved;
          anchor.download = fileName;
          anchor.target = '_blank';
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
        }
        showToast('success', 'Factura abierta/descargada.');
      } catch (err) {
        console.error('No se pudo abrir/descargar el PDF en web:', err);
        try {
          await Linking.openURL(resolved);
          showToast('success', 'Factura abierta en una pestaña.');
        } catch (e) {
          showToast('error', 'No se pudo descargar el PDF.');
        }
      }
      return;
    }
    try {
      const fileName = `factura_${factura.numero || factura.id || Date.now()}.pdf`;
      const dest = `${FileSystem.documentDirectory}${fileName}`;
      const { status } = await FileSystem.downloadAsync(resolved, dest);
      if (status === 200) {
        showToast('success', `PDF guardado en documentos: ${fileName}`);
      } else {
        showToast('error', 'No se pudo descargar el PDF.');
      }
    } catch (err) {
      console.error('Error descargando PDF:', err);
      // Fallback: intenta abrir el enlace directo.
      try {
        await Linking.openURL(resolved);
        showToast('success', 'Factura abierta en el navegador.');
      } catch (e) {
        showToast('error', 'Error al descargar/abrir el PDF.');
      }
    }
  };

  const renderItem = ({ item }: { item: Factura }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.title}>Factura #{item.numero || item.id}</Text>
        <Text style={[styles.badge, badgeStyle(item.estado)]}>{item.estado || 'sin-estado'}</Text>
      </View>
      <Text style={styles.text}>Total: {formatCurrency(item.total || 0)}</Text>
      <Text style={styles.text}>Emisión: {formatDate(item.fechaEmision)}</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.linkButton} onPress={() => handleDetalle(item)}>
          <Text style={styles.linkText}>Ver detalle</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton} onPress={() => descargarPdf(item)}>
          <Text style={styles.linkText}>Descargar factura</Text>
        </TouchableOpacity>
        {item.cancelPdfUrl ? (
          <TouchableOpacity style={styles.linkButton} onPress={() => abrirUrl(item.cancelPdfUrl || undefined)}>
            <Text style={styles.linkText}>Comprobante de anulación</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Mis Facturas</Text>
      <View style={styles.filtersRow}>
        <TextInput
          style={styles.input}
          placeholder="Estado (activa/pagada/pendiente/anulada)"
          value={estadoFiltro}
          onChangeText={setEstadoFiltro}
        />
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} size="large" />
      ) : (
        <FlatList
          data={filteredFacturas}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 12 }}
          ListEmptyComponent={<Text style={styles.text}>No tienes facturas aún.</Text>}
        />
      )}

      {/* Modal detalle (alineado a Admin) */}
      <Modal visible={modalDetalle} animationType="fade" transparent onRequestClose={() => setModalDetalle(false)}>
        <View style={styles.overlay}>
          <View style={[styles.modalCardWide, Platform.OS === 'web' ? { boxShadow: '0 12px 30px rgba(0,0,0,0.18)' } : {}]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={styles.modalTitle}>Detalle factura {detalleFactura?.numero || detalleFactura?.id}</Text>
              <View style={{ width: 48 }} />
            </View>
            {detalleFactura?.estado ? (
              <View style={[styles.badge, badgeStyle(detalleFactura?.estado)]}>
                <Text style={[styles.badgeText, badgeTextStyle(detalleFactura?.estado)]}>{String(detalleFactura?.estado).toUpperCase()}</Text>
              </View>
            ) : null}

            {detalleLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
            ) : (
              <ScrollView
                style={{ flexGrow: 0, maxHeight: '92%', marginTop: 10 }}
                contentContainerStyle={{ paddingBottom: 12 }}
              >
                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>Cliente</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Nombre</Text>
                    <Text style={styles.infoValue}>{clienteInfo?.nombre || detalleFactura?.clienteNombre || 'N/D'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Cédula</Text>
                    <Text style={styles.infoValue}>{clienteInfo?.cedula || clienteId || detalleFactura?.clienteId || 'N/D'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Dirección</Text>
                    <Text style={styles.infoValue}>{clienteInfo?.direccion || detalleFactura?.clienteDireccion || 'N/D'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Contacto</Text>
                    <Text style={styles.infoValue}>{clienteInfo?.telefono || clienteInfo?.email || 'N/D'}</Text>
                  </View>
                  {clienteInfo?.email ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Correo</Text>
                      <Text style={styles.infoValue}>{clienteInfo?.email}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={[styles.infoCard, { marginTop: 10 }]}>
                  <Text style={styles.infoTitle}>Factura</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Número</Text>
                    <Text style={styles.infoValue}>{detalleFactura?.numero || detalleFactura?.id}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Fecha</Text>
                    <Text style={styles.infoValue}>{formatDate(detalleFactura?.fechaEmision)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Estado</Text>
                    <Text style={styles.infoValue}>{detalleFactura?.estado || 'N/D'}</Text>
                  </View>
                </View>

                <Text style={[styles.infoTitle, { marginTop: 12, marginBottom: 6 }]}>Ítems</Text>
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
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setModalDetalle(false)}>
                <Text style={styles.secondaryButtonText}>Cerrar</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 16,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    color: colors.textPrimary,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.textPrimary,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  text: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
    flexWrap: 'wrap',
  },
  linkButton: {
    paddingVertical: 6,
  },
  linkText: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCardWide: {
    width: '100%',
    maxWidth: 640,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    maxHeight: '92%',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  secondaryButton: {
    backgroundColor: colors.borderDark,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  orderItem: {
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  infoCard: {
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.background,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  infoLabel: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  infoValue: {
    color: colors.textPrimary,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
});

export default UserInvoicesScreen;
