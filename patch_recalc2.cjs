const fs = require('fs');
let code = fs.readFileSync('src/components/IngredientsView.tsx', 'utf8');
code = code.replace(
`    if (cleanRateUnitStr === "pcs" || cleanRateUnitStr === cleanUnitStr || (isDiscreteUnit && !hasCustomWeight)) {
      const displayRate = priceNum / qtyNum;
      setEditRateValue(displayRate.toFixed(5));
      return;
    }

    let pricePerGram = 0;
    if (hasCustomWeight) {
      const baseEqPerCase = getGramsOrMlEquivalent(wPerCaseNum, wPerCaseUnitStr);
      const totalCapacity = qtyNum * baseEqPerCase;
      pricePerGram = totalCapacity > 0 ? (priceNum / totalCapacity) : 0;
    } else {
      pricePerGram = priceNum / getGramsOrMlEquivalent(qtyNum, unitStr);
    }`,
`    if (cleanRateUnitStr === "pcs" || cleanRateUnitStr === cleanUnitStr || (isDiscreteUnit && !hasCustomWeight)) {
      const displayRate = qtyNum > 0 ? priceNum / qtyNum : 0;
      setEditRateValue(displayRate.toFixed(5));
      return;
    }

    let pricePerGram = 0;
    if (hasCustomWeight) {
      const baseEqPerCase = getGramsOrMlEquivalent(wPerCaseNum, wPerCaseUnitStr);
      const totalCapacity = qtyNum * baseEqPerCase;
      pricePerGram = totalCapacity > 0 ? (priceNum / totalCapacity) : 0;
    } else {
      const eq = getGramsOrMlEquivalent(qtyNum, unitStr);
      pricePerGram = eq > 0 ? priceNum / eq : 0;
    }`
);
fs.writeFileSync('src/components/IngredientsView.tsx', code);
