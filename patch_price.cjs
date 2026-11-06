const fs = require('fs');
let code = fs.readFileSync('src/components/IngredientsView.tsx', 'utf8');
code = code.replace(
`    let pricePerGram = 0;
    if (hasCustomWeight) {
      const baseEqPerCase = getGramsOrMlEquivalent(wPerCaseNum, weightPerCaseUnit);
      const totalCapacity = numericQty * baseEqPerCase;
      pricePerGram = totalCapacity > 0 ? (numericPrice / totalCapacity) : 0;
    } else {
      pricePerGram = numericPrice / getGramsOrMlEquivalent(numericQty, unit);
    }`,
`    let pricePerGram = 0;
    if (hasCustomWeight) {
      const baseEqPerCase = getGramsOrMlEquivalent(wPerCaseNum, weightPerCaseUnit);
      const totalCapacity = numericQty * baseEqPerCase;
      pricePerGram = totalCapacity > 0 ? (numericPrice / totalCapacity) : 0;
    } else {
      const eq = getGramsOrMlEquivalent(numericQty, unit);
      pricePerGram = eq > 0 ? (numericPrice / eq) : 0;
    }`
);
fs.writeFileSync('src/components/IngredientsView.tsx', code);
