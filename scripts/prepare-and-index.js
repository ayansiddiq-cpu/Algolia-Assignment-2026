/**
 * prepare-and-index.js
 *
 * Joins restaurants_list.json + restaurants_info.csv on `objectID`,
 * cleans/normalizes the combined records, and pushes them to an Algolia index.
 *
 * Usage:
 *   node scripts/prepare-and-index.js
 *
 * Requires a .env file (not committed) with:
 *   ALGOLIA_APP_ID=RSVAE49E21
 *   ALGOLIA_ADMIN_API_KEY=your_admin_key_here
 *   ALGOLIA_INDEX_NAME=opentable_restaurants
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const algoliasearch = require("algoliasearch");

// ---- Config ----
const JSON_PATH = path.join(__dirname, "..", "dataset", "restaurants_list.json");
const CSV_PATH = path.join(__dirname, "..", "dataset", "restaurants_info.csv");

const APP_ID = process.env.ALGOLIA_APP_ID;
const ADMIN_KEY = process.env.ALGOLIA_ADMIN_API_KEY;
const INDEX_NAME = process.env.ALGOLIA_INDEX_NAME || "opentable_restaurants";

if (!APP_ID || !ADMIN_KEY) {
  console.error("Missing ALGOLIA_APP_ID or ALGOLIA_ADMIN_API_KEY in .env");
  process.exit(1);
}

// ---- Payment normalization ----
// Assumption: the assignment only wants these four exposed values.
// Diners Club and Carte Blanche are folded into Discover per the spec.
function normalizePaymentOptions(rawOptions) {
  if (!Array.isArray(rawOptions)) return [];

  const mapping = {
    "amex": "AMEX",
    "american express": "AMEX",
    "visa": "Visa",
    "discover": "Discover",
    "mastercard": "MasterCard",
    "diners club": "Discover",
    "carte blanche": "Discover",
  };

  const normalized = new Set();
  for (const raw of rawOptions) {
    const key = raw.trim().toLowerCase();
    if (mapping[key]) {
      normalized.add(mapping[key]);
    } else {
      // Surface anything unexpected instead of silently dropping it.
      console.warn(`Unrecognized payment option "${raw}", skipping.`);
    }
  }
  return Array.from(normalized);
}

// ---- Cuisine normalization ----
// Assumption: compound values like "Global, International" should facet
// as two independent cuisine values, not one combined bucket.
function splitCuisine(foodType) {
  if (!foodType) return [];
  return foodType
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

// ---- Load and parse source files ----
console.log("Reading source files...");
const restaurantsList = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));

const csvRaw = fs.readFileSync(CSV_PATH, "utf-8");
const restaurantsInfo = parse(csvRaw, {
  columns: true,
  delimiter: ";",
  skip_empty_lines: true,
});

console.log(`Loaded ${restaurantsList.length} restaurants from JSON`);
console.log(`Loaded ${restaurantsInfo.length} rows from CSV`);

// ---- Build a lookup for the CSV info, keyed by objectID ----
const infoByObjectID = new Map();
for (const row of restaurantsInfo) {
  infoByObjectID.set(String(row.objectID), row);
}

// ---- Join + transform ----
const records = [];
let unmatchedCount = 0;

for (const restaurant of restaurantsList) {
  const info = infoByObjectID.get(String(restaurant.objectID));

  if (!info) {
    unmatchedCount++;
    continue; // Skip records we can't fully enrich; logged below.
  }

  const cuisines = splitCuisine(info.food_type);

  const record = {
    objectID: String(restaurant.objectID),

    // Core identity / display fields
    name: restaurant.name,
    address: restaurant.address,
    neighborhood: info.neighborhood || restaurant.area,
    area: restaurant.area,
    city: restaurant.city,
    state: restaurant.state,
    country: restaurant.country,
    postal_code: restaurant.postal_code,
    phone: restaurant.phone,

    // Media / links
    image_url: restaurant.image_url,
    reserve_url: restaurant.reserve_url,
    mobile_reserve_url: restaurant.mobile_reserve_url,

    // Cuisine (searchable + facetable)
    food_type: info.food_type, // original string, kept for display
    cuisines: cuisines, // split array, used for faceting

    // Dining details
    dining_style: info.dining_style,

    // Price: numeric for filtering/sorting, string for display
    price: restaurant.price,
    price_range: info.price_range,

    // Ranking signals
    stars_count: info.stars_count ? parseFloat(info.stars_count) : null,
    reviews_count: info.reviews_count ? parseInt(info.reviews_count, 10) : 0,

    // Payment (normalized)
    payment_options: normalizePaymentOptions(restaurant.payment_options),

    // Geo (pass through as-is, already correctly shaped)
    _geoloc: restaurant._geoloc,
  };

  records.push(record);
}

console.log(`Built ${records.length} joined records`);
if (unmatchedCount > 0) {
  console.warn(`${unmatchedCount} restaurants had no matching CSV row and were skipped`);
}

// ---- Index settings ----
// Configures how the index is searched, faceted, and ranked. Applied via
// setSettings before we push records, so the index is fully configured the
// moment data lands (matters less for a batch script than a live index, but
// keeps "configure, then populate" as the mental model).
const INDEX_SETTINGS = {
  // Searchable attributes, grouped into priority tiers (each array entry is
  // a tier; commas within an entry mean "equally important").
  //   1. name         - known-item searchers type the restaurant name first.
  //   2. cuisines     - discovery browsers search by what they want to eat
  //      ("sushi") rather than a specific place. food_type is intentionally
  //      NOT listed here: it's the same words as cuisines pre-split, so
  //      making it searchable too would be redundant. It's kept in the
  //      record purely for display (the human-readable "Global, International"
  //      string), not for matching.
  //   3. neighborhood / area / city / state - supports queries like
  //      "italian in pepper hill" without requiring a separate location field.
  //   4. address      - lowest priority; mostly disambiguates chains with
  //      multiple locations in the same city.
  // unordered(address) means word position within the address doesn't affect
  // ranking. It's deliberately NOT applied to tier 3: I tested it against the
  // live index and confirmed Algolia's unordered() modifier only accepts a
  // single attribute per call, wrapping (or chaining) multiple attributes in
  // one entry gets silently mangled by the API rather than rejected. Given
  // that sharp edge, and that word position barely matters for short fields
  // like "Pepper Pike" anyway, tier 3 stays as plain equal-priority attributes.
  searchableAttributes: [
    "name",
    "cuisines",
    "neighborhood,area,city,state",
    "unordered(address)",
  ],

  // Facets. cuisines is the hard requirement from the brief; the rest cover
  // the "browse by cuisine, location, price, rating" discovery persona.
  // searchable(...) turns on in-facet search, needed for cuisines (114
  // distinct values after the split) and neighborhood (1000+ distinct
  // values) where a flat checkbox list wouldn't be usable.
  // stars_count is filterOnly rather than a full facet: it's a near-continuous
  // rating (29 distinct values, e.g. 4.1, 4.2, 4.3...), so it's better suited
  // to a "4+ stars" style numeric filter than a faceted checkbox list.
  attributesForFaceting: [
    "searchable(cuisines)",
    "searchable(neighborhood)",
    "city",
    "price",
    "dining_style",
    "payment_options",
    "filterOnly(stars_count)",
  ],

  // Custom ranking: tie-breaker for records that are otherwise equally
  // relevant (same text match quality, same geo distance). stars_count comes
  // first so a higher-rated place wins ties before a merely more-reviewed one.
  customRanking: ["desc(stars_count)", "desc(reviews_count)"],

  // Typo tolerance: restaurant names are proper nouns people misremember or
  // fat-finger, this is what lets "Nubo" find "Nobu". Defaults are a
  // deliberate choice, not an oversight: 1 typo allowed for words >= 4 chars,
  // 2 typos for words >= 8, so short words like "Rye" aren't fuzzy-matched
  // into something unrelated.
  typoTolerance: true,
  minWordSizefor1Typo: 4,
  minWordSizefor2Typos: 8,

  // Ranking formula, written out explicitly even though it matches Algolia's
  // default, so the priority order is a visible decision: typo tolerance
  // first, then geo distance, then text relevance signals, then custom
  // ranking last. Geo outranks custom ranking so "close and 4 stars" beats
  // "far and 4.5 stars" once a user's location is available (wired in during
  // the core search logic chunk); stars/reviews only break ties within that.
  ranking: [
    "typo",
    "geo",
    "words",
    "filters",
    "proximity",
    "attribute",
    "exact",
    "custom",
  ],
};

// ---- Push settings + records to Algolia ----
async function run() {
  const client = algoliasearch(APP_ID, ADMIN_KEY);
  const index = client.initIndex(INDEX_NAME);

  console.log(`Applying index settings to "${INDEX_NAME}"...`);
  await index.setSettings(INDEX_SETTINGS);
  console.log("Settings applied.");

  console.log(`Indexing ${records.length} records into "${INDEX_NAME}"...`);
  const { objectIDs } = await index.saveObjects(records);
  console.log(`Done. Indexed ${objectIDs.length} records.`);
}

run().catch((err) => {
  console.error("Indexing failed:", err);
  process.exit(1);
});
