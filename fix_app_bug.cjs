const fs = require('fs');
let appContent = fs.readFileSync('src/App.tsx', 'utf8');

// I also need to remove "ai-parser" from the "intel" includes in App.tsx line ~1625:
// activeSection === "intel" || ["ai-parser", "catalog", "recipes"].includes(activeSection)
// becomes activeSection === "intel" || ["catalog", "recipes"].includes(activeSection)

appContent = appContent.replace(
  /activeSection === "intel" \|\| \["ai-parser", "catalog", "recipes"\]\.includes\(activeSection\)/g,
  'activeSection === "intel" || ["catalog", "recipes"].includes(activeSection)'
);

// We should also remove it from the Top Navigation tabs list, wait, let me check the Top Navigation Tabs part in App.tsx
// {["ai-parser", "catalog", "recipes", "intel"].includes(activeSection) && (
// Needs to remove ai-parser if we're putting it under inventory. Or maybe Inventory view doesn't have tabs, it's just a view.
// Yes, the top tabs logic handles AI Parser... Let me look at line 2170:
appContent = appContent.replace(
  /\{\["ai-parser", "catalog", "recipes", "intel"\]\.includes\(activeSection\) && \(/,
  '{["catalog", "recipes", "intel"].includes(activeSection) && ('
);

// We need to move the tab button from Food Cost top tabs to Inventory?
// No, the user said "move it to under the inventory". In the sidebar, we've moved it under Inventory.
// Wait, the "AI Document Parser" view was part of the "Food Cost Intel" top tabs as well. 
// If we moved it under inventory, maybe we should remove the top tab from Food Cost view.
// And maybe we need to render the AIParserView when clicking the sidebar? Yes, it still renders:
// {activeSection === "ai-parser" && <AIParserView ... />}
// So we just need to remove the tab from the Food Cost top tabs.
const aiTabRegex = /\s*<button\s*onClick=\{\(\) => setActiveSection\("ai-parser"\)\}[\s\S]*?<Sparkles className="w-4 h-4" \/> AI Document Parser\s*<\/button>\s*/;
appContent = appContent.replace(aiTabRegex, "");

fs.writeFileSync('src/App.tsx', appContent);
