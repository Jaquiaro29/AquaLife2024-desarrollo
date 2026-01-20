const fs = require('fs');
const path = require('path');

try {
  const buildDir = path.join(__dirname, '..', 'web-build');
  const target = path.join(buildDir, 'CNAME');
  const domain = 'www.aqualifeweb.com';
  fs.writeFileSync(target, domain + '\n', 'utf8');
  console.log(`Added CNAME for custom domain: ${domain}`);
} catch (e) {
  console.error('Failed to add CNAME:', e);
  process.exit(1);
}
