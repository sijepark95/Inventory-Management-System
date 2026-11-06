const fs = require('fs');
let code = fs.readFileSync('src/components/VendorsView.tsx', 'utf8');

// Add imports
code = code.replace(/import { Vendor, Ingredient } from '\.\.\/types';/, "import { Vendor, Ingredient, OrderListItem } from '../types';\nimport { FileText } from 'lucide-react';");

// Add state
const stateToAdd = `
  const [templateVendor, setTemplateVendor] = useState<Vendor | null>(null);
  const [templateItems, setTemplateItems] = useState<OrderListItem[]>([]);
`;
code = code.replace(/  const \[formData, setFormData\] = useState\(\{/, stateToAdd + '\n  const [formData, setFormData] = useState({');

// Add template handlers
const handlersToAdd = `
  const handleEditTemplate = (vendor: Vendor) => {
    setTemplateVendor(vendor);
    setTemplateItems(vendor.orderTemplate ? [...vendor.orderTemplate] : []);
  };

  const handleSaveTemplate = async () => {
    if (templateVendor && templateVendor.id) {
      await onEditVendor(templateVendor.id, { orderTemplate: templateItems });
      setTemplateVendor(null);
    }
  };

  const handleAddTemplateItem = () => {
    setTemplateItems(prev => [...prev, { name: "", quantity: 1, unit: "ea", estimatedPrice: 0 }]);
  };

  const handleUpdateTemplateItem = (index: number, field: keyof OrderListItem, value: any) => {
    setTemplateItems(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };
      
      if (field === 'name') {
        const ingredient = ingredients.find(i => i.name === value);
        if (ingredient) {
          newItems[index].unit = ingredient.unit || "ea";
          newItems[index].estimatedPrice = ingredient.price || 0;
          newItems[index].ingredientId = ingredient.id;
        }
      }
      return newItems;
    });
  };

  const handleRemoveTemplateItem = (index: number) => {
    setTemplateItems(prev => prev.filter((_, i) => i !== index));
  };
`;
code = code.replace(/  const handleSubmit = async \(e: React\.FormEvent\) => \{/, handlersToAdd + '\n  const handleSubmit = async (e: React.FormEvent) => {');

// Add Template Button to the card
const buttonToAdd = `
                        <button 
                          onClick={() => handleEditTemplate(vendor)}
                          className="flex-1 bg-white border border-neutral-200 text-neutral-900 hover:bg-blue-600 hover:text-white py-1.5 text-[10px] font-bold transition-colors flex items-center justify-center gap-1.5"
                        >
                          <FileText className="h-3 w-3" /> Template
                        </button>
                        <button 
                          onClick={() => handleEditClick(vendor)}
`;
code = code.replace(/                        <button \n                           onClick=\{\(\) => handleEditClick\(vendor\)\}/, buttonToAdd);

// Add Modal to the bottom
const modalToAdd = `
      {/* Template Modal */}
      {templateVendor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-neutral-100 bg-neutral-50/50">
              <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                Order Template: {templateVendor.name}
              </h3>
              <button onClick={() => setTemplateVendor(null)} className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-6">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="block text-sm font-bold text-neutral-900">Default Order Items</label>
                  <p className="text-xs text-neutral-500">These items will be automatically added when you create a new Order List for {templateVendor.name}.</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddTemplateItem}
                  className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              </div>
              
              <div className="border border-neutral-200 rounded-xl overflow-hidden bg-neutral-50">
                <table className="w-full text-left">
                  <thead className="bg-neutral-100/50 border-b border-neutral-200">
                    <tr>
                      <th className="px-3 py-2 text-xs font-bold text-neutral-500 uppercase">Item / Ingredient</th>
                      <th className="px-3 py-2 text-xs font-bold text-neutral-500 uppercase w-24">Default Qty</th>
                      <th className="px-3 py-2 text-xs font-bold text-neutral-500 uppercase w-24">Unit</th>
                      <th className="px-3 py-2 text-xs font-bold text-neutral-500 uppercase w-32">Est. Price</th>
                      <th className="px-3 py-2 text-xs font-bold text-neutral-500 uppercase w-32">Total</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {templateItems.map((item, index) => (
                      <tr key={index} className="bg-white">
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            required
                            list="ingredient-list-template"
                            value={item.name}
                            onChange={(e) => handleUpdateTemplateItem(index, "name", e.target.value)}
                            className="w-full px-2 py-1.5 bg-transparent border border-neutral-200 rounded text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                            placeholder="Item name..."
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={item.quantity || ""}
                            onChange={(e) => handleUpdateTemplateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 bg-transparent border border-neutral-200 rounded text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => handleUpdateTemplateItem(index, "unit", e.target.value)}
                            className="w-full px-2 py-1.5 bg-transparent border border-neutral-200 rounded text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                            placeholder="ea, lb..."
                          />
                        </td>
                        <td className="px-3 py-2 relative">
                          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.estimatedPrice || ""}
                            onChange={(e) => handleUpdateTemplateItem(index, "estimatedPrice", parseFloat(e.target.value) || 0)}
                            className="w-full pl-6 pr-2 py-1.5 bg-transparent border border-neutral-200 rounded text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                          />
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-neutral-900 text-sm">
                          \${((item.quantity || 0) * (item.estimatedPrice || 0)).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveTemplateItem(index)}
                            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {templateItems.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-neutral-400">
                          No items in this template. Click "Add Item" to set up default items for this vendor.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <datalist id="ingredient-list-template">
                  {ingredients.map(ing => (
                    <option key={ing.id} value={ing.name} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="p-4 border-t border-neutral-100 flex justify-end gap-3 bg-neutral-50">
              <button
                type="button"
                onClick={() => setTemplateVendor(null)}
                className="px-4 py-2 text-sm font-bold text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
`;
code = code.replace(/    <\/div>\n  \);\n\}\n$/, modalToAdd + '    </div>\n  );\n}\n');

fs.writeFileSync('src/components/VendorsView.tsx', code);
