export const INGREDIENT_TYPES = [
  "Beef",
  "Pork",
  "Poultry",
  "Seafood",
  "Vegetables",
  "Fruit",
  "Dairy & Eggs",
  "Dry Goods & Grains",
  "Sauces & Condiments",
  "Bakery & Bread",
  "Beverages & Bar",
  "Packaging & Paper",
  "Other"
] as const;

export type IngredientType = typeof INGREDIENT_TYPES[number];

export function getFoodTypeBadgeClass(rawType?: string): string {
  const norm = normalizeFoodType(rawType);
  switch (norm) {
    case "Beef":
      return "bg-red-50 text-red-800 border-red-200";
    case "Pork":
      return "bg-rose-50 text-rose-800 border-rose-200";
    case "Poultry":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "Seafood":
      return "bg-cyan-50 text-cyan-800 border-cyan-200";
    case "Vegetables":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "Fruit":
      return "bg-lime-50 text-lime-800 border-lime-200";
    case "Dairy & Eggs":
      return "bg-blue-50 text-blue-800 border-blue-200";
    case "Dry Goods & Grains":
      return "bg-yellow-50 text-yellow-900 border-yellow-200";
    case "Sauces & Condiments":
      return "bg-orange-50 text-orange-800 border-orange-200";
    case "Bakery & Bread":
      return "bg-stone-100 text-stone-800 border-stone-300";
    case "Beverages & Bar":
      return "bg-purple-50 text-purple-800 border-purple-200";
    case "Packaging & Paper":
      return "bg-neutral-100 text-neutral-700 border-neutral-300";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export function getFoodTypeChartColor(rawType?: string): string {
  const norm = normalizeFoodType(rawType);
  switch (norm) {
    case "Beef":
      return "#ef4444";
    case "Pork":
      return "#f43f5e";
    case "Poultry":
      return "#f59e0b";
    case "Seafood":
      return "#06b6d4";
    case "Vegetables":
      return "#10b981";
    case "Fruit":
      return "#84cc16";
    case "Dairy & Eggs":
      return "#3b82f6";
    case "Dry Goods & Grains":
      return "#eab308";
    case "Sauces & Condiments":
      return "#f97316";
    case "Bakery & Bread":
      return "#78716c";
    case "Beverages & Bar":
      return "#8b5cf6";
    case "Packaging & Paper":
      return "#64748b";
    default:
      return "#94a3b8";
  }
}

export function getFoodTypeEmoji(rawType?: string): string {
  const norm = normalizeFoodType(rawType);
  switch (norm) {
    case "Beef":
      return "🥩";
    case "Pork":
      return "🥓";
    case "Poultry":
      return "🍗";
    case "Seafood":
      return "🐟";
    case "Vegetables":
      return "🥬";
    case "Fruit":
      return "🍎";
    case "Dairy & Eggs":
      return "🧀";
    case "Dry Goods & Grains":
      return "🌾";
    case "Sauces & Condiments":
      return "🥫";
    case "Bakery & Bread":
      return "🍞";
    case "Beverages & Bar":
      return "🍷";
    case "Packaging & Paper":
      return "📦";
    default:
      return "🍽️";
  }
}

export function normalizeFoodType(raw?: string): IngredientType {
  if (!raw) return "Other";
  const clean = raw.trim().toLowerCase();

  if (clean === "beef" || clean.includes("beef") || clean === "steak" || clean.includes("ribeye") || clean.includes("sirloin") || clean.includes("brisket") || clean.includes("wagyu")) {
    return "Beef";
  }
  if (clean === "pork" || clean.includes("pork") || clean === "bacon" || clean === "ham" || clean.includes("belly") || clean.includes("carnitas") || clean.includes("chorizo") || clean.includes("prosciutto")) {
    return "Pork";
  }
  if (clean === "poultry" || clean.includes("chicken") || clean.includes("turkey") || clean.includes("duck") || clean.includes("wing") || clean.includes("drumstick") || clean.includes("tender")) {
    return "Poultry";
  }
  if (clean === "seafood" || clean.includes("fish") || clean.includes("salmon") || clean.includes("shrimp") || clean.includes("tuna") || clean.includes("crab") || clean.includes("lobster") || clean.includes("squid") || clean.includes("calamari") || clean.includes("scallop") || clean.includes("clam") || clean.includes("mussel")) {
    return "Seafood";
  }
  if (clean === "vegetables" || clean === "vegetable" || clean === "produce" || clean.includes("onion") || clean.includes("garlic") || clean.includes("tomato") || clean.includes("potato") || clean.includes("lettuce") || clean.includes("cabbage") || clean.includes("pepper") || clean.includes("mushroom") || clean.includes("avocado") || clean.includes("spinach") || clean.includes("broccoli") || clean.includes("celery") || clean.includes("carrot")) {
    return "Vegetables";
  }
  if (clean === "fruit" || clean === "fruits" || clean.includes("apple") || clean.includes("orange") || clean.includes("lemon") || clean.includes("lime") || clean.includes("berry") || clean.includes("banana") || clean.includes("mango") || clean.includes("pineapple") || clean.includes("peach")) {
    return "Fruit";
  }
  if (clean.includes("dairy") || clean.includes("egg") || clean.includes("milk") || clean.includes("cheese") || clean.includes("butter") || clean.includes("cream") || clean.includes("yogurt")) {
    return "Dairy & Eggs";
  }
  if (clean.includes("dry") || clean.includes("grain") || clean.includes("rice") || clean.includes("flour") || clean.includes("pasta") || clean.includes("noodle") || clean.includes("sugar") || clean.includes("salt") || clean.includes("spice") || clean.includes("nut")) {
    return "Dry Goods & Grains";
  }
  if (clean.includes("sauce") || clean.includes("condiment") || clean.includes("oil") || clean.includes("vinegar") || clean.includes("ketchup") || clean.includes("mustard") || clean.includes("dressing") || clean.includes("mayo")) {
    return "Sauces & Condiments";
  }
  if (clean.includes("bakery") || clean.includes("bread") || clean.includes("bun") || clean.includes("tortilla") || clean.includes("roll") || clean.includes("bagel") || clean.includes("pastry")) {
    return "Bakery & Bread";
  }
  if (clean.includes("beverage") || clean.includes("drink") || clean.includes("bar") || clean.includes("wine") || clean.includes("beer") || clean.includes("liquor") || clean.includes("coffee") || clean.includes("tea") || clean.includes("soda")) {
    return "Beverages & Bar";
  }
  if (clean.includes("packaging") || clean.includes("paper") || clean.includes("box") || clean.includes("container") || clean.includes("cup") || clean.includes("lid") || clean.includes("glove") || clean.includes("napkin")) {
    return "Packaging & Paper";
  }

  // Exact match attempt
  const found = INGREDIENT_TYPES.find(t => t.toLowerCase() === clean);
  return found || "Other";
}

/**
 * Automatically infers the culinary food type (Beef, Pork, Poultry, Seafood, Vegetables, etc.)
 * by analyzing words in the ingredient or line item name.
 */
export function inferIngredientType(name?: string, existingCategory?: string): IngredientType {
  if (existingCategory && existingCategory !== "General" && existingCategory !== "Meat" && existingCategory !== "Unassigned") {
    const normalized = normalizeFoodType(existingCategory);
    if (normalized !== "Other") return normalized;
  }

  if (!name || !name.trim()) {
    return "Other";
  }

  const str = ` ${name.toLowerCase().trim()} `;

  const testKeywords = (keywords: string[]): boolean => {
    return keywords.some(kw => {
      if (kw.includes(" ")) {
        return str.includes(kw);
      }
      const regex = new RegExp(`(?:^|[\\s_-])${kw}(?:$|[\\s_-]|s|es)`, "i");
      return regex.test(str);
    });
  };

  // 1. Beef
  if (testKeywords([
    "beef", "steak", "ribeye", "sirloin", "tenderloin", "filet", "brisket",
    "chuck", "flank", "wagyu", "veal", "ox", "oxtail", "short rib", "shortrib",
    "kalbi", "bulgogi", "angus", "tri-tip", "skirt steak", "t-bone", "patty",
    "ground beef", "roast beef", "meatball"
  ])) {
    return "Beef";
  }

  // 2. Pork
  if (testKeywords([
    "pork", "bacon", "ham", "sausage", "pancetta", "prosciutto", "pork belly",
    "carnitas", "chorizo", "salami", "pepperoni", "pork loin", "pork chop",
    "spare rib", "baby back", "pork butt", "pork shoulder", "jamon", "lard", "guanciale", "spam"
  ])) {
    return "Pork";
  }

  // 3. Poultry
  if (testKeywords([
    "chicken", "turkey", "duck", "wing", "drumstick", "thigh", "breast",
    "tender", "quail", "goose", "fowl", "capon", "pollo", "poultry"
  ])) {
    return "Poultry";
  }

  // 4. Seafood
  if (testKeywords([
    "fish", "salmon", "tuna", "shrimp", "prawn", "crab", "lobster", "clam",
    "mussel", "scallop", "oyster", "octopus", "squid", "calamari", "cod",
    "bass", "tilapia", "halibut", "trout", "eel", "unagi", "anchovy", "sardine",
    "snapper", "mahi", "swordfish", "caviar", "roe", "flounder", "sole", "catfish", "mariscos"
  ])) {
    return "Seafood";
  }

  // 5. Dairy & Eggs
  if (testKeywords([
    "egg", "eggs", "milk", "cream", "heavy cream", "butter", "cheese", "cheddar",
    "mozzarella", "parmesan", "parmigiano", "yogurt", "sour cream", "ricotta",
    "brie", "feta", "gouda", "swiss", "cream cheese", "ghee", "buttermilk", "mayo", "mayonnaise", "queso"
  ])) {
    return "Dairy & Eggs";
  }

  // 6. Vegetables
  if (testKeywords([
    "onion", "garlic", "tomato", "potato", "scallion", "shallot", "chive",
    "lettuce", "cabbage", "carrot", "celery", "pepper", "jalapeno", "habanero",
    "chili", "chile", "mushroom", "cucumber", "spinach", "broccoli", "cauliflower",
    "avocado", "ginger", "cilantro", "parsley", "basil", "mint", "rosemary",
    "thyme", "oregano", "dill", "herb", "corn", "pea", "bean", "green bean",
    "edamame", "asparagus", "zucchini", "squash", "kale", "radish", "daikon",
    "sprout", "eggplant", "beet", "leek", "bok choy", "napa", "artichoke",
    "arugula", "salad", "verdura"
  ])) {
    return "Vegetables";
  }

  // 7. Fruit
  if (testKeywords([
    "apple", "orange", "lemon", "lime", "citrus", "berry", "strawberry",
    "blueberry", "raspberry", "blackberry", "banana", "mango", "pineapple",
    "peach", "pear", "watermelon", "melon", "cantaloupe", "grape", "cherry",
    "plum", "fig", "date", "coconut", "passion fruit", "kiwi", "papaya",
    "pomegranate", "apricot", "cranberry"
  ])) {
    return "Fruit";
  }

  // 8. Bakery & Bread
  if (testKeywords([
    "bread", "bun", "buns", "brioche", "sourdough", "tortilla", "wrap",
    "pita", "naan", "bagel", "roll", "rolls", "crust", "pastry", "puff pastry",
    "croissant", "muffin", "dough", "baguette", "ciabatta", "focaccia"
  ])) {
    return "Bakery & Bread";
  }

  // 9. Dry Goods & Grains
  if (testKeywords([
    "rice", "flour", "pasta", "noodle", "spaghetti", "penne", "macaroni",
    "sugar", "salt", "spice", "seasoning", "panko", "breadcrumb", "grain",
    "quinoa", "oat", "oats", "barley", "couscous", "starch", "cornstarch",
    "potato starch", "yeast", "baking powder", "baking soda", "sesame",
    "walnut", "almond", "peanut", "cashew", "pecan", "lentil", "chickpea"
  ])) {
    return "Dry Goods & Grains";
  }

  // 10. Sauces & Condiments
  if (testKeywords([
    "sauce", "soy sauce", "tamari", "vinegar", "balsamic", "oil", "olive oil",
    "sesame oil", "canola oil", "ketchup", "mustard", "sriracha", "gochujang",
    "hot sauce", "bbq", "dressing", "vinaigrette", "broth", "stock", "dashi",
    "mirin", "miso", "curry", "paste", "honey", "syrup", "maple", "pesto"
  ])) {
    return "Sauces & Condiments";
  }

  // 11. Beverages & Bar
  if (testKeywords([
    "wine", "beer", "vodka", "tequila", "whiskey", "rum", "gin", "liquor",
    "cocktail", "soda", "coke", "sprite", "juice", "coffee", "espresso",
    "tea", "matcha", "water", "sparkling water", "bitters"
  ])) {
    return "Beverages & Bar";
  }

  // 12. Packaging & Paper
  if (testKeywords([
    "box", "boxes", "container", "takeout", "cup", "cups", "lid", "lids",
    "foil", "plastic wrap", "film", "glove", "gloves", "towel", "towels",
    "napkin", "napkins", "bag", "bags", "fork", "spoon", "knife", "straw"
  ])) {
    return "Packaging & Paper";
  }

  return "Other";
}
