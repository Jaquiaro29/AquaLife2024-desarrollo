import React from 'react';
import { DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { colors } from '../styles/globalStyles';
import { getAuth, signOut } from 'firebase/auth';

interface Props {
  userType: 'admin' | 'cliente'; // Tipo de usuario
  navigation: any;
}

const CustomDrawerContent: React.FC<Props> = (props) => {
  const { userType, navigation } = props;

  const handleLogout = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      navigation.navigate('Login'); // Redirigir a la pantalla de inicio de sesión
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  return (
    <DrawerContentScrollView {...props}>
      <View style={styles.header}>
        <Image source={require('../assets/logo.png')} style={styles.logo} />
        <Text style={styles.title}>AquaLife</Text>
      </View>

      {/* Opciones comunes para clientes y admins 
      <DrawerItem
        label="Usuario"
        onPress={() => navigation.navigate('User')}
      />*/}
{userType !== 'admin' && (
        <DrawerItem
          label="Dashboard"
          onPress={() => navigation.navigate('dashboard')}
        />
      )}

{userType !== 'admin' && (
        <DrawerItem
          label="Usuario"
          onPress={() => navigation.navigate('User')}
        />
      )}

      {userType !== 'admin' && (
        <DrawerItem
          label="Pedidos"
          onPress={() => navigation.navigate('Orders')}
        />
      )}

      {/* Opciones adicionales solo para administradores */}
      {userType === 'admin' && (
        <>
          <DrawerItem
            label="Dashboard"
            onPress={() => navigation.navigate('Dashboard')}
          />
          <DrawerItem
            label="Lista de usuarios"
            onPress={() => navigation.navigate('Create')}
          />
          <DrawerItem
            label=" Pedidos"
            onPress={() => navigation.navigate('OrdersA')}
          />
          <DrawerItem
            label="Ventas"
            onPress={() => navigation.navigate('Sales')}
          />
          
          <DrawerItem
            label="Inventario"
            onPress={() => navigation.navigate('Inventory')}
          />
      
          <DrawerItem
            label="Estadísticas"
            onPress={() => navigation.navigate('Stats')}
          />
        </>
      )}

      {/* Botón de cerrar sesión */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.primary,
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 10,
  },
  title: {
    fontSize: 20,
    color: colors.textInverse,
    fontWeight: 'bold',
  },
  logoutButton: {
    marginTop: 20,
    padding: 10,
    alignItems: 'center',
    backgroundColor: colors.error,
    borderRadius: 8,
  },
  logoutText: {
    color: colors.textInverse,
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default CustomDrawerContent;
