import React, { useEffect, useRef } from 'react';
import { View, AppState, AppStateStatus, Keyboard, GestureResponderEvent } from 'react-native';
import { getAuth, signOut } from 'firebase/auth';

interface InactivityProviderProps {
  timeoutMs?: number; // tiempo de inactividad permitido
  onTimeout?: () => void; // callback opcional
  children: React.ReactNode;
}

// Captura actividad simple (toques, teclado) sin interferir con la UI
const InactivityProvider: React.FC<InactivityProviderProps> = ({
  timeoutMs = 30 * 60 * 1000, // 30 minutos
  onTimeout,
  children,
}) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastInteractionRef = useRef<number>(Date.now());

  const resetTimer = () => {
    lastInteractionRef.current = Date.now();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      // Verificar realmente que han pasado timeoutMs sin actividad
      const diff = Date.now() - lastInteractionRef.current;
      if (diff >= timeoutMs) {
        try {
          if (onTimeout) {
            onTimeout();
          } else {
            const auth = getAuth();
            await signOut(auth);
          }
        } catch (err) {
          // Silenciar errores de signOut
        }
      }
    }, timeoutMs);
  };

  useEffect(() => {
    // Inicializar temporizador al montar
    resetTimer();

    // Listeners de teclado (Android/iOS)
    const showSub = Keyboard.addListener('keyboardDidShow', resetTimer);
    const hideSub = Keyboard.addListener('keyboardDidHide', resetTimer);

    // AppState: si vuelve a 'active', cuenta como actividad
    const appStateHandler = (state: AppStateStatus) => {
      if (state === 'active') resetTimer();
    };
    const appStateSub = AppState.addEventListener('change', appStateHandler);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      showSub.remove();
      hideSub.remove();
      appStateSub.remove();
    };
  }, []);

  const handleTouch = (_e: GestureResponderEvent) => {
    resetTimer();
  };

  return (
    <View
      style={{ flex: 1 }}
      // Estos eventos no bloquean la interacción de hijos
      onTouchStart={handleTouch}
      onTouchMove={handleTouch}
    >
      {children}
    </View>
  );
};

export default InactivityProvider;
