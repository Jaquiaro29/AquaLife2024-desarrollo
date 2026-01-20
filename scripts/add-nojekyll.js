const fs = require('fs');
const path = require('path');

try {
  const buildDir = path.join(__dirname, '..', 'web-build');
  const target = path.join(buildDir, '.nojekyll');
  fs.writeFileSync(target, '');
  console.log('Added .nojekyll to disable Jekyll on GitHub Pages.');
} catch (e) {
  console.error('Failed to add .nojekyll:', e);
  process.exit(1);
}
