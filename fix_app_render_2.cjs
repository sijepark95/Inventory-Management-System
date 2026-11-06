const fs = require('fs');
let appContent = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `              {activeSection === "sales-data" && (`;

const newRender = `              {activeSection === "ai-parser" && <AIParserView 
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

              {activeSection === "sales-data" && (`;

appContent = appContent.replace(targetStr, newRender);
fs.writeFileSync('src/App.tsx', appContent);
