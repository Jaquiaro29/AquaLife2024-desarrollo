import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  FlatList,
} from "react-native";
import { globalStyles, colors } from "../styles/globalStyles";

const InventoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  // Estados para botellones
  const [fullBottles, setFullBottles] = useState<number>(100);
  const [emptyBottles, setEmptyBottles] = useState<number>(50);
  const [maintenanceBottles, setMaintenanceBottles] = useState<number>(5);

  // Estados para tapas y precintos
  const [caps, setCaps] = useState<number>(120);
  const [seals, setSeals] = useState<number>(110);

  // Estado para actualizar tapas y precintos
  const [newCaps, setNewCaps] = useState<number>(0);
  const [newSeals, setNewSeals] = useState<number>(0);

  // Estado para el historial
  const [inventoryHistory, setInventoryHistory] = useState<
    { id: string; date: string; type: string; details: string }[]
  >([]);

  const handleAddStock = (quantity: number, isFull: boolean) => {
    if (quantity <= 0) {
      Alert.alert("Error", "La cantidad debe ser mayor a 0.");
      return;
    }
    if (isFull) {
      setFullBottles(fullBottles + quantity);
      setCaps(caps + quantity); // Agregar tapas
      setSeals(seals + quantity); // Agregar precintos
      addHistory("Ingreso", `+${quantity} botellones llenos, tapas y precintos.`);
    } else {
      setEmptyBottles(emptyBottles + quantity);
      addHistory("Ingreso", `+${quantity} botellones vacíos.`);
    }
  };

  const handleUpdateCapsAndSeals = () => {
    if (newCaps > 0) {
      setCaps(caps + newCaps);
      addHistory("Actualización", `+${newCaps} tapas añadidas.`);
    }
    if (newSeals > 0) {
      setSeals(seals + newSeals);
      addHistory("Actualización", `+${newSeals} precintos añadidos.`);
    }
    setNewCaps(0);
    setNewSeals(0);
    Alert.alert("Éxito", "Tapas y precintos actualizados.");
  };

  const handleRegisterMaintenance = (quantity: number) => {
    if (quantity <= 0 || quantity > fullBottles) {
      Alert.alert(
        "Error",
        "La cantidad debe ser mayor a 0 y no puede exceder los botellones llenos."
      );
      return;
    }
    setFullBottles(fullBottles - quantity);
    setMaintenanceBottles(maintenanceBottles + quantity);
    addHistory(
      "Mantenimiento",
      `-${quantity} botellones enviados a mantenimiento.`
    );
  };

  const addHistory = (type: string, details: string) => {
    const newEntry = {
      id: Date.now().toString(),
      date: new Date().toLocaleString(),
      type,
      details,
    };
    setInventoryHistory([newEntry, ...inventoryHistory]);
  };

  const renderHistoryItem = ({ item }: { item: any }) => (
    <View style={styles.historyItem}>
      <Text style={styles.historyDate}>{item.date}</Text>
      <Text>
        <Text style={{ fontWeight: "bold" }}>Operación:</Text> {item.type}
      </Text>
      <Text>
        <Text style={{ fontWeight: "bold" }}>Detalles:</Text> {item.details}
      </Text>
    </View>
  );

  return (
    <View style={styles.outerContainer}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
  <Text style={globalStyles.header}>Gestión de Inventario</Text>

        {/* Vista General */}
        <View style={styles.inventoryOverview}>
          <View style={styles.inventoryCard}>
            <Text style={styles.inventoryTitle}>Botellones Llenos</Text>
            <Text style={styles.inventoryQuantity}>{fullBottles}</Text>
          </View>
          <View style={styles.inventoryCard}>
            <Text style={styles.inventoryTitle}>Botellones Vacíos</Text>
            <Text style={styles.inventoryQuantity}>{emptyBottles}</Text>
          </View>
          <View style={styles.inventoryCard}>
            <Text style={styles.inventoryTitle}>En Mantenimiento</Text>
            <Text style={styles.inventoryQuantity}>{maintenanceBottles}</Text>
          </View>
          <View style={styles.inventoryCard}>
            <Text style={styles.inventoryTitle}>Tapas</Text>
            <Text style={styles.inventoryQuantity}>{caps}</Text>
          </View>
          <View style={styles.inventoryCard}>
            <Text style={styles.inventoryTitle}>Precintos</Text>
            <Text style={styles.inventoryQuantity}>{seals}</Text>
          </View>
        </View>

        {/* Acciones rápidas */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={globalStyles.buttonPrimary}
            onPress={() => handleAddStock(10, true)}
          >
            <Text style={globalStyles.buttonTextPrimary}>Agregar Botellones Llenos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={globalStyles.buttonPrimary}
            onPress={() => handleRegisterMaintenance(5)}
          >
            <Text style={globalStyles.buttonTextPrimary}>Registrar Mantenimiento</Text>
          </TouchableOpacity>
        </View>

        {/* Actualizar Tapas y Precintos */}
        <View style={styles.actionCard}>
          <Text style={globalStyles.header}>Actualizar Tapas y Precintos</Text>
          <Text style={styles.label}>Tapas:</Text>
          <TextInput
            style={globalStyles.input}
            keyboardType="numeric"
            value={newCaps.toString()}
            onChangeText={(text) => setNewCaps(parseInt(text) || 0)}
          />
          <Text style={styles.label}>Precintos:</Text>
          <TextInput
            style={globalStyles.input}
            keyboardType="numeric"
            value={newSeals.toString()}
            onChangeText={(text) => setNewSeals(parseInt(text) || 0)}
          />
          <TouchableOpacity
            style={globalStyles.buttonPrimary}
            onPress={handleUpdateCapsAndSeals}
          >
            <Text style={globalStyles.buttonTextPrimary}>Actualizar</Text>
          </TouchableOpacity>
        </View>

        {/* Historial */}
  <Text style={[globalStyles.header, { marginTop: 20 }]}> 
          Historial de Movimientos
        </Text>
        <FlatList
          data={inventoryHistory}
          renderItem={renderHistoryItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.historyContainer}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  inventoryOverview: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    width: "95%",
    marginBottom: 20,
  },
  inventoryCard: {
    backgroundColor: colors.primaryShades[100],
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    margin: 5,
    width: "30%",
  },
  inventoryTitle: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  inventoryQuantity: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.primaryDark,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "95%",
    marginBottom: 20,
  },
  actionCard: {
    width: "95%",
    backgroundColor: colors.primaryShades[50],
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 5,
  },
  historyContainer: {
    width: "95%",
    paddingBottom: 20,
  },
  historyItem: {
    backgroundColor: colors.primaryShades[50],
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  historyDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 5,
  },
});

export default InventoryScreen;
