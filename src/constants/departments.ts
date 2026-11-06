export interface StandardDepartmentDef {
  name: string;
  description?: string;
}

export const STANDARD_DEPARTMENTS: StandardDepartmentDef[] = [
  { name: "BREAKFAST (two geese)", description: "" },
  { name: "Buon Cibo", description: "" },
  { name: "Cebichelsea", description: "" },
  { name: "Chick N Bun", description: "" },
  { name: "Eat Well", description: "" },
  { name: "GRAB N GO", description: "" },
  { name: "Momo Curry", description: "" },
  { name: "Nari Express", description: "" },
  { name: "Sal Anthony's", description: "" },
  { name: "Sammy's Taqueria", description: "" },
  { name: "SANDWICH (two geese)", description: "" },
  { name: "Sesame Street", description: "" },
  { name: "Two Geese Bakery", description: "" },
  { name: "Umai Fish", description: "" },
  { name: "Waste", description: "" },
];

export const STANDARD_DEPARTMENT_NAMES: string[] = STANDARD_DEPARTMENTS.map(d => d.name);
