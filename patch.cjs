const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
const target = `        const currentStock = targetIng?.inStock || 0;
        const newStock = currentStock + coercedQty;
        const newUnitPrice = coercedQty > 0 ? coercedPrice / coercedQty : 0;
          
        console.log("UPDATING MAP INGREDIENT!", {`;

const replacement = `        let currentStock = targetIng?.inStock || 0;
        let convertedCurrentStock = currentStock;

        if (targetIng && targetIng.unit && parsedUnit && targetIng.unit.toLowerCase().trim() !== parsedUnit.toLowerCase().trim()) {
          const currentLbs = calculatePoundData(
            currentStock,
            targetIng.unit,
            targetIng.weightPerCase,
            targetIng.weightPerCaseUnit,
            targetIng.pcsPerPound,
            targetIng.quantity
          ).lbs;

          const newUnitLower = parsedUnit.toLowerCase().trim();
          if (["lb", "lbs", "pound", "pounds"].includes(newUnitLower)) {
            convertedCurrentStock = currentLbs;
          } else if (["oz", "ounce", "ounces"].includes(newUnitLower)) {
            convertedCurrentStock = currentLbs * 16;
          } else if (["g", "gram", "grams"].includes(newUnitLower)) {
            convertedCurrentStock = currentLbs * 453.59237;
          } else if (["kg", "kilogram", "kilograms"].includes(newUnitLower)) {
            convertedCurrentStock = currentLbs * 0.45359237;
          } else if (["case", "cases", "box", "boxes", "bag", "bags"].includes(newUnitLower) && finalWeightPerCase && finalWeightPerCase > 0) {
            const newCaseLbs = calculatePoundData(1, newUnitLower, finalWeightPerCase, finalWeightPerCaseUnit).lbs;
            if (newCaseLbs > 0) {
              convertedCurrentStock = currentLbs / newCaseLbs;
            }
          }
        }

        const newStock = convertedCurrentStock + coercedQty;
        const newUnitPrice = coercedQty > 0 ? coercedPrice / coercedQty : 0;
          
        console.log("UPDATING MAP INGREDIENT!", {`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('src/App.tsx', code);
    console.log("Success!");
} else {
    console.log("Target not found!");
}
