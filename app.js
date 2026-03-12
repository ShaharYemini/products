/**
 * app.js — Projects Site
 * Works on index.html (grid) and download.html (detail).
 * Configuration is in config.js — edit that file only.
 *
 * description.txt format:
 *   Line 1: תיאור קצר
 *   Line 2: https://... (אופציונאלי — קישור לריפו / לאתר)
 *   Line 3: web | download  (ברירת מחדל: download)
 *   Line 4: https://... (אופציונאלי — URL לתמונה)
 *   Line 5: כיתוב לתמונה (אופציונאלי)
 */

(function () {
  "use strict";

  /* ═══════════════════════════════════════════
     קריאת הגדרות מ-config.js
     ═══════════════════════════════════════════ */
  if (typeof SITE_CONFIG === "undefined") {
    console.error("config.js לא נטען. ודא שה-<script src='config.js'> מופיע לפני app.js");
  }
  const { USER, REPO, FOLDER, TITLE, TAGLINE, EMAIL } = (typeof SITE_CONFIG !== "undefined")
    ? SITE_CONFIG
    : { USER: "", REPO: "", FOLDER: "downloads", TITLE: "Projects", TAGLINE: "", EMAIL: "" };

  const RAW_BASE = `https://raw.githubusercontent.com/${USER}/${REPO}/main`;
  const API_BASE = `https://api.github.com/repos/${USER}/${REPO}/contents`;
  const GH_URL   = `https://github.com/${USER}/${REPO}`;

  /* ─── DOM helpers ─── */
  function $(id) { return document.getElementById(id); }
  function show(el) { el && el.classList.remove("hidden"); }
  function hide(el) { el && el.classList.add("hidden"); }

  /* ─── Theme toggle (persisted) ─── */
  function initTheme() {
    const saved = localStorage.getItem("theme") || "dark";
    document.documentElement.setAttribute("data-theme", saved);

    const btn = $("theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });
  }

  /* ─── Branding ─── */
  function applyBranding() {
    document.title = isDetailPage() ? `${TITLE}` : `${TITLE} — פרויקטים`;

    const titleEl = $("site-title");
    if (titleEl && !isDetailPage()) titleEl.textContent = TITLE;

    const ghLink = $("gh-link");
    if (ghLink) ghLink.href = GH_URL;
    const footerGh = $("footer-gh");
    if (footerGh) footerGh.href = GH_URL;
    const footerCopy = $("footer-copy");
    if (footerCopy) {
      footerCopy.innerHTML = `© ${new Date().getFullYear()} ${TITLE}`;
    }
    const footerEmail = $("footer-email");
    if (footerEmail) {
      if (EMAIL) {
        footerEmail.href  = `mailto:${EMAIL}`;
        footerEmail.title = EMAIL;
        footerEmail.textContent = EMAIL;
      } else {
        footerEmail.style.display = "none";
        const sep = footerEmail.previousElementSibling;
        if (sep) sep.style.display = "none";
      }
    }
  }

  function isDetailPage() {
    return window.location.pathname.includes("download.html");
  }

  /* ─── Fetch helpers ─── */
  async function fetchJSON(url) {
    const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
    return res.json();
  }

  function formatBytes(bytes) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("he-IL", { year: "numeric", month: "short", day: "numeric" });
  }

  function fileExt(name) {
    const parts = name.split(".");
    return parts.length > 1 ? parts.pop().toUpperCase() : "FILE";
  }

  /* ─── Parse description.txt ─── */
  function parseDesc(text) {
    const lines = text.trim().split("\n").map(l => l.trim());
    const desc      = lines[0] || "";
    const line2     = lines[1] || "";
    const typeRaw   = (lines[2] || "").toLowerCase();
    const imageUrl  = lines[3] || "";
    const imageCapt = lines[4] || "";

    const type    = typeRaw === "web" ? "web" : "download";
    const linkUrl = line2.startsWith("http") ? line2 : "";

    return { desc, linkUrl, type, imageUrl, imageCapt };
  }

  /* ══════════════════════════════════════════════
     INDEX PAGE — grid of cards
  ══════════════════════════════════════════════ */
  async function initIndex() {
    applyBranding();
    $("hero-title").textContent = TITLE;
    $("hero-sub").textContent   = TAGLINE;

    const grid    = $("grid");
    const loading = $("loading");
    const empty   = $("empty");

    try {
      const entries = await fetchJSON(`${API_BASE}/${FOLDER}`);
      const folders = entries.filter(e => e.type === "dir");

      if (folders.length === 0) { hide(loading); show(empty); return; }

      const items = await Promise.all(
        folders.map(async folder => {
          try {
            const contents = await fetchJSON(`${API_BASE}/${FOLDER}/${folder.name}`);
            const descFile    = contents.find(f => f.type === "file" && f.name.toLowerCase() === "description.txt");
            const previewFile = contents.find(f => f.type === "file" && /^preview\.(png|jpe?g|webp|gif)$/i.test(f.name));
            const dlFile      = contents.find(f => f.type === "file"
              && f.name.toLowerCase() !== "description.txt"
              && !/^preview\.(png|jpe?g|webp|gif)$/i.test(f.name));

            let meta = { desc: "אין תיאור זמין.", linkUrl: "", type: "download", imageUrl: "", imageCapt: "" };
            if (descFile) {
              const raw = await fetch(descFile.download_url);
              meta = parseDesc(await raw.text());
            }

            /* תמונת preview — מה-description או מהקובץ בתיקייה */
            const imageUrl  = meta.imageUrl  || (previewFile ? previewFile.download_url : "");
            const imageCapt = meta.imageCapt || "";

            /* תאריך עדכון אחרון — commit API */
            let updatedAt = null;
            try {
              const commits = await fetchJSON(
                `https://api.github.com/repos/${USER}/${REPO}/commits?path=${FOLDER}/${folder.name}&per_page=1`
              );
              if (commits && commits[0]) updatedAt = commits[0].commit.author.date;
            } catch { /* non-critical */ }

            return {
              name:        folder.name,
              desc:        meta.desc,
              linkUrl:     meta.linkUrl,
              type:        meta.type,
              imageUrl,
              imageCapt,
              file:        dlFile ? dlFile.name : null,
              fileSize:    dlFile ? dlFile.size : null,
              updatedAt,
            };
          } catch {
            return { name: folder.name, desc: "לא ניתן לטעון.", linkUrl: "", type: "download", imageUrl: "", imageCapt: "", file: null, fileSize: null, updatedAt: null };
          }
        })
      );

      hide(loading);

      items.forEach((item, i) => {
        const card = document.createElement("div");
        card.className = "card";
        card.style.animationDelay = `${0.05 * i}s`;

        const arrowSvg = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2.5 9.5L9.5 2.5M9.5 2.5H4M9.5 2.5V8"/></svg>`;

        const tagLabel = item.type === "web"
          ? (item.updatedAt ? `עודכן ${formatDate(item.updatedAt)}` : "")
          : (item.file
              ? `${fileExt(item.file)} · ${formatBytes(item.fileSize)}${item.updatedAt ? ` · עודכן ${formatDate(item.updatedAt)}` : ""}`
              : "");

        card.innerHTML = `
          ${item.imageUrl ? `<img class="card-image" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.style.display='none'">` : ""}
          <div class="card-top">
            <span class="card-name">${escapeHtml(item.name)}</span>
            <span class="card-arrow">${arrowSvg}</span>
          </div>
          <p class="card-desc">${escapeHtml(item.desc)}</p>
          ${tagLabel ? `<div class="card-footer"><span class="card-tag">${tagLabel}</span></div>` : ""}
        `;

        card.addEventListener("click", () => {
          const params = new URLSearchParams({
            folder:    item.name,
            file:      item.file || "",
            desc:      item.desc,
            linkUrl:   item.linkUrl || "",
            type:      item.type,
            imageUrl:  item.imageUrl  || "",
            imageCapt: item.imageCapt || "",
            updatedAt: item.updatedAt || "",
          });
          window.location.href = `download.html?${params.toString()}`;
        });

        grid.appendChild(card);
      });

    } catch (err) {
      console.error(err);
      hide(loading); show(empty);
      const span = empty.querySelector("span");
      if (span) span.textContent = "טעינת הפרויקטים נכשלה.";
    }
  }

  /* ══════════════════════════════════════════════
     DETAIL PAGE — single project
  ══════════════════════════════════════════════ */
  async function initDetail() {
    applyBranding();

    const params   = new URLSearchParams(window.location.search);
    const folder   = params.get("folder");
    const fileName = params.get("file");
    const desc     = params.get("desc");
    const linkUrl  = params.get("linkUrl") || "";
    const type     = params.get("type") || "download";
    const paramUpdatedAt = params.get("updatedAt") || "";

    const loading  = $("loading");
    const content  = $("detail-content");
    const errorEl  = $("error-state");

    if (!folder) {
      hide(loading); show(errorEl);
      $("error-msg").textContent = "לא צוין פרויקט. חזור ובחר שוב.";
      return;
    }

    try {
      let resolvedFile = fileName;
      let fileSize = null;
      let updatedAt = paramUpdatedAt || null;

      /* Fetch folder contents for metadata */
      const contents = await fetchJSON(`${API_BASE}/${FOLDER}/${folder}`);

      /* Get file info */
      if (!resolvedFile) {
        const dlFile = contents.find(f => f.type === "file"
          && f.name.toLowerCase() !== "description.txt"
          && !/^preview\.(png|jpe?g|webp|gif)$/i.test(f.name));
        if (!dlFile && type === "download") throw new Error("לא נמצא קובץ בתיקייה זו.");
        if (dlFile) { resolvedFile = dlFile.name; fileSize = dlFile.size; }
      } else {
        const match = contents.find(f => f.name === resolvedFile);
        if (match) fileSize = match.size;
      }

      /* Get last commit date — רק אם לא הגיע מה-params */
      if (!updatedAt) {
        try {
          const commits = await fetchJSON(
            `https://api.github.com/repos/${USER}/${REPO}/commits?path=${FOLDER}/${folder}&per_page=1`
          );
          if (commits && commits[0]) updatedAt = commits[0].commit.author.date;
        } catch { /* non-critical */ }
      }

      /* Get image + caption + linkUrl — params → description.txt → preview file */
      let imageUrl  = params.get("imageUrl")  || "";
      let imageCapt = params.get("imageCapt") || "";
      let resolvedLinkUrl = linkUrl;
      try {
        const descFile    = contents.find(f => f.type === "file" && f.name.toLowerCase() === "description.txt");
        const previewFile = contents.find(f => f.type === "file" && /^preview\.(png|jpe?g|webp|gif)$/i.test(f.name));
        if (descFile) {
          const raw = await fetch(descFile.download_url);
          const meta = parseDesc(await raw.text());
          if (!imageUrl)  imageUrl  = meta.imageUrl;
          if (!imageCapt) imageCapt = meta.imageCapt;
          if (!resolvedLinkUrl) resolvedLinkUrl = meta.linkUrl;
        }
        if (!imageUrl && previewFile) imageUrl = previewFile.download_url;
      } catch { /* non-critical */ }

      document.title = `${folder} — ${TITLE}`;
      $("detail-name").textContent = folder;
      $("detail-desc").textContent = desc || "אין תיאור זמין.";

      /* Image block */
      const imgWrap = $("detail-image-wrap");
      if (imgWrap) {
        if (imageUrl) {
          $("detail-image").src = imageUrl;
          $("detail-image").alt = folder;
          if (imageCapt) {
            const captEl = $("detail-image-caption");
            if (captEl) { captEl.textContent = imageCapt; show(captEl); }
          }
          show(imgWrap);
        } else {
          hide(imgWrap);
        }
      }

      /* Label on detail page */
      const labelEl = $("detail-label");
      if (labelEl) labelEl.textContent = type === "web" ? "אתר / פרויקט" : "להורדה";

      if (type === "web") {
        /* Website card */
        hide($("file-card"));
        const visitCard = $("visit-card");
        if (visitCard) {
          show(visitCard);
          const visitBtn = $("visit-btn");
          if (visitBtn && resolvedLinkUrl) visitBtn.href = resolvedLinkUrl;
          /* הצג URL + תאריך עדכון */
          const urlDisplay = $("site-url-display");
          if (urlDisplay) {
            try { urlDisplay.textContent = new URL(resolvedLinkUrl).hostname; } catch { urlDisplay.textContent = resolvedLinkUrl; }
          }
          const updEl = $("file-updated");
          if (updEl) updEl.textContent = updatedAt ? `עודכן ${formatDate(updatedAt)}` : "";
        }
        hide($("raw-link"));
        hide($("repo-source-link"));
      } else {
        /* Download card */
        show($("file-card"));
        hide($("visit-card"));

        const rawUrl    = `${RAW_BASE}/${FOLDER}/${folder}/${resolvedFile}`;
        const ghFileUrl = `${GH_URL}/blob/main/${FOLDER}/${folder}/${resolvedFile}`;

        $("file-name").textContent = resolvedFile || "—";
        $("file-size").textContent = fileSize ? formatBytes(fileSize) : "";
        const updEl = $("file-updated");
        if (updEl) updEl.textContent = updatedAt ? `עודכן ${formatDate(updatedAt)}` : "";

        const btn = $("download-btn");
        btn.href     = rawUrl;
        btn.download = resolvedFile;
        btn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          הורד — ${resolvedFile}
        `;

        const rawLink = $("raw-link");
        if (rawLink) { rawLink.href = ghFileUrl; show(rawLink); }

        const repoLinkEl = $("repo-source-link");
        if (repoLinkEl) {
          if (resolvedLinkUrl) { repoLinkEl.href = resolvedLinkUrl; show(repoLinkEl); }
          else hide(repoLinkEl);
        }
      }

      hide(loading); show(content);

    } catch (err) {
      console.error(err);
      hide(loading); show(errorEl);
      $("error-msg").textContent = err.message;
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ─── Init ─── */
  initTheme();
  if (isDetailPage()) initDetail(); else initIndex();

})();
