import { StyleSheet, Dimensions, Platform } from "react-native";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Paleta de colores (alineada con el estilo visual del Dashboard)
const colors = {
  // Colores primarios (dashboard: indigo / morado)
 primary: "#0077b6" ,
primaryLight: "#90e0ef" ,
primaryDark: "#023e8a" ,
  
  // Colores secundarios y acentos (complemento morado)
 secondary: "#00b4d8",
secondaryLight: "#48cae4",
secondaryDark: "#0096c7" ,
  
  // Colores neutros
  background: "#FFFFFF",
  surface: "#F8FAFC",
  card: "#FFFFFF",
  
  // Texto
  textPrimary: "#0F1724",
  textSecondary: "#64748B",
  textTertiary: "#94A3B8",
  textInverse: "#FFFFFF",
  
  // Estados y feedback (usados en Dashboard)
  success: "#4CAF50",
  error: "#DC2626",
  warning: "#D97706",
  info: "#2196F3",
  disabled: "#CBD5E1",
  
  // Bordes y separadores
  border: "#E2E8F0",
  borderLight: "#F1F5F9",
  borderDark: "#CBD5E1",
  
  // Gradientes (header / cards en Dashboard)
  
gradientPrimary: ["#023e8a", "#00b4d8"],      // Azul marino → Turquesa
  gradientSecondary: ["#0096c7", "#48cae4"],    // Azul verdoso → Celeste suave
  gradientSuccess: ["#2ca56c", "#39c287"],      // Verde éxito (más fresco y moderno)

  

  // Shades para consistencia (escala del primario #0077b6)
  primaryShades: {
    50:  "#eaf7fb",  // ultra claro (casi blanco aqua)
    100: "#d8eef5",
    200: "#b7e2f0",
    300: "#90e0ef",  // azul claro (agua cristalina)
    400: "#5fc6e4",
    500: "#0077b6",  // color base (azul océano)
    600: "#0067a1",
    700: "#005788",
    800: "#024d78",
    900: "#023e8a",  // azul marino intenso
  },

  // Grises neutros con tinte frío (coherentes con la temática agua)
  grayShades: {
    50:  "#f0fdfc",  // fondo muy claro con toque aqua
    100: "#e6f7fd",
    200: "#d8eef5",
    300: "#c6e0eb",
    400: "#a6c7d6",
    500: "#7fa2b3",
    600: "#5e8396",
    700: "#45697d",
    800: "#2b4c60",
    900: "#163646",
  }
};


// Escala de tipografía moderna
const fontSizes = {
  xxxSmall: 10,
  xxSmall: 12,
  xSmall: 14,
  small: 16,
  medium: 18,
  large: 20,
  xLarge: 24,
  xxLarge: 30,
  xxxLarge: 36,
  display: 48,
};

// Escala de espaciado consistente
const spacings = {
  xxxSmall: 2,
  xxSmall: 4,
  xSmall: 8,
  small: 12,
  medium: 16,
  large: 20,
  xLarge: 24,
  xxLarge: 32,
  xxxLarge: 40,
  huge: 48,
};

// Radios de borde
const borderRadius = {
  small: 8,
  medium: 12,
  large: 16,
  xLarge: 20,
  xxLarge: 24,
  round: 999,
};

// Sombras para profundidad
const shadows = {
  small: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
};

// Equivalentes para Web (react-native-web recomienda usar boxShadow)
const webBoxShadows = {
  small: { boxShadow: "0px 2px 4px rgba(0,0,0,0.1)" },
  medium: { boxShadow: "0px 4px 8px rgba(0,0,0,0.15)" },
  large: { boxShadow: "0px 8px 16px rgba(0,0,0,0.2)" },
};

// Estilos globales reutilizables
const globalStyles = StyleSheet.create({
  // Layout
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  containerWithPadding: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacings.medium,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  
  // Header
  header: {
    fontSize: fontSizes.xxLarge,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacings.xSmall,
  },
  subheader: {
    fontSize: fontSizes.large,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacings.small,
  },
  sectionTitle: {
    fontSize: fontSizes.xLarge,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacings.medium,
  },
  
  // Textos
  title: {
    fontSize: fontSizes.xLarge,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  body: {
    fontSize: fontSizes.small,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  caption: {
    fontSize: fontSizes.xSmall,
    color: colors.textTertiary,
    lineHeight: 18,
  },
  label: {
    fontSize: fontSizes.xSmall,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacings.xxSmall,
  },
  
  // Botones
  button: {
    paddingVertical: spacings.small,
    paddingHorizontal: spacings.large,
    borderRadius: borderRadius.medium,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
    ...(Platform.OS === 'web' ? webBoxShadows.small : shadows.small),
  },
  buttonSecondary: {
    backgroundColor: colors.secondary,
    ...(Platform.OS === 'web' ? webBoxShadows.small : shadows.small),
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  buttonDisabled: {
    backgroundColor: colors.disabled,
  },
  buttonSmall: {
    paddingVertical: spacings.xSmall,
    paddingHorizontal: spacings.medium,
  },
  buttonLarge: {
    paddingVertical: spacings.medium,
    paddingHorizontal: spacings.xLarge,
  },
  
  // Textos de botones
  buttonText: {
    fontSize: fontSizes.small,
    fontWeight: "600",
  },
  buttonTextPrimary: {
    color: colors.textInverse,
  },
  buttonTextSecondary: {
    color: colors.textInverse,
  },
  buttonTextOutline: {
    color: colors.primary,
  },
  buttonTextDisabled: {
    color: colors.textTertiary,
  },
  
  // Inputs
  inputContainer: {
    marginBottom: spacings.medium,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacings.medium,
    paddingVertical: spacings.small,
    fontSize: fontSizes.small,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputDisabled: {
    backgroundColor: colors.grayShades[50],
    borderColor: colors.borderLight,
    color: colors.textTertiary,
  },
  
  // Cards
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.large,
    padding: spacings.large,
    ...(Platform.OS === 'web' ? webBoxShadows.small : shadows.small),
  },
  cardElevated: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.large,
    padding: spacings.large,
    ...(Platform.OS === 'web' ? webBoxShadows.medium : shadows.medium),
  },
  
  // Badges
  badge: {
    paddingHorizontal: spacings.small,
    paddingVertical: spacings.xxSmall,
    borderRadius: borderRadius.round,
    alignSelf: 'flex-start',
  },
  badgeSuccess: {
    backgroundColor: colors.primaryShades[100],
  },
  badgeError: {
    backgroundColor: '#FEE2E2',
  },
  badgeWarning: {
    backgroundColor: '#FEF3C7',
  },
  badgeInfo: {
    backgroundColor: '#DBEAFE',
  },
  
  badgeText: {
    fontSize: fontSizes.xxSmall,
    fontWeight: "600",
  },
  badgeTextSuccess: {
    color: colors.primaryShades[700],
  },
  badgeTextError: {
    color: colors.error,
  },
  badgeTextWarning: {
    color: colors.warning,
  },
  badgeTextInfo: {
    color: colors.secondaryDark,
  },
  
  // Utilidades de layout
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowAround: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  
  // Espaciados utilitarios
  mbXSmall: { marginBottom: spacings.xSmall },
  mbSmall: { marginBottom: spacings.small },
  mbMedium: { marginBottom: spacings.medium },
  mbLarge: { marginBottom: spacings.large },
  mtXSmall: { marginTop: spacings.xSmall },
  mtSmall: { marginTop: spacings.small },
  mtMedium: { marginTop: spacings.medium },
  mtLarge: { marginTop: spacings.large },
  mxSmall: { marginHorizontal: spacings.small },
  mxMedium: { marginHorizontal: spacings.medium },
  mySmall: { marginVertical: spacings.small },
  myMedium: { marginVertical: spacings.medium },
  
  // Flex utilities
  flex1: { flex: 1 },
  flexGrow1: { flexGrow: 1 },
  flexShrink1: { flexShrink: 1 },
  
  // Text utilities
  textCenter: { textAlign: "center" },
  textLeft: { textAlign: "left" },
  textRight: { textAlign: "right" },
  textBold: { fontWeight: "700" },
  textSemiBold: { fontWeight: "600" },
  textMedium: { fontWeight: "500" },
  
  // Estados de carga
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacings.medium,
    fontSize: fontSizes.small,
    color: colors.textSecondary,
  },
});

// Exportar todos los tokens y estilos
export { 
  colors, 
  fontSizes, 
  spacings, 
  borderRadius, 
  shadows, 
  globalStyles,
  screenWidth,
  screenHeight 
};