import { CATEGORIES, CATEGORY_COLORS } from "./config.js";

const DEFAULT_BOARD_TITLE = "Title Name";
import { onAuthChange, signInAnon, signInGoogle, signOutUser, displayNameOf } from "./auth.js";
import { subscribePosts, createPost, updatePost, deletePost, toggleLike, setPinned } from "./posts.js";
import { subscribeComments, addComment, deleteComment } from "./comments.js";
import { subscribeAnnouncement, setAnnouncement, subscribeBoardTitle, setBoardTitle } from "./settings.js";
import { isAdmin, exportCSV } from "./admin.js";
import { el, escapeHtml, showModal, closeModal, toast, fileToDataUrl, formatRelativeTime } from "./ui.js";

const state = {
  user: null,
  posts: [],
  search: "",
  category: "",
  sort: "newest",
  unsubPosts: null,
  unsubAnnouncement: null,
  unsubBoardTitle: null,
  detailOpenFor: null,
  unsubDetailComments: null,
};

document.getElementById("board-title").textContent = DEFAULT_BOARD_TITLE;
document.getElementById("board-title-edit").onclick = openBoardTitleEditor;
applyTheme();
populateCategoryFilter();
wireToolbar();
wireFab();
wireOnlineStatus();
onAuthChange(handleAuthChange);

function applyTheme() {
  const t = localStorage.getItem("theme") || "light";
  document.documentElement.classList.toggle("dark", t === "dark");
}
function toggleTheme() {
  const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
  localStorage.setItem("theme", next);
  document.documentElement.classList.toggle("dark", next === "dark");
}

function populateCategoryFilter() {
  const sel = document.getElementById("category-filter");
  for (const c of CATEGORIES) {
    sel.append(el("option", { value: c }, c));
  }
}

function wireToolbar() {
  document.getElementById("search").addEventListener("input", (e) => { state.search = e.target.value; renderBoard(); });
  document.getElementById("category-filter").addEventListener("change", (e) => { state.category = e.target.value; renderBoard(); });
  document.getElementById("sort").addEventListener("change", (e) => { state.sort = e.target.value; renderBoard(); });
  document.getElementById("export-csv").addEventListener("click", () => {
    exportCSV(state.posts);
    toast("CSV downloaded", "success");
  });
}

function wireFab() {
  document.getElementById("fab").addEventListener("click", openComposer);
}

function wireOnlineStatus() {
  const el = document.getElementById("online-status");
  const label = document.getElementById("online-label");
  function update() {
    const online = navigator.onLine && !!state.user;
    el.classList.toggle("offline", !online);
    label.textContent = online ? "Online classroom board" : navigator.onLine ? "Sign in to collaborate" : "Offline — changes will sync";
  }
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

function handleAuthChange(user) {
  state.user = user;
  if (state.unsubPosts) { state.unsubPosts(); state.unsubPosts = null; }
  if (state.unsubAnnouncement) { state.unsubAnnouncement(); state.unsubAnnouncement = null; }
  if (state.unsubBoardTitle) { state.unsubBoardTitle(); state.unsubBoardTitle = null; }
  renderUserArea();
  wireOnlineStatus();
  if (!user) {
    showSignInModal();
    document.getElementById("fab").hidden = true;
    document.getElementById("export-csv").hidden = true;
    document.getElementById("board").innerHTML = "";
    document.getElementById("announcement").classList.add("hidden");
    return;
  }
  closeModal();
  document.getElementById("fab").hidden = false;
  const admin = isAdmin(user);
  document.getElementById("export-csv").hidden = !admin;
  document.getElementById("announcement-edit").hidden = !admin;
  state.unsubPosts = subscribePosts((items, err) => {
    if (err) { toast("Failed to load posts: " + (err.message || err.code), "error"); return; }
    state.posts = items;
    renderBoard();
    if (state.detailOpenFor) {
      const fresh = state.posts.find((p) => p.id === state.detailOpenFor);
      if (fresh) refreshDetailModal(fresh);
    }
  });
  state.unsubAnnouncement = subscribeAnnouncement((text) => renderAnnouncement(text));
  state.unsubBoardTitle = subscribeBoardTitle((title) => {
    document.getElementById("board-title").textContent = title || DEFAULT_BOARD_TITLE;
  });
}

async function openBoardTitleEditor() {
  if (!state.user) {
    try {
      await signInAnon("");
    } catch (e) {
      toast("Sign-in failed: " + (e.message || e.code), "error");
      return;
    }
  }
  const cur = document.getElementById("board-title").textContent;
  const input = el("input", { type: "text", placeholder: "Board title" });
  input.value = cur && cur !== DEFAULT_BOARD_TITLE ? cur : "";
  const node = el("div", null,
    el("h2", null, "Edit board title"),
    input,
    el("div", { class: "modal-actions" },
      el("button", { class: "btn btn-secondary", onclick: closeModal }, "Cancel"),
      el("button", { class: "btn", onclick: async () => {
        try { await setBoardTitle(input.value.trim()); toast("Title updated", "success"); closeModal(); }
        catch (e) { toast("Failed: " + (e.message || e.code), "error"); }
      }}, "Save"),
    ),
  );
  showModal(node);
  setTimeout(() => { input.focus(); input.select(); }, 50);
}

function renderUserArea() {
  const wrap = document.getElementById("user-area");
  wrap.innerHTML = "";
  wrap.append(
    el("button", { class: "btn-icon", onclick: toggleTheme, title: "Toggle theme" }, "🌓")
  );
  if (!state.user) {
    wrap.append(el("button", { class: "btn", onclick: showSignInModal }, "Sign in"));
    return;
  }
  const name = displayNameOf(state.user);
  const initial = (name[0] || "?").toUpperCase();
  const chip = el("div", { class: "user-chip" });
  if (state.user.photoURL) {
    const a = el("div", { class: "avatar" });
    const img = document.createElement("img");
    img.src = state.user.photoURL;
    img.referrerPolicy = "no-referrer";
    a.append(img);
    chip.append(a);
  } else {
    chip.append(el("div", { class: "avatar" }, initial));
  }
  chip.append(document.createTextNode(name));
  if (isAdmin(state.user)) chip.append(el("span", { class: "admin-badge" }, "Admin"));
  wrap.append(chip);
  wrap.append(el("button", { class: "btn-secondary btn", onclick: async () => { await signOutUser(); toast("Signed out", "info"); } }, "Sign out"));
}

function renderAnnouncement(text) {
  const banner = document.getElementById("announcement");
  const t = document.getElementById("announcement-text");
  const editBtn = document.getElementById("announcement-edit");
  t.textContent = text || "";
  banner.classList.toggle("hidden", !text && !isAdmin(state.user));
  if (isAdmin(state.user)) {
    banner.classList.remove("hidden");
    if (!text) t.textContent = "(No announcement — click Edit to add one)";
  }
  editBtn.onclick = openAnnouncementEditor;
}

function openAnnouncementEditor() {
  const cur = document.getElementById("announcement-text").textContent;
  const ta = el("textarea", { placeholder: "Announcement to pin to the top of the board" });
  ta.value = cur.startsWith("(No announcement") ? "" : cur;
  const node = el("div", null,
    el("h2", null, "Edit announcement"),
    ta,
    el("div", { class: "modal-actions" },
      el("button", { class: "btn btn-secondary", onclick: closeModal }, "Cancel"),
      el("button", { class: "btn", onclick: async () => {
        try { await setAnnouncement(ta.value); toast("Announcement updated", "success"); closeModal(); }
        catch (e) { toast("Failed: " + (e.message || e.code), "error"); }
      }}, "Save")
    ),
  );
  showModal(node);
  setTimeout(() => ta.focus(), 50);
}

function filterAndSort(posts) {
  const s = state.search.trim().toLowerCase();
  let out = posts.filter((p) => {
    if (state.category && p.category !== state.category) return false;
    if (s) {
      const blob = (p.title + " " + p.description + " " + (p.authorName || "") + " " + (p.category || "")).toLowerCase();
      if (!blob.includes(s)) return false;
    }
    return true;
  });
  // Pinned always first
  const pinned = out.filter((p) => p.pinned);
  const rest = out.filter((p) => !p.pinned);
  const sortFn = {
    newest: (a, b) => tsMs(b.createdAt) - tsMs(a.createdAt),
    oldest: (a, b) => tsMs(a.createdAt) - tsMs(b.createdAt),
    liked: (a, b) => (b.likes?.length || 0) - (a.likes?.length || 0),
  }[state.sort];
  pinned.sort(sortFn); rest.sort(sortFn);
  return [...pinned, ...rest];
}

function tsMs(t) {
  if (!t) return 0;
  if (t.toDate) return t.toDate().getTime();
  if (t.seconds) return t.seconds * 1000;
  return 0;
}

function renderBoard() {
  const board = document.getElementById("board");
  board.innerHTML = "";
  const items = filterAndSort(state.posts);
  if (items.length === 0) {
    board.append(el("div", { class: "empty-state", style: "column-span: all;" },
      el("h2", null, state.posts.length === 0 ? "No posts yet" : "No matches"),
      el("p", null, state.posts.length === 0 ? "Tap the + button to add the first post." : "Try a different search or filter."),
    ));
    return;
  }
  for (const p of items) board.append(postCard(p));
}

function postCard(p) {
  const liked = !!state.user && (p.likes || []).includes(state.user.uid);
  const card = el("div", { class: "post" + (p.pinned ? " pinned" : ""), onclick: () => openDetail(p) });
  if (p.pinned) card.append(el("div", { class: "pin-icon" }, "📌 Pinned"));
  if (p.imageUrl) {
    const img = document.createElement("img");
    img.src = p.imageUrl;
    img.className = "post-image";
    img.loading = "lazy";
    card.append(img);
  }
  if (p.category) card.append(el("div", { class: "category-chip", style: `background:${CATEGORY_COLORS[p.category] || "#e2e8f0"};` }, p.category));
  if (p.title) card.append(el("h3", { class: "post-title" }, p.title));
  if (p.description) card.append(el("p", { class: "post-body" }, truncate(p.description, 220)));
  if (p.linkUrl) {
    const a = el("a", { class: "post-link", href: p.linkUrl, target: "_blank", rel: "noopener", onclick: (e) => e.stopPropagation() }, "🔗 " + shortUrl(p.linkUrl));
    card.append(a);
  }
  const meta = el("div", { class: "post-meta" },
    el("span", { class: "author-row" }, "👤 " + (p.authorName || "Anon"), " · ", formatRelativeTime(p.createdAt)),
    el("button", {
      class: "like-btn" + (liked ? " liked" : ""),
      onclick: async (e) => { e.stopPropagation(); if (!state.user) return; try { await toggleLike(p.id, state.user.uid, liked); } catch (err) { toast("Like failed", "error"); } },
    }, el("span", { class: "heart" }, liked ? "♥" : "♡"), String((p.likes || []).length)),
  );
  card.append(meta);
  return card;
}

function truncate(s, n) {
  if (!s || s.length <= n) return s || "";
  return s.slice(0, n).trimEnd() + "…";
}
function shortUrl(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; }
}

function openDetail(p) {
  state.detailOpenFor = p.id;
  showModal(buildDetailNode(p), { wide: true });
  if (state.unsubDetailComments) state.unsubDetailComments();
  state.unsubDetailComments = subscribeComments(p.id, (comments) => renderCommentThread(p, comments));
  // Cleanup when modal closes
  const observer = new MutationObserver(() => {
    if (!document.getElementById("modal-root").firstChild) {
      if (state.unsubDetailComments) { state.unsubDetailComments(); state.unsubDetailComments = null; }
      state.detailOpenFor = null;
      observer.disconnect();
    }
  });
  observer.observe(document.getElementById("modal-root"), { childList: true });
}

function refreshDetailModal(p) {
  const root = document.getElementById("modal-root");
  if (!root.firstChild) return;
  const modal = root.querySelector(".modal");
  if (!modal) return;
  modal.innerHTML = "";
  modal.append(buildDetailNode(p));
}

function buildDetailNode(p) {
  const liked = !!state.user && (p.likes || []).includes(state.user.uid);
  const own = state.user && state.user.uid === p.authorId;
  const admin = isAdmin(state.user);

  const node = el("div", null);
  if (p.imageUrl) {
    const img = document.createElement("img");
    img.src = p.imageUrl;
    img.className = "detail-image";
    node.append(img);
  }
  if (p.category) node.append(el("div", { class: "category-chip", style: `background:${CATEGORY_COLORS[p.category] || "#e2e8f0"};` }, p.category));
  if (p.pinned) node.append(el("span", { class: "category-chip", style: "background:var(--accent); color:white; margin-left:6px;" }, "📌 Pinned"));
  node.append(el("h2", { class: "detail-title" }, p.title || "(Untitled)"));
  node.append(el("div", { class: "detail-meta" },
    "👤 " + (p.authorName || "Anon"),
    " · " + formatRelativeTime(p.createdAt),
    p.updatedAt && tsMs(p.updatedAt) - tsMs(p.createdAt) > 5000 ? " · edited" : "",
  ));
  if (p.description) node.append(el("p", { class: "detail-body" }, p.description));
  if (p.linkUrl) {
    const a = el("a", { class: "detail-link", href: p.linkUrl, target: "_blank", rel: "noopener" }, "🔗 " + p.linkUrl);
    node.append(a);
  }

  // Actions
  const actions = el("div", { class: "detail-actions" });
  actions.append(el("button", {
    class: "like-btn" + (liked ? " liked" : ""),
    onclick: async () => { if (!state.user) return; try { await toggleLike(p.id, state.user.uid, liked); } catch (e) { toast("Like failed", "error"); } },
  }, el("span", { class: "heart" }, liked ? "♥" : "♡"), `${(p.likes || []).length} like${(p.likes || []).length === 1 ? "" : "s"}`));
  if (own) {
    actions.append(el("button", { class: "btn-secondary btn", onclick: () => openEdit(p) }, "Edit"));
    actions.append(el("button", { class: "btn-danger btn", onclick: () => confirmDelete(p) }, "Delete"));
  }
  if (admin) {
    actions.append(el("button", { class: "btn-secondary btn", onclick: async () => {
      try { await setPinned(p.id, !p.pinned); toast(p.pinned ? "Unpinned" : "Pinned", "success"); }
      catch (e) { toast("Failed: " + (e.message || e.code), "error"); }
    }}, p.pinned ? "Unpin" : "Pin"));
    if (!own) actions.append(el("button", { class: "btn-danger btn", onclick: () => confirmDelete(p) }, "Delete (admin)"));
  }
  node.append(actions);

  // Comments
  node.append(el("h3", { style: "font-size:15px; margin: 12px 0 8px;" }, "Comments"));
  const thread = el("div", { class: "comment-thread", id: "comment-thread" });
  thread.append(el("div", { class: "comment-empty" }, "Loading…"));
  node.append(thread);

  const ta = el("textarea", { placeholder: "Add a comment…" });
  const form = el("form", { class: "comment-form", onsubmit: async (e) => {
    e.preventDefault();
    if (!ta.value.trim()) return;
    try { await addComment(p.id, ta.value); ta.value = ""; }
    catch (err) { toast("Comment failed: " + (err.message || err.code), "error"); }
  }},
    ta,
    el("button", { class: "btn", type: "submit" }, "Post"),
  );
  node.append(form);
  return node;
}

function renderCommentThread(post, comments) {
  const thread = document.getElementById("comment-thread");
  if (!thread) return;
  thread.innerHTML = "";
  if (comments.length === 0) {
    thread.append(el("div", { class: "comment-empty" }, "No comments yet — be the first."));
    return;
  }
  for (const c of comments) {
    const canDelete = state.user && (state.user.uid === c.authorId || isAdmin(state.user));
    const node = el("div", { class: "comment" },
      canDelete ? el("button", {
        class: "delete-btn", title: "Delete",
        onclick: async () => { if (confirm("Delete this comment?")) { try { await deleteComment(c.id); } catch (e) { toast("Failed", "error"); } } },
      }, "×") : null,
      el("div", { class: "head" }, el("strong", null, c.authorName || "Anon"), " · " + formatRelativeTime(c.createdAt)),
      el("div", { class: "text" }, c.text || ""),
    );
    thread.append(node);
  }
}

function confirmDelete(p) {
  if (!confirm("Delete this post and its comments?")) return;
  deletePost(p).then(() => { toast("Post deleted", "success"); closeModal(); }).catch((e) => toast("Failed: " + (e.message || e.code), "error"));
}

function openComposer() {
  if (!state.user) { showSignInModal(); return; }
  const titleInput = el("input", { type: "text", placeholder: "Title" });
  const descInput = el("textarea", { placeholder: "What's your idea, reflection, or answer?" });
  const linkInput = el("input", { type: "url", placeholder: "https:// (optional link)" });
  const catSelect = el("select", null, ...CATEGORIES.map((c) => el("option", { value: c }, c)));

  let submitting = false;
  const submitBtn = el("button", { class: "btn", onclick: async () => {
    if (submitting) return;
    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    if (!title && !description) { toast("Add a title or description", "error"); return; }
    submitting = true;
    submitBtn.textContent = "Posting…";
    try {
      await createPost({
        title, description,
        category: catSelect.value,
        file: null,
        linkUrl: linkInput.value.trim(),
        authorName: displayNameOf(state.user),
      });
      toast("Post added", "success");
      closeModal();
    } catch (e) {
      console.error(e);
      toast("Failed to post: " + (e.message || e.code), "error");
      submitBtn.textContent = "Post";
      submitting = false;
    }
  }}, "Post");

  const node = el("div", null,
    el("h2", null, "New post"),
    el("label", null, "Title"), titleInput,
    el("label", null, "Description"), descInput,
    el("label", null, "Category"), catSelect,
    el("label", null, "Link (optional)"), linkInput,
    el("div", { class: "modal-actions" },
      el("button", { class: "btn btn-secondary", onclick: closeModal }, "Cancel"),
      submitBtn,
    ),
  );
  showModal(node);
  setTimeout(() => titleInput.focus(), 50);
}

function openEdit(p) {
  const titleInput = el("input", { type: "text" });
  titleInput.value = p.title || "";
  const descInput = el("textarea");
  descInput.value = p.description || "";
  const linkInput = el("input", { type: "url" });
  linkInput.value = p.linkUrl || "";
  const catSelect = el("select", null, ...CATEGORIES.map((c) => el("option", { value: c, selected: c === p.category ? "" : null }, c)));
  catSelect.value = p.category || CATEGORIES[0];

  const node = el("div", null,
    el("h2", null, "Edit post"),
    el("label", null, "Title"), titleInput,
    el("label", null, "Description"), descInput,
    el("label", null, "Category"), catSelect,
    el("label", null, "Link"), linkInput,
    el("div", { class: "modal-actions" },
      el("button", { class: "btn btn-secondary", onclick: closeModal }, "Cancel"),
      el("button", { class: "btn", onclick: async () => {
        try {
          await updatePost(p.id, {
            title: titleInput.value.trim(),
            description: descInput.value.trim(),
            category: catSelect.value,
            linkUrl: linkInput.value.trim(),
          });
          toast("Saved", "success");
          closeModal();
        } catch (e) { toast("Failed: " + (e.message || e.code), "error"); }
      }}, "Save"),
    ),
  );
  showModal(node);
}

function showSignInModal() {
  const nick = el("input", { type: "text", placeholder: "Nickname (optional)" });
  const node = el("div", null,
    el("button", { class: "modal-close-btn", onclick: closeModal, title: "Close", "aria-label": "Close" }, "×"),
    el("h2", null, "Welcome to the classroom board"),
    el("p", { style: "color: var(--muted); font-size: 14px; margin: 0 0 8px;" },
      "Sign in to post, comment, and like. You can join as a guest or with Google."),
    el("label", null, "Your nickname"), nick,
    el("div", { class: "signin-buttons" },
      el("button", { class: "btn", onclick: async () => {
        try { await signInAnon(nick.value); toast("Signed in as guest", "success"); }
        catch (e) { toast("Sign-in failed: " + (e.message || e.code), "error"); }
      }}, "Continue as guest"),
      el("div", { class: "signin-divider" }, "or"),
      el("button", { class: "btn signin-google", onclick: async () => {
        try { await signInGoogle(); toast("Signed in", "success"); }
        catch (e) { toast("Google sign-in failed: " + (e.message || e.code), "error"); }
      }}, "🔑  Sign in with Google"),
    ),
  );
  showModal(node);
  setTimeout(() => nick.focus(), 50);
}
