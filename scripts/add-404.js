const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'web-build');
const target = path.join(buildDir, '404.html');

// Detectar CNAME para decidir ruta base
let repoPath = '/AquaLife2024-desarrollo';
try {
  const cnamePath = path.join(buildDir, 'CNAME');
  if (fs.existsSync(cnamePath)) {
    repoPath = '';
  }
} catch {}

const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Redirecting...</title>
    <meta http-equiv="refresh" content="0; URL='${repoPath || '/'}'" />
    <script>
      (function() {
        var base = '${repoPath}';
        var target = base || '/';
        window.location.replace(target);
      })();
    </script>
  </head>
  <body></body>
</html>`;

try {
  fs.writeFileSync(target, html, 'utf8');
  console.log('Added SPA 404.html to web-build');
} catch (e) {
  console.error('Failed to write 404.html:', e);
  process.exit(1);
}