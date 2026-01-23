import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { View, ActivityIndicator } from 'react-native';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig';

// Pantallas
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import UserDashboardScreen from './src/screens/UserDashboardScreen';
import UserScreen from './src/screens/UserScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import SalesScreen from './src/screens/SalesScreen';
import StatsScreen from './src/screens/StatsScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import MaintenanceScreen from './src/screens/MaintenanceScreen';
import InvoicesScreen from './src/screens/InvoicesScreen';
import ProvidersScreen from './src/screens/ProvidersScreen';
import OrdersAdminScreen from './src/screens/OrdersAdminScreen';
import CreateScreenUser from './src/screens/CreateScreenUser';


// Drawer personalizado
import CustomDrawerContent from './src/components/CustomDrawerContent';
import InactivityProvider from './src/components/InactivityProvider';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

// Drawer Navigator
const MainDrawerNavigator = ({ route }: { route: any }) => {
  const { userType } = route?.params || {};

  return (
    <Drawer.Navigator
      initialRouteName={userType === 'admin' ? 'Dashboard' : 'UserDashboard'}
      drawerContent={(props) => <CustomDrawerContent {...props} userType={userType} />}
    >
      {userType === 'admin' ? (
        <>
          <Drawer.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Panel' }} />
          <Drawer.Screen name="Sales" component={SalesScreen} options={{ title: 'Ventas' }} />
          <Drawer.Screen name="Stats" component={StatsScreen} options={{ title: 'Estadísticas' }} />
          <Drawer.Screen name="Inventory" component={InventoryScreen} options={{ title: 'Inventario' }} />
          <Drawer.Screen name="Maintenance" component={MaintenanceScreen} options={{ title: 'Mantenimiento' }} />
          <Drawer.Screen name="Invoices" component={InvoicesScreen} options={{ title: 'Facturas' }} />
          <Drawer.Screen name="Providers" component={ProvidersScreen} options={{ title: 'Proveedores' }} />
          <Drawer.Screen name="OrdersA" component={OrdersAdminScreen} options={{ title: 'Pedidos (admin)' }} />
          <Drawer.Screen name="Create" component={CreateScreenUser} options={{ title: 'Crear usuario' }} />
          
        </>
      ) : (
        <Drawer.Screen name="UserDashboard" component={UserDashboardScreen} options={{ title: 'Panel de usuario' }} />
        
      )}

      {/* Opciones comunes */}
      <Drawer.Screen name="User" component={UserScreen} options={{ title: 'Perfil' }} />
      {userType !== 'admin' && (
        <Drawer.Screen name="dashboard" component={UserDashboardScreen} options={{ title: 'Panel' }} />
      )}
      
      {userType !== 'admin' && (
        <Drawer.Screen name="Orders" component={OrdersScreen} options={{ title: 'Pedidos' }} />
      )}

    </Drawer.Navigator>
  );
};

// Stack Navigator principal
const App = () => {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userType, setUserType] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      try {
        setUser(u);

        if (u && u.email) {
          // Buscar tipo de usuario en Firestore (mismo flujo que en LoginScreen)
          let foundType: string | null = null;
          const email = u.email;

          const clientesQuery = query(collection(db, 'Clientes'), where('email', '==', email));
          const clientesSnapshot = await getDocs(clientesQuery);
          if (!clientesSnapshot.empty) {
            const data = clientesSnapshot.docs[0].data();
            foundType = data?.tipo || null;
            // si está inactivo, cerrar sesión
            if (data?.activo === false) {
              await signOut(auth);
              setUser(null);
              foundType = null;
            }
          } else {
            const usuariosQuery = query(collection(db, 'usuarios'), where('email', '==', email));
            const usuariosSnapshot = await getDocs(usuariosQuery);
            if (!usuariosSnapshot.empty) {
              const data = usuariosSnapshot.docs[0].data();
              foundType = data?.tipo || null;
              if (data?.activo === false) {
                await signOut(auth);
                setUser(null);
                foundType = null;
              }
            }
          }

          setUserType(foundType);
        } else {
          setUserType(null);
        }
      } catch (err) {
        // Si ocurre un error durante la verificación, aseguramos que no quede en checking
        setUser(null);
        setUserType(null);
      } finally {
        setCheckingAuth(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (checkingAuth) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <InactivityProvider timeoutMs={30 * 60 * 1000}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            // Si hay usuario logueado, ir directo al drawer (pasando userType como initialParams)
            <Stack.Screen
              name="MainDrawer"
              component={MainDrawerNavigator}
              options={{ headerShown: false }}
              initialParams={{ userType }}
            />
          ) : (
            // Usuario no autenticado: pantalla pública
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
            </>
          )}

        </Stack.Navigator>
      </NavigationContainer>
    </InactivityProvider>
  );
};

export default App;
