import React, { useState, useMemo } from 'react';
import { Vendor, Ingredient, OrderListItem } from '../types';
import { Building2, Search, FileText, Plus, Trash2, Check, X, ChevronRight, ShoppingCart } from 'lucide-react';

interface OrderTemplatesViewProps {
  vendors: Vendor[];
  ingredients: Ingredient[];
  onEditVendor: (id: string, updates: Partial<Vendor>) => Promise<void>;
  isReadOnly: boolean;
}

export const OrderTemplatesView: React.FC<OrderTemplatesViewProps> = ({
  vendors,
  ingredients,
  onEditVendor,
  isReadOnly
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [templateItems, setTemplateItems] = useState<OrderListItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => 
      v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.contactName?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [vendors, searchTerm]);

  const handleSelectVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setTemplateItems(vendor.orderTemplate ? [...vendor.orderTemplate] : []);
  };

  const handleSaveTemplate = async () => {
    if (!selectedVendor || !selectedVendor.id) return;
    
    setIsSaving(true);
    try {
      await onEditVendor(selectedVendor.id, { orderTemplate: templateItems });
      // Update local state to reflect changes instantly without waiting for re-render if needed
      setSelectedVendor(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddItem = () => {
    setTemplateItems(prev => [...prev, { name: "", quantity: 1, unit: "ea", estimatedPrice: 0 }]);
  };

  const handleUpdateItem = (index: number, field: keyof OrderListItem, value: any) => {
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

  const handleRemoveItem = (index: number) => {
    setTemplateItems(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-neutral-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-emerald-600" />
          Order Templates
        </h2>
        <p className="text-xs sm:text-sm text-neutral-500 mt-1">
          Set up default order items for each vendor. These will auto-populate when making a new order list.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Vendor List */}
        <div className="lg:col-span-1 bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-[600px]">
          <div className="p-4 border-b border-neutral-100 bg-neutral-50/50">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search vendors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredVendors.length === 0 ? (
              <div className="p-6 text-center text-neutral-400">
                <Building2 className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                <p className="text-sm">No vendors found.</p>
              </div>
            ) : (
              filteredVendors.map(vendor => {
                const isSelected = selectedVendor?.id === vendor.id;
                const templateCount = vendor.orderTemplate?.length || 0;
                
                return (
                  <button
                    key={vendor.id}
                    onClick={() => handleSelectVendor(vendor)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors text-left ${
                      isSelected 
                        ? "bg-emerald-50 border border-emerald-200 shadow-sm" 
                        : "hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-emerald-100 text-emerald-600" : "bg-neutral-100 text-neutral-500"
                      }`}>
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-bold truncate ${isSelected ? "text-emerald-900" : "text-neutral-900"}`}>
                          {vendor.name}
                        </p>
                        <p className="text-xs text-neutral-500 truncate flex items-center gap-1">
                          <ShoppingCart className="w-3 h-3" />
                          {templateCount} {templateCount === 1 ? 'item' : 'items'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 ${isSelected ? "text-emerald-500" : "text-neutral-300"}`} />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Template Editor */}
        <div className="lg:col-span-2">
          {selectedVendor ? (
            <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-[600px]">
              <div className="p-4 sm:p-5 flex items-center justify-between border-b border-neutral-100 bg-neutral-50/50 shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                    Template for {selectedVendor.name}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">Define standard items you normally order from this supplier.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedVendor(null)}
                    className="px-3 py-1.5 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors hidden sm:block"
                  >
                    Close
                  </button>
                  {!isReadOnly && (
                    <button
                      onClick={handleSaveTemplate}
                      disabled={isSaving}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      {isSaving ? "Saving..." : "Save Template"}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">Template Items</label>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add Item
                    </button>
                  )}
                </div>

                <div className="border border-neutral-200 rounded-xl overflow-hidden bg-neutral-50">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-100/50 border-b border-neutral-200">
                      <tr>
                        <th className="px-3 py-2 text-xs font-bold text-neutral-500 uppercase">Item / Ingredient</th>
                        <th className="px-3 py-2 text-xs font-bold text-neutral-500 uppercase w-24">Def. Qty</th>
                        <th className="px-3 py-2 text-xs font-bold text-neutral-500 uppercase w-20">Unit</th>
                        <th className="px-3 py-2 text-xs font-bold text-neutral-500 uppercase w-28 hidden sm:table-cell">Est. Price</th>
                        {!isReadOnly && <th className="px-3 py-2 w-10"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {templateItems.map((item, index) => (
                        <tr key={index} className="bg-white group">
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              required
                              disabled={isReadOnly}
                              list="ingredient-list-template-view"
                              value={item.name}
                              onChange={(e) => handleUpdateItem(index, "name", e.target.value)}
                              className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-neutral-200 focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500 rounded text-sm transition-colors"
                              placeholder="Item name..."
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              disabled={isReadOnly}
                              value={item.quantity || ""}
                              onChange={(e) => handleUpdateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-neutral-200 focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500 rounded text-sm font-mono transition-colors"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              disabled={isReadOnly}
                              value={item.unit}
                              onChange={(e) => handleUpdateItem(index, "unit", e.target.value)}
                              className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-neutral-200 focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500 rounded text-sm transition-colors"
                              placeholder="ea, lb..."
                            />
                          </td>
                          <td className="px-3 py-2 hidden sm:table-cell relative">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              disabled={isReadOnly}
                              value={item.estimatedPrice || ""}
                              onChange={(e) => handleUpdateItem(index, "estimatedPrice", parseFloat(e.target.value) || 0)}
                              className="w-full pl-6 pr-2 py-1.5 bg-transparent border border-transparent hover:border-neutral-200 focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500 rounded text-sm font-mono transition-colors"
                            />
                          </td>
                          {!isReadOnly && (
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {templateItems.length === 0 && (
                        <tr>
                          <td colSpan={isReadOnly ? 4 : 5} className="px-4 py-8 text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-neutral-100 mb-3">
                              <ShoppingCart className="w-6 h-6 text-neutral-400" />
                            </div>
                            <p className="text-sm font-bold text-neutral-900">No template items yet</p>
                            <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
                              Add items to this template to pre-fill your future orders with this vendor automatically.
                            </p>
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={handleAddItem}
                                className="mt-4 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1"
                              >
                                <Plus className="w-4 h-4" /> Add First Item
                              </button>
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <datalist id="ingredient-list-template-view">
                  {ingredients.map(ing => (
                    <option key={ing.id} value={ing.name} />
                  ))}
                </datalist>
              </div>
            </div>
          ) : (
            <div className="bg-neutral-50 border-2 border-dashed border-neutral-200 rounded-xl h-[600px] flex items-center justify-center text-center p-6">
              <div>
                <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto mb-4 text-neutral-300">
                  <FileText className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-neutral-900">No Vendor Selected</h3>
                <p className="text-sm text-neutral-500 mt-1 max-w-sm mx-auto">
                  Select a vendor from the list on the left to view and manage their order template.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
