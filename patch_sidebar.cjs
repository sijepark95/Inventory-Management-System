const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const sidebarMenu = `
                <button
                  onClick={() => setActiveSection("order-templates")}
                  className={\`w-full h-10 \${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[13px] font-medium transition-all rounded-lg flex items-center justify-between cursor-pointer pl-6 \${
                    activeSection === "order-templates"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }\`}
                >
                  <div className="flex items-center gap-3 relative">
                    {activeSection === "order-templates" && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
                    <FileText className={\`h-4 w-4 shrink-0 \${activeSection === "order-templates" ? "text-emerald-600" : "text-neutral-500"}\`} />
                    {!sidebarCollapsed && <span>Order Templates</span>}
                  </div>
                </button>
`;

code = code.replace(
  /                <button\n                  onClick=\{\(\) => setActiveSection\("make-order-list"\)\}(.*?)\n                <\/button>/s,
  match => match + '\n' + sidebarMenu
);

fs.writeFileSync('src/App.tsx', code);
