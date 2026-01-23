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
  StatusBar,
  Modal,
  KeyboardAvoidingView,
  Platform,
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
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../styles/globalStyles';
import { useRoute } from '@react-navigation/native';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';

const { width } = Dimensions.get('window');
const isSmallScreen = width < 520;

const CLIENT_GRADIENT = colors.gradientPrimary;

type ActiveTab = 'todos' | 'admins' | 'clientes';

interface BaseUserDoc {
  id: string;
  nombre?: string;
  cedula?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  password?: string;
  tipo?: string;
  activo?: boolean;
}

type UsuarioDoc = BaseUserDoc;
type ClienteDoc = BaseUserDoc;

type SelectedItem = {
  id: string;
  type: 'usuario' | 'cliente';
};

type CreateFormErrors = {
  nombre?: string;
  cedula?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  password?: string;
};

type EditFormErrors = {
  nombre?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  newPassword?: string;
  confirmPassword?: string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sanitizeName = (value: string) =>
  value
    .replace(/[^a-zA-ZÁÉÍÓÚÜÑáéíóúüñ\s]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trimStart();

const sanitizeCedula = (value: string) =>
  value.replace(/\D/g, '').slice(0, 12);

const sanitizeEmail = (value: string) => value.replace(/\s/g, '').toLowerCase();

const sanitizePhone = (value: string) =>
  value
    .replace(/[^0-9+]/g, '')
    .replace(/(?!^)\+/g, '')
    .slice(0, 15);

const sanitizeAddress = (value: string) =>
  value.replace(/\s{2,}/g, ' ').trimStart();

const sanitizePassword = (value: string) => value.trim();

const sanitizeSearch = (value: string) =>
  value
    .replace(/[^a-zA-Z0-9ÁÉÍÓÚÜÑáéíóúüñ\s]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trimStart();

const CreateUserScreen = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'CreateScreenUser'>>();
  const [listaUsuarios, setListaUsuarios] = useState<UsuarioDoc[]>([]);
  const [listaClientes, setListaClientes] = useState<ClienteDoc[]>([]);
  const [filteredUsuarios, setFilteredUsuarios] = useState<UsuarioDoc[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<ClienteDoc[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('todos');
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);

  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [password, setPassword] = useState('');
  const [tipo, setTipo] = useState<'cliente' | 'usuario'>('cliente');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formErrors, setFormErrors] = useState<CreateFormErrors>({});

  const [showEditForm, setShowEditForm] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editDireccion, setEditDireccion] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editActivo, setEditActivo] = useState(true);
  const [editCedula, setEditCedula] = useState('');
  const [editTipo, setEditTipo] = useState<'usuario' | 'cliente'>('cliente');
  const [changePassword, setChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editErrors, setEditErrors] = useState<EditFormErrors>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const clearCreateError = (field: keyof CreateFormErrors) => {
    setFormErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleNombreChange = (value: string) => {
    setNombre(sanitizeName(value));
    clearCreateError('nombre');
  };

  const handleCedulaChange = (value: string) => {
    setCedula(sanitizeCedula(value));
    clearCreateError('cedula');
  };

  const handleEmailChange = (value: string) => {
    setEmail(sanitizeEmail(value));
    clearCreateError('email');
  };

  const handleTelefonoChange = (value: string) => {
    setTelefono(sanitizePhone(value));
    clearCreateError('telefono');
  };

  const handleSearchChange = (value: string) => {
    const sanitized = sanitizeSearch(value);
    setSearchQuery(sanitized);
  };

  const handleDireccionChange = (value: string) => {
    setDireccion(sanitizeAddress(value));
    clearCreateError('direccion');
  };

  const handlePasswordChange = (value: string) => {
    setPassword(sanitizePassword(value));
    clearCreateError('password');
  };

  const clearEditError = (field: keyof EditFormErrors) => {
    setEditErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleEditNombreChange = (value: string) => {
    setEditNombre(sanitizeName(value));
    clearEditError('nombre');
  };

  const handleEditTelefonoChange = (value: string) => {
    setEditTelefono(sanitizePhone(value));
    clearEditError('telefono');
  };

  const handleEditDireccionChange = (value: string) => {
    setEditDireccion(sanitizeAddress(value));
    clearEditError('direccion');
  };

  const handleEditEmailChange = (value: string) => {
    setEditEmail(sanitizeEmail(value));
    clearEditError('email');
  };

  const handleToggleChangePassword = () => {
    setChangePassword((prev) => {
      const next = !prev;
      if (!next) {
        setNewPassword('');
        setConfirmPassword('');
        setEditErrors((current) => {
          const clone = { ...current };
          delete clone.newPassword;
          delete clone.confirmPassword;
          return clone;
        });
      }
      return next;
    });
  };

  const handleNewPasswordChange = (value: string) => {
    setNewPassword(sanitizePassword(value));
    clearEditError('newPassword');
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(sanitizePassword(value));
    clearEditError('confirmPassword');
  };

  const closeCreateModal = () => {
    setShowForm(false);
    setFormErrors({});
  };

  const closeEditModal = () => {
    setShowEditForm(false);
    setEditErrors({});
    setChangePassword(false);
    setNewPassword('');
    setConfirmPassword('');
  };
  // Abrir formulario por params (desde admin)
  useEffect(() => {
    if (route?.params?.openForm) {
      setShowForm(true);
    }
  }, [route?.params?.openForm]);

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

  const validateCreateForm = (): boolean => {
    const errors: CreateFormErrors = {};
    const nombreTrim = nombre.trim();
    const direccionTrim = direccion.trim();

    if (!nombreTrim || nombreTrim.length < 3) {
      errors.nombre = 'Ingresa un nombre con al menos 3 letras.';
    }

    if (!cedula) {
      errors.cedula = 'La cédula es obligatoria.';
    } else if (cedula.length < 6) {
      errors.cedula = 'Incluye al menos 6 dígitos.';
    }

    if (!email) {
      errors.email = 'El correo es obligatorio.';
    } else if (!emailRegex.test(email)) {
      errors.email = 'Formato de correo inválido.';
    }

    if (!telefono) {
      errors.telefono = 'Indica un número de contacto.';
    } else if (telefono.length < 7) {
      errors.telefono = 'Incluye al menos 7 dígitos.';
    }

    if (!direccionTrim || direccionTrim.length < 5) {
      errors.direccion = 'Detalla mejor la dirección.';
    }

    if (!password) {
      errors.password = 'Define una contraseña.';
    } else if (password.length < 6) {
      errors.password = 'Debe tener mínimo 6 caracteres.';
    }

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      showToast('error', 'Corrige los campos marcados.');
      return false;
    }

    return true;
  };

  const validateEditForm = (): boolean => {
    const errors: EditFormErrors = {};
    const nombreTrim = editNombre.trim();
    const direccionTrim = editDireccion.trim();
    const emailTrim = editEmail.trim().toLowerCase();

    if (!nombreTrim || nombreTrim.length < 3) {
      errors.nombre = 'Ingresa un nombre válido.';
    }

    if (!editTelefono) {
      errors.telefono = 'Indica un número de contacto.';
    } else if (editTelefono.length < 7) {
      errors.telefono = 'Incluye al menos 7 dígitos.';
    }

    if (!direccionTrim || direccionTrim.length < 5) {
      errors.direccion = 'Detalla mejor la dirección.';
    }

    if (!emailTrim) {
      errors.email = 'El correo es obligatorio.';
    } else if (!emailRegex.test(emailTrim)) {
      errors.email = 'Ingresa un correo válido.';
    }

    if (changePassword) {
      if (!newPassword) {
        errors.newPassword = 'Define la nueva contraseña.';
      } else if (newPassword.length < 6) {
        errors.newPassword = 'Debe tener al menos 6 caracteres.';
      }

      if (!confirmPassword) {
        errors.confirmPassword = 'Confirma la nueva contraseña.';
      } else if (confirmPassword !== newPassword) {
        errors.confirmPassword = 'Las contraseñas no coinciden.';
      }
    }

    setEditErrors(errors);

    if (Object.keys(errors).length > 0) {
      showToast('error', 'Corrige los datos antes de guardar.');
      return false;
    }

    return true;
  };

  // Crear nuevo user/cliente TANTO en Auth como en Firestore
  const handleCreate = async () => {
    if (!validateCreateForm()) {
      return;
    }

    setLoading(true);

    try {
      const auth = getAuth();
      const userCredential: UserCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );
      const user = userCredential.user;

      let collectionName = 'Clientes';
      let valorTipo = 'cliente';

      if (tipo === 'usuario') {
        collectionName = 'usuarios';
        valorTipo = 'admin';
      }

      await setDoc(doc(db, collectionName, user.uid), {
        nombre: nombre.trim(),
        cedula,
        email: email.trim().toLowerCase(),
        telefono,
        direccion: direccion.trim(),
        password,
        tipo: valorTipo,
        activo: true,
      });

      showToast('success', `Se creó un ${valorTipo} correctamente en Auth y Firestore.`);

      setNombre('');
      setCedula('');
      setEmail('');
      setTelefono('');
      setDireccion('');
      setPassword('');
      setTipo('cliente');
      closeCreateModal();

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
    closeEditModal();
  };

  const handleSelectCliente = (id: string) => {
    if (selectedItem?.id === id && selectedItem.type === 'cliente') {
      setSelectedItem(null);
    } else {
      setSelectedItem({ id, type: 'cliente' });
    }
    closeEditModal();
  };

  // ======== Acciones en la sección de botones ==========
  const handleCancelSelection = () => {
    setSelectedItem(null);
    closeEditModal();
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

    setEditNombre(sanitizeName(itemToEdit.nombre || ''));
    setEditTelefono(sanitizePhone(itemToEdit.telefono || ''));
    setEditDireccion(sanitizeAddress(itemToEdit.direccion || ''));
    setEditEmail(sanitizeEmail(itemToEdit.email || ''));
    setEditActivo(itemToEdit.activo !== false);
    setEditCedula(itemToEdit.cedula || '');
    setEditTipo(selectedItem.type === 'usuario' ? 'usuario' : 'cliente');
    setChangePassword(false);
    setNewPassword('');
    setConfirmPassword('');
    setEditErrors({});
    setShowEditForm(true);
  };

  const handleEditFromHeader = () => {
    if (!selectedItem) {
      showToast('error', 'Selecciona un usuario o cliente para editar.');
      return;
    }
    handleModify();
  };

  const openCreateFromHeader = () => {
    setShowForm(true);
    setFormErrors({});
    setSelectedItem(null);
    setShowEditForm(false);
  };

  const handleSaveEdit = async () => {
    if (!selectedItem) return;
    if (!validateEditForm()) {
      return;
    }
    const sourceCol = selectedItem.type === 'usuario' ? 'usuarios' : 'Clientes';
    const targetCol = editTipo === 'usuario' ? 'usuarios' : 'Clientes';

    try {
      const updatePayload: Record<string, any> = {
        nombre: editNombre.trim(),
        telefono: editTelefono,
        direccion: editDireccion.trim(),
        email: editEmail.trim().toLowerCase(),
        activo: editActivo,
      };

      if (changePassword && newPassword) {
        updatePayload.password = newPassword;
      }

      // Si cambia el tipo, mover el documento a la colección destino
      if (sourceCol !== targetCol) {
        const targetTipo = editTipo === 'usuario' ? 'admin' : 'cliente';
        await setDoc(doc(db, targetCol, selectedItem.id), {
          ...updatePayload,
          tipo: targetTipo,
        });
        await deleteDoc(doc(db, sourceCol, selectedItem.id));
      } else {
        const targetTipo = editTipo === 'usuario' ? 'admin' : 'cliente';
        await updateDoc(doc(db, sourceCol, selectedItem.id), {
          ...updatePayload,
          tipo: targetTipo,
        });
      }

      showToast('success', 'Datos modificados correctamente.');
      setSelectedItem(null);
      closeEditModal();
    } catch (err) {
      console.error(err);
      showToast('error', 'No se pudo modificar.');
    }
  };

  const handleDelete = () => {
    if (!selectedItem) {
      Alert.alert('Selecciona un elemento', 'Debes seleccionar un usuario o cliente antes de eliminar.');
      showToast('error', 'Selecciona un usuario o cliente para eliminar.');
      return;
    }

    const isUser = selectedItem.type === 'usuario';
    const colName = isUser ? 'usuarios' : 'Clientes';
    const selectedDoc = isUser
      ? listaUsuarios.find((u) => u.id === selectedItem.id)
      : listaClientes.find((c) => c.id === selectedItem.id);

    if (!selectedDoc) {
      showToast('error', 'El elemento seleccionado ya no existe.');
      setSelectedItem(null);
      return;
    }
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedItem) {
      setShowDeleteConfirm(false);
      return;
    }

    const isUser = selectedItem.type === 'usuario';
    const colName = isUser ? 'usuarios' : 'Clientes';

    try {
      await deleteDoc(doc(db, colName, selectedItem.id));
      showToast('success', 'Eliminado correctamente.');
      closeEditModal();
      setSelectedItem(null);
    } catch (err) {
      console.error(err);
      showToast('error', 'No se pudo eliminar.');
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedItem) return;
    const colName = selectedItem.type === 'usuario' ? 'usuarios' : 'Clientes';

    try {
      await updateDoc(doc(db, colName, selectedItem.id), {
        activo: false,
      });
      showToast('success', 'Desactivado correctamente.');
      closeEditModal();
      setSelectedItem(null);
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
      closeEditModal();
      setSelectedItem(null);
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
          colors={isAdmin ? colors.gradientSecondary : CLIENT_GRADIENT}
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
            {item.email || 'Sin correo'}
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
          </Animated.View>
        )}
      </TouchableOpacity>
    );
  };

  const renderCreateModal = () => {
    if (!showForm) return null;

    return (
      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={closeCreateModal}
      >
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalContainer}>
            <View style={styles.editModalHeader}>
              <View style={styles.editModalHeaderLeft}>
                <FontAwesome5 name="user-plus" size={18} color={colors.secondary} />
                <Text style={styles.editModalTitle}>Nuevo usuario</Text>
              </View>
              <TouchableOpacity
                style={styles.editModalClose}
                onPress={closeCreateModal}
              >
                <FontAwesome5 name="times" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.editModalContent}
              contentContainerStyle={styles.editModalContentContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <LinearGradient
                colors={[colors.surface, colors.background]}
                style={styles.formGradient}
              >
                <Text style={styles.formTitle}>
                  {tipo === 'cliente' ? '👤 Registrar Cliente' : '👑 Registrar Administrador'}
                </Text>

                <View style={styles.formGrid}>
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputGroup}>
                      <FontAwesome5 name="user" size={16} color={colors.secondary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Nombre completo"
                        value={nombre}
                        onChangeText={handleNombreChange}
                      />
                    </View>
                    {formErrors.nombre && <Text style={styles.errorText}>{formErrors.nombre}</Text>}
                  </View>

                  <View style={styles.inputWrapper}>
                    <View style={styles.inputGroup}>
                      <FontAwesome5 name="id-card" size={16} color={colors.secondary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Cédula"
                        value={cedula}
                        onChangeText={handleCedulaChange}
                      />
                    </View>
                    {formErrors.cedula && <Text style={styles.errorText}>{formErrors.cedula}</Text>}
                  </View>

                  <View style={styles.inputWrapper}>
                    <View style={styles.inputGroup}>
                      <FontAwesome5 name="envelope" size={16} color={colors.secondary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Correo electrónico"
                        value={email}
                        onChangeText={handleEmailChange}
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    </View>
                    {formErrors.email && <Text style={styles.errorText}>{formErrors.email}</Text>}
                  </View>

                  <View style={styles.inputWrapper}>
                    <View style={styles.inputGroup}>
                      <FontAwesome5 name="phone" size={16} color={colors.secondary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Teléfono"
                        value={telefono}
                        onChangeText={handleTelefonoChange}
                        keyboardType="phone-pad"
                      />
                    </View>
                    {formErrors.telefono && <Text style={styles.errorText}>{formErrors.telefono}</Text>}
                  </View>

                  <View style={[styles.inputWrapper, styles.inputWrapperFull]}>
                    <Text style={styles.inputLabelInline}>Dirección</Text>
                    <View style={styles.inputGroup}>
                      <FontAwesome5 name="map-marker-alt" size={16} color={colors.secondary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Dirección completa"
                        value={direccion}
                        onChangeText={handleDireccionChange}
                      />
                    </View>
                    {formErrors.direccion && <Text style={styles.errorText}>{formErrors.direccion}</Text>}
                  </View>

                  <View style={[styles.inputWrapper, styles.inputWrapperFull]}>
                    <View style={styles.inputGroup}>
                      <FontAwesome5 name="lock" size={16} color={colors.secondary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Contraseña"
                        value={password}
                        onChangeText={handlePasswordChange}
                        secureTextEntry
                      />
                    </View>
                    {formErrors.password && <Text style={styles.errorText}>{formErrors.password}</Text>}
                  </View>
                </View>

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
                    disabled={loading}
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
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderEditModal = () => {
    if (!showEditForm) return null;

    return (
      <Modal
        visible={showEditForm}
        animationType="slide"
        transparent
        onRequestClose={closeEditModal}
      >
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalContainer}>
            <View style={styles.editModalHeader}>
              <View style={styles.editModalHeaderLeft}>
                <FontAwesome5 name="user-edit" size={18} color={colors.secondary} />
                <Text style={styles.editModalTitle}>Editar información</Text>
              </View>
              <TouchableOpacity
                style={styles.editModalClose}
                onPress={closeEditModal}
              >
                <FontAwesome5 name="times" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.editModalContent}
              contentContainerStyle={styles.editModalContentContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.editSummary}>
                <Text style={styles.editSummaryLabel}>Cédula</Text>
                <Text style={styles.editSummaryValue}>{editCedula || 'N/A'}</Text>
                <Text style={[styles.editSummaryLabel, { marginTop: 10 }]}>Estado actual</Text>
                <Text style={styles.editSummaryValue}>{editActivo ? 'Activo' : 'Inactivo'}</Text>
              </View>

              <View style={styles.editInputWrapper}>
                <View style={styles.inputGroup}>
                  <FontAwesome5 name="user" size={16} color={colors.secondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Nombre completo"
                    value={editNombre}
                    onChangeText={handleEditNombreChange}
                  />
                </View>
                {editErrors.nombre && <Text style={styles.errorText}>{editErrors.nombre}</Text>}
              </View>

              <View style={styles.editInputWrapper}>
                <View style={styles.inputGroup}>
                  <FontAwesome5 name="envelope" size={16} color={colors.secondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Correo electrónico"
                    value={editEmail}
                    onChangeText={handleEditEmailChange}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                {editErrors.email && <Text style={styles.errorText}>{editErrors.email}</Text>}
              </View>

              <View style={styles.editInputWrapper}>
                <View style={styles.inputGroup}>
                  <FontAwesome5 name="phone" size={16} color={colors.secondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Teléfono"
                    value={editTelefono}
                    onChangeText={handleEditTelefonoChange}
                    keyboardType="phone-pad"
                  />
                </View>
                {editErrors.telefono && <Text style={styles.errorText}>{editErrors.telefono}</Text>}
              </View>

              <View style={styles.editInputWrapper}>
                <View style={styles.inputGroup}>
                  <FontAwesome5 name="map-marker-alt" size={16} color={colors.secondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Dirección"
                    value={editDireccion}
                    onChangeText={handleEditDireccionChange}
                  />
                </View>
                {editErrors.direccion && <Text style={styles.errorText}>{editErrors.direccion}</Text>}
              </View>

              <View style={styles.editTipoContainer}>
                <Text style={styles.editTipoLabel}>Tipo de cuenta</Text>
                <View style={styles.tipoButtons}>
                  <TouchableOpacity
                    style={[styles.tipoButton, editTipo === 'usuario' && styles.tipoButtonSelected]}
                    onPress={() => setEditTipo('usuario')}
                  >
                    <FontAwesome5
                      name="user-cog"
                      size={16}
                      color={editTipo === 'usuario' ? colors.textInverse : colors.secondary}
                    />
                    <Text style={[styles.tipoButtonText, editTipo === 'usuario' && styles.tipoButtonTextSelected]}>
                      Administrador
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tipoButton, editTipo === 'cliente' && styles.tipoButtonSelected]}
                    onPress={() => setEditTipo('cliente')}
                  >
                    <FontAwesome5
                      name="user"
                      size={16}
                      color={editTipo === 'cliente' ? colors.textInverse : colors.secondary}
                    />
                    <Text style={[styles.tipoButtonText, editTipo === 'cliente' && styles.tipoButtonTextSelected]}>
                      Cliente
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.passwordToggle, changePassword && styles.passwordToggleActive]}
                onPress={handleToggleChangePassword}
              >
                <FontAwesome5 name="lock" size={16} color={changePassword ? colors.textInverse : colors.secondary} />
                <Text
                  style={[styles.passwordToggleText, changePassword && styles.passwordToggleTextActive]}
                >
                  {changePassword ? 'Cancelar cambio de contraseña' : 'Cambiar contraseña'}
                </Text>
                <FontAwesome5
                  name={changePassword ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={changePassword ? colors.textInverse : colors.secondary}
                />
              </TouchableOpacity>

              {changePassword && (
                <>
                  <View style={styles.editInputWrapper}>
                    <View style={styles.inputGroup}>
                      <FontAwesome5 name="key" size={16} color={colors.secondary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Nueva contraseña"
                        value={newPassword}
                        onChangeText={handleNewPasswordChange}
                        secureTextEntry
                      />
                    </View>
                    {editErrors.newPassword && <Text style={styles.errorText}>{editErrors.newPassword}</Text>}
                  </View>

                  <View style={styles.editInputWrapper}>
                    <View style={styles.inputGroup}>
                      <FontAwesome5 name="check" size={16} color={colors.secondary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Confirmar contraseña"
                        value={confirmPassword}
                        onChangeText={handleConfirmPasswordChange}
                        secureTextEntry
                      />
                    </View>
                    {editErrors.confirmPassword && <Text style={styles.errorText}>{editErrors.confirmPassword}</Text>}
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.editModalActions}>
              <TouchableOpacity
                style={[styles.editModalButton, styles.editModalButtonSecondary]}
                onPress={closeEditModal}
              >
                <Text style={styles.editModalButtonSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editModalButton, styles.editModalButtonPrimary]}
                onPress={handleSaveEdit}
              >
                <Text style={styles.editModalButtonPrimaryText}>Guardar cambios</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  // Edit modal se define más abajo

  const headerActionButtons = (
    <>
      <TouchableOpacity style={styles.headerAddButton} onPress={openCreateFromHeader}>
        <FontAwesome5 name="user-plus" size={16} color={colors.textInverse} />
        <Text style={styles.headerActionText}>Nuevo Usuario</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.headerEditButton, isSmallScreen && styles.headerActionButtonSpacing]}
        onPress={handleEditFromHeader}
      >
        <FontAwesome5 name="edit" size={14} color={colors.textInverse} />
        <Text style={styles.headerActionText}>Editar</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.headerDeleteButton, isSmallScreen && styles.headerActionButtonSpacing]}
        onPress={() => handleDelete()}
      >
        <FontAwesome5 name="trash" size={14} color={colors.textInverse} />
        <Text style={styles.headerActionText}>Eliminar</Text>
      </TouchableOpacity>
    </>
  );

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
          <View style={[styles.headerContent, isSmallScreen && styles.headerContentStack]}>
            <View style={styles.headerTitleContainer}>
              <FontAwesome5 name="users-cog" size={24} color={colors.textInverse} />
              <Text style={styles.headerTitle}>Gestión de Usuarios</Text>
            </View>

            {isSmallScreen ? (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.headerActionsHorizontal}
                >
                  {headerActionButtons}
                </ScrollView>

                <View style={[styles.statsContainer, styles.statsContainerMobile]}>
                  <View style={[styles.statItem, styles.statItemMobile]}>
                    <Text style={styles.statNumber}>{listaUsuarios.length}</Text>
                    <Text style={styles.statLabel}>Admins</Text>
                  </View>
                  <View style={[styles.statItem, styles.statItemMobile]}>
                    <Text style={styles.statNumber}>{listaClientes.length}</Text>
                    <Text style={styles.statLabel}>Clientes</Text>
                  </View>
                  <View style={[styles.statItem, styles.statItemMobile]}>
                    <Text style={styles.statNumber}>{listaUsuarios.length + listaClientes.length}</Text>
                    <Text style={styles.statLabel}>Total</Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.headerRight}>
                <View style={styles.headerActions}>
                  {headerActionButtons}
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
            )}
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
                placeholder="Buscar por nombre o cédula"
                value={searchQuery}
                onChangeText={handleSearchChange}
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

          {/* Formulario de creación se gestiona mediante modal */}

          {/* Formulario de edición */}
          {renderCreateModal()}
          {renderEditModal()}

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
          colors={colors.gradientPrimary}
          style={styles.fabGradient}
        >
          <FontAwesome5 name="file-alt" size={20} color={colors.textInverse} />
        </LinearGradient>
      </TouchableOpacity>

      <Toast />

      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Confirmar eliminación</Text>
            <Text style={styles.confirmMessage}>
              Esta acción eliminará definitivamente al usuario/cliente seleccionado.
            </Text>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmCancel]}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={styles.confirmCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmDelete]}
                onPress={handleConfirmDelete}
              >
                <Text style={styles.confirmDeleteText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    alignItems: 'flex-start',
  },
  headerContentStack: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 10,
  },
  headerRight: {
    alignItems: 'flex-end',
    flex: 1,
    marginLeft: 12,
  },
  headerRightStack: {
    alignItems: 'flex-start',
    width: '100%',
    marginLeft: 0,
    gap: 10,
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
    flexWrap: 'wrap',
    marginTop: 8,
  },
  statsContainerMobile: {
    marginTop: 10,
    gap: 14,
    alignItems: 'flex-start',
  },
  statsContainerStack: {
    marginTop: 4,
  },
  statItem: {
    alignItems: 'center',
    marginLeft: 15,
  },
  statItemMobile: {
    marginLeft: 0,
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
  inputLabelInline: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
    marginLeft: 4,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionsHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    marginTop: 6,
  },
  headerActionButtonSpacing: {
    marginLeft: 0,
  },
  headerAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerEditButton: {
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
  headerDeleteButton: {
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
  headerActionText: {
    color: colors.textInverse,
    fontWeight: '600',
    marginLeft: 6,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  confirmButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginLeft: 10,
  },
  confirmCancel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmCancelText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  confirmDelete: {
    backgroundColor: colors.error,
  },
  confirmDeleteText: {
    color: colors.textInverse,
    fontWeight: '700',
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
  inputWrapper: {
    width: '48%',
    marginBottom: 15,
  },
  inputWrapperFull: {
    width: '100%',
    marginBottom: 15,
  },
  inputGroup: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: colors.border,
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
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
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
  editTipoContainer: {
    marginVertical: 12,
  },
  editTipoLabel: {
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
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editModalContainer: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  editModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginLeft: 10,
  },
  editModalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  editModalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  editModalContentContainer: {
    paddingBottom: 24,
  },
  editSummary: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  editSummaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editSummaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  editInputWrapper: {
    marginBottom: 16,
  },
  passwordToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  passwordToggleActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  passwordToggleText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondary,
    marginLeft: 12,
  },
  passwordToggleTextActive: {
    color: colors.textInverse,
  },
  editModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  editModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  editModalButtonSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editModalButtonSecondaryText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  editModalButtonPrimary: {
    backgroundColor: colors.secondary,
  },
  editModalButtonPrimaryText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: colors.primary,
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
    backgroundColor: colors.primaryDark,
  },
  activateButton: {
    backgroundColor: colors.primary,
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