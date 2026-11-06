const fs = require('fs');
let content = fs.readFileSync('src/components/AIParserView.tsx', 'utf8');

const targetStr = `<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-xs font-sans">
                          <div>
                            <span className="text-[10px] font-bold text-neutral-900/60 block leading-tight">Vendor Credential:</span>
                            <SearchableMatchSelect
                                          value={item.targetIngredientId || ""}
                                          onChange={(val) => updateItemTargetId(index, val)}
                                          ingredients={existingIngredients}
                                        />
                                      ) : item.matchAction === "create" ? (
                                        <span className="text-emerald-700 text-[10px] flex items-center gap-1 font-serif italic">
                                          <Plus className="h-3 w-3" />
                                          Add as new master item
                                        </span>
                                      ) : (
                                        <span className="text-neutral-400 italic text-[10px]">Omit from database</span>
                                      )}
                                    </td>`;

const fixStr = `<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-xs font-sans">
                          <div>
                            <span className="text-[10px] font-bold text-neutral-900/60 block leading-tight">Vendor Credential:</span>
                            <input 
                              type="text" 
                              value={activeItem.vendor} 
                              onChange={(e) => {
                                setQueue(prev => prev.map(q => q.id === activeItem.id ? { ...q, vendor: e.target.value } : q));
                              }}
                              className="font-bold text-neutral-900 mt-1 block w-full bg-white border border-neutral-300 rounded px-2 py-1" 
                            />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-neutral-900/60 block leading-tight">Invoice Number:</span>
                            <input 
                              type="text" 
                              value={activeItem.invoiceNumber} 
                              onChange={(e) => {
                                setQueue(prev => prev.map(q => q.id === activeItem.id ? { ...q, invoiceNumber: e.target.value } : q));
                              }}
                              className="font-bold text-neutral-900 mt-1 block w-full bg-white border border-neutral-300 rounded px-2 py-1" 
                            />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-neutral-900/60 block leading-tight">Invoice Date:</span>
                            <input 
                              type="date" 
                              value={activeItem.date} 
                              onChange={(e) => {
                                setQueue(prev => prev.map(q => q.id === activeItem.id ? { ...q, date: e.target.value } : q));
                              }}
                              className="font-bold text-neutral-900 mt-1 block w-full bg-white border border-neutral-300 rounded px-2 py-1" 
                            />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-neutral-900/60 block leading-tight">Parsed Items:</span>
                            <span className="font-bold text-neutral-900 mt-1 block">{activeItem.items.length} Extracted</span>
                          </div>
                        </div>
                      </div>

                      {/* Items verification table */}
                      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
                        <h4 className="p-4 border-b border-neutral-200 text-xs font-bold text-neutral-900 flex items-center justify-between bg-[#fafaf9]">
                          <span>Verify Ingredients and Match Actions</span>
                          <span className="text-neutral-450 font-mono text-[10px] font-normal">{activeItem.items.length} Extracted Lines</span>
                        </h4>
                        
                        <div className="overflow-x-auto border border-neutral-200 rounded-xl">
                          <table className="min-w-full divide-y divide-[#141414] text-xs text-neutral-900 bg-white">
                            <thead className="bg-[#f0efeb] text-neutral-900/70 font-bold text-[10px]">
                              <tr>
                                <th className="px-4 py-3 text-left border-r border-neutral-200">Parsed Item Name</th>
                                <th className="px-4 py-3 text-left border-r border-neutral-200 w-28">Total Cost ($)</th>
                                <th className="px-4 py-3 text-left border-r border-neutral-200 w-48">Package Qty / Unit</th>
                                <th className="px-4 py-3 text-left border-r border-neutral-200 w-32">Unit Price ($)</th>
                                <th className="px-4 py-3 text-left border-r border-neutral-200 w-52">Package Weight (Equiv.)</th>
                                <th className="px-4 py-3 text-left border-r border-neutral-200 w-[220px]">Usability Rate Yield %</th>
                                <th className="px-4 py-3 text-left border-r border-neutral-200 w-44">Database Match Action</th>
                                <th className="px-4 py-3 text-left border-r border-neutral-200">Inventory Target</th>
                                <th className="px-4 py-3 text-right">Unit Rate Change</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#141414]">
                              {activeItem.items.map((item, index) => {
                                const matchedIng = existingIngredients.find(ing => ing.id === item.targetIngredientId);
                                const newUnitPrice = item.totalPrice / (item.quantity || 1);
                                const oldUnitPrice = matchedIng ? (matchedIng.price / matchedIng.quantity) : null;
                                const priceDiff = oldUnitPrice !== null ? newUnitPrice - oldUnitPrice : null;
                                const percentDiff = oldUnitPrice ? (priceDiff! / oldUnitPrice) * 100 : null;

                                return (
                                  <tr key={index} className={\`transition-colors \${item.matchAction === "skip" ? "bg-neutral-50 opacity-60" : "hover:bg-neutral-50"}\`}>
                                    {/* Item name */}
                                    <td className="px-4 py-3 border-r border-neutral-200 font-bold">
                                      <div className="flex flex-col gap-1">
                                        <input
                                          type="text"
                                          value={item.name}
                                          onChange={(e) => updateItemField(index, "name", e.target.value)}
                                          className="bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-emerald-500 focus:outline-hidden w-full transition-colors"
                                        />
                                        {matchedIng && item.matchAction === "map" && (
                                          <span className="text-[10px] text-emerald-700 flex items-center gap-1 font-mono bg-emerald-50 w-max px-1.5 py-0.5 rounded-md">
                                            <CheckCircle2 className="h-3 w-3" /> Matches: {matchedIng.name}
                                          </span>
                                        )}
                                      </div>
                                    </td>

                                    {/* Total cost */}
                                    <td className="px-3 py-3 border-r border-neutral-200 w-28 font-mono">
                                      <div className="flex items-center gap-1">
                                        <span className="text-neutral-900/50">$</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={item.totalPrice}
                                          onChange={(e) => updateItemField(index, "totalPrice", parseFloat(e.target.value) || 0)}
                                          className="bg-white border border-neutral-200 px-2 py-1 text-xs font-bold font-mono text-right w-full focus:outline-hidden"
                                        />
                                      </div>
                                    </td>

                                    {/* Quantity and unit */}
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

                                    {/* Package weight */}
                                    <td className="px-3 py-3 border-r border-neutral-200 w-52">
                                      <div className="flex flex-col gap-1 text-left">
                                        <div className="flex gap-1.5 items-center">
                                          <input
                                            type="number"
                                            step="0.01"
                                            placeholder="Weight"
                                            value={item.weightPerCase !== undefined ? item.weightPerCase : ""}
                                            onChange={(e) => {
                                              const val = e.target.value === "" ? undefined : parseFloat(e.target.value);
                                              updateItemField(index, "weightPerCase", val);
                                            }}
                                            className="bg-white border border-neutral-200 px-2 py-1 text-xs font-bold font-mono text-right w-16 placeholder:text-neutral-400 focus:outline-hidden"
                                          />
                                          <select
                                            value={item.weightPerCaseUnit || "lb"}
                                            onChange={(e) => updateItemField(index, "weightPerCaseUnit", e.target.value)}
                                            className="bg-white border border-neutral-200 px-1.5 py-1 text-xs font-bold focus:outline-hidden cursor-pointer"
                                          >
                                            <option value="g">g</option>
                                            <option value="kg">kg</option>
                                            <option value="ml">ml</option>
                                            <option value="L">L</option>
                                            <option value="oz">oz</option>
                                            <option value="lb">lb</option>
                                            <option value="pcs">pcs</option>
                                          </select>
                                        </div>
                                      </div>
                                    </td>

                                    {/* Usability & Yield Column */}
                                    <td className="px-3 py-3 border-r border-neutral-200 w-[220px]">
                                      {item.matchAction !== "skip" ? (
                                        <div className="flex flex-col gap-1 text-left text-[11px]">
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number"
                                              min="1"
                                              max="100"
                                              step="1"
                                              value={item.usabilityPercentage !== undefined ? item.usabilityPercentage : 100}
                                              onChange={(e) => updateItemField(index, "usabilityPercentage", parseInt(e.target.value) || 100)}
                                              className="bg-white border border-neutral-200 px-1.5 py-0.5 text-xs font-bold font-mono text-right w-11 focus:outline-hidden"
                                            />
                                            <span className="font-bold text-xs">%</span>
                                            {item.usabilityPercentage !== undefined && item.usabilityPercentage < 100 && (
                                              <span className="text-[10px] text-amber-850 font-semibold ml-1">
                                                ({100 - item.usabilityPercentage}% waste)
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-[10px] text-emerald-800 flex flex-wrap items-center gap-1 mt-0.5 font-sans">
                                            <span>Rec: <strong>{recommendUsabilityPercentage(item.name).percentage}%</strong></span>
                                            {item.usabilityPercentage !== recommendUsabilityPercentage(item.name).percentage ? (
                                              <button
                                                type="button"
                                                onClick={() => updateItemField(index, "usabilityPercentage", recommendUsabilityPercentage(item.name).percentage)}
                                                className="ml-1 px-1 py-0.2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold border border-emerald-500/20 text-[9px] transition-all cursor-pointer"
                                              >
                                                Apply
                                              </button>
                                            ) : (
                                              <span className="ml-1 text-[8px] bg-emerald-100 text-emerald-800 font-bold px-1 py-0.2 border border-emerald-500/20 ">Match</span>
                                            )}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-neutral-450 font-serif italic text-[11px]">N/A</span>
                                      )}
                                    </td>

                                    {/* Action matching */}
                                    <td className="px-3 py-3 border-r border-neutral-200 w-44">
                                      <div className="flex flex-col gap-1">
                                        <button
                                          type="button"
                                          onClick={() => updateItemAction(index, "create")}
                                          className={\`px-2 py-0.5 rounded-xl text-[9px] font-bold \${
                                            item.matchAction === "create"
                                              ? "bg-emerald-600 text-white border border-neutral-200"
                                              : "bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-100"
                                          }\`}
                                        >
                                          Create New
                                        </button>
                                        <button
                                          type="button"
                                          disabled={existingIngredients.length === 0}
                                          onClick={() => updateItemAction(index, "map")}
                                          className={\`px-2 py-0.5 rounded-xl text-[9px] font-bold \${
                                            item.matchAction === "map"
                                              ? "bg-emerald-100 text-emerald-800 border border-emerald-450"
                                              : "bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-100 disabled:opacity-40"
                                          }\`}
                                        >
                                          Link Existing
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => updateItemAction(index, "skip")}
                                          className={\`px-2 py-0.5 rounded-xl text-[9px] font-bold \${
                                            item.matchAction === "skip"
                                              ? "bg-neutral-200 text-neutral-900 border border-neutral-200"
                                              : "bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-100"
                                          }\`}
                                        >
                                          Skip
                                        </button>
                                      </div>
                                    </td>

                                    {/* Selection target */}
                                    <td className="px-4 py-3 border-r border-neutral-200">
                                      {item.matchAction === "map" ? (
                                        <SearchableMatchSelect
                                          value={item.targetIngredientId || ""}
                                          onChange={(val) => updateItemTargetId(index, val)}
                                          ingredients={existingIngredients}
                                        />
                                      ) : item.matchAction === "create" ? (
                                        <span className="text-emerald-700 text-[10px] flex items-center gap-1 font-serif italic">
                                          <Plus className="h-3 w-3" />
                                          Add as new master item
                                        </span>
                                      ) : (
                                        <span className="text-neutral-400 italic text-[10px]">Omit from database</span>
                                      )}
                                    </td>`;

content = content.replace(targetStr, fixStr);
fs.writeFileSync('src/components/AIParserView.tsx', content);
