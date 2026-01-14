import React, { useState, useEffect } from 'react'; 
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Animated, Alert, Platform } from 'react-native';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db, auth } from '../../firebaseConfig';
import { collection, onSnapshot, query, where, getDocs, DocumentData, orderBy, limit, doc, getDoc, setDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { colors } from '../styles/globalStyles';
import { formatCurrency } from '../utils/currency';
import { useGlobalConfig } from '../hooks/useGlobalConfig';

const { width } = Dimensions.get('window');

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
  const [monthlySales, setMonthlySales] = useState([12000, 15000, 18000, 22000, 19000, 25000]);
  const [topProducts, setTopProducts] = useState([
    { name: 'Botellón 20L', sales: 45 },
    { name: 'Botellón 10L', sales: 32 },
    { name: 'Botellón 5L', sales: 28 },
    { name: 'Dispensador', sales: 15 }
  ]);
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

  const showNotificationAlert = (title: string, message: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // Simular datos de actividad reciente
  useEffect(() => {
    const activities = [
      { id: 1, type: 'new_order', message: 'Nuevo pedido #00125', time: 'Hace 5 min', user: 'Carlos Pérez' },
      { id: 2, type: 'payment', message: 'Pago confirmado #00124', time: 'Hace 12 min', user: 'María González' },
      { id: 3, type: 'delivery', message: 'Entrega completada #00123', time: 'Hace 25 min', user: 'Juan Rodríguez' },
      { id: 4, type: 'new_client', message: 'Nuevo cliente registrado', time: 'Hace 1 hora', user: 'Ana Martínez' },
      { id: 5, type: 'stock', message: 'Stock bajo: Botellón 20L', time: 'Hace 2 horas', user: 'Sistema' }
    ];
    setRecentActivity(activities);
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

  // Contador en tiempo real de todos los pedidos (para la tarjeta)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'Pedidos'), (snapshot) => {
      setOrdersCount(snapshot.size);
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

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as { total?: number; fecha?: string };
        const ts = parseFecha(data.fecha);
        if (isNaN(ts)) return;
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
              <TouchableOpacity style={styles.iconButton}>
                <FontAwesome5 name="cog" size={20} color={colors.textInverse} />
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
                {!loadingNotifications && pendingOrders.length > 0 && pendingOrders.slice(0, 5).map((order) => (
                  <View key={order.id} style={styles.notificationItem}>
                    <Text style={styles.notificationItemTitle}>#{formatOrderNumber(order.numeroPedido)}</Text>
                    <Text style={styles.notificationItemSubtitle}>{order.estado ?? 'pendiente'} • {order.fecha ?? 'sin fecha'}</Text>
                  </View>
                ))}
                {!loadingNotifications && pendingOrders.length > 5 && (
                  <Text style={styles.notificationTextDark}>...y {pendingOrders.length - 5} más</Text>
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
                style={[styles.card, styles.cardElevated]}
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
              style={[styles.card, styles.cardElevated]}
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
              style={[styles.card, styles.cardElevated]}
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
              style={[styles.card, styles.cardElevated]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.cardIconContainer}>
                <FontAwesome5 name="shopping-cart" size={24} color="#fff" />
              </View>
              <Text style={styles.cardTitle}>Ventas</Text>
              <Text style={styles.cardValue}>
                {weeklySalesTotal !== null ? formatCurrency(weeklySalesTotal) : '...'}
              </Text>
              <Text style={styles.cardChange}>
                {weeklyGrowthPct !== null ? `${weeklyGrowthPct >= 0 ? '+' : ''}${weeklyGrowthPct.toFixed(1)}% vs semana previa` : 'Sin datos'}
              </Text>
            </LinearGradient>
          </View>

          {/* Métricas Avanzadas */}
          <View style={styles.metricsRow}>
            <View style={[styles.metricCard, styles.metricCardElevated]}>
              <View style={styles.metricHeader}>
                <FontAwesome5 name="chart-line" size={18} color="#4CAF50" />
                <Text style={styles.metricTitle}>Tasa de Conversión</Text>
              </View>
              <Text style={styles.metricValue}>24.5%</Text>
              <Text style={styles.metricSubtitle}>+2.1% vs mes anterior</Text>
            </View>

            <View style={[styles.metricCard, styles.metricCardElevated]}>
              <View style={styles.metricHeader}>
                <FontAwesome5 name="clock" size={18} color="#2196F3" />
                <Text style={styles.metricTitle}>Tiempo Respuesta</Text>
              </View>
              <Text style={styles.metricValue}>
                {avgResponseHours !== null ? `${avgResponseHours.toFixed(1)}h` : '...'}
              </Text>
              <Text style={styles.metricSubtitle}>
                {responseDeltaHours !== null ? `${responseDeltaHours >= 0 ? '+' : ''}${responseDeltaHours.toFixed(1)}h mejora` : '...'}
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
              labels={['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun']}
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

          {/* Productos Más Vendidos */}
          <View style={[styles.productsSection, styles.sectionElevated]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Productos Más Vendidos</Text>
              <TouchableOpacity>
                <Text style={styles.viewAllText}>Ver Todos</Text>
              </TouchableOpacity>
            </View>
            {topProducts.map((product, index) => (
              <View key={index} style={styles.productItem}>
                <View style={styles.productInfo}>
                  <View style={[styles.productIcon, { backgroundColor: ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0'][index] }]}>
                    <FontAwesome5 name="wine-bottle" size={16} color="#fff" />
                  </View>
                  <View>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productSales}>{product.sales} ventas este mes</Text>
                  </View>
                </View>
                <View style={styles.productBadge}>
                  <Text style={styles.productRank}>#{index + 1}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Actividad Reciente */}
          <View style={[styles.activitySection, styles.sectionElevated]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Actividad Reciente</Text>
              <TouchableOpacity>
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
    </View>
  );
};

type Activity = {
  id: number | string;
  type: string;
  message: string;
  time: string;
  user: string;
};

type PendingOrder = {
  id: string;
  numeroPedido?: number;
  fecha?: string;
  estado?: string;
};

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
    paddingTop: 10,
    paddingRight: 60, // deja libre la campana
    paddingLeft: 10,
    alignItems: 'flex-end',
    zIndex: 10,
  },
  notificationPanel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    width: 260,
    marginTop: 30,
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
    marginBottom: 20,
  },
  card: {
    width: (width - 50) / 2,
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
  },
  cardElevated: {
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
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
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metricCard: {
    width: (width - 50) / 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
  },
  metricCardElevated: {
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
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
    color: '#4CAF50',
  },
  sectionElevated: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
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
  productsSection: {
    marginBottom: 20,
  },
  activitySection: {
    marginBottom: 20,
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  productInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  productSales: {
    fontSize: 12,
    color: '#757575',
  },
  productBadge: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  productRank: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
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
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
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
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
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
  bottomSpacing: {
    height: 20,
  },
});

export default DashboardScreen;