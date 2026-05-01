export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "style") e.style.cssText = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "html") e.innerHTML = v;
      else e.setAttribute(k, v === true ? "" : v);
    }
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let modalCleanup = null;
export function showModal(node, opts = {}) {
  const root = document.getElementById("modal-root");
  closeModal();
  const overlay = el("div", { class: "modal-overlay", onclick: (e) => { if (e.target === overlay && !opts.persistent) closeModal(); } });
  const modal = el("div", { class: "modal" + (opts.wide ? " wide" : "") });
  modal.append(node);
  overlay.append(modal);
  root.append(overlay);
  const onKey = (e) => { if (e.key === "Escape" && !opts.persistent) closeModal(); };
  document.addEventListener("keydown", onKey);
  modalCleanup = () => document.removeEventListener("keydown", onKey);
}

export function closeModal() {
  const root = document.getElementById("modal-root");
  if (root) root.innerHTML = "";
  if (modalCleanup) { modalCleanup(); modalCleanup = null; }
}

export function toast(message, kind = "info") {
  const root = document.getElementById("toast-root") || (() => {
    const r = el("div", { id: "toast-root" });
    document.body.append(r);
    return r;
  })();
  const t = el("div", { class: `toast toast-${kind}` }, message);
  root.append(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function formatRelativeTime(ts) {
  if (!ts) return "just now";
  const date = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}
