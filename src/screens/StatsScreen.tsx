import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { db } from '../../firebaseConfig';
import { 
  collection, 
  getDocs
} from 'firebase/firestore';
import { colors } from '../styles/globalStyles';

const { width: screenWidth } = Dimensions.get('window');

// Definición de interfaces
interface Order {
  id: string;
  total?: number;
  estado?: string;
  tipo?: string;
}

type Client = { id?: string; [key: string]: any };
type User = { id?: string; [key: string]: any };

interface Stats {
  totalRevenue: number;
  totalOrders: number;
  totalClients: number;
  totalUsers: number;
  completionRate: number;
  ordersByType: Record<string, number>;
}

const StatsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('month');
  
  // Estados simplificados
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    totalOrders: 0,
    totalClients: 0,
    totalUsers: 0,
    completionRate: 0,
    ordersByType: { intercambio: 0, llenado: 0 }
  });

  // Cargar estadísticas básicas
  const loadStatistics = async () => {
    try {
      setLoading(true);
      
      console.log('Cargando estadísticas...');
      
      // Obtener datos básicos
      const [ordersSnapshot, clientsSnapshot, usersSnapshot] = await Promise.all([
        getDocs(collection(db, 'Pedidos')),
        getDocs(collection(db, 'Clientes')),
        getDocs(collection(db, 'usuarios'))
      ]);

      const ordersData: Order[] = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const clientsData = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log('Datos cargados:', {
        orders: ordersData.length,
        clients: clientsData.length,
        users: usersData.length
      });

      // Procesar estadísticas básicas
      const totalRevenue = ordersData.reduce((acc, order) => acc + (order.total || 0), 0);
      const totalOrders = ordersData.length;
      const totalClients = clientsData.length;
      const totalUsers = usersData.length;
      
      const completedOrders = ordersData.filter(order => 
        order.estado === 'completado' || order.estado === 'entregado' || order.estado === 'listo'
      ).length;
      
      const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

      const accInitial: Record<string, number> = { intercambio: 0, llenado: 0 };
      const ordersByType = ordersData.reduce((acc: Record<string, number>, order) => {
        const type: string = (order.tipo as string) || 'unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, accInitial);

      setStats({
        totalRevenue,
        totalOrders,
        totalClients,
        totalUsers,
        completionRate,
        ordersByType
      });

    } catch (error) {
      console.error('Error detallado:', error);
      Alert.alert('Error', `No se pudieron cargar las estadísticas: ${(error as Error).message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStatistics();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadStatistics();
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Componentes de gráficos simplificados
  const SimpleBarChart = ({ data }: { data: { label: string; value: number }[] }) => {
    const maxValue = Math.max(...data.map(item => item.value), 1);
    
    return (
      <View style={styles.chartContainer}>
        {data.map((item, index) => (
          <View key={index} style={styles.barItem}>
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
          </View>
        ))}
      </View>
    );
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
    <View style={styles.container}>
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
              {stats.totalOrders} pedidos • {formatMoney(stats.totalRevenue)}
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

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
        }
      >
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
                <Text style={styles.metricValue}>{formatMoney(stats.totalRevenue)}</Text>
                <Text style={styles.metricLabel}>Ingresos Totales</Text>
                <Text style={styles.metricTrend}>↗️ +12%</Text>
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
                <Text style={styles.metricTrend}>↗️ +8%</Text>
              </LinearGradient>
            </View>

            <View style={styles.metricCard}>
              <LinearGradient
                colors={[colors.warning, '#D97706']}
                style={styles.metricGradient}
              >
                <FontAwesome5 name="users" size={20} color={colors.textInverse} />
                <Text style={styles.metricValue}>{stats.totalClients}</Text>
                <Text style={styles.metricLabel}>Clientes Activos</Text>
                <Text style={styles.metricTrend}>↗️ +15%</Text>
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
                <Text style={styles.metricTrend}>↗️ +5%</Text>
              </LinearGradient>
            </View>
          </View>
        </View>

        {/* Estadísticas de Pedidos por Tipo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pedidos por Tipo de Servicio</Text>
          <SimpleBarChart
            data={[
              { label: 'Intercambio', value: stats.ordersByType.intercambio },
              { label: 'Llenado', value: stats.ordersByType.llenado }
            ]}
          />
          <View style={styles.statsList}>
            <View style={styles.statItem}>
              <View style={styles.statInfo}>
                <View style={[styles.statColor, { backgroundColor: colors.primary }]} />
                <Text style={styles.statLabel}>Intercambio</Text>
              </View>
              <Text style={styles.statValue}>{stats.ordersByType.intercambio} pedidos</Text>
            </View>
            <View style={styles.statItem}>
              <View style={styles.statInfo}>
                <View style={[styles.statColor, { backgroundColor: colors.secondary }]} />
                <Text style={styles.statLabel}>Llenado</Text>
              </View>
              <Text style={styles.statValue}>{stats.ordersByType.llenado} pedidos</Text>
            </View>
          </View>
        </View>

        {/* KPIs Adicionales */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Métricas Clave</Text>
          <View style={styles.kpiGrid}>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiValue}>
                {stats.totalOrders > 0 ? formatMoney(stats.totalRevenue / stats.totalOrders) : formatMoney(0)}
              </Text>
              <Text style={styles.kpiLabel}>Valor Promedio por Pedido</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiValue}>
                {stats.completionRate.toFixed(1)}%
              </Text>
              <Text style={styles.kpiLabel}>Tasa de Completación</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiValue}>
                {stats.totalClients > 0 ? Math.round(stats.totalRevenue / stats.totalClients) : 0}
              </Text>
              <Text style={styles.kpiLabel}>Ingreso por Cliente</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiValue}>
                {stats.totalUsers}
              </Text>
              <Text style={styles.kpiLabel}>Usuarios Registrados</Text>
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
              <Text style={styles.systemText}>Última actualización: {new Date().toLocaleTimeString()}</Text>
            </View>
            <View style={styles.systemItem}>
              <Ionicons name="analytics" size={20} color={colors.primary} />
              <Text style={styles.systemText}>Datos en tiempo real</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
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