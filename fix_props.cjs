const fs = require('fs');
let code = fs.readFileSync('src/components/InvoiceManagementView.tsx', 'utf8');

code = code.replace(/  autoOpenMakeOrderList\?: boolean;\n  onCloseMakeOrderList\?: \(\) => void;\n/, '');
code = code.replace(/  isReadOnly,\n  autoOpenMakeOrderList,\n  onCloseMakeOrderList/, '  isReadOnly');
code = code.replace(/  useEffect\(\(\) => {\n    if \(autoOpenMakeOrderList && !showModal\) {\n      handleOpenModal\(\);\n    }\n  }, \[autoOpenMakeOrderList\]\);\n/, '');
code = code.replace(/    setShowModal\(false\);\n    if \(onCloseMakeOrderList\) onCloseMakeOrderList\(\);\n/g, '    setShowModal(false);\n');
code = code.replace(/                  onClick=\{\(\) => {\n                    setShowModal\(false\);\n                    if \(onCloseMakeOrderList\) onCloseMakeOrderList\(\);\n                  \}\}/g, '                  onClick={() => setShowModal(false)}');

fs.writeFileSync('src/components/InvoiceManagementView.tsx', code);
