import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
  StatusBar,
  Platform,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { globalStyles, colors } from '../styles/globalStyles';
import Carousel from '../components/Carousel';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenWidth < 380;

const HomeScreen = ({ navigation }: any) => {
  const [hoveredBox, setHoveredBox] = useState<string | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, []);

  const GOOGLE_MAPS_URL = 'https://www.google.com/maps?q=9.782553685559575,-63.19437839118026';
  const googleStaticMapsKey = (process as any)?.env?.EXPO_PUBLIC_GOOGLE_STATIC_MAPS_KEY || '';
  const MAP_PREVIEW_URL = googleStaticMapsKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=9.782553685559575,-63.19437839118026&zoom=19&size=640x360&maptype=satellite&markers=color:red%7C9.782553685559575,-63.19437839118026&key=${googleStaticMapsKey}`
    : 'https://staticmap.openstreetmap.de/staticmap.php?center=9.782553685559575,-63.19437839118026&zoom=18&size=640x360&markers=9.782553685559575,-63.19437839118026,red-pushpin';
  const handleOpenMaps = () => {
    Linking.openURL(GOOGLE_MAPS_URL).catch(() => {
      // Fallback a Google Maps web
      Linking.openURL('https://www.google.com/maps?q=Calle+Mama+Tere,+CC+Esquina+de+Tipuro,+Maturín');
    });
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.95],
    extrapolate: 'clamp',
  });

  const headerMax = isSmallScreen ? 88 : 100;
  const headerMin = isSmallScreen ? 70 : 80;

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [headerMax, headerMin],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      
      {/* Header Animado */}
      <Animated.View style={[styles.header, { opacity: headerOpacity, height: headerHeight }]}>
        <LinearGradient
          colors={colors.gradientPrimary}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.headerContent}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.logo}
            />
            <Text style={styles.companyName}>AquaLife</Text>
          </View>
          {isSmallScreen ? (
            <View style={styles.authIcons}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => navigation.navigate('Login')}
                accessibilityLabel="Iniciar sesión"
              >
                <Ionicons name="log-in-outline" size={20} color={colors.textInverse} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, styles.iconButtonFilled]}
                onPress={() => navigation.navigate('Register')}
                accessibilityLabel="Registrarse"
              >
                <Ionicons name="person-add-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.authButtons}>
              <TouchableOpacity
                style={[styles.authButton, styles.loginButton]}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.authButton, styles.registerButton]}
                onPress={() => navigation.navigate('Register')}
              >
                <Text style={styles.registerButtonText}>Registrarse</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Contenido principal */}
      <Animated.ScrollView
        contentContainerStyle={[styles.contentContainer, { paddingTop: headerMax }]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Hero Section */}
        <Animated.View style={[styles.heroSection, { opacity: fadeAnim }]}>
          <LinearGradient
            colors={[colors.primaryShades[50], colors.surface]}
            style={styles.heroGradient}
          >
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>
                Agua Pura,{'\n'}
                <Text style={styles.heroTitleAccent}> Vida Sana</Text>
              </Text>
              <Text style={styles.heroSubtitle}>
                Soluciones premium de agua purificada para tu hogar,{'\n'} 
                negocio y comunidad
              </Text>
              
              <View style={styles.heroStats}>
                <View style={styles.statItem}>
                  <Ionicons name="water" size={24} color={colors.primary} />
                  <Text style={styles.statNumber}>5000+</Text>
                  <Text style={styles.statLabel}>Clientes Satisfechos</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="home" size={24} color={colors.primary} />
                  <Text style={styles.statNumber}>3</Text>
                  <Text style={styles.statLabel}>Años de Experiencia</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="star" size={24} color={colors.primary} />
                  <Text style={styles.statNumber}>4.9</Text>
                  <Text style={styles.statLabel}>Rating Promedio</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.ctaButton}
                onPress={() => navigation.navigate('Register')}
              >
                <LinearGradient
                  colors={colors.gradientPrimary}
                  style={styles.ctaGradient}
                >
                  <Text style={styles.ctaText}>Comenzar Ahora</Text>
                  <Ionicons name="arrow-forward" size={20} color={colors.textInverse} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>¿Por Qué Elegir AquaLife?</Text>
          <Text style={styles.sectionSubtitle}>
            Calidad y servicio que marcan la diferencia
          </Text>

          <View style={styles.featuresGrid}>
            <View style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: colors.primaryShades[100] }]}>
                <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
              </View>
              <Text style={styles.featureTitle}>Calidad Certificada</Text>
              <Text style={styles.featureDescription}>
                Agua 100% purificada con los más altos estándares de calidad
              </Text>
            </View>

            <View style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: colors.secondaryLight }]}>
                <Ionicons name="flash" size={32} color={colors.primary} />
              </View>
              <Text style={styles.featureTitle}>Entrega Rápida</Text>
              <Text style={styles.featureDescription}>
                Servicio express en menos de 24 horas para tu comodidad
              </Text>
            </View>

            <View style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: colors.grayShades[50] }]}>
                <Ionicons name="heart" size={32} color={colors.primary} />
              </View>
              <Text style={styles.featureTitle}>Salud Garantizada</Text>
              <Text style={styles.featureDescription}>
                Proceso de purificación que cuida de tu salud y bienestar
              </Text>
            </View>
          </View>
        </View>

        {/* Misión y Visión Section */}
        <View style={styles.missionSection}>
          <LinearGradient
            colors={colors.gradientPrimary}
            style={styles.missionGradient}
          >
            <Text style={styles.missionTitle}>Nuestra Esencia</Text>
            
            <View style={styles.missionVisionContainer}>
              <TouchableOpacity
                style={[
                  styles.missionVisionCard,
                  hoveredBox === 'mission' && styles.hoveredCard,
                ]}
                activeOpacity={0.9}
                onPressIn={() => setHoveredBox('mission')}
                onPressOut={() => setHoveredBox(null)}
              >
                <View style={styles.cardIcon}>
                  <Ionicons name="compass" size={32} color={colors.primary} />
                </View>
                <Text style={styles.cardTitle}>Misión</Text>
                <Text style={styles.cardText}>
                  Ofrecer soluciones de agua de alta calidad que enriquezcan vidas
                  y apoyen el desarrollo de comunidades saludables y sostenibles.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.missionVisionCard,
                  hoveredBox === 'vision' && styles.hoveredCard,
                ]}
                activeOpacity={0.9}
                onPressIn={() => setHoveredBox('vision')}
                onPressOut={() => setHoveredBox(null)}
              >
                <View style={styles.cardIcon}>
                  <Ionicons name="eye" size={32} color={colors.primary} />
                </View>
                <Text style={styles.cardTitle}>Visión</Text>
                <Text style={styles.cardText}>
                  Ser el proveedor líder de soluciones sostenibles de agua
                  a nivel nacional, innovando constantemente para un futuro más saludable.
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* Carousel Section */}
        <View style={styles.carouselSection}>
          <Text style={styles.carouselTitle}>Nuestro Trabajo en Imágenes</Text>
          <Text style={styles.carouselSubtitle}>
            Descubre la calidad que nos caracteriza
          </Text>
          <View style={styles.carouselContainer}>
            <Carousel />
          </View>
        </View>

        {/* Location Section */}
        <View style={styles.locationSection}>
          <View style={styles.locationContent}>
            <View style={styles.locationInfo}>
              <Text style={styles.locationTitle}>Visítanos</Text>
              <Text style={styles.locationSubtitle}>
                Estamos aquí para servirte
              </Text>
              
              <View style={styles.locationDetail}>
                <Ionicons name="location" size={24} color={colors.primary} />
                <View style={styles.addressContainer}>
                  <Text style={styles.locationText}>
                    Calle Mama Tere, CC Esquina de Tipuro
                  </Text>
                  <Text style={styles.locationText}>
                    Nivel PB Local 1, Sector Tipuro
                  </Text>
                  <Text style={styles.locationText}>
                    Maturín, Monagas, Venezuela
                  </Text>
                </View>
              </View>

              <View style={styles.locationDetail}>
                <Ionicons name="time" size={24} color={colors.primary} />
                <View style={styles.addressContainer}>
                  <Text style={styles.locationText}>Lunes a Viernes: 8:00 AM - 6:00 PM</Text>
                  <Text style={styles.locationText}>Sábados: 8:00 AM - 2:00 PM</Text>
                </View>
              </View>
            </View>

            <View style={styles.mapContainer}>
              <LinearGradient
                colors={[colors.primaryShades[100], colors.surface]}
                style={styles.mapGradient}
              />

              <View style={styles.mapPattern}>
                <Ionicons name="compass" size={isSmallScreen ? 100 : 140} color={colors.primary} style={styles.mapPatternIcon} />
                <View style={styles.mapLineTop} />
                <View style={styles.mapLineBottom} />
                <View style={styles.mapNodeTopLeft} />
                <View style={styles.mapNodeTopRight} />
                <View style={styles.mapNodeBottomLeft} />
                <View style={styles.mapNodeBottomRight} />
              </View>

              <View style={styles.mapBadge}>
                <Ionicons name="location" size={18} color={colors.primary} />
                <Text style={styles.mapBadgeText}>Ubicación</Text>
              </View>

              <TouchableOpacity
                style={[styles.openMapButton, isSmallScreen && styles.openMapButtonFull]}
                onPress={handleOpenMaps}
                accessibilityLabel="Abrir ubicación en Google Maps"
                activeOpacity={0.85}
              >
                <LinearGradient colors={colors.gradientPrimary} style={styles.openMapInner}>
                  <Ionicons name="navigate" size={20} color={colors.textInverse} />
                  <Text style={styles.openMapButtonText}>Abrir en Google Maps</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Footer */}
        <LinearGradient
          colors={colors.gradientPrimary}
          style={styles.footer}
        >
          <Text style={styles.footerTitle}>AquaLife</Text>
          <Text style={styles.footerSubtitle}>
            Agua purificada para una vida más saludable
          </Text>
          <View style={styles.footerButtons}>
            <TouchableOpacity style={styles.footerButton}>
              <Text style={styles.footerButtonText}>Términos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerButton}>
              <Text style={styles.footerButtonText}>Privacidad</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerButton}>
              <Text style={styles.footerButtonText}>Contacto</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.copyright}>
            © 2024 AquaLife. Todos los derechos reservados.
          </Text>
        </LinearGradient>
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 10,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: isSmallScreen ? 12 : 20,
    paddingVertical: isSmallScreen ? 8 : 12,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  logo: {
    width: isSmallScreen ? 34 : 40,
    height: isSmallScreen ? 34 : 40,
    marginRight: isSmallScreen ? 8 : 12,
  },
  companyName: {
    fontSize: isSmallScreen ? 18 : 24,
    fontWeight: 'bold',
    color: colors.textInverse,
    flexShrink: 1,
  },
  authButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  authIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    marginLeft: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.textInverse,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    backgroundColor: 'transparent',
  },
  iconButtonFilled: {
    backgroundColor: colors.textInverse,
    borderColor: 'transparent',
  },
  authButton: {
    paddingHorizontal: isSmallScreen ? 10 : 16,
    paddingVertical: isSmallScreen ? 8 : 10,
    borderRadius: 25,
    borderWidth: 2,
  },
  loginButton: {
    borderColor: colors.textInverse,
    backgroundColor: 'transparent',
  },
  registerButton: {
    borderColor: 'transparent',
    backgroundColor: colors.textInverse,
  },
  loginButtonText: {
    color: colors.textInverse,
    fontWeight: '600',
    fontSize: isSmallScreen ? 12 : 14,
  },
  registerButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: isSmallScreen ? 12 : 14,
  },
  contentContainer: {
    // paddingTop set dynamically to match header height
  },
  heroSection: {
    minHeight: screenHeight * (isSmallScreen ? 0.7 : 0.8),
  },
  heroGradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  heroContent: {
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: isSmallScreen ? 32 : 48,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: isSmallScreen ? 36 : 52,
    marginBottom: 16,
  },
  heroTitleAccent: {
    color: colors.primary,
  },
  heroSubtitle: {
    fontSize: isSmallScreen ? 14 : 18,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: isSmallScreen ? 20 : 24,
    marginBottom: 40,
  },
  heroStats: {
    flexDirection: isSmallScreen ? 'column' : 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
    marginBottom: isSmallScreen ? 12 : 0,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  ctaButton: {
    borderRadius: 30,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0px 4px 8px rgba(0,0,0,0.3)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isSmallScreen ? 20 : 32,
    paddingVertical: 16,
  },
  ctaText: {
    color: colors.textInverse,
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  featuresSection: {
    padding: isSmallScreen ? 20 : 40,
    backgroundColor: colors.surface,
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
  },
  featuresGrid: {
    flexDirection: isSmallScreen ? 'column' : 'row',
    justifyContent: 'space-between',
    // use margins on children instead of gap for RN compatibility
  },
  featureCard: {
    flex: 1,
    backgroundColor: colors.background,
    padding: isSmallScreen ? 16 : 24,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: isSmallScreen ? 16 : 0,
    marginRight: isSmallScreen ? 0 : 12,
    ...Platform.select({
      web: { boxShadow: '0px 4px 12px rgba(0,0,0,0.1)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
      },
    }),
  },
  featureIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  missionSection: {
    marginVertical: isSmallScreen ? 20 : 40,
  },
  missionGradient: {
    padding: isSmallScreen ? 20 : 40,
  },
  missionTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textInverse,
    textAlign: 'center',
    marginBottom: 40,
  },
  missionVisionContainer: {
    flexDirection: isSmallScreen ? 'column' : 'row',
    // gap handled with margin on cards
  },
  missionVisionCard: {
    flex: 1,
    backgroundColor: colors.background,
    padding: isSmallScreen ? 18 : 30,
    borderRadius: 20,
    alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0px 8px 16px rgba(0,0,0,0.2)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
      },
    }),
    transform: [{ scale: 1 }],
    marginRight: isSmallScreen ? 0 : 20,
    marginBottom: isSmallScreen ? 12 : 0,
  },
  hoveredCard: {
    transform: [{ scale: 1.05 }],
    ...Platform.select({
      web: { boxShadow: '0px 12px 20px rgba(0,0,0,0.3)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 12,
      },
    }),
  },
  cardIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryShades[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  cardText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  carouselSection: {
    padding: 40,
    backgroundColor: colors.background,
  },
  carouselTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  carouselSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  carouselContainer: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  locationSection: {
    padding: isSmallScreen ? 20 : 40,
    backgroundColor: colors.surface,
  },
  locationContent: {
    flexDirection: isSmallScreen ? 'column' : 'row',
    alignItems: 'stretch',
  },
  locationInfo: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  locationSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 30,
  },
  locationDetail: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  addressContainer: {
    flex: 1,
    marginLeft: 12,
  },
  locationText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  mapContainer: {
    backgroundColor: colors.primaryShades[100],
    borderRadius: 16,
    padding: isSmallScreen ? 14 : 20,
    alignItems: 'stretch',
    justifyContent: 'center',
    width: '100%',
    maxWidth: isSmallScreen ? undefined : 520,
    flex: isSmallScreen ? undefined : 1,
    alignSelf: 'stretch',
    marginTop: isSmallScreen ? 20 : 0,
    minHeight: isSmallScreen ? 140 : 160,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0px 6px 14px rgba(0,0,0,0.12)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 14,
        elevation: 6,
      },
    }),
  },
  mapGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPattern: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { pointerEvents: 'none' } }),
  },
  mapPatternIcon: {
    opacity: 0.08,
  },
  mapLineBase: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderBottomWidth: 2,
    borderBottomColor: colors.primaryShades[200],
    borderStyle: 'dashed',
    opacity: 0.25,
  },
  mapLineTop: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: isSmallScreen ? 42 : 52,
    borderBottomWidth: 2,
    borderBottomColor: colors.primaryShades[200],
    borderStyle: 'dashed',
    opacity: 0.25,
  },
  mapLineBottom: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: isSmallScreen ? 42 : 52,
    borderBottomWidth: 2,
    borderBottomColor: colors.primaryShades[200],
    borderStyle: 'dashed',
    opacity: 0.25,
  },
  mapNodeBase: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    opacity: 0.4,
  },
  mapNodeTopLeft: {
    position: 'absolute',
    left: 20,
    top: (isSmallScreen ? 42 : 52) - 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    opacity: 0.4,
  },
  mapNodeTopRight: {
    position: 'absolute',
    right: 20,
    top: (isSmallScreen ? 42 : 52) - 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    opacity: 0.4,
  },
  mapNodeBottomLeft: {
    position: 'absolute',
    left: 20,
    bottom: (isSmallScreen ? 42 : 52) - 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    opacity: 0.4,
  },
  mapNodeBottomRight: {
    position: 'absolute',
    right: 20,
    bottom: (isSmallScreen ? 42 : 52) - 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    opacity: 0.4,
  },
  mapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    marginBottom: 12,
  },
  mapBadgeText: {
    marginLeft: 6,
    color: colors.primary,
    fontWeight: '600',
  },
  openMapButton: {
    marginTop: 0,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    minWidth: isSmallScreen ? undefined : 280,
  },
  openMapButtonFull: {
    width: '100%',
    alignSelf: 'stretch',
  },
  openMapInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 28,
  },
  openMapButtonText: {
    color: colors.textInverse,
    fontWeight: '600',
  },
  footer: {
    padding: isSmallScreen ? 20 : 40,
    alignItems: 'center',
  },
  footerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textInverse,
    marginBottom: 8,
  },
  footerSubtitle: {
    fontSize: 16,
    color: colors.primaryShades[100],
    marginBottom: 30,
    textAlign: 'center',
  },
  footerButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
  },
  footerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 12,
  },
  footerButtonText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '500',
  },
  copyright: {
    fontSize: 12,
    color: colors.primaryShades[100],
    textAlign: 'center',
  },
});

export default HomeScreen;