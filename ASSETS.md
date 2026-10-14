# Development asset provenance

`frontend/public/images` contains original AI-generated stationery imagery created for this project's development storefront, then resized/compressed as WebP. The hero and the pens, journals, planners, art, desk, school, gifts, and books photographs were generated during implementation. `stationery-fallback.webp` reuses the hero. No third-party retailer images were scraped.

These illustrations/photos represent a sample catalog. They are not evidence of the exact physical merchandise sold, and they should be replaced with merchant-owned, accurate product photographs before public commercial launch. No generated customer portraits or invented reviews/purchases are presented as genuine.

Fraunces and DM Sans are served locally from the installed @fontsource packages; their bundled license files are retained in dependencies. Icons come from lucide-react. Keep dependency licenses when distributing/building the application.

Generated source artwork is held in the user's private Codex generated_images folder. The optimized public WebP assets are the application artifacts; the storefront does not depend on private absolute source paths.
