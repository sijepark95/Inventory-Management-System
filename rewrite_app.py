import re

with open("src/App.tsx", "r") as f:
    content = f.read()

# Replace React import to include Suspense
content = content.replace('import React, { useState, useEffect } from "react";', 'import React, { useState, useEffect, Suspense } from "react";')

# Replace AIParserView import to type and lazy
content = content.replace(
    'import AIParserView, { QueueItem } from "./components/AIParserView";',
    'import type { QueueItem } from "./components/AIParserView";\nconst AIParserView = React.lazy(() => import("./components/AIParserView"));'
)

# Other lazy replacements
lazy_replacements = [
    ('import IngredientsView from "./components/IngredientsView";', 'const IngredientsView = React.lazy(() => import("./components/IngredientsView"));'),
    ('import RecipesView from "./components/RecipesView";', 'const RecipesView = React.lazy(() => import("./components/RecipesView"));'),
    ('import TimesheetView from "./components/TimesheetView";', 'const TimesheetView = React.lazy(() => import("./components/TimesheetView"));'),
    ('import StaffRegistryView from "./components/StaffRegistryView";', 'const StaffRegistryView = React.lazy(() => import("./components/StaffRegistryView"));'),
    ('import FoodCostIntelView from "./components/FoodCostIntelView";', 'const FoodCostIntelView = React.lazy(() => import("./components/FoodCostIntelView"));'),
    ('import GroceryView from "./components/GroceryView";', 'const GroceryView = React.lazy(() => import("./components/GroceryView"));'),
    ('import CollaboratorsView from "./components/CollaboratorsView";', 'const CollaboratorsView = React.lazy(() => import("./components/CollaboratorsView"));'),
    ('import DashboardView from "./components/DashboardView";', 'const DashboardView = React.lazy(() => import("./components/DashboardView"));'),
    ('import InventoryView from "./components/InventoryView";', 'const InventoryView = React.lazy(() => import("./components/InventoryView"));'),
    ('import { VendorsView } from "./components/VendorsView";', 'const VendorsView = React.lazy(() => import("./components/VendorsView").then(module => ({ default: module.VendorsView })));'),
    ('import { DepartmentsView } from "./components/DepartmentsView";', 'const DepartmentsView = React.lazy(() => import("./components/DepartmentsView").then(module => ({ default: module.DepartmentsView })));'),
    ('import { InvoiceManagementView } from "./components/InvoiceManagementView";', 'const InvoiceManagementView = React.lazy(() => import("./components/InvoiceManagementView").then(module => ({ default: module.InvoiceManagementView })));'),
    ('import { ReportCenterView } from "./components/ReportCenterView";', 'const ReportCenterView = React.lazy(() => import("./components/ReportCenterView").then(module => ({ default: module.ReportCenterView })));'),
    ('import SalesDataView from "./components/SalesDataView";', 'const SalesDataView = React.lazy(() => import("./components/SalesDataView"));'),
]

for old, new in lazy_replacements:
    content = content.replace(old, new)

# Wrap the main <div className="flex-1 overflow-auto bg-neutral-50/50"> content in Suspense
# Let's find where the views start rendering. They are mostly in <main className="..."> or similar.
# In App.tsx, they are rendered sequentially.
# Wait, I can just wrap the main content container.
content = content.replace('<main className="max-w-7xl mx-auto py-8">', '<main className="max-w-7xl mx-auto py-8">\n            <Suspense fallback={<div className="flex items-center justify-center h-full min-h-[400px] text-neutral-400 font-mono animate-pulse">Loading module...</div>}>')
content = content.replace('</main>\n          </div>\n        </div>\n      </div>', '</Suspense>\n          </main>\n          </div>\n        </div>\n      </div>')

with open("src/App.tsx", "w") as f:
    f.write(content)
