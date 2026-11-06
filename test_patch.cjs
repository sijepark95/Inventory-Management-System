const fs = require('fs');
let code = fs.readFileSync('src/components/VendorsView.tsx', 'utf8');

if (!code.includes('const [templateVendor')) {
  console.log('Failed to apply patch. Doing fallback replacement');
  // fallback replacement
}
