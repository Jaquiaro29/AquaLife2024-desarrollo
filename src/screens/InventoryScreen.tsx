// InventoryScreen.tsx (Interfaz Moderna y Mejorada)
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  FlatList,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import {
  collection,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';

interface ArticuloDoc {
  id: string;
  nombre: string;
  categoria: string;
  cantidad: number;
  unidad: string;
}

interface MovimientoDoc {
  id: string;
  timestamp: any;
  tipoMovimiento: string;
  cantidad: number;
  observaciones?: string;
}

interface SelectedItem {
  id: string;
}

// Paleta de colores moderna
const colors = {
  primary: '#3498db',
  primaryLight: '#5dade2',
  primaryDark: '#2980b9',
  secondary: '#2ecc71',
  secondaryLight: '#58d68d',
  secondaryDark: '#27ae60',
  danger: '#e74c3c',
  dangerLight: '#ec7063',
  warning: '#f39c12',
  light: '#ecf0f1',
  dark: '#2c3e50',
  gray: '#95a5a6',
  white: '#ffffff',
  background: '#f8f9fa',
};

const InventoryScreen = () => {
  // Lista de artículos en Firestore
  const [articulos, setArticulos] = useState<ArticuloDoc[]>([]);
  
  // Estados para formularios modales
  const [showArticuloModal, setShowArticuloModal] = useState(false);
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  
  // Formulario artículo
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('');
  const [cantidad, setCantidad] = useState<number>(0);
  const [unidad, setUnidad] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Seleccionar un artículo para ver sus movimientos
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoDoc[]>([]);
  
  // Form para nuevo movimiento
  const [tipoMovimiento, setTipoMovimiento] = useState<'entrada' | 'salida'>('entrada');
  const [cantidadMovimiento, setCantidadMovimiento] = useState<number>(0);
  const [obsMovimiento, setObsMovimiento] = useState('');

  // Estados para filtros y búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');

  // Suscribirse a "Inventario"
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'Inventario'), (snapshot) => {
      const data: ArticuloDoc[] = snapshot.docs.map((docu) => ({
        id: docu.id,
        ...(docu.data() as Omit<ArticuloDoc, 'id'>),
      }));
      setArticulos(data);
    });
    return () => unsubscribe();
  }, []);

  // Filtrar artículos según búsqueda y categoría
  const filteredArticulos = articulos.filter(articulo => {
    const matchesSearch = articulo.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         articulo.categoria.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !filterCategoria || articulo.categoria === filterCategoria;
    return matchesSearch && matchesCategory;
  });

  // Obtener categorías únicas para el filtro
  const categoriasUnicas = [...new Set(articulos.map(articulo => articulo.categoria))];

  // Crear/Editar un artículo
  const handleSave = async () => {
    if (!nombre || !categoria || !unidad) {
      showToast('error', 'Completa todos los campos obligatorios.');
      return;
    }
    setLoading(true);

    try {
      if (editingId) {
        // Editar
        await updateDoc(doc(db, 'Inventario', editingId), {
          nombre,
          categoria,
          cantidad,
          unidad,
        });
        showToast('success', 'Artículo actualizado correctamente.');
        setEditingId(null);
      } else {
        // Crear
        await addDoc(collection(db, 'Inventario'), {
          nombre,
          categoria,
          cantidad,
          unidad,
        });
        showToast('success', 'Artículo creado exitosamente.');
      }
      // Reset form
      setNombre('');
      setCategoria('');
      setCantidad(0);
      setUnidad('');
      setShowArticuloModal(false);
    } catch (error) {
      console.error(error);
      showToast('error', 'No se pudo guardar el artículo.');
    }
    setLoading(false);
  };

  // Seleccionar artículo para edición
  const handleSelectEdit = (item: ArticuloDoc) => {
    setEditingId(item.id);
    setNombre(item.nombre);
    setCategoria(item.categoria);
    setCantidad(item.cantidad);
    setUnidad(item.unidad);
    setShowArticuloModal(true);
  };

  // Eliminar artículo con confirmación
  const handleDelete = (id: string, nombre: string) => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Estás seguro de que deseas eliminar "${nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'Inventario', id));
              showToast('success', 'Artículo eliminado correctamente.');
            } catch (err) {
              console.error(err);
              showToast('error', 'No se pudo eliminar el artículo.');
            }
          },
        },
      ]
    );
  };

  // Seleccionar un artículo para ver subcolección "Movimientos"
  const handleSelectItem = async (id: string) => {
    if (selectedItem?.id === id) {
      // Si es el mismo, deselecciona
      setSelectedItem(null);
      setMovimientos([]);
      return;
    }
    setSelectedItem({ id });

    // Cargar subcolección Movimientos
    const subColRef = collection(db, 'Inventario', id, 'Movimientos');
    const docsSnap = await getDocs(subColRef);
    const data: MovimientoDoc[] = docsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<MovimientoDoc, 'id'>),
    }));
    // Ordenar por fecha (más reciente primero)
    data.sort((a, b) => {
      const dateA = a.timestamp ? a.timestamp.toDate() : new Date(0);
      const dateB = b.timestamp ? b.timestamp.toDate() : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
    setMovimientos(data);
  };

  // Abrir modal para agregar movimiento
  const handleOpenMovimientoModal = (id: string) => {
    setSelectedItem({ id });
    setShowMovimientoModal(true);
  };

  // Agregar nuevo movimiento con timestamp
  const handleAddMovimiento = async () => {
    if (!selectedItem) return;
    if (!cantidadMovimiento || cantidadMovimiento <= 0) {
      showToast('error', 'Ingresa una cantidad válida para el movimiento.');
      return;
    }
    try {
      await addDoc(collection(db, 'Inventario', selectedItem.id, 'Movimientos'), {
        timestamp: serverTimestamp(),
        tipoMovimiento,
        cantidad: cantidadMovimiento,
        observaciones: obsMovimiento,
      });
      showToast('success', 'Movimiento registrado correctamente.');
      // limpiar form
      setTipoMovimiento('entrada');
      setCantidadMovimiento(0);
      setObsMovimiento('');
      setShowMovimientoModal(false);
      // recargar movimientos
      handleSelectItem(selectedItem.id);
    } catch (error) {
      console.error(error);
      showToast('error', 'No se pudo registrar el movimiento.');
    }
  };

  // Renderiza cada artículo en la lista
  const renderItemArticulo = ({ item }: { item: ArticuloDoc }) => {
    const isSelected = selectedItem?.id === item.id;

    return (
      <View style={[styles.itemContainer, isSelected && styles.itemContainerSelected]}>
        <TouchableOpacity 
          style={styles.itemContent}
          onPress={() => handleSelectItem(item.id)}
        >
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>{item.nombre}</Text>
            <View style={[
              styles.cantidadBadge, 
              item.cantidad < 10 ? styles.cantidadBaja : styles.cantidadNormal
            ]}>
              <Text style={styles.cantidadText}>{item.cantidad} {item.unidad}</Text>
            </View>
          </View>
          
          <View style={styles.itemDetails}>
            <View style={styles.categoriaTag}>
              <Ionicons name="pricetag" size={14} color={colors.white} />
              <Text style={styles.categoriaText}>{item.categoria}</Text>
            </View>
          </View>
        </TouchableOpacity>
        
        {/* Botones de acción */}
        <View style={styles.actionsRow}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.editButton]} 
            onPress={() => handleSelectEdit(item)}
          >
            <Ionicons name="create" size={16} color={colors.white} />
            <Text style={styles.actionButtonText}>Editar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.movimientoButton]} 
            onPress={() => handleOpenMovimientoModal(item.id)}
          >
            <Ionicons 
              name={tipoMovimiento === 'entrada' ? 'arrow-down' : 'arrow-up'} 
              size={16} 
              color={colors.white} 
            />
            <Text style={styles.actionButtonText}>Movimiento</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton]} 
            onPress={() => handleDelete(item.id, item.nombre)}
          >
            <Ionicons name="trash" size={16} color={colors.white} />
            <Text style={styles.actionButtonText}>Eliminar</Text>
          </TouchableOpacity>
        </View>

        {/* Sección de movimientos expandida */}
        {isSelected && (
          <View style={styles.movimientosContainer}>
            <View style={styles.movimientosHeader}>
              <Text style={styles.movTitle}>Historial de Movimientos</Text>
              <TouchableOpacity 
                style={styles.agregarMovimientoBtn}
                onPress={() => handleOpenMovimientoModal(item.id)}
              >
                <Ionicons name="add-circle" size={20} color={colors.primary} />
                <Text style={styles.agregarMovimientoText}>Nuevo Movimiento</Text>
              </TouchableOpacity>
            </View>
            
            {movimientos.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="receipt" size={40} color={colors.gray} />
                <Text style={styles.emptyStateText}>No hay movimientos registrados</Text>
              </View>
            ) : (
              <ScrollView style={styles.movimientosList}>
                {movimientos.map((mov) => (
                  <View key={mov.id} style={[
                    styles.movItem,
                    mov.tipoMovimiento === 'entrada' ? styles.movItemEntrada : styles.movItemSalida
                  ]}>
                    <View style={styles.movHeader}>
                      <View style={[
                        styles.movTypeBadge,
                        mov.tipoMovimiento === 'entrada' ? styles.movTypeEntrada : styles.movTypeSalida
                      ]}>
                        <Ionicons 
                          name={mov.tipoMovimiento === 'entrada' ? 'arrow-down' : 'arrow-up'} 
                          size={14} 
                          color={colors.white} 
                        />
                        <Text style={styles.movTypeText}>
                          {mov.tipoMovimiento === 'entrada' ? 'Entrada' : 'Salida'}
                        </Text>
                      </View>
                      <Text style={styles.movDate}>
                        {mov.timestamp
                          ? new Date(mov.timestamp.toDate()).toLocaleString()
                          : "—"}
                      </Text>
                    </View>
                    
                    <View style={styles.movDetails}>
                      <Text style={styles.movCantidad}>
                        {mov.cantidad} {item.unidad}
                      </Text>
                      {mov.observaciones && (
                        <Text style={styles.movObservaciones}>Obs: {mov.observaciones}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>
    );
  };

  // Toast genérico
  const showToast = (type: 'success' | 'error', message: string) => {
    Toast.show({
      type,
      text1: type === 'success' ? '¡Éxito!' : 'Error',
      text2: message,
      position: 'top',
      visibilityTime: 3000,
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Ionicons name="water" size={28} color={colors.primary} />
          <Text style={styles.headerTitle}>Inventario de Botellones</Text>
        </View>
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => {
            setEditingId(null);
            setNombre('');
            setCategoria('');
            setCantidad(0);
            setUnidad('');
            setShowArticuloModal(true);
          }}
        >
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={styles.addButtonText}>Nuevo Artículo</Text>
        </TouchableOpacity>
      </View>

      {/* Filtros y búsqueda */}
      <View style={styles.filtersContainer}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre o categoría..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.gray} />
            </TouchableOpacity>
          ) : null}
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
          <TouchableOpacity
            style={[styles.categoryFilter, !filterCategoria && styles.categoryFilterActive]}
            onPress={() => setFilterCategoria('')}
          >
            <Text style={[styles.categoryFilterText, !filterCategoria && styles.categoryFilterTextActive]}>
              Todos
            </Text>
          </TouchableOpacity>
          {categoriasUnicas.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryFilter, filterCategoria === cat && styles.categoryFilterActive]}
              onPress={() => setFilterCategoria(filterCategoria === cat ? '' : cat)}
            >
              <Text style={[styles.categoryFilterText, filterCategoria === cat && styles.categoryFilterTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Resumen de inventario */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{articulos.length}</Text>
          <Text style={styles.statLabel}>Artículos</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {articulos.filter(a => a.cantidad < 10).length}
          </Text>
          <Text style={styles.statLabel}>Stock Bajo</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {categoriasUnicas.length}
          </Text>
          <Text style={styles.statLabel}>Categorías</Text>
        </View>
      </View>

      {/* Lista principal de artículos */}
      {filteredArticulos.length === 0 ? (
        <View style={styles.emptyInventory}>
          <Ionicons name="cube" size={60} color={colors.gray} />
          <Text style={styles.emptyInventoryTitle}>No hay artículos</Text>
          <Text style={styles.emptyInventoryText}>
            {searchQuery || filterCategoria 
              ? 'Intenta con otros términos de búsqueda' 
              : 'Comienza agregando tu primer artículo al inventario'}
          </Text>
          <TouchableOpacity 
            style={styles.emptyInventoryButton}
            onPress={() => {
              setEditingId(null);
              setNombre('');
              setCategoria('');
              setCantidad(0);
              setUnidad('');
              setShowArticuloModal(true);
            }}
          >
            <Text style={styles.emptyInventoryButtonText}>Agregar Primer Artículo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredArticulos}
          renderItem={renderItemArticulo}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modal para crear/editar artículo */}
      <Modal
        visible={showArticuloModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowArticuloModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? 'Editar Artículo' : 'Nuevo Artículo'}
              </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowArticuloModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.dark} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nombre del artículo *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Botellón de 20L"
                  value={nombre}
                  onChangeText={setNombre}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Categoría *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Agua purificada"
                  value={categoria}
                  onChangeText={setCategoria}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Cantidad inicial</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  keyboardType="numeric"
                  value={cantidad ? String(cantidad) : ''}
                  onChangeText={(text) => setCantidad(Number(text) || 0)}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Unidad de medida *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: unidades, litros, etc."
                  value={unidad}
                  onChangeText={setUnidad}
                />
              </View>
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowArticuloModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                  <Text style={styles.saveButtonText}>
                    {editingId ? 'Guardar Cambios' : 'Crear Artículo'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para agregar movimiento */}
      <Modal
        visible={showMovimientoModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMovimientoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registrar Movimiento</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowMovimientoModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.dark} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <View style={styles.tipoRow}>
                <TouchableOpacity
                  style={[
                    styles.tipoButton,
                    tipoMovimiento === 'entrada' && styles.tipoButtonSelected,
                  ]}
                  onPress={() => setTipoMovimiento('entrada')}
                >
                  <Ionicons 
                    name="arrow-down" 
                    size={20} 
                    color={tipoMovimiento === 'entrada' ? colors.white : colors.secondary} 
                  />
                  <Text
                    style={[
                      styles.tipoButtonText,
                      tipoMovimiento === 'entrada' && styles.tipoButtonTextSelected,
                    ]}
                  >
                    Entrada
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tipoButton,
                    tipoMovimiento === 'salida' && styles.tipoButtonSelected,
                  ]}
                  onPress={() => setTipoMovimiento('salida')}
                >
                  <Ionicons 
                    name="arrow-up" 
                    size={20} 
                    color={tipoMovimiento === 'salida' ? colors.white : colors.danger} 
                  />
                  <Text
                    style={[
                      styles.tipoButtonText,
                      tipoMovimiento === 'salida' && styles.tipoButtonTextSelected,
                    ]}
                  >
                    Salida
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Cantidad *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  keyboardType="numeric"
                  value={cantidadMovimiento ? String(cantidadMovimiento) : ''}
                  onChangeText={(text) => setCantidadMovimiento(Number(text) || 0)}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Observaciones (opcional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Detalles del movimiento..."
                  value={obsMovimiento}
                  onChangeText={setObsMovimiento}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowMovimientoModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.saveButton} onPress={handleAddMovimiento}>
                <Text style={styles.saveButtonText}>Registrar Movimiento</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Toast />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.light,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.dark,
    marginLeft: 10,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    elevation: 2,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  addButtonText: {
    color: colors.white,
    fontWeight: '600',
    marginLeft: 6,
  },
  filtersContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.light,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 15,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  categoriesContainer: {
    flexDirection: 'row',
  },
  categoryFilter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.light,
    borderRadius: 20,
    marginRight: 10,
  },
  categoryFilterActive: {
    backgroundColor: colors.primary,
  },
  categoryFilterText: {
    color: colors.dark,
    fontWeight: '500',
  },
  categoryFilterTextActive: {
    color: colors.white,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    backgroundColor: colors.white,
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 12,
    elevation: 2,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 14,
    color: colors.gray,
    marginTop: 5,
  },
  listContainer: {
    padding: 20,
  },
  itemContainer: {
    backgroundColor: colors.white,
    borderRadius: 12,
    marginBottom: 15,
    padding: 16,
    elevation: 2,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  itemContainerSelected: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  itemContent: {
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.dark,
    flex: 1,
  },
  cantidadBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cantidadNormal: {
    backgroundColor: colors.secondaryLight,
  },
  cantidadBaja: {
    backgroundColor: colors.warning,
  },
  cantidadText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 12,
  },
  itemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoriaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoriaText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.light,
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: colors.primary,
  },
  movimientoButton: {
    backgroundColor: colors.secondary,
  },
  deleteButton: {
    backgroundColor: colors.danger,
  },
  actionButtonText: {
    color: colors.white,
    fontWeight: '500',
    marginLeft: 6,
    fontSize: 12,
  },
  movimientosContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: colors.light,
  },
  movimientosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  movTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.dark,
  },
  agregarMovimientoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  agregarMovimientoText: {
    color: colors.primary,
    fontWeight: '500',
    marginLeft: 6,
  },
  movimientosList: {
    maxHeight: 200,
  },
  movItem: {
    backgroundColor: colors.light,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  movItemEntrada: {
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
  },
  movItemSalida: {
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  movHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  movTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  movTypeEntrada: {
    backgroundColor: colors.secondary,
  },
  movTypeSalida: {
    backgroundColor: colors.danger,
  },
  movTypeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  movDate: {
    fontSize: 12,
    color: colors.gray,
  },
  movDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  movCantidad: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.dark,
  },
  movObservaciones: {
    fontSize: 14,
    color: colors.gray,
    flex: 1,
    marginLeft: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyStateText: {
    marginTop: 10,
    color: colors.gray,
    fontSize: 16,
  },
  emptyInventory: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyInventoryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.dark,
    marginTop: 15,
    marginBottom: 10,
  },
  emptyInventoryText: {
    fontSize: 16,
    color: colors.gray,
    textAlign: 'center',
    marginBottom: 25,
  },
  emptyInventoryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyInventoryButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: colors.white,
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.light,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.dark,
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.dark,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.light,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: colors.background,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  tipoRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  tipoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.light,
    marginHorizontal: 5,
    borderRadius: 8,
  },
  tipoButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tipoButtonText: {
    fontWeight: '500',
    marginLeft: 8,
  },
  tipoButtonTextSelected: {
    color: colors.white,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.light,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gray,
    borderRadius: 8,
    marginRight: 10,
  },
  cancelButtonText: {
    color: colors.dark,
    fontWeight: '500',
  },
  saveButton: {
    flex: 2,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginLeft: 10,
  },
  saveButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
});

export default InventoryScreen;