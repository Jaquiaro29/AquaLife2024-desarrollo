import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ViewStyle,
  Linking,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../firebaseConfig';
import { formatCurrency } from '../utils/currency';
import { colors, globalStyles } from '../styles/globalStyles';
import Toast from 'react-native-toast-message';

type Factura = {
  id: string;
  numero?: number;
  clienteId?: string;
  clienteNombre?: string;
  clienteDireccion?: string;
  clienteTelefono?: string;
  clienteEmail?: string;
  subtotal?: number;
  impuestos?: number;
  total?: number;
  ivaPercent?: number;
  estado?: 'activa' | 'anulada' | 'pagada' | 'pendiente';
  fechaEmision?: any;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
  externa?: boolean;
};

const estadoOptions = [
  { value: '', label: 'Todas' },
  { value: 'activa', label: 'Activas' },
  { value: 'pagada', label: 'Pagadas' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'anulada', label: 'Anuladas' },
  { value: 'externa', label: 'Externas' },
];

const InvoicesScreen = () => {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [clienteFiltro, setClienteFiltro] = useState('');
  const [numeroFiltro, setNumeroFiltro] = useState('');
  const [modalDetalle, setModalDetalle] = useState(false);
  const [detalleFactura, setDetalleFactura] = useState<Factura | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'Facturas'), orderBy('fechaEmision', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setFacturas(data);
      setLoading(false);
    }, (err) => {
      console.error('Error cargando facturas:', err);
      setLoading(false);
      Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudieron cargar tus facturas.' });
    });
    return () => unsub();
  }, []);

  const filteredFacturas = useMemo(() => {
    return facturas.filter((f) => {
      const matchEstado = estadoFiltro === 'externa' ? !!f.externa : (estadoFiltro ? f.estado === estadoFiltro : true);
      const matchCliente = clienteFiltro ? String(f.clienteId || '').toLowerCase().includes(clienteFiltro.toLowerCase()) : true;
      const matchNumero = numeroFiltro ? String(f.numero || '').includes(numeroFiltro) : true;
      return matchEstado && matchCliente && matchNumero;
    });
  }, [facturas, estadoFiltro, clienteFiltro, numeroFiltro]);

  const handleDetalle = (f: Factura) => {
    setDetalleFactura(f);
    setModalDetalle(true);
  };

  const descargarFactura = async (url?: string | null, nombre?: string | number) => {
    if (!url) {
      Toast.show({ type: 'error', text1: 'No disponible', text2: 'Aún no hay PDF para descargar.' });
      return;
    }
    try {
      const fileName = `factura_${nombre || Date.now()}.pdf`;
      const dest = `${FileSystem.documentDirectory}${fileName}`;
      const { status } = await FileSystem.downloadAsync(url, dest);
      if (status === 200) {
        Toast.show({ type: 'success', text1: 'Descargado', text2: `Guardado en Documentos: ${fileName}` });
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo descargar la factura.' });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Fallo al descargar la factura.' });
    }
  };

  const resumen = useMemo(() => {
    const total = facturas.length;
    const pagadas = facturas.filter((f) => f.estado === 'pagada').length;
    const pendientes = facturas.filter((f) => f.estado === 'pendiente' || f.estado === 'activa').length;
    const anuladas = facturas.filter((f) => f.estado === 'anulada').length;
    const montoPendiente = facturas
      .filter((f) => f.estado === 'pendiente' || f.estado === 'activa')
      .reduce((acc, f) => acc + (f.total || 0), 0);
    const montoPagado = facturas
      .filter((f) => f.estado === 'pagada')
      .reduce((acc, f) => acc + (f.total || 0), 0);
    return { total, pagadas, pendientes, anuladas, montoPendiente, montoPagado };
  }, [facturas]);

  const renderInvoice = ({ item }: { item: Factura }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Factura #{item.numero || item.id}</Text>
            <Text style={styles.cardSubtitle}>{item.clienteNombre || 'Cliente'}</Text>
            <Text style={styles.cardCaption}>ID: {item.clienteId || 'N/D'}</Text>
          </View>
          <View style={[styles.badge, badgeStyle(item.estado)]}>
            <Text style={[styles.badgeText, badgeTextStyle(item.estado)]}>{item.estado || 'sin-estado'}</Text>
          </View>
        </View>

        <View style={styles.cardRow}>
          <View>
            <Text style={styles.label}>Total</Text>
            <Text style={styles.value}>{formatCurrency(item.total || 0)}</Text>
          </View>
          <View>
            <Text style={styles.label}>Emisión</Text>
            <Text style={styles.text}>{formatDate(item.fechaEmision)}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          {item.externa ? (
            <View style={styles.metaPill}>
              <Ionicons name="earth-outline" size={16} color={colors.secondaryDark} />
              <Text style={styles.metaText}>Factura externa</Text>
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

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.ghostButton} onPress={() => handleDetalle(item)}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.ghostText}>Ver detalle</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ghostButton}
            onPress={() => descargarFactura(item.pdfUrl || undefined, item.numero || item.id)}
          >
            <Ionicons name="download-outline" size={18} color={colors.primary} />
            <Text style={styles.ghostText}>Descargar factura</Text>
          </TouchableOpacity>

          {item.xmlUrl ? (
            <TouchableOpacity
              style={styles.ghostButton}
              onPress={() => Linking.openURL(String(item.xmlUrl)).catch(() => {})}
            >
              <Ionicons name="code-slash-outline" size={18} color={colors.primary} />
              <Text style={styles.ghostText}>Ver XML</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={colors.gradientPrimary} style={styles.hero}>
        <View style={styles.heroHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroKicker}>Tus comprobantes</Text>
            <Text style={styles.heroTitle}>Facturación</Text>
            <Text style={styles.heroSubtitle}>Consulta tus facturas, descárgalas y revisa tus saldos.</Text>
          </View>
          <View style={styles.heroBadge}>
            <Ionicons name="document-text-outline" size={22} color={colors.textInverse} />
            <Text style={styles.heroBadgeText}>{resumen.total} en total</Text>
          </View>
        </View>

        <View style={styles.heroStats}>
          <StatBox label="Pendiente" value={formatCurrency(resumen.montoPendiente)} icon="alert-circle-outline" bg={colors.primaryShades[100]} />
          <StatBox label="Pagado" value={formatCurrency(resumen.montoPagado)} icon="checkmark-done-outline" bg={colors.gradientSecondary[0]} inverse />
          <StatBox label="Pagadas" value={String(resumen.pagadas)} icon="wallet-outline" bg={colors.grayShades[100]} />
          <StatBox label="Anuladas" value={String(resumen.anuladas)} icon="close-circle-outline" bg={colors.grayShades[200]} />
        </View>
      </LinearGradient>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Filtrar</Text>
        <View style={styles.chipsRow}>
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
        </View>

        <View style={styles.filtersRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Cédula / RIF</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: V12345678"
              value={clienteFiltro}
              onChangeText={setClienteFiltro}
              autoCapitalize="characters"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Número de factura</Text>
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
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={filteredFacturas}
          keyExtractor={(item) => item.id}
          renderItem={renderInvoice}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No hay facturas para mostrar.</Text>}
        />
      )}

      {/* Modal Detalle */}
      {modalDetalle && detalleFactura ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.28)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
          }}
        >
          <View style={[styles.detailCard, Platform.OS === 'web' ? { boxShadow: '0 10px 24px rgba(0,0,0,0.18)' } : {}]}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Detalle de la factura</Text>
              <TouchableOpacity onPress={() => { setModalDetalle(false); setDetalleFactura(null); }}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Factura</Text>
              <Text style={styles.detailRow}>Número: <Text style={styles.detailValue}>{detalleFactura.numero || detalleFactura.id}</Text></Text>
              <Text style={styles.detailRow}>Fecha de emisión: <Text style={styles.detailValue}>{formatDate(detalleFactura.fechaEmision)}</Text></Text>
              <Text style={styles.detailRow}>Estado: <Text style={styles.detailValue}>{detalleFactura.estado || 'sin-estado'}</Text></Text>
              {typeof detalleFactura.ivaPercent === 'number' ? (
                <Text style={styles.detailRow}>IVA: <Text style={styles.detailValue}>{detalleFactura.ivaPercent}%</Text></Text>
              ) : null}
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Cliente</Text>
              <Text style={styles.detailRow}>Nombre: <Text style={styles.detailValue}>{detalleFactura.clienteNombre || 'N/D'}</Text></Text>
              <Text style={styles.detailRow}>ID: <Text style={styles.detailValue}>{detalleFactura.clienteId || 'N/D'}</Text></Text>
              {detalleFactura.clienteDireccion ? (
                <Text style={styles.detailRow}>Dirección: <Text style={styles.detailValue}>{detalleFactura.clienteDireccion}</Text></Text>
              ) : null}
              {(detalleFactura.clienteTelefono || detalleFactura.clienteEmail) ? (
                <Text style={styles.detailRow}>Contacto: <Text style={styles.detailValue}>{detalleFactura.clienteTelefono || detalleFactura.clienteEmail}</Text></Text>
              ) : null}
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Totales</Text>
              <Text style={styles.detailRow}>Subtotal: <Text style={styles.detailValue}>{formatCurrency(detalleFactura.subtotal || 0)}</Text></Text>
              <Text style={styles.detailRow}>Impuestos: <Text style={styles.detailValue}>{formatCurrency(detalleFactura.impuestos || 0)}</Text></Text>
              <Text style={styles.detailRow}>Total: <Text style={styles.detailValue}>{formatCurrency(detalleFactura.total || 0)}</Text></Text>
            </View>
          </View>
        </View>
      ) : null}

      <Toast />
    </View>
  );
};

export default InvoicesScreen;

const StatBox = ({ label, value, icon, bg, inverse }: { label: string; value: string; icon: any; bg: string; inverse?: boolean }) => (
  <View style={[styles.statBox, { backgroundColor: bg }]}> 
    <Ionicons name={icon} size={18} color={inverse ? colors.textInverse : colors.primaryDark} />
    <Text style={[styles.statLabel, inverse && { color: colors.textInverse }]}>{label}</Text>
    <Text style={[styles.statValue, inverse && { color: colors.textInverse }]}>{value}</Text>
  </View>
);

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
      return { backgroundColor: '#DCFCE7' };
    case 'anulada':
      return { backgroundColor: '#FEE2E2' };
    case 'pendiente':
      return { backgroundColor: '#FEF9C3' };
    default:
      return { backgroundColor: '#E0F2FE' };
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  hero: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroKicker: {
    color: colors.textInverse,
    fontSize: 12,
    opacity: 0.8,
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
    marginTop: 4,
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
    gap: 10,
    marginTop: 14,
  },
  statBox: {
    flexGrow: 1,
    minWidth: 140,
    padding: 12,
    borderRadius: 12,
    ...(Platform.OS === 'web' ? { boxShadow: '0 4px 12px rgba(0,0,0,0.12)' } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3 }),
  },
  statLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    marginTop: 6,
  },
  statValue: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 18,
    marginTop: 2,
  },
  panel: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 14,
    ...cardShadow,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  },
  inputGroup: {
    flex: 1,
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
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.card,
    ...cardShadow,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardSubtitle: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardCaption: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  text: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  value: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 18,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
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
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
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
  ghostText: {
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
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: 16,
  },
  detailCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  detailSection: {
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 8,
  },
  detailSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  detailRow: {
    color: colors.textSecondary,
    marginBottom: 4,
  },
  detailValue: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
