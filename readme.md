# DocumentTree Plain (HTML / JS Version)

A lightweight, dependency-free frontend for browsing shared folders using the DocumentTree API.

This version is built with **plain HTML, CSS, and JavaScript**, making it ideal for:
- Embedding in other apps
- Static hosting
- Lightweight public sharing

---

## 🚀 Features

- Public link access via `token` in the URL
- Optional password-protected folders
- Lazy loading of subfolders (only fetched when expanded)
- File preview & download
- Multi-select with bulk ZIP download
- No build step required

---

## 📁 Project Structure

```
DocumentTree.Plain/
│
├── index.html        Markup + container shells
├── styles.css        All look & feel — change me freely
├── app.js            Fetches the tree and renders it
└── media/
    ├── DocumentTree_Black_Small.png
    ├── Wo_icon.png
    └── DocumentTree.ico
```

---

## ▶️ How to run

This project must be served over HTTP (not `file://`) so that the browser allows the API calls.

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open: `http://localhost:8080/?token=YOUR_TOKEN`

Tokens are issued by the DocumentTree Management app (Source Links → copy URL).

---

## 🎨 Customising the design

All visuals live in `styles.css`. The file is plain CSS — no preprocessor, no framework — so you can override any rule directly.

### Where to start

| What you want to change | Class to edit |
| --- | --- |
| Page background | `body` |
| Top bar / logo strip | `.top-bar`, `.top-logo` |
| Footer | `.bottom-bar`, `.footer-brand` |
| The white card wrapping the tree | `.container` |
| Tree rows | `.tree-item`, `.tree-left`, `.tree-name` |
| Folder vs file styling | `.folder`, `.tree-icon` |
| Action buttons (preview / download) | `.preview-btn`, `.download-btn`, `.file-actions` |
| Password prompt | `.password-input`, `.password-submit`, `.password-error` |
| Loaders | `.loader`, `.mini-loader`, `.folder-loading` |

### Drop your brand colour in

Add a `:root` block at the top of `styles.css`:

```css
:root {
    --brand: #6366f1;
    --brand-2: #8b5cf6;
}

.top-bar, .bottom-bar { background: var(--brand); color: #fff; }
.download-btn:hover  { color: var(--brand); }
```

### Replace the logo

Swap `media/DocumentTree_Black_Small.png` with your own image — keep the same filename or update `<img src="…">` in `index.html`.

---

## 🔌 Working with the API

The base URL is the DocumentTree API instance you want to point at:

```js
const API_BASE = "https://documenttree-api.nukepages.net/SourceLinks";
```

Point this at your own instance for self-hosted deployments.

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

Keep the password in a variable while the user is browsing, and resend it on every API call:

```js
let currentPassword = "";

function onPasswordSubmit(pw) {
    currentPassword = pw;
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

Cache the result locally so the user can collapse/expand without re-fetching.

### 4. Preview a single file

The simplest path is to use the `PreviewUrl` already on the file item:

```js
function previewFile(item) {
    if (!item.PreviewUrl) return;
    window.open(item.PreviewUrl, "_blank");
}
```

`/Preview/<encoded>` streams the file inline (`Content-Disposition: inline`) so PDFs / images render in the browser tab. Audio, video and plain text files are also supported by the browser; binary formats fall back to download.

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

For multi-select downloads (e.g. tick boxes in your UI, then a "Download N" button) call:

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
- Anything else (multiple files, or any folder) is packaged into `Download.zip` with the original folder layout inside.
- Same `token` + `password` semantics as the other endpoints.

---

## 🧱 Building your own UI on top

`app.js` is intentionally small (~280 lines) and uses no framework. To wire the API into your own markup:

1. Parse the token: `new URLSearchParams(window.location.search).get("token")`.
2. Call `publicLink` and render the root items.
3. For each item, render a row with click handlers based on `item.Type`.
4. Store the password once entered, reuse it on every subsequent call.
5. Use `item.PreviewUrl` / `item.DownloadUrl` for single-file actions, and `downloadMultiple` when you have a selection.

The endpoints above are the entire surface area needed for a public-link viewer — there is no auth header, no SDK, no required browser features beyond `fetch` + `URL.createObjectURL`.

---

## 📜 License

Use and adapt freely. Attribution appreciated but not required.
