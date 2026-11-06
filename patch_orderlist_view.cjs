const fs = require('fs');
let code = fs.readFileSync('src/components/OrderListView.tsx', 'utf8');

const changeHandler = `
  const handleVendorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedVendorName = e.target.value;
    const vendor = vendors.find(v => v.name === selectedVendorName);
    
    setFormData(prev => {
      // If we select a vendor that has an order template, AND our current items list is empty,
      // let's auto-populate the template items to save time!
      let newItems = prev.items;
      if (vendor && vendor.orderTemplate && vendor.orderTemplate.length > 0 && prev.items.length === 0) {
        newItems = [...vendor.orderTemplate];
      }
      
      return {
        ...prev,
        vendorName: selectedVendorName,
        items: newItems
      };
    });
  };
`;

code = code.replace(/  const handleAddItem = \(\) => \{/, changeHandler + '\n  const handleAddItem = () => {');

code = code.replace(
  /onChange=\{\(e\) => setFormData\(\{\.\.\.formData, vendorName: e\.target\.value\}\)\}/,
  'onChange={handleVendorChange}'
);

fs.writeFileSync('src/components/OrderListView.tsx', code);
