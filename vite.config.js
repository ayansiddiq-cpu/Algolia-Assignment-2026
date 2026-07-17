import { defineConfig, loadEnv } from "vite";

// The .env file also holds ALGOLIA_ADMIN_API_KEY, which must never reach the
// browser bundle. We deliberately only forward the three client-safe values
// (app ID, search-only API key, index name) into `define`; the admin key is
// read exclusively by the Node-side scripts/prepare-and-index.js script and
// never passed through here.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "ALGOLIA_");

  return {
    define: {
      __ALGOLIA_APP_ID__: JSON.stringify(env.ALGOLIA_APP_ID),
      __ALGOLIA_SEARCH_API_KEY__: JSON.stringify(env.ALGOLIA_SEARCH_API_KEY),
      __ALGOLIA_INDEX_NAME__: JSON.stringify(env.ALGOLIA_INDEX_NAME),
    },
  };
});
