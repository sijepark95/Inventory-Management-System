const { getBaseUnitLabel } = require('./src/lib/unitConverter.cjs');
console.log(getBaseUnitLabel({ unit: 'oz' }));
console.log(getBaseUnitLabel({ unit: 'L' }));
console.log(getBaseUnitLabel({ unit: 'g' }));
console.log(getBaseUnitLabel({ unit: 'pcs' }));
