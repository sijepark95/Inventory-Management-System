const fs = require('fs');

let content = fs.readFileSync('src/components/InventoryView.tsx', 'utf8');

const uncategorizedStart = content.indexOf('{/* AI AUTO-CATEGORIZATION PROMPT BANNER */}');
const uncategorizedEnd = content.indexOf('          {/* ADD INGREDIENT BUTTON (MOBILE) */}');
if (uncategorizedStart !== -1 && uncategorizedEnd !== -1) {
  content = content.substring(0, uncategorizedStart) + content.substring(uncategorizedEnd);
}

fs.writeFileSync('src/components/InventoryView.tsx', content);
