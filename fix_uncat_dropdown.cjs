const fs = require('fs');

let content = fs.readFileSync('src/components/InventoryView.tsx', 'utf8');
content = content.replace('<option value="UNCATEGORIZED">⚠️ UNCATEGORIZED / OTHER</option>', '');
fs.writeFileSync('src/components/InventoryView.tsx', content);
