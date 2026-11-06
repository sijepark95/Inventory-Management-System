const fs = require('fs');

let content = fs.readFileSync('src/components/AIParserView.tsx', 'utf8');

// 1. Add Unit Price to table header
const tableHeaderRegex = /<th className="px-4 py-3 text-left border-r border-neutral-200 w-48">Package Qty \/ Unit<\/th>\s*<th className="px-4 py-3 text-left border-r border-neutral-200 w-52">Package Weight \(Equiv.\)<\/th>/;
content = content.replace(tableHeaderRegex, `<th className="px-4 py-3 text-left border-r border-neutral-200 w-48">Package Qty / Unit</th>
                                <th className="px-4 py-3 text-left border-r border-neutral-200 w-32">Unit Price ($)</th>
                                <th className="px-4 py-3 text-left border-r border-neutral-200 w-52">Package Weight (Equiv.)</th>`);


// 2. Change Unit Dropdown and Add Unit Price cell
// We need to replace the TD for "Package Qty / Unit" and insert the new TD for "Unit Price ($)".

const qtyUnitTdStart = content.indexOf('{/* Quantity and unit */}');
const qtyUnitTdEnd = content.indexOf('{/* Package weight */}');
let oldQtyUnitTd = content.substring(qtyUnitTdStart, qtyUnitTdEnd);

const newQtyUnitTd = `{/* Quantity and unit */}
                                    <td className="px-3 py-3 border-r border-neutral-200 w-48 font-mono">
                                      <div className="flex gap-1 items-center">
                                        <input
                                          type="number"
                                          step="0.1"
                                          value={item.quantity}
                                          onChange={(e) => updateItemField(index, "quantity", parseFloat(e.target.value) || 0)}
                                          className="bg-white border border-neutral-200 px-2 py-1 text-xs font-bold text-right w-14 focus:outline-hidden"
                                        />
                                        <select
                                          value={item.unit || "box"}
                                          onChange={(e) => updateItemField(index, "unit", e.target.value)}
                                          className="bg-white border border-neutral-200 px-1 py-1 text-xs font-bold focus:outline-hidden cursor-pointer"
                                        >
                                          <option value="box">box</option>
                                          <option value="case">case</option>
                                          <option value="bag">bag</option>
                                          <option value="can">can</option>
                                          <option value="bottle">bottle</option>
                                          <option value="pack">pack</option>
                                          {matchedIng && matchedIng.unit !== "box" && matchedIng.unit !== "case" && matchedIng.unit !== "bag" && matchedIng.unit !== "can" && matchedIng.unit !== "bottle" && matchedIng.unit !== "pack" && (
                                            <option value={matchedIng.unit}>{matchedIng.unit}</option>
                                          )}
                                        </select>
                                      </div>
                                    </td>

                                    {/* Unit Price */}
                                    <td className="px-3 py-3 border-r border-neutral-200 w-32 font-mono text-right">
                                      <div className="flex items-center gap-1 justify-end">
                                        <span className="text-neutral-900/50 text-[10px]">$</span>
                                        <span className="font-bold">{item.quantity > 0 ? (item.totalPrice / item.quantity).toFixed(2) : "0.00"}</span>
                                        <span className="text-neutral-400 text-[9px]">/{item.unit || "box"}</span>
                                      </div>
                                    </td>

                                    `;

content = content.replace(oldQtyUnitTd, newQtyUnitTd);

fs.writeFileSync('src/components/AIParserView.tsx', content);
