import React, { useEffect, useMemo, useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { db, auth } from "../../firebaseConfig";
import { collection, addDoc, serverTimestamp, doc, onSnapshot } from "firebase/firestore";
import { formatCurrency } from '../utils/currency';
import { getBcvUsdRate } from '../utils/getBcvRate';
import { useGlobalConfig } from '../hooks/useGlobalConfig';
import { getNextOrderNumber } from "../components/getNextOrderNumber";
import { colors } from '../styles/globalStyles';
import { VE_BANKS } from '../utils/veBanks';

// Definimos la interfaz del pedido
interface Order {
  withHandle: number;
  withoutHandle: number;
  type: "recarga" | "intercambio";
  comments: string;
  priority: "alta" | "normal";
}

const OrderScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  // Estados principales del componente
  const [order, setOrder] = useState<Order>({
    withHandle: 0,
    withoutHandle: 0,
    type: "recarga",
    comments: "",
    priority: "normal",
  });
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [dolarRate, setDolarRate] = useState<number | null>(null);
  const [todayDate, setTodayDate] = useState<string>("");
  // costPerBottle will be derived from global config (botellon price) and priority
  const [loading, setLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<any | null>(null);
  const [refLast6, setRefLast6] = useState<string>("");
  const [payerBank, setPayerBank] = useState<string>("");
  const [payAmount, setPayAmount] = useState<string>("");
  const [isCustomBank, setIsCustomBank] = useState(false);
  const [customBank, setCustomBank] = useState('');

  // Efecto para establecer fecha actual
  useEffect(() => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-ES');
    setTodayDate(dateStr);
  }, []);

  // Escucha métodos de pago (solo lectura para mostrar en el modal)
  useEffect(() => {
    const ref = doc(db, 'configuracion', 'metodosPago');
    const unsub = onSnapshot(ref, (snap) => {
      setPaymentConfig(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, []);

  const configuredBanks = useMemo(() => {
    const banks: { label: string; code?: string }[] = [];
    if (paymentConfig?.pagoMovil?.banco) {
      banks.push({ label: paymentConfig.pagoMovil.banco, code: paymentConfig.pagoMovil.bancoCodigo });
    }
    if (paymentConfig?.cuenta?.banco) {
      banks.push({ label: paymentConfig.cuenta.banco, code: paymentConfig.cuenta.bancoCodigo });
    }
    return banks;
  }, [paymentConfig]);

  // Lista completa disponible en el selector (config + catálogo VE)
  const availableBanks = useMemo(() => {
    const map = new Map<string, { label: string; code?: string }>();
    for (const b of VE_BANKS) {
      map.set(b.name, { label: b.name, code: b.code });
    }
    for (const b of configuredBanks) {
      map.set(b.label, { label: b.label, code: b.code });
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [configuredBanks]);

  // Prefijar banco sugerido desde la configuración
  useEffect(() => {
    if (!payerBank && configuredBanks.length > 0) {
      setPayerBank(configuredBanks[0].label);
      setIsCustomBank(false);
    }
  }, [configuredBanks, payerBank]);

  // Efecto para obtener tasa del dólar
  useEffect(() => {
    const fetchDolarRate = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5000/api/tasa");
        if (!response.ok) {
          throw new Error("Error en la respuesta de la API");
        }
        const data = await response.json();
        console.log("API Response:", data);
        setDolarRate(data.tasa);
      } catch (error) {
        console.error("Error fetching dolar rate:", error);
        // Fallback: intentar obtener tasa desde BCV
        try {
          const res = await getBcvUsdRate();
          if (res.rate) {
            setDolarRate(res.rate);
          }
        } catch (e) {
          console.error('Fallback BCV failed:', e);
        }
      }
    };

    fetchDolarRate();
    const interval = setInterval(fetchDolarRate, 3600000);
    return () => clearInterval(interval);
  }, []);

  // Manejo de cambios en el formulario
  const handleChange = <T extends keyof Order>(field: T, value: Order[T]) => {
    setOrder((prev) => ({ ...prev, [field]: value }));

    // costPerBottle is derived dynamically; no local state update needed here
  };

  // Validación y confirmación del pedido
  const handleConfirm = () => {
    const totalBottles = order.withHandle + order.withoutHandle;
    if (totalBottles === 0) {
      Alert.alert(
        "Error",
        "La cantidad total de botellones (con y sin asa) debe ser mayor a 0."
      );
      return;
    }
    setShowSummary(true);
  };

  // Cálculos de negocio
  const totalBottles = order.withHandle + order.withoutHandle;

  // Obtener precio global mediante hook
  const { botellonPrice, botellonPriceHigh } = useGlobalConfig();

  const PRIORITY_MULTIPLIER: Record<string, number> = {
    normal: 1,
    alta: 1.4,
  };

  const basePrice = (typeof botellonPrice === 'number' && !isNaN(botellonPrice)) ? botellonPrice : 0.5;
  const highPriceAvailable = (typeof botellonPriceHigh === 'number' && !isNaN(botellonPriceHigh));
  const costPerBottle = order.priority === 'alta'
    ? (highPriceAvailable ? botellonPriceHigh! : basePrice * PRIORITY_MULTIPLIER.alta)
    : basePrice * PRIORITY_MULTIPLIER.normal;
  const totalPrice = totalBottles * costPerBottle;

  // Precios visibles en la UI para las opciones de prioridad (tomados desde el panel admin cuando estén disponibles)
  const displayPriceNormal = basePrice * PRIORITY_MULTIPLIER.normal;
  const displayPriceHigh = highPriceAvailable ? botellonPriceHigh! : basePrice * PRIORITY_MULTIPLIER.alta;

  // Lógica de descripción del tipo de pedido
  const getTypeDescription = (type: Order["type"]) => {
    return type === "recarga"
      ? "Desinfectamos tus botellones; recibes botellones revisados y en óptimas condiciones. Recomendado si tus botellones requieren limpieza o mantenimiento." 
      : "Cambia tus botellones vacíos y recíbelos llenos rápidamente. Ideal si solo necesitas reemplazar botellones vacíos por llenos.";
  };

  // Persistencia en Firestore
  const handleCreateOrderInFirestore = async (opts?: { refLast6?: string; payerBank?: string; payLater?: boolean; payAmount?: string }) => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert(
          "Usuario no autenticado",
          "Por favor, inicie sesión antes de realizar un pedido."
        );
        return;
      }
      
      const now = new Date();
      const fecha = now.toISOString().split("T")[0];
      const hora = now.toTimeString().split(" ")[0];
      const numeroPedido = await getNextOrderNumber(db);

      const nuevoPedido: any = {
        clienteId: user.uid,
        fecha,
        hora,
        cantidadConAsa: order.withHandle,
        cantidadSinAsa: order.withoutHandle,
        costoUnitario: costPerBottle,
        total: totalPrice,
        estado: "pendiente",
        empleadoAsignadoId: "abc123",
        observaciones: order.comments,
        type: order.type,
        tipo: order.type,
        priority: order.priority,
        numeroPedido: numeroPedido,
        createdAt: serverTimestamp(),
        estadoFinanciero: 'por_cobrar',
      };

      if (opts?.refLast6) {
        nuevoPedido.refPagoUlt6 = opts.refLast6;
        nuevoPedido.estadoFinanciero = 'por_confirmar_pago';
        nuevoPedido.fechaRefPago = serverTimestamp();
      }
      if (opts?.payerBank) nuevoPedido.bancoEmisor = opts.payerBank;
      if (opts?.payAmount) {
        const parsed = parseFloat(opts.payAmount);
        if (!Number.isNaN(parsed)) {
          nuevoPedido.montoPagado = parsed;
        }
      }
      if (opts?.payLater) nuevoPedido.pagarLuego = true;

      await addDoc(collection(db, "Pedidos"), nuevoPedido);

      Alert.alert("✅ Éxito", "Tu pedido ha sido generado correctamente.");
      setShowSummary(false);
      setShowPaymentDetails(false);
      setIsConfirmed(false);
      // Reset form
      setOrder({
        withHandle: 0,
        withoutHandle: 0,
        type: "recarga",
        comments: "",
        priority: "normal",
      });
      navigation.goBack();
    } catch (error) {
      console.error("Error al crear pedido:", error);
      Alert.alert("❌ Error", "No se pudo crear el pedido. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const increment = (type: 'withHandle' | 'withoutHandle') => {
    setOrder(prev => ({ ...prev, [type]: prev[type] + 1 }));
  };

  const decrement = (type: 'withHandle' | 'withoutHandle') => {
    setOrder(prev => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }));
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Nuevo Pedido</Text>
          <Text style={styles.subtitle}>Realiza tu pedido de forma rápida y sencilla</Text>
          <View style={styles.dateRateContainer}>
            <Text style={styles.date}>📅 {todayDate}</Text>
            {dolarRate && (
              <Text style={styles.rate}>💵 Tasa: {formatCurrency(dolarRate)}</Text>
            )}
          </View>
        </View>

        {/* Tipo de Servicio */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tipo de Servicio</Text>
          <View style={styles.typeButtons}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                order.type === 'recarga' && styles.typeButtonActive
              ]}
              onPress={() => handleChange('type', 'recarga')}
            >
              <Text style={[
                styles.typeButtonText,
                order.type === 'recarga' && styles.typeButtonTextActive
              ]}>
                🔄 Recarga
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeButton,
                order.type === 'intercambio' && styles.typeButtonActive
              ]}
              onPress={() => handleChange('type', 'intercambio')}
            >
              <Text style={[
                styles.typeButtonText,
                order.type === 'intercambio' && styles.typeButtonTextActive
              ]}>
                💧 Intercambio
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.typeDescription}>
            {getTypeDescription(order.type)}
          </Text>
        </View>

        {/* Cantidad de Botellones */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cantidad de Botellones</Text>
          
          {/* Con Asa */}
          <View style={styles.quantityCard}>
            <View style={styles.quantityHeader}>
              <Text style={styles.quantityTitle}>🫙 Con Asa</Text>
              <Text style={styles.quantitySubtitle}>Más fácil de transportar</Text>
            </View>
            <View style={styles.quantityControls}>
              <TouchableOpacity 
                style={styles.quantityButton}
                onPress={() => decrement('withHandle')}
              >
                <Text style={styles.quantityButtonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.quantityValue}>{order.withHandle}</Text>
              <TouchableOpacity 
                style={styles.quantityButton}
                onPress={() => increment('withHandle')}
              >
                <Text style={styles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Sin Asa */}
          <View style={styles.quantityCard}>
            <View style={styles.quantityHeader}>
              <Text style={styles.quantityTitle}>💧 Sin Asa</Text>
              <Text style={styles.quantitySubtitle}>Formato estándar</Text>
            </View>
            <View style={styles.quantityControls}>
              <TouchableOpacity 
                style={styles.quantityButton}
                onPress={() => decrement('withoutHandle')}
              >
                <Text style={styles.quantityButtonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.quantityValue}>{order.withoutHandle}</Text>
              <TouchableOpacity 
                style={styles.quantityButton}
                onPress={() => increment('withoutHandle')}
              >
                <Text style={styles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.totalContainer}>
            <Text style={styles.totalText}>
              Total: <Text style={styles.totalNumber}>{totalBottles}</Text> botellones
            </Text>
          </View>
        </View>

        {/* Prioridad */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prioridad del Pedido</Text>
          <View style={styles.priorityContainer}>
            <TouchableOpacity
              style={[
                styles.priorityButton,
                order.priority === 'normal' && styles.priorityNormalActive
              ]}
              onPress={() => handleChange('priority', 'normal')}
            >
              <Text style={styles.priorityIcon}>⏱️</Text>
              <Text style={styles.priorityTitle}>Normal</Text>
              <Text style={styles.priorityPrice}>{formatCurrency(displayPriceNormal)} c/u</Text>
              <Text style={styles.priorityTime}>Entrega: 24-48h</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.priorityButton,
                order.priority === 'alta' && styles.priorityHighActive
              ]}
              onPress={() => handleChange('priority', 'alta')}
            >
              <Text style={styles.priorityIcon}>⚡</Text>
              <Text style={styles.priorityTitle}>Alta Prioridad</Text>
              <Text style={styles.priorityPrice}>{formatCurrency(displayPriceHigh)} c/u</Text>
              <Text style={styles.priorityTime}>Entrega: 12-24h</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Comentarios */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comentarios Adicionales</Text>
          <TextInput
            style={styles.commentsInput}
            placeholder="¿Alguna instrucción especial para tu pedido?"
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={4}
            value={order.comments}
            onChangeText={(text) => handleChange('comments', text)}
          />
        </View>

        {/* Resumen Rápido */}
              <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumen del Pedido</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Botellones totales:</Text>
            <Text style={styles.summaryValue}>{totalBottles}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Costo unitario:</Text>
            <Text style={styles.summaryValue}>{formatCurrency(costPerBottle)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total a pagar:</Text>
            <Text style={styles.summaryTotal}>{formatCurrency(totalPrice)}</Text>
          </View>
        </View>

        {/* Botón de Confirmación */}
        <TouchableOpacity 
          style={[
            styles.confirmButton,
            totalBottles === 0 && styles.confirmButtonDisabled
          ]}
          onPress={handleConfirm}
          disabled={totalBottles === 0}
        >
          <Text style={styles.confirmButtonText}>
            {totalBottles === 0 ? 'Agrega botellones' : 'Confirmar Pedido'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de Resumen Final */}
      <Modal
        visible={showSummary}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📋 Resumen Final</Text>
            
            <View style={styles.modalSummary}>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Tipo de servicio:</Text>
                <Text style={styles.modalValue}>
                  {order.type === 'recarga' ? '🔄 Recarga' : '💧 Intercambio'}
                </Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Con asa:</Text>
                <Text style={styles.modalValue}>{order.withHandle}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Sin asa:</Text>
                <Text style={styles.modalValue}>{order.withoutHandle}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Prioridad:</Text>
                <Text style={[
                  styles.modalValue,
                  order.priority === 'alta' && styles.highlightText
                ]}>
                  {order.priority === 'alta' ? '⚡ Alta' : '⏱️ Normal'}
                </Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Costo total:</Text>
                <Text style={styles.modalTotal}>{formatCurrency(totalPrice)}</Text>
              </View>
            </View>

            {order.comments ? (
              <View style={styles.commentsSummary}>
                <Text style={styles.commentsLabel}>Tus comentarios:</Text>
                <Text style={styles.commentsText}>{order.comments}</Text>
              </View>
            ) : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButtonCancel}
                onPress={() => setShowSummary(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Modificar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalButtonConfirm}
                onPress={() => { setShowSummary(false); setPayAmount(''); setShowPaymentDetails(true); }}
                disabled={loading}
              >
                {loading ? (
                      <ActivityIndicator color={colors.textInverse} />
                    ) : (
                  <Text style={styles.modalButtonTextConfirm}>
                    ✅ Confirmar y Pagar
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Detalle de Pago */}
      <Modal visible={showPaymentDetails} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>💳 Confirmación de Pago</Text>
            <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
              {/* Métodos de pago (solo lectura) */}
              {paymentConfig ? (
                <View style={{ marginBottom: 16, gap: 10 }}>
                  {paymentConfig.pagoMovil && (
                    <TouchableOpacity
                      style={[styles.readonlyBox, payerBank === paymentConfig.pagoMovil.banco && styles.readonlyBoxActive]}
                      onPress={() => setPayerBank(paymentConfig.pagoMovil.banco)}
                    >
                      <Text style={styles.readonlyTitle}>Pago Móvil</Text>
                      <Text style={styles.readonlyText}>Banco: {paymentConfig.pagoMovil.banco} ({paymentConfig.pagoMovil.bancoCodigo})</Text>
                      <Text style={styles.readonlyText}>Teléfono: {paymentConfig.pagoMovil.telefono}</Text>
                      <Text style={styles.readonlyText}>CI/RIF: {paymentConfig.pagoMovil.rif}</Text>
                      {paymentConfig.pagoMovil.qrUrl ? (
                        <Image
                          source={{ uri: paymentConfig.pagoMovil.qrUrl }}
                          style={styles.qrImage}
                          resizeMode="contain"
                        />
                      ) : null}
                    </TouchableOpacity>
                  )}
                  {paymentConfig.cuenta && (
                    <TouchableOpacity
                      style={[styles.readonlyBox, payerBank === paymentConfig.cuenta.banco && styles.readonlyBoxActive]}
                      onPress={() => setPayerBank(paymentConfig.cuenta.banco)}
                    >
                      <Text style={styles.readonlyTitle}>Transferencia Bancaria</Text>
                      <Text style={styles.readonlyText}>Banco: {paymentConfig.cuenta.banco} ({paymentConfig.cuenta.bancoCodigo})</Text>
                      <Text style={styles.readonlyText}>Cuenta: {paymentConfig.cuenta.cuenta}</Text>
                      <Text style={styles.readonlyText}>CI/RIF: {paymentConfig.cuenta.rif}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <Text style={{ marginBottom: 12, color: colors.textSecondary }}>Cargando métodos de pago...</Text>
              )}

              {/* Campos de referencia */}
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.modalLabel}>Monto del pedido (referencia)</Text>
                <Text style={[styles.modalValue, { marginBottom: 10 }]}>{formatCurrency(totalPrice)}</Text>
                <Text style={styles.modalLabel}>Últimos 6 dígitos de la referencia</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  maxLength={6}
                  placeholder="Ej: 123456"
                  value={refLast6}
                  onChangeText={(t) => setRefLast6(t.replace(/\D/g, ''))}
                />
                <Text style={[styles.modalLabel, { marginTop: 10 }]}>Banco emisor</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={isCustomBank ? '__other__' : payerBank}
                    onValueChange={(val) => {
                      if (String(val) === '__other__') {
                        setIsCustomBank(true);
                        setPayerBank(customBank);
                      } else {
                        setIsCustomBank(false);
                        setCustomBank('');
                        setPayerBank(String(val));
                      }
                    }}
                    mode="dropdown"
                    dropdownIconColor={colors.textSecondary}
                    style={styles.picker}
                  >
                    {availableBanks.length === 0 && <Picker.Item label="Selecciona banco" value="" />}
                    {availableBanks.map((bank) => (
                      <Picker.Item
                        key={`${bank.label}-${bank.code ?? 'nc'}`}
                        label={`${bank.label}${bank.code ? ` (${bank.code})` : ''}`}
                        value={bank.label}
                      />
                    ))}
                    <Picker.Item label="Otro banco..." value="__other__" />
                  </Picker>
                </View>
                {isCustomBank && (
                  <TextInput
                    style={styles.input}
                    value={customBank}
                    onChangeText={(t) => {
                      setCustomBank(t);
                      setPayerBank(t);
                    }}
                    placeholder="Nombre del banco"
                  />
                )}
                <Text style={[styles.modalLabel, { marginTop: 10 }]}>Monto pagado</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  value={payAmount}
                  onChangeText={(t) => setPayAmount(t.replace(/[^0-9.,]/g, '').replace(',', '.'))}
                  placeholder="Ej: 12.50"
                />
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => { setShowPaymentDetails(false); setShowSummary(true); }}
              >
                <Text style={styles.modalButtonTextCancel}>Volver</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButtonCancel, { backgroundColor: colors.grayShades[100] }]}
                onPress={() => handleCreateOrderInFirestore({ payLater: true })}
                disabled={loading}
              >
                {loading ? <ActivityIndicator /> : <Text style={styles.modalButtonTextCancel}>Pagar luego</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonConfirm}
                onPress={() => handleCreateOrderInFirestore({ refLast6: refLast6.trim(), payerBank: payerBank.trim(), payAmount: payAmount.trim() })}
                disabled={loading || refLast6.length !== 6 || payAmount.trim() === '' || Number.isNaN(parseFloat(payAmount))}
              >
                {loading ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={styles.modalButtonTextConfirm}>Enviar referencia</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  dateRateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 14,
    color: colors.grayShades[600],
    fontWeight: '500',
  },
  rate: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
    backgroundColor: colors.background,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  typeButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.grayShades[50],
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeButtonActive: {
    backgroundColor: colors.secondaryLight,
    borderColor: colors.secondary,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  typeButtonTextActive: {
    color: colors.secondaryDark,
  },
  typeDescription: {
    fontSize: 14,
    color: '#64748b',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  quantityCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  quantityHeader: {
    flex: 1,
  },
  quantityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  quantitySubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    color: colors.textInverse,
    fontSize: 18,
    fontWeight: 'bold',
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    minWidth: 30,
    textAlign: 'center',
  },
  totalContainer: {
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalText: {
    fontSize: 16,
    color: colors.grayShades[600],
  },
  totalNumber: {
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  priorityButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  priorityNormalActive: {
    backgroundColor: colors.secondaryLight,
    borderColor: colors.secondary,
  },
  priorityHighActive: {
    backgroundColor: '#fef3c7',
    borderColor: colors.warning,
  },
  priorityIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  priorityTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  priorityPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  priorityTime: {
    fontSize: 12,
    color: '#64748b',
  },
  commentsInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.textPrimary,
    textAlignVertical: 'top',
    minHeight: 100,
    backgroundColor: colors.surface,
  },
  summaryCard: {
    backgroundColor: colors.textPrimary,
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textInverse,
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.grayShades[100],
  },
  summaryValue: {
    fontSize: 14,
    color: colors.textInverse,
    fontWeight: '500',
  },
  summaryTotal: {
    fontSize: 18,
    color: colors.success,
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: colors.secondary,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmButtonDisabled: {
    backgroundColor: colors.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  modalScroll: {
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalSummary: {
    marginBottom: 20,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayShades[50],
  },
  modalLabel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  modalValue: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  modalTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  highlightText: {
    color: colors.warning,
  },
  commentsSummary: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  commentsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.grayShades[600],
    marginBottom: 8,
  },
  commentsText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonCancel: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.grayShades[50],
    alignItems: 'center',
  },
  modalButtonConfirm: {
    flex: 2,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  modalButtonTextCancel: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  readonlyBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  readonlyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  readonlyText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  readonlyBoxActive: {
    borderColor: colors.primary,
    backgroundColor: '#eef6ff',
  },
  qrImage: {
    width: '100%',
    height: 160,
    marginTop: 10,
    borderRadius: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 44,
    color: colors.textPrimary,
  },
});

export default OrderScreen;