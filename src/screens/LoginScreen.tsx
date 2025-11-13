// LoginScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation'; // Ajusta según tu proyecto
import { globalStyles, colors } from '../styles/globalStyles'; // Ajusta según tu proyecto
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { db } from '../../firebaseConfig'; // Ajusta la ruta a tu config
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import Toast from 'react-native-toast-message';

// Ajusta si usas un tipo de Navigation distinto
type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

// Regex simple para validar un correo (ajusta si lo requieres más estricto)
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      showToast('error', 'Por favor ingresa correo y contraseña.');
      return;
    }
    // Validar formato de email
    if (!emailRegex.test(email.trim())) {
      showToast('error', 'El formato del correo no es válido.');
      return;
    }

    const auth = getAuth();
    setLoading(true);

    try {
      // Autenticar al usuario con Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // 1) Buscar al usuario en "Clientes"
      let userData;
      let userType;
      const clientesQuery = query(collection(db, 'Clientes'), where('email', '==', email.trim()));
      const clientesSnapshot = await getDocs(clientesQuery);

      if (!clientesSnapshot.empty) {
        userData = clientesSnapshot.docs[0].data();
        userType = userData?.tipo; // "cliente"
      } else {
        // Si no existe en 'Clientes', buscar en 'usuarios'
        const usuariosQuery = query(collection(db, 'usuarios'), where('email', '==', email.trim()));
        const usuariosSnapshot = await getDocs(usuariosQuery);

        if (!usuariosSnapshot.empty) {
          userData = usuariosSnapshot.docs[0].data();
          userType = userData?.tipo; // "admin", "usuario", etc.
        } else {
          throw new Error('No se pudo encontrar la información del usuario en la BD.');
        }
      }

      // 2) Verificar si está "activo === false"
      if (userData?.activo === false) {
        // Cerrar la sesión para que no quede logueado un usuario inactivo
        await signOut(auth);
        setLoading(false);
        showToast('error', 'Su cuenta está suspendida. No puede iniciar sesión.');
        return;
      }

      // 3) Iniciar correctamente
      setLoading(false);
      showToast('success', 'Inicio de sesión exitoso. Accediendo...');
      // Redirige según el userType
      if (userType === 'cliente' || userType === 'admin') {
        navigation.navigate('MainDrawer', { userType });
      } else {
        showToast('error', 'Tipo de usuario desconocido.');
      }
    } catch (error: any) {
      setLoading(false);

      if (error && error.code) {
        // Errores comunes de Firebase Auth
        switch (error.code) {
          case 'auth/user-not-found':
            showToast('error', 'El correo no está registrado.');
            break;
          case 'auth/wrong-password':
            showToast('error', 'Correo o contraseña incorrectos.');
            break;
          case 'auth/invalid-email':
            showToast('error', 'El formato del correo no es válido.');
            break;
          default:
            showToast('error', error.message || 'Ha ocurrido un error.');
        }
      } else {
        showToast('error', error?.message || 'Ha ocurrido un error.');
      }
    }
  };

  // Manejar "Olvidaste tu contraseña?"
  const handleForgotPassword = async () => {
    if (!email) {
      showToast('error', 'Ingresa tu correo en la casilla de email.');
      return;
    }
    if (!emailRegex.test(email.trim())) {
      showToast('error', 'El formato del correo no es válido.');
      return;
    }
    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, email.trim());
      showToast('success', 'Se ha enviado un correo para reestablecer la contraseña.');
    } catch (err: any) {
      showToast('error', 'No se pudo enviar el correo de reseteo. Verifica tu email.');
    }
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
    <>
      {/* Botón en la esquina superior izquierda para ir a HomeScreen */}
      <TouchableOpacity
        style={styles.homeButton}
        onPress={() => navigation.navigate('Home')}
      >
        <Text style={styles.homeButtonText}>Home</Text>
      </TouchableOpacity>

      <View style={styles.outerContainer}>
        <View style={styles.innerContainer}>
          <Text style={styles.titleText}>
            Iniciar Sesión
          </Text>

          {/* EMAIL */}
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          {/* CONTRASEÑA */}
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor={colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {loading && <ActivityIndicator size="large" color={colors.primary} />}

          {/* Botón "Ingresar" */}
          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
            <Text style={styles.loginButtonText}>Ingresar</Text>
          </TouchableOpacity>

          {/* ¿Olvidaste tu contraseña? */}
          <TouchableOpacity style={styles.forgotButton} onPress={handleForgotPassword}>
            <Text style={styles.forgotButtonText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          {/* No tienes cuenta -> Registro */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>¿No tienes cuenta?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.registerLink}>Regístrate</Text>
            </TouchableOpacity>
          </View>

          {/* ¿Tienes problemas? (ejemplo de mensaje) */}
          <TouchableOpacity
            style={styles.helpButton}
            onPress={() => showToast('error', 'Contacta al soporte para más ayuda.')}
          >
            <Text style={styles.helpButtonText}>¿Tienes problemas para iniciar sesión?</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Toast />
    </>
  );
};

export default LoginScreen;

// ================= Estilos =================
const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    padding: 16,
  },
  innerContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  titleText: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    marginBottom: 12,
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 16,
    color: colors.textPrimary,
  },
  loginButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 6,
  },
  loginButtonText: {
    color: colors.textInverse,
    fontSize: 16,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginVertical: 4,
  },
  forgotButtonText: {
    color: colors.primary,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  registerText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  registerLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  helpButton: {
    marginTop: 10,
    alignSelf: 'center',
  },
  helpButtonText: {
    color: colors.textTertiary,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  homeButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    padding: 10,
    backgroundColor: colors.primary,
    borderRadius: 5,
    zIndex: 1,
  },
  homeButtonText: {
    color: colors.textInverse,
    fontWeight: 'bold',
  },
});
