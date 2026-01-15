import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { db } from '../../firebaseConfig';
import {
  collection,
  onSnapshot,
} from 'firebase/firestore';
import { colors } from '../styles/globalStyles';
import { getBcvUsdRate } from '../utils/getBcvRate';

// Definición de interfaces
type FinancialState = 'por_cobrar' | 'cobrado' | 'pagado' | 'cancelado';

interface Order {
  id: string;
  total?: number;
  estado?: string;
  tipo?: string;
  type?: string;
  fecha?: string; // ISO YYYY-MM-DD
  clienteId?: string;
  estadoFinanciero?: FinancialState;
  montoCobrado?: number;
  montoPagado?: number;
  fechaCobrado?: any;
  fechaPagado?: any;
}

type Client = { id?: string; [key: string]: any };
type User = { id?: string; [key: string]: any };

interface Stats {
  totalRevenue: number;
  pipelineRevenue: number;
  totalOrders: number;
  totalClients: number;
  clientsWithOrders: number;
  chargedClients: number;
  totalUsers: number;
  completionRate: number;
  ordersByType: Record<string, number>;
  pendientes: number;
  listos: number;
  entregados: number;
  cancelados: number;
  avgTicket: number;
  avgPerClient: number;
  financeTotals: Record<FinancialState, number>;
  financeCounts: Record<FinancialState, number>;
  netCashFlow: number;
}

interface Comparisons {
  totalRevenue: number;
  totalOrders: number;
  clientsWithOrders: number;
  completionRate: number;
  avgTicket: number;
}

const StatsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('month');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [ordersRaw, setOrdersRaw] = useState<Order[]>([]);
  const [clientsRaw, setClientsRaw] = useState<Client[]>([]);
  const [usersRaw, setUsersRaw] = useState<User[]>([]);
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [dateField, setDateField] = useState<'fecha' | 'createdAt'>('fecha');
  const [displayCurrency, setDisplayCurrency] = useState<'VES' | 'USD'>('VES');
  const [bcvRate, setBcvRate] = useState<number | null>(null);
  const [bcvDate, setBcvDate] = useState<string | undefined>(undefined);
  const [showDateFieldHelp, setShowDateFieldHelp] = useState(false);
  const [showRateTooltip, setShowRateTooltip] = useState(false);
  const [comparisons, setComparisons] = useState<Comparisons>({
    totalRevenue: 0,
    totalOrders: 0,
    clientsWithOrders: 0,
    completionRate: 0,
    avgTicket: 0,
  });
  
  // Estados simplificados
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    pipelineRevenue: 0,
    totalOrders: 0,
    totalClients: 0,
    clientsWithOrders: 0,
    chargedClients: 0,
    totalUsers: 0,
    completionRate: 0,
    ordersByType: { intercambio: 0, recarga: 0 },
    pendientes: 0,
    listos: 0,
    entregados: 0,
    cancelados: 0,
    avgTicket: 0,
    avgPerClient: 0,
    financeTotals: {
      por_cobrar: 0,
      cobrado: 0,
      pagado: 0,
      cancelado: 0,
    },
    financeCounts: {
      por_cobrar: 0,
      cobrado: 0,
      pagado: 0,
      cancelado: 0,
    },
    netCashFlow: 0,
  });

  useEffect(() => {
    setLoading(true);

    const ordersRef = collection(db, 'Pedidos');
    const clientsRef = collection(db, 'Clientes');
    const usersRef = collection(db, 'usuarios');

    let ordersReady = false;
    let clientsReady = false;
    let usersReady = false;

    const checkReady = () => {
      if (ordersReady && clientsReady && usersReady) {
        setLoading(false);
      }
    };

    const unsubOrders = onSnapshot(
      ordersRef,
      (snapshot) => {
        const ordersData: Order[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setOrdersRaw(ordersData);
        ordersReady = true;
        setLastUpdated(new Date());
        checkReady();
      },
      (error) => {
        console.error('Error en pedidos:', error);
        Alert.alert('Error', `No se pudieron cargar los pedidos: ${(error as Error).message}`);
        ordersReady = true;
        checkReady();
      }
    );

    const unsubClients = onSnapshot(
      clientsRef,
      (snapshot) => {
        const clientsData: Client[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setClientsRaw(clientsData);
        clientsReady = true;
        checkReady();
      },
      (error) => {
        console.error('Error en clientes:', error);
        Alert.alert('Error', `No se pudieron cargar los clientes: ${(error as Error).message}`);
        clientsReady = true;
        checkReady();
      }
    );

    const unsubUsers = onSnapshot(
      usersRef,
      (snapshot) => {
        const usersData: User[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setUsersRaw(usersData);
        usersReady = true;
        checkReady();
      },
      (error) => {
        console.error('Error en usuarios:', error);
        Alert.alert('Error', `No se pudieron cargar los usuarios: ${(error as Error).message}`);
        usersReady = true;
        checkReady();
      }
    );

    return () => {
      unsubOrders();
      unsubClients();
      unsubUsers();
    };
  }, []);

  const refreshBcvRate = async () => {
    try {
      const { rate, date } = await getBcvUsdRate();
      setBcvRate(rate ?? null);
      setBcvDate(date);
    } catch (err) {
      console.error('Error al actualizar la tasa BCV:', err);
      setBcvRate(null);
      setBcvDate(undefined);
    }
  };

  useEffect(() => {
    refreshBcvRate();
  }, []);

  useEffect(() => {
    const newStats = buildStats(ordersRaw, clientsRaw, usersRaw, timeRange, dateField, startDateInput, endDateInput);
    setStats(newStats);

    const { prevStart, prevEnd } = getPreviousWindow(timeRange, startDateInput, endDateInput);
    const prevStats = buildStats(
      ordersRaw,
      clientsRaw,
      usersRaw,
      timeRange,
      dateField,
      formatDateISO(prevStart),
      formatDateISO(prevEnd),
    );

    setComparisons({
      totalRevenue: calcDelta(newStats.totalRevenue, prevStats.totalRevenue),
      totalOrders: calcDelta(newStats.totalOrders, prevStats.totalOrders),
      clientsWithOrders: calcDelta(newStats.clientsWithOrders, prevStats.clientsWithOrders),
      completionRate: calcDelta(newStats.completionRate, prevStats.completionRate),
      avgTicket: calcDelta(newStats.avgTicket, prevStats.avgTicket),
    });
  }, [ordersRaw, clientsRaw, usersRaw, timeRange, dateField, startDateInput, endDateInput]);

  const onRefresh = () => {
    setRefreshing(true);
    refreshBcvRate()
      .finally(() => {
        setLastUpdated(new Date());
        setRefreshing(false);
      });
  };

  const formatMoney = (amount: number, currency: 'VES' | 'USD') => {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDisplayMoney = (amountBs: number) => {
    if (displayCurrency === 'VES') return formatMoney(amountBs, 'VES');
    if (bcvRate) return formatMoney(amountBs / bcvRate, 'USD');
    return `USD (sin tasa) ${(amountBs).toFixed(2)}`;
  };

  const getDateFromOrder = (order: Order, field: 'fecha' | 'createdAt') => {
    if (field === 'fecha') {
      if (!order.fecha) return null;
      const d = new Date(`${order.fecha}T00:00:00`);
      return isNaN(d.getTime()) ? null : d;
    }
    const createdAt: any = (order as any).createdAt;
    if (createdAt?.toDate) return createdAt.toDate();
    if (createdAt?.seconds) return new Date(createdAt.seconds * 1000);
    return null;
  };

  const parseInputDate = (value: string) => {
    if (!value) return null;
    const d = new Date(`${value}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  };

  const resolveRangeWindow = (range: string, startInput?: string, endInput?: string) => {
    const now = new Date();
    let start = new Date(now);
    if (range === 'day') {
      start.setHours(0, 0, 0, 0);
    } else if (range === 'week') {
      start.setDate(start.getDate() - 7);
    } else if (range === 'month') {
      start.setDate(start.getDate() - 30);
    } else if (range === 'year') {
      start.setFullYear(start.getFullYear() - 1);
    }

    const startCustom = parseInputDate(startInput || '');
    const endCustom = parseInputDate(endInput || '');
    const effectiveStart = startCustom || start;
    const effectiveEnd = endCustom || now;
    return { effectiveStart, effectiveEnd };
  };

  const getPreviousWindow = (range: string, startInput?: string, endInput?: string) => {
    const { effectiveStart, effectiveEnd } = resolveRangeWindow(range, startInput, endInput);
    const span = effectiveEnd.getTime() - effectiveStart.getTime();
    const prevEnd = new Date(effectiveStart.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - span);
    return { prevStart, prevEnd };
  };

  const formatDateISO = (d: Date) => d.toISOString().split('T')[0];

  const calcDelta = (current: number, previous: number) => {
    if (previous === 0) return current === 0 ? 0 : 100;
    return ((current - previous) / previous) * 100;
  };

  const formatDelta = (delta: number) => {
    const sign = delta > 0 ? '↗️' : delta < 0 ? '↘️' : '→';
    return `${sign} ${delta.toFixed(1)}%`;
  };

  const filterOrdersByRange = (
    orders: Order[],
    range: string,
    field: 'fecha' | 'createdAt',
    startInput?: string,
    endInput?: string,
  ) => {
    const { effectiveStart, effectiveEnd } = resolveRangeWindow(range, startInput, endInput);

    return orders.filter((order) => {
      const d = getDateFromOrder(order, field);
      if (!d) return true; // si no hay fecha, no filtramos
      return d >= effectiveStart && d <= effectiveEnd;
    });
  };

  const buildStats = (
    orders: Order[],
    clients: Client[],
    users: User[],
    range: string,
    field: 'fecha' | 'createdAt',
    startInput?: string,
    endInput?: string,
  ): Stats => {
    const filteredOrders = filterOrdersByRange(orders, range, field, startInput, endInput);
    const totalOrders = filteredOrders.length;

    const pendientes = filteredOrders.filter((o) => o.estado === 'pendiente').length;
    const listos = filteredOrders.filter((o) => o.estado === 'listo').length;
    const entregados = filteredOrders.filter((o) => o.estado === 'entregado').length;
    const cancelados = filteredOrders.filter((o) => o.estado === 'cancelado').length;

    const completionRate = totalOrders > 0 ? ((listos + entregados) / totalOrders) * 100 : 0;

    const ordersByType = filteredOrders.reduce((acc: Record<string, number>, order) => {
      const rawType = ((order as any).type ?? order.tipo ?? '').toString();
      const normalizedType = rawType.trim().toLowerCase();
      const key = normalizedType.includes('inter') ? 'intercambio' : 'recarga';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, { recarga: 0, intercambio: 0 });

    const financeTotals: Record<FinancialState, number> = {
      por_cobrar: 0,
      cobrado: 0,
      pagado: 0,
      cancelado: 0,
    };
    const financeCounts: Record<FinancialState, number> = {
      por_cobrar: 0,
      cobrado: 0,
      pagado: 0,
      cancelado: 0,
    };

    let totalRevenue = 0; // efectivo cobrado
    let pipelineRevenue = 0; // potencial pendiente

    const chargedClientSet = new Set<string>();
    const clientsSet = new Set(
      filteredOrders.map((o) => (o as any).clienteId).filter(Boolean)
    );

    filteredOrders.forEach((order) => {
      const baseAmount = order.total || 0;
      const montoCobrado = order.montoCobrado ?? baseAmount;
      const montoPagado = order.montoPagado ?? 0;
      let financialState: FinancialState = order.estadoFinanciero || 'por_cobrar';

      if (!order.estadoFinanciero && order.estado === 'cancelado') {
        financialState = 'cancelado';
      }

      financeCounts[financialState] = (financeCounts[financialState] || 0) + 1;

      switch (financialState) {
        case 'por_cobrar':
          financeTotals.por_cobrar += baseAmount;
          pipelineRevenue += baseAmount;
          break;
        case 'cobrado':
          financeTotals.cobrado += montoCobrado;
          totalRevenue += montoCobrado;
          if (order.clienteId) chargedClientSet.add(order.clienteId);
          break;
        case 'pagado':
          financeTotals.cobrado += montoCobrado;
          financeTotals.pagado += montoPagado || montoCobrado;
          totalRevenue += montoCobrado;
          if (order.clienteId) chargedClientSet.add(order.clienteId);
          break;
        case 'cancelado':
          financeTotals.cancelado += baseAmount;
          break;
        default:
          financeTotals.por_cobrar += baseAmount;
          pipelineRevenue += baseAmount;
          break;
      }
    });

    const chargedOrders = financeCounts.cobrado + financeCounts.pagado;
    const avgTicket = chargedOrders > 0 ? totalRevenue / chargedOrders : 0;

    const clientsWithOrders = clientsSet.size;
    const chargedClients = chargedClientSet.size;
    const avgPerClient = chargedClients > 0 ? totalRevenue / chargedClients : 0;

    const netCashFlow = financeTotals.cobrado - financeTotals.pagado;

    return {
      totalRevenue,
      pipelineRevenue,
      totalOrders,
      totalClients: clients.length,
      clientsWithOrders,
      chargedClients,
      totalUsers: users.length,
      completionRate,
      ordersByType,
      pendientes,
      listos,
      entregados,
      cancelados,
      avgTicket,
      avgPerClient,
      financeTotals,
      financeCounts,
      netCashFlow,
    };
  };

  // Componentes de gráficos simplificados
  const SimpleBarChart = ({ data, onBarPress }: { data: { label: string; value: number }[]; onBarPress?: (label: string) => void }) => {
    const maxValue = Math.max(...data.map(item => item.value), 1);
    
    return (
      <View style={styles.chartContainer}>
        {data.map((item, index) => (
          <TouchableOpacity key={index} style={styles.barItem} activeOpacity={0.7} onPress={() => onBarPress && onBarPress(item.label)}>
            <View style={styles.barLabelContainer}>
              <Text style={styles.barLabel}>{item.label}</Text>
              <Text style={styles.barValue}>{item.value}</Text>
            </View>
            <View style={styles.barBackground}>
              <View 
                style={[
                  styles.barFill,
                  { width: `${(item.value / maxValue) * 100}%` }
                ]} 
              />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const getRangeLabel = (range: string) => {
    switch (range) {
      case 'day': return 'Hoy';
      case 'week': return 'Últimos 7 días';
      case 'month': return 'Últimos 30 días';
      case 'year': return 'Último año';
      default: return 'Periodo';
    }
  };

  const rangeLabel = getRangeLabel(timeRange);
  const updatedText = lastUpdated ? lastUpdated.toLocaleString() : 'N/D';

  const rateInfo = bcvRate ? `${bcvRate.toFixed(2)} Bs/USD` : 'N/D';

  const ordersByTypeData = [
    { label: 'Intercambio', value: stats.ordersByType.intercambio || 0 },
    { label: 'Recarga', value: stats.ordersByType.recarga || 0 },
  ];
  const typeColorMap: Record<string, string> = {
    Intercambio: colors.primary,
    Recarga: colors.secondary,
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando estadísticas...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.primary]}
        />
      }
    >
      {/* Header */}
      <LinearGradient
        colors={colors.gradientPrimary}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Estadísticas</Text>
            <Text style={styles.headerSubtitle}>Dashboard Analítico</Text>
          </View>
          <View style={styles.headerStats}>
            <Text style={styles.headerStat}>
              {stats.totalOrders} pedidos • {formatDisplayMoney(stats.totalRevenue)}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Filtros de Tiempo */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
      >
        {['day', 'week', 'month', 'year'].map((range) => (
          <TouchableOpacity
            key={range}
            style={[
              styles.filterButton,
              timeRange === range && styles.filterButtonActive
            ]}
            onPress={() => setTimeRange(range)}
          >
            <Text style={[
              styles.filterButtonText,
              timeRange === range && styles.filterButtonTextActive
            ]}>
              {range === 'day' && 'Hoy'}
              {range === 'week' && 'Semana'}
              {range === 'month' && 'Mes'}
              {range === 'year' && 'Año'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.rangeInfo}>
        <Text style={styles.rangeText}>Rango: {rangeLabel}</Text>
        <Text style={styles.rangeText}>Actualizado: {updatedText}</Text>
      </View>

      <View style={styles.rangeInfo}>
        <View style={styles.currencyToggleContainer}>
          <TouchableOpacity
            style={[styles.currencyButton, displayCurrency === 'VES' && styles.currencyButtonActive]}
            onPress={() => setDisplayCurrency('VES')}
          >
            <Text style={[styles.currencyText, displayCurrency === 'VES' && styles.currencyTextActive]}>Bs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.currencyButton, displayCurrency === 'USD' && styles.currencyButtonActive]}
            onPress={() => setDisplayCurrency('USD')}
          >
            <Text style={[styles.currencyText, displayCurrency === 'USD' && styles.currencyTextActive]}>USD</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.rateTooltipContainer}>
          <Pressable
            onPress={refreshBcvRate}
            onHoverIn={() => setShowRateTooltip(true)}
            onHoverOut={() => setShowRateTooltip(false)}
            style={styles.ratePressable}
          >
            <Text style={styles.rangeText}>Tasa BCV: {rateInfo}</Text>
          </Pressable>
          {showRateTooltip && (
            <View style={styles.tooltipBubble}>
              <Text style={styles.tooltipText}>Haz clic aquí para actualizar</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.dateInputsContainer}>
        <View style={styles.dateInputGroup}>
          <Text style={styles.dateLabel}>Desde (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.dateInput}
            value={startDateInput}
            onChangeText={setStartDateInput}
            placeholder="2025-01-01"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
        <View style={styles.dateInputGroup}>
          <Text style={styles.dateLabel}>Hasta (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.dateInput}
            value={endDateInput}
            onChangeText={setEndDateInput}
            placeholder="2025-12-31"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      </View>

      <View style={styles.rangeInfoColumn}>
        <View style={styles.rangeInfoHeader}>
          <Text style={styles.rangeText}>Campo de fecha</Text>
          <Pressable onPress={() => setShowDateFieldHelp((prev) => !prev)} style={styles.helpIconButton}>
            <Ionicons name="help-circle-outline" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
        {showDateFieldHelp && (
          <Text style={styles.helpText}>
            "Fecha del pedido" usa la fecha ingresada manualmente en cada orden. "Fecha de registro" se basa en el
            sello de creación en Firebase. Cambia esta opción para que los filtros coincidan con tu flujo de trabajo.
          </Text>
        )}
        <View style={styles.dateFieldToggle}>
          <TouchableOpacity
            style={[styles.dateFieldButton, dateField === 'fecha' && styles.dateFieldButtonActive]}
            onPress={() => setDateField('fecha')}
          >
            <Text style={[styles.dateFieldText, dateField === 'fecha' && styles.dateFieldTextActive]}>Fecha del pedido</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dateFieldButton, dateField === 'createdAt' && styles.dateFieldButtonActive]}
            onPress={() => setDateField('createdAt')}
          >
            <Text style={[styles.dateFieldText, dateField === 'createdAt' && styles.dateFieldTextActive]}>Fecha de registro</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statusPillsContainer}>
        <View style={[styles.statusPill, { backgroundColor: '#FEF9C3' }]}>
          <Text style={[styles.statusPillLabel, { color: colors.warning }]}>Pendientes</Text>
          <Text style={[styles.statusPillValue, { color: colors.warning }]}>{stats.pendientes}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: '#DCFCE7' }]}>
          <Text style={[styles.statusPillLabel, { color: colors.success }]}>Listos</Text>
          <Text style={[styles.statusPillValue, { color: colors.success }]}>{stats.listos}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: '#DBEAFE' }]}>
          <Text style={[styles.statusPillLabel, { color: colors.secondaryDark }]}>Entregados</Text>
          <Text style={[styles.statusPillValue, { color: colors.secondaryDark }]}>{stats.entregados}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: '#F3F4F6' }]}>
          <Text style={[styles.statusPillLabel, { color: colors.grayShades[700] }]}>Cancelados</Text>
          <Text style={[styles.statusPillValue, { color: colors.grayShades[700] }]}>{stats.cancelados}</Text>
        </View>
      </View>

      {/* Estado Financiero */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estado Financiero</Text>
        <View style={styles.financeGrid}>
          <View style={[styles.financeCard, styles.financeCardWarning]}>
            <Text style={styles.financeLabel}>Por cobrar</Text>
            <Text style={styles.financeAmount}>{formatDisplayMoney(stats.financeTotals.por_cobrar)}</Text>
            <Text style={styles.financeMeta}>{stats.financeCounts.por_cobrar} pedidos</Text>
          </View>
          <View style={[styles.financeCard, styles.financeCardSuccess]}>
            <Text style={styles.financeLabel}>Cobrados</Text>
            <Text style={styles.financeAmount}>{formatDisplayMoney(stats.financeTotals.cobrado)}</Text>
            <Text style={styles.financeMeta}>{stats.financeCounts.cobrado + stats.financeCounts.pagado} pedidos</Text>
          </View>
          <View style={[styles.financeCard, styles.financeCardInfo]}>
            <Text style={styles.financeLabel}>Pagados</Text>
            <Text style={styles.financeAmount}>{formatDisplayMoney(stats.financeTotals.pagado)}</Text>
            <Text style={styles.financeMeta}>{stats.financeCounts.pagado} pedidos</Text>
          </View>
          <View style={[styles.financeCard, styles.financeCardMuted]}>
            <Text style={styles.financeLabel}>Cancelados</Text>
            <Text style={styles.financeAmount}>{stats.financeCounts.cancelado}</Text>
            <Text style={styles.financeMeta}>Sin impacto en ingresos</Text>
          </View>
        </View>
      </View>

      {/* Métricas Principales */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumen General</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <LinearGradient
              colors={colors.gradientSuccess}
              style={styles.metricGradient}
            >
              <FontAwesome5 name="dollar-sign" size={20} color={colors.textInverse} />
              <Text style={styles.metricValue}>{formatDisplayMoney(stats.totalRevenue)}</Text>
              <Text style={styles.metricLabel}>Ingresos cobrados</Text>
              <Text style={styles.metricTrend}>{formatDelta(comparisons.totalRevenue)}</Text>
            </LinearGradient>
          </View>

          <View style={styles.metricCard}>
            <LinearGradient
              colors={colors.gradientSecondary}
              style={styles.metricGradient}
            >
              <FontAwesome5 name="box" size={20} color={colors.textInverse} />
              <Text style={styles.metricValue}>{stats.totalOrders}</Text>
              <Text style={styles.metricLabel}>Total Pedidos</Text>
              <Text style={styles.metricTrend}>{formatDelta(comparisons.totalOrders)}</Text>
            </LinearGradient>
          </View>

          <View style={styles.metricCard}>
            <LinearGradient
              colors={[colors.secondary, colors.secondaryDark]}
              style={styles.metricGradient}
            >
              <FontAwesome5 name="hand-holding-usd" size={20} color={colors.textInverse} />
              <Text style={styles.metricValue}>{formatDisplayMoney(stats.financeTotals.por_cobrar)}</Text>
              <Text style={styles.metricLabel}>Por cobrar</Text>
              <Text style={styles.metricTrend}>{stats.financeCounts.por_cobrar} pedidos pendientes</Text>
            </LinearGradient>
          </View>

          <View style={styles.metricCard}>
            <LinearGradient
              colors={[colors.error, '#DC2626']}
              style={styles.metricGradient}
            >
              <FontAwesome5 name="chart-line" size={20} color={colors.textInverse} />
              <Text style={styles.metricValue}>{stats.completionRate.toFixed(1)}%</Text>
              <Text style={styles.metricLabel}>Tasa de Completación</Text>
              <Text style={styles.metricTrend}>{formatDelta(comparisons.completionRate)}</Text>
            </LinearGradient>
          </View>

          <View style={styles.metricCard}>
            <LinearGradient
              colors={[colors.grayShades[700], colors.grayShades[900] || '#1f2937']}
              style={styles.metricGradient}
            >
              <FontAwesome5 name="balance-scale" size={20} color={colors.textInverse} />
              <Text style={styles.metricValue}>{formatDisplayMoney(stats.netCashFlow)}</Text>
              <Text style={styles.metricLabel}>Flujo neto</Text>
              <Text style={styles.metricTrend}>Pagado: {formatDisplayMoney(stats.financeTotals.pagado)}</Text>
            </LinearGradient>
          </View>
        </View>
      </View>

      {/* Estadísticas de Pedidos por Tipo */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pedidos por Tipo de Servicio</Text>
        <SimpleBarChart
          data={ordersByTypeData}
        />
        <View style={styles.statsList}>
          {ordersByTypeData.map((item) => (
            <View key={item.label} style={styles.statItem}>
              <View style={styles.statInfo}>
                <View style={[styles.statColor, { backgroundColor: typeColorMap[item.label] || colors.primary }]} />
                <Text style={styles.statLabel}>{item.label}</Text>
              </View>
              <Text style={styles.statValue}>{item.value} pedidos</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Pedidos por Estado */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pedidos por Estado</Text>
        <SimpleBarChart
          data={[
            { label: 'Pendiente', value: stats.pendientes },
            { label: 'Listo', value: stats.listos },
            { label: 'Entregado', value: stats.entregados },
            { label: 'Cancelado', value: stats.cancelados },
          ]}
        />
      </View>

      {/* KPIs Adicionales */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Métricas Clave</Text>
        <View style={styles.kpiGrid}>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiValue}>
              {stats.totalOrders > 0 ? formatDisplayMoney(stats.totalRevenue / stats.totalOrders) : formatDisplayMoney(0)}
            </Text>
            <Text style={styles.kpiLabel}>Valor Promedio por Pedido</Text>
            <Text style={styles.kpiTrend}>{formatDelta(comparisons.avgTicket)}</Text>
          </View>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiValue}>
              {stats.completionRate.toFixed(1)}%
            </Text>
            <Text style={styles.kpiLabel}>Tasa de Completación</Text>
          </View>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiValue}>
              {stats.clientsWithOrders > 0 ? formatDisplayMoney(stats.avgPerClient) : formatDisplayMoney(0)}
            </Text>
            <Text style={styles.kpiLabel}>Ingreso por Cliente</Text>
            <Text style={styles.kpiSubLabel}>{stats.chargedClients} clientes cobrados</Text>
          </View>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiValue}>
              {stats.totalUsers}
            </Text>
            <Text style={styles.kpiLabel}>Usuarios Registrados</Text>
            <Text style={styles.kpiSubLabel}>{stats.totalClients} clientes en total</Text>
          </View>
        </View>
      </View>

      {/* Información del Sistema */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información del Sistema</Text>
        <View style={styles.systemInfo}>
          <View style={styles.systemItem}>
            <Ionicons name="server" size={20} color={colors.primary} />
            <Text style={styles.systemText}>Base de datos: Firebase Firestore</Text>
          </View>
          <View style={styles.systemItem}>
            <Ionicons name="time" size={20} color={colors.primary} />
            <Text style={styles.systemText}>Última actualización: {updatedText}</Text>
          </View>
          <View style={styles.systemItem}>
            <Ionicons name="analytics" size={20} color={colors.primary} />
            <Text style={styles.systemText}>Datos en tiempo real</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
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
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textInverse,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  headerStats: {
    alignItems: 'flex-end',
  },
  headerStat: {
    fontSize: 12,
    color: '#E0F2F1',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  filtersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rangeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: colors.background,
  },
  rangeText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  rangeInfoColumn: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: colors.background,
  },
  rangeInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  helpIconButton: {
    padding: 4,
  },
  helpText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 8,
    lineHeight: 16,
  },
  dateFieldToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  dateFieldButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
  },
  dateFieldButtonActive: {
    backgroundColor: colors.primary,
  },
  dateFieldText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  dateFieldTextActive: {
    color: colors.textInverse,
  },
  rateTooltipContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  ratePressable: {
    paddingVertical: 4,
  },
  tooltipBubble: {
    position: 'absolute',
    top: -30,
    left: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  tooltipText: {
    color: colors.textInverse,
    fontSize: 11,
    fontWeight: '600',
  },
  currencyToggleContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  currencyButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
  },
  currencyButtonActive: {
    backgroundColor: colors.primary,
  },
  currencyText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  currencyTextActive: {
    color: colors.textInverse,
  },
  dateInputsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  dateInputGroup: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.textPrimary,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.grayShades[50],
    marginRight: 12,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterButtonTextActive: {
    color: colors.textInverse,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    backgroundColor: colors.background,
    margin: 16,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusPillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
  },
  statusPill: {
    flexBasis: '48%',
    padding: 12,
    borderRadius: 12,
  },
  statusPillLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusPillValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  metricCard: {
    width: '48%',
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  metricGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  metricLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  metricTrend: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
  },
  chartContainer: {
    marginVertical: 16,
  },
  barItem: {
    marginBottom: 12,
  },
  barLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  barValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  barBackground: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  statsList: {
    marginTop: 16,
    gap: 12,
  },
  financeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  financeCard: {
    width: '48%',
    borderRadius: 16,
    padding: 16,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  financeCardWarning: {
    backgroundColor: '#FEF3C7',
  },
  financeCardSuccess: {
    backgroundColor: '#DCFCE7',
  },
  financeCardInfo: {
    backgroundColor: '#DBEAFE',
  },
  financeCardMuted: {
    backgroundColor: '#F3F4F6',
  },
  financeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  financeAmount: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  financeMeta: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textSecondary,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiItem: {
    width: '48%',
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  kpiTrend: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  kpiSubLabel: {
    marginTop: 6,
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  systemInfo: {
    gap: 12,
  },
  systemItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  systemText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});

export default StatsScreen;