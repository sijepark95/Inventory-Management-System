import React, { useState } from 'react';
import { Restaurant } from '../types';
import { Search, Plus, MapPin, Phone, Mail, Edit, Trash2, Check, X, Store } from 'lucide-react';

interface RestaurantsViewProps {
  restaurants: Restaurant[];
  isReadOnly: boolean;
  onAddRestaurant: (restaurant: Omit<Restaurant, "id" | "ownerId" | "createdAt">, oldName?: string) => Promise<void>;
  onEditRestaurant: (id: string, restaurant: Partial<Restaurant>, oldName?: string) => Promise<void>;
  onDeleteRestaurant: (id: string) => Promise<void>;
  onSeedRestaurants?: () => Promise<void>;
}

export function RestaurantsView({ restaurants, isReadOnly, onAddRestaurant, onEditRestaurant, onDeleteRestaurant, onSeedRestaurants }: RestaurantsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [oldName, setOldName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    contactName: "",
    phone: "",
    email: "",
    address: "",
  });

  const filteredRestaurants = restaurants.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.contactName && r.contactName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editId) {
      await onEditRestaurant(editId, formData, oldName);
    } else {
      await onAddRestaurant(formData);
    }

    setShowAddForm(false);
    setEditId(null);
    setFormData({ name: "", contactName: "", phone: "", email: "", address: "" });
  };

  const handleEditClick = (restaurant: Restaurant) => {
    setEditId(restaurant.id!);
    setOldName(restaurant.name);
    setFormData({
      name: restaurant.name,
      contactName: restaurant.contactName || "",
      phone: restaurant.phone || "",
      email: restaurant.email || "",
      address: restaurant.address || "",
    });
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleConfirmDelete = async (restaurant: Restaurant) => {
    await onDeleteRestaurant(restaurant.id!);
    setConfirmDeleteId(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-neutral-900 tracking-tight">Restaurants Directory</h2>
          <p className="text-sm font-medium text-neutral-500 mt-1">
            Manage your restaurants/locations for inventory tracking.
          </p>
        </div>
        {!isReadOnly && (
          <button
            onClick={() => {
              setEditId(null);
              setFormData({ name: "", contactName: "", phone: "", email: "", address: "" });
              setShowAddForm(!showAddForm);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all ${
              showAddForm 
                ? "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
            }`}
          >
            {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showAddForm ? "Cancel" : "Add Restaurant"}
          </button>
        )}
      </div>

      {showAddForm && !isReadOnly && (
        <div className="bg-white border border-neutral-200 p-5 rounded-none shadow-xs mb-6">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <Store className="h-4 w-4 text-emerald-600" />
              {editId ? "Edit Restaurant" : "New Restaurant Profile"}
            </h3>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-neutral-700 mb-1 font-mono">
                  Restaurant Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-800 rounded-xl focus:outline-none focus:ring-0"
                  placeholder="e.g. Downtown Location..."
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-700 mb-1 font-mono">
                  Contact Name
                </label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                  className="w-full bg-white border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-800 rounded-xl focus:outline-none focus:ring-0"
                  placeholder="Store Manager Name"
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
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-white border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-800 rounded-xl focus:outline-none focus:ring-0"
                  placeholder="manager@location.com"
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
                  placeholder="123 Main St, City, ST 12345"
                />
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-neutral-800 text-white px-5 py-2.5 text-xs font-bold transition-colors flex items-center gap-2 rounded-xl"
              >
                <Check className="h-4 w-4" />
                {editId ? "Update Restaurant" : "Save Restaurant"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-neutral-200 overflow-hidden rounded-xl">
        <div className="p-4 border-b border-neutral-200 bg-[#fcfbf9]">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search restaurants..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-neutral-200 pl-9 pr-4 py-2 text-xs font-bold text-neutral-800 rounded-xl focus:outline-none focus:ring-0"
            />
          </div>
        </div>

        {filteredRestaurants.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 font-sans border-t border-neutral-100">
            <Store className="h-10 w-10 mx-auto text-neutral-300 mb-3" />
            <p className="font-bold tracking-wide text-xs">No Restaurants Found</p>
            <p className="text-[11px] text-neutral-400 mt-1 max-w-sm mx-auto mb-4">
              There are no restaurant profiles matching your search.
            </p>
            {!isReadOnly && restaurants.length === 0 && onSeedRestaurants && (
              <button
                onClick={onSeedRestaurants}
                className="bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <Plus className="h-3 w-3" />
                Restore Default Restaurants
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
            {filteredRestaurants.map((restaurant, index) => (
              <div 
                key={restaurant.id} 
                className={`p-5 flex flex-col justify-between border-b border-neutral-200/10 ${index % 3 !== 2 ? 'lg:border-r' : ''} ${index % 2 !== 1 ? 'md:border-r lg:border-r-0' : ''}`}
              >
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 font-mono truncate pr-4" title={restaurant.name}>
                    {restaurant.name}
                  </h4>
                  <div className="space-y-2 mt-4 text-xs font-sans text-neutral-600">
                    {restaurant.contactName && (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-400">CONTACT:</span>
                        <span className="truncate">{restaurant.contactName}</span>
                      </div>
                    )}
                    {restaurant.phone && (
                      <div className="flex items-center gap-2 text-blue-700">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span className="truncate">{restaurant.phone}</span>
                      </div>
                    )}
                    {restaurant.email && (
                      <div className="flex items-center gap-2 text-blue-700">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{restaurant.email}</span>
                      </div>
                    )}
                    {restaurant.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                        <span className="line-clamp-2 leading-tight">{restaurant.address}</span>
                      </div>
                    )}
                  </div>
                </div>
                {!isReadOnly && (
                  <div className="flex gap-2 mt-6 pt-4 border-t border-neutral-100">
                    {confirmDeleteId === restaurant.id ? (
                      <div className="flex-1 flex flex-col gap-2">
                        <p className="text-[10px] text-red-600 font-bold text-center">Are you sure?</p>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleConfirmDelete(restaurant)}
                            className="flex-1 bg-red-600 text-white hover:bg-red-700 py-1.5 text-[10px] font-bold transition-colors rounded-lg"
                          >
                            Yes
                          </button>
                          <button 
                            onClick={() => setConfirmDeleteId(null)}
                            className="flex-1 bg-white border border-neutral-200 text-neutral-900 hover:bg-neutral-100 py-1.5 text-[10px] font-bold transition-colors rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleEditClick(restaurant)}
                          className="flex-1 bg-white border border-neutral-200 text-neutral-900 hover:bg-emerald-600 hover:text-white py-1.5 text-[10px] font-bold transition-colors flex items-center justify-center gap-1.5 rounded-lg"
                        >
                          <Edit className="h-3 w-3" /> Edit
                        </button>
                        <button 
                          onClick={() => setConfirmDeleteId(restaurant.id!)}
                          className="px-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 py-1.5 transition-colors flex items-center justify-center rounded-lg"
                          title="Delete Restaurant"
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
    </div>
  );
}
