import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Starboard",
    short_name: "Starboard",
    description: "GitHub stars organizer — semantic search, radar, and bulk tagging.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#6366f1",
    icons: [],
  };
}
