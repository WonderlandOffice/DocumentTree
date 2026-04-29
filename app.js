const API_BASE = "https://documenttree-api.nukepages.net/SourceLinks";

const app = document.getElementById("app");
const token = new URLSearchParams(window.location.search).get("token");

let currentPassword = "";

// =====================
// INIT
// =====================
loadTree();

// =====================
// LOAD ROOT
// =====================
async function loadTree(password = "") {
    currentPassword = password;

    if (!token) {
        renderError("Missing token in URL");
        return;
    }

    renderLoading();

    try {
        const res = await fetch(`${API_BASE}/publicLink`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                token,
                password
            })
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("publicLink HTTP error:", res.status, text);
            renderError(`Failed loading public link (${res.status})`);
            return;
        }

        const result = await res.json();

        if (!result?.isSuccess) {
            if (result?.code === "401" || (result?.message || "").toLowerCase().includes("password")) {
                renderPassword(result?.message || "");
                return;
            }

            renderError(result?.message || "Unable to load public link");
            return;
        }

        renderTree(result.entity);
    } catch (err) {
        console.error("loadTree error:", err);
        renderError("Failed to connect to API");
    }
}

// =====================
// LOAD CHILDREN
// =====================
async function loadChildren(folderId) {
    try {
        const res = await fetch(`${API_BASE}/children`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                token,
                folderId,
                password: currentPassword
            })
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("children HTTP error:", res.status, text);
            throw new Error(`Failed loading folder (${res.status})`);
        }

        const result = await res.json();

        if (!result?.isSuccess) {
            if (result?.code === "401" || (result?.message || "").toLowerCase().includes("password")) {
                renderPassword(result?.message || "");
                return [];
            }

            throw new Error(result?.message || "Failed loading folder");
        }

        return result?.entity?.Items || [];
    } catch (err) {
        console.error("loadChildren error:", err);
        alert(err.message || "Failed loading folder");
        return [];
    }
}

// =====================
// RENDER TREE
// =====================
function renderTree(data) {
    app.innerHTML = `
      <h2>${escapeHtml(data?.Title || "Shared Folder")}</h2>
      <p>${escapeHtml(data?.Description || "")}</p>
      <div id="tree"></div>
   `;

    const tree = document.getElementById("tree");
    const items = data?.Items || [];

    items.forEach(item => {
        tree.appendChild(createItem(item));
    });
}

// =====================
// CREATE ITEM
// =====================
function createItem(item) {
    const wrapper = document.createElement("div");
    wrapper.className = "tree-item-wrapper";

    const isFolder = item.Type === "Folder";

    const treeItem = document.createElement("div");
    treeItem.className = "tree-item";

    const left = document.createElement("div");
    left.className = `tree-left ${isFolder ? "folder" : ""}`;
    left.innerHTML = `${isFolder ? "📁" : "📄"} <span class="tree-name">${escapeHtml(item.Name || "")}</span>`;

    treeItem.appendChild(left);

    if (!isFolder) {
        const actions = document.createElement("div");
        actions.className = "file-actions";

        const previewBtn = document.createElement("button");
        previewBtn.className = "preview-btn";
        previewBtn.title = "Preview";
        previewBtn.textContent = "👁";
        previewBtn.onclick = () => preview(item.PreviewUrl);

        const downloadBtn = document.createElement("button");
        downloadBtn.className = "download-btn";
        downloadBtn.title = "Download";
        downloadBtn.textContent = "⬇";
        downloadBtn.onclick = () => download(item.DownloadUrl);

        actions.appendChild(previewBtn);
        actions.appendChild(downloadBtn);
        treeItem.appendChild(actions);
    }

    wrapper.appendChild(treeItem);

    if (isFolder) {
        const childrenContainer = document.createElement("div");
        childrenContainer.className = "children";
        childrenContainer.style.display = "none";
        wrapper.appendChild(childrenContainer);

        let loaded = false;

        left.onclick = async () => {
            if (!loaded) {
                childrenContainer.innerHTML = `<div class="folder-loading">Loading folder...</div>`;

                const children = await loadChildren(item.Id);

                childrenContainer.innerHTML = "";

                if (children.length === 0) {
                    childrenContainer.innerHTML = `<div class="empty">Empty folder</div>`;
                } else {
                    children.forEach(child => {
                        childrenContainer.appendChild(createItem(child));
                    });
                }

                loaded = true;
            }

            childrenContainer.style.display =
                childrenContainer.style.display === "none" ? "block" : "none";
        };
    }

    return wrapper;
}

// =====================
// PASSWORD UI
// =====================
function renderPassword(message = "") {
    app.innerHTML = `
      <div class="center">
         <h2>Password required</h2>
         <p>${escapeHtml(message || "Enter the password to access this shared folder.")}</p>
         <input type="password" id="pwd" placeholder="Enter password" />
         <button id="pwdBtn">Open</button>
      </div>
   `;

    const input = document.getElementById("pwd");
    const btn = document.getElementById("pwdBtn");

    btn.onclick = submitPassword;
    input.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            submitPassword();
        }
    });

    input.focus();
}

function submitPassword() {
    const pwd = document.getElementById("pwd").value;
    loadTree(pwd);
}

// =====================
// STATES
// =====================
function renderLoading() {
    app.innerHTML = `
      <div class="center">
         <div class="loader"></div>
         <p>Loading your files...</p>
      </div>
   `;
}

function renderError(msg) {
    app.innerHTML = `
      <div class="center error">
         <h3>Error</h3>
         <p>${escapeHtml(msg || "Something went wrong")}</p>
      </div>
   `;
}

// =====================
// FILE ACTIONS
// =====================
function download(url) {
    if (!url) {
        alert("Download not available");
        return;
    }

    window.open(url, "_blank");
}

function preview(url) {
    if (!url) {
        alert("Preview not available");
        return;
    }

    window.open(url, "_blank");
}

// =====================
// HELPERS
// =====================
function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}