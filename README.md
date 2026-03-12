# Downloads Site

A clean, automatic downloads page powered by the GitHub API.  
No build step. No config file. Drop in a folder and it works.

---

## Setup

### 1. Clone or copy the site files into your repository root

```
your-repo/
├── index.html
├── download.html
├── style.css
├── app.js
└── downloads/          ← your downloads folder
    ├── My Tool/
    │   ├── my-tool.zip
    │   └── description.txt
    └── Another App/
        ├── another-app.exe
        └── description.txt
```

### 2. Edit the config block in `index.html`

Near the top of `index.html`, find this block and fill in your details:

```html
<script>
  const GITHUB_USER      = "your-username";
  const GITHUB_REPO      = "your-repo-name";
  const DOWNLOADS_FOLDER = "downloads";       // folder name in the repo
  const SITE_TITLE       = "My Project";      // shown as the page title
  const SITE_TAGLINE     = "Tools ready to download.";
</script>
```

### 3. Enable GitHub Pages

Go to **Settings → Pages** in your repository, set source to `main` branch, `/root`, and save.

Your site will be live at `https://your-username.github.io/your-repo/`

---

## Downloads folder structure

Each subfolder inside `downloads/` becomes one card on the homepage.

```
downloads/
└── My Tool/               ← subfolder name becomes the card title
    ├── my-tool-v1.zip     ← any file (this is what gets downloaded)
    └── description.txt    ← one short paragraph shown as the card description
```

**Rules:**
- The subfolder name is the display name shown on the card
- `description.txt` — optional, any plain text (one line or a short paragraph)
- Any other file in the subfolder = the downloadable file (first non-`description.txt` file wins)
- Subfolders with no downloadable file are still shown but the download button is hidden

---

## No build step required

The site fetches the GitHub Contents API at runtime to discover all subfolders automatically.  
Add a new subfolder → it appears on the site immediately, no redeployment needed.

---

## GitHub API rate limits

Unauthenticated requests are limited to **60/hour per IP**.  
For a personal portfolio or small project this is more than enough.  
If you expect heavy traffic, consider caching the API response with a Cloudflare Worker.
