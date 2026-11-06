const fs = require('fs');
let code = fs.readFileSync('src/components/InvoiceManagementView.tsx', 'utf8');

code = code.replace(/                  onClick=\{\(\) => \{\n                    setShowModal\(false\);\n                    if \(onCloseMakeOrderList\) onCloseMakeOrderList\(\);\n                  \}\}/g, '                  onClick={() => setShowModal(false)}');

code = code.replace(/              <button onClick=\{\(\) => \{\n                setShowModal\(false\);\n                if \(onCloseMakeOrderList\) onCloseMakeOrderList\(\);\n              \}\} className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors">/g, '              <button onClick={() => setShowModal(false)} className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors">');

fs.writeFileSync('src/components/InvoiceManagementView.tsx', code);
