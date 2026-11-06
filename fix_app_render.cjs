const fs = require('fs');
let appContent = fs.readFileSync('src/App.tsx', 'utf8');

// I need to extract the AIParserView rendering and place it in the same level as the other views outside of the Food Cost Intel block.
const aiParserRenderStart = appContent.indexOf('{activeSection === "ai-parser" && <AIParserView ');
let aiParserRenderEnd = appContent.indexOf('/>}');
if (aiParserRenderEnd !== -1) {
    aiParserRenderEnd = appContent.indexOf('/>}', aiParserRenderStart) + 3;
}

const aiParserBlock = appContent.substring(aiParserRenderStart, aiParserRenderEnd);
appContent = appContent.replace(aiParserBlock, '');

// Place it right after the {["catalog", "recipes", "intel"].includes(activeSection) && (...)} block ends
const intelBlockEndStr = `                  {activeSection === "intel" && <FoodCostIntelView 
                      ingredients={ingredients}
                      recipes={recipes}
                      salesData={salesData}
                      departmentNames={departments.map(d => d.name)}
                      vendorNames={vendors.map(v => v.name)}
                    />}
                </div>
              )}`;

const newIntelBlockEndStr = intelBlockEndStr + `

              {activeSection === "ai-parser" && <AIParserView 
                      existingIngredients={ingredients}
                      existingInvoices={[]}
                      vendors={vendors}
                      onApplyParsedItems={handleApplyParsedItems}
                      userId={user.uid}
                      isReadOnly={isReadOnly}
                      queue={parserQueue}
                      setQueue={setParserQueue}
                      activeQueueId={parserActiveQueueId}
                      setActiveQueueId={setParserActiveQueueId}
                      parsingAll={parserParsingAll}
                      setParsingAll={setParserParsingAll}
                    />}
`;

appContent = appContent.replace(intelBlockEndStr, newIntelBlockEndStr);
fs.writeFileSync('src/App.tsx', appContent);
