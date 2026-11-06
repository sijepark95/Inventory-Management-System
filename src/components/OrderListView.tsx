import React, { useState, useMemo } from "react";
import { Plus, Search, FileText, Check, Clock, AlertCircle, Edit2, Trash2, X, Building2, Calendar, ShoppingCart, Send } from "lucide-react";
import { OrderList, Vendor, Ingredient, OrderListItem } from "../types";

interface OrderListViewProps {
  orderLists: OrderList[];
  vendors: Vendor[];
  ingredients: Ingredient[];
  onAddOrderList: (orderList: Omit<OrderList, "id" | "createdAt" | "ownerId">) => Promise<void>;
  onUpdateOrderList: (id: string, updates: Partial<OrderList>) => Promise<void>;
  onDeleteOrderList: (id: string) => Promise<void>;
  isReadOnly: boolean;
}

export const OrderListView: React.FC<OrderListViewProps> = ({
  orderLists,
  vendors,
  ingredients,
  onAddOrderList,
  onUpdateOrderList,
  onDeleteOrderList,
  isReadOnly
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showModal, setShowModal] = useState(false);
  const [editingOrderList, setEditingOrderList] = useState<OrderList | null>(null);

  const [formData, setFormData] = useState<{
    vendorName: string;
    expectedDeliveryDate: string;
    status: OrderList["status"];
    notes: string;
    items: OrderListItem[];
  }>({
    vendorName: "",
    expectedDeliveryDate: "",
    status: "draft",
    notes: "",
    items: []
  });

  const filteredOrderLists = useMemo(() => {
    return orderLists.filter(ol => {
      const matchesSearch = ol.vendorName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            ol.notes?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || ol.status === statusFilter;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime());
  }, [orderLists, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    return {
      draft: orderLists.filter(o => o.status === "draft").length,
      ordered: orderLists.filter(o => o.status === "ordered").length,
      received: orderLists.filter(o => o.status === "received").length,
    };
  }, [orderLists]);

  const handleOpenModal = (orderList?: OrderList) => {
    if (orderList) {
      setEditingOrderList(orderList);
      setFormData({
        vendorName: orderList.vendorName || "",
        expectedDeliveryDate: orderList.expectedDeliveryDate || "",
        status: orderList.status || "draft",
        notes: orderList.notes || "",
        items: orderList.items ? [...orderList.items] : []
      });
    } else {
      setEditingOrderList(null);
      setFormData({
        vendorName: "",
        expectedDeliveryDate: new Date().toISOString().split('T')[0],
        status: "draft",
        notes: "",
        items: []
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const vendor = vendors.find(v => v.name === formData.vendorName);
    const totalEstimatedCost = formData.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.estimatedPrice || 0)), 0);

    const payload = {
      vendorName: formData.vendorName,
      vendorId: vendor?.id || "",
      expectedDeliveryDate: formData.expectedDeliveryDate,
      status: formData.status,
      notes: formData.notes,
      items: formData.items,
      totalEstimatedCost
    };

    if (editingOrderList && editingOrderList.id) {
      await onUpdateOrderList(editingOrderList.id, payload);
    } else {
      await onAddOrderList(payload);
    }
    setShowModal(false);
  };


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

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: "", quantity: 1, unit: "ea", estimatedPrice: 0 }]
    }));
  };

  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateItem = (index: number, field: keyof OrderListItem, value: any) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      
      // Try to autofill unit/price based on ingredient selection
      if (field === 'name') {
        const ingredient = ingredients.find(i => i.name === value);
        if (ingredient) {
          newItems[index].unit = ingredient.unit || "ea";
          newItems[index].estimatedPrice = ingredient.price || 0;
          newItems[index].ingredientId = ingredient.id;
        }
      }
      
      return { ...prev, items: newItems };
    });
  };

  const getStatusBadge = (status: OrderList["status"]) => {
    switch (status) {
      case "draft":
        return <span className="px-2 py-1 rounded bg-neutral-100 text-neutral-800 text-[10px] font-bold flex items-center gap-1"><Edit2 className="w-3 h-3"/> Draft</span>;
      case "ordered":
        return <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-[10px] font-bold flex items-center gap-1"><Send className="w-3 h-3"/> Ordered</span>;
      case "received":
        return <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1"><Check className="w-3 h-3"/> Received</span>;
      case "cancelled":
        return <span className="px-2 py-1 rounded bg-red-100 text-red-800 text-[10px] font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Cancelled</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-neutral-900">Make Order List</h2>
          <p className="text-xs sm:text-sm text-neutral-500">Create, manage, and track purchase orders with your suppliers.</p>
        </div>
        {!isReadOnly && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Order List
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600">
            <Edit2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-neutral-400 block">Draft Orders</span>
            <span className="text-lg font-bold text-neutral-900 font-mono">{stats.draft}</span>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-neutral-400 block">Sent / Ordered</span>
            <span className="text-lg font-bold text-blue-600 font-mono">{stats.ordered}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Check className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-neutral-400 block">Received Orders</span>
            <span className="text-lg font-bold text-emerald-600 font-mono">{stats.received}</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-neutral-200 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by vendor or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="ordered">Ordered</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500 font-bold border-b border-neutral-200">
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Delivery Date</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3 text-right">Est. Total</th>
                <th className="px-4 py-3 text-center">Status</th>
                {!isReadOnly && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredOrderLists.length === 0 ? (
                <tr>
                  <td colSpan={isReadOnly ? 6 : 7} className="px-4 py-8 text-center text-neutral-400">
                    <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                    <p className="text-sm">No order lists found</p>
                  </td>
                </tr>
              ) : (
                filteredOrderLists.map(ol => (
                  <tr key={ol.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-neutral-400" />
                        <span className="font-bold text-neutral-900 text-sm">{ol.vendorName || "Unknown Vendor"}</span>
                      </div>
                      {ol.notes && <p className="text-xs text-neutral-500 truncate max-w-[200px] mt-0.5">{ol.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 font-mono text-xs">
                      {ol.createdAt ? new Date(ol.createdAt).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 font-mono text-xs">
                      {ol.expectedDeliveryDate || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-neutral-100 text-neutral-600 text-xs font-bold">
                        {ol.items?.length || 0} items
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-neutral-900">
                      ${(ol.totalEstimatedCost || 0).toLocaleString(undefined, {minimumFractionDigits:2})}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">{getStatusBadge(ol.status)}</div>
                    </td>
                    {!isReadOnly && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleOpenModal(ol)} className="p-1.5 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => { if(window.confirm('Delete order list?')) onDeleteOrderList(ol.id!); }} className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Order List Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-neutral-100 bg-neutral-50/50">
              <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
                {editingOrderList ? "Edit Order List" : "Create Order List"}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Vendor</label>
                  <input
                    type="text"
                    required
                    list="vendor-list-orders"
                    value={formData.vendorName}
                    onChange={handleVendorChange}
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    placeholder="Select Vendor..."
                  />
                  <datalist id="vendor-list-orders">
                    {vendors.map(v => (
                      <option key={v.id} value={v.name} />
                    ))}
                  </datalist>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Expected Delivery</label>
                  <input
                    type="date"
                    value={formData.expectedDeliveryDate}
                    onChange={(e) => setFormData({...formData, expectedDeliveryDate: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as OrderList["status"]})}
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    <option value="draft">Draft</option>
                    <option value="ordered">Ordered</option>
                    <option value="received">Received</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">Order Items</label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
                </div>
                
                <div className="border border-neutral-200 rounded-xl overflow-hidden bg-neutral-50">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-100/50 border-b border-neutral-200">
                      <tr>
                        <th className="px-3 py-2 text-xs font-bold text-neutral-500 uppercase">Item / Ingredient</th>
                        <th className="px-3 py-2 text-xs font-bold text-neutral-500 uppercase w-24">Qty</th>
                        <th className="px-3 py-2 text-xs font-bold text-neutral-500 uppercase w-24">Unit</th>
                        <th className="px-3 py-2 text-xs font-bold text-neutral-500 uppercase w-32">Est. Price</th>
                        <th className="px-3 py-2 text-xs font-bold text-neutral-500 uppercase w-32">Total</th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {formData.items.map((item, index) => (
                        <tr key={index} className="bg-white">
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              required
                              list="ingredient-list-orders"
                              value={item.name}
                              onChange={(e) => handleUpdateItem(index, "name", e.target.value)}
                              className="w-full px-2 py-1.5 bg-transparent border border-neutral-200 rounded text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                              placeholder="Item name..."
                            />
                            <datalist id="ingredient-list-orders">
                              {ingredients.map(ing => (
                                <option key={ing.id} value={ing.name} />
                              ))}
                            </datalist>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              value={item.quantity || ""}
                              onChange={(e) => handleUpdateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 bg-transparent border border-neutral-200 rounded text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.unit}
                              onChange={(e) => handleUpdateItem(index, "unit", e.target.value)}
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
                              onChange={(e) => handleUpdateItem(index, "estimatedPrice", parseFloat(e.target.value) || 0)}
                              className="w-full pl-6 pr-2 py-1.5 bg-transparent border border-neutral-200 rounded text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                            />
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-neutral-900 text-sm">
                            ${((item.quantity || 0) * (item.estimatedPrice || 0)).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {formData.items.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-sm text-neutral-400">
                            No items added yet. Click "Add Item" to start building your order list.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {formData.items.length > 0 && (
                      <tfoot className="bg-neutral-50 border-t border-neutral-200">
                        <tr>
                          <td colSpan={4} className="px-3 py-3 text-right text-sm font-bold text-neutral-600">
                            Estimated Total:
                          </td>
                          <td className="px-3 py-3 font-mono font-bold text-emerald-600 text-base">
                            ${formData.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.estimatedPrice || 0)), 0).toFixed(2)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Internal Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[80px]"
                  placeholder="Additional details, delivery instructions, etc..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-bold text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {editingOrderList ? "Save Changes" : "Create Order List"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
