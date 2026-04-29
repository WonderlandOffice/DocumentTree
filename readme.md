# DocumentTree Plain (HTML / JS Version)

A lightweight, dependency-free frontend for browsing shared folders using the DocumentTree API.

This version is built with **plain HTML, CSS, and JavaScript** , making it ideal for:
- Embedding in other apps
- Static hosting
- Lightweight public sharing

---

## 🚀 Features

- Public link access via `token`
- Password-protected folders
- Lazy loading of subfolders
- File preview & download
- No build step required

---

## 📁 Project Structure

DocumentTree.Plain/
│
├── index.html
├── styles.css
├── app.js
└── media/
    ├── DocumentTree_Black_Small.png
    ├── Wo_icon.png
    └── DocumentTree.ico

---

## ▶️ How to run the project

This project must be served over HTTP (not `file://`).

### Option 1 (recommended)

Run a local server (bash):

npx serve .