export interface StandardVendorDef {
  name: string;
  phone?: string;
  note?: string;
  itemsSupplied?: number;
  contactName?: string;
  email?: string;
  address?: string;
}

export const STANDARD_VENDORS: StandardVendorDef[] = [
  {
    name: "A & J PRODUCE CORP.",
    itemsSupplied: 20,
    phone: "",
    note: "",
  },
  {
    name: "A&J PRODUCE",
    itemsSupplied: 32,
    phone: "",
    note: "",
  },
  {
    name: "ALL BREAD",
    itemsSupplied: 32,
    phone: "",
    note: "MON-SAT DELIVERY",
  },
  {
    name: "BARTLETT DAIRY",
    itemsSupplied: 13,
    phone: "",
    note: "Auto-generated from Inventory Ledger.",
  },
  {
    name: "Bilal (Union)",
    itemsSupplied: 0,
    phone: "",
    note: "",
  },
  {
    name: "BOSSEN",
    itemsSupplied: 1,
    phone: "",
    note: "",
  },
  {
    name: "Default / Unassigned",
    itemsSupplied: 4,
    phone: "",
    note: "Auto-generated from Inventory Ledger.",
  },
  {
    name: "FANCY FOODS",
    itemsSupplied: 3,
    phone: "",
    note: "Auto-generated from Inventory Ledger.",
  },
  {
    name: "Food Bazaar Supermarket",
    itemsSupplied: 3,
    phone: "",
    note: "",
  },
  {
    name: "FOODDIRECT, INC",
    itemsSupplied: 0,
    phone: "",
    note: "",
  },
  {
    name: "FOODIRECT, INC",
    itemsSupplied: 8,
    phone: "",
    note: "",
  },
  {
    name: "GIANT FOOD SYSTEM",
    itemsSupplied: 140,
    phone: "",
    note: "Auto-generated from Inventory Ledger.",
  },
  {
    name: "HARNEY AND SONS TEA",
    itemsSupplied: 0,
    phone: "",
    note: "",
  },
  {
    name: "J. & A. RIZZO PROVISIONS",
    itemsSupplied: 11,
    phone: "",
    note: "",
  },
  {
    name: "J&A RIZZO",
    itemsSupplied: 0,
    phone: "",
    note: "THUR DELIVERY",
  },
  {
    name: "Jetro Cash & Carry",
    itemsSupplied: 0,
    phone: "",
    note: "",
  },
  {
    name: "LILY PRODUCE",
    itemsSupplied: 37,
    phone: "",
    note: "Auto-generated from Inventory Ledger.",
  },
  {
    name: "NEBRASKA",
    itemsSupplied: 13,
    phone: "",
    note: "Auto-generated from Inventory Ledger.",
  },
  {
    name: "OUT OF THE BLUE",
    itemsSupplied: 7,
    phone: "",
    note: "Auto-generated from Inventory Ledger.",
  },
  {
    name: "PEIMCO",
    itemsSupplied: 8,
    phone: "",
    note: "Auto-generated from Inventory Ledger.",
  },
  {
    name: "PLYMOUTH BEEF",
    itemsSupplied: 3,
    phone: "718-589-8600",
    note: "Auto-generated from Inventory Ledger.",
  },
  {
    name: "Restaurant Depot",
    itemsSupplied: 0,
    phone: "",
    note: "",
  },
  {
    name: "SYSCO",
    itemsSupplied: 50,
    phone: "",
    note: "Auto-generated from Inventory Ledger.",
  },
  {
    name: "Tony's Fish & Seafood Corp.",
    itemsSupplied: 1,
    phone: "",
    note: "",
  },
  {
    name: "unassigned",
    itemsSupplied: 33,
    phone: "",
    note: "Auto-generated from Inventory Ledger.",
  },
  {
    name: "US BEEF",
    itemsSupplied: 3,
    phone: "",
    note: "",
  },
  {
    name: "WHOLE FOODS MARKET",
    itemsSupplied: 1,
    phone: "",
    note: "",
  },
  {
    name: "YOUNG FISH",
    itemsSupplied: 56,
    phone: "",
    note: "MON, THUR DELIVERY - SUSHI",
  },
];

export const STANDARD_VENDOR_NAMES: string[] = STANDARD_VENDORS.map(v => v.name);
