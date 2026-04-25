import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Defaults are good for this app:
  // - in-memory queue for ISR (we have none)
  // - in-memory cache (we have none)
  // - workerd as runtime
});
