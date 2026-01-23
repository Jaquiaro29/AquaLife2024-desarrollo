// OrdersAdminScreen.tsx - Versión mejorada con header scrolleable

import React, { useEffect, useMemo, useState } from 'react';
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
  Modal,
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
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { globalStyles, colors } from '../styles/globalStyles';
import { formatCurrency } from '../utils/currency';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useGlobalConfig } from '../hooks/useGlobalConfig';
import { getNextOrderNumber } from '../components/getNextOrderNumber';
import { VE_BANKS } from '../utils/veBanks';

const { width, height } = Dimensions.get('window');

// ===== Interfaces / tipos =====
type EstadoFinanciero = 'por_cobrar' | 'por_confirmar_pago' | 'cobrado' | 'pagado' | 'cancelado';

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
  createdAt?: any;
  firstResponseAt?: any;
  estadoFinanciero?: EstadoFinanciero;
  montoCobrado?: number;
  montoPagado?: number;
  fechaCobrado?: any;
  fechaPagado?: any;
  refPagoUlt6?: string;
  bancoEmisor?: string;
  fechaRefPago?: any;
  metodoPago?: string;
}

interface Cliente {
  nombre: string;
  direccion?: string;
  email?: string;
  telefono?: string;
  cedula?: string;
}

// Interfaz para nuevo pedido desde admin
interface AdminOrder {
  withHandle: number;
  withoutHandle: number;
  type: 'recarga' | 'intercambio';
  comments: string;
  priority: 'alta' | 'normal';
}

type AdminOrderFormErrors = Partial<Record<'cliente' | 'cantidades' | 'inventario' | 'comentarios', string>>;
type EditOrderFormErrors = Partial<Record<'cantidades' | 'estado' | 'numericos' | 'comentarios', string>>;

// Para items en la FlatList
type ListItem =
  | { type: 'header'; fecha: string }
  | { type: 'pedido'; data: Pedido };

type OrdersFilter =
  | { type: 'all' }
  | { type: 'estado'; value: Pedido['estado'] }
  | { type: 'finanza'; value: EstadoFinanciero };

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

// Formatea un timestamp (Firestore Date/ISO) a fecha y hora legible
function formatTsDateTime(ts: any): string {
  if (!ts) return 'N/D';
  try {
    const dateObj = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(dateObj.getTime())) return 'N/D';
    const fecha = dateObj.toISOString().split('T')[0];
    const hora = dateObj.toTimeString().split(' ')[0];
    return `${formatFecha(fecha)} · ${hora}`;
  } catch (e) {
    return 'N/D';
  }
}

function getEstadoPriority(estado: string): number {
  switch (estado) {
    case 'pendiente': return 1;
    case 'listo':     return 2;
    case 'entregado': return 3;
    default:          return 99;
  }
}

function resolvePedidoFinancialState(pedido: Pedido): EstadoFinanciero {
  if (pedido.estadoFinanciero) return pedido.estadoFinanciero;
  if (pedido.estado === 'cancelado') return 'cancelado';
  return 'por_cobrar';
}

// ===== Componente principal =====
const OrdersAdminScreen = () => {
  const navigation = useNavigation<any>();
  const isSmallScreen = width < 520;
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientesMap, setClientesMap] = useState<Record<string, Cliente>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [searchText, setSearchText] = useState<string>('');
  const [sellosCantidad, setSellosCantidad] = useState<number>(9999);
  const [tapasCantidad, setTapasCantidad] = useState<number>(9999);
  const [sellosDocId, setSellosDocId] = useState<string>('');
  const [tapasDocId, setTapasDocId] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<OrdersFilter>({ type: 'all' });
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Crear pedido (modal)
  const [showCreateOrderModal, setShowCreateOrderModal] = useState<boolean>(false);
  const [creatingOrder, setCreatingOrder] = useState<boolean>(false);
  const [orderForm, setOrderForm] = useState<AdminOrder>({
    withHandle: 0,
    withoutHandle: 0,
    type: 'recarga',
    comments: '',
    priority: 'normal',
  });
  const [clienteSearch, setClienteSearch] = useState<string>('');
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [selectedClienteName, setSelectedClienteName] = useState<string>('');
  const [orderFormErrors, setOrderFormErrors] = useState<AdminOrderFormErrors>({});

  // Precios globales
  const { botellonPrice, botellonPriceHigh } = useGlobalConfig();

  // ===== 1) Suscribirse a la colección "Pedidos" =====
  useEffect(() => {
    const qPedidos = query(collection(db, 'Pedidos'), orderBy('fecha', 'desc'));
    const unsubscribe = onSnapshot(qPedidos, (snapshot) => {
      const pedidosData = snapshot.docs.map((doc) => {
        const data = doc.data() as Omit<Pedido, 'id'>;
        const estadoFinanciero: EstadoFinanciero = data.estadoFinanciero
          ? data.estadoFinanciero
          : data.estado === 'cancelado'
            ? 'cancelado'
            : 'por_cobrar';

        return {
          id: doc.id,
          ...data,
          estadoFinanciero,
          montoCobrado: data.montoCobrado ?? data.total ?? 0,
          montoPagado: data.montoPagado ?? 0,
        };
      });

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

  // Limpiar símbolos en inputs de búsqueda (solo letras/acentos, números y espacios)
  const sanitizeSearch = (text: string) => text.replace(/[^0-9A-Za-z\u00C0-\u017F\s]/g, '');

  const sanitizeCommentText = (text: string) =>
    text
      .replace(/[^A-Za-zÁ-úñÑáéíóú\s]/g, '')
      .replace(/\s+/g, ' ')
      .trimStart();

  // ===== Helpers Crear Pedido =====
  const clientesList = Object.entries(clientesMap).map(([id, data]) => ({ id, ...data }));
  const filteredClientes = clientesList.filter(c => {
    const q = clienteSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.nombre || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.telefono || '').toLowerCase().includes(q) ||
      String(c.cedula || '').toLowerCase().includes(q)
    );
  });

  const clearOrderError = (field: keyof AdminOrderFormErrors) => {
    setOrderFormErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleOrderChange = <T extends keyof AdminOrder>(field: T, value: AdminOrder[T]) => {
    if (field === 'comments') {
      clearOrderError('comentarios');
      const sanitized = sanitizeCommentText(String(value)).slice(0, MAX_COMMENT_LENGTH);
      setOrderForm(prev => ({ ...prev, comments: sanitized }));
      return;
    }
    setOrderForm(prev => ({ ...prev, [field]: value }));
  };

  const increment = (type: 'withHandle' | 'withoutHandle') => {
    setOrderForm(prev => ({ ...prev, [type]: prev[type] + 1 }));
    clearOrderError('cantidades');
    clearOrderError('inventario');
  };

  const decrement = (type: 'withHandle' | 'withoutHandle') => {
    setOrderForm(prev => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }));
    clearOrderError('cantidades');
    clearOrderError('inventario');
  };

  const totalBottlesNew = orderForm.withHandle + orderForm.withoutHandle;
  const MAX_COMMENT_LENGTH = 250;
  const PRIORITY_MULTIPLIER: Record<string, number> = { normal: 1, alta: 1.4 };
  const basePrice = (typeof botellonPrice === 'number' && !isNaN(botellonPrice)) ? botellonPrice : 0.5;
  const highPriceAvailable = (typeof botellonPriceHigh === 'number' && !isNaN(botellonPriceHigh));
  const costPerBottleNew = orderForm.priority === 'alta'
    ? (highPriceAvailable ? botellonPriceHigh! : basePrice * PRIORITY_MULTIPLIER.alta)
    : basePrice * PRIORITY_MULTIPLIER.normal;
  const totalPriceNew = totalBottlesNew * costPerBottleNew;

  const openCreateOrderModal = () => {
    setOrderFormErrors({});
    setShowCreateOrderModal(true);
  };

  const closeCreateOrderModal = () => {
    setShowCreateOrderModal(false);
    setCreatingOrder(false);
    setOrderForm({ withHandle: 0, withoutHandle: 0, type: 'recarga', comments: '', priority: 'normal' });
    setClienteSearch('');
    setSelectedClienteId(null);
    setSelectedClienteName('');
    setOrderFormErrors({});
  };

  const handleSelectCliente = (id: string) => {
    setSelectedClienteId(id);
    const name = clientesMap[id]?.nombre || '';
    setSelectedClienteName(name);
    clearOrderError('cliente');
  };

  const handleEditOrderAction = () => {
    if (!selectedOrder) {
      showMessage('Selecciona un pedido', 'Primero selecciona un pedido de la lista.');
      return;
    }
    if (!canModifySelected) {
      showMessage('No editable', 'Solo se pueden editar pedidos pendientes.');
      return;
    }
    setOrderToEdit(selectedOrder);
    setEditOrderModalVisible(true);
  };

  const handleCancelOrderAction = () => {
    if (!selectedOrder) {
      showMessage('Selecciona un pedido', 'Primero selecciona un pedido de la lista.');
      return;
    }
    if (!canModifySelected) {
      showMessage('No se puede cancelar', 'Solo se pueden cancelar pedidos pendientes.');
      return;
    }
    setOrderToCancel(selectedOrder);
    setCancelOrderModalVisible(true);
  };

  const validateOrderForm = (): boolean => {
    const errors: AdminOrderFormErrors = {};
    let customAlert: { title: string; message: string } | null = null;

    if (!selectedClienteId) {
      errors.cliente = 'Selecciona un cliente para continuar.';
      customAlert = {
        title: 'Selecciona un cliente ✨',
        message: 'Antes de crear el pedido, elige a la persona o empresa correspondiente.',
      };
    }

    const cantidadesNegativas = orderForm.withHandle < 0 || orderForm.withoutHandle < 0;
    if (cantidadesNegativas) {
      errors.cantidades = 'Las cantidades no pueden ser negativas.';
      if (!customAlert) {
        customAlert = {
          title: 'Revisa las cantidades',
          message: 'Asegúrate de ingresar valores positivos para los botellones.',
        };
      }
    }

    if (totalBottlesNew <= 0) {
      errors.cantidades = 'Agrega al menos un botellón.';
      if (!customAlert) {
        customAlert = {
          title: 'Agrega botellones 💧',
          message: 'Indica cuántos botellones con o sin asa llevará el pedido.',
        };
      }
    }

    const inventarioInsuficiente = totalBottlesNew > sellosCantidad || totalBottlesNew > tapasCantidad;
    if (!errors.cantidades && inventarioInsuficiente) {
      errors.inventario = 'No hay inventario suficiente para esta cantidad.';
      if (!customAlert) {
        customAlert = {
          title: 'Inventario insuficiente',
          message: 'Reduce la cantidad o espera a reponer sellos y tapas disponibles.',
        };
      }
    }

    if (orderForm.comments.length > MAX_COMMENT_LENGTH) {
      errors.comentarios = `Máximo ${MAX_COMMENT_LENGTH} caracteres en comentarios.`;
      if (!customAlert) {
        customAlert = {
          title: 'Comentario muy largo',
          message: 'Resume la instrucción para que no supere el límite permitido.',
        };
      }
    }

    setOrderFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      if (customAlert) {
        showMessage(customAlert.title, customAlert.message);
      } else {
        showMessage('Datos incompletos', 'Revisa los campos resaltados antes de continuar.');
      }
      return false;
    }

    return true;
  };

  const handleCreateOrderFromAdmin = async () => {
    if (!validateOrderForm()) {
      return;
    }

    setCreatingOrder(true);
    try {
      const now = new Date();
      const fecha = now.toISOString().split('T')[0];
      const hora = now.toTimeString().split(' ')[0];
      const numeroPedido = await getNextOrderNumber(db);

      const nuevoPedido = {
        clienteId: selectedClienteId,
        fecha,
        hora,
        cantidadConAsa: orderForm.withHandle,
        cantidadSinAsa: orderForm.withoutHandle,
        costoUnitario: costPerBottleNew,
        total: totalPriceNew,
        estado: 'pendiente',
        estadoFinanciero: 'por_cobrar' as EstadoFinanciero,
        empleadoAsignadoId: 'admin',
        observaciones: sanitizeCommentText(orderForm.comments).slice(0, MAX_COMMENT_LENGTH),
        type: orderForm.type,
        tipo: orderForm.type,
        numeroPedido,
        createdAt: serverTimestamp(),
        montoCobrado: 0,
        montoPagado: 0,
      };

      await addDoc(collection(db, 'Pedidos'), nuevoPedido);
      showMessage('Éxito', `Pedido creado para ${selectedClienteName || 'cliente'}.`);
      closeCreateOrderModal();
    } catch (error) {
      console.error('Error al crear pedido desde admin:', error);
      showMessage('Error', 'No se pudo crear el pedido. Intenta nuevamente.');
    } finally {
      setCreatingOrder(false);
    }
  };

  // ===== Manejar cambio de estado de un pedido =====
  const handleChangeEstado = async (pedidoId: string, nuevoEstado: string) => {
    try {
      const pedido = pedidos.find((p) => p.id === pedidoId);
      if (!pedido) return;

      if (pedido.estado === 'cancelado') {
        showMessage('Pedido cancelado', 'No se pueden modificar pedidos cancelados.');
        return;
      }

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
      const updatePayload: Record<string, any> = { estado: nuevoEstado };
      // Set firstResponseAt when leaving 'pendiente' for the first time
      if (pedido.estado === 'pendiente' && nuevoEstado !== 'pendiente' && !pedido.firstResponseAt) {
        updatePayload.firstResponseAt = serverTimestamp();
      }
      await updateDoc(pedidoRef, updatePayload);

      console.log(`Estado del pedido ${pedidoId} → ${nuevoEstado}`);
    } catch (error) {
      console.error('Error al cambiar estado:', error);
    }
  };

  const handleChangeEstadoFinanciero = async (pedidoId: string, nuevoEstado: EstadoFinanciero) => {
    try {
      const pedido = pedidos.find((p) => p.id === pedidoId);
      if (!pedido) return;

      if (pedido.estado === 'cancelado' && nuevoEstado !== 'cancelado') {
        showMessage('Pedido cancelado', 'No se puede cambiar el estado financiero de un pedido cancelado.');
        return;
      }

      const pedidoRef = doc(db, 'Pedidos', pedidoId);
      const payload: Record<string, any> = {
        estadoFinanciero: nuevoEstado,
      };

      const baseMonto = pedido.total || 0;
      const montoCobrado = pedido.montoCobrado ?? baseMonto;

      switch (nuevoEstado) {
        case 'por_cobrar':
          payload.montoCobrado = 0;
          payload.montoPagado = 0;
          payload.fechaCobrado = null;
          payload.fechaPagado = null;
          break;
        case 'cobrado':
          payload.montoCobrado = montoCobrado > 0 ? montoCobrado : baseMonto;
          payload.montoPagado = pedido.montoPagado ?? 0;
          payload.fechaCobrado = serverTimestamp();
          if (!pedido.fechaPagado) payload.fechaPagado = null;
          break;
        case 'pagado':
          payload.montoCobrado = montoCobrado > 0 ? montoCobrado : baseMonto;
          payload.montoPagado = pedido.montoPagado && pedido.montoPagado > 0 ? pedido.montoPagado : baseMonto;
          if (!pedido.fechaCobrado) payload.fechaCobrado = serverTimestamp();
          payload.fechaPagado = serverTimestamp();
          break;
        case 'cancelado':
          payload.montoCobrado = 0;
          payload.montoPagado = 0;
          payload.fechaCobrado = null;
          payload.fechaPagado = null;
          break;
        default:
          break;
      }

      await updateDoc(pedidoRef, payload);
    } catch (error) {
      console.error('Error al cambiar estado financiero:', error);
      showMessage('Error', 'No se pudo actualizar el estado financiero.');
    }
  };

  const handleRejectPayment = async (pedidoId: string) => {
    try {
      const pedido = pedidos.find((p) => p.id === pedidoId);
      if (!pedido) return;
      if (pedido.estadoFinanciero !== 'por_confirmar_pago') {
        showMessage('Acción no disponible', 'Solo se puede rechazar cuando el estado es "Por confirmar pago".');
        return;
      }
      const pedidoRef = doc(db, 'Pedidos', pedidoId);
      await updateDoc(pedidoRef, {
        estadoFinanciero: 'por_cobrar',
        fechaCobrado: null,
        fechaPagado: null,
      });
      showMessage('Pago rechazado', 'El pedido volvió a estado "Por cobrar".');
    } catch (error) {
      console.error('Error al rechazar pago:', error);
      showMessage('Error', 'No se pudo rechazar el pago.');
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

    let matchesFilter = true;
    if (activeFilter.type === 'estado') {
      matchesFilter = item.estado === activeFilter.value;
    } else if (activeFilter.type === 'finanza') {
      matchesFilter = resolvePedidoFinancialState(item) === activeFilter.value;
    }

    if (!matchesFilter) {
      return false;
    }

    return (
      numeroString.toLowerCase().includes(texto) ||
      nombreCliente.includes(texto)
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
    cancelados: pedidos.filter(p => p.estado === 'cancelado').length,
  };

  const financeStats = useMemo(() => {
    const totals: Record<EstadoFinanciero, number> = {
      por_cobrar: 0,
      por_confirmar_pago: 0,
      cobrado: 0,
      pagado: 0,
      cancelado: 0,
    };
    const counts: Record<EstadoFinanciero, number> = {
      por_cobrar: 0,
      por_confirmar_pago: 0,
      cobrado: 0,
      pagado: 0,
      cancelado: 0,
    };
    let collectedTotal = 0;

    pedidos.forEach((pedido) => {
      const estadoFin = resolvePedidoFinancialState(pedido);
      const base = pedido.total ?? 0;
      const montoCobrado = pedido.montoCobrado ?? base;
      const montoPagado = pedido.montoPagado ?? 0;

      counts[estadoFin] += 1;

      switch (estadoFin) {
        case 'por_cobrar':
          totals.por_cobrar += base;
          break;
        case 'por_confirmar_pago':
          totals.por_confirmar_pago += base;
          break;
        case 'cobrado':
          totals.cobrado += montoCobrado;
          collectedTotal += montoCobrado;
          break;
        case 'pagado':
          collectedTotal += montoCobrado;
          totals.pagado += montoPagado || montoCobrado;
          break;
        case 'cancelado':
          totals.cancelado += base;
          break;
        default:
          break;
      }
    });

    const neto = collectedTotal - totals.pagado;
    return { totals, counts, neto };
  }, [pedidos]);

  const summaryCards = useMemo<Array<{
    key: string;
    colors: string[];
    value: string;
    label: string;
    filter?: OrdersFilter;
  }>>(
    () => [
      {
        key: 'total',
        colors: colors.gradientSecondary,
        value: String(stats.total),
        label: 'Total pedidos',
        filter: { type: 'all' },
      },
      {
        key: 'pendientes',
        colors: [colors.warning, '#D97706'],
        value: String(stats.pendientes),
        label: 'Pendientes',
        filter: { type: 'estado', value: 'pendiente' },
      },
      {
        key: 'listos',
        colors: colors.gradientSuccess,
        value: String(stats.listos),
        label: 'Listos',
        filter: { type: 'estado', value: 'listo' },
      },
      {
        key: 'entregados',
        colors: [colors.error, '#DC2626'],
        value: String(stats.entregados),
        label: 'Entregados',
        filter: { type: 'estado', value: 'entregado' },
      },
      {
        key: 'cancelados',
        colors: ['#6B7280', '#1F2937'],
        value: String(stats.cancelados),
        label: 'Cancelados',
        filter: { type: 'estado', value: 'cancelado' },
      },
      {
        key: 'por_cobrar',
        colors: ['#F59E0B', '#B45309'],
        value: formatCurrency(financeStats.totals.por_cobrar),
        label: `Por cobrar • ${financeStats.counts.por_cobrar}`,
        filter: { type: 'finanza', value: 'por_cobrar' },
      },
      {
        key: 'por_confirmar_pago',
        colors: ['#fde68a', '#f59e0b'],
        value: formatCurrency(financeStats.totals.por_confirmar_pago),
        label: `Por confirmar • ${financeStats.counts.por_confirmar_pago}`,
        filter: { type: 'finanza', value: 'por_confirmar_pago' },
      },
      {
        key: 'cobrados',
        colors: colors.gradientSuccess,
        value: formatCurrency(financeStats.totals.cobrado),
        label: `Cobrados • ${financeStats.counts.cobrado}`,
        filter: { type: 'finanza', value: 'cobrado' },
      },
      {
        key: 'neto',
        colors: ['#0f172a', '#1e293b'],
        value: formatCurrency(financeStats.neto),
        label: 'Flujo neto',
      },
    ],
    [stats, financeStats]
  );

  const isCardSelected = (cardFilter?: OrdersFilter) => {
    if (!cardFilter) return false;
    switch (cardFilter.type) {
      case 'all':
        return activeFilter.type === 'all';
      case 'estado':
        return activeFilter.type === 'estado' && activeFilter.value === cardFilter.value;
      case 'finanza':
        return activeFilter.type === 'finanza' && activeFilter.value === cardFilter.value;
      default:
        return false;
    }
  };

  const handleCardPress = (cardFilter?: OrdersFilter) => {
    if (!cardFilter) return;
    if (cardFilter.type === 'all' && activeFilter.type === 'all') {
      return;
    }
    if (isCardSelected(cardFilter) && cardFilter.type !== 'all') {
      setActiveFilter({ type: 'all' });
      return;
    }
    setActiveFilter(cardFilter);
  };

  useEffect(() => {
    if (selectedOrderId && !pedidos.some((p) => p.id === selectedOrderId)) {
      setSelectedOrderId(null);
    }
  }, [pedidos, selectedOrderId]);

  const selectedOrder = selectedOrderId
    ? pedidos.find((pedido) => pedido.id === selectedOrderId) || null
    : null;

  const handleSelectOrder = (pedidoId: string) => {
    setSelectedOrderId((prev) => (prev === pedidoId ? null : pedidoId));
    setShowTooltip(null);
  };

  const canModifySelected = selectedOrder
    ? !['listo', 'entregado', 'cancelado'].includes(selectedOrder.estado)
    : false;

  const financialLabels: Record<EstadoFinanciero, string> = {
    por_cobrar: 'Por cobrar',
    por_confirmar_pago: 'Por confirmar pago',
    cobrado: 'Cobrado',
    pagado: 'Pagado a proveedor',
    cancelado: 'Cancelado',
  };

  const financialColors: Record<EstadoFinanciero, string> = {
    por_cobrar: '#F59E0B',
    por_confirmar_pago: '#f59e0b',
    cobrado: colors.success,
    pagado: colors.secondaryDark,
    cancelado: colors.error,
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
        pedido.estado === 'cancelado' ? colors.error :
        colors.secondary;

      const estadoFinanciero = resolvePedidoFinancialState(pedido);
      const estadoFinLabel = financialLabels[estadoFinanciero];
      const estadoFinColor = financialColors[estadoFinanciero] || colors.textSecondary;
      const isFinCancelado = estadoFinanciero === 'cancelado';
      const disableToCobrado = estadoFinanciero === 'cobrado' || estadoFinanciero === 'pagado' || isFinCancelado;
      const disableToPagado = estadoFinanciero === 'pagado' || isFinCancelado;

      const isSelected = pedido.id === selectedOrderId;
      return (
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.card, isSelected && styles.cardSelected]}
          onPress={() => handleSelectOrder(pedido.id)}
        >
          <View style={styles.cardHeaderCompact}>
            <View>
              <Text style={styles.cardTitleCompact}>{tituloPedido}</Text>
              <Text style={styles.cardSubText}>{formatFecha(pedido.fecha)} · {pedido.hora}</Text>
            </View>
            <View style={styles.badgesRowCompact}>
              <View style={[styles.estadoBadge, { backgroundColor: estadoColor }]}>
                <Text style={styles.estadoBadgeText}>{pedido.estado.toUpperCase()}</Text>
              </View>
              <View style={[styles.financeBadge, { borderColor: estadoFinColor }]}> 
                <Ionicons name="wallet-outline" size={14} color={estadoFinColor} />
                <Text style={[styles.financeBadgeText, { color: estadoFinColor }]}>{estadoFinLabel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.compactInfoRow}>
            <View style={styles.compactInfoItem}>
              <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.compactLabel}>Cliente</Text>
              <Text style={styles.compactValue} numberOfLines={1}>{clienteNombre}</Text>
            </View>
            <View style={styles.compactInfoItemCenter}>
              <Text style={styles.compactLabel}>Botellones</Text>
              <Text style={styles.compactValue}>{pedido.cantidadConAsa} con asa · {pedido.cantidadSinAsa} sin asa</Text>
            </View>
            <View style={styles.compactInfoItemEnd}>
              <Text style={styles.compactLabel}>Total</Text>
              <Text style={styles.compactValueStrong}>{formatCurrency(pedido.total)}</Text>
            </View>
          </View>

          <View style={styles.cardFooterCompact}>
            <TouchableOpacity
              style={[styles.chipButton, styles.chipGhost]}
              onPress={() => openDetailModal(pedido)}
            >
              <Ionicons name="eye-outline" size={14} color={colors.primary} />
              <Text style={[styles.chipButtonText, { color: colors.primary }]}>Ver detalle</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    }
  };

  // ===== Estado y handlers para cancelar pedido =====
  const [cancelOrderModalVisible, setCancelOrderModalVisible] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<Pedido | null>(null);

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Pedido | null>(null);
  const [showCobroForm, setShowCobroForm] = useState(false);
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [cobroForm, setCobroForm] = useState({
    metodo: 'pago_movil',
    ref: '',
    banco: '',
    monto: '',
  });
  const detailEstadoFinanciero = detailOrder ? resolvePedidoFinancialState(detailOrder) : null;
  const detailFinCancelado = detailEstadoFinanciero === 'cancelado';
  const detailDisableCobrado = detailEstadoFinanciero === 'cobrado' || detailEstadoFinanciero === 'pagado' || detailFinCancelado;
  const detailMostrarBotonListo = detailOrder?.estado === 'pendiente';
  const detailMostrarBotonEntregado = detailOrder?.estado === 'listo';

  useEffect(() => {
    if (!detailOrder) return;
    const updated = pedidos.find((p) => p.id === detailOrder.id);
    if (updated) {
      setDetailOrder(updated);
    }
  }, [pedidos, detailOrder?.id]);

  useEffect(() => {
    setShowCobroForm(false);
    setShowBankDropdown(false);
    setCobroForm({
      metodo: detailOrder?.metodoPago || 'pago_movil',
      ref: detailOrder?.refPagoUlt6 || '',
      banco: detailOrder?.bancoEmisor || '',
      monto: '',
    });
  }, [detailOrder?.id]);
  const handleCancelOrder = async () => {
    if (!orderToCancel) return;
    try {
      const pedidoRef = doc(db, 'Pedidos', orderToCancel.id);
      await updateDoc(pedidoRef, {
        estado: 'cancelado',
        estadoFinanciero: 'cancelado',
        montoCobrado: 0,
        montoPagado: 0,
        fechaCobrado: null,
        fechaPagado: null,
      });
      showMessage('Pedido cancelado', 'El pedido ha sido cancelado correctamente.');
      setCancelOrderModalVisible(false);
      setOrderToCancel(null);
      setSelectedOrderId(null);
    } catch (error) {
      showMessage('Error', 'No se pudo cancelar el pedido.');
    }
  };

  const handleSubmitCobro = async () => {
    if (!detailOrder) return;
    const montoNumber = Number(cobroForm.monto);
    if (!Number.isFinite(montoNumber) || montoNumber <= 0) {
      showMessage('Monto inválido', 'Ingresa un monto mayor a cero.');
      return;
    }
    try {
      const pedidoRef = doc(db, 'Pedidos', detailOrder.id);
      await updateDoc(pedidoRef, {
        estadoFinanciero: 'cobrado',
        montoCobrado: montoNumber,
        fechaCobrado: serverTimestamp(),
        fechaRefPago: serverTimestamp(),
        refPagoUlt6: cobroForm.ref.trim(),
        bancoEmisor: cobroForm.banco.trim(),
        metodoPago: cobroForm.metodo,
      });
      setShowCobroForm(false);
    } catch (error) {
      console.error('Error al registrar cobro:', error);
      showMessage('Error', 'No se pudo registrar el cobro.');
    }
  };

  const openDetailModal = (pedido: Pedido) => {
    setDetailOrder(pedido);
    setDetailModalVisible(true);
  };

  // ===== Estado y handlers para editar pedido =====
  const [editOrderModalVisible, setEditOrderModalVisible] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<Pedido | null>(null);
  const [editOrderForm, setEditOrderForm] = useState({
    cantidadConAsa: 0,
    cantidadSinAsa: 0,
    costoUnitario: 0,
    total: 0,
    estado: '',
    empleadoAsignadoId: '',
    observaciones: '',
    priority: 'normal',
    type: 'recarga',
  });
  const [editOrderErrors, setEditOrderErrors] = useState<EditOrderFormErrors>({});

  useEffect(() => {
    if (orderToEdit) {
      setEditOrderForm({
        cantidadConAsa: orderToEdit.cantidadConAsa,
        cantidadSinAsa: orderToEdit.cantidadSinAsa,
        costoUnitario: orderToEdit.costoUnitario,
        total: orderToEdit.total,
        estado: orderToEdit.estado,
        empleadoAsignadoId: orderToEdit.empleadoAsignadoId,
        observaciones: sanitizeCommentText(orderToEdit.observaciones || '').slice(0, MAX_COMMENT_LENGTH),
        priority: (orderToEdit as any).priority || 'normal',
        type: (orderToEdit as any).type || 'recarga',
      });
      setEditOrderErrors({});
    }
  }, [orderToEdit]);

  const clearEditError = (field: keyof EditOrderFormErrors) => {
    setEditOrderErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleEditOrderChange = (field: string, value: any) => {
    if (field === 'observaciones') {
      clearEditError('comentarios');
      const sanitized = sanitizeCommentText(String(value)).slice(0, MAX_COMMENT_LENGTH);
      setEditOrderForm((prev) => ({ ...prev, observaciones: sanitized }));
      return;
    }
    if (field === 'cantidadConAsa' || field === 'cantidadSinAsa') {
      clearEditError('cantidades');
    }
    if (field === 'estado') {
      clearEditError('estado');
    }
    if (field === 'costoUnitario' || field === 'total') {
      clearEditError('numericos');
    }
    setEditOrderForm((prev) => ({ ...prev, [field]: value }));
  };

  const validateEditOrderForm = (): boolean => {
    if (!orderToEdit) return false;

    const errors: EditOrderFormErrors = {};
    const cantidadesNegativas = editOrderForm.cantidadConAsa < 0 || editOrderForm.cantidadSinAsa < 0;
    const totalBotellones = editOrderForm.cantidadConAsa + editOrderForm.cantidadSinAsa;

    if (cantidadesNegativas || totalBotellones <= 0) {
      errors.cantidades = 'Las cantidades deben ser positivas y sumar al menos 1.';
    }

    const allowedEstados: Array<Pedido['estado']> = ['pendiente', 'listo', 'entregado', 'cancelado'];
    if (!allowedEstados.includes(editOrderForm.estado as Pedido['estado'])) {
      errors.estado = 'El estado debe ser pendiente, listo, entregado o cancelado.';
    }

    const costosInvalidos = !Number.isFinite(editOrderForm.costoUnitario) || editOrderForm.costoUnitario <= 0 ||
      !Number.isFinite(editOrderForm.total) || editOrderForm.total <= 0;
    if (costosInvalidos) {
      errors.numericos = 'Costo unitario y total deben ser números mayores a cero.';
    }

    if (editOrderForm.observaciones && editOrderForm.observaciones.length > MAX_COMMENT_LENGTH) {
      errors.comentarios = `Máximo ${MAX_COMMENT_LENGTH} caracteres en comentarios.`;
    }

    setEditOrderErrors(errors);

    if (Object.keys(errors).length > 0) {
      showMessage('Datos inválidos', 'Corrige los campos marcados antes de guardar.');
      return false;
    }

    return true;
  };

  const handleSaveEditOrder = async () => {
    if (!orderToEdit) return;
    if (!validateEditOrderForm()) {
      return;
    }
    try {
      const pedidoRef = doc(db, 'Pedidos', orderToEdit.id);
      await updateDoc(pedidoRef, {
        cantidadConAsa: editOrderForm.cantidadConAsa,
        cantidadSinAsa: editOrderForm.cantidadSinAsa,
        costoUnitario: editOrderForm.costoUnitario,
        total: editOrderForm.total,
        estado: editOrderForm.estado,
        empleadoAsignadoId: editOrderForm.empleadoAsignadoId,
        observaciones: sanitizeCommentText(editOrderForm.observaciones || '').slice(0, MAX_COMMENT_LENGTH),
        priority: editOrderForm.priority,
        type: editOrderForm.type,
        tipo: editOrderForm.type,
      });
      showMessage('Éxito', 'Pedido actualizado correctamente.');
      setEditOrderModalVisible(false);
      setOrderToEdit(null);
      setEditOrderErrors({});
    } catch (error) {
      showMessage('Error', 'No se pudo actualizar el pedido.');
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

  const headerActionButtons = (
    <>
      <TouchableOpacity style={styles.headerActionButton} onPress={openCreateOrderModal}>
        <Ionicons name="add" size={18} color={colors.textInverse} />
        <Text style={styles.headerActionText}>Crear Pedido</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.headerActionButton,
          styles.headerActionButtonSecondary,
          (!selectedOrder || !canModifySelected) && styles.headerActionButtonDisabled,
        ]}
        onPress={handleEditOrderAction}
        disabled={!selectedOrder || !canModifySelected}
      >
        <Ionicons name="create" size={18} color={colors.textInverse} />
        <Text style={styles.headerActionText}>Editar Pedido</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.headerActionButton,
          styles.headerActionButtonDanger,
          (!selectedOrder || !canModifySelected) && styles.headerActionButtonDisabled,
        ]}
        onPress={handleCancelOrderAction}
        disabled={!selectedOrder || !canModifySelected}
      >
        <Ionicons name="trash" size={18} color={colors.textInverse} />
        <Text style={styles.headerActionText}>Cancelar Pedido</Text>
      </TouchableOpacity>
    </>
  );

  // Render final
  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={colors.secondaryDark} barStyle="light-content" />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header DENTRO del ScrollView */}
        <LinearGradient
          colors={colors.gradientSecondary}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={[styles.headerContent, isSmallScreen && styles.headerContentStack]}>
            <View style={styles.headerTitleContainer}>
              <Ionicons name="receipt-outline" size={28} color={colors.textInverse} />
              <View>
                <Text style={styles.headerTitle}>Gestión de Pedidos</Text>
                <Text style={styles.headerSubtitle}>Panel de administración</Text>
              </View>
            </View>
            {isSmallScreen ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.headerActionsHorizontal}
              >
                {headerActionButtons}
              </ScrollView>
            ) : (
              <View style={styles.headerActions}>
                {headerActionButtons}
              </View>
            )}
          </View>
          <View style={styles.inventoryAlert}>
            {sellosCantidad < 200 && (
              <View style={styles.alertItem}>
                <Ionicons name="warning" size={16} color={colors.textInverse} />
                <Text style={styles.alertText}>Sellos: {sellosCantidad}</Text>
              </View>
            )}
            {tapasCantidad < 200 && (
              <View style={styles.alertItem}>
                <Ionicons name="warning" size={16} color={colors.textInverse} />
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
            contentContainerStyle={styles.statsRow}
          >
            {summaryCards.map((card) => {
              const highlight = isCardSelected(card.filter);
              return (
                <TouchableOpacity
                  key={card.key}
                  style={[styles.statCardWrapper, highlight && styles.statCardWrapperActive]}
                  activeOpacity={card.filter ? 0.85 : 1}
                  onPress={() => handleCardPress(card.filter)}
                  disabled={!card.filter}
                >
                  <LinearGradient
                    colors={card.colors}
                    style={[styles.statCard, highlight && styles.statCardActive, highlight && styles.statCardActivePadded]}
                  >
                    {highlight && (
                      <View style={styles.statBadgeActive}>
                        <Text style={styles.statBadgeActiveText}>Activo</Text>
                      </View>
                    )}
                    <Text style={styles.statNumber}>{card.value}</Text>
                    <Text style={styles.statLabel}>{card.label}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Buscador */}
          <View style={styles.controlsContainer}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por Nº de pedido o cliente..."
                value={searchText}
                onChangeText={(text) => setSearchText(sanitizeSearch(text))}
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>

          {/* Lista de Pedidos */}
          {listData.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyStateTitle}>No se encontraron pedidos</Text>
              <Text style={styles.emptyStateSubtitle}>
                {searchText || activeFilter.type !== 'all' 
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

      {/* Modal Detalle de Pedido */}
      <Modal visible={detailModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlayAdmin}>
          <View style={[styles.modalContentAdmin, { maxHeight: height * 0.9 }]}> 
            <Text style={styles.modalTitleAdmin}>Detalle del Pedido</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {detailOrder ? (
                <View style={{ gap: 12 }}>
                  <View style={styles.detailRow}> 
                    <Text style={styles.detailLabel}>Pedido</Text>
                    <Text style={styles.detailValue}>{detailOrder.numeroPedido ? `Nº ${formatOrderNumber(detailOrder.numeroPedido)}` : detailOrder.id}</Text>
                  </View>
                  <View style={styles.detailRow}> 
                    <Text style={styles.detailLabel}>Cliente</Text>
                    <Text style={styles.detailValue}>{(clientesMap[detailOrder.clienteId]?.nombre || 'Sin nombre').toUpperCase()}</Text>
                  </View>
                  <View style={styles.detailRow}> 
                    <Text style={styles.detailLabel}>Dirección</Text>
                    <Text style={styles.detailValue}>{(clientesMap[detailOrder.clienteId]?.direccion || 'Sin dirección').toUpperCase()}</Text>
                  </View>
                  <View style={styles.detailRow}> 
                    <Text style={styles.detailLabel}>Fecha</Text>
                    <Text style={styles.detailValue}>{formatFecha(detailOrder.fecha)} · {detailOrder.hora}</Text>
                  </View>
                  <View style={styles.detailRow}> 
                    <Text style={styles.detailLabel}>Botellones</Text>
                    <Text style={styles.detailValue}>{detailOrder.cantidadConAsa} con asa · {detailOrder.cantidadSinAsa} sin asa (total {detailOrder.cantidadConAsa + detailOrder.cantidadSinAsa})</Text>
                  </View>
                  <View style={styles.detailRow}> 
                    <Text style={styles.detailLabel}>Monto</Text>
                    <Text style={styles.detailValue}>{formatCurrency(detailOrder.total)}</Text>
                  </View>
                  <View style={styles.detailRow}> 
                    <Text style={styles.detailLabel}>Estado</Text>
                    <Text style={styles.detailValue}>{detailOrder.estado.toUpperCase()}</Text>
                  </View>
                  <View style={styles.detailRow}> 
                    <Text style={styles.detailLabel}>Finanzas</Text>
                    <Text style={styles.detailValue}>{financialLabels[resolvePedidoFinancialState(detailOrder)]}</Text>
                  </View>
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailBlockTitle}>Pago</Text>
                    <Text style={styles.detailValueSmall}>Ref: {detailOrder.refPagoUlt6 || 'N/D'}</Text>
                    <Text style={styles.detailValueSmall}>Banco: {detailOrder.bancoEmisor || 'N/D'}</Text>
                    <Text style={styles.detailValueSmall}>Monto pagado: {formatCurrency(detailOrder.montoPagado ?? 0)}</Text>
                    <Text style={styles.detailValueSmall}>Fecha ref: {formatTsDateTime(detailOrder.fechaRefPago)}</Text>
                  </View>
                  {detailOrder.observaciones ? (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailBlockTitle}>Notas</Text>
                      <Text style={styles.detailValueSmall}>{sanitizeCommentText(detailOrder.observaciones)}</Text>
                    </View>
                  ) : null}
                  {showCobroForm && (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailBlockTitle}>Registrar cobro</Text>
                      <View style={styles.detailFormRow}>
                        <Text style={styles.detailLabel}>Método</Text>
                        <View style={styles.detailFormPillRow}>
                          {['transferencia', 'pago_movil', 'efectivo'].map((m) => (
                            <TouchableOpacity
                              key={m}
                              style={[styles.detailFormPill, cobroForm.metodo === m && styles.detailFormPillActive]}
                              onPress={() => setCobroForm((prev) => ({ ...prev, metodo: m }))}
                            >
                              <Text style={[styles.detailFormPillText, cobroForm.metodo === m && styles.detailFormPillTextActive]}>{m === 'pago_movil' ? 'Pago móvil' : m.charAt(0).toUpperCase() + m.slice(1)}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                      {cobroForm.metodo !== 'efectivo' && (
                        <TextInput
                          style={styles.detailInput}
                          placeholder="Últimos 6 de la referencia"
                          placeholderTextColor={colors.textSecondary}
                          value={cobroForm.ref}
                          onChangeText={(t) => setCobroForm((prev) => ({ ...prev, ref: t }))}
                        />
                      )}
                      <View style={styles.detailFormRow}>
                        <Text style={styles.detailLabel}>Banco</Text>
                        <TouchableOpacity
                          style={styles.detailBankSelector}
                          onPress={() => setShowBankDropdown((prev) => !prev)}
                        >
                          <Text style={styles.detailBankSelectorText} numberOfLines={1}>
                            {cobroForm.banco || 'Selecciona un banco'}
                          </Text>
                          <Ionicons
                            name={showBankDropdown ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={colors.textSecondary}
                          />
                        </TouchableOpacity>
                        {showBankDropdown && (
                          <View style={styles.detailBankList}>
                            <ScrollView style={{ maxHeight: 200 }}>
                              {VE_BANKS.map((banco) => (
                                <TouchableOpacity
                                  key={banco.code}
                                  style={[styles.detailBankItem, cobroForm.banco === banco.name && styles.detailBankItemActive]}
                                  onPress={() => {
                                    setCobroForm((prev) => ({ ...prev, banco: banco.name }));
                                    setShowBankDropdown(false);
                                  }}
                                >
                                  <Text style={[styles.detailBankText, cobroForm.banco === banco.name && styles.detailBankTextActive]}>
                                    {banco.name}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        )}
                      </View>
                      <TextInput
                        style={styles.detailInput}
                        placeholder="Monto recibido"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="numeric"
                        value={cobroForm.monto}
                        onChangeText={(t) => setCobroForm((prev) => ({ ...prev, monto: t }))}
                      />
                      <View style={styles.detailFormActions}>
                        <TouchableOpacity
                          style={[styles.detailActionButton, styles.detailActionOutline]}
                          onPress={() => {
                            setShowCobroForm(false);
                            setShowBankDropdown(false);
                          }}
                        >
                          <Text style={styles.detailActionText}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.detailActionButton, styles.detailActionPrimary]} onPress={handleSubmitCobro}>
                          <Text style={[styles.detailActionText, { color: colors.textInverse }]}>Guardar cobro</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  <View style={styles.detailActionsRow}>
                    {detailMostrarBotonListo && detailOrder.estado !== 'cancelado' && (
                      <TouchableOpacity
                        style={[styles.detailActionButton, styles.detailActionSuccess]}
                        onPress={() => handleChangeEstado(detailOrder.id, 'listo')}
                      >
                        <Ionicons name="checkmark-circle-outline" size={16} color={colors.textInverse} />
                        <Text style={[styles.detailActionText, { color: colors.textInverse }]}>Marcar listo</Text>
                      </TouchableOpacity>
                    )}
                    {detailMostrarBotonEntregado && detailOrder.estado !== 'cancelado' && (
                      <TouchableOpacity
                        style={[styles.detailActionButton, styles.detailActionPrimary]}
                        onPress={() => handleChangeEstado(detailOrder.id, 'entregado')}
                      >
                        <Ionicons name="checkmark-done-outline" size={16} color={colors.textInverse} />
                        <Text style={[styles.detailActionText, { color: colors.textInverse }]}>Marcar entregado</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.detailActionButton, detailDisableCobrado ? styles.detailActionDisabled : styles.detailActionOutline]}
                      disabled={detailDisableCobrado}
                      onPress={() => setShowCobroForm((prev) => !prev)}
                    >
                      <Ionicons name="wallet-outline" size={16} color={detailDisableCobrado ? colors.textSecondary : colors.primary} />
                      <Text style={[styles.detailActionText, { color: detailDisableCobrado ? colors.textSecondary : colors.primary }]}>
                        {detailEstadoFinanciero === 'por_confirmar_pago' ? 'Confirmar pago' : 'Registrar cobro'}
                      </Text>
                    </TouchableOpacity>
                    {detailEstadoFinanciero === 'por_confirmar_pago' && (
                      <TouchableOpacity
                        style={[styles.detailActionButton, styles.detailActionDanger]}
                        onPress={() => handleRejectPayment(detailOrder.id)}
                      >
                        <Ionicons name="close-circle-outline" size={16} color={colors.textInverse} />
                        <Text style={[styles.detailActionText, { color: colors.textInverse }]}>Rechazar pago</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ) : (
                <Text style={{ color: colors.textSecondary }}>Sin datos</Text>
              )}
            </ScrollView>
            <TouchableOpacity style={[styles.button, styles.buttonListo, { marginTop: 12 }]} onPress={() => setDetailModalVisible(false)}>
              <Text style={styles.buttonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Crear Pedido */}
      <Modal visible={showCreateOrderModal} animationType="slide" transparent>
        <View style={styles.modalOverlayAdmin}>
          <View style={[styles.modalContentAdmin, { maxHeight: height * 0.9 }]}> 
            <Text style={styles.modalTitleAdmin}>Nuevo Pedido</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {/* Selector de Cliente */}
              <View style={styles.sectionAdmin}>
                <Text style={styles.sectionTitleAdmin}>Cliente</Text>
                <TextInput
                  style={styles.searchInputAdmin}
                  placeholder="Buscar por nombre, cédula, email o teléfono"
                  placeholderTextColor={colors.textSecondary}
                  value={clienteSearch}
                  onChangeText={(text) => setClienteSearch(sanitizeSearch(text))}
                />
                <ScrollView style={styles.clientesList} keyboardShouldPersistTaps="handled">
                  {filteredClientes.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.clienteItem,
                        selectedClienteId === c.id && styles.clienteItemSelected,
                      ]}
                      onPress={() => handleSelectCliente(c.id)}
                    >
                      <Ionicons name="person" size={16} color={colors.textSecondary} />
                      <Text style={styles.clienteItemText}>
                        {c.nombre || 'Sin nombre'}{c.cedula ? ` • ${c.cedula}` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={styles.registerClientButton}
                  onPress={() => {
                    closeCreateOrderModal();
                    navigation.navigate('Create', { userType: 'admin', openForm: true });
                  }}
                >
                  <Ionicons name="person-add" size={16} color={colors.primary} />
                  <Text style={styles.registerClientText}>Registrar nuevo cliente</Text>
                </TouchableOpacity>
                {orderFormErrors.cliente && (
                  <Text style={styles.errorText}>{orderFormErrors.cliente}</Text>
                )}
              </View>

              {/* Tipo de Servicio */}
              <View style={styles.sectionAdmin}>
                <Text style={styles.sectionTitleAdmin}>Tipo de Servicio</Text>
                <View style={styles.typeButtonsAdmin}>
                  <TouchableOpacity
                    style={[styles.typeButtonAdmin, orderForm.type === 'recarga' && styles.typeButtonActiveAdmin]}
                    onPress={() => handleOrderChange('type', 'recarga')}
                  >
                    <Text style={[styles.typeButtonTextAdmin, orderForm.type === 'recarga' && styles.typeButtonTextActiveAdmin]}>🔄 Recarga</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeButtonAdmin, orderForm.type === 'intercambio' && styles.typeButtonActiveAdmin]}
                    onPress={() => handleOrderChange('type', 'intercambio')}
                  >
                    <Text style={[styles.typeButtonTextAdmin, orderForm.type === 'intercambio' && styles.typeButtonTextActiveAdmin]}>💧 Intercambio</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Cantidades */}
              <View style={styles.sectionAdmin}>
                <Text style={styles.sectionTitleAdmin}>Cantidad de Botellones</Text>
                <View style={styles.quantityRowAdmin}>
                  <View style={styles.quantityCardAdmin}>
                    <Text style={styles.quantityTitleAdmin}>🫙 Con Asa</Text>
                    <View style={styles.quantityControlsAdmin}>
                      <TouchableOpacity style={styles.quantityButtonAdmin} onPress={() => decrement('withHandle')}>
                        <Text style={styles.quantityButtonTextAdmin}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.quantityValueAdmin}>{orderForm.withHandle}</Text>
                      <TouchableOpacity style={styles.quantityButtonAdmin} onPress={() => increment('withHandle')}>
                        <Text style={styles.quantityButtonTextAdmin}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.quantityCardAdmin}>
                    <Text style={styles.quantityTitleAdmin}>💧 Sin Asa</Text>
                    <View style={styles.quantityControlsAdmin}>
                      <TouchableOpacity style={styles.quantityButtonAdmin} onPress={() => decrement('withoutHandle')}>
                        <Text style={styles.quantityButtonTextAdmin}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.quantityValueAdmin}>{orderForm.withoutHandle}</Text>
                      <TouchableOpacity style={styles.quantityButtonAdmin} onPress={() => increment('withoutHandle')}>
                        <Text style={styles.quantityButtonTextAdmin}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                <Text style={styles.totalAdmin}>Total: {totalBottlesNew}</Text>
                {orderFormErrors.cantidades && (
                  <Text style={styles.errorText}>{orderFormErrors.cantidades}</Text>
                )}
                {orderFormErrors.inventario && (
                  <Text style={styles.errorText}>{orderFormErrors.inventario}</Text>
                )}
              </View>

              {/* Prioridad */}
              <View style={styles.sectionAdmin}>
                <Text style={styles.sectionTitleAdmin}>Prioridad</Text>
                <View style={styles.priorityRowAdmin}>
                  <TouchableOpacity
                    style={[styles.priorityButtonAdmin, orderForm.priority === 'normal' && styles.priorityButtonActiveAdmin]}
                    onPress={() => handleOrderChange('priority', 'normal')}
                  >
                    <Text style={styles.priorityTitleAdmin}>⏱️ Normal</Text>
                    <Text style={styles.priorityPriceAdmin}>{formatCurrency(basePrice * PRIORITY_MULTIPLIER.normal)} c/u</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.priorityButtonAdmin, orderForm.priority === 'alta' && styles.priorityButtonActiveAdmin]}
                    onPress={() => handleOrderChange('priority', 'alta')}
                  >
                    <Text style={styles.priorityTitleAdmin}>⚡ Alta</Text>
                    <Text style={styles.priorityPriceAdmin}>{formatCurrency(highPriceAvailable ? botellonPriceHigh! : basePrice * PRIORITY_MULTIPLIER.alta)} c/u</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Comentarios */}
              <View style={styles.sectionAdmin}>
                <Text style={styles.sectionTitleAdmin}>Comentarios</Text>
                <TextInput
                  style={styles.commentsInputAdmin}
                  placeholder="¿Alguna instrucción especial?"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={3}
                  value={orderForm.comments}
                  onChangeText={(t) => handleOrderChange('comments', t)}
                />
                <Text style={styles.helperText}>{orderForm.comments.length}/{MAX_COMMENT_LENGTH}</Text>
                {orderFormErrors.comentarios && (
                  <Text style={styles.errorText}>{orderFormErrors.comentarios}</Text>
                )}
              </View>

              {/* Resumen */}
              <View style={styles.summaryAdmin}>
                <Text style={styles.summaryTitleAdmin}>Resumen</Text>
                <View style={styles.summaryRowAdmin}>
                  <Text style={styles.summaryLabelAdmin}>Botellones:</Text>
                  <Text style={styles.summaryValueAdmin}>{totalBottlesNew}</Text>
                </View>
                <View style={styles.summaryRowAdmin}>
                  <Text style={styles.summaryLabelAdmin}>Costo unitario:</Text>
                  <Text style={styles.summaryValueAdmin}>{formatCurrency(costPerBottleNew)}</Text>
                </View>
                <View style={styles.summaryRowAdmin}>
                  <Text style={styles.summaryLabelAdmin}>Total:</Text>
                  <Text style={styles.summaryTotalAdmin}>{formatCurrency(totalPriceNew)}</Text>
                </View>
              </View>

              {/* Botones */}
              <View style={styles.modalButtonsAdmin}>
                <TouchableOpacity style={styles.modalButtonCancelAdmin} onPress={closeCreateOrderModal}>
                  <Text style={styles.modalButtonTextCancelAdmin}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButtonConfirmAdmin,
                    (totalBottlesNew === 0 || !selectedClienteId) && styles.modalButtonConfirmAdminInactive,
                  ]}
                  onPress={handleCreateOrderFromAdmin}
                  disabled={creatingOrder}
                >
                  {creatingOrder ? (
                    <ActivityIndicator color={colors.textInverse} />
                  ) : (
                    <Text style={styles.modalButtonTextConfirmAdmin}>Crear Pedido</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Cancelar Pedido */}
      <Modal visible={cancelOrderModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlayAdmin}>
          <View style={[styles.modalContentAdmin, { maxWidth: 350, alignSelf: 'center' }]}> 
            <Text style={styles.modalTitleAdmin}>Cancelar Pedido</Text>
            <Text style={{ marginVertical: 16, fontSize: 16, color: colors.textPrimary, textAlign: 'center' }}>
              ¿Estás seguro que deseas cancelar este pedido?
            </Text>
            <View style={styles.modalButtonsAdmin}>
              <TouchableOpacity style={styles.modalButtonCancelAdmin} onPress={() => { setCancelOrderModalVisible(false); setOrderToCancel(null); }}>
                <Text style={styles.modalButtonTextCancelAdmin}>No, volver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonConfirmAdmin} onPress={handleCancelOrder}>
                <Text style={styles.modalButtonTextConfirmAdmin}>Sí, cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Editar Pedido */}
      <Modal visible={editOrderModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlayAdmin}>
          <View style={[styles.modalContentAdmin, { maxHeight: height * 0.9 }]}> 
            <Text style={styles.modalTitleAdmin}>Editar Pedido</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {/* Cliente (solo lectura) */}
              <View style={styles.sectionAdmin}>
                <Text style={styles.sectionTitleAdmin}>Cliente</Text>
                <Text style={[styles.searchInputAdmin, { color: colors.textPrimary, backgroundColor: colors.grayShades[100] }]}>{orderToEdit ? (clientesMap[orderToEdit.clienteId]?.nombre || 'Sin nombre') : ''}</Text>
              </View>

              {/* Tipo de Servicio */}
              <View style={styles.sectionAdmin}>
                <Text style={styles.sectionTitleAdmin}>Tipo de Servicio</Text>
                <View style={styles.typeButtonsAdmin}>
                  <TouchableOpacity
                    style={[styles.typeButtonAdmin, editOrderForm.type === 'recarga' && styles.typeButtonActiveAdmin]}
                    onPress={() => handleEditOrderChange('type', 'recarga')}
                  >
                    <Text style={[styles.typeButtonTextAdmin, editOrderForm.type === 'recarga' && styles.typeButtonTextActiveAdmin]}>🔄 Recarga</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeButtonAdmin, editOrderForm.type === 'intercambio' && styles.typeButtonActiveAdmin]}
                    onPress={() => handleEditOrderChange('type', 'intercambio')}
                  >
                    <Text style={[styles.typeButtonTextAdmin, editOrderForm.type === 'intercambio' && styles.typeButtonTextActiveAdmin]}>💧 Intercambio</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Cantidades */}
              <View style={styles.sectionAdmin}>
                <Text style={styles.sectionTitleAdmin}>Cantidad de Botellones</Text>
                <View style={styles.quantityRowAdmin}>
                  <View style={styles.quantityCardAdmin}>
                    <Text style={styles.quantityTitleAdmin}>🫙 Con Asa</Text>
                    <View style={styles.quantityControlsAdmin}>
                      <TouchableOpacity style={styles.quantityButtonAdmin} onPress={() => handleEditOrderChange('cantidadConAsa', Math.max(0, editOrderForm.cantidadConAsa - 1))}>
                        <Text style={styles.quantityButtonTextAdmin}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.quantityValueAdmin}>{editOrderForm.cantidadConAsa}</Text>
                      <TouchableOpacity style={styles.quantityButtonAdmin} onPress={() => handleEditOrderChange('cantidadConAsa', editOrderForm.cantidadConAsa + 1)}>
                        <Text style={styles.quantityButtonTextAdmin}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.quantityCardAdmin}>
                    <Text style={styles.quantityTitleAdmin}>💧 Sin Asa</Text>
                    <View style={styles.quantityControlsAdmin}>
                      <TouchableOpacity style={styles.quantityButtonAdmin} onPress={() => handleEditOrderChange('cantidadSinAsa', Math.max(0, editOrderForm.cantidadSinAsa - 1))}>
                        <Text style={styles.quantityButtonTextAdmin}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.quantityValueAdmin}>{editOrderForm.cantidadSinAsa}</Text>
                      <TouchableOpacity style={styles.quantityButtonAdmin} onPress={() => handleEditOrderChange('cantidadSinAsa', editOrderForm.cantidadSinAsa + 1)}>
                        <Text style={styles.quantityButtonTextAdmin}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                <Text style={styles.totalAdmin}>Total: {editOrderForm.cantidadConAsa + editOrderForm.cantidadSinAsa}</Text>
                {editOrderErrors.cantidades && (
                  <Text style={styles.errorText}>{editOrderErrors.cantidades}</Text>
                )}
              </View>

              {/* Prioridad */}
              <View style={styles.sectionAdmin}>
                <Text style={styles.sectionTitleAdmin}>Prioridad</Text>
                <View style={styles.priorityRowAdmin}>
                  <TouchableOpacity
                    style={[styles.priorityButtonAdmin, editOrderForm.priority === 'normal' && styles.priorityButtonActiveAdmin]}
                    onPress={() => handleEditOrderChange('priority', 'normal')}
                  >
                    <Text style={styles.priorityTitleAdmin}>⏱️ Normal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.priorityButtonAdmin, editOrderForm.priority === 'alta' && styles.priorityButtonActiveAdmin]}
                    onPress={() => handleEditOrderChange('priority', 'alta')}
                  >
                    <Text style={styles.priorityTitleAdmin}>⚡ Alta</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Estado */}
              <View style={styles.sectionAdmin}>
                <Text style={styles.sectionTitleAdmin}>Estado</Text>
                <TextInput
                  style={styles.searchInputAdmin}
                  value={editOrderForm.estado}
                  onChangeText={(t) => handleEditOrderChange('estado', t)}
                  placeholder="pendiente, listo, entregado, cancelado..."
                />
                {editOrderErrors.estado && (
                  <Text style={styles.errorText}>{editOrderErrors.estado}</Text>
                )}
              </View>

              {/* Empleado asignado */}
              <View style={styles.sectionAdmin}>
                <Text style={styles.sectionTitleAdmin}>Empleado asignado</Text>
                <TextInput
                  style={styles.searchInputAdmin}
                  value={editOrderForm.empleadoAsignadoId}
                  onChangeText={(t) => handleEditOrderChange('empleadoAsignadoId', t)}
                  placeholder="ID empleado"
                />
              </View>

              {/* Comentarios */}
              <View style={styles.sectionAdmin}>
                <Text style={styles.sectionTitleAdmin}>Comentarios</Text>
                <TextInput
                  style={styles.commentsInputAdmin}
                  placeholder="¿Alguna instrucción especial?"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={3}
                  value={editOrderForm.observaciones}
                  onChangeText={(t) => handleEditOrderChange('observaciones', t)}
                />
                <Text style={styles.helperText}>{(editOrderForm.observaciones || '').length}/{MAX_COMMENT_LENGTH}</Text>
                {editOrderErrors.comentarios && (
                  <Text style={styles.errorText}>{editOrderErrors.comentarios}</Text>
                )}
              </View>

              {/* Resumen */}
              <View style={styles.summaryAdmin}>
                <Text style={styles.summaryTitleAdmin}>Resumen</Text>
                <View style={styles.summaryRowAdmin}>
                  <Text style={styles.summaryLabelAdmin}>Botellones:</Text>
                  <Text style={styles.summaryValueAdmin}>{editOrderForm.cantidadConAsa + editOrderForm.cantidadSinAsa}</Text>
                </View>
                <View style={styles.summaryRowAdmin}>
                  <Text style={styles.summaryLabelAdmin}>Costo unitario:</Text>
                  <TextInput
                    style={styles.summaryValueAdmin}
                    value={editOrderForm.costoUnitario.toString()}
                    onChangeText={(t) => handleEditOrderChange('costoUnitario', Number(t))}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.summaryRowAdmin}>
                  <Text style={styles.summaryLabelAdmin}>Total:</Text>
                  <TextInput
                    style={styles.summaryTotalAdmin}
                    value={editOrderForm.total.toString()}
                    onChangeText={(t) => handleEditOrderChange('total', Number(t))}
                    keyboardType="numeric"
                  />
                </View>
                {editOrderErrors.numericos && (
                  <Text style={styles.errorText}>{editOrderErrors.numericos}</Text>
                )}
              </View>

              {/* Botones */}
              <View style={styles.modalButtonsAdmin}>
                <TouchableOpacity
                  style={styles.modalButtonCancelAdmin}
                  onPress={() => {
                    setEditOrderModalVisible(false);
                    setOrderToEdit(null);
                    setEditOrderErrors({});
                  }}
                >
                  <Text style={styles.modalButtonTextCancelAdmin}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButtonConfirmAdmin} onPress={handleSaveEditOrder}>
                  <Text style={styles.modalButtonTextConfirmAdmin}>Guardar Cambios</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerContentStack: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textInverse,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  headerActionsHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  headerActionsStack: {
    width: '100%',
    justifyContent: 'flex-start',
  },
  headerActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    flexShrink: 1,
  },
  headerActionButtonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  headerActionButtonDanger: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  headerActionButtonDisabled: {
    opacity: 0.45,
  },
  headerActionText: {
    color: colors.textInverse,
    fontWeight: '600',
    marginLeft: 6,
    flexShrink: 1,
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
    color: colors.textInverse,
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  statsContainer: {
    marginTop: 0,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  statsRow: {
    paddingRight: 16,
  },
  statCardWrapper: {
    marginRight: 10,
    flexGrow: 0,
    position: 'relative',
  },
  statCardWrapperActive: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    transform: [{ translateY: -2 }],
  },
  statCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    minWidth: 100,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  statCardActive: {
    borderColor: 'rgba(255,255,255,0.9)',
    borderWidth: 2,
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  statCardActivePadded: {
    paddingTop: 26,
  },
  statBadgeActive: {
    position: 'absolute',
    top: -6,
    left: -6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statBadgeActiveText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textInverse,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
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
  listContent: {
    paddingBottom: 20,
  },
  headerContainer: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
  },
  headerTextFecha: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.secondary,
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
  cardSelected: {
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  // Compact card layout
  cardHeaderCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayShades[50],
  },
  cardTitleCompact: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardSubText: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textSecondary,
  },
  badgesRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    color: colors.textInverse,
  },
  cardBody: {
    padding: 16,
  },
  compactInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.grayShades[50],
  },
  compactInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactInfoItemCenter: {
    flex: 1.2,
    gap: 4,
  },
  compactInfoItemEnd: {
    flex: 0.9,
    alignItems: 'flex-end',
    gap: 4,
  },
  compactLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  compactValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  compactValueStrong: {
    fontSize: 16,
    color: colors.success,
    fontWeight: '700',
  },
  cardFooterCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.grayShades[50],
  },
  footerActionsCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  chipGhost: {
    backgroundColor: 'transparent',
    borderColor: colors.primary,
  },
  chipPrimary: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  chipSuccess: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  chipOutline: {
    borderColor: colors.primary,
  },
  chipDanger: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  chipDisabled: {
    opacity: 0.55,
    borderColor: colors.border,
  },
  chipTextPrimary: {
    color: colors.primary,
  },
  chipTextDisabled: {
    color: colors.textSecondary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  // Detail modal styles
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  detailLabel: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  detailValue: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
  },
  detailBlock: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 4,
  },
  detailBlockTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  detailValueSmall: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  detailActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  detailActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  detailActionText: {
    fontWeight: '600',
    fontSize: 14,
    color: colors.textPrimary,
  },
  detailActionOutline: {
    borderColor: colors.primary,
  },
  detailActionPrimary: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  detailActionSuccess: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  detailActionDanger: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  detailActionDisabled: {
    opacity: 0.55,
  },
  detailFormRow: {
    marginBottom: 8,
  },
  detailFormPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  detailFormPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  detailFormPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.secondaryLight,
  },
  detailFormPillText: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  detailFormPillTextActive: {
    color: colors.secondaryDark,
  },
  detailInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  detailBankSelector: {
    marginTop: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailBankSelectorText: {
    flex: 1,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  detailBankList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.background,
    marginTop: 6,
    marginBottom: 8,
  },
  detailBankItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  detailBankItemActive: {
    backgroundColor: colors.secondaryLight,
  },
  detailBankText: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  detailBankTextActive: {
    color: colors.secondaryDark,
    fontWeight: '700',
  },
  detailFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
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
    color: colors.secondary,
  },
  totalQuantity: {
    color: colors.success,
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
    color: colors.success,
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
    color: colors.warning,
    marginLeft: 6,
    flex: 1,
  },
  financeSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  financeSummaryItem: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  financeSummaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
    fontWeight: '600',
  },
  financeSummaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  financeStateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  financeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: colors.background,
  },
  financeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  financeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  financeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  financeButtonActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  confirmPaymentButton: {
    backgroundColor: '#fef3c7',
    borderColor: colors.warning,
  },
  financeButtonDisabled: {
    opacity: 0.5,
  },
  financeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  financeButtonTextActive: {
    color: colors.textInverse,
  },
  financeButtonTextDisabled: {
    color: colors.textSecondary,
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
    backgroundColor: colors.success,
  },
  buttonEntregado: {
    backgroundColor: colors.secondaryDark,
  },
  buttonText: {
    color: colors.textInverse,
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
    color: colors.textInverse,
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
    color: colors.warning,
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
  modalOverlayAdmin: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContentAdmin: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 500,
  },
  modalTitleAdmin: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionAdmin: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  sectionTitleAdmin: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  searchInputAdmin: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  clientesList: {
    maxHeight: 160,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 6,
  },
  clienteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  clienteItemSelected: {
    backgroundColor: colors.secondaryLight,
  },
  clienteItemText: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  registerClientButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  registerClientText: {
    color: colors.primary,
    fontWeight: '600',
  },
  typeButtonsAdmin: {
    flexDirection: 'row',
    gap: 10,
  },
  typeButtonAdmin: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeButtonActiveAdmin: {
    backgroundColor: colors.secondaryLight,
    borderColor: colors.secondary,
  },
  typeButtonTextAdmin: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  typeButtonTextActiveAdmin: {
    color: colors.secondaryDark,
  },
  quantityRowAdmin: {
    flexDirection: 'row',
    gap: 10,
  },
  quantityCardAdmin: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
  },
  quantityTitleAdmin: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 8,
  },
  quantityControlsAdmin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  quantityButtonAdmin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonTextAdmin: {
    color: colors.textInverse,
    fontSize: 18,
    fontWeight: 'bold',
  },
  quantityValueAdmin: {
    color: colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 18,
  },
  totalAdmin: {
    marginTop: 8,
    textAlign: 'center',
    color: colors.textSecondary,
    fontWeight: '600',
  },
  priorityRowAdmin: {
    flexDirection: 'row',
    gap: 10,
  },
  priorityButtonAdmin: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  priorityButtonActiveAdmin: {
    backgroundColor: '#fef3c7',
    borderColor: colors.warning,
  },
  priorityTitleAdmin: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 4,
  },
  priorityPriceAdmin: {
    color: colors.primary,
    fontWeight: '600',
  },
  commentsInputAdmin: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: colors.background,
  },
  helperText: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  errorText: {
    marginTop: 4,
    fontSize: 13,
    color: colors.error,
  },
  summaryAdmin: {
    backgroundColor: colors.textPrimary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  summaryTitleAdmin: {
    color: colors.textInverse,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  summaryRowAdmin: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabelAdmin: {
    color: colors.grayShades[100],
  },
  summaryValueAdmin: {
    color: colors.textInverse,
    fontWeight: '500',
  },
  summaryTotalAdmin: {
    color: colors.success,
    fontWeight: 'bold',
    fontSize: 18,
  },
  modalButtonsAdmin: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  modalButtonCancelAdmin: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.grayShades[50],
    alignItems: 'center',
  },
  modalButtonConfirmAdmin: {
    flex: 2,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  modalButtonConfirmAdminInactive: {
    opacity: 0.8,
  },
  modalButtonTextCancelAdmin: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalButtonTextConfirmAdmin: {
    color: colors.textInverse,
    fontWeight: 'bold',
  },
});

export default OrdersAdminScreen;