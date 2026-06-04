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

const API_BASE = "https://documenttree-api.nukepages.net/SourceLinks";

// Inline SVG icons keep the project dependency-free.
const ICONS = {
    search:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
    close:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    chevron:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    folder:    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>',
    file:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
    preview:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    download:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>',
    check:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
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
// STATE
// =====================================================================
const app   = document.getElementById("app");
const token = new URLSearchParams(window.location.search).get("token");

const state = {
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

if (!token) {
    renderError("Missing token in URL");
} else {
    loadTree();
}

// =====================================================================
// NETWORK
// =====================================================================
async function loadTree(password = "") {
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
                renderPassword(result?.message || "");
                return;
            }
            renderError(result?.message || "Unable to load public link");
            return;
        }
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
}

// =====================================================================
// RENDER — main shell
// =====================================================================
function renderApp() {
    app.innerHTML = `
        <div class="header">
            <div class="header-main">
                <div class="header-text${state.search.open ? " mobile-hidden" : ""}">
                    <h2>${escapeHtml(state.tree?.Title || "Shared Folder")}</h2>
                    ${state.tree?.Description ? `<p class="desc">${escapeHtml(state.tree.Description)}</p>` : ""}
                </div>
                ${state.search.open ? `
                    <input id="search-input" type="search" class="header-search-input"
                        placeholder="Search files and folders…" value="${escapeHtml(state.search.query)}" />
                ` : ""}
                <button id="search-toggle" class="header-search-toggle${state.search.open ? " active" : ""}"
                    aria-label="Search">${state.search.open ? ICONS.close : ICONS.search}</button>
            </div>
        </div>
        <div class="tree-wrapper" id="tree"></div>
        <div class="container-actions" id="actions"></div>
    `;

    document.getElementById("search-toggle").onclick = toggleSearch;
    if (state.search.open) {
        const input = document.getElementById("search-input");
        input.oninput = e => { state.search.query = e.target.value; renderBody(); };
        input.focus();
    }
    renderBody();
    renderActions();
    bindScrollEffects();
}

// Adds liquid-glass blur to the header on scroll and to the action bar when the
// content extends below the visible area. Matches the Public viewer behaviour.
function bindScrollEffects() {
    const el = app;
    const update = () => {
        if (el.scrollTop > 8) el.classList.add("scrolled");
        else                   el.classList.remove("scrolled");
        if (el.scrollHeight - el.scrollTop - el.clientHeight > 8) el.classList.add("has-overflow-bottom");
        else                                                       el.classList.remove("has-overflow-bottom");
    };
    el.onscroll = update;
    if (window._dtRO) window._dtRO.disconnect();
    window._dtRO = new ResizeObserver(update);
    window._dtRO.observe(el);
    if (el.firstElementChild) window._dtRO.observe(el.firstElementChild);
    update();
}

function renderBody() {
    const container = document.getElementById("tree");
    if (state.search.open && state.search.query.trim()) {
        container.innerHTML = "";
        renderSearchResults(container);
    } else {
        container.innerHTML = "";
        const items = state.tree?.Items || [];
        if (items.length === 0) container.innerHTML = `<div class="empty">No files found</div>`;
        else items.forEach(it => container.appendChild(renderTreeItem(it)));
    }
}

// =====================================================================
// RENDER — tree node (recursive via lazy loading)
// =====================================================================
function renderTreeItem(item) {
    const wrapper = document.createElement("div");
    wrapper.className = "tree-item-wrapper";
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
        <span class="chevron${isFolder ? "" : " placeholder"}">${isFolder ? ICONS.chevron : ""}</span>
        <span class="tree-icon ${isFolder ? "folder-icon" : "file-icon"}">${isFolder ? ICONS.folder : fileIconHtml(item)}</span>
        <span class="tree-name">${escapeHtml(item.Name || "")}</span>
    `;
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
    container.innerHTML = `<div class="folder-loading"><div class="mini-loader"></div><span>Loading folder…</span></div>`;
    const children = await loadChildren(item.Id);
    container.innerHTML = "";
    const path = state.registry.get(item.Id)?.path
        ? `${state.registry.get(item.Id).path} / ${item.Name}`
        : item.Name;
    for (const c of children) registerItem(c, path);
    if (children.length === 0) container.innerHTML = `<div class="empty">Empty folder</div>`;
    else children.forEach(c => container.appendChild(renderTreeItem(c)));
}

// =====================================================================
// RENDER — search results
// =====================================================================
function renderSearchResults(container) {
    const q = state.search.query.trim().toLowerCase();
    const matches = [...state.registry.values()]
        .filter(e => e.name.toLowerCase().includes(q));

    if (matches.length === 0) {
        container.innerHTML = `<div class="empty">No matches</div>`;
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
                <div class="search-result-name">${escapeHtml(m.name)}</div>
                ${m.path ? `<div class="search-result-path">${escapeHtml(m.path)}</div>` : ""}
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
        el.innerHTML = `<button id="select-btn" class="container-action-btn">${ICONS.select}<span>Select</span></button>`;
        document.getElementById("select-btn").onclick = () => enterSelectionMode();
        return;
    }

    el.classList.add("selection-mode");
    el.innerHTML = `
        <button id="sel-cancel" class="sel-cancel" title="Cancel">${ICONS.close}</button>
        <span class="sel-count">${state.selected.size} <span class="sel-count-label">selected</span></span>
        <div class="sel-actions">
            <button id="sel-all"    class="sel-btn" title="Select all">${ICONS.checkboxOn}<span class="sel-btn-label">Select all</span></button>
            <button id="sel-none"   class="sel-btn" title="Deselect all">${ICONS.checkbox}<span class="sel-btn-label">Deselect all</span></button>
            <button id="sel-dl"     class="sel-btn sel-download"${state.selected.size === 0 ? " disabled" : ""} title="Download">
                ${ICONS.download}<span class="sel-btn-label">Download${state.selected.size > 0 ? ` (${state.selected.size})` : ""}</span>
            </button>
        </div>
    `;
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
    renderBody();
    renderActions();
}
function exitSelectionMode() {
    state.selectionMode = false;
    state.selected = new Set();
    renderBody();
    renderActions();
}
function toggleSelection(item) {
    if (state.selected.has(item.Id)) state.selected.delete(item.Id);
    else                              state.selected.add(item.Id);
    renderBody();
    renderActions();
}
function selectAll()   { state.selected = new Set(state.registry.keys()); renderBody(); renderActions(); }
function deselectAll() { state.selected = new Set();                       renderBody(); renderActions(); }

// =====================================================================
// SEARCH
// =====================================================================
function toggleSearch() {
    state.search.open = !state.search.open;
    if (!state.search.open) state.search.query = "";
    renderApp();
}

// =====================================================================
// PASSWORD / LOADING / ERROR SCREENS
// =====================================================================
function renderLoading() {
    app.innerHTML = `<div class="center"><div class="loader"></div><p>Loading your files…</p></div>`;
}
function renderError(msg) {
    app.innerHTML = `<div class="center error"><h3>Error</h3><p>${escapeHtml(msg)}</p></div>`;
}
function renderPassword(message = "") {
    app.innerHTML = `
        <div class="center password">
            <div class="password-icon">🔒</div>
            <h2>Password protected</h2>
            <p>${escapeHtml(message || "Enter the password to access this shared folder.")}</p>
            <input type="password" id="pwd" placeholder="Enter password" autocomplete="current-password" />
            <button id="pwdBtn" class="password-submit">Open folder</button>
        </div>
    `;
    const input = document.getElementById("pwd");
    const btn   = document.getElementById("pwdBtn");
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
