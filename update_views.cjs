const fs = require('fs');

const recipesPath = 'src/components/RecipesView.tsx';
let recipesContent = fs.readFileSync(recipesPath, 'utf8');

// We need to completely remove the showAIMatcher block, the button, and the functions in RecipesView.tsx

// Remove showAIMatcher state definitions
recipesContent = recipesContent.replace(
/  \/\/ AI Culinary Recipe Matcher state\n  const \[showAIMatcher, setShowAIMatcher\] = useState\(false\);\n  const \[recipeInputText, setRecipeInputText\] = useState\(""\);\n  const \[isAiParsing, setIsAiParsing\] = useState\(false\);\n  const \[parsedRecipeData, setParsedRecipeData\] = useState<any \| null>\(null\);\n  const \[apiError, setApiError\] = useState\(""\);\n  const \[apiSuccess, setApiSuccess\] = useState\(""\);\n/,
""
);

recipesContent = recipesContent.replace(
/  const \[aiRecipes, setAiRecipes\] = useState<Array<\{[\s\S]*?\}>>\(\[\]\);\n  const \[activeRecipeIndex, setActiveRecipeIndex\] = useState\(0\);\n/,
""
);

// Remove the button
const buttonPattern = /            <button\s+onClick=\{\(\) => \{\s+setShowAIMatcher\(true\);\s+setApiError\(""\);\s+setApiSuccess\(""\);\s+setParsedRecipeData\(null\);\s+\}\}\s+className="bg-amber-100 hover:bg-amber-200 text-neutral-900 font-bold text-xs px-4 py-2\.5 rounded-xl border border-neutral-200 transition-colors flex items-center gap-1\.5 cursor-pointer"\s+id="open-ai-recipe-matcher-btn"\s+>\s+<Sparkles className="h-4 w-4 text-amber-700" \/>\s+<span>AI Recipe Matcher<\/span>\s+<\/button>\n/;
recipesContent = recipesContent.replace(buttonPattern, "");

// Remove the whole block
const aiMatcherBlockStartStr = "      {/* AI Culinary Recipe Matcher Area */}";
const aiMatcherBlockStartIndex = recipesContent.indexOf(aiMatcherBlockStartStr);
if (aiMatcherBlockStartIndex !== -1) {
  const recipeBuilderAreaStr = "      {/* Recipe Builder Area */}";
  const recipeBuilderAreaIndex = recipesContent.indexOf(recipeBuilderAreaStr);
  if (recipeBuilderAreaIndex !== -1) {
    recipesContent = recipesContent.substring(0, aiMatcherBlockStartIndex) + recipesContent.substring(recipeBuilderAreaIndex);
  }
}

// Remove handleRunAiParser
const handleRunAiParserMatch = /  \/\/ Trigger: Run Gemini model parsing & synonym matcher for bulk recipes\n  const handleRunAiParser = async \(\) => \{[\s\S]*?  \};\n/;
recipesContent = recipesContent.replace(handleRunAiParserMatch, "");

// Remove deleteCurrentRecipeFromReview
const deleteCurrentRecipeFromReviewMatch = /  \/\/ Trigger: Remove the currently viewed AI recipe from the list\n  const deleteCurrentRecipeFromReview = \(\) => \{[\s\S]*?  \};\n/;
recipesContent = recipesContent.replace(deleteCurrentRecipeFromReviewMatch, "");

// Remove handleImportActiveRecipe
const handleImportActiveRecipeMatch = /  \/\/ Trigger: Confirm and apply parsed cost sheet of CURRENT recipe to system Recipes collection\n  const handleImportActiveRecipe = async \(\) => \{[\s\S]*?  \};\n/;
recipesContent = recipesContent.replace(handleImportActiveRecipeMatch, "");

// Remove handleImportAllRecipes
const handleImportAllRecipesMatch = /  \/\/ Trigger: Confirm and apply ALL parsed recipes to system Recipes collection at once\n  const handleImportAllRecipes = async \(\) => \{[\s\S]*?  \};\n/;
recipesContent = recipesContent.replace(handleImportAllRecipesMatch, "");

// Remove calculateAiReviewTotals
const calculateAiReviewTotalsMatch = /  \/\/ Helper: Dynamic calculations for AI cost sheets during live review\n  const calculateAiReviewTotals = \(reviewItemsList: any\[\], pYield: number, pPrice: number\) => \{[\s\S]*?  \};\n/;
recipesContent = recipesContent.replace(calculateAiReviewTotalsMatch, "");

// Remove updateMatchedIngredient
const updateMatchedIngredientMatch = /  \/\/ State modifiers for bulk reviewing \(tied to active index\)\n  const updateMatchedIngredient = \(index: number, val: string\) => \{[\s\S]*?  \};\n/;
recipesContent = recipesContent.replace(updateMatchedIngredientMatch, "");

fs.writeFileSync(recipesPath, recipesContent);

const invPath = 'src/components/InventoryView.tsx';
let invContent = fs.readFileSync(invPath, 'utf8');

const newStates = `  // AI Batch Document Parser state
  const [showAIBatchParser, setShowAIBatchParser] = useState(false);
  const [batchInputText, setBatchInputText] = useState("");
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiInventoryItems, setAiInventoryItems] = useState<any[]>([]);
  const [batchTargetDept, setBatchTargetDept] = useState("AUTO");
  const [batchTargetVendor, setBatchTargetVendor] = useState("");
  const [apiError, setApiError] = useState("");
  const [apiSuccess, setApiSuccess] = useState("");

`;
invContent = invContent.replace(
  /  const \[subTab, setSubTab\] = useState<"count" \| "history" \| "consumptions">\("count"\);\n/,
  `  const [subTab, setSubTab] = useState<"count" | "history" | "consumptions">("count");\n\n${newStates}`
);

const newButton = `
              <button
                onClick={() => {
                  setShowAIBatchParser(true);
                  setApiError("");
                  setApiSuccess("");
                  setAiInventoryItems([]);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-[10px] font-bold transition-colors cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-700" />
                AI Batch Parser
              </button>
`;
invContent = invContent.replace(
  /              <button\n                onClick=\{handleOpenAddModal\}/,
  `${newButton}\n              <button\n                onClick={handleOpenAddModal}`
);

const newLogicAndUI = `
  const handleRunAiBatchParser = async () => {
    if (!batchInputText.trim()) return;
    setIsAiParsing(true);
    setApiError("");
    setApiSuccess("");
    try {
      const depts = departments.map(d => d.name);
      
      const response = await fetch("/api/parse-inventory-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentText: batchInputText,
          departments: depts,
          targetDepartment: batchTargetDept,
          targetVendor: batchTargetVendor
        }),
      });

      if (!response.ok) {
        throw new Error(\`API error: \${response.status}\`);
      }
      
      const data = await response.json();
      if (data.items && Array.isArray(data.items)) {
        setAiInventoryItems(data.items);
        if (data.items.length > 0) {
          setApiSuccess(\`Parsed \${data.items.length} items successfully.\`);
        } else {
          setApiError("No items were extracted from the document.");
        }
      } else {
        setApiError("Invalid response format from AI.");
      }
    } catch (err: any) {
      setApiError(err.message || "Failed to parse document.");
    } finally {
      setIsAiParsing(false);
    }
  };
  
  const handleImportAllItems = async () => {
    setApiError("");
    setApiSuccess("");
    
    let imported = 0;
    const errors: string[] = [];
    
    for (const item of aiInventoryItems) {
      try {
        await safeAddDoc("ingredients", {
          name: item.name,
          department: item.department || "Dry Goods",
          vendor: item.vendor || "",
          unit: item.unit || "ea",
          price: item.price || 0,
          quantity: item.quantity || 0, // usually we might leave it 0, but parsing gets it if needed
          createdAt: new Date().toISOString()
        });
        imported++;
      } catch (err: any) {
        errors.push(\`Failed to import \${item.name}: \${err.message}\`);
      }
    }
    
    if (imported > 0) {
      setApiSuccess(\`Successfully imported \${imported} items!\`);
      setAiInventoryItems([]);
      setShowAIBatchParser(false);
      setBatchInputText("");
    }
    if (errors.length > 0) {
      setApiError(errors.join(" | "));
    }
  };

`;

const aiBatchUI = `
      {/* AI Batch Document Parser Area */}
      {showAIBatchParser && (
        <div className="bg-[#fcf8f2] border border-amber-450 rounded-xl p-6 mb-8 text-left" id="ai-batch-parser-area">
          <div className="flex justify-between items-center mb-5 pb-3 border-b border-neutral-200">
            <h3 className="font-bold text-neutral-900 flex items-center gap-2 text-xs font-sans">
              <Sparkles className="h-4.5 w-4.5 text-amber-700 animate-pulse fill-amber-700" />
              AI Inventory Document Parser
            </h3>
            <button
              onClick={() => {
                setShowAIBatchParser(false);
                setBatchInputText("");
                setAiInventoryItems([]);
                setApiError("");
                setApiSuccess("");
              }}
              className="text-neutral-400 hover:text-black cursor-pointer bg-white p-1.5 rounded border border-neutral-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {(apiError || apiSuccess) && (
            <div className="mb-4 space-y-2">
              {apiError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-bold border border-red-200">
                  {apiError}
                </div>
              )}
              {apiSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200">
                  {apiSuccess}
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  Target Department (Optional)
                </label>
                <select
                  value={batchTargetDept}
                  onChange={(e) => setBatchTargetDept(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-hidden"
                >
                  <option value="AUTO">Auto-detect from context</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  Target Vendor (Optional)
                </label>
                <select
                  value={batchTargetVendor}
                  onChange={(e) => setBatchTargetVendor(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-hidden"
                >
                  <option value="">Auto-detect / Leave blank</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.name}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2 block">
                Paste Invoice, Prep List, or Spreadsheet Text
              </label>
              <textarea
                value={batchInputText}
                onChange={(e) => setBatchInputText(e.target.value)}
                placeholder="Paste your document here..."
                className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-3 text-xs font-bold font-mono focus:outline-hidden h-40 resize-y"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleRunAiBatchParser}
                disabled={isAiParsing || !batchInputText.trim()}
                className="px-5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-[10px] border border-amber-450 flex items-center gap-1.5 disabled:opacity-40 cursor-pointer transition-all"
              >
                {isAiParsing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Parsing Document...</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    <span>Parse Document</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI Extracted Items Review */}
          {aiInventoryItems.length > 0 && (
            <div className="mt-8 pt-6 border-t border-amber-200">
              <h4 className="text-[10px] font-bold text-neutral-900 flex items-center gap-1.5 mb-3">
                <FileText className="h-4 w-4 text-amber-700" />
                Review Extracted Items ({aiInventoryItems.length})
              </h4>
              
              <div className="border border-neutral-200 rounded-xl overflow-x-auto bg-white mb-4">
                <table className="min-w-full divide-y divide-[#141414] text-xs text-neutral-900 text-left">
                  <thead className="bg-[#f0efeb] text-neutral-900/75 font-bold text-[9px]">
                    <tr>
                      <th className="px-3 py-2 border-r border-neutral-200 w-16">#</th>
                      <th className="px-3 py-2 border-r border-neutral-200">Name</th>
                      <th className="px-3 py-2 border-r border-neutral-200">Department</th>
                      <th className="px-3 py-2 border-r border-neutral-200">Vendor</th>
                      <th className="px-3 py-2 border-r border-neutral-200">Quantity</th>
                      <th className="px-3 py-2 border-r border-neutral-200">Unit</th>
                      <th className="px-3 py-2 text-right border-r border-neutral-200">Price</th>
                      <th className="px-3 py-2">Raw Text</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141414]/10">
                    {aiInventoryItems.map((item, index) => (
                      <tr key={index} className="hover:bg-neutral-50/50">
                        <td className="px-3 py-2 border-r border-neutral-200/10 font-mono text-[9px] text-neutral-400">
                          {index + 1}
                        </td>
                        <td className="px-3 py-2 border-r border-neutral-200/10 font-bold">
                          {item.name}
                        </td>
                        <td className="px-3 py-2 border-r border-neutral-200/10 text-[10px]">
                          <span className="bg-neutral-100 px-2 py-0.5 rounded font-mono">{item.department}</span>
                        </td>
                        <td className="px-3 py-2 border-r border-neutral-200/10 text-[10px]">
                          {item.vendor || "-"}
                        </td>
                        <td className="px-3 py-2 border-r border-neutral-200/10 font-mono">
                          {item.quantity}
                        </td>
                        <td className="px-3 py-2 border-r border-neutral-200/10 font-mono">
                          {item.unit}
                        </td>
                        <td className="px-3 py-2 border-r border-neutral-200/10 font-mono text-right font-bold">
                          \${parseFloat(item.price || 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-[8px] font-mono text-neutral-400 max-w-[150px] truncate" title={item.rawText}>
                          {item.rawText}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleImportAllItems}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>Import {aiInventoryItems.length} Items to Inventory</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

`;

invContent = invContent.replace(
  /  const handleOpenAddModal = \(\) => \{/,
  `${newLogicAndUI}\n  const handleOpenAddModal = () => {`
);

invContent = invContent.replace(
  /      \{\/\* AI AUTO-CATEGORIZATION PROMPT BANNER \*\/\}/,
  `${aiBatchUI}      {/* AI AUTO-CATEGORIZATION PROMPT BANNER */}`
);

// We also need FileText import in InventoryView.tsx if it's not there
if (!invContent.includes("FileText")) {
  invContent = invContent.replace(
    /import \{([^{}]*)\} from "lucide-react";/,
    "import {$1, FileText} from \"lucide-react\";"
  );
}

fs.writeFileSync(invPath, invContent);
