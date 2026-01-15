// InventoryScreen.tsx (Interfaz Moderna y Mejorada con Header Scrolleable)
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
  StatusBar,
  Dimensions,
} from 'react-native';
import {
  collection,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../styles/globalStyles';

const { width } = Dimensions.get('window');

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

const InventoryScreen = () => {
  // Lista de artículos en Firestore
  const [articulos, setArticulos] = useState<ArticuloDoc[]>([]);
  
  // Estados para formularios modales
  const [showArticuloModal, setShowArticuloModal] = useState(false);
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Formulario artículo
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('');
  const [useExistingCategory, setUseExistingCategory] = useState(true);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
  const [cantidad, setCantidad] = useState<number>(0);
  const [unidad, setUnidad] = useState('');
  const [unidadSeleccionada, setUnidadSeleccionada] = useState('');
  const [useExistingUnit, setUseExistingUnit] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSelectEditModal, setShowSelectEditModal] = useState(false);

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
  const [filterDeleteCategoria, setFilterDeleteCategoria] = useState('');
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

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
  const unidadesPredefinidas = ['unidades', 'litros', 'kg', 'metros', 'cajas', 'paquetes', 'botellas'];
  const articulosParaEliminar = filterDeleteCategoria
    ? articulos.filter((articulo) => articulo.categoria === filterDeleteCategoria)
    : articulos;

  const getSelectedItemsForDeletion = () =>
    articulos.filter((articulo) => selectedForDeletion.has(articulo.id));
  const selectedItemsForDeletion = getSelectedItemsForDeletion();
  const hasSelectionForDeletion = selectedItemsForDeletion.length > 0;

  // Crear/Editar un artículo
  const handleSave = async () => {
    const categoriaFinal = useExistingCategory
      ? categoriaSeleccionada || categoria
      : categoria;
    const unidadFinal = useExistingUnit
      ? unidadSeleccionada || unidad
      : unidad;

    if (!nombre || !categoriaFinal || !unidadFinal) {
      showToast('error', 'Completa todos los campos obligatorios.');
      return;
    }
    setLoading(true);

    try {
      if (editingId) {
        // Editar
        await updateDoc(doc(db, 'Inventario', editingId), {
          nombre,
          categoria: categoriaFinal,
          cantidad,
          unidad: unidadFinal,
        });
        showToast('success', 'Artículo actualizado correctamente.');
        setEditingId(null);
      } else {
        // Crear
        await addDoc(collection(db, 'Inventario'), {
          nombre,
          categoria: categoriaFinal,
          cantidad,
          unidad: unidadFinal,
        });
        showToast('success', 'Artículo creado exitosamente.');
      }
      // Reset form
      setNombre('');
      setCategoria('');
      setCategoriaSeleccionada('');
      setCantidad(0);
      setUnidad('');
      setUnidadSeleccionada('');
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
    setCategoriaSeleccionada(item.categoria);
    setUseExistingCategory(true);
    setCantidad(item.cantidad);
    setUnidad(item.unidad);
    setUnidadSeleccionada(item.unidad);
    setUseExistingUnit(true);
    setShowArticuloModal(true);
  };

  const deleteArticuloWithMovimientos = async (id: string) => {
    const movimientosRef = collection(db, 'Inventario', id, 'Movimientos');
    const movSnap = await getDocs(movimientosRef);
    const deletes = movSnap.docs.map((d) => deleteDoc(doc(db, 'Inventario', id, 'Movimientos', d.id)));
    if (deletes.length > 0) {
      await Promise.all(deletes);
    }

    await deleteDoc(doc(db, 'Inventario', id));

    if (selectedItem?.id === id) {
      setSelectedItem(null);
      setMovimientos([]);
    }
  };

  // Eliminar artículo (y sus movimientos) con confirmación única
  const handleDelete = (id: string, nombre: string) => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Deseas eliminar "${nombre}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteArticuloWithMovimientos(id);

              showToast('success', 'Artículo eliminado correctamente.');
            } catch (err: any) {
              console.error(err);
              const msg = err?.message ? `No se pudo eliminar: ${err.message}` : 'No se pudo eliminar el artículo.';
              showToast('error', msg);
            }
          },
        },
      ]
    );
  };

  const toggleSelectForDeletion = (id: string) => {
    setSelectedForDeletion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = (items: ArticuloDoc[]) => {
    setSelectedForDeletion((prev) => {
      const next = new Set(prev);
      const allSelected = items.every((a) => next.has(a.id));
      if (allSelected) {
        items.forEach((a) => next.delete(a.id));
      } else {
        items.forEach((a) => next.add(a.id));
      }
      return next;
    });
  };

  const deleteSelectedItems = async (items: ArticuloDoc[]) => {
    if (items.length === 0) {
      showToast('error', 'Selecciona al menos un artículo.');
      return;
    }
    setDeleting(true);
    try {
      for (const item of items) {
        await deleteArticuloWithMovimientos(item.id);
      }
      showToast('success', 'Artículos eliminados correctamente.');
      closeDeleteModal();
    } catch (err: any) {
      console.error(err);
      const msg = err?.message ? `No se pudo eliminar: ${err.message}` : 'No se pudieron eliminar los artículos.';
      showToast('error', msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDeleteConfirm = (items: ArticuloDoc[]) => {
    if (items.length === 0) {
      showToast('error', 'Selecciona al menos un artículo.');
      return;
    }

    deleteSelectedItems(items);
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

    const itemRef = doc(db, 'Inventario', selectedItem.id);
    const movimientoRef = doc(collection(db, 'Inventario', selectedItem.id, 'Movimientos'));
    const delta = tipoMovimiento === 'entrada' ? cantidadMovimiento : -cantidadMovimiento;

    try {
      await runTransaction(db, async (transaction) => {
        const itemSnap = await transaction.get(itemRef);
        if (!itemSnap.exists()) {
          throw new Error('El artículo no existe.');
        }

        const currentCantidad = (itemSnap.data()?.cantidad ?? 0) as number;
        const nuevaCantidad = currentCantidad + delta;

        if (nuevaCantidad < 0) {
          throw new Error('No hay stock suficiente para registrar esta salida.');
        }

        transaction.update(itemRef, { cantidad: nuevaCantidad });
        transaction.set(movimientoRef, {
          timestamp: serverTimestamp(),
          tipoMovimiento,
          cantidad: cantidadMovimiento,
          observaciones: obsMovimiento,
        });
      });

      showToast('success', 'Movimiento registrado correctamente.');
      // limpiar form
      setTipoMovimiento('entrada');
      setCantidadMovimiento(0);
      setObsMovimiento('');
      setShowMovimientoModal(false);
      // recargar movimientos
      handleSelectItem(selectedItem.id);
    } catch (error: any) {
      console.error(error);
      const message = error?.message || 'No se pudo registrar el movimiento.';
      showToast('error', message);
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
              <Ionicons name="pricetag" size={14} color={colors.textInverse} />
              <Text style={styles.categoriaText}>{item.categoria}</Text>
            </View>
          </View>
        </TouchableOpacity>
        
        {/* Botones de acción */}
        <View style={styles.actionsRow}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.movimientoButton]} 
            onPress={() => handleOpenMovimientoModal(item.id)}
          >
            <Ionicons 
              name={tipoMovimiento === 'entrada' ? 'arrow-down' : 'arrow-up'} 
              size={16} 
              color={colors.textInverse} 
            />
            <Text style={styles.actionButtonText}>Movimiento</Text>
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
                <Ionicons name="receipt" size={40} color={colors.textSecondary} />
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
                          color={colors.textInverse} 
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

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setSelectedForDeletion(new Set());
    setFilterDeleteCategoria('');
  };

  const handleSelectItemForEdit = (item: ArticuloDoc) => {
    handleSelectEdit(item);
    setShowSelectEditModal(false);
  };

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
          <View style={styles.headerContent}>
            <View style={styles.headerTitleContainer}>
              <Ionicons name="cube" size={28} color={colors.textInverse} />
              <Text style={styles.headerTitle}>Gestión de Inventario</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.addButton} 
                onPress={() => {
                  setEditingId(null);
                  setNombre('');
                  setCategoria('');
                  setCategoriaSeleccionada('');
                  setUseExistingCategory(categoriasUnicas.length > 0);
                  setCantidad(0);
                  setUnidad('');
                  setUnidadSeleccionada('');
                  setUseExistingUnit(true);
                  setShowArticuloModal(true);
                }}
              >
                <Ionicons name="add" size={20} color={colors.textInverse} />
                <Text style={styles.addButtonText}>Nuevo Artículo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.editTopButton}
                onPress={() => setShowSelectEditModal(true)}
              >
                <Ionicons name="create" size={18} color={colors.textInverse} />
                <Text style={styles.deleteTopButtonText}>Editar Artículo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteTopButton}
                onPress={() => setShowDeleteModal(true)}
              >
                <Ionicons name="trash" size={18} color={colors.textInverse} />
                <Text style={styles.deleteTopButtonText}>
                  Eliminar Artículo
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {/* Contenido principal */}
        <View style={styles.content}>
          {/* Resumen de inventario */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.statsContainer}
          >
            <LinearGradient
              colors={colors.gradientSecondary}
              style={styles.statCard}
            >
              <Text style={styles.statNumber}>{articulos.length}</Text>
              <Text style={styles.statLabel}>Artículos</Text>
            </LinearGradient>
            
            <LinearGradient
              colors={[colors.warning, '#D97706']}
              style={styles.statCard}
            >
              <Text style={styles.statNumber}>
                {articulos.filter(a => a.cantidad < 10).length}
              </Text>
              <Text style={styles.statLabel}>Stock Bajo</Text>
            </LinearGradient>
            
            <LinearGradient
              colors={colors.gradientSuccess}
              style={styles.statCard}
            >
              <Text style={styles.statNumber}>
                {categoriasUnicas.length}
              </Text>
              <Text style={styles.statLabel}>Categorías</Text>
            </LinearGradient>
          </ScrollView>

          {/* Filtros y búsqueda */}
          <View style={styles.filtersContainer}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por nombre o categoría..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={colors.textSecondary}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
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

          {/* Lista principal de artículos */}
          {filteredArticulos.length === 0 ? (
            <View style={styles.emptyInventory}>
                <Ionicons name="cube" size={60} color={colors.textSecondary} />
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
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Espacio al final para mejor scroll */}
          <View style={styles.bottomSpacing} />
        </View>
      </ScrollView>

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
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalBody}>
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
                {categoriasUnicas.length > 0 && (
                  <View style={styles.categoryModeRow}>
                    <TouchableOpacity
                      style={[styles.categoryModeButton, useExistingCategory && styles.categoryModeButtonActive]}
                      onPress={() => setUseExistingCategory(true)}
                    >
                      <Text
                        style={[styles.categoryModeText, useExistingCategory && styles.categoryModeTextActive]}
                      >
                        Usar existente
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.categoryModeButton, !useExistingCategory && styles.categoryModeButtonActive]}
                      onPress={() => setUseExistingCategory(false)}
                    >
                      <Text
                        style={[styles.categoryModeText, !useExistingCategory && styles.categoryModeTextActive]}
                      >
                        Nueva
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {useExistingCategory && categoriasUnicas.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryChipsRow}
                  >
                    {categoriasUnicas.map((cat) => (
                      <TouchableOpacity
                        key={`cat-chip-${cat}`}
                        style={[styles.categoryChip, categoriaSeleccionada === cat && styles.categoryChipActive]}
                        onPress={() => setCategoriaSeleccionada(cat)}
                      >
                        <Text
                          style={[styles.categoryChipText, categoriaSeleccionada === cat && styles.categoryChipTextActive]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: Agua purificada"
                    value={categoria}
                    onChangeText={setCategoria}
                  />
                )}

                {useExistingCategory && categoriasUnicas.length === 0 && (
                  <Text style={styles.helperText}>No hay categorías creadas aún. Escribe una nueva.</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Unidad de medida *</Text>
                <View style={styles.categoryModeRow}>
                  <TouchableOpacity
                    style={[styles.categoryModeButton, useExistingUnit && styles.categoryModeButtonActive]}
                    onPress={() => setUseExistingUnit(true)}
                  >
                    <Text style={[styles.categoryModeText, useExistingUnit && styles.categoryModeTextActive]}>
                      Usar existente
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.categoryModeButton, !useExistingUnit && styles.categoryModeButtonActive]}
                    onPress={() => setUseExistingUnit(false)}
                  >
                    <Text style={[styles.categoryModeText, !useExistingUnit && styles.categoryModeTextActive]}>
                      Nueva
                    </Text>
                  </TouchableOpacity>
                </View>

                {useExistingUnit ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryChipsRow}
                  >
                    {unidadesPredefinidas.map((u) => (
                      <TouchableOpacity
                        key={`unidad-${u}`}
                        style={[styles.categoryChip, unidadSeleccionada === u && styles.categoryChipActive]}
                        onPress={() => setUnidadSeleccionada(u)}
                      >
                        <Text style={[styles.categoryChipText, unidadSeleccionada === u && styles.categoryChipTextActive]}>
                          {u}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: unidades, litros, etc."
                    value={unidad}
                    onChangeText={setUnidad}
                  />
                )}
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Cantidad inicial</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  keyboardType="numeric"
                  value={cantidad ? String(cantidad) : ''}
                  onChangeText={(text) => setCantidad(Number(text) || 0)}
                  editable={!editingId}
                  selectTextOnFocus={!editingId}
                />
                {editingId && (
                  <Text style={styles.helperText}>La cantidad se ajusta con movimientos.</Text>
                )}
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
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <View style={[styles.modalContent, styles.modalBody]}>
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
                    color={tipoMovimiento === 'entrada' ? colors.textInverse : colors.secondary}
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
                    color={tipoMovimiento === 'salida' ? colors.textInverse : colors.error}
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

      {/* Modal para eliminar artículos */}
      <Modal
        visible={showDeleteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeDeleteModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Eliminar artículos</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={closeDeleteModal}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.modalContent, styles.modalBody]}>
              <View style={styles.deleteFiltersRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity
                    style={[styles.categoryFilter, !filterDeleteCategoria && styles.categoryFilterActive]}
                    onPress={() => setFilterDeleteCategoria('')}
                  >
                    <Text style={[styles.categoryFilterText, !filterDeleteCategoria && styles.categoryFilterTextActive]}>
                      Todas las categorías
                    </Text>
                  </TouchableOpacity>
                  {categoriasUnicas.map((cat) => (
                    <TouchableOpacity
                      key={`del-${cat}`}
                      style={[styles.categoryFilter, filterDeleteCategoria === cat && styles.categoryFilterActive]}
                      onPress={() => setFilterDeleteCategoria(filterDeleteCategoria === cat ? '' : cat)}
                    >
                      <Text style={[styles.categoryFilterText, filterDeleteCategoria === cat && styles.categoryFilterTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {articulosParaEliminar.length > 0 && (
                  <TouchableOpacity
                    style={styles.selectAllButton}
                    onPress={() => toggleSelectAllFiltered(articulosParaEliminar)}
                  >
                    <Ionicons
                      name={articulosParaEliminar.every((a) => selectedForDeletion.has(a.id)) ? 'checkbox' : 'square-outline'}
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.selectAllText}>Seleccionar todo</Text>
                  </TouchableOpacity>
                )}
              </View>

              {selectedForDeletion.size > 0 && (
                <Text style={styles.selectionCounter}>
                  {selectedForDeletion.size} seleccionado(s)
                </Text>
              )}

              <ScrollView style={styles.deleteList} contentContainerStyle={styles.deleteListContent}>
                {articulosParaEliminar.length === 0 ? (
                  <View style={styles.deleteEmpty}>
                    <Ionicons name="cube" size={40} color={colors.textSecondary} />
                    <Text style={styles.emptyStateText}>No hay artículos en esta categoría.</Text>
                  </View>
                ) : (
                  articulosParaEliminar.map((item) => {
                    const checked = selectedForDeletion.has(item.id);
                    return (
                      <TouchableOpacity
                        key={`del-item-${item.id}`}
                        style={[styles.deleteRow, checked && styles.deleteRowSelected]}
                        onPress={() => toggleSelectForDeletion(item.id)}
                      >
                        <View style={styles.deleteRowInfo}>
                          <Text style={styles.deleteRowTitle}>{item.nombre}</Text>
                          <Text style={styles.deleteRowSubtitle}>{item.categoria}</Text>
                        </View>
                        <Ionicons
                          name={checked ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={checked ? colors.primary : colors.textSecondary}
                        />
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.cancelButton, styles.cancelButtonAlt]}
                onPress={closeDeleteModal}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              {deleting ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ flex: 2 }} />
              ) : (
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    styles.deleteActionButton,
                    !hasSelectionForDeletion && styles.deleteActionButtonDisabled,
                  ]}
                  disabled={!hasSelectionForDeletion}
                  onPress={() => handleBulkDeleteConfirm(selectedItemsForDeletion)}
                >
                  <Text style={styles.saveButtonText}>Eliminar seleccionados</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para seleccionar artículo a editar */}
      <Modal
        visible={showSelectEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSelectEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar artículos</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowSelectEditModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.modalContent, styles.modalBody]}>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={colors.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar artículo..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={colors.textSecondary}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <ScrollView style={styles.deleteList} contentContainerStyle={styles.deleteListContent}>
                {filteredArticulos.length === 0 ? (
                  <View style={styles.deleteEmpty}>
                    <Ionicons name="cube" size={40} color={colors.textSecondary} />
                    <Text style={styles.emptyStateText}>No hay artículos para editar.</Text>
                  </View>
                ) : (
                  filteredArticulos.map((item) => (
                    <TouchableOpacity
                      key={`edit-item-${item.id}`}
                      style={styles.deleteRow}
                      onPress={() => handleSelectItemForEdit(item)}
                    >
                      <View style={styles.deleteRowInfo}>
                        <Text style={styles.deleteRowTitle}>{item.nombre}</Text>
                        <Text style={styles.deleteRowSubtitle}>{item.categoria}</Text>
                      </View>
                      <Ionicons name="create-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.cancelButton, styles.cancelButtonAlt]}
                onPress={() => setShowSelectEditModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cerrar</Text>
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
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textInverse,
    marginLeft: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  addButtonText: {
    color: colors.textInverse,
    fontWeight: '600',
    marginLeft: 6,
  },
  deleteTopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    marginLeft: 10,
  },
  editTopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    marginLeft: 10,
  },
  deleteTopButtonText: {
    color: colors.textInverse,
    fontWeight: '600',
    marginLeft: 6,
  },
  deleteFiltersRow: {
    marginBottom: 10,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  selectAllText: {
    marginLeft: 6,
    color: colors.primary,
    fontWeight: '600',
  },
  selectionCounter: {
    marginTop: 6,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  deleteList: {
    maxHeight: 320,
    flexGrow: 0,
  },
  deleteListContent: {
    paddingBottom: 10,
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  deleteRowSelected: {
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  deleteRowInfo: {
    flex: 1,
    marginRight: 10,
  },
  deleteRowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  deleteRowSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  deleteEmpty: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  statsContainer: {
    marginTop: -30,
    marginBottom: 20,
  },
  statCard: {
    padding: 20,
    borderRadius: 16,
    marginRight: 12,
    minWidth: 120,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textInverse,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  filtersContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 15,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 16,
    color: colors.textPrimary,
  },
  categoriesContainer: {
    flexDirection: 'row',
  },
  categoryFilter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.background,
    borderRadius: 20,
    marginRight: 10,
  },
  categoryFilterActive: {
    backgroundColor: colors.primary,
  },
  categoryFilterText: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
  categoryFilterTextActive: {
    color: colors.textInverse,
  },
  listContainer: {
    paddingBottom: 20,
  },
  itemContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 15,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
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
    color: colors.textPrimary,
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
    color: colors.textInverse,
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
    color: colors.textInverse,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
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
    backgroundColor: colors.error,
  },
  actionButtonText: {
    color: colors.textInverse,
    fontWeight: '500',
    marginLeft: 6,
    fontSize: 12,
  },
  movimientosContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
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
    color: colors.textPrimary,
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
    backgroundColor: colors.background,
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
    borderLeftColor: colors.error,
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
    backgroundColor: colors.error,
  },
  movTypeText: {
    color: colors.textInverse,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  movDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  movDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  movCantidad: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  movObservaciones: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
    marginLeft: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyStateText: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 16,
  },
  emptyInventory: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 40,
  },
  emptyInventoryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyInventoryText: {
    fontSize: 16,
    color: colors.textSecondary,
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
    color: colors.textInverse,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    maxHeight: '90%',
    width: '92%',
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
    maxHeight: '70%',
  },
  modalBody: {
    flexGrow: 0,
    flexShrink: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: colors.textPrimary,
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
    borderColor: colors.borderLight,
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
    color: colors.textSecondary,
  },
  tipoButtonTextSelected: {
    color: colors.textInverse,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginRight: 10,
  },
  categoryModeRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  categoryModeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: colors.background,
  },
  categoryModeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryModeText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  categoryModeTextActive: {
    color: colors.textInverse,
  },
  categoryChipsRow: {
    paddingVertical: 6,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: colors.textInverse,
  },
  helperText: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 12,
  },
  cancelButtonText: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  cancelButtonAlt: {
    backgroundColor: colors.background,
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
  deleteActionButton: {
    backgroundColor: colors.error,
  },
  deleteActionButtonDisabled: {
    backgroundColor: colors.border,
  },
  saveButtonText: {
    color: colors.textInverse,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 20,
  },
});

export default InventoryScreen;