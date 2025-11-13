import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';

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

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

// Drawer Navigator
const MainDrawerNavigator = ({ route }: { route: any }) => {
  const { userType } = route.params;

  return (
    <Drawer.Navigator
      initialRouteName={userType === 'admin' ? 'Dashboard' : 'UserDashboard'}
      drawerContent={(props) => <CustomDrawerContent {...props} userType={userType} />}
    >
      {userType === 'admin' ? (
        <>
          <Drawer.Screen name="Dashboard" component={DashboardScreen} />
          <Drawer.Screen name="Sales" component={SalesScreen} />
          <Drawer.Screen name="Stats" component={StatsScreen} />
          <Drawer.Screen name="Inventory" component={InventoryScreen} />
          <Drawer.Screen name="Maintenance" component={MaintenanceScreen} />
          <Drawer.Screen name="Invoices" component={InvoicesScreen} />
          <Drawer.Screen name="Providers" component={ProvidersScreen} />
          <Drawer.Screen name="OrdersA" component={OrdersAdminScreen} />
          <Drawer.Screen name="Create" component={CreateScreenUser} />
          
        </>
      ) : (
        <Drawer.Screen name="UserDashboard" component={UserDashboardScreen} />
        
      )}

      {/* Opciones comunes */}
      <Drawer.Screen name="User" component={UserScreen} />
      {userType !== 'admin' && <Drawer.Screen name="dashboard" component={ UserDashboardScreen} />}
     
      {userType !== 'admin' && <Drawer.Screen name="Orders" component={OrdersScreen} />}

    </Drawer.Navigator>
  );
};

// Stack Navigator principal
const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen
          name="MainDrawer"
          component={MainDrawerNavigator}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
