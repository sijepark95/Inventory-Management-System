const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `      if (item.action === "create") {
        const itemSource = isPriceCorrectionOnly
          ? \`Price correction (\${vendor || fileName || "document"})\`
          : \`Invoice #\${invoiceNumber || "N/A"} (\${vendor})\`;`;

const replacementStr = `      if (item.action === "create") {
        const itemSource = isPriceCorrectionOnly
          ? \`Price correction (\${vendor || fileName || "document"})\`
          : \`Invoice #\${invoiceNumber || "N/A"} (\${vendor})\`;
          
        // Check if we JUST created this exact item in a previous iteration of this batch!
        let previouslyCreatedId = null;
        for (const [id, localIng] of localIngredientsMap.entries()) {
          if (localIng.name && localIng.name.toLowerCase().trim() === (name || "").toLowerCase().trim()) {
            previouslyCreatedId = id;
            break;
          }
        }
        
        if (previouslyCreatedId) {
          // HIJACK: Convert to map action to pile onto the item we just created
          item.action = "map";
          item.targetIngredientId = previouslyCreatedId;
          // Restart this loop iteration as a map action
          itemsToApply.push(item);
          continue;
        }`;

content = content.replace(targetStr, replacementStr);
fs.writeFileSync(file, content);
