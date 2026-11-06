const fs = require('fs');
let appContent = fs.readFileSync('src/App.tsx', 'utf8');

// Replace create branch
appContent = appContent.replace(
`        // Create as a brand new ingredient with mathematically correct normalized pricePerGram
        await safeAddDoc("ingredients", {
          name,
          price: coercedPrice,
          quantity: coercedQty,
          unit: parsedUnit,
          pricePerGram: finalPricePerGram,
          source: itemSource,`,
`        const newUnitPrice = coercedQty > 0 ? coercedPrice / coercedQty : 0;
        // Create as a brand new ingredient with mathematically correct normalized pricePerGram
        await safeAddDoc("ingredients", {
          name,
          price: newUnitPrice,
          quantity: 1,
          inStock: coercedQty,
          unit: parsedUnit,
          pricePerGram: finalPricePerGram,
          source: itemSource,`
);

// Replace map branch
appContent = appContent.replace(
`        // Update package price and date of existing ingredient with normalized standard rates
        await safeUpdateDoc("ingredients", item.targetIngredientId, {
          price: coercedPrice,
          quantity: coercedQty,
          unit: parsedUnit,
          pricePerGram: finalPricePerGram, // newest rate standard normalized
          source: \`Updated via Invoice #\${invoiceNumber || "N/A"} (\${vendor})\`,`,
`        const currentStock = targetIng?.inStock || 0;
        const newStock = currentStock + coercedQty;
        const newUnitPrice = coercedQty > 0 ? coercedPrice / coercedQty : 0;
        // Update package price and date of existing ingredient with normalized standard rates
        await safeUpdateDoc("ingredients", item.targetIngredientId, {
          price: newUnitPrice,
          quantity: 1,
          inStock: newStock,
          unit: parsedUnit,
          pricePerGram: finalPricePerGram, // newest rate standard normalized
          source: \`Updated via Invoice #\${invoiceNumber || "N/A"} (\${vendor})\`,`
);

fs.writeFileSync('src/App.tsx', appContent);
