// SalesScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Alert
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { formatCurrency } from '../utils/currency';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../styles/globalStyles';

// Interfaz para pedidos
interface PedidoDoc {
  id: string;
  clienteId: string;      // ID del cliente
  fecha: string;          // "YYYY-MM-DD"
  total: number;          // Monto en USD
  cantidadConAsa: number;
  cantidadSinAsa: number;
  // ... otros campos opcionales
}

// Interfaz para clientes
interface ClienteDoc {
  id: string;             // UID del cliente
  cedula: number;         // Campo cédula
  nombre: string;         // Nombre del cliente
  // ... otros campos (telefono, etc.)
}



// Tipos de búsqueda de fecha
type SearchMode = 'dia' | 'semana' | 'mes' | 'ano' | 'rango';

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 520;

const SalesScreen = () => {
  // --- Estados principales ---
  const [pedidos, setPedidos] = useState<PedidoDoc[]>([]);
  const [clientesMap, setClientesMap] = useState<Record<string, { cedula: number; nombre: string }>>({});
  
  // Filtros de cliente
  const [cedulaFilter, setCedulaFilter] = useState('');   // para buscar por cédula
  const [nombreFilter, setNombreFilter] = useState('');   // para buscar por nombre
  // Modo de búsqueda de fechas
  const [searchMode, setSearchMode] = useState<SearchMode>('dia');

  // Fechas a ingresar, según el modo
  const [searchDay, setSearchDay] = useState('');     // YYYY-MM-DD
  const [searchWeek, setSearchWeek] = useState('');   // YYYY-MM-DD (lunes)
  const [searchMonth, setSearchMonth] = useState(''); // YYYY-MM
  const [searchYear, setSearchYear] = useState('');   // YYYY
  const [rangeFrom, setRangeFrom] = useState('');     // YYYY-MM-DD
  const [rangeTo, setRangeTo] = useState('');         // YYYY-MM-DD

  // Date picker UI
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<'day' | 'week' | 'month' | 'year' | 'from' | 'to'>('day');
  const [tempDate, setTempDate] = useState(new Date());

  // Helpers de sanitización (no tocar formatos de fecha)
  const sanitizeNumeric = (text: string) => text.replace(/[^0-9]/g, '');
  const sanitizeName = (text: string) => text.replace(/[^A-Za-z\u00C0-\u017F\s]/g, '');
  const sanitizeYMD = (text: string) => text.replace(/[^0-9-]/g, '').slice(0, 10);
  const sanitizeYM = (text: string) => {
    const cleaned = text.replace(/[^0-9-]/g, '');
    const [yearRaw = '', monthRaw = ''] = cleaned.split('-');
    const year = yearRaw.slice(0, 4);
    const month = monthRaw.slice(0, 2);
    return month ? `${year}-${month}` : year;
  };
  const sanitizeY = (text: string) => text.replace(/[^0-9]/g, '').slice(0, 4);

  // Helpers de fecha
  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const formatYM = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const formatY = (d: Date) => `${d.getFullYear()}`;

  const startOfWeekMonday = (d: Date) => {
    const day = d.getDay(); // 0 dom, 1 lun
    const diff = (day === 0 ? -6 : 1 - day); // mover al lunes
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    return monday;
  };

  const openPicker = (target: typeof datePickerTarget) => {
    setDatePickerTarget(target);
    let base = new Date();
    switch (target) {
      case 'day': base = searchDay ? new Date(searchDay) : base; break;
      case 'week': base = searchWeek ? new Date(searchWeek) : base; break;
      case 'month': base = searchMonth ? new Date(`${searchMonth}-01`) : base; break;
      case 'year': base = searchYear ? new Date(`${searchYear}-01-01`) : base; break;
      case 'from': base = rangeFrom ? new Date(rangeFrom) : base; break;
      case 'to': base = rangeTo ? new Date(rangeTo) : base; break;
    }
    setTempDate(base);
    setShowDatePicker(true);
  };

  const handleDateChange = (_: any, selected?: Date) => {
    setShowDatePicker(false);
    if (!selected) return;
    switch (datePickerTarget) {
      case 'day':
        setSearchDay(formatYMD(selected));
        setSearchMode('dia');
        break;
      case 'week': {
        const monday = startOfWeekMonday(selected);
        setSearchWeek(formatYMD(monday));
        setSearchMode('semana');
        break;
      }
      case 'month':
        setSearchMonth(formatYM(selected));
        setSearchMode('mes');
        break;
      case 'year':
        setSearchYear(formatY(selected));
        setSearchMode('ano');
        break;
      case 'from':
        setRangeFrom(formatYMD(selected));
        setSearchMode('rango');
        break;
      case 'to':
        setRangeTo(formatYMD(selected));
        setSearchMode('rango');
        break;
    }
  };

  // Resultados filtrados
  const [filteredPedidos, setFilteredPedidos] = useState<PedidoDoc[]>([]);
  // Totales
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [botellonesCount, setBotellonesCount] = useState<number>(0);
  const [conAsaCount, setConAsaCount] = useState<number>(0);
  const [sinAsaCount, setSinAsaCount] = useState<number>(0);

  // --- Suscripciones a Firestore ---
  useEffect(() => {
    // Pedidos
    const unsubPedidos = onSnapshot(collection(db, 'Pedidos'), (snapshot) => {
      const data: PedidoDoc[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<PedidoDoc, 'id'>),
      }));
      setPedidos(data);
    });

    // Clientes
    const unsubClientes = onSnapshot(collection(db, 'Clientes'), (snapshot) => {
      const map: Record<string, { cedula: number; nombre: string }> = {};
      snapshot.forEach((doc) => {
        // Ej: { cedula: 12345678, nombre: "José" }
        const d = doc.data() as { cedula: number; nombre: string };
        map[doc.id] = { ...d };
      });
      setClientesMap(map);
    });

    return () => {
      unsubPedidos();
      unsubClientes();
    };
  }, []);

  // --- Filtrado + Cálculo de totales ---
  useEffect(() => {
    // 1) Filtrar por cédula y nombre
    let temp = [...pedidos];
    // a) cédula
    if (cedulaFilter.trim() !== '') {
      const cedulaNum = parseInt(cedulaFilter.trim(), 10);
      if (!isNaN(cedulaNum)) {
        temp = temp.filter((p) => {
          const cData = clientesMap[p.clienteId];
          if (!cData) return false;
          return cData.cedula === cedulaNum;
        });
      } else {
        // si no es numérico => sin resultados
        temp = [];
      }
    }

    // b) nombre
    if (nombreFilter.trim() !== '') {
      const nameLow = nombreFilter.trim().toLowerCase();
      temp = temp.filter((p) => {
        const cData = clientesMap[p.clienteId];
        if (!cData) return false;
        return cData.nombre.toLowerCase().includes(nameLow);
      });
    }

    // 2) Filtrar por fecha (día, semana, mes, año o rango)
    const filteredByDates = filterByDateMode(temp, searchMode, {
      day: searchDay,
      week: searchWeek,
      month: searchMonth,
      year: searchYear,
      from: rangeFrom,
      to: rangeTo,
    });
    setFilteredPedidos(filteredByDates);

    // 3) Calcular totales
    let sumTotal = 0;
    let sumBot = 0;
    let sumConAsa = 0;
    let sumSinAsa = 0;
    filteredByDates.forEach((p) => {
      sumTotal += p.total;
      sumBot += (p.cantidadConAsa + p.cantidadSinAsa);
      sumConAsa += p.cantidadConAsa;
      sumSinAsa += p.cantidadSinAsa;
    });
    setTotalAmount(sumTotal);
    setBotellonesCount(sumBot);
    setConAsaCount(sumConAsa);
    setSinAsaCount(sumSinAsa);

  }, [
    pedidos,
    clientesMap,
    cedulaFilter,
    nombreFilter,
    searchMode,
    searchDay,
    searchWeek,
    searchMonth,
    searchYear,
    rangeFrom,
    rangeTo,
  ]);

  // Función para limpiar filtros
  const clearFilters = () => {
    setCedulaFilter('');
    setNombreFilter('');
    setSearchDay('');
    setSearchWeek('');
    setSearchMonth('');
    setSearchYear('');
    setRangeFrom('');
    setRangeTo('');
    setSearchMode('dia');
  };

  // --- Render de cada pedido ---
  const renderPedidoItem = ({ item, index }: { item: PedidoDoc; index: number }) => {
    // Obtenemos cédula y nombre
    const cData = clientesMap[item.clienteId];
    const cedula = cData?.cedula ?? 0;
    const nombre = cData?.nombre ?? 'Desconocido';

    return (
      <View style={[
        styles.pedidoItem,
        index % 2 === 0 ? styles.pedidoItemEven : styles.pedidoItemOdd
      ]}>
        <View style={styles.pedidoHeader}>
          <View style={styles.pedidoDateContainer}>
            <Icon name="event" size={16} color={colors.textSecondary} />
            <Text style={styles.pedidoDate}>{formatDate(item.fecha)}</Text>
          </View>
                  <Text style={styles.pedidoTotal}>{formatCurrency(item.total)}</Text>
        </View>
        
        <View style={styles.pedidoDetails}>
          <View style={styles.botellonesContainer}>
            <View style={styles.botellonType}>
              <Icon name="local-drink" size={16} color={colors.secondary} />
              <Text style={styles.botellonText}>Con asa: {item.cantidadConAsa}</Text>
            </View>
            <View style={styles.botellonType}>
              <Icon name="water" size={16} color={colors.secondary} />
              <Text style={styles.botellonText}>Sin asa: {item.cantidadSinAsa}</Text>
            </View>
          </View>
          
          <View style={styles.clienteInfo}>
            <Icon name="person" size={16} color={colors.textSecondary} />
            <Text style={styles.clienteText}>{nombre}</Text>
            <Text style={styles.cedulaText}>C.I. {cedula}</Text>
          </View>
        </View>
      </View>
    );
  };

  // Función para formatear fecha
  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={colors.secondaryDark} barStyle="light-content" />
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient colors={colors.gradientSecondary} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <View style={[styles.headerContent, isSmallScreen && styles.headerContentStack]}>
            <Text style={styles.headerTitle}>Panel de Ventas</Text>
            <Text style={styles.headerSubtitle}>Gestión y consulta de pedidos</Text>
            {isSmallScreen && (
              <View style={styles.headerActionsRow}>
                <TouchableOpacity style={styles.filterButton} onPress={clearFilters}>
                  <Icon name="filter-alt" size={20} color={colors.textInverse} />
                  <Text style={styles.filterButtonText}>Limpiar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {!isSmallScreen && (
            <TouchableOpacity style={styles.filterButton} onPress={clearFilters}>
              <Icon name="filter-alt" size={20} color={colors.textInverse} />
              <Text style={styles.filterButtonText}>Limpiar</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Filtros de cliente */}
          <View style={styles.filterSection}>
            <Text style={styles.sectionTitle}>Filtrar por Cliente</Text>
            <View style={[styles.inputRow, isSmallScreen && styles.inputRowStack]}>
              <View style={styles.inputContainer}>
                <Icon name="badge" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Cédula del cliente"
                  value={cedulaFilter}
                  onChangeText={(text) => setCedulaFilter(sanitizeNumeric(text))}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputContainer}>
                <Icon name="person" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nombre del cliente"
                  value={nombreFilter}
                  onChangeText={(text) => setNombreFilter(sanitizeName(text))}
                />
              </View>
            </View>
          </View>

          {/* Selector de modo de búsqueda */}
          <View style={styles.filterSection}>
            <Text style={styles.sectionTitle}>Filtrar por Fecha</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.modesContainer}
            >
              <ModeButton
                label="Día"
                icon="today"
                selected={searchMode === 'dia'}
                onPress={() => setSearchMode('dia')}
              />
              <ModeButton
                label="Semana"
                icon="date-range"
                selected={searchMode === 'semana'}
                onPress={() => setSearchMode('semana')}
              />
              <ModeButton
                label="Mes"
                icon="calendar-view-month"
                selected={searchMode === 'mes'}
                onPress={() => setSearchMode('mes')}
              />
              <ModeButton
                label="Año"
                icon="event-note"
                selected={searchMode === 'ano'}
                onPress={() => setSearchMode('ano')}
              />
              <ModeButton
                label="Rango"
                icon="event-available"
                selected={searchMode === 'rango'}
                onPress={() => setSearchMode('rango')}
              />
            </ScrollView>

            {/* Inputs según el modo de fecha */}
            <View style={styles.dateInputsContainer}>
              {searchMode === 'dia' && (
                <View style={styles.inputContainer}>
                  <Icon name="today" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    value={searchDay}
                    onChangeText={(text) => setSearchDay(sanitizeYMD(text))}
                  />
                </View>
              )}
              {searchMode === 'semana' && (
                <View style={styles.inputContainer}>
                  <Icon name="view-week" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Fecha del lunes (YYYY-MM-DD)"
                    value={searchWeek}
                    onChangeText={(text) => setSearchWeek(sanitizeYMD(text))}
                  />
                </View>
              )}
              {searchMode === 'mes' && (
                <View style={styles.inputContainer}>
                  <Icon name="calendar-today" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM (ej. 2025-03)"
                    value={searchMonth}
                    onChangeText={(text) => setSearchMonth(sanitizeYM(text))}
                  />
                </View>
              )}
              {searchMode === 'ano' && (
                <View style={styles.inputContainer}>
                  <Icon name="event" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY (ej. 2025)"
                    value={searchYear}
                    onChangeText={(text) => setSearchYear(sanitizeY(text))}
                  />
                </View>
              )}
              {searchMode === 'rango' && (
                <View style={[styles.rangeContainer, isSmallScreen && styles.rangeContainerStack]}>
                  <View style={styles.inputContainer}>
                    <Icon name="arrow-forward" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Desde (YYYY-MM-DD)"
                      value={rangeFrom}
                      onChangeText={(text) => setRangeFrom(sanitizeYMD(text))}
                    />
                  </View>
                  <View style={styles.inputContainer}>
                    <Icon name="arrow-back" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Hasta (YYYY-MM-DD)"
                      value={rangeTo}
                      onChangeText={(text) => setRangeTo(sanitizeYMD(text))}
                    />
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Resumen compacto */}
          <View style={styles.resultsSummary}>
            <Text style={styles.resultsHeadline}>
              {filteredPedidos.length} pedidos • {formatCurrency(totalAmount)} • {botellonesCount} botellones
            </Text>
            <Text style={styles.resultsDetail}>
              Con asa: {conAsaCount} • Sin asa: {sinAsaCount}
            </Text>
          </View>

          {/* Lista de pedidos filtrados */}
          <View style={styles.pedidosSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pedidos Encontrados</Text>
              <Text style={styles.pedidosCount}>{filteredPedidos.length} resultados</Text>
            </View>
            
            {filteredPedidos.length === 0 ? (
              <View style={styles.noDataContainer}>
                <Icon name="search-off" size={48} color={colors.textSecondary} />
                <Text style={styles.noDataText}>No se encontraron pedidos</Text>
                <Text style={styles.noDataSubtext}>Ajusta los filtros para ver resultados</Text>
              </View>
            ) : (
              <FlatList
                data={filteredPedidos}
                keyExtractor={(item) => item.id}
                renderItem={renderPedidoItem}
                scrollEnabled={false}
                contentContainerStyle={styles.pedidosList}
              />
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default SalesScreen;

// ========== Helpers de filtro de fecha ===============
function filterByDateMode(
  pedidos: PedidoDoc[],
  mode: SearchMode,
  fields: {
    day: string;
    week: string;
    month: string;
    year: string;
    from: string;
    to: string;
  }
): PedidoDoc[] {
  const { day, week, month, year, from, to } = fields;
  
  // Parse "YYYY-MM-DD" -> Date
  const parseDate = (str: string): Date | null => {
    if (!str || str.length < 10) return null;
    const [yyyy, mm, dd] = str.split('-');
    const Y = parseInt(yyyy, 10);
    const M = parseInt(mm, 10) - 1;
    const D = parseInt(dd, 10);
    if (isNaN(Y) || isNaN(M) || isNaN(D)) return null;
    return new Date(Y, M, D);
  };

  return pedidos.filter((pedido) => {
    const dateObj = parseDate(pedido.fecha);
    if (!dateObj) return false;

    switch (mode) {
      case 'dia': {
        const dayObj = parseDate(day);
        if (!dayObj) return true; // si no especifica => no filtra
        return sameDay(dateObj, dayObj);
      }
      case 'semana': {
        const mondayObj = parseDate(week);
        if (!mondayObj) return true; 
        const lastDay = new Date(mondayObj);
        lastDay.setDate(mondayObj.getDate() + 6);
        return dateObj >= mondayObj && dateObj <= lastDay;
      }
      case 'mes': {
        if (!month || month.length < 7) return true;
        const [yyyy, mm] = month.split('-');
        const Y = parseInt(yyyy, 10);
        const M = parseInt(mm, 10) - 1;
        if (isNaN(Y) || isNaN(M)) return true;
        return dateObj.getFullYear() === Y && dateObj.getMonth() === M;
      }
      case 'ano': {
        if (!year || year.length < 4) return true;
        const Y = parseInt(year, 10);
        if (isNaN(Y)) return true;
        return dateObj.getFullYear() === Y;
      }
      case 'rango': {
        const fromDate = parseDate(from);
        const toDate = parseDate(to);
        if (!fromDate || !toDate) return true;
        return dateObj >= fromDate && dateObj <= toDate;
      }
      default:
        return true; // si no se reconoce => no se filtra
    }
  });
}

function sameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  );
}

// ========== Botón de Modo de Búsqueda ===============
const ModeButton = ({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: string;
  selected: boolean;
  onPress: () => void;
}) => {
  return (
    <TouchableOpacity
      style={[styles.modeButton, selected && styles.modeButtonSelected]}
      onPress={onPress}
    >
      <Icon 
        name={icon} 
        size={18} 
        color={selected ? colors.surface : colors.secondary} 
      />
      <Text style={[styles.modeButtonText, selected && styles.modeButtonTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

// ========== Estilos ===============
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerContent: {
    flex: 1,
  },
  headerContentStack: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textInverse,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textInverse,
  },
  headerActionsRow: {
    marginTop: 6,
    width: '100%',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterButtonText: {
    color: colors.surface,
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  filterSection: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputRowStack: {
    flexDirection: 'column',
    gap: 8,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginHorizontal: 4,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
  },
  modesContainer: {
    paddingVertical: 4,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.secondary,
    marginRight: 8,
    backgroundColor: colors.surface,
  },
  modeButtonSelected: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  modeButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: colors.secondary,
  },
  modeButtonTextSelected: {
    color: colors.surface,
  },
  dateInputsContainer: {
    marginTop: 12,
  },
  rangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeContainerStack: {
    flexDirection: 'column',
    gap: 8,
  },
  resultsSummary: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  resultsHeadline: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  resultsDetail: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  pedidosSection: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pedidosCount: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  pedidosList: {
    paddingBottom: 8,
  },
  pedidoItem: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  pedidoItemEven: {
    backgroundColor: colors.background,
  },
  pedidoItemOdd: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pedidoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pedidoDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pedidoDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  pedidoTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.secondary,
  },
  pedidoDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  botellonesContainer: {
    flex: 1,
  },
  botellonType: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  botellonText: {
    fontSize: 14,
    color: colors.textPrimary,
    marginLeft: 6,
  },
  clienteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clienteText: {
    fontSize: 14,
    color: colors.textPrimary,
    marginLeft: 6,
    marginRight: 8,
    fontWeight: '500',
  },
  cedulaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noDataText: {
    fontSize: 18,
    color: colors.textSecondary,
    marginTop: 12,
    fontWeight: '500',
  },
  noDataSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
});