const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
`  const handleAddInvoice`,
`  const handleAddOrderList = async (orderList: Omit<any, "id" | "ownerId" | "createdAt" | "updatedAt">) => {
    if (isReadOnly || !user || !workspaceOwnerId) return;
    try {
      const payload = { 
        ...orderList, 
        ownerId: workspaceOwnerId, 
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await addDoc(collection(db, "orderLists"), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "orderLists");
    }
  };

  const handleUpdateOrderList = async (id: string, updates: Partial<any>) => {
    if (isReadOnly) return;
    try {
      await updateDoc(doc(db, "orderLists", id), { ...updates, updatedAt: new Date().toISOString() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "orderLists");
    }
  };

  const handleDeleteOrderList = async (id: string) => {
    if (isReadOnly) return;
    try {
      await deleteDoc(doc(db, "orderLists", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "orderLists");
    }
  };

  const handleAddInvoice`
);

fs.writeFileSync('src/App.tsx', code);
