const fs = require('fs');

let content = fs.readFileSync('src/components/AIParserView.tsx', 'utf8');

// Insert the Searchable component
const searchComp = `
interface SearchableMatchSelectProps {
  value: string;
  onChange: (value: string) => void;
  ingredients: Ingredient[];
  placeholder?: string;
}

function SearchableMatchSelect({
  value,
  onChange,
  ingredients,
  placeholder = "-- Select Ingredient --"
}: SearchableMatchSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const selectedIng = ingredients.find((ing) => ing.id === value);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const terms = query.toLowerCase().split(",").map((t) => t.trim()).filter(Boolean);
  const filtered = ingredients.filter((ing) => {
    if (terms.length === 0) return true;
    return terms.some(
      (t) =>
        (ing.name || "").toLowerCase().includes(t) ||
        (ing.source || "").toLowerCase().includes(t) ||
        (ing.vendor || "").toLowerCase().includes(t)
    );
  });

  return (
    <div className="relative w-full max-w-[200px]" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setQuery("");
        }}
        className={\`w-full text-xs font-bold py-1 px-1.5 rounded-xl border text-left flex items-center justify-between gap-1 transition-all cursor-pointer \${
          value
            ? "text-neutral-900 bg-white border-neutral-200 hover:bg-neutral-50"
            : "text-amber-950 bg-amber-50 border-amber-300 hover:bg-amber-100/70"
        }\`}
      >
        <span className="truncate">
          {selectedIng ? (
            <span>
              {selectedIng.name}{" "}
              <span className="text-[10px] font-mono opacity-60">
                ({selectedIng.quantity} {selectedIng.unit})
              </span>
            </span>
          ) : (
            <span className="opacity-60">{placeholder}</span>
          )}
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 top-full mt-1 w-full min-w-[240px] bg-white border border-neutral-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-neutral-100">
            <input
              type="text"
              autoFocus
              placeholder="Search by name, vendor..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full text-xs font-bold px-2 py-1.5 bg-neutral-100 border-transparent rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="text-center py-4 text-xs font-bold text-neutral-400">No matching ingredients</div>
            ) : (
              filtered.map((ing) => (
                <button
                  key={ing.id}
                  onClick={() => {
                    onChange(ing.id!);
                    setIsOpen(false);
                  }}
                  className={\`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors flex flex-col \${
                    value === ing.id ? "bg-emerald-50 text-emerald-900" : "hover:bg-neutral-50 text-neutral-700"
                  }\`}
                >
                  <span className="font-bold truncate">{ing.name}</span>
                  <div className="flex items-center gap-1.5 opacity-60 text-[10px] mt-0.5">
                    <span className="font-mono">
                      {ing.quantity} {ing.unit}
                    </span>
                    <span>•</span>
                    <span className="truncate max-w-[100px]">{ing.vendor || "No vendor"}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

`;

if (!content.includes('SearchableMatchSelectProps')) {
  content = content.replace('export default function AIParserView({', searchComp + 'export default function AIParserView({');
}

// Replace select dropdown
const selectRegex = /<select[\s\S]*?value=\{item\.targetIngredientId \|\| ""\}[\s\S]*?onChange=\{\(e\) => updateItemTargetId\(index, e\.target\.value\)\}[\s\S]*?className="bg-white border border-neutral-200 rounded-xl px-1\.5 py-1 block w-full max-w-\[200px\] text-xs font-bold"[\s\S]*?>[\s\S]*?\{existingIngredients\.map\(ing => \([\s\S]*?<option key=\{ing\.id\} value=\{ing\.id\}>[\s\S]*?\{ing\.name\} \(\{ing\.quantity\} \{ing\.unit\}\)[\s\S]*?<\/option>[\s\S]*?\)\)\}[\s\S]*?<\/select>/;

content = content.replace(selectRegex, `<SearchableMatchSelect
                                          value={item.targetIngredientId || ""}
                                          onChange={(val) => updateItemTargetId(index, val)}
                                          ingredients={existingIngredients}
                                        />`);

fs.writeFileSync('src/components/AIParserView.tsx', content);

