import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { formatCurrency } from '../utils/currency';
import Toast from 'react-native-toast-message';

// Interfaz minimal para pedidos
interface PedidoDoc {
  id: string;
  clienteId: string;
  fecha: string;          // "YYYY-MM-DD"
  total: number;          // monto total
  cantidadConAsa: number;
  cantidadSinAsa: number;
  // ... otros campos si los necesitas
}

const colors = {
  primary: '#00B5E2',
  secondary: '#FF6565',
};

const InvoicesScreen = () => {
  const [pedidos, setPedidos] = useState<PedidoDoc[]>([]);
  
  // Filtrar por cliente (ID o nombre). Suponemos guardas clienteId.
  const [clienteFilter, setClienteFilter] = useState('');
  
  // Estadísticas
  const [totalDia, setTotalDia] = useState<number>(0);
  const [totalSemana, setTotalSemana] = useState<number>(0);
  const [totalMes, setTotalMes] = useState<number>(0);
  const [totalAno, setTotalAno] = useState<number>(0);

  const [botellonesDia, setBotellonesDia] = useState<number>(0);
  const [botellonesSemana, setBotellonesSemana] = useState<number>(0);
  const [botellonesMes, setBotellonesMes] = useState<number>(0);
  const [botellonesAno, setBotellonesAno] = useState<number>(0);

  // Almacena también la lista de pedidos mostrados (por filtrado).
  const [filteredPedidos, setFilteredPedidos] = useState<PedidoDoc[]>([]);

  useEffect(() => {
    // Suscribirse a la colección "Pedidos"
    const unsubscribe = onSnapshot(collection(db, 'Pedidos'), (snapshot) => {
      const data: PedidoDoc[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<PedidoDoc, 'id'>),
      }));
      setPedidos(data);
    });
    return () => unsubscribe();
  }, []);

  // Cada vez que cambian los pedidos o el filtro, recalcula
  useEffect(() => {
    // 1) Filtrar por clienteId si se especifica
    let temp = [...pedidos];
    if (clienteFilter.trim() !== '') {
      // Asumimos que el filter es el "clienteId"
      // Si quisieras filtrar por nombre, tendrías que hacer join con "Clientes"
      temp = temp.filter((p) => p.clienteId.includes(clienteFilter.trim()));
    }
    setFilteredPedidos(temp);

    // 2) Calcular totales/botellones (día, sem, mes, año)
    const hoy = new Date(); 
    const diaHoy = hoy.getDate();         // 1..31
    const mesHoy = hoy.getMonth();        // 0..11
    const anoHoy = hoy.getFullYear();     // 2025 etc.

    // Para "semana", tomamos la isoWeek
    // o calculamos 7 días atrás
    // aquí lo simplificamos usando la semana actual según ISO.
    const firstDayOfWeek = getFirstDayOfWeek(hoy); // helper (ver más abajo)

    let sumaDia = 0, 
        sumaSemana = 0, 
        sumaMes = 0, 
        sumaAno = 0;

    let botDia = 0,
        botSemana = 0,
        botMes = 0,
        botAno = 0;
    
    temp.forEach((pedido) => {
      // Convertir "2025-01-20" a un Date
      const [yearStr, monthStr, dayStr] = pedido.fecha.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1; // 0..11
      const day = parseInt(dayStr, 10);
      const datePedido = new Date(year, month, day);
      
      // Chequear "día actual"
      if (
        day === diaHoy &&
        month === mesHoy &&
        year === anoHoy
      ) {
        sumaDia += pedido.total;
        botDia += (pedido.cantidadConAsa + pedido.cantidadSinAsa);
      }

      // Chequear "semana actual"
      // Ver si datePedido >= firstDayOfWeek y <= lastDayOfWeek
      // lastDayOfWeek = firstDayOfWeek + 6 dias
      const lastDayOfWeek = new Date(firstDayOfWeek);
      lastDayOfWeek.setDate(lastDayOfWeek.getDate() + 6);
      if (datePedido >= firstDayOfWeek && datePedido <= lastDayOfWeek) {
        sumaSemana += pedido.total;
        botSemana += (pedido.cantidadConAsa + pedido.cantidadSinAsa);
      }

      // Chequear "mes actual"
      if (year === anoHoy && month === mesHoy) {
        sumaMes += pedido.total;
        botMes += (pedido.cantidadConAsa + pedido.cantidadSinAsa);
      }

      // Chequear "año actual"
      if (year === anoHoy) {
        sumaAno += pedido.total;
        botAno += (pedido.cantidadConAsa + pedido.cantidadSinAsa);
      }
    });

    setTotalDia(sumaDia);
    setTotalSemana(sumaSemana);
    setTotalMes(sumaMes);
    setTotalAno(sumaAno);

    setBotellonesDia(botDia);
    setBotellonesSemana(botSemana);
    setBotellonesMes(botMes);
    setBotellonesAno(botAno);
  }, [pedidos, clienteFilter]);

  // Helper para encontrar "lunes" (o primer día) de la semana
  // Asumimos que la semana inicia el lunes, pero puede variar tu lógica
  const getFirstDayOfWeek = (date: Date): Date => {
    const day = date.getDay();  // 0..6 (0=Domingo, 1=Lunes, etc)
    const diff = day === 0 ? 6 : (day - 1); 
    // Esto hace que "lunes" sea day=1 => diff=0
    // Si hoy es domingo (day=0), diff=6 => restamos 6.
    const newDate = new Date(date);
    newDate.setHours(0, 0, 0, 0);
    newDate.setDate(date.getDate() - diff);
    return newDate;
  };

  // Render de cada pedido en la FlatList
  const renderPedidoItem = ({ item }: { item: PedidoDoc }) => {
    return (
      <View style={styles.pedidoItem}>
        <Text style={styles.pedidoText}>
          Fecha: {item.fecha} | Total: {formatCurrency(item.total)}
        </Text>
        <Text style={styles.pedidoText}>
          Botellones: ConAsa={item.cantidadConAsa}, SinAsa={item.cantidadSinAsa}
        </Text>
        <Text style={styles.pedidoText}>
          ClienteID: {item.clienteId}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Ventas / Facturación</Text>

      {/* Filtro por cliente */}
      <TextInput
        style={styles.searchInput}
        placeholder="Filtrar por clienteId"
        value={clienteFilter}
        onChangeText={setClienteFilter}
      />

      {/* Totales Día / Semana / Mes / Año */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statTitle}>Hoy</Text>
          <Text style={styles.statValue}>{formatCurrency(totalDia)}</Text>
          <Text style={styles.statValue}>Bot: {botellonesDia}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statTitle}>Semana</Text>
          <Text style={styles.statValue}>{formatCurrency(totalSemana)}</Text>
          <Text style={styles.statValue}>Bot: {botellonesSemana}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statTitle}>Mes</Text>
          <Text style={styles.statValue}>{formatCurrency(totalMes)}</Text>
          <Text style={styles.statValue}>Bot: {botellonesMes}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statTitle}>Año</Text>
          <Text style={styles.statValue}>{formatCurrency(totalAno)}</Text>
          <Text style={styles.statValue}>Bot: {botellonesAno}</Text>
        </View>
      </View>

      {/* Lista de pedidos (filtrados) */}
      {filteredPedidos.length === 0 ? (
        <Text style={styles.noData}>No hay pedidos / ventas</Text>
      ) : (
        <FlatList
          data={filteredPedidos}
          keyExtractor={(item) => item.id}
          renderItem={renderPedidoItem}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      <Toast />
    </View>
  );
};

export default InvoicesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 16,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statBox: {
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
    width: '22%',
    // sombra leve
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
    fontSize: 14,
  },
  statValue: {
    fontSize: 12,
    color: '#333',
  },
  noData: {
    textAlign: 'center',
    color: '#555',
    marginTop: 20,
  },
  pedidoItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    // Sombra
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  pedidoText: {
    fontSize: 12,
    color: '#555',
  },
});
