const fs = require('fs');
let appContent = fs.readFileSync('src/App.tsx', 'utf8');

// I made a mistake around line 1965 when I used regex replace, I messed up the sidebar closing and replaced the wrong text.
// Let's manually fix it.
// I see around line 1964:
/*
                {!sidebarCollapsed && (
                  <div className="pl-9 pr-3 py-1 flex flex-col gap-1"><button
                      onClick={() => setActiveSection("catalog")}
                      ...
                      Food Cost Intel
                    </button>
                  </div>
*/
// It seems the replacement was very broken. Let's fix lines 1964 to 2030. Wait, no. I'll just restore the original top-tabs part.

// Let's find exactly what I replaced in fix_app_render.cjs.
// The issue was:
// const aiParserBlock = appContent.substring(aiParserRenderStart, aiParserRenderEnd);
// appContent = appContent.replace(aiParserBlock, '');

// AND

// const aiTabRegex = /\s*<button\s*onClick=\{\(\) => setActiveSection\("ai-parser"\)\}[\s\S]*?<Sparkles className="w-4 h-4" \/> AI Document Parser\s*<\/button>\s*/;
// appContent = appContent.replace(aiTabRegex, "");

// This replaced `<button onClick={() => setActiveSection("ai-parser")}>...AI Document Parser</button>` somewhere inside the desktop sidebar probably, OR inside the top tabs.
// And it messed up the structure.

// Let's just fix it manually.
let before = `                {!sidebarCollapsed && (
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

let after = `                {!sidebarCollapsed && (
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

                {/* NOTE: We still have the vendors, departments, collaborators below */}
`;

// Wait, the block starting with "pl-9" was supposed to be the AI Document Parser nested under Inventory!
// Ah, my regex replaced the wrong thing entirely!
