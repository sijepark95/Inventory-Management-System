const fs = require('fs');
let code = fs.readFileSync('src/components/IngredientsView.tsx', 'utf8');
code = code.replace(
`  const handleEditSave = async (id: string) => {
    const numericPrice = parseFloat(editPrice);
    const numericQty = parseFloat(editQuantity);
    const numericUsability = parseFloat(editUsabilityPercentage);
    const numericPcsPerPound = parseFloat(editPcsPerPound);
    if (!editName || isNaN(numericPrice) || isNaN(numericQty) || numericQty <= 0) return;

    const cleanEditUnit = editUnit.trim();
    const isDiscreteUnit = !["g", "kg", "ml", "L", "oz", "lb"].includes(cleanEditUnit.toLowerCase());
    const wPerCaseNum = parseFloat(editWeightPerCase);
    const hasCustomWeight = !isNaN(wPerCaseNum) && wPerCaseNum > 0;
    const finalWeightUnit = hasCustomWeight ? (editWeightPerCaseUnit || "lb") : undefined;

    let pricePerGram = 0;
    if (hasCustomWeight && finalWeightUnit) {
      const baseEqPerCase = getGramsOrMlEquivalent(wPerCaseNum, finalWeightUnit);
      const totalCapacity = numericQty * baseEqPerCase;
      pricePerGram = totalCapacity > 0 ? (numericPrice / totalCapacity) : 0;
    } else {
      pricePerGram = numericPrice / getGramsOrMlEquivalent(numericQty, cleanEditUnit);
    }`,
`  const handleEditSave = async (id: string) => {
    const numericPrice = parseFloat(editPrice) || 0;
    const numericQty = parseFloat(editQuantity) || 0;
    const numericUsability = parseFloat(editUsabilityPercentage);
    const numericPcsPerPound = parseFloat(editPcsPerPound);
    if (!editName.trim()) return;

    const cleanEditUnit = editUnit.trim();
    const isDiscreteUnit = !["g", "kg", "ml", "L", "oz", "lb"].includes(cleanEditUnit.toLowerCase());
    const wPerCaseNum = parseFloat(editWeightPerCase);
    const hasCustomWeight = !isNaN(wPerCaseNum) && wPerCaseNum > 0;
    const finalWeightUnit = hasCustomWeight ? (editWeightPerCaseUnit || "lb") : undefined;

    let pricePerGram = 0;
    if (hasCustomWeight && finalWeightUnit) {
      const baseEqPerCase = getGramsOrMlEquivalent(wPerCaseNum, finalWeightUnit);
      const totalCapacity = numericQty * baseEqPerCase;
      pricePerGram = totalCapacity > 0 ? (numericPrice / totalCapacity) : 0;
    } else {
      const eq = getGramsOrMlEquivalent(numericQty, cleanEditUnit);
      pricePerGram = eq > 0 ? (numericPrice / eq) : 0;
    }`
);
fs.writeFileSync('src/components/IngredientsView.tsx', code);
