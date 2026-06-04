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

// API endpoint — defaults to the host that serves this page (so the same
// build works both locally and in production). Override by setting
// window.DOCUMENTTREE_API_BASE before this script loads if you want to talk
// to a different API instance.
const API_BASE = (window.DOCUMENTTREE_API_BASE
    || `${window.location.origin}/SourceLinks`);

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
    select:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12l2 2 4-4"/></svg>'
};

// =====================================================================
// FILE TYPE ICONS
// =====================================================================
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "avif"];

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
        return `<img class="tree-thumbnail" src="${escapeHtml(item.PreviewUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`;
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
    const host = document.getElementById("lang-switcher");
    if (!host) return;

    const current = state.lang ? LANGUAGES.find(l => l.code === state.lang) : null;

    host.innerHTML = `
        <div class="lang-wrap">
            <button type="button" class="icon-btn lang"
                aria-label="${current ? `Language: ${current.name}` : "No translation"}"
                aria-haspopup="listbox" aria-expanded="false">
                ${current
                    ? `<span class="flag" aria-hidden="true">${current.flag}</span><span class="code">${current.code.toUpperCase()}</span>`
                    : `<span class="flag" aria-hidden="true" style="opacity:0.7">${ICONS.globe}</span>`}
                <span class="chevron" style="font-size: 10px; opacity: 0.6;">${ICONS.chevDown}</span>
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
const rawToken     = new URLSearchParams(window.location.search).get("token");
const parsedToken  = parseToken(rawToken);
const token       = parsedToken.base;          // What we send to the API
const PW_KEY      = token ? `dtplain:pw:${token}` : null;

const state = {
    lang:            parsedToken.lang,         // null = no translation
    password:        "",
    tree:            null,                       // { Title, Description, Items }
    childrenCache:   new Map(),                  // folderId -> items[]
    registry:        new Map(),                  // id -> { id, type, name, path, item }
    selectionMode:   false,
    selected:        new Set(),                  // selected ids
    expandedFolders: new Set(),                  // open folder ids (visual state)
    search:          { open: false, query: "" }
};

// =====================================================================
// INIT
// =====================================================================
const setVH = () => document.documentElement.style.setProperty("--app-vh", `${window.innerHeight}px`);
setVH();
window.addEventListener("resize", setVH);
window.addEventListener("orientationchange", setVH);

renderLangSwitcher();

// Pre-warm UI strings so the password screen, action bar, etc. appear in the
// chosen language on first paint. Fire-and-forget — cache check is sync.
const UI_STRINGS = [
    "Loading your files…", "Error", "Something went wrong",
    "Password protected", "Enter password", "Open folder",
    "No files found", "No matches", "Empty folder", "Loading folder…",
    "Search files and folders…",
    "Select", "selected", "Select all", "Deselect all", "Download",
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

async function loadTree(password = loadStoredPassword()) {
    state.password = password;
    renderLoading();
    try {
        const res = await fetch(`${API_BASE}/publicLink`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, password })
        });
        const result = await res.json();
        if (!result?.isSuccess) {
            if (result?.code === "401" || (result?.message || "").toLowerCase().includes("password")) {
                // Saved password rejected — forget it before we ask again.
                if (password) storePassword("");
                renderPassword(result?.message || "");
                return;
            }
            renderError(result?.message || "Unable to load public link");
            return;
        }
        storePassword(password);
        state.tree = result.entity;
        // Register root items so "select all" knows about them straight away.
        for (const item of state.tree.Items || []) registerItem(item, "");
        renderApp();
        // Prefetch sub-folders in the background so search can find everything.
        prefetchSubtree(state.tree.Items || [], "");
    } catch (err) {
        console.error("loadTree", err);
        renderError("Failed to connect to API");
    }
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
        const res = await fetch(`${API_BASE}/downloadMultiple`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, password: state.password, items })
        });
        if (!res.ok) { alert("Download failed"); return; }
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = downloadName(items);
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } finally {
        if (spinner.parentNode) spinner.replaceWith(originalSvg);
        if (btn) { btn.disabled = false; btn.classList.remove("loading"); }
    }
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
    app.innerHTML = `
        <div class="header${state.search.open ? " search-open" : ""}">
            <div class="header-main">
                <div class="header-text">
                    <h2></h2>
                    ${state.tree?.Description ? `<p class="desc"></p>` : ""}
                </div>
                <button id="search-toggle" class="header-search-toggle${state.search.open ? " active" : ""}"
                    aria-label="Search">${state.search.open ? ICONS.close : ICONS.search}</button>
                <input id="search-input" type="search" class="header-search-input"
                    value="${escapeHtml(state.search.query)}" />
            </div>
        </div>
        <div class="tree-wrapper" id="tree"></div>
        <div class="container-actions" id="actions"></div>
    `;

    document.getElementById("search-toggle").onclick = toggleSearch;
    const input = document.getElementById("search-input");
    input.oninput = e => { state.search.query = e.target.value; renderBody(); };
    applyTranslationAttr(input, "placeholder", "Search files and folders…");
    if (state.search.open) input.focus();

    applyTranslation(app.querySelector(".header-text h2"),    state.tree?.Title || "Shared Folder");
    const descEl = app.querySelector(".header-text .desc");
    if (descEl) applyTranslation(descEl, state.tree?.Description || "");

    renderBody();
    renderActions();
    bindScrollEffects();
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
    if (state.search.query.trim()) {
        container.innerHTML = "";
        renderSearchResults(container);
    } else {
        container.innerHTML = "";
        const items = state.tree?.Items || [];
        if (items.length === 0) {
            container.innerHTML = `<div class="empty"></div>`;
            applyTranslation(container.querySelector(".empty"), "No files found");
        }
        else items.forEach(it => container.appendChild(renderTreeItem(it)));
    }
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
            <button class="preview-btn"  title="Preview">${ICONS.preview}</button>
            <button class="download-btn" title="Download">${ICONS.download}</button>
        `;
        actions.querySelector(".preview-btn").onclick  = e => { e.stopPropagation(); openUrl(item.PreviewUrl,  "Preview not available"); };
        actions.querySelector(".download-btn").onclick = e => { e.stopPropagation(); openUrl(item.DownloadUrl, "Download not available"); };
        row.appendChild(actions);
    }

    // Click handling — selection mode toggles, otherwise expand folders.
    left.onclick = () => {
        if (state.selectionMode) { toggleSelection(item); return; }
        if (isFolder) toggleFolder(item, wrapper);
    };

    // Right-click & long-press enter selection mode.
    bindLongPressAndContext(row, item);

    wrapper.appendChild(row);

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
                    <button class="preview-btn"  title="Preview">${ICONS.preview}</button>
                    <button class="download-btn" title="Download">${ICONS.download}</button>
                </div>
            ` : ""}
        `;
        if (m.type === "File") {
            row.querySelector(".preview-btn").onclick  = () => openUrl(m.item.PreviewUrl,  "Preview not available");
            row.querySelector(".download-btn").onclick = () => openUrl(m.item.DownloadUrl, "Download not available");
        }
        applyTranslation(row.querySelector(".search-result-name"), m.name);
        if (m.path) applyTranslation(row.querySelector(".search-result-path"), m.path);
        list.appendChild(row);
    }
    container.appendChild(list);
}

// =====================================================================
// RENDER — bottom action bar
// =====================================================================
function renderActions() {
    const el = document.getElementById("actions");
    if (!state.selectionMode) {
        el.classList.remove("selection-mode");
        el.innerHTML = `<button id="select-btn" class="container-action-btn">${ICONS.select}<span></span></button>`;
        applyTranslation(el.querySelector("#select-btn span"), "Select");
        document.getElementById("select-btn").onclick = () => enterSelectionMode();
        return;
    }

    el.classList.add("selection-mode");
    el.innerHTML = `
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
    applyTranslation(el.querySelector(".sel-count-label"),                                "selected");
    applyTranslation(el.querySelector("#sel-all .sel-btn-label"),                         "Select all");
    applyTranslation(el.querySelector("#sel-none .sel-btn-label"),                        "Deselect all");
    applyTranslation(el.querySelector("#sel-dl .sel-btn-label"),
        state.selected.size > 0 ? `Download (${state.selected.size})` : "Download");
    document.getElementById("sel-cancel").onclick = exitSelectionMode;
    document.getElementById("sel-all").onclick    = selectAll;
    document.getElementById("sel-none").onclick   = deselectAll;
    document.getElementById("sel-dl").onclick     = downloadSelection;
}

// =====================================================================
// SELECTION
// =====================================================================
function enterSelectionMode(item) {
    state.selectionMode = true;
    state.selected = item ? new Set([item.Id]) : new Set();
    renderBody();      // toggles checkbox column into existence
    renderActions();
}
function exitSelectionMode() {
    state.selectionMode = false;
    state.selected = new Set();
    renderBody();      // hides checkbox column
    renderActions();
}

// Update a single row's selected state without rebuilding the tree.
function updateItemSelectionUI(id) {
    const wrappers = document.querySelectorAll(`.tree-item-wrapper[data-item-id="${CSS.escape(id)}"]`);
    const isSelected = state.selected.has(id);
    wrappers.forEach(w => {
        w.classList.toggle("selected", isSelected);
        const check = w.querySelector(":scope > .tree-item > .selection-check");
        if (check) check.innerHTML = isSelected ? ICONS.checkboxOn : ICONS.checkbox;
    });
}

function toggleSelection(item) {
    if (state.selected.has(item.Id)) state.selected.delete(item.Id);
    else                              state.selected.add(item.Id);
    updateItemSelectionUI(item.Id);
    renderActions();   // count + download button state
}

function selectAll() {
    state.selected = new Set(state.registry.keys());
    state.selected.forEach(updateItemSelectionUI);
    renderActions();
}
function deselectAll() {
    const wasSelected = [...state.selected];
    state.selected = new Set();
    wasSelected.forEach(updateItemSelectionUI);
    renderActions();
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
function submitPassword() { loadTree(document.getElementById("pwd").value); }

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

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
