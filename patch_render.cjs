const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const renderBlock = `
              {activeSection === "order-templates" && (
                <OrderTemplatesView
                  vendors={vendors}
                  ingredients={ingredients}
                  onEditVendor={handleEditVendor}
                  isReadOnly={isReadOnly}
                />
              )}
`;

code = code.replace(
  /              \{activeSection === "make-order-list" && \(\n                <OrderListView\n(.*?)\n                \/>\n              \)\}/s,
  match => match + '\n' + renderBlock
);

fs.writeFileSync('src/App.tsx', code);
