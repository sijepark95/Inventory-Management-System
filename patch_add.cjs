const fs = require('fs');
let code = fs.readFileSync('src/components/IngredientsView.tsx', 'utf8');
code = code.replace(
`  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || price === "" || !quantity || !unit) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const numericPrice = parseFloat(price);
    const numericQty = parseFloat(quantity);
    if (isNaN(numericPrice) || isNaN(numericQty) || numericQty <= 0) return;`,
`  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const numericPrice = parseFloat(price) || 0;
    const numericQty = parseFloat(quantity) || 0;`
);
fs.writeFileSync('src/components/IngredientsView.tsx', code);
