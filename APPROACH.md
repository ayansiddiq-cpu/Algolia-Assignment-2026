# Approach & Write-up

## Live demo
https://algolia-assignment-2026.vercel.app/

## Repo
https://github.com/ayansiddiq-cpu/Algolia-Assignment-2026

## What I built

A restaurant discovery experience for OpenTable, built on Algolia, using InstantSearch.js.
It covers both personas from the discovery notes: fast, forgiving search for people who
already know what they want, and a browse/discovery experience for people who don't.

Key pieces:
- A data prep script (`scripts/prepare-and-index.js`) that joins `restaurants_list.json`
  and `restaurants_info.csv` on `objectID`, cleans the data, and indexes ~5,000 restaurants
- Index configuration tuned for this dataset (searchable attributes, facets, custom
  ranking, typo tolerance)
- A search UI with text search, cuisine/neighborhood/price/rating/dining-style/payment
  filtering, geo-aware ranking with a fallback, and a few decisions aimed specifically at
  the two named personas

## Tooling note

The assignment's PDF and the GitHub README gave conflicting instructions on whether to use
InstantSearch.js or the raw JS Helper. I flagged this directly with Jacob and Eva rather
than guessing, and built with the JS Helper constraint until Jacob confirmed InstantSearch
was fine after all. I made that switch partway through for two reasons: it let me move
faster given my time budget, and using tested widgets over manual state management was the
better use of my time. My focus went into relevance tuning and the discovery experience
instead of reinventing search-state basics.

I used AI tools (Claude, and Claude Code for parts of the implementation) throughout this
build, the same way I use them day to day as an SE: to move faster, explore ideas, and
stress test. Every choice below, the data assumptions, the index config, the geo/persona/UX
decisions, is something I reasoned through.

## Data decisions

- **Join key:** `objectID`, a clean 1:1 match between both source files, handled in
  `scripts/prepare-and-index.js`.
- **Payment normalization:** collapsed to AMEX, Visa, Discover, MasterCard per the spec,
  with Diners Club and Carte Blanche folded into Discover. A few other raw values (JCB,
  Cash Only, Pay with OpenTable) fell outside the four required values and were dropped
  rather than force-mapped into a category that didn't fit.
- **Cuisine:** compound `food_type` values (e.g. "Global, International") were split into
  a `cuisines` array so each cuisine facets independently, rather than creating a single
  noisy combined bucket. The original `food_type` string is kept for display.
- **Price:** kept both the numeric `price` field (used for the actual facet, since it
  sorts and maps cleanly to `$`/`$$`/`$$$` labels) and the string `price_range` (kept for
  display only). Intentional redundancy, not an oversight.
- **Geo:** `_geoloc` was already correctly shaped in the source data, passed through as-is.

## Index configuration highlights

- **Searchable attributes**, in priority order: name, then cuisines, then a location tier
  (neighborhood/area/city/state, equal priority), then address last, to distinguish
  between locations.
- **Facets:** cuisine and neighborhood are facet-searchable (114 and 1,000+ distinct
  values respectively, too many for a flat checkbox list). Price, dining style, and
  payment options are plain facets. Star rating is `filterOnly`, since 29 distinct values
  is too granular for a faceted checkbox list, it powers a "4+ stars" style numeric filter
  instead.
- **Custom ranking:** `desc(stars_count)`, then `desc(reviews_count)` as a secondary
  tiebreaker. Because this only applies after ratings tie, the wide spread in review
  counts across the dataset doesn't dominate the ranking on its own.
- **Typo tolerance:** left at Algolia's defaults, a good fit for misremembered or
  misspelled restaurant names without overdoing it on short words.

## Geo-aware ranking and fallback

Used `aroundLatLng` with `aroundRadius: "all"` rather than a hard radius filter, this
ranks by distance without excluding anything, so a great restaurant further away still
shows up, just ranked below a closer one of similar quality.

Fallback behavior: the app never blocks on the location permission prompt, results render
immediately regardless. If geolocation is denied, unavailable, or times out (8-second
cap), it falls back silently to IP-based location (`aroundLatLngViaIP`) rather than
showing an error or a dead end.

## Persona-specific decisions

- **Known-item search:** typo tolerance and highlighting handle misspellings and partial
  names. For restaurant chains with multiple locations, results sharing a name get a small
  neighborhood badge so they're distinguishable at a glance, this was checked against the
  real dataset (21 restaurant names appear at two different locations each) rather than
  assumed.
- **Discovery browsing:** an empty-query state shows a "top-rated restaurants near/in your
  area" heading rather than a blank panel, and the default custom ranking already surfaces
  genuinely good results with no query or filters applied.
- **Mobile:** filters live in a slide-up panel on small screens (with a live-updating
  "Show N results" button) rather than a shrunk-down version of the desktop sidebar.

## A few explicit choices

- **No restaurant photos**, despite `image_url` being available in the dataset. Adding
  them would have moved the design closer to a recreation of the provided mock-up, and it
  introduces a real, avoidable risk (hotlinked third-party images that could fail to load
  mid-conversation).
- Visual design departs from the mock-up (different accent color, typographic ratings
  instead of star icons, a visible app title).

## What I'd improve with more time

- A proper sort control (e.g. by rating, distance, or price) that composes with active
  filters, right now sorting is entirely driven by the default ranking formula.
- A `city` facet. Left out deliberately since it wasn't marked `searchable()` in the
  current settings and would need one more index-config change I didn't want to make
  without full re-verification given the time I had.
- More rigorous relevance testing across a wider set of representative queries (very
  broad, very ambiguous, deliberately misspelled chain names) beyond what I was able to
  spot-check.
- A lightweight analytics/events wiring (Algolia Insights) to demonstrate how click and
  conversion data would feed back into ranking over time, out of scope for the time I had,
  but a natural next step for a real OpenTable engagement.
- More ways to visually differentiate restaurants in the results list, small cuisine icons
  or accent colors by category, to make scanning the list faster at a glance.
