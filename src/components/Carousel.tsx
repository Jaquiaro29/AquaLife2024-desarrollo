import React, { useState, useRef, useEffect } from 'react';
import {
  ScrollView,
  View,
  Image,
  Dimensions,
  StyleSheet,
} from 'react-native';

const { width } = Dimensions.get('window');

const images = [
  require('../assets/promo.jpg'),
  require('../assets/promo2.png'),
  require('../assets/promo3.jpg'),
  require('../assets/promo4.jpg'),
];

const Carousel = () => {
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Desliza automáticamente cada 3 segundos
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = prevIndex === images.length - 1 ? 0 : prevIndex + 1;
        scrollRef.current?.scrollTo({
          x: nextIndex * width,
          animated: true,
        });
        return nextIndex;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.carouselContainer}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
      >
        {images.map((image, index) => (
          <View key={index} style={styles.slide}>
            {/* Fondo difuminado (Blur) a pantalla completa */}
            <Image
              source={image}
              style={styles.backgroundBlur}
              blurRadius={15} // Esto sólo se aplica en iOS/Android, en Web se ignora
            />
            {/* Imagen centrada con su tamaño original */}
            <Image
              source={image}
              style={styles.foregroundImage}
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
    width,
    height: 220,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  /* Imagen de fondo difuminada que rellena todo el slide */
  backgroundBlur: {
    ...StyleSheet.absoluteFillObject, // Ocupa todo el contenedor
    width: '100%',
    height: '100%',
    resizeMode: 'cover', // La difuminamos y cubrimos
  },
  /* Imagen principal en tamaño original, centrada:
     - 'resizeMode: center' no escala la imagen si es más grande,
       y la pinta al centro. 
     - Si la imagen es pequeña, quedará flotando sobre el fondo difuminado. */
  foregroundImage: {
    resizeMode: 'center',
    width: '100%',   // Tomamos todo el ancho disponible
    height: '100%',  // Y todo el alto, para posicionarla en medio sin escalar
  },
});

export default Carousel;
