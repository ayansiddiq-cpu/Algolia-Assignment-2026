/* global __ALGOLIA_APP_ID__, __ALGOLIA_SEARCH_API_KEY__, __ALGOLIA_INDEX_NAME__ */
// Unstyled reset theme: gives InstantSearch widgets correct layout mechanics
// (checkbox lists, pagination, etc.) without imposing a default visual
// style. Chunk 3 replaces the look and feel; this just keeps things usable
// in the meantime.
import "instantsearch.css/themes/reset-min.css";
import algoliasearch from "algoliasearch/lite";
import instantsearch from "instantsearch.js";
import {
  searchBox,
  hits,
  refinementList,
  numericMenu,
  stats,
  pagination,
  clearRefinements,
  currentRefinements,
  configure,
} from "instantsearch.js/es/widgets";

// __ALGOLIA_APP_ID__ / __ALGOLIA_SEARCH_API_KEY__ / __ALGOLIA_INDEX_NAME__ are
// injected at build time by vite.config.js. `algoliasearch/lite` is the
// search-only build InstantSearch recommends for front-end bundles, it
// excludes indexing/admin methods we don't need in the browser.
const searchClient = algoliasearch(__ALGOLIA_APP_ID__, __ALGOLIA_SEARCH_API_KEY__);

const search = instantsearch({
  indexName: __ALGOLIA_INDEX_NAME__,
  searchClient,
});

search.addWidgets([
  // hitsPerPage here, not in the UI: keeping page size fixed is one less
  // control competing for attention in a demo that's meant to stay simple.
  configure({
    hitsPerPage: 12,
  }),

  searchBox({
    container: "#searchbox",
    placeholder: "Search by name, cuisine, or neighborhood…",
    showSubmit: false,
    showReset: true,
  }),

  stats({
    container: "#stats",
    templates: {
      text(data, { html }) {
        if (data.hasNoResults) {
          return html`No restaurants found`;
        }
        const noun = data.hasOneResult ? "restaurant" : "restaurants";
        return html`${data.nbHits.toLocaleString()} ${noun} found`;
      },
    },
  }),

  currentRefinements({
    container: "#current-refinements",
  }),

  clearRefinements({
    container: "#clear-refinements",
    templates: {
      resetLabel() {
        return "Clear all filters";
      },
    },
  }),

  // Cuisine: the one required facet from the brief. searchable: true relies
  // on searchable(cuisines) from the Chunk 1 index settings, without it
  // Algolia would reject facet-search queries against this attribute.
  refinementList({
    container: "#cuisine-list",
    attribute: "cuisines",
    searchable: true,
    searchablePlaceholder: "Search cuisines…",
    limit: 8,
    showMore: true,
    showMoreLimit: 40,
  }),

  // Neighborhood: same reasoning as cuisines, 1000+ distinct values means a
  // plain checkbox list isn't usable without in-widget search.
  refinementList({
    container: "#neighborhood-list",
    attribute: "neighborhood",
    searchable: true,
    searchablePlaceholder: "Search neighborhoods…",
    limit: 8,
    showMore: true,
    showMoreLimit: 40,
  }),

  // Price is numeric (2/3/4) with only 3 distinct values, a plain
  // refinementList works fine without facet search. transformItems relabels
  // the raw numbers into something a diner recognizes at a glance.
  refinementList({
    container: "#price-list",
    attribute: "price",
    sortBy: ["name:asc"],
    transformItems(items) {
      const labels = {
        2: "$$ · $30 and under",
        3: "$$$ · $31 to $50",
        4: "$$$$ · $50 and over",
      };
      return items.map((item) => {
        const label = labels[item.label] || item.label;
        // The default item template renders `highlighted`, not `label` (it's
        // meant for facet-search match highlighting) so both need updating,
        // otherwise the raw "2"/"3"/"4" still shows up on screen.
        return { ...item, label, highlighted: label };
      });
    },
  }),

  refinementList({
    container: "#dining-style-list",
    attribute: "dining_style",
  }),

  refinementList({
    container: "#payment-list",
    attribute: "payment_options",
  }),

  // stars_count was set to filterOnly() in Chunk 1, not a full facet, so it
  // has no facet values/counts for a refinementList to render. numericMenu
  // is the right fit: it applies a numericFilter (e.g. stars_count >= 4)
  // rather than enumerating facet values, which is exactly what filterOnly
  // supports.
  numericMenu({
    container: "#rating-list",
    attribute: "stars_count",
    items: [
      { label: "Any rating" },
      { label: "4.5 & up", start: 4.5 },
      { label: "4 & up", start: 4 },
      { label: "3.5 & up", start: 3.5 },
      { label: "3 & up", start: 3 },
    ],
  }),

  hits({
    container: "#hits",
    // Chain disambiguation (Persona 1 pain point, UX guide §3): 21 restaurant
    // names in this dataset have 2 locations each (e.g. "Town", "Sienna").
    // When two+ results on the current page share a name, flag them so the
    // template below can surface neighborhood prominently instead of a
    // known-item searcher guessing which "Town" they meant. Scoped to the
    // current page only, on purpose: two same-named results on different
    // pages aren't ambiguous to whoever's looking at page 1.
    transformItems(items) {
      const nameCounts = {};
      items.forEach((item) => {
        nameCounts[item.name] = (nameCounts[item.name] || 0) + 1;
      });
      return items.map((item) => ({
        ...item,
        isDuplicateName: nameCounts[item.name] > 1,
      }));
    },
    templates: {
      item(hit, { html, components }) {
        return html`
          <article class="hit">
            <h3 class="hit__name">
              ${components.Highlight({ hit, attribute: "name" })}
              ${hit.isDuplicateName
                ? html`<span class="hit__badge">${hit.neighborhood}</span>`
                : ""}
            </h3>
            <p class="hit__meta">
              ${hit.food_type} · ${hit.neighborhood} · ${hit.price_range}
            </p>
            <p class="hit__rating">
              ${hit.stars_count ? `${hit.stars_count.toFixed(1)}★` : "Not yet rated"}
              (${hit.reviews_count.toLocaleString()} reviews)
            </p>
          </article>
        `;
      },
      // Covers the "misspelled" and "ambiguous, over-filtered" cases: typo
      // tolerance (Chunk 1) already recovers most near-misses server-side,
      // this is what a user sees on the genuine zero-result tail, with a
      // clear next action instead of a dead end.
      empty(results, { html }) {
        return html`
          <div class="hits__empty">
            <p>No restaurants matched "${results.query}".</p>
            <p>Try a different spelling, a broader term, or clear your filters below.</p>
          </div>
        `;
      },
    },
  }),

  pagination({
    container: "#pagination",
  }),
]);

search.start();

// ---- Geo-aware ranking (UX guide §1) ----
// aroundRadius: "all" sorts by distance without excluding anything, so a
// great match 15 miles away is ranked lower, not hidden, per the guide's
// explicit recommendation for a discovery app like this one (as opposed to
// aroundLatLng's default radius, which would filter far results out
// entirely). Geo is already the second criterion in the `ranking` array
// from Chunk 1, so turning this on doesn't require touching index settings,
// it just supplies the point to rank distance from.
//
// Geolocation is requested immediately and automatically, not gated behind
// a button: the page is fully usable either way while it resolves or if
// it's denied, so there's no real cost to asking upfront, and it matches
// how OpenTable/Yelp/Google Maps behave. Nothing here blocks the initial
// search, `search.start()` above already ran and rendered results before
// this permission prompt could possibly resolve.
let geoLabel = "";

function applyGeoConfigure(params, label) {
  geoLabel = label;
  search.addWidgets([configure(params)]);
  updateDiscoverHeading();
}

function useIPFallback() {
  // Coarser, silent fallback: keeps some location relevance without
  // asking the user again or showing an error. This is the "thoughtful
  // fallback" both the brief and the UX guide call out explicitly, covering
  // denied permission, no Geolocation API, and errors/timeouts alike.
  applyGeoConfigure({ aroundLatLngViaIP: true, aroundRadius: "all" }, " in your area");
}

if (!navigator.geolocation) {
  useIPFallback();
} else {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      applyGeoConfigure(
        { aroundLatLng: `${latitude},${longitude}`, aroundRadius: "all" },
        " near you"
      );
    },
    () => useIPFallback(), // denied, unavailable, or errored
    { timeout: 8000, maximumAge: 5 * 60 * 1000, enableHighAccuracy: false }
  );
}

// ---- Discovery-persona empty state + geo label (UX guide §3) ----
// One line doing two jobs: before any query is typed, it gives the
// browsing persona something to react to ("Top-rated restaurants...")
// instead of a blank results panel; once geo resolves, the same line
// quietly picks up the location context ("...near you" / "...in your
// area"). It disappears entirely once there's an active query, the stats
// widget's "N restaurants found" already covers that case, and showing
// both at once would be redundant.
function updateDiscoverHeading() {
  const el = document.querySelector("#discover-heading");
  if (!el || !search.helper) return;
  const isBrowsing = search.helper.state.query === "";
  el.hidden = !isBrowsing;
  el.textContent = `Top-rated restaurants${geoLabel}`;
}

search.on("render", () => {
  updateDiscoverHeading();

  // The mobile filter panel's close button doubles as a live result count
  // (UX guide §2, principle 2: counts should be visible and update live),
  // so closing the panel isn't a leap of faith about what changed.
  const nbHits = search.helper?.lastResults?.nbHits ?? 0;
  const closeBtn = document.querySelector("#filter-close");
  if (closeBtn) {
    closeBtn.textContent = `Show ${nbHits.toLocaleString()} result${nbHits === 1 ? "" : "s"}`;
  }
});

search.once("render", () => {
  // Persona 1 (known-item searchers): no unnecessary steps between landing
  // and typing a name, per the UX guide's §3.
  document.querySelector(".ais-SearchBox-input")?.focus();
});

// ---- Mobile filter panel (UX guide §2.5) ----
// A partial-height slide-up sheet, not a full sidebar squeezed onto a small
// screen and not a full-screen takeover: keeping the results toolbar
// visible above it means a diner can see how their filter choices are
// landing without leaving the panel, closer to the guide's Amazon-style
// browsing comparison than an Airbnb-style single-intent filter screen.
// CSS handles the desktop/mobile split (see index.css); this just wires the
// open/close interaction, reusing the exact same filter widgets rather than
// mounting a second copy of them for mobile.
const filtersPanel = document.querySelector("#search-layout__filters");
const filterBackdrop = document.querySelector("#filter-backdrop");

function openFilterPanel() {
  filtersPanel.classList.add("is-open");
  filterBackdrop.classList.add("is-open");
  document.body.classList.add("filter-panel-open");
}

function closeFilterPanel() {
  filtersPanel.classList.remove("is-open");
  filterBackdrop.classList.remove("is-open");
  document.body.classList.remove("filter-panel-open");
}

document.querySelector("#filter-toggle")?.addEventListener("click", openFilterPanel);
document.querySelector("#filter-close")?.addEventListener("click", closeFilterPanel);
filterBackdrop?.addEventListener("click", closeFilterPanel);
