# DocumentTree Plain (HTML / JS Version)

A lightweight, dependency-free frontend for browsing shared folders using the DocumentTree API.

This version is built with **plain HTML, CSS, and JavaScript**, making it ideal for:
- Embedding in other apps
- Static hosting
- Lightweight public sharing

---

## 🚀 Features

- Public link access via `token` in the URL
- Optional password-protected folders (password stored client-side so users stay signed in)
- Lazy loading of subfolders (only fetched when expanded) with background prefetch for search
- File preview & download with file-type aware icons (PDF, DOC, XLS, CSV, PPT) and live image thumbnails
- Right-click / long-press multi-select with bulk ZIP download (smart naming)
- Inline search across every file & folder in the share, with breadcrumb paths
- On-the-fly translation via Google Translate (folder/file names + UI labels) with cached + persisted results
- Sticky liquid-glass header that shrinks while scrolling, and a sticky bottom action bar
- Modern look out of the box, dependency-free SVG icons, dynamic-viewport mobile layout
- No build step required — host any way you like

---

## 📁 Project Structure

```
DocumentTree.Plain/
│
├── index.html        Markup shell (top bar, container, footer)
├── styles.css        All look & feel — change me freely
├── app.js            Fetches the tree, renders it, owns all behaviour
└── media/
    ├── DocumentTree_Black_Small.png
    ├── Wo_icon.png
    └── DocumentTree.ico
```

---

## ▶️ How to run

Plain has to be served over HTTP, not from `file://`, because the browser blocks JSON `fetch()` against local files.

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open: `http://localhost:8080/?token=YOUR_TOKEN`

Tokens are issued by the DocumentTree Management app (Source Links → copy URL).

By default Plain talks to the API that hosts the page (`window.location.origin`). To point it at a different DocumentTree instance, set a global before the script loads:

```html
<script>window.DOCUMENTTREE_API_BASE = "https://my-api.example.com/SourceLinks";</script>
<script src="app.js"></script>
```

---

## 🎨 Customising the design

All visuals live in `styles.css`. The file is plain CSS — no preprocessor, no framework — so you can override any rule directly.

### Where to start

| What you want to change | Class to edit |
| --- | --- |
| Page background / brand colour | `body`, `--accent` and friends in `:root` |
| Top bar / logo strip | `.top-bar`, `.top-logo`, `.top-logo-link` |
| Footer | `.bottom-bar`, `.footer-brand` |
| Card wrapping the tree | `.container` |
| Sticky frosted header | `.header`, `.container.scrolled .header` |
| Search input + toggle | `.header-search-input`, `.header-search-toggle` |
| Tree rows | `.tree-item`, `.tree-left`, `.tree-name` |
| Folder vs file styling | `.folder-icon`, `.file-icon`, `.tree-thumbnail` |
| Action buttons (preview / download) | `.preview-btn`, `.download-btn`, `.file-actions` |
| Bottom action bar (Select / bulk download) | `.container-actions`, `.sel-btn`, `.sel-download` |
| Search results list | `.search-results`, `.search-result`, `.search-result-path` |
| Language switcher | `.lang-wrap`, `.icon-btn.lang`, `.lang-menu` |
| Password screen | `.password`, `.password-submit`, `.password-icon` |
| Loaders | `.loader`, `.mini-loader`, `.folder-loading` |

### Drop in your brand colour

Edit the design tokens at the top of `styles.css`:

```css
:root {
    --accent:        #6366f1;
    --accent-2:      #8b5cf6;
    --accent-soft:   rgba(99, 102, 241, 0.12);
    --accent-ring:   rgba(99, 102, 241, 0.28);
    --folder:        #f59e0b;
}
```

Every button, link, hover state and the sticky liquid-glass header all flow from these.

### Replace the logo

Swap `media/DocumentTree_Black_Small.png` with your own image — keep the same filename or update `<img src="…">` in `index.html`. The logo is clickable: it sends users to `/` (the site home).

---

## 🌍 Translation

If the URL token ends in a 2-letter language code (e.g. `?token=ABC_NL`), Plain runs every folder name, file name, breadcrumb path and UI label through Google Translate.

- Supported languages: `nl`, `en`, `de`, `fr`, `it`, `es`
- Translations are cached in `localStorage` (`dtplain:translate-cache`) so repeat visits never hit the network
- Search matches against both the original and the translated text, so users can type in their own language

The dropdown in the top-right toggles between the languages — selecting one rewrites the URL (`token` becomes `token_XX`) and reloads.

---

## 🔌 Working with the API

The base URL is the DocumentTree API instance you want to point at:

```js
// Defaults to the host serving this page.
const API_BASE = (window.DOCUMENTTREE_API_BASE
    || `${window.location.origin}/SourceLinks`);
```

All endpoints below are publicly accessible — there is no login. Access control is handled by the **token** in the URL (and optionally a password set on the SourceLink).

---

### 1. Load the root of a shared folder — `POST /SourceLinks/publicLink`

```js
const res = await fetch(`${API_BASE}/publicLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        token: "YOUR_TOKEN",
        password: ""           // omit or empty for unprotected links
    })
});
const result = await res.json();

if (!result.isSuccess) {
    if (result.code === "401") {
        // Password required or wrong — show the password prompt
    } else {
        // Token invalid / link expired
    }
} else {
    // result.entity = { Title, Description, RootFolderId, Items: [...] }
    renderTree(result.entity);
}
```

Each item in `Items` looks like:

```json
{
    "Id": "01ABC…",
    "Name": "Brochure.pdf",
    "Type": "File",          // or "Folder"
    "DownloadUrl": "/Download/<encoded>",
    "PreviewUrl":  "/Preview/<encoded>"
}
```

`DownloadUrl` and `PreviewUrl` are present **only on files** and are obfuscated — you don't need the original file ID.

### 2. Handling passwords

Keep the password in a variable while the user is browsing, and resend it on every API call. Plain persists it in `localStorage` so the user stays signed in across reloads, tabs and even language switches:

```js
let currentPassword = "";

function onPasswordSubmit(pw) {
    currentPassword = pw;
    localStorage.setItem(`dtplain:pw:${token}`, pw);   // remembered
    loadTree(pw);
}
```

When `publicLink` returns `code: "401"` (or the message contains "password"), show your password UI and call `loadTree` again with the entered value. Same password must be sent to `children` and `downloadMultiple` below.

### 3. Lazy-load a subfolder — `POST /SourceLinks/children`

Folders are not expanded automatically. When the user clicks a folder row, call:

```js
const res = await fetch(`${API_BASE}/children`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        token,
        folderId: folder.Id,       // from the parent item
        password: currentPassword
    })
});
const result = await res.json();
// result.entity.Items = [...] (same shape as publicLink Items)
```

Cache the result locally so the user can collapse/expand without re-fetching. Plain also walks the cached subtree in the background so search has the full file list available.

### 4. Preview a single file

The simplest path is to use the `PreviewUrl` already on the file item:

```js
function previewFile(item) {
    if (!item.PreviewUrl) return;
    window.open(item.PreviewUrl, "_blank");
}
```

`/Preview/<encoded>` streams the file inline (`Content-Disposition: inline`) so PDFs / images render in the browser tab. Audio, video and plain text files are also supported by the browser; binary formats fall back to download.

Image files (`png`, `jpg`, `jpeg`, `gif`, `webp`, `bmp`, `svg`, `ico`, `avif`) get their `PreviewUrl` rendered as a 24×24 thumbnail directly in the tree.

If you only have the `token` + the raw file id (e.g. you re-built the tree yourself), call the public redirect endpoint:

```
GET /Preview/{token}/{fileId}
```

The server responds with a 302 to the actual streaming URL.

### 5. Download a single file

Same idea — the `DownloadUrl` on the file item is ready to use:

```js
function downloadFile(item) {
    if (!item.DownloadUrl) return;
    window.open(item.DownloadUrl, "_blank");
}
```

`/Download/<encoded>` returns the file with `Content-Disposition: attachment; filename="…"` so the browser saves it directly. The endpoint is anonymous and resolves the underlying file via the token-backed obfuscated id.

Token-based equivalent:

```
GET /Download/{token}/{fileId}
```

### 6. Select multiple files / folders — `POST /SourceLinks/downloadMultiple`

Plain enters selection mode on right-click (desktop) or long-press (touch). The bottom action bar then offers **Select all**, **Deselect all** and **Download (N)** — the download button POSTs to:

```js
const res = await fetch(`${API_BASE}/downloadMultiple`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        token,
        password: currentPassword,
        items: [
            { Id: "01ABC…", Type: "File"   },
            { Id: "01DEF…", Type: "File"   },
            { Id: "01XYZ…", Type: "Folder" }   // entire folder + contents
        ]
    })
});

const blob = await res.blob();
const url  = URL.createObjectURL(blob);
const a    = document.createElement("a");
a.href     = url;
a.download = "Download.zip";
document.body.appendChild(a);
a.click();
a.remove();
URL.revokeObjectURL(url);
```

Notes:
- A single file in the array streams the raw file (preserves the original name).
- A single folder produces `<folderName>.zip` with the folder's full contents inside.
- Anything else (mixed selection, multiple files) is packaged into `<linkName>.zip`.
- Same `token` + `password` semantics as the other endpoints.
- Plain swaps the Download button icon for a spinner while the API packages the ZIP — useful for large folders that take a few seconds.

---

## 📱 Mobile

Plain ships a real mobile layout (not just a shrink of the desktop):

- Dynamic viewport height (`var(--app-vh, 100dvh)`) so URL bar / on-screen keyboard never push the action bar off-screen
- Sticky liquid-glass top bar + bottom bar that survive page chrome changes
- Selection mode wraps to two lines so cancel / count and the action buttons always fit
- File names wrap with `overflow-wrap: anywhere` instead of clipping
- Long-press (500 ms) replaces right-click for entering selection mode
- The search button collapses; tapping it expands the input to take the full header width

---

## 🧱 Building your own UI on top

`app.js` is intentionally compact (~600 lines) and uses no framework. To wire the API into your own markup:

1. Parse the token: `new URLSearchParams(window.location.search).get("token")`.
2. Call `publicLink` and render the root items.
3. For each item, render a row with click handlers based on `item.Type`.
4. Store the password once entered, reuse it on every subsequent call.
5. Use `item.PreviewUrl` / `item.DownloadUrl` for single-file actions, and `downloadMultiple` when you have a selection.

The endpoints above are the entire surface area needed for a public-link viewer — there is no auth header, no SDK, no required browser features beyond `fetch` + `URL.createObjectURL`.

---

## 📜 License

Use and adapt freely. Attribution appreciated but not required.
