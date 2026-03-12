/**
 * app.js — Downloads Site
 * Works on both index.html (grid) and download.html (detail).
 *
 * GitHub repo structure expected:
 *   <DOWNLOADS_FOLDER>/
 *     <subfolder-name>/
 *       <any-file>          ← the downloadable file
 *       description.txt     ← one-liner description shown in the card
 */

(function () {
  "use strict";

  /* ─── Config (set in the <script> block in index.html / mirrored in download.html) ─── */
  const USER   = typeof GITHUB_USER      !== "undefined" ? GITHUB_USER      : "YOUR_USERNAME";
  const REPO   = typeof GITHUB_REPO      !== "undefined" ? GITHUB_REPO      : "YOUR_REPO";
  const FOLDER = typeof DOWNLOADS_FOLDER !== "undefined" ? DOWNLOADS_FOLDER : "downloads";
  const TITLE  = typeof SITE_TITLE       !== "undefined" ? SITE_TITLE       : "Downloads";
  const TAGLINE= typeof SITE_TAGLINE     !== "undefined" ? SITE_TAGLINE     : "";

  const RAW_BASE = `https://raw.githubusercontent.com/${USER}/${REPO}/main`;
  const API_BASE = `https://api.github.com/repos/${USER}/${REPO}/contents`;
  const GH_URL   = `https://github.com/${USER}/${REPO}`;

  /* ─── Shared DOM helpers ─── */
  function $(id) { return document.getElementById(id); }
  function show(el) { el && el.classList.remove("hidden"); }
  function hide(el) { el && el.classList.add("hidden"); }

  /* ─── Apply shared branding ─── */
  function applyBranding() {
    document.title = isDetailPage()
      ? `הורדה — ${TITLE}`
      : `${TITLE} — הורדות`;

    const titleEl = $("site-title");
    if (titleEl && !isDetailPage()) titleEl.textContent = TITLE;

    const ghLink = $("gh-link");
    if (ghLink) ghLink.href = GH_URL;

    const footerGh = $("footer-gh");
    if (footerGh) footerGh.href = GH_URL;

    const yearEl = $("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    const footerCopy = $("footer-copy");
    if (footerCopy) {
      footerCopy.innerHTML = `© <span id="year">${new Date().getFullYear()}</span> ${TITLE}`;
    }
  }

  function isDetailPage() {
    return window.location.pathname.includes("download.html");
  }

  /* ─── Fetch wrapper with error handling ─── */
  async function fetchJSON(url) {
    const res = await fetch(url, {
      headers: { Accept: "application/vnd.github+json" }
    });
    if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${res.url}`);
    return res.json();
  }

  /* ─── Format bytes ─── */
  function formatBytes(bytes) {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /* ─── Infer file extension tag ─── */
  function fileExt(name) {
    const parts = name.split(".");
    return parts.length > 1 ? parts.pop().toUpperCase() : "FILE";
  }

  /* ══════════════════════════════════════════════
     INDEX PAGE  —  grid of cards
  ══════════════════════════════════════════════ */
  async function initIndex() {
    applyBranding();

    $("hero-title").textContent = TITLE;
    $("hero-sub").textContent   = TAGLINE;

    const grid    = $("grid");
    const loading = $("loading");
    const empty   = $("empty");

    try {
      /* 1. List subfolders inside the downloads folder */
      const entries = await fetchJSON(`${API_BASE}/${FOLDER}`);
      const folders = entries.filter(e => e.type === "dir");

      if (folders.length === 0) {
        hide(loading);
        show(empty);
        return;
      }

      /* 2. For each subfolder, fetch its contents to find the file + description */
      const items = await Promise.all(
        folders.map(async folder => {
          try {
            const contents = await fetchJSON(`${API_BASE}/${FOLDER}/${folder.name}`);
            const descFile = contents.find(f =>
              f.type === "file" && f.name.toLowerCase() === "description.txt"
            );
            const downloadFile = contents.find(f =>
              f.type === "file" && f.name.toLowerCase() !== "description.txt"
            );

            let description = "";
            if (descFile) {
              /* fetch raw text content */
              const raw = await fetch(descFile.download_url);
              description = (await raw.text()).trim();
            }

            return {
              name:     folder.name,
              desc:     description || "אין תיאור זמין.",
              file:     downloadFile ? downloadFile.name : null,
              fileSize: downloadFile ? downloadFile.size : null,
            };
          } catch {
            return {
              name: folder.name,
              desc: "לא ניתן לטעון פרטים.",
              file: null,
              fileSize: null,
            };
          }
        })
      );

      hide(loading);

      /* 3. Render cards */
      items.forEach((item, i) => {
        const card = document.createElement("div");
        card.className = "card";
        card.style.animationDelay = `${0.05 * i}s`;
        card.innerHTML = `
          <div class="card-top">
            <span class="card-name">${escapeHtml(item.name)}</span>
            <span class="card-arrow">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4M9.5 2.5V8"/>
              </svg>
            </span>
          </div>
          <p class="card-desc">${escapeHtml(item.desc)}</p>
          ${item.file ? `<span class="card-tag">${fileExt(item.file)} · ${formatBytes(item.fileSize)}</span>` : ""}
        `;

        card.addEventListener("click", () => {
          const params = new URLSearchParams({
            folder: item.name,
            file:   item.file || "",
            desc:   item.desc,
          });
          window.location.href = `download.html?${params.toString()}`;
        });

        grid.appendChild(card);
      });

    } catch (err) {
      console.error(err);
      hide(loading);
      show(empty);
      empty.querySelector("span").textContent = "טעינת ההורדות נכשלה.";
      empty.querySelector("p").textContent = err.message;
    }
  }

  /* ══════════════════════════════════════════════
     DETAIL PAGE  —  single download
  ══════════════════════════════════════════════ */
  async function initDetail() {
    applyBranding();

    const params  = new URLSearchParams(window.location.search);
    const folder  = params.get("folder");
    const fileName= params.get("file");
    const desc    = params.get("desc");

    const loading = $("loading");
    const content = $("detail-content");
    const errorEl = $("error-state");

    if (!folder) {
      hide(loading);
      show(errorEl);
      $("error-msg").textContent = "לא צוינה הורדה. נסה לחזור ולבחור קובץ.";
      return;
    }

    try {
      /* If filename was passed via query param, use it directly.
         Otherwise re-fetch the folder contents to discover it. */
      let resolvedFile = fileName;
      let fileSize = null;

      if (!resolvedFile) {
        const contents = await fetchJSON(`${API_BASE}/${FOLDER}/${folder}`);
        const downloadFile = contents.find(f =>
          f.type === "file" && f.name.toLowerCase() !== "description.txt"
        );
        if (!downloadFile) throw new Error("לא נמצא קובץ להורדה בתיקייה זו.");
        resolvedFile = downloadFile.name;
        fileSize = downloadFile.size;
      } else {
        /* Optionally get exact size from API */
        try {
          const contents = await fetchJSON(`${API_BASE}/${FOLDER}/${folder}`);
          const match = contents.find(f => f.name === resolvedFile);
          if (match) fileSize = match.size;
        } catch { /* non-critical */ }
      }

      const rawUrl = `${RAW_BASE}/${FOLDER}/${folder}/${resolvedFile}`;
      const ghFileUrl = `${GH_URL}/blob/main/${FOLDER}/${folder}/${resolvedFile}`;

      /* Update page title */
      document.title = `${folder} — ${TITLE}`;

      $("detail-name").textContent = folder;
      $("detail-desc").textContent = desc || "אין תיאור זמין.";
      $("file-name").textContent   = resolvedFile;
      $("file-size").textContent   = fileSize ? formatBytes(fileSize) : "גודל לא ידוע";

      const btn = $("download-btn");
      btn.href     = rawUrl;
      btn.download = resolvedFile;
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        הורד את ${resolvedFile}
      `;

      const rawLink = $("raw-link");
      rawLink.href = ghFileUrl;
      rawLink.textContent = "צפייה בקובץ הגולמי ב-GitHub ←";

      hide(loading);
      show(content);

    } catch (err) {
      console.error(err);
      hide(loading);
      show(errorEl);
      $("error-msg").textContent = err.message;
    }
  }

  /* ─── Escape HTML to avoid XSS from filenames/descriptions ─── */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ─── Router ─── */
  if (isDetailPage()) {
    initDetail();
  } else {
    initIndex();
  }

})();