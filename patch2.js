const fs = require('fs');
const path = require('path');
const p = path.resolve(__dirname, 'src/lib/unitConverter.ts');
let code = fs.readFileSync(p, 'utf8');

const newDetailFn = `export function getConsumptionQtyDetail(
  log: { quantity: number; unit?: string },
  ing?: {
    unit: string;
    weightPerCase?: number;
    weightPerCaseUnit?: string;
    pcsPerPound?: number;
    quantity?: number;
    packagingUnit?: string;
    conversions?: Array<{ ratio: number; targetUnit: string }>;
  }
): { primary: string; secondary: string; full: string } {
  const sign = log.quantity > 0 ? "-" : "+";
  const absQty = Math.abs(log.quantity);
  const logUnit = (log.unit || "lbs").trim();
  const cleanLogUnit = logUnit.toLowerCase();

  const primary = \`\${sign}\${absQty} \${logUnit}\`;

  if (!ing) return { primary, secondary: "", full: primary };

  const cleanIngUnit = (ing.unit || "").trim().toLowerCase();

  const isLogMass = isMassUnit(cleanLogUnit);
  const isLogPcs = isPieceUnit(cleanLogUnit);
  const isLogPkg = isPackageUnit(cleanLogUnit);

  const isBaseMass = isMassUnit(cleanIngUnit);
  const isBasePcs = isPieceUnit(cleanIngUnit);
  const isBasePkg = isPackageUnit(cleanIngUnit);

  const logCategory = isLogMass ? 'mass' : isLogPcs ? 'pcs' : isLogPkg ? 'pkg' : 'unknown';
  const baseCategory = isBaseMass ? 'mass' : isBasePcs ? 'pcs' : isBasePkg ? 'pkg' : 'unknown';

  let secondary = "";

  if (logCategory !== baseCategory && baseCategory !== 'unknown') {
    // Log is different from base, show BASE UNIT
    const qtyInBase = convertInputToNativeQty(absQty, cleanLogUnit, ing as any);
    if (qtyInBase > 0) {
      let formatted = qtyInBase % 1 === 0 ? qtyInBase.toString() : qtyInBase < 1 ? qtyInBase.toFixed(2) : qtyInBase.toFixed(1);
      
      if (isBaseMass) {
         let weightUnit = (ing.unit || "lb").toLowerCase().trim();
         const displayUnit = ["oz", "ounce"].includes(weightUnit) ? "oz" : ["kg", "kilogram"].includes(weightUnit) ? "kg" : "lb";
         let val = qtyInBase;
         if (weightUnit === "lb" && displayUnit === "oz") val *= 16;
         if (weightUnit === "lb" && displayUnit === "kg") val *= 0.45359237;
         formatted = val % 1 === 0 ? val.toString() : val < 1 ? val.toFixed(2) : val.toFixed(2);
         secondary = \`(\${sign}\${formatted}\${displayUnit})\`;
      } else {
         const baseUnitStr = ing.unit || (isBasePcs ? "pcs" : isBasePkg ? "box" : "");
         secondary = \`(\${sign}\${formatted} \${baseUnitStr})\`;
      }
    }
  } else {
    // Log category is SAME as base category, show ANOTHER pack size
    if (baseCategory === 'mass' || baseCategory === 'pcs') {
      const pkgUnit = (ing.packagingUnit || "box").toLowerCase().trim();
      let qtyInPkg = 0;
      
      if (baseCategory === 'mass') {
        const baseGrams = getGramsOrMlEquivalent(absQty, cleanLogUnit);
        if (ing.weightPerCase && ing.weightPerCase > 0) {
          const pkgGrams = getGramsOrMlEquivalent(ing.weightPerCase, ing.weightPerCaseUnit || "lb");
          if (pkgGrams > 0) {
            qtyInPkg = baseGrams / pkgGrams;
          }
        }
      } else if (baseCategory === 'pcs') {
        const pcsPerPkg = ing.pcsPerPound || ing.quantity;
        if (pcsPerPkg && pcsPerPkg > 0) {
          qtyInPkg = absQty / pcsPerPkg;
        }
      }

      if (qtyInPkg > 0) {
        const formatted = qtyInPkg % 1 === 0 ? qtyInPkg.toString() : qtyInPkg < 1 ? qtyInPkg.toFixed(2) : qtyInPkg.toFixed(1);
        secondary = \`(\${sign}\${formatted} \${pkgUnit})\`;
      }
    } else if (baseCategory === 'pkg') {
      if (ing.pcsPerPound && ing.pcsPerPound > 0) {
         const qtyInPcs = absQty * ing.pcsPerPound;
         const formatted = qtyInPcs % 1 === 0 ? qtyInPcs.toString() : qtyInPcs.toFixed(1);
         secondary = \`(\${sign}\${formatted} pcs)\`;
      } else if (ing.weightPerCase && ing.weightPerCase > 0) {
         const caseGrams = getGramsOrMlEquivalent(ing.weightPerCase, ing.weightPerCaseUnit || "lb");
         let lbs = (caseGrams / 453.59237) * absQty;
         const formatted = lbs % 1 === 0 ? lbs.toString() : lbs < 1 ? lbs.toFixed(2) : lbs.toFixed(2);
         secondary = \`(\${sign}\${formatted}lb)\`;
      }
    }
  }

  return { primary, secondary, full: secondary ? \`\${primary} \${secondary}\` : primary };
}
`;

const replaceRegex = /export function getConsumptionQtyDetail\([\s\S]*?(?=\n\n|\n$)/;
const newCode = code.slice(0, code.indexOf('export function getConsumptionQtyDetail')) + newDetailFn + '\n';

fs.writeFileSync(p, newCode);
console.log('patched2');
