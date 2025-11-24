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
  Alert,
  Dimensions,
  Animated,
  StatusBar
} from 'react-native';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  getAuth,
  createUserWithEmailAndPassword,
  UserCredential,
} from 'firebase/auth';
import { db } from '../../firebaseConfig';
import Toast from 'react-native-toast-message';
import { FontAwesome5, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, globalStyles } from '../styles/globalStyles';

const { width, height } = Dimensions.get('window');

// Interfaz para documentos en la colección "usuarios"
interface UsuarioDoc {
  id: string;
  nombre: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  cedula?: string;
  password?: string;
  tipo?: string;
  activo?: boolean;
}

// Interfaz para documentos en la colección "clientes"
interface ClienteDoc {
  id: string;
  nombre: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  cedula?: string;
  password?: string;
  tipo?: string;
  activo?: boolean;
}

// Para manejar el item seleccionado y saber si es "usuario" o "cliente"
interface SelectedItem {
  id: string;
  type: 'usuario' | 'cliente';
}

const CreateUserScreen = () => {
  // Estados para las listas
  const [listaUsuarios, setListaUsuarios] = useState<UsuarioDoc[]>([]);
  const [listaClientes, setListaClientes] = useState<ClienteDoc[]>([]);

  // Estados para búsqueda y filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'todos' | 'admins' | 'clientes'>('todos');
  const [filteredUsuarios, setFilteredUsuarios] = useState<UsuarioDoc[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<ClienteDoc[]>([]);

  // Control del formulario principal (crear usuario/cliente)
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [password, setPassword] = useState('');
  const [tipo, setTipo] = useState<'usuario' | 'cliente'>('cliente');
  const [loading, setLoading] = useState(false);

  // Estado para item seleccionado (para mostrar botones de acción)
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);

  // Estado para mostrar/hide formulario de modificación
  const [showEditForm, setShowEditForm] = useState(false);

  // Estados locales para la edición
  const [editNombre, setEditNombre] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editDireccion, setEditDireccion] = useState('');

  // Animaciones
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(300));

  // Filtrar datos en tiempo real (solo por nombre y cédula)
  useEffect(() => {
    const filterData = () => {
      const query = (searchQuery || '').toLowerCase().trim();

      if (!query) {
        setFilteredUsuarios(listaUsuarios);
        setFilteredClientes(listaClientes);
        return;
      }

      const filteredUsers = listaUsuarios.filter(user => {
        const nombre = String(user.nombre ?? '').toLowerCase();
        const cedula = String(user.cedula ?? '').toLowerCase();

        return (
          nombre.includes(query) ||
          cedula.includes(query)
        );
      });

      const filteredClients = listaClientes.filter(client => {
        const nombre = String(client.nombre ?? '').toLowerCase();
        const cedula = String(client.cedula ?? '').toLowerCase();

        return (
          nombre.includes(query) ||
          cedula.includes(query)
        );
      });

      setFilteredUsuarios(filteredUsers);
      setFilteredClientes(filteredClients);
    };

    filterData();
  }, [searchQuery, listaUsuarios, listaClientes]);

  // Efectos de animación
  useEffect(() => {
    if (showForm) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showForm]);

  // Suscribirse a "usuarios" y "Clientes"
  useEffect(() => {
    const unsubscribeUsers = onSnapshot(collection(db, 'usuarios'), (snapshot) => {
      const data: UsuarioDoc[] = snapshot.docs.map((documento) => {
        const docData = documento.data() as Omit<UsuarioDoc, 'id'>;
        return {
          id: documento.id,
          ...docData,
        };
      });
      setListaUsuarios(data);
      setFilteredUsuarios(data);
    });

    const unsubscribeClients = onSnapshot(collection(db, 'Clientes'), (snapshot) => {
      const data: ClienteDoc[] = snapshot.docs.map((documento) => {
        const docData = documento.data() as Omit<ClienteDoc, 'id'>;
        return {
          id: documento.id,
          ...docData,
        };
      });
      setListaClientes(data);
      setFilteredClientes(data);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeClients();
    };
  }, []);

  // Crear nuevo user/cliente TANTO en Auth como en Firestore
  const handleCreate = async () => {
    if (!nombre || !cedula || !email || !telefono || !direccion) {
      showToast('error', 'Completa todos los campos requeridos.');
      return;
    }
    if (!password) {
      showToast('error', 'Debes especificar una contraseña para el Auth.');
      return;
    }

    setLoading(true);

    try {
      // 1. Crear en Firebase Auth
      const auth = getAuth();
      const userCredential: UserCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // 2. Crear en Firestore
      let collectionName = 'Clientes';
      let valorTipo = 'cliente';

      if (tipo === 'usuario') {
        collectionName = 'usuarios';
        valorTipo = 'admin';
      }

      await setDoc(doc(db, collectionName, user.uid), {
        nombre,
        cedula,
        email,
        telefono,
        direccion,
        password,
        tipo: valorTipo,
        activo: true,
      });

      showToast('success', `Se creó un ${valorTipo} correctamente en Auth y Firestore.`);

      // Limpiar campos
      setNombre('');
      setCedula('');
      setEmail('');
      setTelefono('');
      setDireccion('');
      setPassword('');
      setTipo('cliente');
      setShowForm(false);

    } catch (error) {
      console.error('Error al crear registro:', error);
      showToast('error', 'No se pudo crear. Intenta de nuevo.');
    }
    setLoading(false);
  };

  // Función para mostrar reporte de usuarios
  const handleReport = () => {
    let report = '📊 Reporte de Usuarios - AQUALIFE\n\n';
    
    report += `👥 USUARIOS ADMIN (${listaUsuarios.length})\n`;
    if (listaUsuarios.length === 0) {
      report += '   No hay usuarios administradores registrados.\n\n';
    } else {
      listaUsuarios.forEach((user, index) => {
        report += `   ${index + 1}. ${user.nombre}\n`;
        report += `      📧 ${user.email || 'N/A'}\n`;
        report += `      📞 ${user.telefono || 'N/A'}\n`;
        report += `      🆔 ${user.cedula || 'N/A'}\n`;
        report += `      🏠 ${user.direccion || 'N/A'}\n`;
        report += `      🔄 ${user.activo ? '✅ Activo' : '❌ Inactivo'}\n\n`;
      });
    }

    report += `👤 CLIENTES (${listaClientes.length})\n`;
    if (listaClientes.length === 0) {
      report += '   No hay clientes registrados.';
    } else {
      listaClientes.forEach((client, index) => {
        report += `   ${index + 1}. ${client.nombre}\n`;
        report += `      📧 ${client.email || 'N/A'}\n`;
        report += `      📞 ${client.telefono || 'N/A'}\n`;
        report += `      🆔 ${client.cedula || 'N/A'}\n`;
        report += `      🏠 ${client.direccion || 'N/A'}\n`;
        report += `      🔄 ${client.activo ? '✅ Activo' : '❌ Inactivo'}\n\n`;
      });
    }

    Alert.alert('📊 Reporte Completo', report, [{ text: 'OK', style: 'default' }]);
  };

  // Mostrar toast
  const showToast = (type: 'success' | 'error', message: string) => {
    Toast.show({
      type,
      text1: type === 'success' ? '¡Éxito!' : 'Error',
      text2: message,
      position: 'top',
      visibilityTime: 4000,
    });
  };

  // ======== Selección de item ==========
  const handleSelectUsuario = (id: string) => {
    if (selectedItem?.id === id && selectedItem.type === 'usuario') {
      setSelectedItem(null);
    } else {
      setSelectedItem({ id, type: 'usuario' });
    }
    setShowEditForm(false);
  };

  const handleSelectCliente = (id: string) => {
    if (selectedItem?.id === id && selectedItem.type === 'cliente') {
      setSelectedItem(null);
    } else {
      setSelectedItem({ id, type: 'cliente' });
    }
    setShowEditForm(false);
  };

  // ======== Acciones en la sección de botones ==========
  const handleCancelSelection = () => {
    setSelectedItem(null);
    setShowEditForm(false);
  };

  const handleModify = async () => {
    if (!selectedItem) return;
    let itemToEdit: UsuarioDoc | ClienteDoc | undefined;

    if (selectedItem.type === 'usuario') {
      itemToEdit = listaUsuarios.find((u) => u.id === selectedItem.id);
    } else {
      itemToEdit = listaClientes.find((c) => c.id === selectedItem.id);
    }

    if (!itemToEdit) {
      showToast('error', 'No se encontró el documento a editar.');
      return;
    }

    setEditNombre(itemToEdit.nombre);
    setEditTelefono(itemToEdit.telefono || '');
    setEditDireccion(itemToEdit.direccion || '');
    setShowEditForm(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedItem) return;
    const colName = selectedItem.type === 'usuario' ? 'usuarios' : 'Clientes';

    try {
      await updateDoc(doc(db, colName, selectedItem.id), {
        nombre: editNombre,
        telefono: editTelefono,
        direccion: editDireccion,
      });
      showToast('success', 'Datos modificados correctamente.');
      setSelectedItem(null);
      setShowEditForm(false);
    } catch (err) {
      console.error(err);
      showToast('error', 'No se pudo modificar.');
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    
    Alert.alert(
      'Confirmar Eliminación',
      `¿Estás seguro de que deseas eliminar este ${selectedItem.type === 'usuario' ? 'usuario' : 'cliente'}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            const colName = selectedItem.type === 'usuario' ? 'usuarios' : 'Clientes';
            try {
              await deleteDoc(doc(db, colName, selectedItem.id));
              showToast('success', 'Eliminado correctamente.');
              setSelectedItem(null);
              setShowEditForm(false);
            } catch (err) {
              console.error(err);
              showToast('error', 'No se pudo eliminar.');
            }
          }
        }
      ]
    );
  };

  const handleDeactivate = async () => {
    if (!selectedItem) return;
    const colName = selectedItem.type === 'usuario' ? 'usuarios' : 'Clientes';

    try {
      await updateDoc(doc(db, colName, selectedItem.id), {
        activo: false,
      });
      showToast('success', 'Desactivado correctamente.');
      setSelectedItem(null);
      setShowEditForm(false);
    } catch (err) {
      console.error(err);
      showToast('error', 'No se pudo desactivar.');
    }
  };

  // Nueva función para activar usuarios/clientes
  const handleActivate = async () => {
    if (!selectedItem) return;
    const colName = selectedItem.type === 'usuario' ? 'usuarios' : 'Clientes';

    try {
      await updateDoc(doc(db, colName, selectedItem.id), {
        activo: true,
      });
      showToast('success', 'Activado correctamente.');
      setSelectedItem(null);
      setShowEditForm(false);
    } catch (err) {
      console.error(err);
      showToast('error', 'No se pudo activar.');
    }
  };

  // Obtener datos según la pestaña activa
  const getDisplayData = () => {
    switch (activeTab) {
      case 'admins':
        return filteredUsuarios;
      case 'clientes':
        return filteredClientes;
      case 'todos':
      default:
        return [...filteredUsuarios, ...filteredClientes];
    }
  };

  // Renderizar tarjeta de usuario en grid
  const renderUserCard = (item: UsuarioDoc | ClienteDoc, type: 'usuario' | 'cliente') => {
    const isSelected = selectedItem?.id === item.id && selectedItem?.type === type;
    const isAdmin = type === 'usuario';

    return (
      <TouchableOpacity 
        onPress={() => isAdmin ? handleSelectUsuario(item.id) : handleSelectCliente(item.id)}
        style={[
          styles.userGridCard,
          isSelected && styles.userGridCardSelected,
          !item.activo && styles.userGridCardInactive
        ]}
      >
        {/* Header de la tarjeta */}
        <LinearGradient
          colors={isAdmin ? colors.gradientSecondary : colors.gradientSuccess}
          style={styles.cardHeader}
        >
          <View style={styles.cardAvatar}>
            <FontAwesome5 
              name={isAdmin ? "user-cog" : "user"} 
              size={20} 
              color={colors.textInverse} 
            />
          </View>
          <View style={styles.cardStatus}>
            <View style={[
              styles.statusDot,
              item.activo ? styles.statusActive : styles.statusInactive
            ]} />
            <Text style={styles.statusText}>
              {item.activo ? 'Activo' : 'Inactivo'}
            </Text>
          </View>
        </LinearGradient>

        {/* Contenido de la tarjeta */}
        <View style={styles.cardContent}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.nombre}
          </Text>
          <Text style={styles.cardEmail} numberOfLines={1}>
            {item.email}
          </Text>
          
          <View style={styles.cardDetails}>
            <View style={styles.detailItem}>
              <FontAwesome5 name="id-card" size={12} color={colors.textSecondary} />
              <Text style={styles.detailText} numberOfLines={1}>
                {item.cedula || 'N/A'}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <FontAwesome5 name="phone" size={12} color={colors.textSecondary} />
              <Text style={styles.detailText} numberOfLines={1}>
                {item.telefono || 'N/A'}
              </Text>
            </View>
            {!isAdmin && (
              <View style={styles.detailItem}>
                <FontAwesome5 name="map-marker-alt" size={12} color={colors.textSecondary} />
                <Text style={styles.detailText} numberOfLines={1}>
                  {item.direccion || 'N/A'}
                </Text>
              </View>
            )}
          </View>

          {/* Badge de tipo */}
          <View style={[
            styles.typeBadge,
            isAdmin ? styles.typeBadgeAdmin : styles.typeBadgeClient
          ]}>
            <Text style={styles.typeBadgeText}>
              {isAdmin ? 'ADMIN' : 'CLIENTE'}
            </Text>
          </View>
        </View>

        {/* Acciones (solo cuando está seleccionado) */}
        {isSelected && (
          <Animated.View style={styles.gridActions}>
            <TouchableOpacity 
              style={[styles.gridActionButton, styles.modifyButton]} 
              onPress={handleModify}
            >
              <FontAwesome5 name="edit" size={14} color={colors.textInverse} />
            </TouchableOpacity>

            {item.activo ? (
              <TouchableOpacity 
                style={[styles.gridActionButton, styles.deactivateButton]} 
                onPress={handleDeactivate}
              >
                <FontAwesome5 name="power-off" size={14} color={colors.textInverse} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.gridActionButton, styles.activateButton]} 
                onPress={handleActivate}
              >
                <FontAwesome5 name="check-circle" size={14} color={colors.textInverse} />
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[styles.gridActionButton, styles.deleteButton]} 
              onPress={handleDelete}
            >
              <FontAwesome5 name="trash" size={14} color={colors.textInverse} />
            </TouchableOpacity>
          </Animated.View>
        )}
      </TouchableOpacity>
    );
  };

  // Renderizar grid de usuarios
  const renderUserGrid = () => {
    const displayData = getDisplayData();
    
    if (displayData.length === 0) {
      return (
        <View style={styles.emptyGridState}>
          <FontAwesome5 
            name={searchQuery ? "search" : "users"} 
            size={60} 
            color={colors.border} 
          />
          <Text style={styles.emptyGridText}>
            {searchQuery 
              ? 'No se encontraron resultados' 
              : activeTab === 'todos' 
                ? 'No hay usuarios registrados' 
                : activeTab === 'admins' 
                  ? 'No hay administradores registrados' 
                  : 'No hay clientes registrados'
            }
          </Text>
          {searchQuery && (
            <TouchableOpacity 
              style={styles.clearSearchButton}
              onPress={() => setSearchQuery('')}
            >
              <Text style={styles.clearSearchText}>Limpiar búsqueda</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <FlatList
        data={displayData}
        renderItem={({ item }) => renderUserCard(
          item, 
          listaUsuarios.find(u => u.id === item.id) ? 'usuario' : 'cliente'
        )}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  // Formulario de edición
  const renderEditForm = () => {
    if (!showEditForm) return null;
    
    return (
      <Animated.View style={[styles.editFormContainer, { transform: [{ translateY: slideAnim }] }]}>
        <LinearGradient
          colors={colors.gradientSecondary}
          style={styles.editFormHeader}
        >
          <Text style={styles.editFormTitle}>✏️ Editar Información</Text>
          <TouchableOpacity onPress={() => setShowEditForm(false)}>
            <FontAwesome5 name="times" size={20} color={colors.textInverse} />
          </TouchableOpacity>
        </LinearGradient>
        
        <View style={styles.editFormContent}>
          <View style={styles.inputGroup}>
            <FontAwesome5 name="user" size={16} color={colors.secondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Nombre completo"
              value={editNombre}
              onChangeText={setEditNombre}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <FontAwesome5 name="phone" size={16} color={colors.secondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Teléfono"
              value={editTelefono}
              onChangeText={setEditTelefono}
              keyboardType="phone-pad"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <FontAwesome5 name="map-marker-alt" size={16} color={colors.secondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Dirección"
              value={editDireccion}
              onChangeText={setEditDireccion}
            />
          </View>
          
          <View style={styles.editFormActions}>
            <TouchableOpacity 
              style={[styles.editButton, styles.cancelEditButton]} 
              onPress={() => setShowEditForm(false)}
            >
              <Text style={styles.cancelEditButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.editButton, styles.saveEditButton]} 
              onPress={handleSaveEdit}
            >
              <Text style={styles.saveEditButtonText}>Guardar Cambios</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
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
              <FontAwesome5 name="users-cog" size={24} color={colors.textInverse} />
              <Text style={styles.headerTitle}>Gestión de Usuarios</Text>
            </View>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{listaUsuarios.length}</Text>
                <Text style={styles.statLabel}>Admins</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{listaClientes.length}</Text>
                <Text style={styles.statLabel}>Clientes</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{listaUsuarios.length + listaClientes.length}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Contenido principal */}
        <View style={styles.content}>
          {/* Barra de búsqueda */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <FontAwesome5 name="search" size={16} color={colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por nombre, cédula, email..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <FontAwesome5 name="times" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Pestañas de navegación */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'todos' && styles.tabActive]}
              onPress={() => setActiveTab('todos')}
            >
              <FontAwesome5 
                name="users" 
                size={16} 
                color={activeTab === 'todos' ? colors.textInverse : colors.secondary} 
              />
              <Text style={[styles.tabText, activeTab === 'todos' && styles.tabTextActive]}>
                Todos ({listaUsuarios.length + listaClientes.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'admins' && styles.tabActive]}
              onPress={() => setActiveTab('admins')}
            >
              <FontAwesome5 
                name="user-cog" 
                size={16} 
                color={activeTab === 'admins' ? colors.textInverse : colors.secondary} 
              />
              <Text style={[styles.tabText, activeTab === 'admins' && styles.tabTextActive]}>
                Admins ({listaUsuarios.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'clientes' && styles.tabActive]}
              onPress={() => setActiveTab('clientes')}
            >
              <FontAwesome5 
                name="user" 
                size={16} 
                color={activeTab === 'clientes' ? colors.textInverse : colors.secondary} 
              />
              <Text style={[styles.tabText, activeTab === 'clientes' && styles.tabTextActive]}>
                Clientes ({listaClientes.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Botón principal de creación */}
          <TouchableOpacity
            style={styles.mainActionButton}
            onPress={() => {
              setShowForm(!showForm);
              setSelectedItem(null);
              setShowEditForm(false);
            }}
          >
            <LinearGradient
              colors={colors.gradientSuccess}
              style={styles.mainActionGradient}
            >
              <FontAwesome5 name={showForm ? "times" : "user-plus"} size={20} color={colors.textInverse} />
              <Text style={styles.mainActionText}>
                {showForm ? 'Cancelar' : 'Nuevo Usuario'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Formulario de creación */}
          <Animated.View 
            style={[
              styles.formContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            {showForm && (
              <LinearGradient
                colors={[colors.surface, colors.background]}
                style={styles.formGradient}
              >
                <Text style={styles.formTitle}>
                  {tipo === 'cliente' ? '👤 Registrar Cliente' : '👑 Registrar Administrador'}
                </Text>

                <View style={styles.formGrid}>
                  <View style={styles.inputGroup}>
                    <FontAwesome5 name="user" size={16} color={colors.secondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Nombre completo"
                      value={nombre}
                      onChangeText={setNombre}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <FontAwesome5 name="id-card" size={16} color={colors.secondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Cédula"
                      value={cedula}
                      onChangeText={setCedula}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <FontAwesome5 name="envelope" size={16} color={colors.secondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Correo electrónico"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <FontAwesome5 name="phone" size={16} color={colors.secondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Teléfono"
                      value={telefono}
                      onChangeText={setTelefono}
                      keyboardType="phone-pad"
                    />
                  </View>

                  <View style={[styles.inputGroup, styles.fullWidth]}>
                    <FontAwesome5 name="map-marker-alt" size={16} color={colors.secondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Dirección completa"
                      value={direccion}
                      onChangeText={setDireccion}
                    />
                  </View>

                  <View style={[styles.inputGroup, styles.fullWidth]}>
                    <FontAwesome5 name="lock" size={16} color={colors.secondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Contraseña"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                    />
                  </View>
                </View>

                {/* Selector de tipo */}
                <View style={styles.tipoContainer}>
                  <Text style={styles.tipoLabel}>Tipo de Cuenta:</Text>
                  <View style={styles.tipoButtons}>
                    <TouchableOpacity
                      style={[
                        styles.tipoButton,
                        tipo === 'usuario' && styles.tipoButtonSelected,
                      ]}
                      onPress={() => setTipo('usuario')}
                    >
                      <FontAwesome5 
                        name="user-cog" 
                        size={16} 
                        color={tipo === 'usuario' ? colors.textInverse : colors.secondary} 
                      />
                      <Text
                        style={[
                          styles.tipoButtonText,
                          tipo === 'usuario' && styles.tipoButtonTextSelected,
                        ]}
                      >
                        Administrador
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.tipoButton,
                        tipo === 'cliente' && styles.tipoButtonSelected,
                      ]}
                      onPress={() => setTipo('cliente')}
                    >
                      <FontAwesome5 
                        name="user" 
                        size={16} 
                        color={tipo === 'cliente' ? colors.textInverse : colors.secondary} 
                      />
                      <Text
                        style={[
                          styles.tipoButtonText,
                          tipo === 'cliente' && styles.tipoButtonTextSelected,
                        ]}
                      >
                        Cliente
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.secondary} />
                    <Text style={styles.loadingText}>Creando usuario...</Text>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.createButton} 
                    onPress={handleCreate}
                  >
                    <LinearGradient
                      colors={colors.gradientSecondary}
                      style={styles.createButtonGradient}
                    >
                      <FontAwesome5 name="save" size={18} color={colors.textInverse} />
                      <Text style={styles.createButtonText}>Crear Usuario</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </LinearGradient>
            )}
          </Animated.View>

          {/* Formulario de edición */}
          {renderEditForm()}

          {/* Grid de usuarios */}
          {renderUserGrid()}

          {/* Espacio al final para mejor scroll */}
          <View style={styles.bottomSpacing} />
        </View>
      </ScrollView>

      {/* Botón flotante de Reporte */}
      <TouchableOpacity 
        style={styles.fabReport} 
        onPress={handleReport}
      >
        <LinearGradient
          colors={[colors.warning, colors.warning]}
          style={styles.fabGradient}
        >
          <FontAwesome5 name="file-alt" size={20} color={colors.textInverse} />
        </LinearGradient>
      </TouchableOpacity>

      <Toast />
    </View>
  );
};

// Estilos mejorados con Grid
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
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
  statsContainer: {
    flexDirection: 'row',
  },
  statItem: {
    alignItems: 'center',
    marginLeft: 15,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textInverse,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  searchContainer: {
    marginBottom: 15,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  tabActive: {
    backgroundColor: colors.secondary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.secondary,
    marginLeft: 5,
  },
  tabTextActive: {
    color: colors.textInverse,
  },
  mainActionButton: {
    marginBottom: 20,
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  mainActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  mainActionText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  formContainer: {
    marginBottom: 20,
  },
  formGradient: {
    borderRadius: 15,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  inputGroup: {
    width: (width - 80) / 2,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fullWidth: {
    width: '100%',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
  },
  tipoContainer: {
    marginVertical: 15,
  },
  tipoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  tipoButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tipoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.secondary,
    marginHorizontal: 5,
    backgroundColor: colors.card,
  },
  tipoButtonSelected: {
    backgroundColor: colors.secondary,
  },
  tipoButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.secondary,
    marginLeft: 6,
  },
  tipoButtonTextSelected: {
    color: colors.textInverse,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 15,
  },
  loadingText: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 12,
  },
  createButton: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 10,
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  createButtonText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  // Grid Styles
  gridContainer: {
    paddingBottom: 20,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  userGridCard: {
    width: (width - 45) / 2,
    backgroundColor: colors.card,
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  userGridCardSelected: {
    borderColor: colors.secondary,
    elevation: 5,
  },
  userGridCardInactive: {
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  cardAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusActive: {
    backgroundColor: colors.success,
  },
  statusInactive: {
    backgroundColor: colors.error,
  },
  statusText: {
    fontSize: 10,
    color: colors.textInverse,
    fontWeight: '600',
  },
  cardContent: {
    padding: 12,
  },
  cardName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  cardEmail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  cardDetails: {
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 10,
    color: colors.textSecondary,
    marginLeft: 6,
    flex: 1,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeAdmin: {
    backgroundColor: colors.grayShades[50],
  },
  typeBadgeClient: {
    backgroundColor: colors.primaryShades[50],
  },
  typeBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  gridActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    padding: 8,
  },
  gridActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    marginHorizontal: 2,
    borderRadius: 6,
  },
  modifyButton: {
    backgroundColor: colors.secondary,
  },
  deactivateButton: {
    backgroundColor: colors.warning,
  },
  activateButton: {
    backgroundColor: colors.success,
  },
  deleteButton: {
    backgroundColor: colors.error,
  },
  emptyGridState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: colors.card,
    borderRadius: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginTop: 20,
  },
  emptyGridText: {
    marginTop: 15,
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  clearSearchButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.secondary,
    borderRadius: 8,
  },
  clearSearchText: {
    color: colors.textInverse,
    fontSize: 12,
    fontWeight: '600',
  },
  editFormContainer: {
    backgroundColor: colors.card,
    borderRadius: 15,
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  editFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  editFormTitle: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: 'bold',
  },
  editFormContent: {
    padding: 16,
  },
  editFormActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  editButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelEditButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveEditButton: {
    backgroundColor: colors.secondary,
  },
  cancelEditButtonText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 12,
  },
  saveEditButtonText: {
    color: colors.textInverse,
    fontWeight: '600',
    fontSize: 12,
  },
  fabReport: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSpacing: {
    height: 20,
  },
});

export default CreateUserScreen;