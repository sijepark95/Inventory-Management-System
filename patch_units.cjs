const fs = require('fs');
let code = fs.readFileSync('src/components/IngredientsView.tsx', 'utf8');

const constantStr = `const MASS_VOLUME_UNITS = ["g", "kg", "ml", "l", "oz", "lb", "lbs", "ounce", "ounces", "pound", "pounds", "gram", "grams", "liter", "liters", "milliliter", "milliliters", "kilogram", "kilograms"];\n\n`;

code = code.replace(
  `import AIAssistantModal from "./AIAssistantModal";`,
  `import AIAssistantModal from "./AIAssistantModal";\n\n${constantStr}`
);

code = code.replace(/!\["g", "kg", "ml", "L", "oz", "lb"\]\.includes\((.*?)\)/g, `!MASS_VOLUME_UNITS.includes($1)`);
code = code.replace(/\["g", "kg", "ml", "L", "oz", "lb"\]\.includes\((.*?)\)/g, `MASS_VOLUME_UNITS.includes($1)`);

fs.writeFileSync('src/components/IngredientsView.tsx', code);
