import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal
} from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { formatCurrency } from '../utils/currency';

// Interfaces y Tipos
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
  observaciones: string;
  numeroPedido?: number;
}

type FilterType = 'todos' | 'pendientes' | 'historial';
type SortType = 'fecha' | 'total' | 'cantidad';

const PedidosScreen = () => {
  // Estado y Hooks
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('todos');
  const [sortBy, setSortBy] = useState<SortType>('fecha');
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Efecto para obtener datos de Firebase
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
        const pedidosData: Pedido[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Pedido, 'id'>),
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

  // Lógica de Filtrado
  const pedidosPendientes = pedidos.filter((p) => 
    p.estado === 'pendiente' || p.estado === 'procesando'
  );
  
  const pedidosHistorial = pedidos.filter((p) =>
    p.estado === 'listo' || p.estado === 'entregado' || p.estado === 'completado'
  );

  // Lógica de Ordenamiento
  const parseFecha = (fechaStr: string) => {
    const [year, month, day] = fechaStr.split('-');
    return new Date(Number(year), Number(month) - 1, Number(day));
  };

  const sortPedidos = (pedidosArray: Pedido[]) => {
    return [...pedidosArray].sort((a, b) => {
      switch (sortBy) {
        case 'fecha':
          const dateA = parseFecha(a.fecha).getTime();
          const dateB = parseFecha(b.fecha).getTime();
          return dateB - dateA;
        
        case 'total':
          return b.total - a.total;
        
        case 'cantidad':
          const totalA = a.cantidadConAsa + a.cantidadSinAsa;
          const totalB = b.cantidadConAsa + b.cantidadSinAsa;
          return totalB - totalA;
        
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
    // El useEffect se encargará de actualizar los datos
  };

  const getEstadoStyles = (estado: string) => {
    switch (estado.toLowerCase()) {
      case 'pendiente':
        return { backgroundColor: '#fef3c7', color: '#d97706', icon: '⏳' };
      case 'procesando':
        return { backgroundColor: '#dbeafe', color: '#1d4ed8', icon: '🔄' };
      case 'listo':
        return { backgroundColor: '#dcfce7', color: '#16a34a', icon: '✅' };
      case 'entregado':
      case 'completado':
        return { backgroundColor: '#f3e8ff', color: '#9333ea', icon: '🎉' };
      default:
        return { backgroundColor: '#f3f4f6', color: '#6b7280', icon: '📦' };
    }
  };

  const formatFecha = (fechaStr: string) => {
    const date = parseFecha(fechaStr);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatHora = (horaStr: string) => {
    return horaStr.substring(0, 5);
  };

  const getTotalBotellones = (pedido: Pedido) => {
    return pedido.cantidadConAsa + pedido.cantidadSinAsa;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Cargando tus pedidos...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={["#3b82f6"]}
        />
      }
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent} // ESTA ES LA CLAVE
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Mis Pedidos</Text>
          <Text style={styles.subtitle}>
            {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''} en total
          </Text>
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

      {/* Filtros */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
      >
        <TouchableOpacity
          style={[
            styles.filterButton,
            activeFilter === 'todos' && styles.filterButtonActive
          ]}
          onPress={() => setActiveFilter('todos')}
        >
          <Text style={[
            styles.filterButtonText,
            activeFilter === 'todos' && styles.filterButtonTextActive
          ]}>
            📦 Todos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            activeFilter === 'pendientes' && styles.filterButtonActive
          ]}
          onPress={() => setActiveFilter('pendientes')}
        >
          <Text style={[
            styles.filterButtonText,
            activeFilter === 'pendientes' && styles.filterButtonTextActive
          ]}>
            ⏳ Pendientes
          </Text>
          {pedidosPendientes.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pedidosPendientes.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            activeFilter === 'historial' && styles.filterButtonActive
          ]}
          onPress={() => setActiveFilter('historial')}
        >
          <Text style={[
            styles.filterButtonText,
            activeFilter === 'historial' && styles.filterButtonTextActive
          ]}>
            ✅ Historial
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Ordenamiento */}
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>por:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[
              styles.sortButton,
              sortBy === 'fecha' && styles.sortButtonActive
            ]}
            onPress={() => setSortBy('fecha')}
          >
            <Text style={[
              styles.sortButtonText,
              sortBy === 'fecha' && styles.sortButtonTextActive
            ]}>
              📅 Fecha
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sortButton,
              sortBy === 'total' && styles.sortButtonActive
            ]}
            onPress={() => setSortBy('total')}
          >
            <Text style={[
              styles.sortButtonText,
              sortBy === 'total' && styles.sortButtonTextActive
            ]}>
              💰 Total
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sortButton,
              sortBy === 'cantidad' && styles.sortButtonActive
            ]}
            onPress={() => setSortBy('cantidad')}
          >
            <Text style={[
              styles.sortButtonText,
              sortBy === 'cantidad' && styles.sortButtonTextActive
            ]}>
              🫙 Cantidad
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Lista de Pedidos */}
      <View style={styles.pedidosList}>
        {pedidosFiltrados().length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📦</Text>
            <Text style={styles.emptyStateTitle}>
              {activeFilter === 'todos' ? 'No tienes pedidos' :
               activeFilter === 'pendientes' ? 'No hay pedidos pendientes' :
               'No hay pedidos en el historial'}
            </Text>
            <Text style={styles.emptyStateText}>
              {activeFilter === 'pendientes' 
                ? 'Todos tus pedidos están completados 🎉'
                : 'Cuando realices un pedido, aparecerá aquí'
              }
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
                    <Text style={styles.pedidoNumber}>
                      Pedido #{pedido.numeroPedido || pedido.id.substring(0, 8)}
                    </Text>
                    <Text style={styles.pedidoDate}>
                      {formatFecha(pedido.fecha)} • {formatHora(pedido.hora)}
                    </Text>
                  </View>
                  <View style={[styles.estadoBadge, { backgroundColor: estadoStyles.backgroundColor }]}> 
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
                    <Text style={styles.totalText}>
                      {formatCurrency(pedido.total)}
                    </Text>
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

      {/* Espacio al final para mejor scroll */}
      <View style={styles.bottomSpacing} />

      {/* Modal de Detalles del Pedido */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedPedido && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    Pedido #{selectedPedido.numeroPedido || selectedPedido.id.substring(0, 8)}
                  </Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody}>
                  {/* Estado */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Estado del Pedido</Text>
                    {(() => {
                      const estadoStyles = getEstadoStyles(selectedPedido.estado);
                      return (
                        <View style={[styles.estadoModalBadge, { backgroundColor: estadoStyles.backgroundColor }]}>
                          <Text style={[styles.estadoModalText, { color: estadoStyles.color }]}>
                            {estadoStyles.icon} {selectedPedido.estado.toUpperCase()}
                          </Text>
                        </View>
                      );
                    })()}
                  </View>

                  {/* Fecha y Hora */}
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

                  {/* Detalles del Pedido */}
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

                  {/* Información de Pago */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Información de Pago</Text>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>💰 Costo unitario:</Text>
                      <Text style={styles.modalValue}>{formatCurrency(selectedPedido.costoUnitario)}</Text>
                    </View>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>💵 Total:</Text>
                      <Text style={styles.modalTotal}>{formatCurrency(selectedPedido.total)}</Text>
                    </View>
                  </View>

                  {/* Observaciones */}
                  {selectedPedido.observaciones && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Observaciones</Text>
                      <Text style={styles.observacionesText}>
                        {selectedPedido.observaciones}
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  // ESTILO CLAVE AÑADIDO:
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
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
    color: '#3b82f6',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  filtersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: '#f1f5f9',
    marginRight: 12,
    flexDirection: 'row',
    maxHeight: 100,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  badge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sortLabel: {
    fontSize: 14,
    color: '#64748b',
    marginRight: 12,
  },
  sortButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  sortButtonActive: {
    backgroundColor: '#3b82f6',
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  sortButtonTextActive: {
    color: '#fff',
  },
  pedidosList: {
    // Quitamos el flex: 1 y padding de aquí
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40, // Reducido
    minHeight: 150, // Altura mínima
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  pedidoCard: {
    backgroundColor: '#fff',
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
    color: '#1e293b',
    marginBottom: 4,
  },
  pedidoDate: {
    fontSize: 14,
    color: '#64748b',
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
  pedidoDetails: {
    // El contenido se organiza automáticamente
  },
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
    color: '#64748b',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  pedidoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 16,
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#059669',
  },
  arrowContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: 'bold',
  },
  // NUEVO ESTILO AÑADIDO:
  bottomSpacing: {
    height: 20, // Espacio al final para mejor experiencia de scroll
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
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
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 24,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  modalLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  modalValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  modalTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
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
    color: '#64748b',
    lineHeight: 20,
    fontStyle: 'italic',
  },
});

export default PedidosScreen;