// MaintenanceScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  FlatList,
} from 'react-native';
import {
  collection,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import Toast from 'react-native-toast-message';

// Interfaz principal
interface MaquinaDoc {
  id: string;
  nombre: string;
  tipoEquipo: string; 
  frecuenciaRecomendada: string;
  ultimaFechaMantenimiento?: string;    // "YYYY-MM-DD"
  proximaFechaMantenimiento?: string;  // "YYYY-MM-DD"
}

// Subcolección
interface MantenimientoDoc {
  id: string;
  fecha: string;       // "YYYY-MM-DD"
  observaciones: string;
}

// Para saber qué item está seleccionado
interface SelectedItem {
  id: string;
}

// Paleta de colores básica
const colors = {
  primary: '#00B5E2',
  secondary: '#FF6565',
};

const MaintenanceScreen = () => {
  // Lista principal de máquinas/herramientas
  const [maquinaria, setMaquinaria] = useState<MaquinaDoc[]>([]);
  
  // Control formulario (crear/editar)
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [tipoEquipo, setTipoEquipo] = useState('');
  const [frecuenciaRecomendada, setFrecuenciaRecomendada] = useState('');
  const [ultimaFechaMantenimiento, setUltimaFechaMantenimiento] = useState(''); // Texto
  const [proximaFechaMantenimiento, setProximaFechaMantenimiento] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Seleccionar un ítem → ver historial
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [mantenimientos, setMantenimientos] = useState<MantenimientoDoc[]>([]);
  // Para nuevo mantenimiento
  const [fechaMantenimiento, setFechaMantenimiento] = useState('');
  const [obsMantenimiento, setObsMantenimiento] = useState('');

  // Suscribirnos a la colección "Maquinaria"
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'Maquinaria'), (snapshot) => {
      const data: MaquinaDoc[] = snapshot.docs.map((docu) => ({
        id: docu.id,
        ...(docu.data() as Omit<MaquinaDoc, 'id'>),
      }));
      setMaquinaria(data);
    });
    return () => unsubscribe();
  }, []);

  // Crear/Editar maquinaria
  const handleSave = async () => {
    // Validar
    if (!nombre || !tipoEquipo || !frecuenciaRecomendada) {
      showToast('error', 'Completa al menos nombre, tipo y frecuencia.');
      return;
    }
    setLoading(true);

    try {
      if (editingId) {
        // Editar
        await updateDoc(doc(db, 'Maquinaria', editingId), {
          nombre,
          tipoEquipo,
          frecuenciaRecomendada,
          ultimaFechaMantenimiento,
          proximaFechaMantenimiento,
        });
        showToast('success', 'Maquinaria actualizada correctamente.');
        setEditingId(null);
      } else {
        // Crear nuevo
        await addDoc(collection(db, 'Maquinaria'), {
          nombre,
          tipoEquipo,
          frecuenciaRecomendada,
          ultimaFechaMantenimiento,
          proximaFechaMantenimiento,
        });
        showToast('success', 'Maquinaria creada correctamente.');
      }

      // Limpiar y cerrar form
      setNombre('');
      setTipoEquipo('');
      setFrecuenciaRecomendada('');
      setUltimaFechaMantenimiento('');
      setProximaFechaMantenimiento('');
      setShowForm(false);
    } catch (error) {
      console.error(error);
      showToast('error', 'No se pudo guardar.');
    }
    setLoading(false);
  };

  // Seleccionar un doc para edición
  const handleSelectEdit = (item: MaquinaDoc) => {
    setEditingId(item.id);
    setNombre(item.nombre);
    setTipoEquipo(item.tipoEquipo);
    setFrecuenciaRecomendada(item.frecuenciaRecomendada);
    setUltimaFechaMantenimiento(item.ultimaFechaMantenimiento || '');
    setProximaFechaMantenimiento(item.proximaFechaMantenimiento || '');
    setShowForm(true);
  };

  // Eliminar
  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'Maquinaria', id));
      showToast('success', 'Eliminado correctamente.');
    } catch (err) {
      console.error(err);
      showToast('error', 'No se pudo eliminar.');
    }
  };

  // Seleccionar item para ver historial
  const handleSelectItem = async (id: string) => {
    if (selectedItem?.id === id) {
      // deseleccionar si es el mismo
      setSelectedItem(null);
      setMantenimientos([]);
      return;
    }
    setSelectedItem({ id });

    // Cargar subcolección "Mantenimientos"
    const subColRef = collection(db, 'Maquinaria', id, 'Mantenimientos');
    const docsSnap = await getDocs(subColRef);
    const data: MantenimientoDoc[] = docsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<MantenimientoDoc, 'id'>),
    }));
    setMantenimientos(data);
  };

  // Guardar un mantenimiento en subcoleccion
  const handleAddMantenimiento = async () => {
    if (!selectedItem) return;
    if (!fechaMantenimiento) {
      showToast('error', 'Ingresa la fecha de mantenimiento (YYYY-MM-DD).');
      return;
    }
    if (!obsMantenimiento) {
      showToast('error', 'Ingresa observaciones del mantenimiento.');
      return;
    }
    try {
      await addDoc(collection(db, 'Maquinaria', selectedItem.id, 'Mantenimientos'), {
        fecha: fechaMantenimiento,
        observaciones: obsMantenimiento,
      });
      showToast('success', 'Mantenimiento agregado.');
      setFechaMantenimiento('');
      setObsMantenimiento('');
      handleSelectItem(selectedItem.id); // recargar
    } catch (error) {
      console.error(error);
      showToast('error', 'No se pudo agregar mantenimiento.');
    }
  };

  // Render item principal
  const renderItem = ({ item }: { item: MaquinaDoc }) => {
    const isSelected = selectedItem?.id === item.id;
    return (
      <View style={styles.itemContainer}>
        <TouchableOpacity onPress={() => handleSelectItem(item.id)}>
          <Text style={styles.itemTitle}>{item.nombre}</Text>
          <Text style={styles.itemSubtitle}>
            Tipo: {item.tipoEquipo} | Frec: {item.frecuenciaRecomendada}
          </Text>
          {item.ultimaFechaMantenimiento ? (
            <Text style={styles.itemSubtitle}>
              Última mant.: {item.ultimaFechaMantenimiento}
            </Text>
          ) : null}
          {item.proximaFechaMantenimiento ? (
            <Text style={styles.itemSubtitle}>
              Próxima mant.: {item.proximaFechaMantenimiento}
            </Text>
          ) : null}
        </TouchableOpacity>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleSelectEdit(item)}>
            <Text style={styles.actionButtonText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item.id)}>
            <Text style={styles.actionButtonText}>Eliminar</Text>
          </TouchableOpacity>
        </View>

        {/* Si está seleccionado, ver historial */}
        {isSelected && (
          <View style={styles.historialContainer}>
            <Text style={styles.historialTitle}>Historial de Mantenimientos</Text>
            {mantenimientos.length === 0 ? (
              <Text>No hay mantenimientos registrados.</Text>
            ) : (
              mantenimientos.map((m) => (
                <View key={m.id} style={styles.mantItem}>
                  <Text>Fecha: {m.fecha}</Text>
                  <Text>Observaciones: {m.observaciones}</Text>
                </View>
              ))
            )}
            {/* Agregar nuevo mantenimiento */}
            <TextInput
              style={styles.input}
              placeholder="Fecha (YYYY-MM-DD)"
              value={fechaMantenimiento}
              onChangeText={setFechaMantenimiento}
            />
            <TextInput
              style={styles.input}
              placeholder="Observaciones"
              value={obsMantenimiento}
              onChangeText={setObsMantenimiento}
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleAddMantenimiento}>
              <Text style={styles.saveButtonText}>Agregar Mantenimiento</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Toast
  const showToast = (type: 'success' | 'error', message: string) => {
    Toast.show({
      type,
      text1: type === 'success' ? '¡Éxito!' : 'Error',
      text2: message,
      position: 'top',
      visibilityTime: 3000,
    });
  };

  // Render principal
  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>Gestión de Mantenimiento (Web)</Text>

      <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(!showForm)}>
        <Text style={styles.addButtonText}>{showForm ? 'Cerrar' : '+ Añadir'}</Text>
      </TouchableOpacity>

      {showForm && (
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>
            {editingId ? 'Editar Maquinaria' : 'Nueva Maquinaria/Herramienta'}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre"
            value={nombre}
            onChangeText={setNombre}
          />
          <TextInput
            style={styles.input}
            placeholder="Tipo (filtro, bomba, etc.)"
            value={tipoEquipo}
            onChangeText={setTipoEquipo}
          />
          <TextInput
            style={styles.input}
            placeholder="Frecuencia recomendada"
            value={frecuenciaRecomendada}
            onChangeText={setFrecuenciaRecomendada}
          />

          {/* Fechas en simple input textual */}
          <TextInput
            style={styles.input}
            placeholder="Última mant. (YYYY-MM-DD, opcional)"
            value={ultimaFechaMantenimiento}
            onChangeText={setUltimaFechaMantenimiento}
          />
          <TextInput
            style={styles.input}
            placeholder="Próxima mant. (YYYY-MM-DD, opcional)"
            value={proximaFechaMantenimiento}
            onChangeText={setProximaFechaMantenimiento}
          />

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>
                {editingId ? 'Guardar Cambios' : 'Crear'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Lista principal */}
      <FlatList
        data={maquinaria}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <Toast />
    </View>
  );
};

export default MaintenanceScreen;

// Estilos
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 16,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    alignSelf: 'center',
    marginVertical: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#fafafa',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  itemContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 10,
    padding: 12,
    // Sombra leve
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#555',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  actionButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  historialContainer: {
    marginTop: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 8,
  },
  historialTitle: {
    fontWeight: 'bold',
    marginBottom: 6,
  },
  mantItem: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 6,
    marginBottom: 6,
  },
  dateRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  dateButton: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dateButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

