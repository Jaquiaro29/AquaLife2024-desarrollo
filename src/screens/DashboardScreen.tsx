import React, { useState, useEffect } from 'react'; 
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Animated, Alert, Platform, Modal, Image, KeyboardAvoidingView } from 'react-native';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db, auth } from '../../firebaseConfig';
import { collection, onSnapshot, query, where, getDocs, DocumentData, orderBy, limit, doc, getDoc, setDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { colors } from '../styles/globalStyles';
import { RootStackParamList } from '../types/navigation';
import { formatCurrency } from '../utils/currency';
import { useGlobalConfig } from '../hooks/useGlobalConfig';

const { width } = Dimensions.get('window');

const bankOptions = [
  { name: 'Banco de Venezuela', code: '0102' },
  { name: 'Venezolano de Crédito', code: '0104' },
  { name: 'Mercantil', code: '0105' },
  { name: 'Provincial', code: '0108' },
  { name: 'Bancaribe', code: '0114' },
  { name: 'Banco Exterior', code: '0115' },
  { name: 'BOD (Occidental de Descuento)', code: '0116' },
  { name: 'Banco Caroní', code: '0128' },
  { name: 'Banesco', code: '0134' },
  { name: 'Sofitasa', code: '0137' },
  { name: 'Banco Plaza', code: '0138' },
  { name: 'BFC Banco Fondo Común', code: '0151' },
  { name: '100% Banco', code: '0156' },
  { name: 'Banco del Sur', code: '0157' },
  { name: 'Banco del Tesoro', code: '0163' },
  { name: 'Banco Activo', code: '0171' },
  { name: 'Bancamiga', code: '0172' },
  { name: 'Banplus', code: '0174' },
  { name: 'Bicentenario', code: '0175' },
  { name: 'Banfanb', code: '0177' },
  { name: 'Banco Nacional de Crédito (BNC)', code: '0191' },
  { name: 'Citibank', code: '0190' },
];

// Componente de gráfico simple (en una app real usarías una librería como react-native-chart-kit)
type SimpleBarChartProps = {
  data: number[];
  labels: string[];
  color?: string;
};

const SimpleBarChart: React.FC<SimpleBarChartProps> = ({ data, labels, color = colors.secondary }) => {
  const maxValue = data.length ? Math.max(...data) : 1;

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartBars}>
        {data.map((value: number, index: number) => (
          <View key={index} style={styles.chartBarWrapper}>
            <View style={styles.chartBarBackground}>
              <Animated.View 
                style={[
                  styles.chartBar,
                  { 
                    backgroundColor: color,
                    height: `${(value / maxValue) * 100}%`
                  }
                ]}
              />
            </View>
            <Text style={styles.chartLabel}>{labels[index]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const DashboardScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const isSmallScreen = width < 420;
  const [userCount, setUserCount] = useState(0);
  const [clientCount, setClientCount] = useState(0);
  const [userData, setUserData] = useState({
    nombre: '',
    correo: '',
    rol: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [recentActivityAll, setRecentActivityAll] = useState<Activity[]>([]);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryEntry[]>([]);
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [showPriceHistoryModal, setShowPriceHistoryModal] = useState(false);
  const [monthlySales, setMonthlySales] = useState<number[]>([]);
  const [monthlyLabels, setMonthlyLabels] = useState<string[]>([]);
  // Usar hook global
  const { botellonPrice: priceFromConfig, botellonPriceHigh: priceHighFromConfig, loading: loadingConfig, updateBotellonPrice } = useGlobalConfig();
  const [botellonPrice, setBotellonPrice] = useState<number | null>(null);
  const [botellonPriceHigh, setBotellonPriceHigh] = useState<number | null>(null);
  const [savingPrice, setSavingPrice] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [ordersCount, setOrdersCount] = useState<number | null>(null);
  const [weeklySalesTotal, setWeeklySalesTotal] = useState<number | null>(null);
  const [weeklyGrowthPct, setWeeklyGrowthPct] = useState<number | null>(null);
  const [orderTodayCount, setOrderTodayCount] = useState<number | null>(null);
  const [orderGrowthPct, setOrderGrowthPct] = useState<number | null>(null);
  const [avgResponseHours, setAvgResponseHours] = useState<number | null>(null);
  const [responseDeltaHours, setResponseDeltaHours] = useState<number | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<{
    total: number | null;
    orders: number | null;
    avgTicket: number | null;
    growthPct: number | null;
  }>({ total: null, orders: null, avgTicket: null, growthPct: null });
  const [financialTotals, setFinancialTotals] = useState<Record<FinancialState, number>>({
    por_cobrar: 0,
    por_confirmar_pago: 0,
    cobrado: 0,
    pagado: 0,
    cancelado: 0,
  });
  const [financialCounts, setFinancialCounts] = useState<Record<FinancialState, number>>({
    por_cobrar: 0,
    por_confirmar_pago: 0,
    cobrado: 0,
    pagado: 0,
    cancelado: 0,
  });
  const [netCashFlow, setNetCashFlow] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activePaymentTab, setActivePaymentTab] = useState<'pagoMovil' | 'cuenta'>('pagoMovil');
  const [pagoMovilForm, setPagoMovilForm] = useState<PaymentMobile>({ banco: '', bancoCodigo: '', telefono: '', rif: '', idType: 'V', qrUrl: '' });
  const [cuentaForm, setCuentaForm] = useState<PaymentAccount>({ banco: '', bancoCodigo: '', cuenta: '', rif: '', idType: 'V' });
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentMeta, setPaymentMeta] = useState<{ updatedAt?: Date; updatedBy?: string }>({});
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const parseTimestampToDate = (ts: any): Date | undefined => {
    if (!ts) return undefined;
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
    const parsed = Date.parse(ts);
    return isNaN(parsed) ? undefined : new Date(parsed);
  };

  useEffect(() => {
    const ref = doc(db, 'configuracion', 'metodosPago');
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as any;
      if (data.pagoMovil) {
        setPagoMovilForm({
          banco: data.pagoMovil.banco || '',
          bancoCodigo: data.pagoMovil.bancoCodigo || '',
          telefono: data.pagoMovil.telefono || '',
          rif: data.pagoMovil.rif || '',
          idType: data.pagoMovil.idType === 'J' ? 'J' : 'V',
          qrUrl: data.pagoMovil.qrUrl || '',
        });
      }
      if (data.cuenta) {
        setCuentaForm({
          banco: data.cuenta.banco || '',
          bancoCodigo: data.cuenta.bancoCodigo || '',
          cuenta: data.cuenta.cuenta || '',
          rif: data.cuenta.rif || '',
          idType: data.cuenta.idType === 'J' ? 'J' : 'V',
        });
      }
      setPaymentMeta({
        updatedAt: parseTimestampToDate(data.updatedAt),
        updatedBy: data.updatedBy,
      });
    });
    return () => unsub();
  }, []);

  // Historial de métodos de pago
  useEffect(() => {
    const ref = collection(db, 'configuracion', 'metodosPago', 'history');
    const q = query(ref, orderBy('updatedAt', 'desc'), limit(20));
    const unsub = onSnapshot(q, (snap) => {
      const items: PaymentHistoryEntry[] = snap.docs.map((docSnap) => {
        const data: any = docSnap.data();
        return {
          id: docSnap.id,
          updatedAt: parseTimestampToDate(data.updatedAt),
          updatedBy: data.updatedBy,
          target: data.target || (data.pagoMovil ? 'Pago Móvil' : data.cuenta ? 'Cuenta' : 'Métodos de pago'),
          pagoMovil: data.pagoMovil,
          cuenta: data.cuenta,
        };
      });
      setPaymentHistory(items);
    });
    return () => unsub();
  }, []);

  const showNotificationAlert = (title: string, message: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // Actividad reciente desde pedidos
  useEffect(() => {
    const formatTimeAgo = (d?: Date) => {
      if (!d) return 'Sin fecha';
      const diffMs = Date.now() - d.getTime();
      const minutes = Math.floor(diffMs / (1000 * 60));
      if (minutes < 1) return 'Hace un momento';
      if (minutes < 60) return `Hace ${minutes} min`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `Hace ${hours} h`;
      const days = Math.floor(hours / 24);
      return `Hace ${days} d`;
    };

    const toDate = (fecha?: string, created?: any) => {
      const parsedTs = parseTimestampToDate(created);
      if (parsedTs) return parsedTs;
      if (!fecha) return undefined;
      const parts = fecha.split('-');
      if (parts.length !== 3) return undefined;
      const [y, m, d] = parts.map((p) => Number(p));
      const maybeDate = new Date(y, (m ?? 1) - 1, d ?? 1);
      return Number.isNaN(maybeDate.getTime()) ? undefined : maybeDate;
    };

    const q = query(collection(db, 'Pedidos'), orderBy('numeroPedido', 'desc'), limit(30));
    const unsub = onSnapshot(q, (snap) => {
      const items: Activity[] = snap.docs.map((docSnap) => {
        const data: any = docSnap.data();
        const when = toDate(data.fecha, data.createdAt);
        return {
          id: docSnap.id,
          type: 'new_order',
          message: `Pedido #${formatOrderNumber(data.numeroPedido)}`,
          time: formatTimeAgo(when),
          user: data.cliente || data.nombreCliente || 'Cliente',
          status: data.estado,
          total: data.total,
        };
      });
      setRecentActivity(items.slice(0, 6));
      setRecentActivityAll(items);
    });

    return () => unsub();
  }, []);

  // Cargar precio global de botellones desde Firestore
  useEffect(() => {
    // Inicializar estados locales desde el hook
    setBotellonPrice(priceFromConfig ?? null);
    setBotellonPriceHigh(priceHighFromConfig ?? null);
  }, [priceFromConfig, priceHighFromConfig]);

  // Listener en tiempo real para usuarios y clientes
  useEffect(() => {
    const unsubscribeUsers = onSnapshot(collection(db, 'usuarios'), (snapshot) => {
      setUserCount(snapshot.size);
    });

    const unsubscribeClients = onSnapshot(collection(db, 'Clientes'), (snapshot) => {
      setClientCount(snapshot.size);
    });

    // Simular carga de datos
    setTimeout(() => {
      setLoading(false);
    }, 1500);

    return () => {
      unsubscribeUsers();
      unsubscribeClients();
    };
  }, []);

  // Contador en tiempo real de todos los pedidos (para la tarjeta) + métricas financieras
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'Pedidos'), (snapshot) => {
      setOrdersCount(snapshot.size);

      const totals: Record<FinancialState, number> = {
        por_cobrar: 0,
        por_confirmar_pago: 0,
        cobrado: 0,
        pagado: 0,
        cancelado: 0,
      };
      const counts: Record<FinancialState, number> = {
        por_cobrar: 0,
        por_confirmar_pago: 0,
        cobrado: 0,
        pagado: 0,
        cancelado: 0,
      };

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const baseAmount = typeof data.total === 'number' ? data.total : 0;
        const montoCobrado = typeof data.montoCobrado === 'number' ? data.montoCobrado : baseAmount;
        const montoPagado = typeof data.montoPagado === 'number' ? data.montoPagado : 0;
        const estadoFinDb = (data.estadoFinanciero ?? undefined) as FinancialState | undefined;
        let estadoFin: FinancialState = 'por_cobrar';

        if (
          estadoFinDb === 'por_cobrar' ||
          estadoFinDb === 'por_confirmar_pago' ||
          estadoFinDb === 'cobrado' ||
          estadoFinDb === 'pagado' ||
          estadoFinDb === 'cancelado'
        ) {
          estadoFin = estadoFinDb;
        }

        if (!estadoFinDb && data.estado === 'cancelado') {
          estadoFin = 'cancelado';
        }

        counts[estadoFin] += 1;

        switch (estadoFin) {
          case 'por_cobrar':
            totals.por_cobrar += baseAmount;
            break;
          case 'por_confirmar_pago':
            totals.por_confirmar_pago += baseAmount;
            break;
          case 'cobrado':
            totals.cobrado += montoCobrado;
            break;
          case 'pagado':
            totals.cobrado += montoCobrado;
            totals.pagado += montoPagado || montoCobrado;
            break;
          case 'cancelado':
            totals.cancelado += baseAmount;
            break;
          default:
            totals.por_cobrar += baseAmount;
            break;
        }
      });

      setFinancialTotals(totals);
      setFinancialCounts(counts);
      setNetCashFlow(totals.cobrado - totals.pagado);
    });
    return () => unsub();
  }, []);

  // Ventas de la semana (últimos 7 días incluyendo hoy)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'Pedidos'), (snapshot) => {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      const currentWeekStart = startOfToday - dayMs * 6; // 7 días incluyendo hoy
      const prevWeekStart = currentWeekStart - dayMs * 7;
      const prevWeekEnd = currentWeekStart - dayMs;

      const parseFecha = (fechaStr?: string) => {
        if (!fechaStr) return NaN;
        const parts = fechaStr.split('-');
        if (parts.length !== 3) return NaN;
        const [y, m, d] = parts.map((p) => Number(p));
        return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
      };

      let totalSemana = 0;
      let totalSemanaAnterior = 0;

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as { total?: number; fecha?: string };
        const t = parseFecha(data.fecha);
        if (isNaN(t)) return;
        if (t >= currentWeekStart && t <= startOfToday) {
          totalSemana += data.total ?? 0;
        } else if (t >= prevWeekStart && t <= prevWeekEnd) {
          totalSemanaAnterior += data.total ?? 0;
        }
      });

      setWeeklySalesTotal(totalSemana);
      const growth = totalSemanaAnterior > 0
        ? ((totalSemana - totalSemanaAnterior) / totalSemanaAnterior) * 100
        : totalSemana > 0
          ? 100
          : null;
      setWeeklyGrowthPct(growth);
    });

    return () => unsub();
  }, []);

  // Pedidos de hoy vs ayer para porcentaje dinámico
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'Pedidos'), (snapshot) => {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      const startOfYesterday = startOfToday - dayMs;
      const endOfYesterday = startOfToday - 1;

      const parseFecha = (fechaStr?: string) => {
        if (!fechaStr) return NaN;
        const parts = fechaStr.split('-');
        if (parts.length !== 3) return NaN;
        const [y, m, d] = parts.map((p) => Number(p));
        return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
      };

      let todayCount = 0;
      let yesterdayCount = 0;

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as { fecha?: string };
        const t = parseFecha(data.fecha);
        if (isNaN(t)) return;
        if (t >= startOfToday) {
          todayCount += 1;
        } else if (t >= startOfYesterday && t <= endOfYesterday) {
          yesterdayCount += 1;
        }
      });

      setOrderTodayCount(todayCount);
      const growth = yesterdayCount > 0
        ? ((todayCount - yesterdayCount) / yesterdayCount) * 100
        : todayCount > 0
          ? 100
          : null;
      setOrderGrowthPct(growth);
    });

    return () => unsub();
  }, []);

  // Métricas mensuales: total, pedidos, ticket promedio, variación vs mes anterior
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'Pedidos'), (snapshot) => {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
      const prevMonthEnd = currentMonthStart - 1;

      const parseFecha = (fechaStr?: string) => {
        if (!fechaStr) return NaN;
        const parts = fechaStr.split('-');
        if (parts.length !== 3) return NaN;
        const [y, m, d] = parts.map((p) => Number(p));
        return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
      };

      let totalCur = 0;
      let countCur = 0;
      let totalPrev = 0;
      let countPrev = 0;
      const totalsByMonth: Record<string, number> = {};
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as { total?: number; fecha?: string };
        const ts = parseFecha(data.fecha);
        if (isNaN(ts)) return;

        // Acumulados por mes (clave YYYY-MM) para el gráfico
        const dateObj = new Date(ts);
        const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
        totalsByMonth[monthKey] = (totalsByMonth[monthKey] ?? 0) + (data.total ?? 0);

        if (ts >= currentMonthStart) {
          totalCur += data.total ?? 0;
          countCur += 1;
        } else if (ts >= prevMonthStart && ts <= prevMonthEnd) {
          totalPrev += data.total ?? 0;
          countPrev += 1;
        }
      });

      const avgTicket = countCur > 0 ? totalCur / countCur : null;
      const growthPct = totalPrev > 0 ? ((totalCur - totalPrev) / totalPrev) * 100 : null;

      setMonthlyStats({
        total: totalCur,
        orders: countCur,
        avgTicket,
        growthPct,
      });

      // Últimos 6 meses (incluye mes actual)
      const monthsWindow = 6;
      const chartLabels: string[] = [];
      const chartValues: number[] = [];
      for (let i = monthsWindow - 1; i >= 0; i -= 1) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        chartLabels.push(monthNames[monthDate.getMonth()]);
        chartValues.push(totalsByMonth[key] ?? 0);
      }
      setMonthlyLabels(chartLabels);
      setMonthlySales(chartValues);
    });

    return () => unsub();
  }, []);

  // Tiempo de respuesta promedio (última semana vs semana previa)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'Pedidos'), (snapshot) => {
      const toMillis = (ts: any): number => {
        if (!ts) return NaN;
        if (typeof ts === 'number') return ts;
        if (typeof ts === 'string') {
          const d = Date.parse(ts);
          return isNaN(d) ? NaN : d;
        }
        if (typeof ts.toMillis === 'function') return ts.toMillis();
        if (typeof ts.seconds === 'number') return ts.seconds * 1000 + Math.floor((ts.nanoseconds ?? 0) / 1e6);
        return NaN;
      };

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      const currentWeekStart = startOfToday - dayMs * 6; // 7 días
      const prevWeekStart = currentWeekStart - dayMs * 7;
      const prevWeekEnd = currentWeekStart - dayMs;

      let curSumHrs = 0;
      let curCount = 0;
      let prevSumHrs = 0;
      let prevCount = 0;

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const createdMs = toMillis(data.createdAt);
        const respondedMs = toMillis(data.firstResponseAt);
        if (isNaN(createdMs) || isNaN(respondedMs)) return;
        const diffHrs = (respondedMs - createdMs) / (1000 * 60 * 60);
        if (diffHrs < 0) return;

        // Clasificar por semana usando respondedMs
        if (respondedMs >= currentWeekStart && respondedMs <= startOfToday) {
          curSumHrs += diffHrs;
          curCount += 1;
        } else if (respondedMs >= prevWeekStart && respondedMs <= prevWeekEnd) {
          prevSumHrs += diffHrs;
          prevCount += 1;
        }
      });

      const curAvg = curCount > 0 ? curSumHrs / curCount : null;
      const prevAvg = prevCount > 0 ? prevSumHrs / prevCount : null;
      setAvgResponseHours(curAvg);
      let delta: number | null = null;
      if (curAvg !== null && prevAvg !== null) {
        delta = curAvg - prevAvg; // negativo = mejora
      }
      setResponseDeltaHours(delta);
    });

    return () => unsub();
  }, []);

  // Cargar información personal del usuario autenticado
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userQuery = query(collection(db, 'usuarios'), where('email', '==', user.email));
        const querySnapshot = await getDocs(userQuery);

        querySnapshot.forEach((doc: DocumentData) => {
          setUserData({
            nombre: doc.data().nombre || 'Sin nombre',
            correo: doc.data().email || 'Sin correo',
            rol: doc.data().tipo || 'Usuario',
          });
        });
      } else {
        setUserData({
          nombre: '',
          correo: '',
          rol: '',
        });
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Suscribir pedidos pendientes para la campana de notificaciones
  useEffect(() => {
    const pendingQuery = query(
      collection(db, 'Pedidos'),
      where('estado', 'in', ['pendiente', 'procesando'])
    );

    const unsubscribe = onSnapshot(
      pendingQuery,
      (snapshot) => {
        const data: PendingOrder[] = snapshot.docs.map((doc) => {
          const payload = doc.data() as PendingOrder;
          return {
            id: doc.id,
            numeroPedido: payload.numeroPedido,
            fecha: payload.fecha,
            estado: payload.estado,
          };
        });

        // Ordenar por estado y número de pedido más reciente
        data.sort((a, b) => (b.numeroPedido ?? 0) - (a.numeroPedido ?? 0));

        setPendingOrders(data);
        setLoadingNotifications(false);
      },
      (error) => {
        console.error('Error al obtener pedidos pendientes:', error);
        setLoadingNotifications(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const formatOrderNumber = (num?: number) => {
    if (num === undefined || num === null) return 'N/A';
    return num.toString().padStart(4, '0');
  };

  const handleNotificationPress = () => {
    setShowNotifications((prev) => !prev);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'new_order': return 'shopping-cart';
      case 'payment': return 'credit-card';
      case 'delivery': return 'truck';
      case 'new_client': return 'user-plus';
      case 'stock': return 'box';
      default: return 'bell';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'new_order': return colors.success;
      case 'payment': return colors.secondary;
      case 'delivery': return colors.warning;
      case 'new_client': return colors.secondaryDark;
      case 'stock': return colors.error;
      default: return colors.textSecondary;
    }
  };

  // Historial de precios de botellón
  useEffect(() => {
    const ref = collection(db, 'config', 'botellon', 'history');
    const q = query(ref, orderBy('updatedAt', 'desc'), limit(20));
    const unsub = onSnapshot(q, (snap) => {
      const items: PriceHistoryEntry[] = snap.docs.map((docSnap) => {
        const data: any = docSnap.data();
        return {
          id: docSnap.id,
          updatedAt: parseTimestampToDate(data.updatedAt),
          user: data.user,
          price: data.price,
          priceHigh: data.priceHigh,
        };
      });
      setPriceHistory(items);
    });
    return () => unsub();
  }, []);

  const bankLabel = (name?: string, code?: string) => {
    if (!name) return 'No definido';
    return `${name}${code ? ` (${code})` : ''}`;
  };

  const formatId = (idType: 'V' | 'J', rif: string) => {
    const trimmed = rif.replace(/\s+/g, '');
    return `${idType}-${trimmed || 'N/D'}`;
  };

  const formatDateTime = (d?: Date) => {
    if (!d) return 'Sin registrar';
    try {
      return new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
    } catch {
      return d.toLocaleString();
    }
  };

  const handleSavePaymentMethods = async (target: 'pagoMovil' | 'cuenta') => {
    setPaymentError(null);
    const cleanPhone = pagoMovilForm.telefono.replace(/\D/g, '');
    const rifPmDigits = pagoMovilForm.rif.replace(/\D/g, '');
    const rifCtaDigits = cuentaForm.rif.replace(/\D/g, '');
    const cleanAccount = cuentaForm.cuenta.replace(/\D/g, '');

    const rifRegex = /^(V|J)-?\d{6,10}$/;
    const errors: string[] = [];
    const updatePayload: any = {};

    if (target === 'pagoMovil') {
      if (!pagoMovilForm.banco) errors.push('Selecciona banco para Pago Móvil');
      if (cleanPhone.length < 10) errors.push('Teléfono Pago Móvil debe tener al menos 10 dígitos');
      if (!rifRegex.test(`${pagoMovilForm.idType}-${rifPmDigits}`)) errors.push('CI/RIF Pago Móvil inválido (V-12345678 o J-123456789)');
      if (!errors.length) {
        updatePayload.pagoMovil = {
          ...pagoMovilForm,
          telefono: cleanPhone,
          rif: `${pagoMovilForm.idType}-${rifPmDigits}`,
        };
      }
    }

    if (target === 'cuenta') {
      if (!cuentaForm.banco) errors.push('Selecciona banco para la cuenta');
      if (cleanAccount.length < 20) errors.push('La cuenta debe tener 20 dígitos');
      if (!rifRegex.test(`${cuentaForm.idType}-${rifCtaDigits}`)) errors.push('CI/RIF de la cuenta inválido (V-12345678 o J-123456789)');
      if (!errors.length) {
        updatePayload.cuenta = {
          ...cuentaForm,
          cuenta: cleanAccount,
          rif: `${cuentaForm.idType}-${rifCtaDigits}`,
        };
      }
    }

    if (errors.length) {
      const message = errors.join('\n• ');
      setPaymentError(errors.join('\n'));
      Alert.alert('Faltan datos', `• ${message}`);
      return;
    }

    try {
      setSavingPayment(true);
      const user = auth.currentUser;
      const updatedBy = user?.email || userData.correo || userData.nombre || 'Desconocido';
      await setDoc(
        doc(db, 'configuracion', 'metodosPago'),
        {
          ...updatePayload,
          updatedAt: serverTimestamp(),
          updatedBy,
        },
        { merge: true }
      );
      await addDoc(collection(db, 'configuracion', 'metodosPago', 'history'), {
        ...updatePayload,
        target,
        updatedAt: serverTimestamp(),
        updatedBy,
      });
      setPaymentError(null);
      Alert.alert('Guardado', 'Métodos de pago actualizados.');
      setShowPaymentModal(false);
    } catch (error) {
      console.error('Error guardando métodos de pago', error);
      setPaymentError('No se pudo guardar. Revisa conexión o permisos.');
      Alert.alert('Error', 'No se pudo guardar. Intenta nuevamente.');
    } finally {
      setSavingPayment(false);
    }
  };

  const chargedOrders = financialCounts.cobrado + financialCounts.pagado;
  const weeklyGrowthLabel = weeklyGrowthPct !== null
    ? `${weeklyGrowthPct >= 0 ? '+' : ''}${weeklyGrowthPct.toFixed(1)}% vs semana previa`
    : 'Sin datos';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={colors.gradientSecondary}
          style={styles.loadingGradient}
        >
          <View style={styles.loadingContent}>
            <FontAwesome5 name="water" size={60} color={colors.textInverse} />
            <Text style={styles.loadingText}>AQUALIFE</Text>
            <ActivityIndicator size="large" color={colors.textInverse} style={styles.loadingSpinner} />
            <Text style={styles.loadingSubtext}>Cargando dashboard...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
          <View style={styles.headerContent}>
            <View style={styles.logoContainer}>
              <FontAwesome5 name="water" size={28} color={colors.textInverse} />
              <Text style={styles.logoText}>AQUALIFE</Text>
            </View>
            <View style={styles.headerIcons}>
              <TouchableOpacity style={styles.iconButton} onPress={handleNotificationPress}>
                <FontAwesome5 name="bell" size={20} color={colors.textInverse} />
                {pendingOrders.length > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationText}>{pendingOrders.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
          {showNotifications && (
            <TouchableOpacity
              activeOpacity={1}
              style={styles.notificationOverlay}
              onPress={() => setShowNotifications(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={styles.notificationPanel}
                onPress={() => {}}
              >
                <Text style={styles.notificationTitle}>Pedidos pendientes</Text>
                {loadingNotifications && <Text style={styles.notificationTextDark}>Cargando...</Text>}
                {!loadingNotifications && pendingOrders.length === 0 && (
                  <Text style={styles.notificationTextDark}>No hay pedidos pendientes</Text>
                )}
                {!loadingNotifications && pendingOrders.length > 0 && (
                  <ScrollView style={styles.notificationList} contentContainerStyle={styles.notificationListContent}>
                    {pendingOrders.map((order) => (
                      <TouchableOpacity
                        key={order.id}
                        style={styles.notificationItem}
                        onPress={() => {
                          setShowNotifications(false);
                          navigation.navigate('OrdersA');
                        }}
                      >
                        <Text style={styles.notificationItemTitle}>#{formatOrderNumber(order.numeroPedido)}</Text>
                        <Text style={styles.notificationItemSubtitle}>{order.estado ?? 'pendiente'} • {order.fecha ?? 'sin fecha'}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.welcomeText}>Bienvenido,</Text>
            <Text style={styles.userName}>{userData.nombre || 'Usuario'}</Text>
            <Text style={styles.userRole}>{userData.rol || 'Rol'}</Text>
          </View>
        </LinearGradient>

        {/* Contenido principal */}
        <View style={styles.content}>
          {/* Tarjetas Principales */}
          <Text style={styles.sectionTitle}>Resumen General</Text>
          <View style={styles.cardsContainer}>
            <LinearGradient
                colors={colors.gradientSuccess}
                style={[styles.card, styles.cardElevated, isSmallScreen && styles.cardFull]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
              <View style={styles.cardIconContainer}>
                <FontAwesome5 name="user-friends" size={24} color="#fff" />
              </View>
              <Text style={styles.cardTitle}>Clientes</Text>
              <Text style={styles.cardValue}>{clientCount}</Text>
              <Text style={styles.cardChange}>+5% este mes</Text>
            </LinearGradient>

            <LinearGradient
              colors={colors.gradientSecondary}
              style={[styles.card, styles.cardElevated, isSmallScreen && styles.cardFull]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.cardIconContainer}>
                <FontAwesome5 name="users" size={24} color="#fff" />
              </View>
              <Text style={styles.cardTitle}>Usuarios</Text>
              <Text style={styles.cardValue}>{userCount}</Text>
              <Text style={styles.cardChange}>+2 este mes</Text>
            </LinearGradient>

            <LinearGradient
              colors={[colors.warning, '#D97706']}
              style={[styles.card, styles.cardElevated, isSmallScreen && styles.cardFull]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.cardIconContainer}>
                <FontAwesome5 name="box" size={24} color="#fff" />
              </View>
              <Text style={styles.cardTitle}>Pedidos</Text>
              <Text style={styles.cardValue}>{orderTodayCount ?? ordersCount ?? '...'}</Text>
              <Text style={styles.cardChange}>
                {orderGrowthPct !== null ? `${orderGrowthPct >= 0 ? '+' : ''}${orderGrowthPct.toFixed(1)}% vs ayer` : 'Sin datos'}
              </Text>
            </LinearGradient>

            <LinearGradient
              colors={[colors.error, '#DC2626']}
              style={[styles.card, styles.cardElevated, isSmallScreen && styles.cardFull]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.cardIconContainer}>
                <FontAwesome5 name="shopping-cart" size={24} color="#fff" />
              </View>
              <Text style={styles.cardTitle}>Ventas Semana</Text>
              <Text style={styles.cardValue}>
                {weeklySalesTotal !== null ? formatCurrency(weeklySalesTotal) : '...'}
              </Text>
              <Text style={styles.cardChange}>
                Cobrado total: {formatCurrency(financialTotals.cobrado)} • {weeklyGrowthLabel}
              </Text>
            </LinearGradient>
          </View>

          <Text style={styles.sectionTitle}>Flujo de Caja</Text>
          <View style={styles.cardsContainer}>
            <LinearGradient
              colors={[colors.primaryDark, colors.primary]}
              style={[styles.card, styles.cardElevated, isSmallScreen && styles.cardFull]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.cardIconContainer}>
                <FontAwesome5 name="hand-holding-usd" size={24} color="#fff" />
              </View>
              <Text style={styles.cardTitle}>Por Cobrar</Text>
              <Text style={styles.cardValue}>{formatCurrency(financialTotals.por_cobrar)}</Text>
              <Text style={styles.cardChange}>{financialCounts.por_cobrar} pedidos</Text>
            </LinearGradient>

            <LinearGradient
              colors={colors.gradientSuccess}
              style={[styles.card, styles.cardElevated, isSmallScreen && styles.cardFull]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.cardIconContainer}>
                <FontAwesome5 name="cash-register" size={24} color="#fff" />
              </View>
              <Text style={styles.cardTitle}>Cobrado</Text>
              <Text style={styles.cardValue}>{formatCurrency(financialTotals.cobrado)}</Text>
              <Text style={styles.cardChange}>{chargedOrders} pedidos</Text>
            </LinearGradient>

            <LinearGradient
              colors={[colors.secondaryDark, colors.secondary]}
              style={[styles.card, styles.cardElevated, isSmallScreen && styles.cardFull]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.cardIconContainer}>
                <FontAwesome5 name="money-bill-wave" size={24} color="#fff" />
              </View>
              <Text style={styles.cardTitle}>Pagado</Text>
              <Text style={styles.cardValue}>{formatCurrency(financialTotals.pagado)}</Text>
              <Text style={styles.cardChange}>{financialCounts.pagado} egresos</Text>
            </LinearGradient>

            <LinearGradient
              colors={['#4b5563', '#1f2937']}
              style={[styles.card, styles.cardElevated, isSmallScreen && styles.cardFull]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.cardIconContainer}>
                <FontAwesome5 name="ban" size={24} color="#fff" />
              </View>
              <Text style={styles.cardTitle}>Cancelado</Text>
              <Text style={styles.cardValue}>{formatCurrency(financialTotals.cancelado)}</Text>
              <Text style={styles.cardChange}>{financialCounts.cancelado} pedidos</Text>
            </LinearGradient>
          </View>

          {/* Métricas Avanzadas */}
          <View style={styles.metricsRow}>
            <View style={[styles.metricCard, styles.metricCardElevated, isSmallScreen && styles.metricCardFull]}>
              <View style={styles.metricHeader}>
                <FontAwesome5 name="balance-scale" size={18} color={netCashFlow >= 0 ? colors.success : colors.error} />
                <Text style={styles.metricTitle}>Flujo Neto</Text>
              </View>
              <Text style={styles.metricValue}>{formatCurrency(netCashFlow)}</Text>
              <Text style={[styles.metricSubtitle, netCashFlow >= 0 ? styles.positiveGrowth : styles.negativeGrowth]}>
                Cobrado {formatCurrency(financialTotals.cobrado)} • Pagado {formatCurrency(financialTotals.pagado)}
              </Text>
            </View>

            <View style={[styles.metricCard, styles.metricCardElevated, isSmallScreen && styles.metricCardFull]}>
              <View style={styles.metricHeader}>
                <FontAwesome5 name="clock" size={18} color="#2196F3" />
                <Text style={styles.metricTitle}>Tiempo Respuesta</Text>
              </View>
              <Text style={styles.metricValue}>
                {avgResponseHours !== null ? `${avgResponseHours.toFixed(1)}h` : '...'}
              </Text>
              <Text
                style={[
                  styles.metricSubtitle,
                  responseDeltaHours !== null
                    ? (responseDeltaHours <= 0 ? styles.positiveGrowth : styles.negativeGrowth)
                    : null,
                ]}
              >
                {responseDeltaHours !== null
                  ? `${responseDeltaHours <= 0 ? '-' : '+'}${Math.abs(responseDeltaHours).toFixed(1)}h vs semana previa`
                  : 'Sin datos'}
              </Text>
            </View>
          </View>

          {/* Gráfico de Ventas */}
          <View style={[styles.chartSection, styles.sectionElevated]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Ventas Mensuales</Text>
            </View>
            <SimpleBarChart 
              data={monthlySales}
              labels={monthlyLabels}
              color="#2196F3"
            />
            <View style={styles.chartStats}>
              <View style={styles.chartStat}>
                <Text style={styles.chartStatLabel}>Ventas del mes</Text>
                <Text style={styles.chartStatValue}>
                  {monthlyStats.total !== null ? formatCurrency(monthlyStats.total) : '...'}
                </Text>
              </View>
              <View style={styles.chartStat}>
                <Text style={styles.chartStatLabel}>Ticket promedio</Text>
                <Text style={styles.chartStatValue}>
                  {monthlyStats.avgTicket !== null ? formatCurrency(monthlyStats.avgTicket) : '...'}
                </Text>
              </View>
              <View style={styles.chartStat}>
                <Text style={styles.chartStatLabel}>Pedidos mes</Text>
                <Text style={styles.chartStatValue}>
                  {monthlyStats.orders !== null ? monthlyStats.orders : '...'}
                </Text>
              </View>
              <View style={styles.chartStat}>
                <Text style={styles.chartStatLabel}>Vs mes anterior</Text>
                <Text style={[styles.chartStatValue, monthlyStats.growthPct !== null && monthlyStats.growthPct >= 0 ? styles.positiveGrowth : styles.negativeGrowth]}>
                  {monthlyStats.growthPct !== null ? `${monthlyStats.growthPct >= 0 ? '+' : ''}${monthlyStats.growthPct.toFixed(1)}%` : '--'}
                </Text>
              </View>
            </View>
          </View>

          {/* Actividad Reciente */}
          <View style={[styles.activitySection, styles.sectionElevated]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Actividad Reciente</Text>
              <TouchableOpacity onPress={() => setShowActivityModal(true)}>
                <Text style={styles.viewAllText}>Ver Todo</Text>
              </TouchableOpacity>
            </View>
            {recentActivity.map((activity) => (
              <View key={activity.id} style={styles.activityItem}>
                <View style={[styles.activityIcon, { backgroundColor: getActivityColor(activity.type) }]}>
                  <FontAwesome5 name={getActivityIcon(activity.type)} size={14} color="#fff" />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityMessage}>{activity.message}</Text>
                  <Text style={styles.activityMeta}>{activity.user} • {activity.time}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Sección Configuración */}
          <Text style={styles.sectionTitle}>Configuración</Text>
          <View style={styles.settingsContainer}>
            {/* Información Personal */}
            <View style={[styles.infoBox, styles.infoBoxElevated]}>
              <View style={styles.infoHeader}>
                <FontAwesome5 name="user-circle" size={20} color="#2196F3" />
                <Text style={styles.infoTitle}>Información Personal</Text>
              </View>
              <View style={styles.infoContent}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Nombre:</Text>
                  <Text style={styles.infoValue}>{userData.nombre || 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Correo:</Text>
                  <Text style={styles.infoValue}>{userData.correo || 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Rol:</Text>
                  <Text style={styles.infoValue}>{userData.rol || 'N/A'}</Text>
                </View>
              </View>
            </View>

            {/* Datos de la Empresa */}
            <View style={[styles.infoBox, styles.infoBoxElevated]}>
              <View style={styles.infoHeader}>
                <FontAwesome5 name="building" size={20} color="#4CAF50" />
                <Text style={styles.infoTitle}>Datos de la Empresa</Text>
              </View>
              <View style={styles.infoContent}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>RIF:</Text>
                  <Text style={styles.infoValue}>J-50447281-6</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Nombre:</Text>
                  <Text style={styles.infoValue}>AQUALIFE</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Teléfono:</Text>
                  <Text style={styles.infoValue}>04145491523</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Correo:</Text>
                  <Text style={styles.infoValue}>AquaLife2024@gmail.com</Text>
                </View>
              </View>
            </View>

            {/* Precio global de Botellones (Admin) */}
            <View style={[styles.infoBox, styles.infoBoxElevated]}>
              <View style={styles.infoHeader}>
                <FontAwesome5 name="dollar-sign" size={20} color="#4CAF50" />
                <Text style={styles.infoTitle}>Precio Global Botellón</Text>
              </View>
              <View style={styles.historyActionsRow}>
                <TouchableOpacity onPress={() => setShowPriceHistoryModal(true)}>
                  <Text style={styles.auditToggleText}>Ver historial</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.infoContent}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Precio actual:</Text>
                  <Text style={styles.infoValue}>{botellonPrice !== null ? formatCurrency(botellonPrice) : 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Precio Alta Prioridad:</Text>
                  <Text style={styles.infoValue}>{botellonPriceHigh !== null ? formatCurrency(botellonPriceHigh) : 'N/A'}</Text>
                </View>
                <View style={styles.inputContainer}>
                  <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Precio normal</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Nuevo precio normal (solo números)"
                        placeholderTextColor="#9E9E9E"
                        keyboardType="numeric"
                        value={botellonPrice !== null ? String(botellonPrice) : ''}
                        onChangeText={(t) => {
                          const parsed = parseFloat(t.replace(',', '.'));
                          setBotellonPrice(isNaN(parsed) ? null : parsed);
                        }}
                      />
                      <TouchableOpacity
                        style={[styles.button, { marginTop: 8 }]}
                        onPress={async () => {
                          if (botellonPrice === null) {
                            alert('Ingresa un precio normal válido');
                            return;
                          }
                          try {
                            setSavingPrice(true);
                            const user = auth.currentUser;
                            const userInfo = user ? { uid: user.uid, nombre: userData.nombre, email: user.email ?? undefined } : undefined;
                            await updateBotellonPrice({ price: botellonPrice, user: userInfo });
                            alert('Precio normal guardado');
                          } catch (error) {
                            console.error('Error guardando precio normal:', error);
                            alert('Error guardando precio normal');
                          } finally {
                            setSavingPrice(false);
                          }
                        }}
                      >
                        <Text style={styles.buttonText}>{savingPrice ? 'Guardando...' : 'Guardar Precio Normal'}</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Precio alta prioridad</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Precio alta prioridad (opcional)"
                        placeholderTextColor="#9E9E9E"
                        keyboardType="numeric"
                        value={botellonPriceHigh !== null ? String(botellonPriceHigh) : ''}
                        onChangeText={(t) => {
                          const parsed = parseFloat(t.replace(',', '.'));
                          setBotellonPriceHigh(isNaN(parsed) ? null : parsed);
                        }}
                      />
                      <TouchableOpacity
                        style={[styles.button, { marginTop: 8 }]}
                        onPress={async () => {
                          if (botellonPriceHigh === null) {
                            alert('Ingresa un precio de alta prioridad válido');
                            return;
                          }
                          try {
                            setSavingPrice(true);
                            const user = auth.currentUser;
                            const userInfo = user ? { uid: user.uid, nombre: userData.nombre, email: user.email ?? undefined } : undefined;
                            await updateBotellonPrice({ priceHigh: botellonPriceHigh, user: userInfo });
                            alert('Precio alta prioridad guardado');
                          } catch (error) {
                            console.error('Error guardando precio alta prioridad:', error);
                            alert('Error guardando precio alta prioridad');
                          } finally {
                            setSavingPrice(false);
                          }
                        }}
                      >
                        <Text style={styles.buttonText}>{savingPrice ? 'Guardando...' : 'Guardar Precio Alta Prioridad'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Métodos de pago */}
          <View style={[styles.infoBox, styles.infoBoxElevated]}>
            <View style={styles.infoHeader}>
              <FontAwesome5 name="credit-card" size={20} color={colors.secondary} />
              <Text style={styles.infoTitle}>Métodos de Pago</Text>
            </View>

            <View style={[styles.paymentSummaryRow, isSmallScreen && styles.paymentSummaryColumn]}>
              <View style={styles.paymentChip}>
                <Text style={styles.paymentChipTitle}>Pago Móvil</Text>
                <Text style={styles.paymentChipText}>{bankLabel(pagoMovilForm.banco, pagoMovilForm.bancoCodigo)}</Text>
                <Text style={styles.paymentChipSub}>Tel: {pagoMovilForm.telefono || 'No definido'}</Text>
                <Text style={styles.paymentChipSub}>CI/RIF: {pagoMovilForm.rif ? formatId(pagoMovilForm.idType, pagoMovilForm.rif) : 'No definido'}</Text>
                {pagoMovilForm.qrUrl ? (
                  <Image source={{ uri: pagoMovilForm.qrUrl }} style={styles.qrPreviewImage} resizeMode="contain" />
                ) : null}
              </View>
              <View style={styles.paymentChip}>
                <Text style={styles.paymentChipTitle}>Cuenta Bancaria</Text>
                <Text style={styles.paymentChipText}>{bankLabel(cuentaForm.banco, cuentaForm.bancoCodigo)}</Text>
                <Text style={styles.paymentChipSub}>Cuenta: {cuentaForm.cuenta ? `${cuentaForm.cuenta.slice(0,4)}****${cuentaForm.cuenta.slice(-4)}` : 'No definida'}</Text>
                <Text style={styles.paymentChipSub}>CI/RIF: {cuentaForm.rif ? formatId(cuentaForm.idType, cuentaForm.rif) : 'No definido'}</Text>
              </View>
            </View>

            <View style={styles.paymentActionsRow}>
              <TouchableOpacity style={[styles.button, styles.paymentButton]} onPress={() => setShowPaymentModal(true)}>
                <Text style={styles.buttonText}>Modificar métodos de pago</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowPaymentHistoryModal(true)}>
                <Text style={styles.auditToggleText}>Ver historial</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Botón para mostrar/ocultar el cambio de contraseña */}
          <TouchableOpacity 
            onPress={() => setShowPassword(!showPassword)} 
            style={styles.toggleButton}
          >
            <Text style={styles.toggleButtonText}>
              {showPassword ? 'Ocultar Cambio de Contraseña' : 'Cambiar Contraseña'}
            </Text>
            <FontAwesome5 
              name={showPassword ? 'chevron-up' : 'chevron-down'} 
              size={16} 
              color="#2196F3" 
            />
          </TouchableOpacity>

          {/* Sección de Cambio de Contraseña */}
          {showPassword && (
            <View style={[styles.passwordBox, styles.infoBoxElevated]}>
              <View style={styles.infoHeader}>
                <FontAwesome5 name="lock" size={20} color="#FF9800" />
                <Text style={styles.infoTitle}>Cambiar Contraseña</Text>
              </View>
              <View style={styles.passwordForm}>
                <View style={styles.inputContainer}>
                  <FontAwesome5 name="key" size={16} color="#757575" style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="Contraseña Actual" 
                    placeholderTextColor="#9E9E9E"
                    secureTextEntry 
                  />
                </View>
                <View style={styles.inputContainer}>
                  <FontAwesome5 name="key" size={16} color="#757575" style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="Nueva Contraseña" 
                    placeholderTextColor="#9E9E9E"
                    secureTextEntry 
                  />
                </View>
                <View style={styles.inputContainer}>
                  <FontAwesome5 name="key" size={16} color="#757575" style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="Confirmar Contraseña" 
                    placeholderTextColor="#9E9E9E"
                    secureTextEntry 
                  />
                </View>
                <TouchableOpacity style={styles.button}>
                  <Text style={styles.buttonText}>Guardar Cambios</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Espacio al final para mejor scroll */}
          <View style={styles.bottomSpacing} />
        </View>
      </ScrollView>

      {/* Modal Métodos de Pago */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={80}
        >
          <View style={styles.modalContent}>
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Modificar métodos de pago</Text>
                  <Text style={styles.modalSubtitle}>Actualiza Pago Móvil o cuenta bancaria</Text>
                </View>
                <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                  <FontAwesome5 name="times" size={18} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.tabRow}>
                <TouchableOpacity
                  style={[styles.tabButton, activePaymentTab === 'pagoMovil' && styles.tabButtonActive]}
                  onPress={() => setActivePaymentTab('pagoMovil')}
                >
                  <Text style={[styles.tabButtonText, activePaymentTab === 'pagoMovil' && styles.tabButtonTextActive]}>Pago Móvil</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabButton, activePaymentTab === 'cuenta' && styles.tabButtonActive]}
                  onPress={() => setActivePaymentTab('cuenta')}
                >
                  <Text style={[styles.tabButtonText, activePaymentTab === 'cuenta' && styles.tabButtonTextActive]}>Cuenta Bancaria</Text>
                </TouchableOpacity>
              </View>

              {activePaymentTab === 'pagoMovil' ? (
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>Banco</Text>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={pagoMovilForm.bancoCodigo}
                      onValueChange={(code) => {
                        const opt = bankOptions.find((b) => b.code === code);
                        setPagoMovilForm((prev) => ({ ...prev, bancoCodigo: code, banco: opt?.name || '' }));
                      }}
                      dropdownIconColor={colors.textPrimary}
                      style={styles.picker}
                    >
                      <Picker.Item label="Selecciona un banco" value="" />
                      {bankOptions.map((b) => (
                        <Picker.Item key={b.code} label={`${b.name} (${b.code})`} value={b.code} />
                      ))}
                    </Picker>
                  </View>

                  <Text style={styles.formLabel}>Teléfono</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Teléfono (solo números)"
                    placeholderTextColor="#9E9E9E"
                    keyboardType="phone-pad"
                    value={pagoMovilForm.telefono}
                    onChangeText={(t) => {
                      const digits = t.replace(/\D/g, '');
                      setPagoMovilForm((prev) => ({ ...prev, telefono: digits }));
                    }}
                  />

                  <Text style={styles.formLabel}>C.I. o RIF</Text>
                  <View style={styles.inlineIdRow}>
                    <View style={styles.inlineIdSelector}>
                      {([
                        { key: 'V', label: 'V', sub: 'Venezolano' },
                        { key: 'J', label: 'J', sub: 'Jurídico/Comercio' },
                      ] as const).map((opt) => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.inlinePill, pagoMovilForm.idType === opt.key && styles.inlinePillActive]}
                          onPress={() => setPagoMovilForm((prev) => ({ ...prev, idType: opt.key }))}
                        >
                          <Text style={[styles.inlinePillLabel, pagoMovilForm.idType === opt.key && styles.inlinePillLabelActive]}>{opt.label}</Text>
                          <Text style={[styles.inlinePillSub, pagoMovilForm.idType === opt.key && styles.inlinePillSubActive]}>{opt.sub}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={[styles.input, styles.inlineIdInput]}
                      placeholder="12345678"
                      placeholderTextColor="#9E9E9E"
                      keyboardType="number-pad"
                      value={pagoMovilForm.rif}
                      onChangeText={(t) => {
                        const digits = t.replace(/\D/g, '');
                        setPagoMovilForm((prev) => ({ ...prev, rif: digits }));
                      }}
                    />
                  </View>

                  <Text style={styles.formLabel}>QR de Pago (URL)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="https://...imagen-qr.png (opcional)"
                    placeholderTextColor="#9E9E9E"
                    value={pagoMovilForm.qrUrl}
                    onChangeText={(t) => setPagoMovilForm((prev) => ({ ...prev, qrUrl: t }))}
                  />
                  {pagoMovilForm.qrUrl ? (
                    <View style={styles.qrPreviewBox}>
                      <Image source={{ uri: pagoMovilForm.qrUrl }} style={styles.qrPreviewImage} resizeMode="contain" />
                      <Text style={styles.qrPreviewText}>Se mostrará este QR al usuario.</Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>Banco</Text>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={cuentaForm.bancoCodigo}
                      onValueChange={(code) => {
                        const opt = bankOptions.find((b) => b.code === code);
                        setCuentaForm((prev) => ({ ...prev, bancoCodigo: code, banco: opt?.name || '' }));
                      }}
                      dropdownIconColor={colors.textPrimary}
                      style={styles.picker}
                    >
                      <Picker.Item label="Selecciona un banco" value="" />
                      {bankOptions.map((b) => (
                        <Picker.Item key={b.code} label={`${b.name} (${b.code})`} value={b.code} />
                      ))}
                    </Picker>
                  </View>

                  <Text style={styles.formLabel}>Número de cuenta</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="20 dígitos"
                    placeholderTextColor="#9E9E9E"
                    keyboardType="number-pad"
                    value={cuentaForm.cuenta}
                    onChangeText={(t) => {
                      const digits = t.replace(/\D/g, '');
                      setCuentaForm((prev) => ({ ...prev, cuenta: digits }));
                    }}
                  />

                  <Text style={styles.formLabel}>C.I. o RIF</Text>
                  <View style={styles.inlineIdRow}>
                    <View style={styles.inlineIdSelector}>
                      {([
                        { key: 'V', label: 'V', sub: 'Venezolano' },
                        { key: 'J', label: 'J', sub: 'Jurídico/Comercio' },
                      ] as const).map((opt) => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.inlinePill, cuentaForm.idType === opt.key && styles.inlinePillActive]}
                          onPress={() => setCuentaForm((prev) => ({ ...prev, idType: opt.key }))}
                        >
                          <Text style={[styles.inlinePillLabel, cuentaForm.idType === opt.key && styles.inlinePillLabelActive]}>{opt.label}</Text>
                          <Text style={[styles.inlinePillSub, cuentaForm.idType === opt.key && styles.inlinePillSubActive]}>{opt.sub}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={[styles.input, styles.inlineIdInput]}
                      placeholder="12345678"
                      placeholderTextColor="#9E9E9E"
                      keyboardType="number-pad"
                      value={cuentaForm.rif}
                      onChangeText={(t) => {
                        const digits = t.replace(/\D/g, '');
                        setCuentaForm((prev) => ({ ...prev, rif: digits }));
                      }}
                    />
                  </View>
                </View>
              )}

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => setShowPaymentModal(false)}>
                  <Text style={styles.buttonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton, savingPayment && { opacity: 0.7 }]}
                  onPress={() => handleSavePaymentMethods(activePaymentTab)}
                  disabled={savingPayment}
                >
                  <Text style={styles.buttonText}>{savingPayment ? 'Guardando...' : 'Guardar métodos'}</Text>
                </TouchableOpacity>
              </View>

              {paymentError ? (
                <Text style={styles.errorText}>{paymentError}</Text>
              ) : null}

              <Text style={styles.modalHelper}>Se registra quién y cuándo modifica los métodos de pago.</Text>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Actividad Reciente */}
      <Modal
        visible={showActivityModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowActivityModal(false)}
      >
        <View style={styles.activityModalOverlay}>
          <View style={styles.activityModalContent}>
            <View style={styles.activityModalHeader}>
              <Text style={styles.activityModalTitle}>Actividad Reciente</Text>
              <TouchableOpacity onPress={() => setShowActivityModal(false)}>
                <FontAwesome5 name="times" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.activityModalList} contentContainerStyle={styles.activityModalListContent}>
              {recentActivityAll.map((activity) => (
                <View key={activity.id} style={styles.activityModalItem}>
                  <View style={[styles.activityIcon, { backgroundColor: getActivityColor(activity.type) }]}>
                    <FontAwesome5 name={getActivityIcon(activity.type)} size={14} color="#fff" />
                  </View>
                  <View style={styles.activityModalBody}>
                    <Text style={styles.activityMessage}>{activity.message}</Text>
                    <Text style={styles.activityMeta}>
                      {activity.user} • {activity.time}
                      {activity.status ? ` • ${activity.status}` : ''}
                      {activity.total !== undefined ? ` • ${formatCurrency(activity.total)}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Historial Métodos de Pago */}
      <Modal
        visible={showPaymentHistoryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPaymentHistoryModal(false)}
      >
        <View style={styles.activityModalOverlay}>
          <View style={styles.activityModalContent}>
            <View style={styles.activityModalHeader}>
              <Text style={styles.activityModalTitle}>Historial Métodos de Pago</Text>
              <TouchableOpacity onPress={() => setShowPaymentHistoryModal(false)}>
                <FontAwesome5 name="times" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.activityModalList} contentContainerStyle={styles.activityModalListContent}>
              {paymentHistory.length === 0 && (
                <Text style={styles.activityMeta}>Sin registros aún.</Text>
              )}
              {paymentHistory.map((item) => (
                <View key={item.id} style={styles.activityModalItem}>
                  <View style={[styles.activityIcon, { backgroundColor: colors.secondary }]}>
                    <FontAwesome5 name="credit-card" size={14} color="#fff" />
                  </View>
                  <View style={styles.activityModalBody}>
                    <Text style={styles.activityMessage}>{item.target || 'Métodos de pago'}</Text>
                    <Text style={styles.activityMeta}>
                      {item.updatedBy || 'N/D'} • {formatDateTime(item.updatedAt)}
                    </Text>
                    {item.pagoMovil ? (
                      <Text style={styles.activityMeta}>
                        Pago Móvil: {bankLabel(item.pagoMovil.banco, item.pagoMovil.bancoCodigo)} • Tel {item.pagoMovil.telefono}
                      </Text>
                    ) : null}
                    {item.cuenta ? (
                      <Text style={styles.activityMeta}>
                        Cuenta: {bankLabel(item.cuenta.banco, item.cuenta.bancoCodigo)} • {item.cuenta.cuenta}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Historial Precio Botellón */}
      <Modal
        visible={showPriceHistoryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPriceHistoryModal(false)}
      >
        <View style={styles.activityModalOverlay}>
          <View style={styles.activityModalContent}>
            <View style={styles.activityModalHeader}>
              <Text style={styles.activityModalTitle}>Historial Precio Botellón</Text>
              <TouchableOpacity onPress={() => setShowPriceHistoryModal(false)}>
                <FontAwesome5 name="times" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.activityModalList} contentContainerStyle={styles.activityModalListContent}>
              {priceHistory.length === 0 && (
                <Text style={styles.activityMeta}>Sin registros aún.</Text>
              )}
              {priceHistory.map((item) => (
                <View key={item.id} style={styles.activityModalItem}>
                  <View style={[styles.activityIcon, { backgroundColor: colors.success }]}>
                    <FontAwesome5 name="dollar-sign" size={14} color="#fff" />
                  </View>
                  <View style={styles.activityModalBody}>
                    <Text style={styles.activityMessage}>Actualización de precio</Text>
                    <Text style={styles.activityMeta}>
                      {(item.user?.nombre || item.user?.email || 'N/D')} • {formatDateTime(item.updatedAt)}
                    </Text>
                    <Text style={styles.activityMeta}>
                      {item.price !== undefined ? `Normal: ${formatCurrency(item.price)} ` : ''}
                      {item.priceHigh !== undefined ? `| Alta prioridad: ${formatCurrency(item.priceHigh)}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

type FinancialState = 'por_cobrar' | 'por_confirmar_pago' | 'cobrado' | 'pagado' | 'cancelado';

type PaymentMobile = {
  banco: string;
  bancoCodigo: string;
  telefono: string;
  rif: string;
  idType: 'V' | 'J';
  qrUrl?: string;
};

type PaymentAccount = {
  banco: string;
  bancoCodigo: string;
  cuenta: string;
  rif: string;
  idType: 'V' | 'J';
};

type Activity = {
  id: number | string;
  type: string;
  message: string;
  time: string;
  user: string;
  status?: string;
  total?: number;
};

type PaymentHistoryEntry = {
  id: string;
  updatedAt?: Date;
  updatedBy?: string;
  target?: string;
  pagoMovil?: any;
  cuenta?: any;
};

type PriceHistoryEntry = {
  id: string;
  updatedAt?: Date;
  user?: { uid?: string; nombre?: string; email?: string };
  price?: number;
  priceHigh?: number;
};

type PendingOrder = {
  id: string;
  numeroPedido?: number;
  fecha?: string;
  estado?: string;
};

// Web-safe shadows: use boxShadow on web, keep native shadows elsewhere
const shadowElev3 = Platform.select({
  web: { boxShadow: '0px 2px 6px rgba(0,0,0,0.08)' } as any,
  default: {
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
});

const shadowElev5 = Platform.select({
  web: { boxShadow: '0px 4px 10px rgba(0,0,0,0.10)' } as any,
  default: {
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
});

const shadowElev6 = Platform.select({
  web: { boxShadow: '0px 3px 8px rgba(0,0,0,0.12)' } as any,
  default: {
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // Header ahora está dentro del ScrollView
  header: {
    paddingTop: 50,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...shadowElev5,
  },
  // Contenedor para el contenido debajo del header
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
  },
  loadingGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 30,
  },
  loadingSubtext: {
    fontSize: 16,
    color: '#fff',
    marginTop: 20,
  },
  loadingSpinner: {
    marginTop: 10,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10,
  },
  headerIcons: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 15,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#F44336',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  notificationOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
    paddingTop: 60, // baja el panel para no tapar el ícono
    paddingRight: 72, // deja libre la campana
    paddingLeft: 10,
    alignItems: 'flex-end',
    zIndex: 10,
  },
  notificationPanel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    ...shadowElev6,
    width: 320,
    minHeight: 160,
    marginTop: 0,
    maxHeight: '70%',
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  notificationTextDark: {
    fontSize: 13,
    color: '#555',
  },
  notificationItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  notificationItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
  },
  notificationItemSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  notificationList: {
    maxHeight: 320,
  },
  notificationListContent: {
    paddingBottom: 6,
  },
  userInfo: {
    alignItems: 'flex-start',
  },
  welcomeText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  userRole: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    marginTop: 10,
  },
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  card: {
    flexGrow: 1,
    flexBasis: '48%',
    maxWidth: 420,
    minWidth: 260,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    alignItems: 'center',
  },
  cardFull: {
    width: '100%',
  },
  cardElevated: {
    ...shadowElev5,
  },
  cardIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 5,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  cardChange: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: '48%',
    maxWidth: 420,
    minWidth: 260,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
  },
  metricCardFull: {
    width: '100%',
  },
  metricCardElevated: {
    ...shadowElev3,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  metricSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  sectionElevated: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    ...shadowElev3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  viewAllText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  chartContainer: {
    marginBottom: 15,
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 150,
  },
  chartBarWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  chartBarBackground: {
    height: 120,
    width: 20,
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  chartBar: {
    width: 20,
    borderRadius: 10,
  },
  chartLabel: {
    fontSize: 12,
    color: '#757575',
  },
  chartStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 15,
  },
  chartStat: {
    alignItems: 'center',
  },
  chartStatLabel: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 5,
  },
  chartStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  positiveGrowth: {
    color: '#4CAF50',
  },
  negativeGrowth: {
    color: '#EF4444',
  },
  chartSection: {
    marginBottom: 20,
  },
  activitySection: {
    marginBottom: 20,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityMessage: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  activityMeta: {
    fontSize: 12,
    color: '#757575',
  },
  settingsContainer: {
    marginBottom: 20,
  },
  infoBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
  },
  infoBoxElevated: {
    ...shadowElev3,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
  },
  infoContent: {
    paddingLeft: 5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  toggleButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    ...shadowElev3,
  },
  toggleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
  },
  passwordBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  passwordForm: {
    marginTop: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    marginBottom: 15,
    paddingHorizontal: 15,
    backgroundColor: '#FAFAFA',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  paymentSummaryColumn: {
    flexDirection: 'column',
  },
  paymentChip: {
    flex: 1,
    backgroundColor: '#F7FBFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5F0FF',
  },
  paymentChipTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F1724',
    marginBottom: 4,
  },
  paymentChipText: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
  },
  paymentChipSub: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  paymentActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  paymentButton: {
    flex: 1,
  },
  auditToggleText: {
    marginLeft: 12,
    color: '#2563eb',
    fontWeight: '600',
  },
  historyActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    width: '100%',
    maxHeight: '85%',
    ...Platform.select({ web: { maxWidth: 520, alignSelf: 'center' } }),
  },
  modalScroll: {
    paddingBottom: 12,
    gap: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#E0F2FE',
  },
  tabButtonText: {
    color: '#475569',
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#0ea5e9',
  },
  inlineIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  inlineIdSelector: {
    flexDirection: 'row',
    gap: 6,
  },
  inlineIdInput: {
    flex: 1,
  },
  inlinePill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    minWidth: 90,
  },
  inlinePillActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#38bdf8',
  },
  inlinePillLabel: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 14,
  },
  inlinePillLabelActive: {
    color: '#0ea5e9',
  },
  inlinePillSub: {
    color: '#475569',
    fontSize: 11,
  },
  inlinePillSubActive: {
    color: '#0ea5e9',
  },
  qrPreviewBox: {
    marginTop: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qrPreviewImage: {
    width: '100%',
    height: 160,
    marginBottom: 6,
  },
  qrPreviewText: {
    fontSize: 12,
    color: '#475569',
  },
  formSection: {
    gap: 10,
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#E2E8F0',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#0ea5e9',
  },
  modalHelper: {
    marginTop: 10,
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 8,
    color: '#DC2626',
    fontSize: 12,
    textAlign: 'center',
  },
  bottomSpacing: {
    height: 20,
  },
  activityModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  activityModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxHeight: '80%',
    ...Platform.select({ web: { maxWidth: 520, alignSelf: 'center' } }),
  },
  activityModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  activityModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  activityModalList: {
    maxHeight: 480,
  },
  activityModalListContent: {
    paddingBottom: 10,
    gap: 10,
  },
  activityModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  activityModalBody: {
    flex: 1,
  },
});

export default DashboardScreen;