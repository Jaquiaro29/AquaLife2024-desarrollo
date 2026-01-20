const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'web-build');
const indexPath = path.join(buildDir, 'index.html');

try {
  // Detect si hay CNAME para dominio personalizado y ajustar repoPath
  const cnamePath = path.join(buildDir, 'CNAME');
  const hasCustomDomain = fs.existsSync(cnamePath);
  let repoPath = hasCustomDomain ? '/' : '/AquaLife2024-desarrollo/';

  let html = fs.readFileSync(indexPath, 'utf8');

  // Si estamos en dominio personalizado, eliminar prefijos del repo
  if (hasCustomDomain) {
    html = html.replace(/href="\/AquaLife2024-desarrollo\//g, 'href="/');
    html = html.replace(/src="\/AquaLife2024-desarrollo\//g, 'src="/');
  }
  // Prefijar rutas absolutas si no son ya del repo (modo GitHub Pages subpath)
  if (!hasCustomDomain) {
    const hrefRegex = /href="\/(?!AquaLife2024-desarrollo\/)"/g;
    const srcRegex = /src="\/(?!AquaLife2024-desarrollo\/)"/g;
    html = html.replace(hrefRegex, `href="${repoPath}`);
    html = html.replace(srcRegex, `src="${repoPath}`);
  }

  // Inyectar base href para que las URLs relativas resuelvan
  const baseTag = `<base href="${repoPath}">`;
  // Quitar cualquier otro base existente para evitar duplicados/conflictos
  html = html.replace(/<base[^>]*>/gi, '');
  html = html.replace(/<head>/i, `<head>\n    ${baseTag}`);

  // Copiar assets necesarios desde node_modules a rutas cortas
  const nodeAssets = path.join(buildDir, 'assets', 'node_modules');
  const fontsSrc = path.join(nodeAssets, '@expo', 'vector-icons', 'build', 'vendor', 'react-native-vector-icons', 'Fonts');
  const navElementsSrc = path.join(nodeAssets, '@react-navigation', 'elements', 'lib', 'module', 'assets');
  const navDrawerSrc = path.join(nodeAssets, '@react-navigation', 'drawer', 'lib', 'module', 'views', 'assets');
  const fontsDest = path.join(buildDir, 'assets', 'fonts');
  const navElementsDest = path.join(buildDir, 'assets', 'nav', 'elements');
  const navDrawerDest = path.join(buildDir, 'assets', 'nav', 'drawer');
  const cleanAndCopyDir = (src, dest) => {
    fs.rmSync(dest, { recursive: true, force: true });
    if (fs.existsSync(src)) {
      fs.mkdirSync(dest, { recursive: true });
      fs.cpSync(src, dest, { recursive: true });
    }
  };
  cleanAndCopyDir(fontsSrc, fontsDest);
  cleanAndCopyDir(navElementsSrc, navElementsDest);
  cleanAndCopyDir(navDrawerSrc, navDrawerDest);

  // Parchear asset URLs dentro del bundle JS
  const jsDir = path.join(buildDir, '_expo', 'static', 'js', 'web');
  const files = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    const jsPath = path.join(jsDir, file);
    let js = fs.readFileSync(jsPath, 'utf8');

    // Normalizar ubicaciones httpServerLocation a los destinos aplanados
    const toFonts = hasCustomDomain ? 'httpServerLocation:"/assets/fonts' : 'httpServerLocation:"/AquaLife2024-desarrollo/assets/fonts';
    const toNavElements = hasCustomDomain ? 'httpServerLocation:"/assets/nav/elements' : 'httpServerLocation:"/AquaLife2024-desarrollo/assets/nav/elements';
    const toNavDrawer = hasCustomDomain ? 'httpServerLocation:"/assets/nav/drawer' : 'httpServerLocation:"/AquaLife2024-desarrollo/assets/nav/drawer';

    js = js.replace(/httpServerLocation:"\/AquaLife2024-desarrollo\/assets\/node_modules\/\@expo\/vector-icons\/build\/vendor\/react-native-vector-icons\/Fonts/g, toFonts);
    js = js.replace(/httpServerLocation:"\/assets\/node_modules\/\@expo\/vector-icons\/build\/vendor\/react-native-vector-icons\/Fonts/g, toFonts);
    js = js.replace(/httpServerLocation:"\/AquaLife2024-desarrollo\/assets\/node_modules\/\@react-navigation\/elements\/lib\/module\/assets/g, toNavElements);
    js = js.replace(/httpServerLocation:"\/assets\/node_modules\/\@react-navigation\/elements\/lib\/module\/assets/g, toNavElements);
    js = js.replace(/httpServerLocation:"\/AquaLife2024-desarrollo\/assets\/node_modules\/\@react-navigation\/drawer\/lib\/module\/views\/assets/g, toNavDrawer);
    js = js.replace(/httpServerLocation:"\/assets\/node_modules\/\@react-navigation\/drawer\/lib\/module\/views\/assets/g, toNavDrawer);

    // Prefijo genérico para otros assets si aplica
    if (hasCustomDomain) {
      js = js.replace(/httpServerLocation:"\/AquaLife2024-desarrollo\//g, 'httpServerLocation:"/');
      js = js.replace(/httpServerLocation:"\/(?!assets)/g, 'httpServerLocation:"/');
    } else {
      const assetLocRegex = /httpServerLocation:"\/(?!AquaLife2024-desarrollo\/)assets/g;
      js = js.replace(assetLocRegex, `httpServerLocation:"${repoPath}assets`);
    }

    fs.writeFileSync(jsPath, js, 'utf8');
  }

  fs.writeFileSync(indexPath, html, 'utf8');
  console.log(`Patched index.html asset paths (${hasCustomDomain ? 'custom domain' : 'gh-pages subpath'})`);
} catch (e) {
  console.error('Failed to patch index.html:', e);
  process.exit(1);
}