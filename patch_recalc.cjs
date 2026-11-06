const fs = require('fs');
let code = fs.readFileSync('src/components/IngredientsView.tsx', 'utf8');
code = code.replace(
`  const recalculateEditRate = (priceStr: string, qtyStr: string, unitStr: string, wPerCaseStr: string, wPerCaseUnitStr: string, rateUnitStr: string) => {
    const priceNum = parseFloat(priceStr);
    const qtyNum = parseFloat(qtyStr);
    if (isNaN(priceNum) || isNaN(qtyNum) || qtyNum <= 0) return;`,
`  const recalculateEditRate = (priceStr: string, qtyStr: string, unitStr: string, wPerCaseStr: string, wPerCaseUnitStr: string, rateUnitStr: string) => {
    const priceNum = parseFloat(priceStr) || 0;
    const qtyNum = parseFloat(qtyStr) || 0;`
);
fs.writeFileSync('src/components/IngredientsView.tsx', code);
