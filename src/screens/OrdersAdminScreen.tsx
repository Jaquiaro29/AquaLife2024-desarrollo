// OrdersAdminScreen.tsx - Versión mejorada con header scrolleable

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  Alert,
  ScrollView,
  StatusBar,
  Dimensions,
} from 'react-native';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { globalStyles, colors } from '../styles/globalStyles';
import { formatCurrency } from '../utils/currency';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// ===== Interfaces / tipos =====
interface Pedido {
  id: string;
  numeroPedido?: number;
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
}

interface Cliente {
  nombre: string;
  direccion?: string;
  email?: string;
  telefono?: string;
}

// Para items en la FlatList
type ListItem =
  | { type: 'header'; fecha: string }
  | { type: 'pedido'; data: Pedido };

// ===== Helper para mostrar alert en Web/Nativo =====
function showMessage(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// ===== Funciones de formato =====
function formatOrderNumber(num: number): string {
  return num.toString().padStart(4, '0');
}

function formatFecha(fechaISO: string): string {
  const [year, month, day] = fechaISO.split('-');
  return `${day}/${month}/${year}`;
}

function getEstadoPriority(estado: string): number {
  switch (estado) {
    case 'pendiente': return 1;
    case 'listo':     return 2;
    case 'entregado': return 3;
    default:          return 99;
  }
}

// ===== Componente principal =====
const OrdersAdminScreen = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientesMap, setClientesMap] = useState<Record<string, Cliente>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [searchText, setSearchText] = useState<string>('');
  const [sellosCantidad, setSellosCantidad] = useState<number>(9999);
  const [tapasCantidad, setTapasCantidad] = useState<number>(9999);
  const [sellosDocId, setSellosDocId] = useState<string>('');
  const [tapasDocId, setTapasDocId] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('todos');
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  // ===== 1) Suscribirse a la colección "Pedidos" =====
  useEffect(() => {
    const qPedidos = query(collection(db, 'Pedidos'), orderBy('fecha', 'desc'));
    const unsubscribe = onSnapshot(qPedidos, (snapshot) => {
      const pedidosData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Pedido, 'id'>),
      }));

      // Orden adicional (estado + numPedido/fecha)
      pedidosData.sort((a, b) => {
        const priorityA = getEstadoPriority(a.estado);
        const priorityB = getEstadoPriority(b.estado);

        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        // mismo estado
        if (priorityA === 3) {
          // "entregado" => desc por numeroPedido
          const numA = a.numeroPedido || 0;
          const numB = b.numeroPedido || 0;
          return numB - numA;
        } else {
          // "pendiente" o "listo" => desc por fecha
          const dateA = new Date(a.fecha).getTime();
          const dateB = new Date(b.fecha).getTime();
          return dateB - dateA;
        }
      });

      setPedidos(pedidosData);
      setLoading(false);
    },
    (error) => {
      console.error('Error al obtener pedidos:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ===== 2) Suscribirse a "Clientes" para mapear clienteId =====
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'Clientes'), (snapshot) => {
      const map: Record<string, Cliente> = {};
      snapshot.forEach((doc) => {
        map[doc.id] = doc.data() as Cliente;
      });
      setClientesMap(map);
    });
    return () => unsub();
  }, []);

  // ===== 3) Cargar Inventario =====
  useEffect(() => {
    async function cargarInventario() {
      try {
        const snap = await getDocs(collection(db, 'Inventario'));
        let sellos = 9999;
        let tapas = 9999;
        let sellosId = '';
        let tapasId = '';

        snap.forEach((docu) => {
          const data = docu.data() as { nombre?: string; cantidad?: number };
          if (data.nombre === 'Sellos de seguridad') {
            sellos = data.cantidad ?? 0;
            sellosId = docu.id;
          } else if (data.nombre === 'Tapas plásticas') {
            tapas = data.cantidad ?? 0;
            tapasId = docu.id;
          }
        });

        setSellosCantidad(sellos);
        setTapasCantidad(tapas);
        setSellosDocId(sellosId);
        setTapasDocId(tapasId);
      } catch (err) {
        console.error('Error al cargar inventario:', err);
      }
    }
    cargarInventario();
  }, []);

  // ===== 4) Al montar, si detectamos <200 => notificar =====
  useEffect(() => {
    if (sellosCantidad < 200) {
      showMessage(
        'Inventario bajo',
        `¡Atención! "Sellos de seguridad" por debajo de 200 (${sellosCantidad}).`
      );
    }
    if (tapasCantidad < 200) {
      showMessage(
        'Inventario bajo',
        `¡Atención! "Tapas plásticas" por debajo de 200 (${tapasCantidad}).`
      );
    }
  }, [sellosCantidad, tapasCantidad]);

  // ===== Manejar cambio de estado de un pedido =====
  const handleChangeEstado = async (pedidoId: string, nuevoEstado: string) => {
    try {
      const pedido = pedidos.find((p) => p.id === pedidoId);
      if (!pedido) return;

      const totalBotellones = pedido.cantidadConAsa + pedido.cantidadSinAsa;

      // Validación: No se puede marcar como entregado si no está listo
      if (nuevoEstado === 'entregado' && pedido.estado !== 'listo') {
        showMessage(
          'Acción no permitida',
          'No se puede marcar como ENTREGADO un pedido que no está en estado LISTO. Primero debe marcarlo como LISTO.'
        );
        return;
      }

      // Si marcamos como "listo", chequeamos inventario
      if (nuevoEstado === 'listo') {
        if (sellosCantidad < totalBotellones || tapasCantidad < totalBotellones) {
          showMessage(
            'Inventario insuficiente',
            'No hay suficientes sellos o tapas para completar este pedido.'
          );
          return; // no cambia estado
        } else {
          // Descontar
          const nuevosSellos = sellosCantidad - totalBotellones;
          const nuevasTapas = tapasCantidad - totalBotellones;

          // Actualizar en Firestore (opcional)
          if (sellosDocId) {
            const sellosRef = doc(db, 'Inventario', sellosDocId);
            await updateDoc(sellosRef, { cantidad: nuevosSellos });
          }
          if (tapasDocId) {
            const tapasRef = doc(db, 'Inventario', tapasDocId);
            await updateDoc(tapasRef, { cantidad: nuevasTapas });
          }

          // Actualizar estado local
          setSellosCantidad(nuevosSellos);
          setTapasCantidad(nuevasTapas);

          showMessage(
            'Inventario actualizado',
            `Se han descontado ${totalBotellones} sellos y tapas.`
          );
        }
      }

      // Ahora sí, actualizar el estado del pedido
      const pedidoRef = doc(db, 'Pedidos', pedidoId);
      await updateDoc(pedidoRef, { estado: nuevoEstado });

      console.log(`Estado del pedido ${pedidoId} → ${nuevoEstado}`);
    } catch (error) {
      console.error('Error al cambiar estado:', error);
    }
  };

  // ===== Filtrado local (pedidoID o nombreCliente) =====
  const filteredPedidos = pedidos.filter((item) => {
    const clienteInfo = clientesMap[item.clienteId];
    const nombreCliente = clienteInfo?.nombre?.toLowerCase() || '';
    const numeroString = item.numeroPedido
      ? formatOrderNumber(item.numeroPedido)
      : item.id;
    const texto = searchText.toLowerCase();

    // Filtro por estado
    const estadoMatch = activeFilter === 'todos' || item.estado === activeFilter;

    return (
      estadoMatch && (
        numeroString.toLowerCase().includes(texto) ||
        nombreCliente.includes(texto)
      )
    );
  });

  // Agrupar por fecha => construimos listData
  const listData: ListItem[] = [];
  let currentFecha = '';
  for (const ped of filteredPedidos) {
    if (ped.fecha !== currentFecha) {
      currentFecha = ped.fecha;
      listData.push({ type: 'header', fecha: currentFecha });
    }
    listData.push({ type: 'pedido', data: ped });
  }

  // Estadísticas para el dashboard
  const stats = {
    total: pedidos.length,
    pendientes: pedidos.filter(p => p.estado === 'pendiente').length,
    listos: pedidos.filter(p => p.estado === 'listo').length,
    entregados: pedidos.filter(p => p.estado === 'entregado').length,
  };

  // Render de cada item
  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      const fechaStr = formatFecha(item.fecha);
      return (
        <View style={styles.headerContainer}>
          <Text style={styles.headerTextFecha}>Pedidos del {fechaStr}</Text>
        </View>
      );
    } else {
      const pedido = item.data;
      const clienteInfo = clientesMap[pedido.clienteId] || {};
      const clienteNombre = (clienteInfo.nombre || 'Cliente sin nombre').toUpperCase();
      const clienteDireccion = (clienteInfo.direccion || 'Sin dirección').toUpperCase();

      const mostrarBotonListo = pedido.estado === 'pendiente';
      const mostrarBotonEntregado = pedido.estado === 'listo'; // SOLO si está listo

      const tituloPedido = pedido.numeroPedido
        ? `Pedido Nº: ${formatOrderNumber(pedido.numeroPedido)}`
        : `Pedido ID: ${pedido.id}`;

      const totalBotellones = pedido.cantidadConAsa + pedido.cantidadSinAsa;

      // Determinar color según estado
      const estadoColor = 
        pedido.estado === 'pendiente' ? colors.warning :
        pedido.estado === 'listo' ? colors.success :
        colors.secondary;

      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{tituloPedido}</Text>
            <View style={[styles.estadoBadge, { backgroundColor: estadoColor }]}>
              <Text style={styles.estadoBadgeText}>{pedido.estado.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.infoLabel}>Cliente</Text>
                <Text style={styles.infoValue}>{clienteNombre}</Text>
              </View>
              
              <View style={styles.infoItem}>
                <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.infoLabel}>Dirección</Text>
                <Text style={styles.infoValue}>{clienteDireccion}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.infoLabel}>Fecha</Text>
                <Text style={styles.infoValue}>{pedido.fecha}</Text>
              </View>
              
              <View style={styles.infoItem}>
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.infoLabel}>Hora</Text>
                <Text style={styles.infoValue}>{pedido.hora}</Text>
              </View>
            </View>

            <View style={styles.quantitiesContainer}>
              <View style={styles.quantityItem}>
                <Text style={styles.quantityLabel}>Con Asa</Text>
                <Text style={styles.quantityValue}>{pedido.cantidadConAsa}</Text>
              </View>
              
              <View style={styles.quantityItem}>
                <Text style={styles.quantityLabel}>Sin Asa</Text>
                <Text style={styles.quantityValue}>{pedido.cantidadSinAsa}</Text>
              </View>
              
              <View style={styles.quantityItem}>
                <Text style={styles.quantityLabel}>Total</Text>
                <Text style={[styles.quantityValue, styles.totalQuantity]}>{totalBotellones}</Text>
              </View>
            </View>

            <View style={styles.footerRow}>
              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Total:</Text>
                <Text style={styles.totalValue}>{formatCurrency(pedido.total)}</Text>
              </View>
              
              {pedido.observaciones ? (
                <View style={styles.observacionesContainer}>
                  <Ionicons name="document-text-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.observacionesText}>{pedido.observaciones}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.buttonsContainer}>
              {mostrarBotonListo && (
                <TouchableOpacity
                  style={[styles.button, styles.buttonListo]}
                  onPress={() => handleChangeEstado(pedido.id, 'listo')}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.buttonText}>Marcar como Listo</Text>
                </TouchableOpacity>
              )}
              {mostrarBotonEntregado && (
                <View style={styles.entregadoButtonContainer}>
                  <TouchableOpacity
                    style={[styles.button, styles.buttonEntregado]}
                    onPress={() => handleChangeEstado(pedido.id, 'entregado')}
                  >
                    <Ionicons name="checkmark-done-outline" size={18} color="#fff" />
                    <Text style={styles.buttonText}>Marcar Entregado</Text>
                  </TouchableOpacity>
                  
                  {/* Tooltip de información */}
                  <TouchableOpacity 
                    style={styles.tooltipIcon}
                    onPress={() => setShowTooltip(showTooltip === pedido.id ? null : pedido.id)}
                  >
                    <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                  
                  {showTooltip === pedido.id && (
                    <View style={styles.tooltipContainer}>
                      <Text style={styles.tooltipText}>
                        Este pedido ya está marcado como LISTO y puede ser entregado al cliente
                      </Text>
                    </View>
                  )}
                </View>
              )}
              
              {/* Mensaje informativo cuando no se puede entregar */}
              {pedido.estado === 'pendiente' && (
                <View style={styles.infoMessage}>
                  <Ionicons name="information-circle" size={16} color={colors.warning} />
                  <Text style={styles.infoMessageText}>
                    Debe marcar como LISTO antes de poder entregar
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      );
    }
  };

  // Mostrar loading
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando pedidos...</Text>
      </View>
    );
  }

  // Render final
  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#667eea" barStyle="light-content" />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header DENTRO del ScrollView */}
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Gestión de Pedidos</Text>
            <Text style={styles.headerSubtitle}>Panel de administración</Text>
          </View>
          <View style={styles.inventoryAlert}>
            {sellosCantidad < 200 && (
              <View style={styles.alertItem}>
                <Ionicons name="warning" size={16} color="#fff" />
                <Text style={styles.alertText}>Sellos: {sellosCantidad}</Text>
              </View>
            )}
            {tapasCantidad < 200 && (
              <View style={styles.alertItem}>
                <Ionicons name="warning" size={16} color="#fff" />
                <Text style={styles.alertText}>Tapas: {tapasCantidad}</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Contenido principal */}
        <View style={styles.content}>
          {/* Dashboard Stats */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.statsContainer}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.statCard}
            >
              <Text style={styles.statNumber}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total Pedidos</Text>
            </LinearGradient>
            
            <LinearGradient
              colors={['#FF9800', '#F57C00']}
              style={styles.statCard}
            >
              <Text style={styles.statNumber}>{stats.pendientes}</Text>
              <Text style={styles.statLabel}>Pendientes</Text>
            </LinearGradient>
            
            <LinearGradient
              colors={['#4CAF50', '#45a049']}
              style={styles.statCard}
            >
              <Text style={styles.statNumber}>{stats.listos}</Text>
              <Text style={styles.statLabel}>Listos</Text>
            </LinearGradient>
            
            <LinearGradient
              colors={['#9C27B0', '#7B1FA2']}
              style={styles.statCard}
            >
              <Text style={styles.statNumber}>{stats.entregados}</Text>
              <Text style={styles.statLabel}>Entregados</Text>
            </LinearGradient>
          </ScrollView>

          {/* Search and Filters */}
          <View style={styles.controlsContainer}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por Nº de pedido o cliente..."
                value={searchText}
                onChangeText={setSearchText}
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.filtersContainer}
            >
              <TouchableOpacity
                style={[styles.filterButton, activeFilter === 'todos' && styles.filterButtonActive]}
                onPress={() => setActiveFilter('todos')}
              >
                <Text style={[styles.filterButtonText, activeFilter === 'todos' && styles.filterButtonTextActive]}>
                  Todos
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.filterButton, activeFilter === 'pendiente' && styles.filterButtonActive]}
                onPress={() => setActiveFilter('pendiente')}
              >
                <Text style={[styles.filterButtonText, activeFilter === 'pendiente' && styles.filterButtonTextActive]}>
                  Pendientes
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.filterButton, activeFilter === 'listo' && styles.filterButtonActive]}
                onPress={() => setActiveFilter('listo')}
              >
                <Text style={[styles.filterButtonText, activeFilter === 'listo' && styles.filterButtonTextActive]}>
                  Listos
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.filterButton, activeFilter === 'entregado' && styles.filterButtonActive]}
                onPress={() => setActiveFilter('entregado')}
              >
                <Text style={[styles.filterButtonText, activeFilter === 'entregado' && styles.filterButtonTextActive]}>
                  Entregados
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Lista de Pedidos */}
          {listData.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyStateTitle}>No se encontraron pedidos</Text>
              <Text style={styles.emptyStateSubtitle}>
                {searchText || activeFilter !== 'todos' 
                  ? 'Intenta cambiar los filtros de búsqueda' 
                  : 'No hay pedidos registrados en el sistema'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={listData}
              keyExtractor={(item, index) => {
                if (item.type === 'header') {
                  return `header-${item.fecha}-${index}`;
                }
                return (item.data as Pedido).id;
              }}
              renderItem={renderItem}
              scrollEnabled={false}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Espacio al final para mejor scroll */}
          <View style={styles.bottomSpacing} />
        </View>
      </ScrollView>
    </View>
  );
};

// ===== Estilos mejorados =====
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // Header ahora está dentro del ScrollView
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  // Contenedor para el contenido debajo del header
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  headerContent: {
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  inventoryAlert: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 15,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  alertText: {
    color: '#fff',
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  statsContainer: {
    marginTop: -30,
    marginBottom: 20,
  },
  statCard: {
    padding: 20,
    borderRadius: 16,
    marginRight: 12,
    minWidth: 120,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  controlsContainer: {
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: colors.textPrimary,
  },
  filtersContainer: {
    marginBottom: 8,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.background,
    marginRight: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  filterButtonActive: {
    backgroundColor: '#667eea',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingBottom: 20,
  },
  headerContainer: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
  },
  headerTextFecha: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 16,
    marginVertical: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayShades[50],
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  estadoBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  estadoBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  cardBody: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 2,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  quantitiesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  quantityItem: {
    alignItems: 'center',
  },
  quantityLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
  },
  totalQuantity: {
    color: '#4CAF50',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 8,
    fontWeight: '500',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  observacionesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    marginLeft: 12,
  },
  observacionesText: {
    fontSize: 12,
    color: '#92400e',
    marginLeft: 6,
    flex: 1,
  },
  buttonsContainer: {
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  buttonListo: {
    backgroundColor: '#4CAF50',
  },
  buttonEntregado: {
    backgroundColor: '#9C27B0',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  entregadoButtonContainer: {
    position: 'relative',
  },
  tooltipIcon: {
    position: 'absolute',
    right: 12,
    top: 12,
    zIndex: 10,
  },
  tooltipContainer: {
    position: 'absolute',
    top: -80,
    left: 0,
    right: 0,
    backgroundColor: colors.grayShades[700],
    padding: 12,
    borderRadius: 8,
    zIndex: 100,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  tooltipText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  infoMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(254,243,199,0.9)',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
    gap: 8,
  },
  infoMessageText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '500',
    flex: 1,
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
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  bottomSpacing: {
    height: 20,
  },
});

export default OrdersAdminScreen;