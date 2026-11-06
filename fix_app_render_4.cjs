const fs = require('fs');
let appContent = fs.readFileSync('src/App.tsx', 'utf8');

const brokenBlock = `                {!sidebarCollapsed && (
                  <div className="pl-9 pr-3 py-1 flex flex-col gap-1"><button
                      onClick={() => setActiveSection("catalog")}
                      className={\`pb-4 text-sm font-semibold transition-colors flex items-center gap-2 \${
                        activeSection === "catalog"
                          ? "text-emerald-700 border-b-2 border-emerald-600"
                          : "text-neutral-500 hover:text-neutral-800"
                      }\`}
                    >
                      <FileSpreadsheet className="w-4 h-4" /> Master Ingredient Prices
                    </button>
                    <button
                      onClick={() => setActiveSection("recipes")}
                      className={\`pb-4 text-sm font-semibold transition-colors flex items-center gap-2 \${
                        activeSection === "recipes"
                          ? "text-emerald-700 border-b-2 border-emerald-600"
                          : "text-neutral-500 hover:text-neutral-800"
                      }\`}
                    >
                      <ChefHat className="w-4 h-4" /> Culinary Cost Sheets
                    </button>
                    <button
                      onClick={() => setActiveSection("intel")}
                      className={\`pb-4 text-sm font-semibold transition-colors flex items-center gap-2 \${
                        activeSection === "intel"
                          ? "text-emerald-700 border-b-2 border-emerald-600"
                          : "text-neutral-500 hover:text-neutral-800"
                      }\`}
                    >
                      <TrendingUp className="w-4 h-4" /> Food Cost Intel
                    </button>
                  </div>

                  {/* Content for the selected tab */}
                  
                  {activeSection === "catalog" && <IngredientsView 
                      ingredients={ingredients}
                      vendors={vendors}
                      onAddIngredient={handleAddIngredient}
                      onEditIngredient={handleEditIngredient}
                      onDeleteIngredient={handleDeleteIngredient}
                      onMatchAndMergeIngredients={handleMatchAndMergeIngredients}
                      isReadOnly={isReadOnly}
                    />}
                  {activeSection === "recipes" && <RecipesView 
                      recipes={recipes}
                      ingredients={ingredients}
                      onAddRecipe={handleAddRecipe}
                      onEditRecipe={handleEditRecipe}
                      onDeleteRecipe={handleDeleteRecipe}
                      onReorderRecipes={handleReorderRecipes}
                      customDepts={resolvedDepts}
                      onAddDept={handleAddDept}
                      onDeleteDept={handleDeleteDept}
                      isReadOnly={isReadOnly}
                    />}
                  {activeSection === "intel" && (
                    <FoodCostIntelView
                      recipes={recipes}
                      dailySales={dailySales}
                      onAddDailySale={handleAddDailySale}
                      onDeleteDailySale={handleDeleteDailySale}
                      isReadOnly={isReadOnly}
                    />
                  )}
                </div>
              )}`;

const fixedBlock = `                {!sidebarCollapsed && (
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
                )}
                
                {userRole !== "staff" && (
                <button
                  onClick={() => setActiveSection("vendors")}
                  className={\`w-full h-10 \${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[13px] font-medium transition-all rounded-lg flex items-center justify-between cursor-pointer \${
                    activeSection === "vendors"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }\`}
                >
                  <div className="flex items-center gap-3 relative">
                    <Building2 className={\`h-4 w-4 shrink-0 \${activeSection === "vendors" ? "text-emerald-600" : "text-neutral-500"}\`} />
                    {!sidebarCollapsed && <span>Suppliers</span>}
                  </div>
                  {!sidebarCollapsed && (
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">{uniqueVendorsCount}</span>
                  )}
                </button>
                )}

                {userRole !== "staff" && (
                <button
                  onClick={() => setActiveSection("departments")}
                  className={\`w-full h-10 \${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[13px] font-medium transition-all rounded-lg flex items-center justify-between cursor-pointer \${
                    activeSection === "departments"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }\`}
                >
                  <div className="flex items-center gap-3 relative">
                    <LayoutDashboard className={\`h-4 w-4 shrink-0 \${activeSection === "departments" ? "text-emerald-600" : "text-neutral-500"}\`} />
                    {!sidebarCollapsed && <span>Departments</span>}
                  </div>
                  {!sidebarCollapsed && (
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">{departments.length}</span>
                  )}
                </button>
                )}
              </nav>
            </div>
            
            <div className="p-4 border-t border-neutral-200">
              {sidebarCollapsed ? (
                <button 
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 font-bold bg-[#f3f4f6] px-3 py-2 rounded-lg">
                  <span className="truncate max-w-[120px]">{user?.email}</span>
                  <button onClick={handleSignOut} className="hover:text-red-600 p-1 rounded-md hover:bg-neutral-200" title="Sign Out">
                    <LogOut className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </aside>

          {/* MAIN CONTENT */}
          <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden bg-[#f0efeb]">
            <MainHeader 
              title={(() => {
                switch (activeSection) {
                  case "dashboard": return "Command Center";
                  case "inventory": return "Master Inventory";
                  case "catalog": return "Food Cost Overview";
                  case "recipes": return "Food Cost Overview";
                  case "intel": return "Food Cost Overview";
                  case "ai-parser": return "Master Inventory";
                  case "timesheet": return "Timesheet & Labor";
                  case "staff": return "Staff Registry";
                  case "sales-data": return "Sales Data Hub";
                  case "vendors": return "Suppliers";
                  case "departments": return "Departments";
                  case "collaborators": return "Collaborators & Access";
                  default: return "Dashboard";
                }
              })()} 
            />

            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-8 relative">

              {/* Top Navigation / Dashboard Tabs */}
              {["catalog", "recipes", "intel"].includes(activeSection) && (
                <div className="space-y-6">
                  {/* Real-time Business KPI Banner */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-6" id="business-kpi-banner">
                    <div className="bg-emerald-50/30 border border-emerald-100 rounded-2xl p-6 shadow-sm relative overflow-hidden flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Items Tracked</p>
                        <p className="text-3xl font-bold text-neutral-900 font-sans tracking-tight">{ingredients.length}</p>
                      </div>
                      <div className="bg-emerald-100 p-3 rounded-2xl">
                        <Package className="h-6 w-6 text-emerald-600" />
                      </div>
                    </div>
                    <div className="bg-amber-50/30 border border-amber-100 rounded-2xl p-6 shadow-sm relative overflow-hidden flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Active Recipes</p>
                        <p className="text-3xl font-bold text-neutral-900 font-sans tracking-tight">{recipes.length}</p>
                      </div>
                      <div className="bg-amber-100 p-3 rounded-2xl">
                        <ChefHat className="h-6 w-6 text-amber-600" />
                      </div>
                    </div>
                    <div className="bg-blue-50/30 border border-blue-100 rounded-2xl p-6 shadow-sm relative overflow-hidden flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Target Margin</p>
                        <p className="text-3xl font-bold text-neutral-900 font-sans tracking-tight">70<span className="text-xl">%</span></p>
                      </div>
                      <div className="bg-blue-100 p-3 rounded-2xl">
                        <TrendingUp className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                    <div className="bg-purple-50/30 border border-purple-100 rounded-2xl p-6 shadow-sm relative overflow-hidden flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Low Stock Alerts</p>
                        <p className="text-3xl font-bold text-neutral-900 font-sans tracking-tight">{ingredients.filter(i => (i.quantity || 0) < (i.parLevel || 5)).length}</p>
                      </div>
                      <div className="bg-purple-100 p-3 rounded-2xl">
                        <AlertCircle className="h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                  </div>

                  {/* Navigation Tabs */}
                  <div className="flex items-center gap-8 border-b border-neutral-200 px-4">
                    <button
                      onClick={() => setActiveSection("catalog")}
                      className={\`pb-4 text-sm font-semibold transition-colors flex items-center gap-2 \${
                        activeSection === "catalog"
                          ? "text-emerald-700 border-b-2 border-emerald-600"
                          : "text-neutral-500 hover:text-neutral-800"
                      }\`}
                    >
                      <FileSpreadsheet className="w-4 h-4" /> Master Ingredient Prices
                    </button>
                    <button
                      onClick={() => setActiveSection("recipes")}
                      className={\`pb-4 text-sm font-semibold transition-colors flex items-center gap-2 \${
                        activeSection === "recipes"
                          ? "text-emerald-700 border-b-2 border-emerald-600"
                          : "text-neutral-500 hover:text-neutral-800"
                      }\`}
                    >
                      <ChefHat className="w-4 h-4" /> Culinary Cost Sheets
                    </button>
                    <button
                      onClick={() => setActiveSection("intel")}
                      className={\`pb-4 text-sm font-semibold transition-colors flex items-center gap-2 \${
                        activeSection === "intel"
                          ? "text-emerald-700 border-b-2 border-emerald-600"
                          : "text-neutral-500 hover:text-neutral-800"
                      }\`}
                    >
                      <TrendingUp className="w-4 h-4" /> Food Cost Intel
                    </button>
                  </div>

                  {/* Content for the selected tab */}
                  {activeSection === "catalog" && <IngredientsView 
                      ingredients={ingredients}
                      vendors={vendors}
                      onAddIngredient={handleAddIngredient}
                      onEditIngredient={handleEditIngredient}
                      onDeleteIngredient={handleDeleteIngredient}
                      onMatchAndMergeIngredients={handleMatchAndMergeIngredients}
                      isReadOnly={isReadOnly}
                    />}
                  {activeSection === "recipes" && <RecipesView 
                      recipes={recipes}
                      ingredients={ingredients}
                      onAddRecipe={handleAddRecipe}
                      onEditRecipe={handleEditRecipe}
                      onDeleteRecipe={handleDeleteRecipe}
                      onReorderRecipes={handleReorderRecipes}
                      customDepts={resolvedDepts}
                      onAddDept={handleAddDept}
                      onDeleteDept={handleDeleteDept}
                      isReadOnly={isReadOnly}
                    />}
                  {activeSection === "intel" && (
                    <FoodCostIntelView
                      recipes={recipes}
                      dailySales={dailySales}
                      onAddDailySale={handleAddDailySale}
                      onDeleteDailySale={handleDeleteDailySale}
                      isReadOnly={isReadOnly}
                    />
                  )}
                </div>
              )}`;

appContent = appContent.replace(brokenBlock, fixedBlock);
fs.writeFileSync('src/App.tsx', appContent);
