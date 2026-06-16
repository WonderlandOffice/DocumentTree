// =====================================================================
// DocumentTree.Plain — vanilla JS client for the DocumentTree public API
// =====================================================================
// Features:
//   • Lazy-loaded tree with collapse/expand
//   • Password-protected links
//   • Right-click / long-press multi-select (selection mode)
//   • Select all / deselect all / bulk ZIP download
//   • Search across the whole tree (auto-prefetches folders)
//   • Single-file preview & download
//
// Configure the endpoint below — point at your own DocumentTree API.
// =====================================================================

// Configuration — set in config.js (your ".env") which loads before this file.
// Lets you host DocumentTree on a different domain than the API (embedded
// "client" pages) and/or pin a default share token when the URL can't carry one.
const DT_CONFIG = (typeof window !== "undefined" && window.DOCUMENTTREE_CONFIG) || {};

// API endpoint resolution order:
//   1. config.js  → DOCUMENTTREE_CONFIG.apiBase   (e.g. "https://documenttree.nukepages.net")
//   2. legacy global window.DOCUMENTTREE_API_BASE (full ".../SourceLinks" URL)
//   3. same origin that serves this page (when API + viewer share a domain)
function resolveApiBase() {
    const cfg = (DT_CONFIG.apiBase || "").trim().replace(/\/+$/, "");
    if (cfg) return /\/SourceLinks$/i.test(cfg) ? cfg : `${cfg}/SourceLinks`;
    if (window.DOCUMENTTREE_API_BASE) return window.DOCUMENTTREE_API_BASE;
    return `${window.location.origin}/SourceLinks`;
}
const API_BASE = resolveApiBase();

// Languages the on-the-fly translator offers.
const LANGUAGES = [
    { code: "nl", name: "Nederlands", flag: "🇳🇱" },
    { code: "en", name: "English",    flag: "🇬🇧" },
    { code: "de", name: "Deutsch",    flag: "🇩🇪" },
    { code: "fr", name: "Français",   flag: "🇫🇷" },
    { code: "it", name: "Italiano",   flag: "🇮🇹" },
    { code: "es", name: "Español",    flag: "🇪🇸" }
];
const LANG_CODES = LANGUAGES.map(l => l.code);
const SUFFIX_RE  = new RegExp(`^(.+)_(${LANG_CODES.join("|")})$`, "i");

function parseToken(raw) {
    if (!raw) return { base: null, lang: null };
    const m = raw.match(SUFFIX_RE);
    if (m) return { base: m[1], lang: m[2].toLowerCase() };
    return { base: raw, lang: null };
}

// Inline SVG icons keep the project dependency-free.
const ICONS = {
    search:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
    close:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    chevron:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    folder:     '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>',
    folderOpen: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/><path d="M9 13l3 3 3-3" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    file:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
    preview:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    download:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>',
    check:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
    globe:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"/></svg>',
    chevDown:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    checkbox:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>',
    checkboxOn:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 12l2 2 4-4" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    select:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12l2 2 4-4"/></svg>',
    share:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>'
};

// =====================================================================
// FILE TYPE ICONS
// =====================================================================
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "avif"];
const VIDEO_EXTS = ["mp4", "webm", "mov", "avi", "mkv", "m4v", "ogv"];
const AUDIO_EXTS = ["mp3", "wav", "ogg", "m4a", "aac", "flac"];

function fileKind(item) {
    const ext = fileExt(item.Name);
    if (IMAGE_EXTS.includes(ext)) return "image";
    if (VIDEO_EXTS.includes(ext)) return "video";
    if (AUDIO_EXTS.includes(ext)) return "audio";
    return "doc";
}

function colouredFileIcon(label, color) {
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#ffffff" stroke="${color}" stroke-width="1.5"/>
        <path d="M14 2v6h6" fill="none" stroke="${color}" stroke-width="1.5"/>
        <rect x="4" y="13.5" width="16" height="6.5" rx="0.5" fill="${color}"/>
        <text x="12" y="18.5" text-anchor="middle" font-size="4" font-weight="700" font-family="-apple-system, Segoe UI, sans-serif" fill="#fff">${label}</text>
    </svg>`;
}

function fileExt(name) {
    const idx = (name || "").lastIndexOf(".");
    return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

function fileIconHtml(item) {
    const ext = fileExt(item.Name);

    if (IMAGE_EXTS.includes(ext) && item.PreviewUrl) {
        const thumbnailUrl = item.ThumbnailUrl || item.PreviewUrl;
        return `<span class="thumbnail-shell" data-preview-src="${escapeHtml(item.PreviewUrl)}" data-fallback-src="${escapeHtml(item.PreviewUrl)}">
            <span class="thumbnail-loader" aria-hidden="true"></span>
            <img class="tree-thumbnail" src="${escapeHtml(thumbnailUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" />
        </span>`;
    }

    if (ext === "pdf")                       return colouredFileIcon("PDF", "#e11d48");
    if (ext === "doc"  || ext === "docx")    return colouredFileIcon("DOC", "#2b579a");
    if (ext === "xls"  || ext === "xlsx")    return colouredFileIcon("XLS", "#0e7c3a");
    if (ext === "csv")                       return colouredFileIcon("CSV", "#0e7c3a");
    if (ext === "ppt"  || ext === "pptx")    return colouredFileIcon("PPT", "#d24726");

    return ICONS.file;
}

// =====================================================================
// TRANSLATION (Google Translate public endpoint, no key needed)
// =====================================================================
const TRANSLATE_CACHE   = new Map();
const TRANSLATE_PENDING = new Map();
const TRANSLATE_STORAGE = "dtplain:translate-cache";

// Restore previously-cached translations so subsequent visits with the same
// language show in the target language instantly (no Google Translate roundtrip).
(function loadPersistedCache() {
    try {
        const raw = localStorage.getItem(TRANSLATE_STORAGE);
        if (!raw) return;
        for (const [k, v] of Object.entries(JSON.parse(raw))) TRANSLATE_CACHE.set(k, v);
    } catch {}
})();

let persistTimer = null;
function persistCache() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
        try {
            // Cap stored entries to avoid unbounded growth.
            const entries = [...TRANSLATE_CACHE.entries()].slice(-1000);
            localStorage.setItem(TRANSLATE_STORAGE, JSON.stringify(Object.fromEntries(entries)));
        } catch {}
    }, 400);
}

async function translate(text, target) {
    if (!text || !target) return text;
    const key = `${target}:${text}`;
    if (TRANSLATE_CACHE.has(key))   return TRANSLATE_CACHE.get(key);
    if (TRANSLATE_PENDING.has(key)) return TRANSLATE_PENDING.get(key);

    const url = `https://translate.googleapis.com/translate_a/single`
        + `?client=gtx&sl=auto&tl=${encodeURIComponent(target)}`
        + `&dt=t&q=${encodeURIComponent(text)}`;

    const p = fetch(url)
        .then(r => r.json())
        .then(data => {
            const segments  = Array.isArray(data?.[0]) ? data[0] : [];
            const detected  = data?.[2];
            const out       = segments.map(s => Array.isArray(s) ? s[0] : "").filter(Boolean).join("");
            const result    = detected === target || !out ? text : out;
            TRANSLATE_CACHE.set(key, result);
            persistCache();
            return result;
        })
        .catch(() => text)
        .finally(() => TRANSLATE_PENDING.delete(key));

    TRANSLATE_PENDING.set(key, p);
    return p;
}

// Synchronous cache lookup so cached translations apply with no flash of
// the original text. Cache is hydrated from localStorage at startup.
function cachedTranslation(text) {
    if (!state.lang || !text) return null;
    return TRANSLATE_CACHE.get(`${state.lang}:${text}`) || null;
}

function applyTranslation(element, originalText) {
    if (!element) return;
    const cached = cachedTranslation(originalText);
    element.textContent = cached || originalText || "";
    if (cached || !state.lang || !originalText) return;
    const lang = state.lang;
    translate(originalText, lang).then(result => {
        if (state.lang === lang) element.textContent = result;
    });
}

function applyTranslationAttr(element, attr, originalText) {
    if (!element) return;
    const cached = cachedTranslation(originalText);
    element.setAttribute(attr, cached || originalText || "");
    if (cached || !state.lang || !originalText) return;
    const lang = state.lang;
    translate(originalText, lang).then(result => {
        if (state.lang === lang) element.setAttribute(attr, result);
    });
}

function selectLang(code) {
    if (!parsedToken.base) return;
    const newToken = code ? `${parsedToken.base}_${code.toUpperCase()}` : parsedToken.base;
    const url = new URL(window.location.href);
    url.searchParams.set("token", newToken);
    window.location.href = url.toString();
}

function renderLangSwitcher() {
    // The standalone page (top-bar + logo) ships a #lang-switcher host. When the
    // viewer is embedded into a host site that only provides #app, that host is
    // missing — create a floating one so placeLangSwitcher() can drop it into the
    // card header / action bar like everywhere else.
    let host = document.getElementById("lang-switcher");
    if (!host) {
        host = document.createElement("div");
        host.id = "lang-switcher";
        host.className = "top-actions";
        document.body.appendChild(host);   // parked; placeLangSwitcher() relocates it
    }

    const current = state.lang ? LANGUAGES.find(l => l.code === state.lang) : null;

    host.innerHTML = `
        <div class="lang-wrap">
            <button type="button" class="icon-btn lang"
                aria-label="${current ? `Language: ${current.name}` : "No translation"}"
                aria-haspopup="listbox" aria-expanded="false">
                ${ICONS.globe}
            </button>
            <div class="lang-menu" role="listbox" hidden>
                <button type="button" class="${!state.lang ? "active" : ""}" role="option" aria-selected="${!state.lang}">
                    <span class="flag" aria-hidden="true">${ICONS.globe}</span><span>—</span>
                </button>
                ${LANGUAGES.map(l => `
                    <button type="button" class="${l.code === state.lang ? "active" : ""}" role="option" aria-selected="${l.code === state.lang}" data-code="${l.code}">
                        <span class="flag" aria-hidden="true">${l.flag}</span><span>${l.name}</span>
                    </button>
                `).join("")}
            </div>
        </div>
    `;

    const wrap   = host.querySelector(".lang-wrap");
    const btn    = host.querySelector(".icon-btn.lang");
    const menu   = host.querySelector(".lang-menu");
    const items  = host.querySelectorAll(".lang-menu button");

    btn.onclick = () => {
        const open = !menu.hidden;
        menu.hidden = open;
        btn.setAttribute("aria-expanded", String(!open));
    };

    items.forEach((b, i) => {
        b.onclick = () => selectLang(i === 0 ? null : b.dataset.code);
    });

    document.addEventListener("mousedown", e => {
        if (!wrap.contains(e.target)) {
            menu.hidden = true;
            btn.setAttribute("aria-expanded", "false");
        }
    });
}

// =====================================================================
// STATE
// =====================================================================
const app          = document.getElementById("app");
// Token resolution: the URL ?token=… always wins; otherwise fall back to the
// token configured in config.js (for embedded pages that can't carry it in
// the URL). A language suffix (…_NL) is still parsed off whichever we use.
const rawToken     = new URLSearchParams(window.location.search).get("token")
                     || DT_CONFIG.token
                     || null;
const parsedToken  = parseToken(rawToken);
const token       = parsedToken.base;          // What we send to the API
const PW_KEY      = token ? `dtplain:pw:${token}` : null;
const TREE_CACHE_KEY = token ? `dtplain:tree:${token}` : null;

const state = {
    lang:            parsedToken.lang,         // null = no translation
    password:        "",
    tree:            null,                       // { Title, Description, Items, ViewType }
    viewType:        "DEFAULT",                  // "DEFAULT" tree or "GALLERY"
    childrenCache:   new Map(),                  // folderId -> items[]
    registry:        new Map(),                  // id -> { id, type, name, path, item }
    selectionMode:   false,
    selected:        new Set(),                  // selected ids
    expandedFolders: new Set(),                  // open folder ids (visual state)
    galleryStack:    [{ id: null, name: null }], // navigation stack for gallery view
    search:          { open: false, query: "" }
};

// =====================================================================
// INIT
// =====================================================================
const setVH = () => document.documentElement.style.setProperty("--app-vh", `${window.innerHeight}px`);
setVH();
window.addEventListener("resize", setVH);
window.addEventListener("orientationchange", setVH);

// Apply embedded mode up-front (covers the loading screen and the password
// prompt — before the API has told us the link is embedded). We trust two
// signals: the URL flag ?embed=1 set by the manager, and being framed by
// another page. The server response confirms / corrects this afterwards.
(function detectEmbeddedEarly() {
    const flag = new URLSearchParams(window.location.search).get("embed");
    const inFrame = (() => {
        try { return window.self !== window.top; } catch { return true; }
    })();
    if (flag === "1" || flag === "true" || inFrame) {
        document.body.classList.add("embedded-mode");
        state.isEmbedded = true;
    }
})();

// =====================================================================
// THEME (dark / light / system)
// =====================================================================
// Resolves the link's Theme setting to a concrete class on <html>:
//   • "DARK"   → always dark
//   • "LIGHT"  → always light
//   • "SYSTEM" → follow the OS preference (and live-update when it changes)
const _systemDarkMq = window.matchMedia("(prefers-color-scheme: dark)");
let _systemThemeListener = null;

function setThemeClass(dark) {
    const html = document.documentElement;
    html.classList.toggle("theme-dark", dark);
    html.classList.toggle("theme-light", !dark);
}

function applyTheme(mode) {
    const m = (mode || "SYSTEM").toString().toUpperCase();
    // Detach any previous system listener; only SYSTEM mode needs one.
    if (_systemThemeListener) {
        _systemDarkMq.removeEventListener("change", _systemThemeListener);
        _systemThemeListener = null;
    }
    if (m === "DARK")  { setThemeClass(true);  return; }
    if (m === "LIGHT") { setThemeClass(false); return; }
    // SYSTEM
    setThemeClass(_systemDarkMq.matches);
    _systemThemeListener = e => setThemeClass(e.matches);
    _systemDarkMq.addEventListener("change", _systemThemeListener);
}

// Resolve to the OS preference up-front so system-dark users don't flash light
// before the link's setting arrives. The API response refines this afterwards.
applyTheme("SYSTEM");

// Open the fullscreen lightbox. `arg` is either a single image URL (legacy
// callers — tree view) or an array of { url, name } so the user can flip
// through them with arrow keys / swipe / the on-screen prev / next buttons.
function openLightbox(arg, startIndex = 0) {
    const items = Array.isArray(arg)
        ? arg.filter(x => x && x.url)
        : (arg ? [{ url: arg, name: "" }] : []);
    if (!items.length) return;

    let index = Math.max(0, Math.min(startIndex, items.length - 1));
    const overlay = document.createElement("div");
    overlay.className = "lightbox-overlay";
    overlay.innerHTML = `
        <button class="lightbox-close" aria-label="Close">${ICONS.close}</button>
        ${items.length > 1 ? `
            <button class="lightbox-nav lightbox-prev" aria-label="Previous">${ICONS.chevron}</button>
            <button class="lightbox-nav lightbox-next" aria-label="Next">${ICONS.chevron}</button>
            <div class="lightbox-counter"></div>
        ` : ""}
        <div class="lightbox-loader" aria-hidden="true"></div>
        <img class="lightbox-image" alt="" referrerpolicy="no-referrer" />
    `;
    document.body.appendChild(overlay);

    const imgEl     = overlay.querySelector(".lightbox-image");
    const counterEl = overlay.querySelector(".lightbox-counter");

    const render = () => {
        const it = items[index];
        overlay.classList.add("is-loading");
        overlay.classList.remove("is-error");
        imgEl.alt = it.name || "";

        // Progressive load:
        //   1. Show the cheap thumbnail (~800px, often cached from the gallery
        //      grid) immediately so users see SOMETHING while the full-res
        //      preview downloads.
        //   2. In parallel, preload the high-res URL through a detached Image.
        //      When that finishes, swap the visible img.src to the high-res
        //      copy — the browser deduplicates the request so this is free.
        //   3. The spinner stays on until step 2 completes, so the user knows
        //      a sharper version is still on the way.
        const hasThumb = it.thumbUrl && it.thumbUrl !== it.url;
        if (hasThumb) {
            imgEl.src = it.thumbUrl;
        } else {
            // No thumbnail available — just point at the full URL right away
            // so the browser starts the only download we need.
            imgEl.src = it.url;
        }

        const target = it;
        const fullLoader = new Image();
        fullLoader.referrerPolicy = "no-referrer";
        fullLoader.onload = () => {
            if (items[index] !== target) return;
            imgEl.src = target.url;
            overlay.classList.remove("is-loading");
        };
        fullLoader.onerror = () => {
            if (items[index] !== target) return;
            overlay.classList.remove("is-loading");
            overlay.classList.add("is-error");
        };
        fullLoader.src = it.url;

        if (counterEl) counterEl.textContent = `${index + 1} / ${items.length}`;
    };
    const step = (delta) => {
        if (items.length < 2) return;
        index = (index + delta + items.length) % items.length;
        render();
    };

    const close = () => {
        overlay.remove();
        document.removeEventListener("keydown", onKey);
    };
    const onKey = e => {
        if (e.key === "Escape")     close();
        else if (e.key === "ArrowLeft")  step(-1);
        else if (e.key === "ArrowRight") step(+1);
    };
    document.addEventListener("keydown", onKey);

    overlay.addEventListener("click", e => {
        // Prev / next handlers manage themselves — don't let bubble close.
        if (e.target.closest(".lightbox-nav")) return;
        // Close button: explicit close.
        if (e.target.closest(".lightbox-close")) { close(); return; }
        // Click on dim area = close. Click on image = close too (lightbox convention).
        if (e.target === overlay || e.target === imgEl) close();
    });
    overlay.querySelector(".lightbox-prev")?.addEventListener("click", e => { e.stopPropagation(); step(-1); });
    overlay.querySelector(".lightbox-next")?.addEventListener("click", e => { e.stopPropagation(); step(+1); });

    // Swipe support — horizontal drag on the overlay flips images.
    let touchX = null;
    overlay.addEventListener("touchstart", e => { touchX = e.touches[0].clientX; }, { passive: true });
    overlay.addEventListener("touchend",   e => {
        if (touchX == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? touchX) - touchX;
        touchX = null;
        if (Math.abs(dx) > 40) step(dx < 0 ? +1 : -1);
    });

    render();
}

document.addEventListener("click", e => {
    if (state.selectionMode) return;                   // let the row toggle selection
    const thumb = e.target.closest(".tree-thumbnail");
    if (!thumb || !thumb.src) return;
    const shell = thumb.closest(".thumbnail-shell");
    e.preventDefault();
    e.stopPropagation();
    openLightbox(shell?.dataset.previewSrc || thumb.src);
}, true);   // capture so we beat the tree-left click handler

document.addEventListener("load", e => {
    if (!e.target.matches?.(".tree-thumbnail")) return;
    const img   = e.target;
    const shell = img.closest(".thumbnail-shell");
    if (!shell) return;

    // Progressive thumbnail upgrade: when a tile has a hi-res variant declared,
    // the first load event (the medium thumb) kicks off a hidden preload of
    // the large version. The spinner stays visible until the large image is
    // swapped in and fires its own load event — at which point we mark the
    // shell as fully loaded.
    const hires = img.dataset.hiresSrc;
    if (hires && img.dataset.hiresLoaded !== "true") {
        const pre = new Image();
        pre.referrerPolicy = "no-referrer";
        pre.onload = () => {
            img.dataset.hiresLoaded = "true";
            img.src = hires;
        };
        pre.onerror = () => {
            // Hi-res failed; settle for the medium version we already have.
            shell.classList.add("is-loaded");
        };
        pre.src = hires;
        return;
    }

    shell.classList.add("is-loaded");
}, true);

document.addEventListener("error", e => {
    const img = e.target;
    if (!img.matches?.(".tree-thumbnail")) return;

    const shell = img.closest(".thumbnail-shell");
    const fallback = shell?.dataset.fallbackSrc;
    if (fallback && !img.dataset.triedFallback && img.getAttribute("src") !== fallback) {
        img.dataset.triedFallback = "true";
        img.src = fallback;
        return;
    }

    shell?.classList.add("is-loaded", "is-error");
}, true);

renderLangSwitcher();

// Pre-warm UI strings so the password screen, action bar, etc. appear in the
// chosen language on first paint. Fire-and-forget — cache check is sync.
const UI_STRINGS = [
    "Loading your files…", "Error", "Something went wrong",
    "Password protected", "Enter password", "Open folder",
    "No files found", "No matches", "Empty folder", "Loading folder…",
    "Search files and folders…",
    "Select", "selected", "Select all", "Deselect all", "Download", "View", "Share", "Link copied",
    "Shared Folder"
];
if (state.lang) UI_STRINGS.forEach(s => translate(s, state.lang));

if (!token) {
    renderError("Missing token in URL");
} else {
    loadTree();
}

// =====================================================================
// NETWORK
// =====================================================================
function loadStoredPassword() {
    try {
        if (!PW_KEY) return "";
        // Prefer localStorage (survives reloads + tabs); fall back to
        // sessionStorage if an older version of this page stored it there.
        return localStorage.getItem(PW_KEY)
            || sessionStorage.getItem(PW_KEY)
            || sessionStorage.getItem(`pw_${token}`)   // legacy key
            || "";
    } catch { return ""; }
}
function storePassword(pw) {
    try {
        if (!PW_KEY) return;
        if (pw) {
            localStorage.setItem(PW_KEY, pw);
            sessionStorage.setItem(PW_KEY, pw);
        } else {
            localStorage.removeItem(PW_KEY);
            sessionStorage.removeItem(PW_KEY);
            sessionStorage.removeItem(`pw_${token}`);  // legacy key cleanup
        }
    } catch {}
}

// Applies a root entity (from publicLink) onto state + the surrounding chrome
// (embedded body class, lang switcher visibility). Does NOT render.
function applyRootEntity(entity) {
    state.tree = entity;
    state.viewType = (state.tree?.ViewType || "DEFAULT").toString().toUpperCase();
    state.isEmbedded = !!state.tree?.IsEmbedded;
    state.gallerySize = parseInt(state.tree?.GallerySize, 10) || 180;
    state.showTitle = state.tree?.ShowTitle !== false;
    state.showDescription = state.tree?.ShowDescription !== false;
    state.titleSize = parseInt(state.tree?.TitleSize, 10) || 21;
    state.descriptionSize = parseInt(state.tree?.DescriptionSize, 10) || 13;
    state.showDownload = state.tree?.ShowDownload !== false;
    state.showShare = state.tree?.ShowShare !== false;
    state.showLanguages = state.tree?.ShowLanguages !== false;
    state.showSelect = state.tree?.ShowSelect !== false;
    state.showSearch = state.tree?.ShowSearch !== false;
    state.languagesPlacement = (state.tree?.LanguagesPlacement || "TOP").toString().toUpperCase();
    state.selectPlacement = (state.tree?.SelectPlacement || "BOTTOM").toString().toUpperCase();
    state.searchPlacement = (state.tree?.SearchPlacement || "TOP").toString().toUpperCase();
    state.theme = (state.tree?.Theme || "SYSTEM").toString().toUpperCase();
    applyTheme(state.theme);
    document.body.classList.toggle("embedded-mode", state.isEmbedded);
    document.body.classList.toggle("view-gallery", state.viewType === "GALLERY");
    document.body.classList.toggle("view-default", state.viewType !== "GALLERY");
    const langHost = document.getElementById("lang-switcher");
    if (langHost) langHost.style.display = state.showLanguages ? "" : "none";
}

// Rebuilds the flat registry (used for search + selection) from the current
// tree + childrenCache, with correct breadcrumb paths.
function rebuildRegistry() {
    state.registry.clear();
    const walk = (items, path) => {
        for (const item of items || []) {
            registerItem(item, path);
            if (item.Type === "Folder" && state.childrenCache.has(item.Id)) {
                const childPath = path ? `${path} / ${item.Name}` : item.Name;
                walk(state.childrenCache.get(item.Id), childPath);
            }
        }
    };
    walk(state.tree?.Items || [], "");
}

// A stable fingerprint of the whole tree (id + type + name of every node,
// recursively). Changes when the cloud source adds / removes / renames items.
function treeSignature(rootItems, childrenCache) {
    const parts = [];
    const walk = (list) => {
        for (const it of (list || [])) {
            parts.push(`${it.Id}:${it.Type}:${it.Name || ""}`);
            if (it.Type === "Folder" && childrenCache.has(it.Id)) {
                walk(childrenCache.get(it.Id));
            }
        }
    };
    walk(rootItems);
    return parts.join("|");
}

// ---------------------------------------------------------------------------
// localStorage cache of the resolved tree (stale-while-revalidate).
// TREE_CACHE_KEY is declared near the top with the other token-derived consts
// so it's initialised before the initial loadTree() call (avoids a TDZ crash).
// ---------------------------------------------------------------------------

function writeTreeCache() {
    if (!TREE_CACHE_KEY || !state.tree) return;
    try {
        const payload = {
            v: 1,
            ts: Date.now(),
            entity: state.tree,
            children: [...state.childrenCache.entries()]
        };
        localStorage.setItem(TREE_CACHE_KEY, JSON.stringify(payload));
    } catch { /* quota exceeded — skip caching, app still works */ }
}

function readTreeCache() {
    if (!TREE_CACHE_KEY) return null;
    try {
        const raw = localStorage.getItem(TREE_CACHE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || data.v !== 1 || !data.entity) return null;
        return data;
    } catch { return null; }
}

function clearTreeCache() {
    if (!TREE_CACHE_KEY) return;
    try { localStorage.removeItem(TREE_CACHE_KEY); } catch {}
}

async function fetchPublicLink(password) {
    const res = await fetch(`${API_BASE}/publicLink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
    });
    return res.json();
}

// Walk every folder fresh (bypassing the in-memory cache) into a NEW map, so
// revalidation reflects the current cloud state without disturbing the tree
// the user is currently looking at.
async function fetchAllChildrenFresh(rootItems, into) {
    for (const item of rootItems || []) {
        if (item.Type !== "Folder") continue;
        let children = [];
        try {
            const res = await fetch(`${API_BASE}/children`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, folderId: item.Id, password: state.password })
            });
            const result = await res.json();
            if (result?.isSuccess) children = result.entity?.Items || [];
        } catch { /* leave empty; revalidation is best-effort */ }
        into.set(item.Id, children);
        await fetchAllChildrenFresh(children, into);
    }
}

async function loadTree(password = loadStoredPassword(), { useCache = true } = {}) {
    state.password = password;

    // 1. Instant paint from cache when we have one — feels cached.
    //    Skipped when the user just submitted a password (we must validate it).
    const cached = useCache ? readTreeCache() : null;
    if (cached) {
        applyRootEntity(cached.entity);
        state.childrenCache = new Map(cached.children || []);
        rebuildRegistry();
        renderApp();
        // Pre-warm translations for the cached names (search in other languages).
        if (state.lang) {
            for (const e of state.registry.values()) translate(e.name, state.lang);
        }
        // 2. Revalidate against the cloud in the background.
        revalidateTree();
        return;
    }

    // No cache → normal first load.
    renderLoading();
    try {
        const result = await fetchPublicLink(password);
        if (!result?.isSuccess) {
            if (result?.code === "401" || (result?.message || "").toLowerCase().includes("password")) {
                if (password) storePassword("");
                renderPassword(result?.message || "");
                return;
            }
            renderError(result?.message || "Unable to load public link");
            return;
        }
        storePassword(password);
        applyRootEntity(result.entity);
        for (const item of state.tree.Items || []) registerItem(item, "");
        renderApp();
        // Prefetch every folder so search works + we can cache the full tree.
        await prefetchSubtree(state.tree.Items || [], "");
        writeTreeCache();
    } catch (err) {
        console.error("loadTree", err);
        renderError("Failed to connect to API");
    }
}

// Background revalidation: re-fetch the whole tree fresh, diff it against what's
// on screen, and only re-render (+ re-cache) when the cloud source changed.
async function revalidateTree() {
    try {
        const result = await fetchPublicLink(state.password);
        if (!result?.isSuccess) {
            // Auth now fails (password / link changed) — drop cache + re-prompt.
            if (result?.code === "401" || (result?.message || "").toLowerCase().includes("password")) {
                clearTreeCache();
                if (state.password) storePassword("");
                renderPassword(result?.message || "");
            }
            // Otherwise a transient error — keep showing the cached tree.
            return;
        }
        storePassword(state.password);

        const freshRoot = result.entity;
        const freshChildren = new Map();
        await fetchAllChildrenFresh(freshRoot.Items || [], freshChildren);

        // Include the display settings in the fingerprint so an admin tweak
        // (view type, embedded, visible buttons…) also repaints live.
        const settingsSig = (e) => [
            e?.Title, e?.Description, e?.ViewType, e?.IsEmbedded, e?.GallerySize,
            e?.ShowTitle, e?.ShowDescription, e?.TitleSize, e?.DescriptionSize,
            e?.ShowDownload, e?.ShowShare,
            e?.ShowLanguages, e?.ShowSelect, e?.ShowSearch, e?.Theme,
            e?.LanguagesPlacement, e?.SelectPlacement, e?.SearchPlacement
        ].join("|");
        const oldSig = settingsSig(state.tree) + "§" + treeSignature(state.tree?.Items, state.childrenCache);
        const newSig = settingsSig(freshRoot) + "§" + treeSignature(freshRoot.Items, freshChildren);

        // Always refresh stored copy (settings like ViewType may have changed),
        // but only repaint the tree when the structure actually differs.
        applyRootEntity(freshRoot);
        state.childrenCache = freshChildren;
        rebuildRegistry();
        writeTreeCache();

        if (oldSig !== newSig) {
            // Preserve scroll position across the silent refresh.
            const scrollTop = app?.scrollTop || 0;
            renderApp();
            if (app) app.scrollTop = scrollTop;
        }
    } catch { /* network hiccup — cached tree stays */ }
}

async function loadChildren(folderId) {
    if (state.childrenCache.has(folderId)) return state.childrenCache.get(folderId);
    try {
        const res = await fetch(`${API_BASE}/children`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, folderId, password: state.password })
        });
        const result = await res.json();
        if (!result?.isSuccess) throw new Error(result?.message || "Failed loading folder");
        const items = result.entity?.Items || [];
        state.childrenCache.set(folderId, items);
        return items;
    } catch (err) {
        console.error("loadChildren", err);
        alert(err.message || "Failed loading folder");
        return [];
    }
}

async function downloadSelection() {
    if (state.selected.size === 0) return;
    const items = [...state.selected].map(id => {
        const e = state.registry.get(id);
        return { Id: e.id, Type: e.type };
    });

    // Swap the download icon for a spinner so the user knows we're working
    // — the API can take a few seconds to package a ZIP.
    const btn = document.getElementById("sel-dl");
    const originalSvg = btn ? btn.querySelector("svg") : null;
    const spinner = document.createElement("span");
    spinner.className = "mini-loader";
    spinner.style.cssText = "margin: 0; vertical-align: middle;";
    if (originalSvg) originalSvg.replaceWith(spinner);
    if (btn) { btn.disabled = true; btn.classList.add("loading"); }

    try {
        // Native browser download: submit a hidden form into a hidden iframe so
        // the browser streams the ZIP straight to disk. fetch()+blob() would
        // buffer the whole archive in page memory and fall over on large sets.
        downloadViaForm(items);
    } finally {
        // We can't reliably detect when the native download finishes, so just
        // restore the button shortly after kicking it off.
        setTimeout(() => {
            if (spinner.parentNode) spinner.replaceWith(originalSvg);
            if (btn) { btn.disabled = false; btn.classList.remove("loading"); }
        }, 1500);
    }
}

// Posts the download request as a regular form into a throwaway hidden iframe.
// The API responds with Content-Disposition: attachment, so the browser handles
// it as a normal download (streamed to disk) without any JS memory buffering.
function downloadViaForm(items) {
    const iframe = document.createElement("iframe");
    iframe.name = "dt-dl-" + Date.now();
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    const form = document.createElement("form");
    form.method = "POST";
    form.action = `${API_BASE}/downloadMultipleForm`;
    form.target = iframe.name;
    form.style.display = "none";

    const add = (name, value) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
    };
    add("token", token);
    add("password", state.password || "");
    add("items", JSON.stringify(items));
    add("fileName", downloadName(items));

    document.body.appendChild(form);
    form.submit();

    // Clean up the form + iframe after the download has surely started.
    setTimeout(() => { form.remove(); iframe.remove(); }, 60000);
}

function downloadName(items) {
    const sanitize = s => (s || "Download").replace(/[\\/:*?"<>|]+/g, "_").trim() || "Download";
    if (items.length === 1) {
        const e = state.registry.get(items[0].Id);
        if (!e) return "Download.zip";
        return items[0].Type === "Folder" ? `${sanitize(e.name)}.zip` : sanitize(e.name);
    }
    return `${sanitize(state.tree?.Title || "Download")}.zip`;
}

// Prefetches every folder recursively so search has the full tree available.
async function prefetchSubtree(items, path) {
    for (const item of items) {
        if (item.Type === "Folder") {
            const children = await loadChildren(item.Id);
            const nextPath = path ? `${path} / ${item.Name}` : item.Name;
            for (const c of children) registerItem(c, nextPath);
            await prefetchSubtree(children, nextPath);
        }
    }
}

function registerItem(item, parentPath) {
    state.registry.set(item.Id, {
        id:   item.Id,
        type: item.Type,
        name: item.Name || "",
        path: parentPath,
        item
    });
    // Pre-warm the translation cache so search can match the localized name too.
    if (state.lang && item.Name) translate(item.Name, state.lang);
}

// =====================================================================
// RENDER — main shell
// =====================================================================
function renderApp() {
    const showTitle = state.showTitle !== false;
    const showDesc  = state.showDescription !== false && !!state.tree?.Description;
    const searchOn  = state.showSearch !== false;
    const selectOn  = state.showSelect !== false;
    const langOn    = state.showLanguages !== false;

    // Per-control bar placement: TOP = card header, BOTTOM = the action bar at
    // the bottom of the card. Both zones live inside #app, so placement is
    // honoured even for embedded links (only the page chrome is stripped there).
    const searchTop = searchOn && state.searchPlacement === "TOP";
    const selectTop = selectOn && state.selectPlacement === "TOP";
    const langTop   = langOn && state.languagesPlacement === "TOP";
    state.searchInActions = searchOn && !searchTop;          // BOTTOM
    state.selectInActions = selectOn && !selectTop;          // BOTTOM

    // While selecting, the selection toolbar takes over the SELECT control's
    // zone — top header when Select is TOP, the bottom bar otherwise. So every
    // control marked TOP (incl. select-all / deselect-all / download) ends up
    // genuinely at the top.
    const selecting = state.selectionMode;
    const selectionInHeader = selecting && selectOn && state.selectPlacement === "TOP";

    // The card header zone renders if anything wants to live up top.
    const showHeader = showTitle || showDesc || searchTop || selectTop || langTop || selectionInHeader;
    app.classList.toggle("no-header", !showHeader);

    // The lang switcher may be parented inside #app (when bottom-placed). Park
    // it on <body> so the innerHTML wipe below doesn't destroy it.
    const savedLang = document.getElementById("lang-switcher");
    if (savedLang && app.contains(savedLang)) document.body.appendChild(savedLang);

    // Per-link title / description font sizes (the CSS scales the title down a
    // touch on mobile via these vars).
    app.style.setProperty("--title-size", `${state.titleSize || 21}px`);
    app.style.setProperty("--desc-size", `${state.descriptionSize || 13}px`);

    const headerControls = `
        ${searchTop ? `
            <button id="search-toggle" class="header-search-toggle${state.search.open ? " active" : ""}"
                aria-label="Search">${state.search.open ? ICONS.close : ICONS.search}</button>
            <input id="search-input" type="search" class="header-search-input"
                value="${escapeHtml(state.search.query)}" />
        ` : ""}
        ${selectTop ? `<button id="select-btn" class="bar-icon-btn header-select-btn" aria-label="Select">${ICONS.select}</button>` : ""}
    `;

    const headerMainInner = selectionInHeader
        ? selectionBarHTML()
        : `
            <div class="header-text">
                ${showTitle ? `<h2></h2>` : ""}
                ${showDesc  ? `<p class="desc"></p>` : ""}
            </div>
            ${headerControls}
          `;

    app.innerHTML = `
        ${showHeader ? `
            <div class="header${state.search.open && !selectionInHeader ? " search-open" : ""}${selectionInHeader ? " selection-mode" : ""}">
                <div class="header-main">
                    ${headerMainInner}
                </div>
            </div>
        ` : ""}
        <div class="tree-wrapper" id="tree"></div>
        <div class="container-actions" id="actions"></div>
    `;

    if (selectionInHeader) {
        wireSelectionBar(app.querySelector(".header"));
    } else {
        // Wire TOP-placed controls (the BOTTOM ones are wired by renderActions).
        if (searchTop) {
            document.getElementById("search-toggle").onclick = toggleSearch;
            const input = document.getElementById("search-input");
            input.oninput = e => { state.search.query = e.target.value; renderBody(); };
            applyTranslationAttr(input, "placeholder", "Search files and folders…");
            if (state.search.open) input.focus();
        }
        if (selectTop) {
            const sb = document.getElementById("select-btn");
            applyTranslationAttr(sb, "title", "Select");
            sb.onclick = () => enterSelectionMode();
        }

        const titleEl = app.querySelector(".header-text h2");
        if (titleEl) applyTranslation(titleEl, state.tree?.Title || "Shared Folder");
        const descEl = app.querySelector(".header-text .desc");
        if (descEl) applyTranslation(descEl, state.tree?.Description || "");
    }

    renderBody();
    renderActions();
    placeLangSwitcher();
    bindScrollEffects();
}

// Puts the #lang-switcher in the right zone for this link: the page top-bar
// (placement TOP, non-embedded) or the bottom action bar (placement BOTTOM, or
// any embedded link since the top-bar is hidden). Hidden when languages off.
function placeLangSwitcher() {
    const lang = document.getElementById("lang-switcher");
    if (!lang) return;
    if (state.showLanguages === false) { lang.style.display = "none"; return; }

    // While selecting, the selection toolbar takes over the Select control's
    // bar. Hide the language switcher if it shares that same bar.
    const selectZone = state.selectPlacement === "TOP" ? "TOP" : "BOTTOM";
    if (state.selectionMode && state.languagesPlacement === selectZone) {
        lang.style.display = "none";
        return;
    }
    lang.style.display = "";

    if (state.languagesPlacement === "BOTTOM") {
        // Prefer the right-side cluster; fall back to the bar itself (e.g. while
        // the selection toolbar occupies it) so it's never orphaned.
        const actions = document.getElementById("actions");
        const target = actions?.querySelector(".actions-right") || actions;
        if (target) {
            lang.classList.add("embedded-lang");
            lang.classList.remove("header-lang");
            target.appendChild(lang);
            return;
        }
    }
    lang.classList.remove("embedded-lang");
    // TOP: sit beside the search + select icons in the card header so the three
    // controls read as one clean row of icons. Fall back to the page top-bar
    // (next to the logo) only when this link renders no card header.
    const headerMain = document.querySelector(".header .header-main");
    if (headerMain) {
        lang.classList.add("header-lang");
        if (lang.parentElement !== headerMain) headerMain.appendChild(lang);
    } else {
        lang.classList.remove("header-lang");
        const topBar = document.querySelector(".top-bar");
        if (topBar && lang.parentElement !== topBar) topBar.appendChild(lang);
    }
}

// Adds liquid-glass blur to the header on scroll and to the action bar when the
// content extends below the visible area. Matches the Public viewer behaviour.
function bindScrollEffects() {
    const el = app;

    // Find every potentially-scrolling ancestor / sibling so we never miss
    // the actual scroll. Belt + braces.
    const scrollers = new Set([el, window, document, document.documentElement, document.body]);
    el.querySelectorAll(".tree-wrapper").forEach(n => scrollers.add(n));

    const update = () => {
        // Pick the largest scrollTop seen on any of the candidate scrollers.
        // Whichever element is actually moving wins.
        let maxTop = 0;
        for (const s of scrollers) {
            const t = (s.scrollTop != null ? s.scrollTop : (s.scrollY || 0)) || 0;
            if (t > maxTop) maxTop = t;
        }
        el.classList.toggle("scrolled", maxTop > 4);

        const overflow = el.scrollHeight - el.scrollTop - el.clientHeight;
        el.classList.toggle("has-overflow-bottom", overflow > 4);
    };

    // Reset any previous listeners so we never stack them.
    if (window._dtScrollCleanup) window._dtScrollCleanup();
    const cleanups = [];
    for (const s of scrollers) {
        s.addEventListener("scroll", update, { passive: true, capture: true });
        cleanups.push(() => s.removeEventListener("scroll", update, { capture: true }));
    }
    window._dtScrollCleanup = () => cleanups.forEach(fn => fn());

    if (window._dtRO) window._dtRO.disconnect();
    window._dtRO = new ResizeObserver(update);
    window._dtRO.observe(el);
    update();
}

function renderBody() {
    const container = document.getElementById("tree");
    container.innerHTML = "";
    if (state.search.query.trim()) {
        if (state.viewType === "GALLERY") {
            renderGallerySearchResults(container);
        } else {
            renderSearchResults(container);
        }
        return;
    }
    if (state.viewType === "GALLERY") {
        renderGallery(container);
        return;
    }
    const items = state.tree?.Items || [];
    if (items.length === 0) {
        container.innerHTML = `<div class="empty"></div>`;
        applyTranslation(container.querySelector(".empty"), "No files found");
    } else {
        items.forEach(it => container.appendChild(renderTreeItem(it)));
    }
}

// =====================================================================
// RENDER — gallery view
// =====================================================================
async function renderGallery(container) {
    container.classList.add("gallery-mode");
    container.classList.toggle("selection-mode", state.selectionMode);
    state.galleryImages = [];

    const stack = state.galleryStack;
    const current = stack[stack.length - 1];

    // Resolve items at the current folder. Root reads from state.tree.Items;
    // sub-folders go through the children cache (which falls back to the API).
    let items;
    if (current.id == null) {
        items = state.tree?.Items || [];
    } else if (state.childrenCache.has(current.id)) {
        items = state.childrenCache.get(current.id);
    } else {
        container.innerHTML = `<div class="folder-loading"><div class="mini-loader"></div><span></span></div>`;
        applyTranslation(container.querySelector(".folder-loading span"), "Loading folder…");
        items = await loadChildren(current.id);
        const path = stack.slice(1).map(s => s.name).filter(Boolean).join(" / ");
        for (const c of items) registerItem(c, path);
        container.innerHTML = "";
    }

    // Breadcrumb (only when we've descended into a sub-folder).
    if (stack.length > 1) {
        const crumb = document.createElement("div");
        crumb.className = "gallery-breadcrumb";
        stack.forEach((s, i) => {
            if (i > 0) {
                const sep = document.createElement("span");
                sep.className = "gallery-crumb-sep";
                sep.textContent = "/";
                crumb.appendChild(sep);
            }
            const part = document.createElement("button");
            part.type = "button";
            part.className = "gallery-crumb" + (i === stack.length - 1 ? " current" : "");
            applyTranslation(part, s.name || "Root");
            part.onclick = () => {
                if (i === stack.length - 1) return;
                state.galleryStack = stack.slice(0, i + 1);
                renderBody();
            };
            crumb.appendChild(part);
        });
        container.appendChild(crumb);
    }

    if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "empty";
        container.appendChild(empty);
        applyTranslation(empty, current.id == null ? "No files found" : "Empty folder");
        return;
    }

    // Build the lightbox carousel list — every visible image in this view.
    // We also carry the (large) thumbnail URL so the lightbox can show a fast
    // low-quality version while the full preview is still downloading.
    state.galleryImages = items
        .filter(it => it.Type === "File" && fileKind(it) === "image" && it.PreviewUrl)
        .map(it => ({
            id: it.Id,
            url: it.PreviewUrl,
            name: it.Name,
            thumbUrl: it.ThumbnailUrl
                ? `${it.ThumbnailUrl}${it.ThumbnailUrl.includes("?") ? "&" : "?"}size=c2048x2048`
                : null
        }));

    const grid = document.createElement("div");
    grid.className = "gallery-grid";
    if (state.gallerySize) {
        // Set as a CSS var so media queries can scale it for small viewports.
        grid.style.setProperty("--user-gallery-size", `${state.gallerySize}px`);
    }
    for (const item of items) grid.appendChild(renderGalleryTile(item));
    container.appendChild(grid);
}

function renderGalleryTile(item) {
    const isFolder = item.Type === "Folder";
    const wrapper = document.createElement("div");
    wrapper.className = "gallery-tile-wrapper tree-item-wrapper";
    wrapper.dataset.itemId = item.Id;
    if (state.selected.has(item.Id)) wrapper.classList.add("selected");

    const tile = document.createElement("div");
    tile.className = "gallery-tile" + (isFolder ? " is-folder" : ` is-${fileKind(item)}`);

    const visual = document.createElement("div");
    visual.className = "gallery-visual";

    if (isFolder) {
        visual.innerHTML = `<span class="gallery-folder-icon">${ICONS.folder}</span>`;
    } else {
        const kind = fileKind(item);
        if (kind === "image" && item.PreviewUrl) {
            // Progressive load in the gallery tile:
            //   • initial src = the default (medium ≈176px) thumbnail — light,
            //     loads fast, often already in cache.
            //   • data-hires-src = the sharper ?size=large (≈800px) thumbnail
            //     which the central load handler preloads in the background.
            //   • Spinner stays visible until the hi-res version is in the DOM.
            const baseThumb = item.ThumbnailUrl || item.PreviewUrl;
            // Custom size c1280x1280 — Graph caps at the original file size,
            // so smaller photos return at their native dimensions; bigger ones
            // give us a sharp ~1280px JPEG (~50–200KB, still 10× lighter than
            // the full preview).
            const hiresThumb = item.ThumbnailUrl
                ? `${item.ThumbnailUrl}${item.ThumbnailUrl.includes("?") ? "&" : "?"}size=c2048x2048`
                : null;
            visual.innerHTML = `
                <span class="thumbnail-shell" data-preview-src="${escapeHtml(item.PreviewUrl)}" data-fallback-src="${escapeHtml(item.PreviewUrl)}">
                    <span class="thumbnail-loader" aria-hidden="true"></span>
                    <img class="tree-thumbnail gallery-thumb"
                        src="${escapeHtml(baseThumb)}"
                        ${hiresThumb ? `data-hires-src="${escapeHtml(hiresThumb)}"` : ""}
                        alt="" loading="lazy" referrerpolicy="no-referrer" />
                </span>`;
        } else if (kind === "video" && item.PreviewUrl) {
            // `controls` enables native scrubber. `playsinline` keeps mobile
            // from going fullscreen automatically. We start muted so play()
            // is allowed without a user gesture; the first click unmutes.
            visual.innerHTML = `
                <video class="gallery-video" preload="metadata" muted playsinline controls>
                    <source src="${escapeHtml(item.PreviewUrl)}" />
                </video>
                <span class="gallery-play">▶</span>`;
        } else if (kind === "audio" && item.PreviewUrl) {
            visual.innerHTML = `
                <span class="gallery-doc-icon">${fileIconHtml(item)}</span>
                <audio class="gallery-audio" preload="metadata" controls>
                    <source src="${escapeHtml(item.PreviewUrl)}" />
                </audio>
                <span class="gallery-play">▶</span>`;
        } else {
            visual.innerHTML = `<span class="gallery-doc-icon">${fileIconHtml(item)}</span>`;
        }
    }

    tile.appendChild(visual);

    // Full name in the tooltip so the truncated caption stays a single line
    // but hovering reveals the complete filename.
    tile.title = item.Name || "";

    const caption = document.createElement("div");
    caption.className = "gallery-caption";
    const nameEl = document.createElement("div");
    nameEl.className = "gallery-caption-name";
    applyTranslation(nameEl, item.Name || "");
    caption.appendChild(nameEl);
    tile.appendChild(caption);

    // Only render the selection check while selection mode is active — matches
    // how renderTreeItem treats it. Outside selection mode the tile stays clean.
    if (state.selectionMode) {
        const check = document.createElement("button");
        check.type = "button";
        check.className = "gallery-check selection-check";
        check.innerHTML = state.selected.has(item.Id) ? ICONS.checkboxOn : ICONS.checkbox;
        check.onclick = e => { e.stopPropagation(); toggleSelection(item); };
        tile.appendChild(check);
    }

    tile.onclick = (e) => {
        if (e.target.closest(".gallery-check")) return;
        if (state.selectionMode) { toggleSelection(item); return; }
        if (isFolder) {
            if (state.search.query) {
                // Coming from a gallery search result — jump straight to that
                // folder and clear the search so the breadcrumb starts fresh.
                state.search.query = "";
                state.search.open = false;
                state.galleryStack = [{ id: null, name: null }, { id: item.Id, name: item.Name }];
                renderApp();
                return;
            }
            state.galleryStack = [...state.galleryStack, { id: item.Id, name: item.Name }];
            renderBody();
            return;
        }
        const kind = fileKind(item);
        if (kind === "image" && item.PreviewUrl) {
            const list = state.galleryImages?.length
                ? state.galleryImages
                : [{ id: item.Id, url: item.PreviewUrl, name: item.Name }];
            const idx = Math.max(0, list.findIndex(x => x.id === item.Id));
            openLightbox(list, idx);
        } else if ((kind === "video" || kind === "audio") && item.PreviewUrl) {
            // Native <video>/<audio> controls own clicks on themselves; tapping
            // the overlay play icon (or visual area outside the controls bar)
            // toggles playback so users don't have to aim for the tiny button.
            const mediaEl = tile.querySelector("video, audio");
            if (!mediaEl) return;
            if (e.target === mediaEl || e.target.closest(".gallery-play, .gallery-doc-icon")) {
                if (mediaEl.paused) {
                    mediaEl.muted = false;
                    mediaEl.play().catch(() => {});
                } else {
                    mediaEl.pause();
                }
            }
        } else if (item.PreviewUrl) {
            openUrl(item.PreviewUrl, "Preview not available");
        } else {
            openUrl(item.DownloadUrl, "Download not available");
        }
    };

    bindLongPressAndContext(tile, item);

    // Sync the play-icon overlay with media playback state.
    const mediaEl = tile.querySelector("video, audio");
    if (mediaEl) {
        mediaEl.addEventListener("play",  () => tile.classList.add("is-playing"));
        mediaEl.addEventListener("pause", () => tile.classList.remove("is-playing"));
        mediaEl.addEventListener("ended", () => tile.classList.remove("is-playing"));
    }

    wrapper.appendChild(tile);
    return wrapper;
}

// Search inside gallery mode stays in gallery layout — same tiles, no tree rows.
function renderGallerySearchResults(container) {
    container.classList.add("gallery-mode");
    container.classList.toggle("selection-mode", state.selectionMode);
    state.galleryImages = [];

    const q = state.search.query.trim().toLowerCase();
    const matches = [...state.registry.values()].filter(e => {
        if (e.name.toLowerCase().includes(q)) return true;
        const tName = cachedTranslation(e.name);
        if (tName && tName.toLowerCase().includes(q)) return true;
        if (e.path && e.path.toLowerCase().includes(q)) return true;
        const tPath = cachedTranslation(e.path);
        return tPath ? tPath.toLowerCase().includes(q) : false;
    });

    if (matches.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty";
        container.appendChild(empty);
        applyTranslation(empty, "No matches");
        return;
    }

    state.galleryImages = matches
        .filter(m => m.item.Type === "File" && fileKind(m.item) === "image" && m.item.PreviewUrl)
        .map(m => ({
            id: m.item.Id,
            url: m.item.PreviewUrl,
            name: m.item.Name,
            thumbUrl: m.item.ThumbnailUrl
                ? `${m.item.ThumbnailUrl}${m.item.ThumbnailUrl.includes("?") ? "&" : "?"}size=c2048x2048`
                : null
        }));

    const grid = document.createElement("div");
    grid.className = "gallery-grid";
    if (state.gallerySize) {
        // Set as a CSS var so media queries can scale it for small viewports.
        grid.style.setProperty("--user-gallery-size", `${state.gallerySize}px`);
    }
    for (const m of matches) {
        const tile = renderGalleryTile(m.item);
        // Hint where the match lives — small breadcrumb under the file name.
        if (m.path) {
            const cap = tile.querySelector(".gallery-caption");
            if (cap) {
                const pathEl = document.createElement("div");
                pathEl.className = "gallery-caption-path";
                applyTranslation(pathEl, m.path);
                cap.appendChild(pathEl);
            }
        }
        grid.appendChild(tile);
    }
    container.appendChild(grid);
}

// =====================================================================
// RENDER — tree node (recursive via lazy loading)
// =====================================================================
function renderTreeItem(item) {
    const wrapper = document.createElement("div");
    wrapper.className = "tree-item-wrapper";
    wrapper.dataset.itemId = item.Id;
    const isFolder  = item.Type === "Folder";
    const isOpen    = state.expandedFolders.has(item.Id);
    if (isOpen)                wrapper.classList.add("open");
    if (state.selected.has(item.Id)) wrapper.classList.add("selected");

    const row = document.createElement("div");
    row.className = `tree-item${state.selectionMode ? " selection-mode" : ""}`;

    if (state.selectionMode) {
        const check = document.createElement("button");
        check.className   = "selection-check";
        check.innerHTML   = state.selected.has(item.Id) ? ICONS.checkboxOn : ICONS.checkbox;
        check.onclick     = e => { e.stopPropagation(); toggleSelection(item); };
        row.appendChild(check);
    }

    const left = document.createElement("div");
    left.className = `tree-left${isFolder ? " folder" : ""}`;
    left.innerHTML = `
        <span class="tree-icon ${isFolder ? "folder-icon" : "file-icon"}">${
            isFolder ? (isOpen ? ICONS.folderOpen : ICONS.folder) : fileIconHtml(item)
        }</span>
        <span class="tree-name"></span>
    `;
    applyTranslation(left.querySelector(".tree-name"), item.Name || "");
    row.appendChild(left);

    if (!isFolder && !state.selectionMode) {
        const actions = document.createElement("div");
        actions.className = "file-actions";
        actions.innerHTML = `
            <button class="preview-btn"  title="View">${ICONS.preview}</button>
            ${state.showDownload !== false ? `<button class="download-btn" title="Download">${ICONS.download}</button>` : ""}
            ${state.showShare    !== false ? `<button class="share-btn"    title="Share">${ICONS.share}</button>` : ""}
        `;
        actions.querySelector(".preview-btn").onclick  = e => { e.stopPropagation(); openUrl(item.PreviewUrl,  "Preview not available"); };
        actions.querySelector(".download-btn")?.addEventListener("click", e => { e.stopPropagation(); openUrl(item.DownloadUrl, "Download not available"); });
        actions.querySelector(".share-btn")?.addEventListener("click", e => { e.stopPropagation(); shareItem(item, e.currentTarget); });
        row.appendChild(actions);
    }

    // Click handling — selection mode toggles, folders expand, files reveal the
    // mobile action panel (no-op visually on desktop where hover shows the icons).
    left.onclick = () => {
        if (state.selectionMode) { toggleSelection(item); return; }
        if (isFolder) { toggleFolder(item, wrapper); return; }
        toggleFileActionsPanel(wrapper);
    };

    // Right-click & long-press enter selection mode.
    bindLongPressAndContext(row, item);

    wrapper.appendChild(row);

    if (!isFolder && !state.selectionMode) {
        const panel = document.createElement("div");
        panel.className = "tree-actions-panel";
        panel.innerHTML = `
            <button class="preview-btn"  title="View">${ICONS.preview}<span class="tap-label"></span></button>
            ${state.showDownload !== false ? `<button class="download-btn" title="Download">${ICONS.download}<span class="tap-label"></span></button>` : ""}
            ${state.showShare    !== false ? `<button class="share-btn"    title="Share">${ICONS.share}<span class="tap-label"></span></button>` : ""}
        `;
        applyTranslation(panel.querySelector(".preview-btn .tap-label"),  "View");
        const dlLabel = panel.querySelector(".download-btn .tap-label");
        if (dlLabel) applyTranslation(dlLabel, "Download");
        const shLabel = panel.querySelector(".share-btn .tap-label");
        if (shLabel) applyTranslation(shLabel, "Share");
        panel.querySelector(".preview-btn").onclick  = e => { e.stopPropagation(); openUrl(item.PreviewUrl,  "Preview not available"); };
        panel.querySelector(".download-btn")?.addEventListener("click", e => { e.stopPropagation(); openUrl(item.DownloadUrl, "Download not available"); });
        panel.querySelector(".share-btn")?.addEventListener("click", e => { e.stopPropagation(); shareItem(item, e.currentTarget); });
        wrapper.appendChild(panel);
    }

    if (isFolder) {
        const childrenContainer = document.createElement("div");
        childrenContainer.className = "children";
        wrapper.appendChild(childrenContainer);
        if (isOpen) {
            populateChildrenContainer(item, childrenContainer);
        }
    }
    return wrapper;
}

// Only one file's action panel may be open at a time — keeps the tree tidy.
function toggleFileActionsPanel(wrapper) {
    const wasOpen = wrapper.classList.contains("actions-open");
    document.querySelectorAll(".tree-item-wrapper.actions-open, .search-result-wrapper.actions-open")
        .forEach(w => w.classList.remove("actions-open"));
    if (!wasOpen) wrapper.classList.add("actions-open");
}

async function toggleFolder(item, wrapper) {
    const childrenContainer = wrapper.querySelector(":scope > .children");
    if (state.expandedFolders.has(item.Id)) {
        state.expandedFolders.delete(item.Id);
        wrapper.classList.remove("open");
        childrenContainer.innerHTML = "";
        return;
    }
    state.expandedFolders.add(item.Id);
    wrapper.classList.add("open");
    await populateChildrenContainer(item, childrenContainer);
}

async function populateChildrenContainer(item, container) {
    container.innerHTML = `<div class="folder-loading"><div class="mini-loader"></div><span></span></div>`;
    applyTranslation(container.querySelector(".folder-loading span"), "Loading folder…");
    const children = await loadChildren(item.Id);
    container.innerHTML = "";
    const path = state.registry.get(item.Id)?.path
        ? `${state.registry.get(item.Id).path} / ${item.Name}`
        : item.Name;
    for (const c of children) registerItem(c, path);
    if (children.length === 0) {
        container.innerHTML = `<div class="empty"></div>`;
        applyTranslation(container.querySelector(".empty"), "Empty folder");
    }
    else children.forEach(c => container.appendChild(renderTreeItem(c)));
}

// =====================================================================
// RENDER — search results
// =====================================================================
function renderSearchResults(container) {
    const q = state.search.query.trim().toLowerCase();
    const matches = [...state.registry.values()]
        .filter(e => {
            if (e.name.toLowerCase().includes(q)) return true;
            // Also match against the localized name, if we already have one cached.
            const translated = cachedTranslation(e.name);
            if (translated && translated.toLowerCase().includes(q)) return true;
            // And the breadcrumb path (translated path falls through if not cached yet).
            if (e.path && e.path.toLowerCase().includes(q)) return true;
            const tPath = cachedTranslation(e.path);
            return tPath ? tPath.toLowerCase().includes(q) : false;
        });

    if (matches.length === 0) {
        container.innerHTML = `<div class="empty"></div>`;
        applyTranslation(container.querySelector(".empty"), "No matches");
        return;
    }

    const list = document.createElement("div");
    list.className = "search-results";
    for (const m of matches) {
        const wrapper = document.createElement("div");
        wrapper.className = "search-result-wrapper";

        const row = document.createElement("div");
        row.className = "search-result";
        row.innerHTML = `
            <span class="search-result-icon">${m.type === "Folder" ? ICONS.folder : fileIconHtml(m.item)}</span>
            <div class="search-result-body">
                <div class="search-result-name"></div>
                ${m.path ? `<div class="search-result-path"></div>` : ""}
            </div>
            ${m.type === "File" ? `
                <div class="search-result-actions">
                    <button class="preview-btn"  title="View">${ICONS.preview}</button>
                    ${state.showDownload !== false ? `<button class="download-btn" title="Download">${ICONS.download}</button>` : ""}
                    ${state.showShare    !== false ? `<button class="share-btn"    title="Share">${ICONS.share}</button>` : ""}
                </div>
            ` : ""}
        `;
        if (m.type === "File") {
            row.querySelector(".preview-btn").onclick  = e => { e.stopPropagation(); openUrl(m.item.PreviewUrl,  "Preview not available"); };
            row.querySelector(".download-btn")?.addEventListener("click", e => { e.stopPropagation(); openUrl(m.item.DownloadUrl, "Download not available"); });
            row.querySelector(".share-btn")?.addEventListener("click", e => { e.stopPropagation(); shareItem(m.item, e.currentTarget); });
        }
        applyTranslation(row.querySelector(".search-result-name"), m.name);
        if (m.path) applyTranslation(row.querySelector(".search-result-path"), m.path);
        wrapper.appendChild(row);

        if (m.type === "File") {
            const panel = document.createElement("div");
            panel.className = "tree-actions-panel";
            panel.innerHTML = `
                <button class="preview-btn"  title="View">${ICONS.preview}<span class="tap-label"></span></button>
                ${state.showDownload !== false ? `<button class="download-btn" title="Download">${ICONS.download}<span class="tap-label"></span></button>` : ""}
                ${state.showShare    !== false ? `<button class="share-btn"    title="Share">${ICONS.share}<span class="tap-label"></span></button>` : ""}
            `;
            applyTranslation(panel.querySelector(".preview-btn .tap-label"),  "View");
            const dlLabel = panel.querySelector(".download-btn .tap-label");
            if (dlLabel) applyTranslation(dlLabel, "Download");
            const shLabel = panel.querySelector(".share-btn .tap-label");
            if (shLabel) applyTranslation(shLabel, "Share");
            panel.querySelector(".preview-btn").onclick  = e => { e.stopPropagation(); openUrl(m.item.PreviewUrl,  "Preview not available"); };
            panel.querySelector(".download-btn")?.addEventListener("click", e => { e.stopPropagation(); openUrl(m.item.DownloadUrl, "Download not available"); });
            panel.querySelector(".share-btn")?.addEventListener("click", e => { e.stopPropagation(); shareItem(m.item, e.currentTarget); });
            wrapper.appendChild(panel);

            row.addEventListener("click", () => toggleFileActionsPanel(wrapper));
        }

        list.appendChild(wrapper);
    }
    container.appendChild(list);
}

// =====================================================================
// RENDER — bottom action bar
// =====================================================================
// Markup for the selection-mode toolbar (cancel + count + select / deselect /
// download). Shared so it can render in either the top header or the bottom bar.
function selectionBarHTML() {
    return `
        <button id="sel-cancel" class="sel-cancel" title="Cancel">${ICONS.close}</button>
        <span class="sel-count">${state.selected.size} <span class="sel-count-label"></span></span>
        <div class="sel-actions">
            <button id="sel-all"    class="sel-btn" title="Select all">${ICONS.checkboxOn}<span class="sel-btn-label"></span></button>
            <button id="sel-none"   class="sel-btn" title="Deselect all">${ICONS.checkbox}<span class="sel-btn-label"></span></button>
            <button id="sel-dl"     class="sel-btn sel-download"${state.selected.size === 0 ? " disabled" : ""} title="Download">
                ${ICONS.download}<span class="sel-btn-label"></span>
            </button>
        </div>
    `;
}

// Translates + wires the selection toolbar living inside `root`.
function wireSelectionBar(root) {
    if (!root) return;
    applyTranslation(root.querySelector(".sel-count-label"),         "selected");
    applyTranslation(root.querySelector("#sel-all .sel-btn-label"),  "Select all");
    applyTranslation(root.querySelector("#sel-none .sel-btn-label"), "Deselect all");
    applyTranslation(root.querySelector("#sel-dl .sel-btn-label"),
        state.selected.size > 0 ? `Download (${state.selected.size})` : "Download");
    root.querySelector("#sel-cancel").onclick = exitSelectionMode;
    root.querySelector("#sel-all").onclick    = selectAll;
    root.querySelector("#sel-none").onclick   = deselectAll;
    root.querySelector("#sel-dl").onclick     = downloadSelection;
}

function renderActions() {
    const el = document.getElementById("actions");
    // The lang switcher may live inside #actions; el.innerHTML below would
    // destroy it, so park it on <body> first. placeLangSwitcher() restores it.
    const parkedLang = document.getElementById("lang-switcher");
    if (parkedLang && el.contains(parkedLang)) document.body.appendChild(parkedLang);

    // Selecting + Select is BOTTOM → the toolbar takes over the bottom bar.
    // (When Select is TOP the toolbar renders in the header instead, handled by
    // renderApp, and the bottom bar falls through to its normal state below.)
    const selectionInBottom = state.selectionMode && !(state.showSelect !== false && state.selectPlacement === "TOP");

    if (selectionInBottom) {
        el.classList.add("selection-mode");
        el.classList.remove("has-search", "search-open");
        el.innerHTML = selectionBarHTML();
        wireSelectionBar(el);
        el.style.display = "";
        placeLangSwitcher();
        return;
    }

    el.classList.remove("selection-mode");
    // We only reach here when the selection toolbar is NOT in the bottom bar
    // (i.e. not selecting, or Select is TOP). So bottom search + select keep
    // their normal visibility — they only vanish when they share the toolbar's
    // bar, which is handled by that bar being replaced above / in the header.
    const searchInBar = !!state.searchInActions;
    const selectInBar = !!state.selectInActions;
    el.classList.toggle("has-search", searchInBar);
    el.classList.toggle("search-open", searchInBar && state.search.open);
    // Right-side cluster (search + lang) carries margin-left: auto, and the
    // Select button sits at the very end so it right-aligns with where the
    // selection-mode action buttons appear.
    el.innerHTML = `
        <div class="actions-right">
            ${searchInBar ? `
                <input id="search-input" type="search" class="header-search-input"
                    value="${escapeHtml(state.search.query)}" />
                <button id="search-toggle" class="header-search-toggle${state.search.open ? " active" : ""}"
                    aria-label="Search">${state.search.open ? ICONS.close : ICONS.search}</button>
            ` : ""}
        </div>
        ${selectInBar ? `<button id="select-btn" class="bar-icon-btn" aria-label="Select">${ICONS.select}</button>` : ""}
    `;
    const selectBtn = document.getElementById("select-btn");
    if (selectBtn) {
        applyTranslationAttr(selectBtn, "title", "Select");
        selectBtn.onclick = () => enterSelectionMode();
    }

    if (searchInBar) {
        const toggle = document.getElementById("search-toggle");
        const input  = document.getElementById("search-input");
        toggle.onclick = toggleSearch;
        input.oninput = e => { state.search.query = e.target.value; renderBody(); };
        applyTranslationAttr(input, "placeholder", "Search files and folders…");
        if (state.search.open) input.focus();
    }

    placeLangSwitcher();

    // Hide the whole bar if it would be empty (no select button, no search,
    // and no lang switcher landed in it).
    const langInBar = !!el.querySelector("#lang-switcher");
    const barEmpty = !selectInBar && !searchInBar && !langInBar;
    el.style.display = barEmpty ? "none" : "";
}

// =====================================================================
// SELECTION
// =====================================================================
// Re-render the whole app (so the header can swap to / from the selection
// toolbar when Select is TOP) without losing the user's scroll position.
function rerenderKeepScroll() {
    const a = app?.scrollTop || 0;
    const t = document.getElementById("tree")?.scrollTop || 0;
    renderApp();
    if (app) app.scrollTop = a;
    const tree = document.getElementById("tree");
    if (tree) tree.scrollTop = t;
}

function enterSelectionMode(item) {
    // Selection can be turned off per link — right-click / long-press become
    // no-ops and the Select button isn't rendered.
    if (state.showSelect === false) return;
    state.selectionMode = true;
    state.selected = item ? new Set([item.Id]) : new Set();
    rerenderKeepScroll();   // header may host the selection toolbar (Select=TOP)
}
function exitSelectionMode() {
    state.selectionMode = false;
    state.selected = new Set();
    rerenderKeepScroll();
}

// Update a single row's selected state without rebuilding the tree.
function updateItemSelectionUI(id) {
    const wrappers = document.querySelectorAll(`.tree-item-wrapper[data-item-id="${CSS.escape(id)}"]`);
    const isSelected = state.selected.has(id);
    wrappers.forEach(w => {
        w.classList.toggle("selected", isSelected);
        const check = w.querySelector(
            ":scope > .tree-item > .selection-check, :scope > .gallery-tile > .selection-check"
        );
        if (check) check.innerHTML = isSelected ? ICONS.checkboxOn : ICONS.checkbox;
    });
}

// Refresh the live parts of the selection toolbar (count + download state) in
// whichever zone it lives — top header (Select=TOP) or the bottom bar — without
// rebuilding the whole bar.
function updateSelectionBar() {
    const dl = document.getElementById("sel-dl");
    if (!dl) return;
    const count = state.selected.size;
    const countEl = document.querySelector(".sel-count");
    if (countEl) {
        countEl.innerHTML = `${count} <span class="sel-count-label"></span>`;
        applyTranslation(countEl.querySelector(".sel-count-label"), "selected");
    }
    dl.disabled = count === 0;
    applyTranslation(dl.querySelector(".sel-btn-label"),
        count > 0 ? `Download (${count})` : "Download");
}

function toggleSelection(item) {
    if (state.selected.has(item.Id)) state.selected.delete(item.Id);
    else                              state.selected.add(item.Id);
    updateItemSelectionUI(item.Id);
    updateSelectionBar();   // count + download button state
}

function selectAll() {
    state.selected = new Set(state.registry.keys());
    state.selected.forEach(updateItemSelectionUI);
    updateSelectionBar();
}
function deselectAll() {
    const wasSelected = [...state.selected];
    state.selected = new Set();
    wasSelected.forEach(updateItemSelectionUI);
    updateSelectionBar();
}

// =====================================================================
// SEARCH
// =====================================================================
let searchRerenderTimer = null;
function scheduleSearchRerender() {
    clearTimeout(searchRerenderTimer);
    searchRerenderTimer = setTimeout(() => {
        if (state.search.open && state.search.query.trim()) renderBody();
    }, 250);
}

function toggleSearch() {
    state.search.open = !state.search.open;
    if (!state.search.open) state.search.query = "";

    // Kick off translations for every item we've registered so the user can
    // search in the chosen language. Each fulfilment schedules a re-render so
    // late-arriving translations enrich the visible result list.
    if (state.search.open && state.lang) {
        for (const e of state.registry.values()) {
            if (!cachedTranslation(e.name)) {
                translate(e.name, state.lang).then(scheduleSearchRerender);
            }
            if (e.path && !cachedTranslation(e.path)) {
                translate(e.path, state.lang).then(scheduleSearchRerender);
            }
        }
    }

    renderApp();
}

// =====================================================================
// PASSWORD / LOADING / ERROR SCREENS
// =====================================================================
function renderLoading() {
    app.innerHTML = `<div class="center"><div class="loader"></div><p></p></div>`;
    applyTranslation(app.querySelector(".center p"), "Loading your files…");
}
function renderError(msg) {
    app.innerHTML = `<div class="center error"><h3></h3><p></p></div>`;
    applyTranslation(app.querySelector(".center h3"), "Error");
    applyTranslation(app.querySelector(".center p"),  msg || "Something went wrong");
}
function renderPassword() {
    app.innerHTML = `
        <div class="center password">
            <div class="password-icon">🔒</div>
            <h2></h2>
            <input type="password" id="pwd" autocomplete="current-password" />
            <button id="pwdBtn" class="password-submit"></button>
        </div>
    `;
    const input = document.getElementById("pwd");
    const btn   = document.getElementById("pwdBtn");
    applyTranslation(app.querySelector(".center h2"), "Password protected");
    applyTranslationAttr(input, "placeholder", "Enter password");
    applyTranslation(btn, "Open folder");
    btn.onclick = submitPassword;
    input.addEventListener("keydown", e => { if (e.key === "Enter") submitPassword(); });
    input.focus();
}
function submitPassword() { loadTree(document.getElementById("pwd").value, { useCache: false }); }

// =====================================================================
// RIGHT-CLICK / LONG-PRESS BINDINGS
// =====================================================================
function bindLongPressAndContext(row, item) {
    row.oncontextmenu = e => {
        e.preventDefault();
        if (!state.selectionMode) enterSelectionMode(item);
        else                       toggleSelection(item);
    };
    let timer = null;
    row.addEventListener("touchstart", () => {
        timer = setTimeout(() => {
            if (!state.selectionMode) enterSelectionMode(item);
            else                       toggleSelection(item);
        }, 500);
    }, { passive: true });
    const cancel = () => { clearTimeout(timer); timer = null; };
    row.addEventListener("touchend",   cancel);
    row.addEventListener("touchmove",  cancel);
    row.addEventListener("touchcancel",cancel);
}

// =====================================================================
// HELPERS
// =====================================================================
function openUrl(url, fallbackMsg) {
    if (!url) { alert(fallbackMsg || "Not available"); return; }
    window.open(url, "_blank");
}

// Absolute share URL — prefer the preview URL so the recipient can open the
// file in their browser. Falls back to download URL if no preview exists.
function shareUrlFor(item) {
    const raw = item.PreviewUrl || item.DownloadUrl;
    if (!raw) return null;
    try { return new URL(raw, window.location.origin).toString(); }
    catch { return raw; }
}

async function shareItem(item, btn) {
    const url = shareUrlFor(item);
    if (!url) { alert("Nothing to share"); return; }

    const title = item.Name || "";
    if (navigator.share) {
        try { await navigator.share({ title, url }); return; }
        catch (err) { if (err?.name === "AbortError") return; /* fall through to copy */ }
    }
    try { await navigator.clipboard.writeText(url); }
    catch { window.prompt("Copy link:", url); return; }

    // Brief inline confirmation on the button itself.
    if (!btn) return;
    const label = btn.querySelector(".tap-label");
    const original = label?.textContent;
    if (label) applyTranslation(label, "Link copied");
    btn.classList.add("copied");
    setTimeout(() => {
        btn.classList.remove("copied");
        if (label && original != null) label.textContent = original;
    }, 1400);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
