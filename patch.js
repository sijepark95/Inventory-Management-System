const fs = require('fs');
const file = 'src/components/InventoryView.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetContent = `        const newDocRef = await safeAddDoc("ingredients", {
          name: item.name,
          department: effectiveDepartment,
          vendor: effectiveVendor,
          unit: item.unit || "ea",
          price: price,
          quantity: 1,
          inStock: qty,
          ownerId: targetOwnerId,
          createdAt: new Date().toISOString()
        });
        imported++;

        // Record inbound receiving in Restaurant Ingredient Consumption Log
        if (qty > 0 && targetOwnerId) {
          try {
            const consumptionRecord: Omit<ConsumptionLog, "id"> = {
              date: new Date().toISOString().slice(0, 10),
              vendorName: effectiveVendor,
              ingredientId: newDocRef.id,
              ingredientName: item.name,
              quantity: -Math.abs(qty), // Negative quantity represents addition / restock
              unit: item.unit || "ea",
              pricePerPack: price,
              totalCost: -Math.abs(price * qty), // Negative cost represents inbound delivery
              recordedBy: "AI Document Parser",
              operatorName: user?.displayName || user?.email || "AI Document Parser",
              ownerId: targetOwnerId,
              createdAt: new Date().toISOString()
            };
            await safeAddDoc("inventory_consumptions", consumptionRecord);
          } catch (consErr) {
            console.error("Failed to log consumption for batch parsed item:", consErr);
          }
        }`;

const replacementContent = `        const matchingIng = ingredients.find(ing => ing.name.toLowerCase().trim() === item.name.toLowerCase().trim());
        
        let targetId = "";
        
        if (matchingIng && matchingIng.id) {
          // Update existing ingredient to pile stock
          const newStock = (matchingIng.inStock || 0) + qty;
          await safeUpdateDoc("ingredients", matchingIng.id, {
            inStock: newStock,
            price: price > 0 ? price : matchingIng.price,
            updatedAt: new Date().toISOString()
          });
          targetId = matchingIng.id;
        } else {
          // Create new ingredient
          const newDocRef = await safeAddDoc("ingredients", {
            name: item.name,
            department: effectiveDepartment,
            vendor: effectiveVendor,
            unit: item.unit || "ea",
            price: price,
            quantity: 1,
            inStock: qty,
            ownerId: targetOwnerId,
            createdAt: new Date().toISOString()
          });
          targetId = newDocRef.id;
        }
        
        imported++;

        // Record inbound receiving in Restaurant Ingredient Consumption Log
        if (qty > 0 && targetOwnerId) {
          try {
            const consumptionRecord: Omit<ConsumptionLog, "id"> = {
              date: new Date().toISOString().slice(0, 10),
              vendorName: effectiveVendor,
              ingredientId: targetId,
              ingredientName: matchingIng ? matchingIng.name : item.name,
              quantity: -Math.abs(qty), // Negative quantity represents addition / restock
              unit: matchingIng?.unit || item.unit || "ea",
              pricePerPack: price > 0 ? price : (matchingIng?.price || 0),
              totalCost: -Math.abs((price > 0 ? price : (matchingIng?.price || 0)) * qty), // Negative cost represents inbound delivery
              recordedBy: "AI Batch Parser",
              operatorName: user?.displayName || user?.email || "AI Batch Parser",
              ownerId: targetOwnerId,
              createdAt: new Date().toISOString()
            };
            await safeAddDoc("inventory_consumptions", consumptionRecord);
          } catch (consErr) {
            console.error("Failed to log consumption for batch parsed item:", consErr);
          }
        }`;

content = content.replace(targetContent, replacementContent);
fs.writeFileSync(file, content);
