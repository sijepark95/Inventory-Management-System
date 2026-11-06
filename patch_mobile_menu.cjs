const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const mobileMenu = `
                  <button
                    onClick={() => {
                      setActiveSection("order-templates");
                      setMobileMenuOpen(false);
                    }}
                    className={\`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between \${
                      activeSection === "order-templates"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }\`}
                  >
                    <div className="flex items-center gap-2 ml-4">
                      <FileText className="h-4 w-4 shrink-0" />
                      <span>Order Templates</span>
                    </div>
                  </button>
`;

code = code.replace(
  /                  <button\n                    onClick=\{\(\) => \{\n                      setActiveSection\("make-order-list"\);\n                      setMobileMenuOpen\(false\);\n                    \}\}\n                    className=\{\`w-full text-left py-2\.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between \\\$\{\n                      activeSection === "make-order-list"\n                        \? "bg-emerald-600 text-white border border-neutral-200"\n                        : "text-neutral-900\/75 hover:bg-neutral-50 border border-transparent"\n                    \}\`\}\n                  >\n                    <div className="flex items-center gap-2 ml-4">\n                      <Plus className="h-4 w-4 shrink-0" \/>\n                      <span>Make Order List<\/span>\n                    <\/div>\n                  <\/button>/s,
  match => match + '\n' + mobileMenu
);

fs.writeFileSync('src/App.tsx', code);
