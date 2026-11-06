const items = [{ id: 1 }];
for (const item of items) {
  console.log("Processing", item.id);
  if (item.id === 1) items.push({ id: 2 });
}
console.log("Done. Items length:", items.length);
