import React, { useState } from 'react';
import { Vendor, Ingredient, OrderListItem } from '../types';
import { FileText } from 'lucide-react';
import { getNormalizedVendorKey } from '../lib/vendorUtils';
import { Building2, Search, Plus, MapPin, Phone, Mail, Edit, Trash2, Check, X } from 'lucide-react';
import { STANDARD_VENDORS } from '../constants/vendors';

interface VendorsViewProps {
  vendors: Vendor[];
  ingredients: Ingredient[];
  isReadOnly: boolean;
  onAddVendor: (vendor: Omit<Vendor, "id" | "ownerId" | "createdAt">, oldName?: string) => Promise<void>;
  onEditVendor: (id: string, vendor: Partial<Vendor>, oldName?: string) => Promise<void>;
  onDeleteVendor: (id: string, name: string, isRegistered?: boolean) => Promise<void>;
  onSeedVendors?: () => Promise<void>;
}

export function VendorsView({ vendors, ingredients, isReadOnly, onAddVendor, onEditVendor, onDeleteVendor, onSeedVendors }: VendorsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editOriginalName, setEditOriginalName] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);


  const [templateVendor, setTemplateVendor] = useState<Vendor | null>(null);
  const [templateItems, setTemplateItems] = useState<OrderListItem[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    contactName: "",
    phone: "",
    email: "",
    address: "",
    note: ""
  });

  const [deletedVendorKeys, setDeletedVendorKeys] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("deleted_vendors");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Calculate stats per vendor
  const vendorStats = React.useMemo(() => {
    const combinedVendors = new Map<string, any>();
    const deletedLower = new Set(deletedVendorKeys.map(k => k.toLowerCase()));

    // 1. Add vendors from the collection
    vendors.forEach(v => {
      const key = getNormalizedVendorKey(v.name);
      if (key && !deletedLower.has(key)) {
        combinedVendors.set(key, {
          ...v,
          isRegistered: true,
          itemsSupplied: 0,
          fallbackItems: v.itemsSupplied || 0,
        });
      }
    });

    // 2. Add standard suppliers if not yet created or deleted
    STANDARD_VENDORS.forEach(sv => {
      const key = getNormalizedVendorKey(sv.name);
      if (key && !deletedLower.has(key) && !combinedVendors.has(key)) {
        combinedVendors.set(key, {
          id: `standard-${key.replace(/[^a-z0-9]/g, "-")}`,
          name: sv.name,
          contactName: sv.contactName || "",
          phone: sv.phone || "",
          email: sv.email || "",
          address: sv.address || "",
          note: sv.note || "",
          ownerId: "standard",
          isRegistered: true,
          itemsSupplied: 0,
          fallbackItems: sv.itemsSupplied || 0,
        });
      }
    });

    // 3. Add vendors from ingredients
    ingredients.forEach(i => {
      let vendorName = "";
      if (i.vendor && i.vendor.trim() !== "") {
        vendorName = i.vendor.trim();
      } else if (i.source && i.source.includes("(")) {
        const parts = i.source.split("(");
        if (parts.length > 1) {
          vendorName = parts[1].replace(")", "").trim();
        }
      }

      if (vendorName) {
        const key = getNormalizedVendorKey(vendorName);
        if (key && !deletedLower.has(key)) {
          if (!combinedVendors.has(key)) {
            combinedVendors.set(key, {
              id: `auto-${key}`,
              name: vendorName,
              contactName: "",
              phone: "",
              email: "",
              address: "",
              note: "Auto-generated from Inventory Ledger.",
              ownerId: "auto",
              isRegistered: false,
              itemsSupplied: 0,
              fallbackItems: 0,
            });
          }
          
          const v = combinedVendors.get(key);
          v.itemsSupplied += 1;
        }
      }
    });

    return Array.from(combinedVendors.values())
      .map(v => ({
        ...v,
        itemsSupplied: v.itemsSupplied > 0 ? v.itemsSupplied : (v.fallbackItems || 0),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [vendors, ingredients, deletedVendorKeys]);

  const filteredVendors = vendorStats.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.contactName && v.contactName.toLowerCase().includes(searchTerm.toLowerCase()))
  );


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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !formData.name.trim()) return;

    const key = getNormalizedVendorKey(formData.name);
    if (key) {
      setDeletedVendorKeys(prev => {
        const next = prev.filter(k => k !== key);
        try {
          localStorage.setItem("deleted_vendors", JSON.stringify(next));
        } catch {}
        return next;
      });
    }

    if (editId && !editId.startsWith("auto-") && !editId.startsWith("standard-")) {
      await onEditVendor(editId, {
        name: formData.name,
        contactName: formData.contactName,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        note: formData.note
      }, editOriginalName || undefined);
      setEditId(null);
      setEditOriginalName(null);
    } else {
      await onAddVendor({
        name: formData.name,
        contactName: formData.contactName,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        note: formData.note
      }, editOriginalName || undefined);
      setEditId(null);
      setEditOriginalName(null);
    }

    setFormData({
      name: "",
      contactName: "",
      phone: "",
      email: "",
      address: "",
      note: ""
    });
    setShowAddForm(false);
  };

  const handleEditClick = (vendor: Vendor) => {
    setFormData({
      name: vendor.name,
      contactName: vendor.contactName || "",
      phone: vendor.phone || "",
      email: vendor.email || "",
      address: vendor.address || "",
      note: vendor.note || ""
    });
    setEditId(vendor.id || null);
    setEditOriginalName(vendor.name);
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleConfirmDelete = async (vendor: Vendor) => {
    setConfirmDeleteId(null);
    if (isReadOnly) return;
    const key = getNormalizedVendorKey(vendor.name);
    if (key) {
      setDeletedVendorKeys(prev => {
        const next = [...new Set([...prev, key])];
        try {
          localStorage.setItem("deleted_vendors", JSON.stringify(next));
        } catch {}
        return next;
      });
    }
    await onDeleteVendor(vendor.id!, vendor.name, vendor.isRegistered);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 font-mono flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Supplier Directory
          </h2>
          <p className="text-sm text-neutral-500 font-sans mt-1">Manage vendor contacts and supplier information.</p>
        </div>
        {!isReadOnly && (
          <div className="flex items-center gap-2">
            {onSeedVendors && (
              <button
                type="button"
                onClick={async () => {
                  setDeletedVendorKeys([]);
                  try {
                    localStorage.removeItem("deleted_vendors");
                  } catch {}
                  await onSeedVendors();
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 text-emerald-600" />
                Restore Default Suppliers
              </button>
            )}
            <button
              onClick={() => {
                setFormData({ name: "", contactName: "", phone: "", email: "", address: "", note: "" });
                setEditId(null);
                setShowAddForm(!showAddForm);
              }}
              className="bg-emerald-600 hover:bg-neutral-800 text-white px-4 py-2 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer rounded-xl"
            >
              {showAddForm ? (
                <>
                  <X className="h-4 w-4" /> Cancel
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Add Vendor
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {showAddForm && !isReadOnly && (
        <div className="bg-[#fcfbf9] border border-neutral-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-neutral-900 font-mono border-b border-neutral-200/10 pb-3 mb-4">
            {editId ? "Edit Vendor Profile" : "Create New Vendor"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-neutral-700 mb-1 font-mono">
                  Company / Vendor Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-800 rounded-xl focus:outline-none focus:ring-0"
                  placeholder="e.g. Sysco, Fancy Foods"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-700 mb-1 font-mono">
                  Contact Person
                </label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                  className="w-full bg-white border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-800 rounded-xl focus:outline-none focus:ring-0"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-700 mb-1 font-mono">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-white border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-800 rounded-xl focus:outline-none focus:ring-0"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-700 mb-1 font-mono">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-white border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-800 rounded-xl focus:outline-none focus:ring-0"
                  placeholder="orders@vendor.com"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-neutral-700 mb-1 font-mono">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-white border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-800 rounded-xl focus:outline-none focus:ring-0"
                  placeholder="123 Warehouse Row, City, ST 12345"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-neutral-700 mb-1 font-mono">
                  Notes / Internal Information
                </label>
                <textarea
                  value={formData.note}
                  onChange={e => setFormData({ ...formData, note: e.target.value })}
                  className="w-full bg-white border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-800 rounded-xl focus:outline-none focus:ring-0 min-h-[80px]"
                  placeholder="Delivery days, payment terms..."
                />
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-neutral-800 text-white px-5 py-2.5 text-xs font-bold transition-colors flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                {editId ? "Update Vendor" : "Save Vendor"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search and List */}
      <div className="bg-white border border-neutral-200 overflow-hidden">
        <div className="p-4 border-b border-neutral-200 bg-[#fcfbf9]">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search vendors by name or contact..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-neutral-200 pl-9 pr-4 py-2 text-xs font-bold text-neutral-800 rounded-xl focus:outline-none focus:ring-0"
            />
          </div>
        </div>

        {filteredVendors.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 font-sans border-t border-neutral-100">
            <Building2 className="h-10 w-10 mx-auto text-neutral-300 mb-3" />
            <p className="font-bold tracking-wide text-xs">No Vendors Found</p>
            <p className="text-[11px] text-neutral-400 mt-1 max-w-sm mx-auto mb-4">
              There are no vendor profiles matching your search. Try adding a new vendor or clearing your search filters.
            </p>
            {!isReadOnly && onSeedVendors && (
              <button
                onClick={async () => {
                  setDeletedVendorKeys([]);
                  try {
                    localStorage.removeItem("deleted_vendors");
                  } catch {}
                  await onSeedVendors();
                }}
                className="bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                Restore Default Suppliers
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
            {filteredVendors.map((vendor, index) => (
              <div 
                key={vendor.id} 
                className={`p-5 flex flex-col justify-between border-b border-neutral-200/10 ${index % 3 !== 2 ? 'lg:border-r' : ''} ${index % 2 !== 1 ? 'md:border-r lg:border-r-0' : ''}`}
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-sm font-bold text-neutral-900 font-mono truncate pr-4" title={vendor.name}>
                      {vendor.name}
                    </h4>
                    <span className="shrink-0 bg-neutral-100 text-neutral-600 text-[9px] font-mono px-2 py-0.5 rounded-full border border-neutral-200">
                      {vendor.itemsSupplied} Items
                    </span>
                  </div>
                  
                  <div className="space-y-2 mt-4 text-xs font-sans text-neutral-600">
                    {vendor.contactName && (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-400">CONTACT:</span>
                        <span className="truncate">{vendor.contactName}</span>
                      </div>
                    )}
                    {vendor.phone && (
                      <div className="flex items-center gap-2 text-blue-700">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span className="truncate">{vendor.phone}</span>
                      </div>
                    )}
                    {vendor.email && (
                      <div className="flex items-center gap-2 text-blue-700">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{vendor.email}</span>
                      </div>
                    )}
                    {vendor.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                        <span className="line-clamp-2 leading-tight">{vendor.address}</span>
                      </div>
                    )}
                    {vendor.note && (
                      <div className="mt-3 pt-3 border-t border-neutral-100">
                        <p className="text-[10px] text-neutral-500 italic line-clamp-3 leading-snug">
                          "{vendor.note}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {!isReadOnly && (
                  <div className="flex gap-2 mt-6 pt-4 border-t border-neutral-100">
                    {confirmDeleteId === vendor.id ? (
                      <div className="flex-1 flex flex-col gap-2">
                        <p className="text-[10px] text-red-600 font-bold text-center">Are you sure?</p>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleConfirmDelete(vendor)}
                            className="flex-1 bg-red-600 text-white hover:bg-red-700 py-1.5 text-[10px] font-bold transition-colors"
                          >
                            Yes, delete
                          </button>
                          <button 
                            onClick={() => setConfirmDeleteId(null)}
                            className="flex-1 bg-white border border-neutral-200 text-neutral-900 hover:bg-neutral-100 py-1.5 text-[10px] font-bold transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleEditClick(vendor)}
                          className="flex-1 bg-white border border-neutral-200 text-neutral-900 hover:bg-emerald-600 hover:text-white py-1.5 text-[10px] font-bold transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Edit className="h-3 w-3" /> Edit
                        </button>
                        <button 
                          onClick={() => setConfirmDeleteId(vendor.id!)}
                          className="px-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 py-1.5 transition-colors flex items-center justify-center"
                          title="Delete Vendor"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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
                          ${((item.quantity || 0) * (item.estimatedPrice || 0)).toFixed(2)}
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
    </div>
  );
}
