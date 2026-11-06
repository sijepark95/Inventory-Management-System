const fs = require('fs');

// 1. App.tsx changes
let appContent = fs.readFileSync('src/App.tsx', 'utf8');

// First: Mobile menu - move AI Document Parser from Food Cost to Inventory
const mobileFoodCostBlock = `                  <div className="pl-6 flex flex-col gap-1 my-1">
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
                  </div>`;

const newMobileFoodCostBlock = `                  <div className="pl-6 flex flex-col gap-1 my-1">
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
                  </div>`;

appContent = appContent.replace(mobileFoodCostBlock, newMobileFoodCostBlock);

// Now for Inventory mobile block
const mobileInventoryButton = `                  <button
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
                  </button>`;

const newMobileInventoryButton = `                  <button
                    onClick={() => {
                      setActiveSection("inventory");
                      setMobileMenuOpen(false);
                    }}
                    className={\`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between \${
                      activeSection === "inventory" || activeSection === "ai-parser"
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
                  
                  <div className="pl-6 flex flex-col gap-1 my-1">
                    <button
                      onClick={() => { setActiveSection("ai-parser"); setMobileMenuOpen(false); }}
                      className={\`w-full text-left text-[11px] py-2 px-3 rounded-xl \${
                        activeSection === "ai-parser" ? "bg-emerald-100 text-emerald-800 font-bold" : "text-neutral-600 font-medium"
                      }\`}
                    >
                      AI Document Parser
                    </button>
                  </div>`;

appContent = appContent.replace(mobileInventoryButton, newMobileInventoryButton);

// Second: Desktop sidebar - move AI Document Parser from Food Cost to Inventory
// Find the Food Cost desktop section
const desktopFoodCostButton = `                {/* Documents section - sets activeSection to "intel" which has the tabs */}
                <button
                  onClick={() => setActiveSection("intel")}
                  className={\`w-full h-12 \${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[14px] font-medium transition-all rounded-lg flex items-center cursor-pointer \${
                    activeSection === "intel" || ["ai-parser", "catalog", "recipes"].includes(activeSection)
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }\`}
                >
                  <div className="flex items-center gap-3 relative">
                    {(activeSection === "intel" || ["ai-parser", "catalog", "recipes"].includes(activeSection)) && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
                    <FileText className={\`h-4 w-4 shrink-0 \${(activeSection === "intel" || ["ai-parser", "catalog", "recipes"].includes(activeSection)) ? "text-emerald-600" : "text-neutral-500"}\`} />
                    {!sidebarCollapsed && <span>Food Cost</span>}
                  </div>
                </button>
                
                {/* Nested items under Documents (only visible if not collapsed) */}
                {!sidebarCollapsed && (
                  <div className="pl-9 pr-3 py-1 flex flex-col gap-1">
                    <button
                      onClick={() => setActiveSection("ai-parser")}
                      className={\`w-full text-left text-[13px] py-1.5 transition-colors \${
                        activeSection === "ai-parser" ? "text-emerald-700 font-medium" : "text-neutral-500 hover:text-neutral-900"
                      }\`}
                    >
                      AI Document Parser
                    </button>
                    <button
                      onClick={() => setActiveSection("catalog")}
                      className={\`w-full text-left text-[13px] py-1.5 transition-colors \${
                        activeSection === "catalog" ? "text-emerald-700 font-medium" : "text-neutral-500 hover:text-neutral-900"
                      }\`}
                    >
                      Ingredient Prices
                    </button>
                    <button
                      onClick={() => setActiveSection("recipes")}
                      className={\`w-full text-left text-[13px] py-1.5 transition-colors \${
                        activeSection === "recipes" ? "text-emerald-700 font-medium" : "text-neutral-500 hover:text-neutral-900"
                      }\`}
                    >
                      Cost Sheets
                    </button>
                  </div>
                )}`;

const newDesktopFoodCostButton = `                {/* Documents section - sets activeSection to "intel" which has the tabs */}
                <button
                  onClick={() => setActiveSection("intel")}
                  className={\`w-full h-12 \${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[14px] font-medium transition-all rounded-lg flex items-center cursor-pointer \${
                    activeSection === "intel" || ["catalog", "recipes"].includes(activeSection)
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }\`}
                >
                  <div className="flex items-center gap-3 relative">
                    {(activeSection === "intel" || ["catalog", "recipes"].includes(activeSection)) && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
                    <FileText className={\`h-4 w-4 shrink-0 \${(activeSection === "intel" || ["catalog", "recipes"].includes(activeSection)) ? "text-emerald-600" : "text-neutral-500"}\`} />
                    {!sidebarCollapsed && <span>Food Cost</span>}
                  </div>
                </button>
                
                {/* Nested items under Documents (only visible if not collapsed) */}
                {!sidebarCollapsed && (
                  <div className="pl-9 pr-3 py-1 flex flex-col gap-1">
                    <button
                      onClick={() => setActiveSection("catalog")}
                      className={\`w-full text-left text-[13px] py-1.5 transition-colors \${
                        activeSection === "catalog" ? "text-emerald-700 font-medium" : "text-neutral-500 hover:text-neutral-900"
                      }\`}
                    >
                      Ingredient Prices
                    </button>
                    <button
                      onClick={() => setActiveSection("recipes")}
                      className={\`w-full text-left text-[13px] py-1.5 transition-colors \${
                        activeSection === "recipes" ? "text-emerald-700 font-medium" : "text-neutral-500 hover:text-neutral-900"
                      }\`}
                    >
                      Cost Sheets
                    </button>
                  </div>
                )}`;

appContent = appContent.replace(desktopFoodCostButton, newDesktopFoodCostButton);

const desktopInventoryButton = `                <button
                  onClick={() => setActiveSection("inventory")}
                  className={\`w-full h-10 \${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[13px] font-medium transition-all rounded-lg flex items-center justify-between cursor-pointer \${
                    activeSection === "inventory"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }\`}
                >
                  <div className="flex items-center gap-3 relative">
                    <Package className={\`h-4 w-4 shrink-0 \${activeSection === "inventory" ? "text-emerald-600" : "text-neutral-500"}\`} />
                    {!sidebarCollapsed && <span>Inventory</span>}
                  </div>
                  {!sidebarCollapsed && (
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">{ingredients.filter(i => i.inStock !== undefined).length} / {ingredients.length}</span>
                  )}
                </button>`;

const newDesktopInventoryButton = `                <button
                  onClick={() => setActiveSection("inventory")}
                  className={\`w-full h-10 \${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[13px] font-medium transition-all rounded-lg flex items-center justify-between cursor-pointer \${
                    activeSection === "inventory" || activeSection === "ai-parser"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }\`}
                >
                  <div className="flex items-center gap-3 relative">
                    <Package className={\`h-4 w-4 shrink-0 \${activeSection === "inventory" || activeSection === "ai-parser" ? "text-emerald-600" : "text-neutral-500"}\`} />
                    {!sidebarCollapsed && <span>Inventory</span>}
                  </div>
                  {!sidebarCollapsed && (
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">{ingredients.filter(i => i.inStock !== undefined).length} / {ingredients.length}</span>
                  )}
                </button>
                
                {!sidebarCollapsed && (
                  <div className="pl-9 pr-3 py-1 flex flex-col gap-1">
                    <button
                      onClick={() => setActiveSection("ai-parser")}
                      className={\`w-full text-left text-[13px] py-1.5 transition-colors \${
                        activeSection === "ai-parser" ? "text-emerald-700 font-medium" : "text-neutral-500 hover:text-neutral-900"
                      }\`}
                    >
                      AI Document Parser
                    </button>
                  </div>
                )}`;

appContent = appContent.replace(desktopInventoryButton, newDesktopInventoryButton);

fs.writeFileSync('src/App.tsx', appContent);

// 2. InventoryView.tsx changes - Remove BulkPriceUpdateModal and its state/buttons
let invContent = fs.readFileSync('src/components/InventoryView.tsx', 'utf8');

// Remove import
invContent = invContent.replace(/import \{ BulkPriceUpdateModal \} from "\.\/BulkPriceUpdateModal";\n/, "");

// Remove state
invContent = invContent.replace(/  const \[showBulkPriceModal, setShowBulkPriceModal\] = useState\(false\);\n/, "");

// Remove button
const bulkBtnRegex = /\s*<button\s*onClick=\{\(\) => setShowBulkPriceModal\(true\)\}[\s\S]*?<span>Bulk Update Prices<\/span>\s*<\/button>\s*/;
invContent = invContent.replace(bulkBtnRegex, "");

// Remove component usage at the end
const modalUsageRegex = /\s*<BulkPriceUpdateModal\s*isOpen=\{showBulkPriceModal\}\s*onClose=\{\(\) => setShowBulkPriceModal\(false\)\}\s*ingredients=\{ingredients\}\s*onEditIngredient=\{onEditIngredient\}\s*isReadOnly=\{isReadOnly\}\s*\/>/;
invContent = invContent.replace(modalUsageRegex, "");

fs.writeFileSync('src/components/InventoryView.tsx', invContent);

console.log('Modifications completed.');
