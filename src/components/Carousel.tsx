import React, { useState, useRef, useEffect } from 'react';
import {
  ScrollView,
  View,
  Image,
  Dimensions,
  StyleSheet,
} from 'react-native';

const getInitialViewport = () => Dimensions.get('window');

const images = [
  require('../assets/promo.jpg'),
  require('../assets/promo2.png'),
  require('../assets/promo3.jpg'),
  require('../assets/promo4.jpg'),
];

const Carousel = () => {
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewport, setViewport] = useState(getInitialViewport());

  useEffect(() => {
    // Desliza automáticamente cada 3 segundos
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = prevIndex === images.length - 1 ? 0 : prevIndex + 1;
        scrollRef.current?.scrollTo({
          x: nextIndex * viewport.width,
          animated: true,
        });
        return nextIndex;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Escuchar cambios de tamaño (rotación/dispositivo)
  useEffect(() => {
    const handler = ({ window }: { window: { width: number; height: number } }) => {
      setViewport(window);
    };
    const sub = Dimensions.addEventListener('change', handler);
    return () => {
      // @ts-ignore compat RN versions
      sub?.remove ? sub.remove() : Dimensions.removeEventListener('change', handler);
    };
  }, []);

  const isSmallScreen = viewport.width < 380;
  const slideHeight = Math.min(300, Math.max(180, Math.round(viewport.width * 0.56))); // ~16:9

  // Reajustar posición del scroll cuando cambia el ancho
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: currentIndex * viewport.width, animated: false });
  }, [viewport.width]);

  return (
    <View style={styles.carouselContainer}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
      >
        {images.map((image, index) => (
          <View key={index} style={[styles.slide, { width: viewport.width, height: slideHeight }] }>
            {/* Fondo difuminado (Blur) a pantalla completa */}
            <Image
              source={image}
              style={styles.backgroundBlur}
              blurRadius={15} // Esto sólo se aplica en iOS/Android, en Web se ignora
              resizeMode="cover"
            />
            {/* Imagen centrada con su tamaño original */}
            <Image
              source={image}
              style={styles.foregroundImage}
              resizeMode="contain"
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  /* Contenedor general del carrusel */
  carouselContainer: {
    width: '100%',
  },
  /* Cada slide ocupa el ancho de la pantalla y un alto fijo (ej. 220) */
  slide: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  /* Imagen de fondo difuminada que rellena todo el slide */
  backgroundBlur: {
    ...StyleSheet.absoluteFillObject, // Ocupa todo el contenedor
    width: '100%',
    height: '100%',
  },
  /* Imagen principal en tamaño original, centrada:
     - 'resizeMode: center' no escala la imagen si es más grande,
       y la pinta al centro. 
     - Si la imagen es pequeña, quedará flotando sobre el fondo difuminado. */
  foregroundImage: {
    width: '100%',   // Tomamos todo el ancho disponible
    height: '100%',  // Y todo el alto, para posicionarla en medio sin escalar
    alignSelf: 'center',
    backgroundColor: 'transparent',
  },
});

export default Carousel;
