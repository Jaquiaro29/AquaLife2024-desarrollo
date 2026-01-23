# AquaLife Web: Configuración, Seguridad y Facturación

Este proyecto usa variables de entorno para Firebase y ahora incorpora el módulo de **Facturación**.

## Módulo de Facturación

- Pantalla admin: `src/screens/InvoicesAdminScreen.tsx` (accesible desde el drawer Admin como "Facturas").
- Servicios: `src/utils/facturacion.ts` (creación desde pedido, externa, anulación, actualización, secuencia).
- Generación de PDF: `src/utils/invoicePdf.ts` con `expo-print` y subida a Firebase Storage.

Configuración mínima recomendada:

- Crear doc `config/facturacion` en Firestore con `{ nextNumber: 1, ivaPercent: 16 }`.
- Habilitar Firebase Storage y reglas que permitan subida autenticada (ver reglas más abajo).

### Ejecución

```bash
npm run start
```

### Flujo
- Facturar pedido: filtra pedidos pagados/cobrados y entregados/listos, genera factura y detalle.
- Factura externa: datos manuales + URL opcional de PDF/XML ya subidos.
- Detalle: ver ítems y totales, anular (genera comprobante PDF y guarda `cancelPdfUrl`), marcar pagada.

## Variables de entorno
Crea un archivo `.env` en la raíz del repo basado en `/.env.example`:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_MEASUREMENT_ID` (opcional)

`.env` ya está ignorado en `.gitignore`.

## Rotación y restricción de API Key
1. En Google Cloud → APIs & Services → Credentials, abre tu API key y usa **Regenerate key**.
2. Copia la nueva clave en `FIREBASE_API_KEY` de tu `.env`.
3. **Restringe la clave**:
   - Tipo: **HTTP referrers (web sites)**.
   - Referrers permitidos: `https://www.aqualifeweb.com/*`, `https://aqualifeweb.com/*`, y si aplica `https://jaquiaro29.github.io/*`.
   - **Restricción por API**: habilita solo las APIs usadas por Firebase Web (Identity Toolkit, Cloud Firestore, Firebase Installations, Messaging si aplica).
4. Desactiva la clave vieja.

## Construcción y publicación (Web)
- Dominio personalizado:
  - `scripts/add-cname.js` añade `web-build/CNAME` con `www.aqualifeweb.com`.
  - `scripts/fix-ghpages-paths.js` ajusta rutas según CNAME.
- Comandos:

```powershell
npm.cmd run predeploy
npm.cmd run deploy
```

Al finalizar, valida en `https://www.aqualifeweb.com/` que el bundle `_expo` carga sin 404.

## Reglas Firestore y Storage (sugerencia)

Coloca estas reglas en Firebase Console → Firestore/Storage Rules (ajústalas según tus roles):

```
// Firestore (resumen conceptual)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() { return request.auth != null && request.auth.token.role == 'admin'; }
    function isClientDoc(ownerId) { return request.auth != null && request.auth.uid == ownerId; }

    match /Facturas/{id} {
      allow read: if isAdmin() || (isClientDoc(resource.data.clienteId));
      allow create, update: if isAdmin();
    }

    match /Facturas/{id}/detalle/{doc} { allow read: if isAdmin() || isClientDoc(get(/databases/$(database)/documents/Facturas/$(id)).data.clienteId); allow create, update: if isAdmin(); }
    match /Facturas/{id}/historial/{doc} { allow read: if isAdmin(); allow create: if isAdmin(); }
  }
}

// Storage
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /facturas/{file} {
      allow read: if request.auth != null; // restringe más según necesidad
      allow write: if request.auth != null; // solo desde app autenticada
    }
  }
}
```

> Nota: Para `request.auth.token.role` necesitas configurar Custom Claims desde tu backend/Console.

