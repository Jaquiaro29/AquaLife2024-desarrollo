export interface VEBank {
  code: string;
  name: string;
}

// Catálogo de bancos en Venezuela (códigos SUDEBAN comunes)
// Nota: si alguno cambia/nuevo, podemos actualizar fácilmente esta lista.
export const VE_BANKS: VEBank[] = [
  { code: '0102', name: 'Banco de Venezuela' },
  { code: '0104', name: 'Venezolano de Crédito' },
  { code: '0105', name: 'Banco Mercantil' },
  { code: '0108', name: 'BBVA Provincial' },
  { code: '0114', name: 'Bancaribe' },
  { code: '0115', name: 'Banco Exterior' },
  { code: '0116', name: 'BOD Banco Occidental de Descuento' },
  { code: '0128', name: 'Banco Caroní' },
  { code: '0134', name: 'Banesco Banco Universal' },
  { code: '0137', name: 'Banco Sofitasa' },
  { code: '0138', name: 'Banco Plaza' },
  { code: '0151', name: 'Banco Fondo Común (BFC)' },
  { code: '0156', name: '100% Banco' },
  { code: '0163', name: 'Mi Banco, Banco Microfinanciero' },
  { code: '0166', name: 'Banco Agrícola de Venezuela' },
  { code: '0171', name: 'Banco Activo' },
  { code: '0172', name: 'Bancamiga Banco Universal' },
  { code: '0174', name: 'Banplus Banco Universal' },
  { code: '0175', name: 'Banco Bicentenario del Pueblo' },
  { code: '0177', name: 'Banco del Tesoro' },
  { code: '0191', name: 'Banco Nacional de Crédito (BNC)' },
];
