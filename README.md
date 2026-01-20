# AquaLife Web: Configuración de entorno y seguridad

Este proyecto ahora usa variables de entorno para la configuración de Firebase. Las credenciales **no** deben versionarse.

## Variables requeridas
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

## Construcción y publicación
- Dominio personalizado:
  - `scripts/add-cname.js` añade `web-build/CNAME` con `www.aqualifeweb.com`.
  - `scripts/fix-ghpages-paths.js` ajusta rutas según CNAME.
- Comandos:

```powershell
npm.cmd run predeploy
npm.cmd run deploy
```

Al finalizar, valida en `https://www.aqualifeweb.com/` que el bundle `_expo` carga sin 404.

## Notas
- La API Key de Firebase en web no es un secreto, pero **debe** estar restringida por dominio y por APIs para evitar uso indebido.
- Si también publicas en GitHub Pages bajo subruta, el script detecta ausencia de `CNAME` y reescribe rutas con `/AquaLife2024-desarrollo/`.
