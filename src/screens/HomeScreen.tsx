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
  StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { globalStyles, colors } from '../styles/globalStyles';
import Carousel from '../components/Carousel';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const HomeScreen = ({ navigation }: any) => {
  const [hoveredBox, setHoveredBox] = useState<string | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [100, 80],
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
        </View>
      </Animated.View>

      {/* Contenido principal */}
      <Animated.ScrollView
        contentContainerStyle={styles.contentContainer}
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

            <View style={styles.mapPlaceholder}>
              <Ionicons name="map" size={48} color={colors.primary} />
              <Text style={styles.mapText}>Mapa Interactivo</Text>
              <Text style={styles.mapSubtext}>Próximamente</Text>
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
    paddingHorizontal: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textInverse,
  },
  authButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
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
    fontSize: 14,
  },
  registerButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  contentContainer: {
    paddingTop: 100,
  },
  heroSection: {
    minHeight: screenHeight * 0.8,
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
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 52,
    marginBottom: 16,
  },
  heroTitleAccent: {
    color: colors.primary,
  },
  heroSubtitle: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 40,
  },
  statItem: {
    alignItems: 'center',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    gap: 8,
  },
  ctaText: {
    color: colors.textInverse,
    fontSize: 18,
    fontWeight: 'bold',
  },
  featuresSection: {
    padding: 40,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
  },
  featureCard: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
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
    marginVertical: 40,
  },
  missionGradient: {
    padding: 40,
  },
  missionTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textInverse,
    textAlign: 'center',
    marginBottom: 40,
  },
  missionVisionContainer: {
    flexDirection: 'row',
    gap: 20,
  },
  missionVisionCard: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    transform: [{ scale: 1 }],
  },
  hoveredCard: {
    transform: [{ scale: 1.05 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
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
    padding: 40,
    backgroundColor: colors.surface,
  },
  locationContent: {
    flexDirection: 'row',
    gap: 40,
    alignItems: 'flex-start',
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
    gap: 12,
  },
  addressContainer: {
    flex: 1,
  },
  locationText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: colors.primaryShades[100],
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  mapText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 12,
  },
  mapSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  footer: {
    padding: 40,
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
    gap: 30,
    marginBottom: 30,
  },
  footerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
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