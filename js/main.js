import { onAuthChange, signInAnon, signOutUser, displayNameOf } from "./auth.js";
import { subscribePosts, createPost, updatePost, deletePost, toggleLike, setPinned } from "./posts.js";
import { subscribeComments, addComment, deleteComment } from "./comments.js";
import {
  createRoom, joinRoom, subscribeRoom, updateRoomTitle, setAnnouncement, isTrainer,
} from "./rooms.js";
import { exportCSV } from "./admin.js";
import { el, escapeHtml, showModal, closeModal, toast, formatRelativeTime } from "./ui.js";

const state = {
  user: null,
  roomId: null,
  room: null,
  posts: [],
  search: "",
  category: "",
  sort: "newest",
  unsubRoom: null,
  unsubPosts: null,
  detailOpenFor: null,
  unsubDetailComments: null,
};

boot();

function boot() {
  state.roomId = new URLSearchParams(location.search).get("room");
  applyTheme();
  wireToolbar();
  wireFab();
  wireOnlineStatus();
  document.getElementById("board-title-edit").onclick = openRoomTitleEditor;
  document.getElementById("announcement-edit").onclick = openAnnouncementEditor;
  onAuthChange(handleAuthChange);
}

function applyTheme() {
  const t = localStorage.getItem("theme") || "light";
  document.documentElement.classList.toggle("dark", t === "dark");
}
function toggleTheme() {
  const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
  localStorage.setItem("theme", next);
  document.documentElement.classList.toggle("dark", next === "dark");
}

function wireToolbar() {
  document.getElementById("search").addEventListener("input", (e) => { state.search = e.target.value; renderBoard(); });
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
  const elNode = document.getElementById("online-status");
  const label = document.getElementById("online-label");
  function update() {
    const online = navigator.onLine && !!state.user;
    elNode.classList.toggle("offline", !online);
    label.textContent = online ? "Online" : navigator.onLine ? "Sign in to collaborate" : "Offline — changes will sync";
  }
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

function teardownRoom() {
  if (state.unsubPosts) { state.unsubPosts(); state.unsubPosts = null; }
  if (state.unsubRoom) { state.unsubRoom(); state.unsubRoom = null; }
  if (state.unsubDetailComments) { state.unsubDetailComments(); state.unsubDetailComments = null; }
  state.room = null;
  state.posts = [];
  state.detailOpenFor = null;
  closeModal();
}

function setRoomInURL(code) {
  const url = code ? location.pathname + "?room=" + code : location.pathname;
  history.replaceState(null, "", url);
}

function handleAuthChange(user) {
  state.user = user;
  teardownRoom();
  renderUserArea();
  wireOnlineStatus();

  if (!state.roomId) {
    showLanding();
    return;
  }

  if (!user) {
    showJoinPrompt(state.roomId);
    return;
  }

  enterRoom();
}

function enterRoom() {
  showInRoomShell();
  state.unsubRoom = subscribeRoom(state.roomId, (room, err) => {
    if (err || !room) {
      toast(err ? ("Room error: " + (err.message || err.code)) : "Room not found", "error");
      state.roomId = null;
      setRoomInURL(null);
      teardownRoom();
      showLanding();
      return;
    }
    state.room = room;
    renderHeaderForRoom();
    renderAnnouncement(room.announcement);
    renderUserArea();
  });
  state.unsubPosts = subscribePosts(state.roomId, (items, err) => {
    if (err) { toast("Failed to load posts: " + (err.message || err.code), "error"); return; }
    state.posts = items;
    renderBoard();
    if (state.detailOpenFor) {
      const fresh = state.posts.find((p) => p.id === state.detailOpenFor);
      if (fresh) refreshDetailModal(fresh);
    }
  });
}

function showInRoomShell() {
  document.getElementById("toolbar").hidden = false;
  document.getElementById("fab").hidden = false;
  document.getElementById("announcement").classList.remove("hidden");
  document.getElementById("board-title-edit").hidden = false;
  document.getElementById("board").innerHTML = "";
}

function showLanding() {
  document.getElementById("toolbar").hidden = true;
  document.getElementById("fab").hidden = true;
  document.getElementById("export-csv").hidden = true;
  document.getElementById("announcement").classList.add("hidden");
  document.getElementById("board-title-edit").hidden = true;
  document.getElementById("board-title").textContent = "Padlet Classrooms";
  renderLanding();
}

function showJoinPrompt(code) {
  document.getElementById("toolbar").hidden = true;
  document.getElementById("fab").hidden = true;
  document.getElementById("export-csv").hidden = true;
  document.getElementById("announcement").classList.add("hidden");
  document.getElementById("board-title-edit").hidden = true;
  document.getElementById("board-title").textContent = "Join classroom " + code;
  renderJoinForm(code);
}

function renderLanding() {
  const board = document.getElementById("board");
  board.innerHTML = "";

  const createNick = el("input", { type: "text", placeholder: "Your name (e.g. Trainer Alex)" });
  const createBtn = el("button", { class: "btn", onclick: async () => {
    if (createBtn.disabled) return;
    createBtn.disabled = true;
    createBtn.textContent = "Creating…";
    try {
      const code = await createRoom(createNick.value);
      state.roomId = code;
      setRoomInURL(code);
      toast("Classroom created", "success");
      renderUserArea();
      enterRoom();
    } catch (e) {
      toast("Could not create: " + (e.message || e.code), "error");
      createBtn.disabled = false;
      createBtn.textContent = "Create classroom";
    }
  }}, "Create classroom");

  const joinNick = el("input", { type: "text", placeholder: "Your name" });
  const joinCode = el("input", { type: "text", placeholder: "Classroom code (e.g. ABC123)", maxlength: 6, style: "text-transform: uppercase;" });
  joinCode.addEventListener("input", () => { joinCode.value = joinCode.value.toUpperCase(); });
  const joinBtn = el("button", { class: "btn", onclick: async () => {
    if (joinBtn.disabled) return;
    joinBtn.disabled = true;
    joinBtn.textContent = "Joining…";
    try {
      const code = await joinRoom(joinCode.value, joinNick.value);
      state.roomId = code;
      setRoomInURL(code);
      toast("Joined " + code, "success");
      renderUserArea();
      enterRoom();
    } catch (e) {
      toast(e.message || "Could not join", "error");
      joinBtn.disabled = false;
      joinBtn.textContent = "Join classroom";
    }
  }}, "Join classroom");

  const card = el("div", { class: "landing" },
    el("div", { class: "landing-card" },
      el("h2", null, "Create a new classroom"),
      el("p", { class: "landing-hint" }, "Start a fresh board. You'll be the trainer (can edit title and announcement)."),
      el("label", null, "Your name"), createNick,
      el("div", { class: "landing-actions" }, createBtn),
    ),
    el("div", { class: "landing-card" },
      el("h2", null, "Join an existing classroom"),
      el("p", { class: "landing-hint" }, "Got a code from your trainer? Type it in."),
      el("label", null, "Your name"), joinNick,
      el("label", null, "Classroom code"), joinCode,
      el("div", { class: "landing-actions" }, joinBtn),
    ),
  );
  board.append(card);
}

function renderJoinForm(code) {
  const board = document.getElementById("board");
  board.innerHTML = "";
  const nick = el("input", { type: "text", placeholder: "Your name" });
  const goBtn = el("button", { class: "btn", onclick: async () => {
    if (goBtn.disabled) return;
    goBtn.disabled = true;
    goBtn.textContent = "Joining…";
    try {
      await joinRoom(code, nick.value);
      // handleAuthChange will fire and route into enterRoom
    } catch (e) {
      toast(e.message || "Could not join", "error");
      goBtn.disabled = false;
      goBtn.textContent = "Join classroom";
    }
  }}, "Join classroom");
  const back = el("button", { class: "btn btn-secondary", onclick: () => {
    state.roomId = null;
    setRoomInURL(null);
    showLanding();
  }}, "Back to all classrooms");

  const card = el("div", { class: "landing" },
    el("div", { class: "landing-card" },
      el("h2", null, "Join classroom"),
      el("p", { class: "landing-hint" }, "Joining classroom code: ", el("strong", null, code)),
      el("label", null, "Your name"), nick,
      el("div", { class: "landing-actions" }, goBtn, back),
    ),
  );
  board.append(card);
  setTimeout(() => nick.focus(), 50);
}

function renderHeaderForRoom() {
  const titleEl = document.getElementById("board-title");
  titleEl.innerHTML = "";
  const titleText = (state.room && state.room.title) || "Untitled Classroom";
  titleEl.append(document.createTextNode(titleText));
  titleEl.append(el("span", { class: "room-code" }, " · " + state.roomId));
}

function renderUserArea() {
  const wrap = document.getElementById("user-area");
  wrap.innerHTML = "";
  wrap.append(
    el("button", { class: "btn-icon", onclick: toggleTheme, title: "Toggle theme" }, "🌓")
  );
  if (!state.user) return;
  const name = displayNameOf(state.user);
  const initial = (name[0] || "?").toUpperCase();
  const trainer = isTrainer(state.user, state.room);
  const chip = el("div", { class: "user-chip" });
  chip.append(el("div", { class: "avatar" }, initial));
  chip.append(document.createTextNode(name));
  if (trainer) chip.append(el("span", { class: "admin-badge" }, "Trainer"));
  wrap.append(chip);
  wrap.append(el("button", { class: "btn-secondary btn", onclick: handleSignOut }, "Sign out"));

  // Show export-csv only for trainer
  document.getElementById("export-csv").hidden = !trainer;
  document.getElementById("announcement-edit").hidden = !trainer;
}

async function handleSignOut() {
  if (isTrainer(state.user, state.room)) {
    if (!confirm("You're the trainer of this classroom. Signing out will remove your trainer access. Continue?")) return;
  }
  await signOutUser();
  state.roomId = null;
  setRoomInURL(null);
  toast("Signed out", "info");
}

async function openRoomTitleEditor() {
  if (!state.roomId) return;
  const cur = (state.room && state.room.title) || "";
  const input = el("input", { type: "text", placeholder: "Classroom title" });
  input.value = cur;
  const node = el("div", null,
    el("h2", null, "Classroom title"),
    input,
    el("div", { class: "modal-actions" },
      el("button", { class: "btn btn-secondary", onclick: closeModal }, "Cancel"),
      el("button", { class: "btn", onclick: async () => {
        try { await updateRoomTitle(state.roomId, input.value.trim()); toast("Title updated", "success"); closeModal(); }
        catch (e) { toast("Failed: " + (e.message || e.code), "error"); }
      }}, "Save"),
    ),
  );
  showModal(node);
  setTimeout(() => { input.focus(); input.select(); }, 50);
}

function renderAnnouncement(text) {
  const banner = document.getElementById("announcement");
  const t = document.getElementById("announcement-text");
  const editBtn = document.getElementById("announcement-edit");
  const trainer = isTrainer(state.user, state.room);
  t.textContent = text || "";
  banner.classList.toggle("hidden", !text && !trainer);
  if (trainer) {
    banner.classList.remove("hidden");
    if (!text) t.textContent = "(No announcement — click Edit to add one)";
  }
  editBtn.hidden = !trainer;
}

function openAnnouncementEditor() {
  if (!isTrainer(state.user, state.room)) return;
  const cur = document.getElementById("announcement-text").textContent;
  const ta = el("textarea", { placeholder: "Announcement to pin to the top of the board" });
  ta.value = cur.startsWith("(No announcement") ? "" : cur;
  const node = el("div", null,
    el("h2", null, "Edit announcement"),
    ta,
    el("div", { class: "modal-actions" },
      el("button", { class: "btn btn-secondary", onclick: closeModal }, "Cancel"),
      el("button", { class: "btn", onclick: async () => {
        try { await setAnnouncement(state.roomId, ta.value); toast("Announcement updated", "success"); closeModal(); }
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
    if (s) {
      const blob = (p.title + " " + p.description + " " + (p.authorName || "")).toLowerCase();
      if (!blob.includes(s)) return false;
    }
    return true;
  });
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
  if (p.title) card.append(el("h3", { class: "post-title" }, p.title));
  if (p.description) card.append(el("p", { class: "post-body" }, truncate(p.description, 500)));
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
  const trainer = isTrainer(state.user, state.room);

  const node = el("div", null);
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

  const actions = el("div", { class: "detail-actions" });
  actions.append(el("button", {
    class: "like-btn" + (liked ? " liked" : ""),
    onclick: async () => { if (!state.user) return; try { await toggleLike(p.id, state.user.uid, liked); } catch (e) { toast("Like failed", "error"); } },
  }, el("span", { class: "heart" }, liked ? "♥" : "♡"), `${(p.likes || []).length} like${(p.likes || []).length === 1 ? "" : "s"}`));
  if (own) {
    actions.append(el("button", { class: "btn-secondary btn", onclick: () => openEdit(p) }, "Edit"));
    actions.append(el("button", { class: "btn-danger btn", onclick: () => confirmDelete(p) }, "Delete"));
  }
  node.append(actions);

  node.append(el("h3", { style: "font-size:15px; margin: 12px 0 8px;" }, "Comments"));
  const thread = el("div", { class: "comment-thread", id: "comment-thread" });
  thread.append(el("div", { class: "comment-empty" }, "Loading…"));
  node.append(thread);

  const ta = el("textarea", { placeholder: "Add a comment…" });
  const form = el("form", { class: "comment-form", onsubmit: async (e) => {
    e.preventDefault();
    if (!ta.value.trim()) return;
    try { await addComment(state.roomId, p.id, ta.value); ta.value = ""; }
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
    const canDelete = state.user && state.user.uid === c.authorId;
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
  if (!state.user) return;
  const titleInput = el("input", { type: "text", placeholder: "Title" });
  const descInput = el("textarea", { placeholder: "What's your idea, reflection, or answer?" });
  const linkInput = el("input", { type: "url", placeholder: "https:// (optional link)" });

  let submitting = false;
  const submitBtn = el("button", { class: "btn", onclick: async () => {
    if (submitting) return;
    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    if (!title && !description) { toast("Add a title or description", "error"); return; }
    submitting = true;
    submitBtn.textContent = "Posting…";
    try {
      await createPost(state.roomId, {
        title, description,
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

  const node = el("div", null,
    el("h2", null, "Edit post"),
    el("label", null, "Title"), titleInput,
    el("label", null, "Description"), descInput,
    el("label", null, "Link"), linkInput,
    el("div", { class: "modal-actions" },
      el("button", { class: "btn btn-secondary", onclick: closeModal }, "Cancel"),
      el("button", { class: "btn", onclick: async () => {
        try {
          await updatePost(p.id, {
            title: titleInput.value.trim(),
            description: descInput.value.trim(),
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
