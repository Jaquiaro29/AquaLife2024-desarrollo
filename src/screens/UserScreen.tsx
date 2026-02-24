import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Switch
} from 'react-native';
import { getAuth, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { db } from '../../firebaseConfig';
import { collection, doc, getDoc, onSnapshot, query, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';

type PerfilUsuarioScreenNavigationProp = StackNavigationProp<RootStackParamList, 'DashboardDrawer'>;

interface Props {
  navigation: PerfilUsuarioScreenNavigationProp;
}

const PerfilUsuarioScreen = ({ navigation }: Props) => {
  // Estados del componente
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [editing, setEditing] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [stats, setStats] = useState({ total: 0, pendientes: 0, completados: 0 });

  // Efecto para cargar datos del usuario desde Firestore
  useEffect(() => {
    const fetchUserData = async () => {
      const auth = getAuth();
      const user = auth.currentUser;

      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'Clientes', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setNombre(userData.nombre || '');
            setDireccion(userData.direccion || '');
            setTelefono(userData.telefono || '');
            setEmail(userData.email || '');
          }
        } catch (error) {
          Alert.alert('❌ Error', 'No se pudo cargar la información del usuario.');
        }
      }
      setLoading(false);
    };

    fetchUserData();
  }, []);

  // Cargar actividad real del usuario (pedidos)
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    const pedidosRef = collection(db, 'Pedidos');
    const q = query(pedidosRef, where('clienteId', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const pedidosData = snapshot.docs.map((docu) => docu.data() as { estado?: string });
      const total = pedidosData.length;
      const pendientes = pedidosData.filter((p) => p.estado === 'pendiente' || p.estado === 'procesando').length;
      const completados = pedidosData.filter(
        (p) => p.estado === 'listo' || p.estado === 'entregado' || p.estado === 'completado'
      ).length;
      setStats({ total, pendientes, completados });
    });

    return () => unsub();
  }, []);

  // Función para guardar los datos actualizados del usuario
  const handleGuardar = async () => {
    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (user) {
        await updateDoc(doc(db, 'Clientes', user.uid), {
          nombre,
          direccion,
          telefono,
        });
        setEditing(false);
        Alert.alert('✅ Éxito', 'Datos guardados con éxito');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'No se pudieron guardar los cambios.');
    } finally {
      setLoading(false);
    }
  };

  // Función para iniciar el proceso de eliminación de cuenta
  const handleEliminarCuenta = async () => {
    setModalVisible(true);
  };

  // Función para confirmar y ejecutar la eliminación de cuenta
  const confirmDeleteAccount = async () => {
    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (user && password) {
        // Reautenticar al usuario antes de eliminar
        const credential = EmailAuthProvider.credential(email, password);
        await reauthenticateWithCredential(user, credential);

        // Eliminar documento del usuario en Firestore
        await deleteDoc(doc(db, 'Clientes', user.uid));
        // Eliminar cuenta de usuario en Firebase Authentication
        await deleteUser(user);

        Alert.alert('✅ Éxito', 'Cuenta eliminada con éxito');
        setModalVisible(false);
        // Redirigir al usuario a la pantalla de inicio de sesión
        navigation.navigate('Login');
      } else {
        Alert.alert('❌ Error', 'Se requiere la contraseña para eliminar la cuenta.');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'No se pudo eliminar la cuenta. La reautenticación falló.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Cargando tu perfil...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        
        {/* Header con Avatar */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {nombre ? nombre.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{nombre || 'Usuario'}</Text>
              <Text style={styles.userEmail}>{email}</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => setEditing(!editing)}
          >
            <Text style={styles.editButtonText}>
              {editing ? '✕ Cancelar' : '✏️ Editar'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Información Personal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤 Información Personal</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre Completo</Text>
            <TextInput
              style={[styles.input, !editing && styles.inputDisabled]}
              value={nombre}
              onChangeText={setNombre}
              editable={editing}
              placeholder="Ingresa tu nombre completo"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={email}
              editable={false}
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.helperText}>El email no se puede modificar</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Teléfono</Text>
            <TextInput
              style={[styles.input, !editing && styles.inputDisabled]}
              value={telefono}
              onChangeText={setTelefono}
              editable={editing}
              placeholder="Ingresa tu teléfono"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Dirección</Text>
            <TextInput
              style={[styles.input, !editing && styles.inputDisabled, styles.textArea]}
              value={direccion}
              onChangeText={setDireccion}
              editable={editing}
              placeholder="Ingresa tu dirección completa"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
            />
          </View>

          {editing && (
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleGuardar}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>💾 Guardar Cambios</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Preferencias */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ Preferencias</Text>
          
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceTitle}>🔔 Notificaciones</Text>
              <Text style={styles.preferenceDescription}>Recibir notificaciones sobre mis pedidos</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#d1d5db', true: '#a7f3d0' }}
              thumbColor={notifications ? '#10b981' : '#9ca3af'}
            />
          </View>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceTitle}>🌙 Modo Oscuro</Text>
              <Text style={styles.preferenceDescription}>Interfaz con colores oscuros</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: '#d1d5db', true: '#a7f3d0' }}
              thumbColor={darkMode ? '#10b981' : '#9ca3af'}
            />
          </View>
        </View>

        {/* Estadísticas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Mi Actividad</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.total}</Text>
              <Text style={styles.statLabel}>Pedidos Totales</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.pendientes}</Text>
              <Text style={styles.statLabel}>Pendientes</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.completados}</Text>
              <Text style={styles.statLabel}>Completados</Text>
            </View>
          </View>
        </View>

        {/* Acciones Peligrosas */}
        <View style={styles.dangerSection}>
          <Text style={styles.dangerSectionTitle}>⚠️ Zona de Peligro</Text>
          
          <TouchableOpacity 
            style={styles.dangerButton}
            onPress={handleEliminarCuenta}
          >
            <Text style={styles.dangerButtonText}>🗑️ Eliminar Mi Cuenta</Text>
          </TouchableOpacity>
          
          <Text style={styles.dangerWarning}>
            Esta acción no se puede deshacer. Se eliminarán todos tus datos y pedidos.
          </Text>
        </View>
      </ScrollView>

      {/* Modal de Confirmación para Eliminar Cuenta */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🗑️ Eliminar Cuenta</Text>
              <Text style={styles.modalSubtitle}>
                Esta acción es permanente y no se puede deshacer
              </Text>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.warningText}>
                ⚠️ Se eliminarán todos tus datos:
              </Text>
              <View style={styles.warningList}>
                <Text style={styles.warningItem}>• Tu perfil y información personal</Text>
                <Text style={styles.warningItem}>• Historial completo de pedidos</Text>
                <Text style={styles.warningItem}>• Direcciones guardadas</Text>
                <Text style={styles.warningItem}>• Preferencias de la cuenta</Text>
              </View>

              <View style={styles.passwordInputGroup}>
                <Text style={styles.passwordLabel}>
                  Confirma tu contraseña para continuar:
                </Text>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Ingresa tu contraseña"
                  secureTextEntry
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => {
                  setModalVisible(false);
                  setPassword('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.modalConfirmButton,
                  !password && styles.modalConfirmButtonDisabled
                ]}
                onPress={confirmDeleteAccount}
                disabled={!password || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    Eliminar Cuenta
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
    paddingTop: 20,
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#64748b',
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
  },
  editButtonText: {
    color: '#3b82f6',
    fontWeight: '600',
    fontSize: 14,
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1e293b',
    backgroundColor: '#fff',
  },
  inputDisabled: {
    backgroundColor: '#f9fafb',
    color: '#6b7280',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  preferenceInfo: {
    flex: 1,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  dangerSection: {
    backgroundColor: '#fef2f2',
    padding: 20,
    borderRadius: 16,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  dangerSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 16,
    textAlign: 'center',
  },
  dangerButton: {
    backgroundColor: '#dc2626',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  dangerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dangerWarning: {
    fontSize: 12,
    color: '#b91c1c',
    textAlign: 'center',
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  modalBody: {
    marginBottom: 24,
  },
  warningText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  warningList: {
    marginBottom: 20,
  },
  warningItem: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  passwordInputGroup: {
    marginTop: 16,
  },
  passwordLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1e293b',
    backgroundColor: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 2,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  modalConfirmButtonDisabled: {
    backgroundColor: '#fca5a5',
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PerfilUsuarioScreen;