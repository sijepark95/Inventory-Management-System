const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

code = code.replace(
  '  itemsSupplied?: number;',
  '  itemsSupplied?: number;\n  orderTemplate?: OrderListItem[];'
);

fs.writeFileSync('src/types.ts', code);
