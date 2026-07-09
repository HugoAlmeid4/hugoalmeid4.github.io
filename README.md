# hugoalmeid4.github.io

Personal website and blog of **Hralmeida**. Static site hosted on **GitHub Pages**.

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Home — bio, socials, latest posts (loads `posts.js`) |
| `gallery.html` | Astrophotography gallery (loads from `gallery/index.json`) |
| `certificates.html` | Course certifications (loads from `certificates/index.json`, uses `pdf.js`) |
| `now.html` | What I'm currently focused on (manual HTML, edit when your "now" changes) |
| `cv.html` | Printable résumé — view in browser, "Print → Save as PDF" to export, or click the download link at the top |

## Authoring content

### New blog post

1. Create `posts/<slug>.md` with YAML frontmatter:
   ```yaml
   ---
   title: Your post title
   date: 2025-08-01
   excerpt: One- or two-sentence summary used on the home card.
   tags: astro, black-holes              # optional, comma-separated
   author: Your name                      # optional
   banner_image: /posts/cover.jpg             # optional, hero at top of post
   banner_image_alt: Convective cloud...      # optional, screen-reader description
   banner_image_credit: Photo by ESA / Hubble # optional, attribution shown overlaid on the banner image
   banner_image_credit_url: https://...        # optional, makes the credit a clickable link (opens in new tab)
   ---
   ```
2. Push to `main`. GitHub Actions runs `generate-rss.js`, which regenerates `posts/index.json` and `rss.xml` and commits them back. The post will appear on the home page automatically.

`banner_image` is a per-post cover image — upload it via `/admin` (Sveltia CMS → **Posts (Blog)** form), or commit an image under `posts/` and reference it as `/posts/<file>`. Editors remember and edit the path through the same field, so existing posts get a banner just by setting it.

### New certificate

1. Create `certificates/<slug>.md` with frontmatter:
   ```yaml
   ---
   name: Course Name
   issuer: Organisation
   bio: One-sentence description
   issue_date: 2025-01-15            # optional
   expiry_date: -                    # optional
   credential_id: ABC-123            # optional
   credential_url: https://...       # optional
   file: certificates/<slug>.pdf     # optional, for preview thumbnail
   ---
   ```
2. Regenerate the index locally: `node certificates/update-index.js`. (The home page reads `certificates/index.json`.)
3. Commit the new file and the regenerated JSON.

### New gallery image

1. Place the file under `gallery/<category>/` (e.g. `gallery/galaxies/m104.jpg`).
2. Add an entry to `gallery/index.json`:
   ```json
   { "src": "gallery/galaxies/m104.jpg", "alt": "M104 Sombrero Galaxy", "title": "M104 — Sombrero", "category": "galaxies" }
   ```
3. Reload — no build step needed.

## Editing "Now"

`now.html` is a single static file. Update the `<time datetime="...">` near the top to the current month, swap bullet points, and commit.

## Editing CV

`cv.html` is the source of truth. The download link uses `download="Hralmeida-CV.html"`. To export to PDF: open `cv.html` in a browser and choose **Print → Save as PDF** (print stylesheet hides the nav, theme toggle, etc.).

## Editing the site banner

A dismissable strip at the very top of every page, rendered by `banner.js` from `data/banner.json`. Editable from `/admin` (Sveltia CMS → **Banner**). Toggle **`enabled`** to publish, write the message per language, add an optional click-through URL, optionally enable **`dismissable`** to give visitors a × button.

- Banner stays off until `enabled` is true and the active language has text.
- Empty fields are skipped silently — leave a language blank to suppress the banner in that locale.
- Dismiss state is versioned (hash of `en` text + URL) so editing either re-shows the banner to previously-dismissed users. Stop editing and the dismissal sticks across visits and language switches.

## Tech notes

- **No build step** for the site itself. Only `generate-rss.js` and `certificates/update-index.js` run at build / commit time.
- **No framework.** Vanilla HTML / CSS / JS. Translations (en / pt / es) are defined in `posts.js`.
- **Theme** is stored in `localStorage.theme` (`"light"` or `"dark"`). Defaults to dark on first load.
- **Languages** UI: en, pt, es — switch via the language dropdown next to the search icon.
- **Post overlay** styles (lightbox, language menu, archive overlay) currently live in a runtime `<style>` injected by `posts.js`. (`posts.css` extraction is a planned refactor.)
- **`defer`** is used on `<script>` tags that depend on the document being parsed first (Prism, PDF.js). Inline `<script>` tags set the theme synchronously to avoid a flash.

## Deploy

- Pushes to `main` automatically deploy via GitHub Pages.
- The `Generate RSS & Index` workflow rebuilds `rss.xml` and `posts/index.json` whenever `posts/**.md` or `generate-rss.js` is updated.
