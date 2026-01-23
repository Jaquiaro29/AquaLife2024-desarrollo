export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Register: undefined;
  DashboardDrawer: { userType: 'admin' }; // Admin Dashboard
  UserDashboardScreen: { userType: 'cliente' }; // Cliente Dashboard
  MainDrawer: { userType: 'admin' | 'cliente' }; // Nuevo Drawer para ambos tipos de usuarios
  Dashboard: undefined;
  Sales: undefined;
  Stats: undefined;
  Inventory: undefined;
  Maintenance: undefined;
  Invoices: undefined;
  Providers: undefined;
  Orders: undefined;
  User: undefined;
  OrdersAdminScreen: undefined;
  OrdersA: undefined;
  CreateScreenUser: { userType: 'admin'; openForm?: boolean }; // Admin Dashboard

  HeaderComponent:  { userType: 'admin' | 'cliente' };
};
