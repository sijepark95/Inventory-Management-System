import React, { useState } from 'react';
import { Department } from '../types';
import { Building2, Search, Plus, Edit, Trash2, Check, X } from 'lucide-react';
import { STANDARD_DEPARTMENTS } from '../constants/departments';

interface DepartmentsViewProps {
  departments: Department[];
  isReadOnly: boolean;
  onAddDepartment: (department: Omit<Department, "id" | "ownerId" | "createdAt">, oldName?: string) => Promise<void>;
  onEditDepartment: (id: string, department: Partial<Department>, oldName?: string) => Promise<void>;
  onDeleteDepartment: (id: string) => Promise<void>;
}

export function DepartmentsView({ departments, isReadOnly, onAddDepartment, onEditDepartment, onDeleteDepartment }: DepartmentsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [oldName, setOldName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const filteredDepartments = departments.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editId) {
      await onEditDepartment(editId, formData, oldName);
    } else {
      await onAddDepartment(formData);
    }

    setShowAddForm(false);
    setEditId(null);
    setFormData({ name: "", description: "" });
  };

  const handleEditClick = (department: Department) => {
    setEditId(department.id!);
    setOldName(department.name);
    setFormData({
      name: department.name,
      description: department.description || "",
    });
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleConfirmDelete = async (department: Department) => {
    await onDeleteDepartment(department.id!);
    setConfirmDeleteId(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-neutral-900 tracking-tight">Departments Directory</h2>
          <p className="text-sm font-medium text-neutral-500 mt-1">
            Manage operational departments for recipes and timesheets.
          </p>
        </div>
        {!isReadOnly && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditId(null);
                setFormData({ name: "", description: "" });
                setShowAddForm(!showAddForm);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                showAddForm 
                  ? "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                  : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
              }`}
            >
              {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showAddForm ? "Cancel" : "Add Department"}
            </button>
          </div>
        )}
      </div>

      {showAddForm && !isReadOnly && (
        <div className="bg-white border border-neutral-200 p-5 rounded-none shadow-xs mb-6">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-600" />
              {editId ? "Edit Department" : "New Department Profile"}
            </h3>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-neutral-700 mb-1 font-mono">
                  Department Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-800 rounded-xl focus:outline-none focus:ring-0"
                  placeholder="e.g. Kitchen, Bar..."
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-700 mb-1 font-mono">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-white border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-800 rounded-xl focus:outline-none focus:ring-0"
                  placeholder="Optional description"
                />
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-neutral-800 text-white px-5 py-2.5 text-xs font-bold transition-colors flex items-center gap-2 rounded-xl"
              >
                <Check className="h-4 w-4" />
                {editId ? "Update Department" : "Save Department"}
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
              placeholder="Search departments..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-neutral-200 pl-9 pr-4 py-2 text-xs font-bold text-neutral-800 rounded-xl focus:outline-none focus:ring-0"
            />
          </div>
        </div>

        {filteredDepartments.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 font-sans border-t border-neutral-100">
            <Building2 className="h-10 w-10 mx-auto text-neutral-300 mb-3" />
            <p className="font-bold tracking-wide text-xs">No Departments Found</p>
            <p className="text-[11px] text-neutral-400 mt-1 max-w-sm mx-auto">
              There are no departments matching your search.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-0">
            {filteredDepartments.map((department, index) => (
              <div 
                key={department.id} 
                className={`p-5 flex flex-col justify-between border-b border-neutral-200/10 ${index % 4 !== 3 ? 'lg:border-r' : ''} ${index % 3 !== 2 ? 'md:border-r lg:border-r-0' : ''}`}
              >
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 font-mono truncate" title={department.name}>
                    {department.name}
                  </h4>
                  {department.description && (
                    <p className="text-[11px] text-neutral-500 mt-2 line-clamp-2 leading-snug">
                      {department.description}
                    </p>
                  )}
                </div>
                {!isReadOnly && (
                  <div className="flex gap-2 mt-6 pt-4 border-t border-neutral-100">
                    {confirmDeleteId === department.id ? (
                      <div className="flex-1 flex flex-col gap-2">
                        <p className="text-[10px] text-red-600 font-bold text-center">Are you sure?</p>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleConfirmDelete(department)}
                            className="flex-1 bg-red-600 text-white hover:bg-red-700 py-1.5 text-[10px] font-bold rounded-lg transition-colors"
                          >
                            Yes
                          </button>
                          <button 
                            onClick={() => setConfirmDeleteId(null)}
                            className="flex-1 bg-white border border-neutral-200 text-neutral-900 hover:bg-neutral-100 py-1.5 text-[10px] font-bold rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleEditClick(department)}
                          className="flex-1 bg-white border border-neutral-200 text-neutral-900 hover:bg-emerald-600 hover:text-white rounded-lg py-1.5 text-[10px] font-bold transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Edit className="h-3 w-3" /> Edit
                        </button>
                        <button 
                          onClick={() => setConfirmDeleteId(department.id!)}
                          className="px-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-lg py-1.5 transition-colors flex items-center justify-center"
                          title="Delete Department"
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
