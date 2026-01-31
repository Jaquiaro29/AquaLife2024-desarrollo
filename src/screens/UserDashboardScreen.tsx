import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { collection, doc, onSnapshot, query, updateDoc, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { colors, globalStyles } from '../styles/globalStyles';
import { VE_BANKS } from '../utils/veBanks';
import { formatCurrency } from '../utils/currency';

interface Pedido {
  id: string;
  clienteId: string;
  fecha: string;
  hora: string;
  cantidadConAsa: number;
  cantidadSinAsa: number;
  costoUnitario: number;
  total: number;
  estado: string;
  empleadoAsignadoId: string;
  observaciones?: string;
  numeroPedido?: number;
  refPagoUlt6?: string;
  bancoEmisor?: string;
  estadoFinanciero?: string;
  montoPagado?: number;
}

type FilterType = 'todos' | 'pendientes' | 'historial';
type SortType = 'fecha' | 'total' | 'cantidad';

const PedidosScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('todos');
  const [sortBy, setSortBy] = useState<SortType>('fecha');
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [paymentConfig, setPaymentConfig] = useState<any | null>(null);
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [refLast6, setRefLast6] = useState('');
  const [payerBank, setPayerBank] = useState('');
  const [isCustomBank, setIsCustomBank] = useState(false);
  const [customBank, setCustomBank] = useState('');
  const [payAmount, setPayAmount] = useState('');

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editWithHandle, setEditWithHandle] = useState(0);
  const [editWithoutHandle, setEditWithoutHandle] = useState(0);
  const [editComments, setEditComments] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ref = doc(db, 'configuracion', 'metodosPago');
    const unsub = onSnapshot(ref, (snap) => {
      setPaymentConfig(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, []);

  const configuredBanks = useMemo(() => {
    const banks: { label: string; code?: string; type: 'pagoMovil' | 'cuenta' }[] = [];
    if (paymentConfig?.pagoMovil?.banco) {
      banks.push({ label: paymentConfig.pagoMovil.banco, code: paymentConfig.pagoMovil.bancoCodigo, type: 'pagoMovil' });
    }
    if (paymentConfig?.cuenta?.banco) {
      banks.push({ label: paymentConfig.cuenta.banco, code: paymentConfig.cuenta.bancoCodigo, type: 'cuenta' });
    }
    return banks;
  }, [paymentConfig]);

  // Lista completa disponible en el selector (config + catálogo VE)
  const availableBanks = useMemo(() => {
    const map = new Map<string, { label: string; code?: string }>();
    // Catálogo general
    for (const b of VE_BANKS) {
      map.set(b.name, { label: b.name, code: b.code });
    }
    // Config propios (prioridad para sobreescribir código si difiere)
    for (const b of configuredBanks) {
      map.set(b.label, { label: b.label, code: b.code });
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [configuredBanks]);

  useEffect(() => {
    if (!payerBank && configuredBanks.length > 0) {
      setPayerBank(configuredBanks[0].label);
      setIsCustomBank(false);
    }
  }, [configuredBanks, payerBank]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const pedidosRef = collection(db, 'Pedidos');
    const q = query(pedidosRef, where('clienteId', '==', user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const pedidosData: Pedido[] = snapshot.docs.map((pedidoDoc) => ({
          id: pedidoDoc.id,
          ...(pedidoDoc.data() as Omit<Pedido, 'id'>),
        }));
        setPedidos(pedidosData);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error('Error al obtener pedidos del usuario:', error);
        Alert.alert('❌ Error', 'No se pudieron cargar los pedidos');
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const pedidosPendientes = pedidos.filter((p) => p.estado === 'pendiente' || p.estado === 'procesando');
  const pedidosHistorial = pedidos.filter((p) => p.estado === 'listo' || p.estado === 'entregado' || p.estado === 'completado');

  const parseFecha = (fechaStr: string) => {
    const [year, month, day] = fechaStr.split('-');
    return new Date(Number(year), Number(month) - 1, Number(day));
  };

  const sortPedidos = (pedidosArray: Pedido[]) => {
    return [...pedidosArray].sort((a, b) => {
      switch (sortBy) {
        case 'fecha': {
          const dateA = parseFecha(a.fecha).getTime();
          const dateB = parseFecha(b.fecha).getTime();
          return dateB - dateA;
        }
        case 'total':
          return b.total - a.total;
        case 'cantidad': {
          const totalA = a.cantidadConAsa + a.cantidadSinAsa;
          const totalB = b.cantidadConAsa + b.cantidadSinAsa;
          return totalB - totalA;
        }
        default:
          return 0;
      }
    });
  };

  const pedidosFiltrados = () => {
    switch (activeFilter) {
      case 'pendientes':
        return sortPedidos(pedidosPendientes);
      case 'historial':
        return sortPedidos(pedidosHistorial);
      default:
        return sortPedidos(pedidos);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
  };

  const getEstadoStyles = (estado: string) => {
    switch (estado.toLowerCase()) {
      case 'pendiente':
        return { backgroundStyle: globalStyles.badgeWarning, color: colors.warning, icon: '⏳' };
      case 'procesando':
        return { backgroundStyle: globalStyles.badgeInfo, color: colors.secondaryDark, icon: '🔄' };
      case 'listo':
        return { backgroundStyle: globalStyles.badgeSuccess, color: colors.success, icon: '✅' };
      case 'entregado':
      case 'completado':
        return { backgroundStyle: globalStyles.badgeInfo, color: colors.secondaryDark, icon: '🎉' };
      default:
        return { backgroundStyle: { backgroundColor: colors.grayShades[50] }, color: colors.textSecondary, icon: '📦' };
    }
  };

  const getFinStyles = (estadoFin?: string) => {
    switch ((estadoFin || 'por_cobrar').toLowerCase()) {
      case 'por_cobrar':
        return { label: 'Por pagar', backgroundStyle: globalStyles.badgeWarning, color: colors.warning, icon: '💵' };
      case 'por_confirmar_pago':
        return { label: 'Pago enviado', backgroundStyle: globalStyles.badgeInfo, color: colors.secondaryDark, icon: '⏳' };
      case 'cobrado':
        return { label: 'Pago confirmado', backgroundStyle: globalStyles.badgeSuccess, color: colors.success, icon: '✅' };
      default:
        return { label: 'Por pagar', backgroundStyle: { backgroundColor: colors.grayShades[50] }, color: colors.textSecondary, icon: '💵' };
    }
  };

  const formatFecha = (fechaStr: string) => {
    const date = parseFecha(fechaStr);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatHora = (horaStr: string) => horaStr.substring(0, 5);
  const getTotalBotellones = (pedido: Pedido) => pedido.cantidadConAsa + pedido.cantidadSinAsa;

  const handleCancelOrder = (pedido: Pedido) => {
    const orderLabel = pedido.numeroPedido
      ? `Nº ${String(pedido.numeroPedido).padStart(4, '0')}`
      : `ID ${pedido.id.substring(0, 8)}`;

    const confirmAndCancel = async () => {
      try {
        setSaving(true);
        await updateDoc(doc(db, 'Pedidos', pedido.id), {
          estado: 'cancelado',
          updatedAt: serverTimestamp(),
        });
        setModalVisible(false);
        setSelectedPedido(null);
        Alert.alert('Pedido cancelado', `El pedido ${orderLabel} ha sido cancelado.`);
      } catch (e) {
        console.error('Cancelar pedido', e);
        Alert.alert('Error', 'No se pudo cancelar el pedido');
      } finally {
        setSaving(false);
      }
    };

    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined' && window.confirm(`¿Deseas cancelar el pedido ${orderLabel}?`);
      if (ok) {
        confirmAndCancel();
      }
      return;
    }

    Alert.alert('Cancelar pedido', `¿Deseas cancelar el pedido ${orderLabel}?`, [
      { text: 'No', style: 'cancel' },
      { text: 'Sí, cancelar', style: 'destructive', onPress: confirmAndCancel },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.secondary} />
        <Text style={styles.loadingText}>Cargando tus pedidos...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.secondary]} />}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Panel Principal </Text>
          <Text style={styles.subtitle}>{pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''} en total</Text>
        </View>
        <View style={styles.statsContainer}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{pedidosPendientes.length}</Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{pedidosHistorial.length}</Text>
            <Text style={styles.statLabel}>Completados</Text>
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'todos' && styles.filterButtonActive]}
          onPress={() => setActiveFilter('todos')}
        >
          <Text style={[styles.filterButtonText, activeFilter === 'todos' && styles.filterButtonTextActive]}>📦 Todos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'pendientes' && styles.filterButtonActive]}
          onPress={() => setActiveFilter('pendientes')}
        >
          <Text style={[styles.filterButtonText, activeFilter === 'pendientes' && styles.filterButtonTextActive]}>⏳ Pendientes</Text>
          {pedidosPendientes.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pedidosPendientes.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'historial' && styles.filterButtonActive]}
          onPress={() => setActiveFilter('historial')}
        >
          <Text style={[styles.filterButtonText, activeFilter === 'historial' && styles.filterButtonTextActive]}>✅ Historial</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>por:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'fecha' && styles.sortButtonActive]}
            onPress={() => setSortBy('fecha')}
          >
            <Text style={[styles.sortButtonText, sortBy === 'fecha' && styles.sortButtonTextActive]}>📅 Fecha</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'total' && styles.sortButtonActive]}
            onPress={() => setSortBy('total')}
          >
            <Text style={[styles.sortButtonText, sortBy === 'total' && styles.sortButtonTextActive]}>💰 Total</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'cantidad' && styles.sortButtonActive]}
            onPress={() => setSortBy('cantidad')}
          >
            <Text style={[styles.sortButtonText, sortBy === 'cantidad' && styles.sortButtonTextActive]}>🫙 Cantidad</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={styles.pedidosList}>
        {pedidosFiltrados().length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📦</Text>
            <Text style={styles.emptyStateTitle}>
              {activeFilter === 'todos'
                ? 'No tienes pedidos'
                : activeFilter === 'pendientes'
                ? 'No hay pedidos pendientes'
                : 'No hay pedidos en el historial'}
            </Text>
            <Text style={styles.emptyStateText}>
              {activeFilter === 'pendientes' ? 'Todos tus pedidos están completados 🎉' : 'Cuando realices un pedido, aparecerá aquí'}
            </Text>
          </View>
        ) : (
          pedidosFiltrados().map((pedido) => {
            const estadoStyles = getEstadoStyles(pedido.estado);
            const totalBotellones = getTotalBotellones(pedido);

            return (
              <TouchableOpacity
                key={pedido.id}
                style={styles.pedidoCard}
                onPress={() => {
                  setSelectedPedido(pedido);
                  setModalVisible(true);
                }}
              >
                <View style={styles.pedidoHeader}>
                  <View style={styles.pedidoInfo}>
                    <Text style={styles.pedidoNumber}>Pedido #{pedido.numeroPedido || pedido.id.substring(0, 8)}</Text>
                    <Text style={styles.pedidoDate}>
                      {formatFecha(pedido.fecha)} • {formatHora(pedido.hora)}
                    </Text>
                  </View>
                  <View style={[styles.estadoBadge, estadoStyles.backgroundStyle]}>
                    <Text style={[styles.estadoText, { color: estadoStyles.color }]}>
                      {estadoStyles.icon} {pedido.estado}
                    </Text>
                  </View>
                </View>

                <View style={styles.pedidoDetails}>
                  <View style={styles.detailRow}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>🫙 Con asa</Text>
                      <Text style={styles.detailValue}>{pedido.cantidadConAsa}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>💧 Sin asa</Text>
                      <Text style={styles.detailValue}>{pedido.cantidadSinAsa}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>📊 Total</Text>
                      <Text style={styles.detailValue}>{totalBotellones}</Text>
                    </View>
                  </View>

                  <View style={styles.pedidoFooter}>
                    <Text style={styles.totalText}>{formatCurrency(pedido.total)}</Text>
                    <View style={styles.arrowContainer}>
                      <Text style={styles.arrow}>›</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={styles.bottomSpacing} />

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedPedido && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    Pedido #{selectedPedido.numeroPedido || selectedPedido.id.substring(0, 8)}
                  </Text>
                  <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody}>
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Estado del Pedido</Text>
                    {(() => {
                      const estadoStyles = getEstadoStyles(selectedPedido.estado);
                      return (
                        <View style={[styles.estadoModalBadge, estadoStyles.backgroundStyle]}>
                          <Text style={[styles.estadoModalText, { color: estadoStyles.color }]}>
                            {estadoStyles.icon} {selectedPedido.estado.toUpperCase()}
                          </Text>
                        </View>
                      );
                    })()}
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Fecha y Hora</Text>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>📅 Fecha:</Text>
                      <Text style={styles.modalValue}>{formatFecha(selectedPedido.fecha)}</Text>
                    </View>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>🕒 Hora:</Text>
                      <Text style={styles.modalValue}>{formatHora(selectedPedido.hora)}</Text>
                    </View>
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Detalles del Pedido</Text>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>🫙 Con asa:</Text>
                      <Text style={styles.modalValue}>{selectedPedido.cantidadConAsa}</Text>
                    </View>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>💧 Sin asa:</Text>
                      <Text style={styles.modalValue}>{selectedPedido.cantidadSinAsa}</Text>
                    </View>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>📊 Total botellones:</Text>
                      <Text style={styles.modalValue}>{getTotalBotellones(selectedPedido)}</Text>
                    </View>
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Información de Pago</Text>
                    {(() => {
                      const fin = getFinStyles(selectedPedido.estadoFinanciero);
                      return (
                        <View style={[styles.estadoModalBadge, fin.backgroundStyle]}>
                          <Text style={[styles.estadoModalText, { color: fin.color }]}> {fin.icon} {fin.label} </Text>
                        </View>
                      );
                    })()}
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>💰 Costo unitario:</Text>
                      <Text style={styles.modalValue}>{formatCurrency(selectedPedido.costoUnitario)}</Text>
                    </View>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>💵 Total:</Text>
                      <Text style={styles.modalTotal}>{formatCurrency(selectedPedido.total)}</Text>
                    </View>
                    {selectedPedido.refPagoUlt6 ? (
                      <View style={styles.modalRow}>
                        <Text style={styles.modalLabel}>🔢 Ref. pago (últimos 6):</Text>
                        <Text style={styles.modalValue}>{selectedPedido.refPagoUlt6}</Text>
                      </View>
                    ) : null}
                    {selectedPedido.bancoEmisor ? (
                      <View style={styles.modalRow}>
                        <Text style={styles.modalLabel}>🏦 Banco emisor:</Text>
                        <Text style={styles.modalValue}>{selectedPedido.bancoEmisor}</Text>
                      </View>
                    ) : null}
                  </View>

                  {selectedPedido.observaciones ? (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Observaciones</Text>
                      <Text style={styles.observacionesText}>{selectedPedido.observaciones}</Text>
                    </View>
                  ) : null}
                </ScrollView>

                <View style={styles.actionBar}>
                  {(() => {
                    const isFinal = ['listo', 'entregado', 'completado'].includes(selectedPedido.estado);
                    const canEdit =
                      !isFinal &&
                      selectedPedido.estado !== 'cancelado' &&
                      selectedPedido.estadoFinanciero !== 'por_confirmar_pago' &&
                      selectedPedido.estadoFinanciero !== 'cobrado';
                    const isPaid =
                      selectedPedido.estadoFinanciero === 'cobrado' ||
                      selectedPedido.estadoFinanciero === 'por_confirmar_pago';
                    const canPay = !isPaid && selectedPedido.estado !== 'cancelado';
                    const canCancel = !isFinal && selectedPedido.estado !== 'cancelado';
                    return (
                      <>
                        {canEdit && (
                          <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: colors.secondary }]}
                            onPress={() => {
                              setEditWithHandle(selectedPedido.cantidadConAsa);
                              setEditWithoutHandle(selectedPedido.cantidadSinAsa);
                              setEditComments(selectedPedido.observaciones || '');
                              setEditModalVisible(true);
                            }}
                          >
                            <Text style={styles.actionButtonText}>Editar pedido</Text>
                          </TouchableOpacity>
                        )}
                        {canPay && (
                          <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: colors.primary }]}
                            onPress={() => {
                              const fallbackBank = configuredBanks[0]?.label || '';
                              setRefLast6('');
                              const prevBank = selectedPedido.bancoEmisor || fallbackBank;
                              const isKnown = configuredBanks.some((b) => b.label === prevBank);
                              setIsCustomBank(!isKnown);
                              setCustomBank(!isKnown ? prevBank : '');
                              setPayerBank(prevBank);
                              setPayAmount('');
                              setPayModalVisible(true);
                            }}
                          >
                            <Text style={styles.actionButtonText}>Pagar</Text>
                          </TouchableOpacity>
                        )}
                        {!canPay && selectedPedido.estadoFinanciero === 'por_confirmar_pago' && (
                          <View style={[styles.actionButton, { backgroundColor: colors.grayShades[100] }]}> 
                            <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>Esperando confirmación</Text>
                          </View>
                        )}
                        {canCancel && (
                          <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: colors.error }]}
                            onPress={() => handleCancelOrder(selectedPedido)}
                          >
                            <Text style={styles.actionButtonText}>Cancelar pedido</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    );
                  })()}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={editModalVisible} animationType="slide" transparent onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar pedido</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>🫙 Con asa</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={String(editWithHandle)}
                  onChangeText={(t) => setEditWithHandle(Number(t.replace(/\D/g, '') || 0))}
                />
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>💧 Sin asa</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={String(editWithoutHandle)}
                  onChangeText={(t) => setEditWithoutHandle(Number(t.replace(/\D/g, '') || 0))}
                />
              </View>
              <View style={{ marginTop: 10 }}>
                <Text style={styles.modalLabel}>Observaciones</Text>
                <TextInput style={styles.input} value={editComments} onChangeText={setEditComments} />
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalButtonCancel} onPress={() => setEditModalVisible(false)}>
                  <Text style={styles.modalButtonTextCancel}>Volver</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalButtonConfirm}
                  disabled={!selectedPedido || saving}
                  onPress={async () => {
                    if (!selectedPedido) return;
                    try {
                      setSaving(true);
                      const total = (editWithHandle + editWithoutHandle) * selectedPedido.costoUnitario;
                      const payload: Record<string, any> = {
                        cantidadConAsa: editWithHandle,
                        cantidadSinAsa: editWithoutHandle,
                        observaciones: editComments,
                        total,
                        updatedAt: serverTimestamp(),
                      };
                      await updateDoc(doc(db, 'Pedidos', selectedPedido.id), payload);
                      setEditModalVisible(false);
                    } catch (e) {
                      console.error('Editar pedido', e);
                      Alert.alert('Error', 'No se pudo actualizar el pedido');
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  <Text style={styles.modalButtonTextConfirm}>{saving ? 'Guardando...' : 'Guardar cambios'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={payModalVisible} animationType="slide" transparent onRequestClose={() => setPayModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirmación de Pago</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setPayModalVisible(false)}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
              {paymentConfig ? (
                <View style={{ gap: 10 }}>
                  {paymentConfig.pagoMovil ? (
                    <TouchableOpacity
                      style={[styles.readonlyBox, payerBank === paymentConfig.pagoMovil.banco && styles.readonlyBoxActive]}
                      onPress={() => {
                        setIsCustomBank(false);
                        setCustomBank('');
                        setPayerBank(paymentConfig.pagoMovil.banco);
                      }}
                    >
                      <Text style={styles.readonlyTitle}>Pago Móvil</Text>
                      <Text style={styles.readonlyText}>
                        Banco: {paymentConfig.pagoMovil.banco} ({paymentConfig.pagoMovil.bancoCodigo})
                      </Text>
                      <Text style={styles.readonlyText}>Teléfono: {paymentConfig.pagoMovil.telefono}</Text>
                      <Text style={styles.readonlyText}>CI/RIF: {paymentConfig.pagoMovil.rif}</Text>
                      {paymentConfig.pagoMovil.qrUrl ? (
                        <Image source={{ uri: paymentConfig.pagoMovil.qrUrl }} style={styles.qrImage} resizeMode="contain" />
                      ) : null}
                    </TouchableOpacity>
                  ) : null}
                  {paymentConfig.cuenta ? (
                    <TouchableOpacity
                      style={[styles.readonlyBox, payerBank === paymentConfig.cuenta.banco && styles.readonlyBoxActive]}
                      onPress={() => {
                        setIsCustomBank(false);
                        setCustomBank('');
                        setPayerBank(paymentConfig.cuenta.banco);
                      }}
                    >
                      <Text style={styles.readonlyTitle}>Transferencia Bancaria</Text>
                      <Text style={styles.readonlyText}>
                        Banco: {paymentConfig.cuenta.banco} ({paymentConfig.cuenta.bancoCodigo})
                      </Text>
                      <Text style={styles.readonlyText}>Cuenta: {paymentConfig.cuenta.cuenta}</Text>
                      <Text style={styles.readonlyText}>CI/RIF: {paymentConfig.cuenta.rif}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                <Text style={{ marginBottom: 12, color: colors.textSecondary }}>Cargando métodos de pago...</Text>
              )}

              <View style={{ marginBottom: 16 }}>
                <Text style={styles.modalLabel}>Monto del pedido (referencia)</Text>
                <Text style={[styles.modalValue, { marginBottom: 8 }]}>{selectedPedido ? formatCurrency(selectedPedido.total) : '-'}</Text>
                <Text style={[styles.modalLabel, { marginTop: 6 }]}>Banco emisor</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={isCustomBank ? '__other__' : payerBank}
                    onValueChange={(val) => {
                      if (String(val) === '__other__') {
                        setIsCustomBank(true);
                        setPayerBank(customBank);
                      } else {
                        setIsCustomBank(false);
                        setCustomBank('');
                        setPayerBank(String(val));
                      }
                    }}
                    mode="dropdown"
                    dropdownIconColor={colors.textSecondary}
                    style={styles.picker}
                  >
                    {availableBanks.length === 0 && <Picker.Item label="Selecciona banco" value="" />}
                    {availableBanks.map((bank) => (
                      <Picker.Item
                        key={`${bank.label}-${bank.code ?? 'nc'}`}
                        label={`${bank.label}${bank.code ? ` (${bank.code})` : ''}`}
                        value={bank.label}
                      />
                    ))}
                    <Picker.Item label="Otro banco..." value="__other__" />
                  </Picker>
                </View>
                {isCustomBank && (
                  <TextInput
                    style={styles.input}
                    value={customBank}
                    onChangeText={(t) => {
                      setCustomBank(t);
                      setPayerBank(t);
                    }}
                    placeholder="Nombre del banco"
                  />
                )}

                <Text style={styles.modalLabel}>Últimos 6 dígitos de la referencia</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  maxLength={6}
                  value={refLast6}
                  onChangeText={(t) => setRefLast6(t.replace(/\D/g, ''))}
                />
                <Text style={[styles.modalLabel, { marginTop: 10 }]}>Monto pagado</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  value={payAmount}
                  onChangeText={(t) => setPayAmount(t.replace(/[^0-9.,]/g, '').replace(',', '.'))}
                  placeholder="Ej: 12.50"
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalButtonCancel} onPress={() => setPayModalVisible(false)}>
                  <Text style={styles.modalButtonTextCancel}>Volver</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalButtonConfirm}
                  disabled={!selectedPedido || refLast6.length !== 6 || payAmount.trim() === '' || Number.isNaN(parseFloat(payAmount)) || saving}
                  onPress={async () => {
                    if (!selectedPedido) return;
                    try {
                      setSaving(true);
                      const parsedAmount = parseFloat(payAmount);
                      const orderLabel = selectedPedido.numeroPedido
                        ? `Nº ${String(selectedPedido.numeroPedido).padStart(4, '0')}`
                        : `ID ${selectedPedido.id.substring(0, 8)}`;
                      await updateDoc(doc(db, 'Pedidos', selectedPedido.id), {
                        refPagoUlt6: refLast6.trim(),
                        bancoEmisor: payerBank.trim(),
                        montoPagado: Number.isNaN(parsedAmount) ? undefined : parsedAmount,
                        estadoFinanciero:
                          selectedPedido.estadoFinanciero && selectedPedido.estadoFinanciero !== 'por_cobrar'
                            ? selectedPedido.estadoFinanciero
                            : 'por_confirmar_pago',
                        fechaRefPago: serverTimestamp(),
                      });
                      setPayModalVisible(false);
                      setModalVisible(false);
                      Alert.alert('✅ Pago enviado', `Pedido ${orderLabel} pagado, esperando confirmación.`);
                      setSelectedPedido(null);
                    } catch (e) {
                      console.error('Enviar referencia', e);
                      Alert.alert('Error', 'No se pudo enviar la referencia');
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  <Text style={styles.modalButtonTextConfirm}>{saving ? 'Enviando...' : 'Enviar referencia'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    padding: 20,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 20,
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.secondary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  filtersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: colors.grayShades[50],
    marginRight: 12,
    flexDirection: 'row',
    maxHeight: 100,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: colors.secondary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterButtonTextActive: {
    color: colors.textInverse,
  },
  badge: {
    backgroundColor: colors.error,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  badgeText: {
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: 'bold',
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sortLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 12,
  },
  sortButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.grayShades[50],
    marginRight: 8,
  },
  sortButtonActive: {
    backgroundColor: colors.secondary,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sortButtonTextActive: {
    color: colors.textInverse,
  },
  pedidosList: {
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    minHeight: 150,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  pedidoCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  pedidoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  pedidoInfo: {
    flex: 1,
  },
  pedidoNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  pedidoDate: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  estadoBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  estadoText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pedidoDetails: {},
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  pedidoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 16,
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.success,
  },
  arrowContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: 'bold',
  },
  bottomSpacing: {
    height: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 20,
    maxHeight: '80%',
    width: '100%',
    maxWidth: 500,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 24,
  },
  modalBodyContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  modalLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  modalValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  modalTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.success,
  },
  estadoModalBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  estadoModalText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  observacionesText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 8,
    paddingBottom: 8,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    minWidth: 120,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  readonlyBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  readonlyBoxActive: {
    borderColor: colors.primary,
    backgroundColor: '#eef6ff',
  },
  readonlyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  readonlyText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    minWidth: 120,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 44,
    color: colors.textPrimary,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  modalButtonCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.borderLight,
  },
  modalButtonTextCancel: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  modalButtonConfirm: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  modalButtonTextConfirm: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  qrImage: {
    width: '100%',
    height: 160,
    marginTop: 10,
    borderRadius: 10,
  },
});

export default PedidosScreen;