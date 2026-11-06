const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetLoopStart = `    // Process mapped array synchronously or via promise batched array
    for (const item of itemsToApply) {`;

const replacementLoopStart = `    const localIngredientsMap = new Map<string, any>();
    // Process mapped array synchronously or via promise batched array
    for (const item of itemsToApply) {`;

content = content.replace(targetLoopStart, replacementLoopStart);

const targetTargetIng = `      } else if (item.action === "map" && item.targetIngredientId) {
        const targetIng = ingredients.find(ing => ing.id === item.targetIngredientId);
        console.log("targetIng before update:", targetIng);`;

const replacementTargetIng = `      } else if (item.action === "map" && item.targetIngredientId) {
        const baseIng = ingredients.find(ing => ing.id === item.targetIngredientId);
        const targetIng = localIngredientsMap.get(item.targetIngredientId) || baseIng;
        console.log("targetIng before update:", targetIng);`;

content = content.replace(targetTargetIng, replacementTargetIng);

const targetUpdateEnd = `        // Update package price and date of existing ingredient with normalized standard rates
        try {
          await safeUpdateDoc("ingredients", item.targetIngredientId, updatePayload);
        } catch (updErr) {
          console.warn("safeUpdateDoc failed, fallback to safeSetDoc:", updErr);
          try {
            await safeSetDoc("ingredients", item.targetIngredientId, {
              ...updatePayload,
              name: targetIng?.name || name,
              ownerId: targetOwnerId,
            });
          } catch (setErr) {
            console.error("Failed to update or set ingredient doc:", setErr);
          }
        }`;

const replacementUpdateEnd = `        // Track in local map for subsequent iterations in this batch
        localIngredientsMap.set(item.targetIngredientId, {
          ...(targetIng || {}),
          ...updatePayload,
          id: item.targetIngredientId,
        });

        // Update package price and date of existing ingredient with normalized standard rates
        try {
          await safeUpdateDoc("ingredients", item.targetIngredientId, updatePayload);
        } catch (updErr) {
          console.warn("safeUpdateDoc failed, fallback to safeSetDoc:", updErr);
          try {
            await safeSetDoc("ingredients", item.targetIngredientId, {
              ...updatePayload,
              name: targetIng?.name || name,
              ownerId: targetOwnerId,
            });
          } catch (setErr) {
            console.error("Failed to update or set ingredient doc:", setErr);
          }
        }`;

content = content.replace(targetUpdateEnd, replacementUpdateEnd);

fs.writeFileSync(file, content);
