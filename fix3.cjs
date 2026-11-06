const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
`              {(activeSection === "invoices" || activeSection === "make-order-list") && (
                <InvoiceManagementView
                  invoices={invoices}
                  vendors={vendors}
                  onAddInvoice={handleAddInvoice}
                  onUpdateInvoice={handleUpdateInvoice}
                  onDeleteInvoice={handleDeleteInvoice}
                  isReadOnly={isReadOnly}
                  autoOpenMakeOrderList={activeSection === "make-order-list"}
                  onCloseMakeOrderList={() => {
                    if (activeSection === "make-order-list") {
                      setActiveSection("invoices");
                    }
                  }}
                />
              )}`,
`              {activeSection === "invoices" && (
                <InvoiceManagementView
                  invoices={invoices}
                  vendors={vendors}
                  onAddInvoice={handleAddInvoice}
                  onUpdateInvoice={handleUpdateInvoice}
                  onDeleteInvoice={handleDeleteInvoice}
                  isReadOnly={isReadOnly}
                />
              )}
              {activeSection === "make-order-list" && (
                <OrderListView
                  orderLists={orderLists}
                  vendors={vendors}
                  ingredients={ingredients}
                  onAddOrderList={handleAddOrderList}
                  onUpdateOrderList={handleUpdateOrderList}
                  onDeleteOrderList={handleDeleteOrderList}
                  isReadOnly={isReadOnly}
                />
              )}`
);

fs.writeFileSync('src/App.tsx', code);
