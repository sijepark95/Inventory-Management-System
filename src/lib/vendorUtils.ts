/**
 * Normalizes a vendor name for robust matching and grouping.
 * Strips punctuation, possessives, and multiple whitespaces.
 * E.g., "Lily's Produce", "Lily Produce ", "lily produce" -> "lily produce"
 */
export function getNormalizedVendorKey(name: string): string {
  if (!name) return "";
  return name
    .trim()
    .toLowerCase()
    .replace(/['’]s\b/g, "") // remove possessive 's or ’s (e.g., "lily's" -> "lily")
    .replace(/[^a-z0-9]/g, " ") // replace other non-alphanumeric chars with space
    .replace(/\s+/g, " ") // collapse multiple spaces
    .trim();
}

/**
 * Standardizes a raw vendor name using a map of registered vendors.
 * Registered vendors take highest priority for exact display casing.
 */
export function getStandardizedVendorName(
  rawName: string | undefined,
  registeredVendors: Array<{ name: string }>
): string {
  if (!rawName || rawName.trim().length === 0) {
    return "Unknown / Manual";
  }

  const cleanRaw = rawName.trim();
  const key = getNormalizedVendorKey(cleanRaw);

  // Find matching registered vendor
  const matched = registeredVendors.find(v => getNormalizedVendorKey(v.name) === key);
  if (matched) {
    return matched.name.trim();
  }

  return cleanRaw;
}
