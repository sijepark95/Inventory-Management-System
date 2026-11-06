const fs = require('fs');

const appPath = 'src/App.tsx';
let content = fs.readFileSync(appPath, 'utf8');

const navLinksStart = content.indexOf('{/* Nav Links */}');
const navLinksEnd = content.indexOf('</nav>', navLinksStart);

if (navLinksStart !== -1 && navLinksEnd !== -1) {
  const originalNav = content.substring(navLinksStart, navLinksEnd);

  const newNav = `{/* Nav Links */}
                <nav className="flex-1 space-y-2.5 py-6 overflow-y-auto">
                  <button
                    onClick={() => {
                      setActiveSection("dashboard");
                      setMobileMenuOpen(false);
                    }}
                    className={\`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between \${
                      activeSection === "dashboard"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }\`}
                  >
                    <div className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Dashboard</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection("inventory");
                      setMobileMenuOpen(false);
                    }}
                    className={\`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between \${
                      activeSection === "inventory"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }\`}
                  >
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <span>Inventory</span>
                    </div>
                    <span className="text-[9px] font-mono opacity-80 font-bold bg-[#f3f4f6] text-neutral-900 px-1.5 py-0.5 rounded-xl">
                      {ingredients.length} list
                    </span>
                  </button>

                  {userRole !== "staff" && (
                  <>
                  <button
                    onClick={() => {
                      setActiveSection("intel");
                      setMobileMenuOpen(false);
                    }}
                    className={\`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between \${
                      activeSection === "intel" || ["ai-parser", "catalog", "recipes"].includes(activeSection)
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }\`}
                  >
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-4 w-4" />
                      <span>Food Cost Overview</span>
                    </div>
                  </button>

                  <div className="pl-6 flex flex-col gap-1 my-1">
                    <button
                      onClick={() => { setActiveSection("ai-parser"); setMobileMenuOpen(false); }}
                      className={\`w-full text-left text-[11px] py-2 px-3 rounded-xl \${
                        activeSection === "ai-parser" ? "bg-emerald-100 text-emerald-800 font-bold" : "text-neutral-600 font-medium"
                      }\`}
                    >
                      AI Document Parser
                    </button>
                    <button
                      onClick={() => { setActiveSection("catalog"); setMobileMenuOpen(false); }}
                      className={\`w-full text-left text-[11px] py-2 px-3 rounded-xl \${
                        activeSection === "catalog" ? "bg-emerald-100 text-emerald-800 font-bold" : "text-neutral-600 font-medium"
                      }\`}
                    >
                      Ingredient Prices
                    </button>
                    <button
                      onClick={() => { setActiveSection("recipes"); setMobileMenuOpen(false); }}
                      className={\`w-full text-left text-[11px] py-2 px-3 rounded-xl \${
                        activeSection === "recipes" ? "bg-emerald-100 text-emerald-800 font-bold" : "text-neutral-600 font-medium"
                      }\`}
                    >
                      Cost Sheets
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setActiveSection("sales-data");
                      setMobileMenuOpen(false);
                    }}
                    className={\`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between \${
                      activeSection === "sales-data"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }\`}
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>Sales Data</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection("timesheet");
                      setMobileMenuOpen(false);
                    }}
                    className={\`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between \${
                      activeSection === "timesheet"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }\`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>Timesheet</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection("staff");
                      setMobileMenuOpen(false);
                    }}
                    className={\`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between \${
                      activeSection === "staff"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }\`}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>Staff</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection("vendors");
                      setMobileMenuOpen(false);
                    }}
                    className={\`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between \${
                      activeSection === "vendors"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }\`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span>Suppliers</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection("departments");
                      setMobileMenuOpen(false);
                    }}
                    className={\`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between \${
                      activeSection === "departments"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }\`}
                  >
                    <div className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Departments</span>
                    </div>
                  </button>
                  </>
                  )}

                  {userRole === "admin" && (
                  <button
                    onClick={() => {
                      setActiveSection("collaborators");
                      setMobileMenuOpen(false);
                    }}
                    className={\`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between \${
                      activeSection === "collaborators"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }\`}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>Collaborators</span>
                    </div>
                  </button>
                  )}
`;

  content = content.replace(originalNav, newNav);
  fs.writeFileSync(appPath, content);
  console.log('Mobile menu updated');
} else {
  console.log('Could not find nav links');
}
