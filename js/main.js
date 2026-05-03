import { onAuthChange, signInAnon, signInGoogle, signOutUser, displayNameOf } from "./auth.js";
import { subscribePosts, subscribePdfPages, createPost, updatePost, deletePost, toggleLike, setPinned } from "./posts.js";
import { subscribeComments, addComment, deleteComment } from "./comments.js";
import {
  createRoom, joinRoom, subscribeRoom, updateRoomTitle, setAnnouncement, isTrainer,
  recordMembership, fetchMyRooms,
  createSection, updateSection, deleteSection, subscribeSections,
} from "./rooms.js";
import { exportCSV } from "./admin.js";
import { el, escapeHtml, showModal, closeModal, toast, formatRelativeTime, fileToDataUrl } from "./ui.js";

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
  unsubSections: null,
  sections: [],
  detailOpenFor: null,
  unsubDetailComments: null,
  unsubDetailPdfPages: null,
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

const RECENT_KEY = "padlet-recent-rooms";
const MAX_RECENT = 10;

function getRecentRooms() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; }
  catch { return []; }
}
function saveRecentRoom(code, title) {
  if (!code) return;
  const list = getRecentRooms().filter((r) => r.code !== code);
  list.unshift({ code, title: title || "", lastVisited: Date.now() });
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}
function removeRecentRoom(code) {
  const list = getRecentRooms().filter((r) => r.code !== code);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
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
  if (state.unsubSections) { state.unsubSections(); state.unsubSections = null; }
  if (state.unsubDetailComments) { state.unsubDetailComments(); state.unsubDetailComments = null; }
  if (state.unsubDetailPdfPages) { state.unsubDetailPdfPages(); state.unsubDetailPdfPages = null; }
  state.room = null;
  state.posts = [];
  state.sections = [];
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
    saveRecentRoom(state.roomId, room.title || "");
    recordMembership(state.roomId, room).catch(() => {});
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
  state.unsubSections = subscribeSections(state.roomId, (sections) => {
    state.sections = sections;
    renderBoard();
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

  // Sign-in panel at the top
  const signedIn = !!state.user;
  const signedInWithGoogle = signedIn && !state.user.isAnonymous;
  const signInPanel = el("div", { class: "landing-signin" });
  if (signedInWithGoogle) {
    signInPanel.append(
      el("div", { class: "landing-signin-info" },
        el("strong", null, "Signed in as " + displayNameOf(state.user)),
        el("div", { class: "landing-signin-hint" }, "Your trainer status will persist across devices and sessions."),
      ),
      el("button", { class: "btn btn-secondary", onclick: async () => {
        await signOutUser();
        toast("Signed out", "info");
      }}, "Sign out"),
    );
  } else if (signedIn) {
    // Anonymous
    signInPanel.append(
      el("div", { class: "landing-signin-info" },
        el("strong", null, "Continuing as " + displayNameOf(state.user)),
        el("div", { class: "landing-signin-hint" }, "You're signed in as a guest. For trainer access that persists across devices, sign in with Google."),
      ),
      el("button", { class: "btn", onclick: async () => {
        try { await signInGoogle(); toast("Signed in with Google", "success"); }
        catch (e) { toast("Google sign-in failed: " + (e.message || e.code), "error"); }
      }}, "🔑 Sign in with Google"),
    );
  } else {
    signInPanel.append(
      el("div", { class: "landing-signin-info" },
        el("strong", null, "Trainer? Sign in with Google."),
        el("div", { class: "landing-signin-hint" }, "Recommended if you'll be the trainer of a classroom — your trainer access stays with you across devices and browser refreshes. Students can still join as guest below."),
      ),
      el("button", { class: "btn", onclick: async () => {
        try { await signInGoogle(); toast("Signed in with Google", "success"); }
        catch (e) { toast("Google sign-in failed: " + (e.message || e.code), "error"); }
      }}, "🔑 Sign in with Google"),
    );
  }
  board.append(signInPanel);

  // Signed-in users get a Firestore-backed "All your classrooms (any device)" list,
  // populated asynchronously below.
  if (signedIn) {
    const myRoomsCard = el("div", { class: "landing-recent" },
      el("h2", null, "All your classrooms"),
      el("div", { class: "recent-list", id: "my-rooms-list" },
        el("div", { class: "recent-row" },
          el("div", { class: "recent-info" },
            el("div", { class: "recent-title" }, "Loading…"),
          ),
        ),
      ),
    );
    board.append(myRoomsCard);
    fetchMyRooms().then((rooms) => {
      const list = document.getElementById("my-rooms-list");
      if (!list) return;
      list.innerHTML = "";
      if (rooms.length === 0) {
        list.append(el("div", { class: "recent-row" },
          el("div", { class: "recent-info" },
            el("div", { class: "recent-title" }, "No classrooms yet"),
            el("div", { class: "recent-code" }, "Create one below or join with a code"),
          ),
        ));
        return;
      }
      for (const r of rooms) {
        const row = el("div", { class: "recent-row" },
          el("div", { class: "recent-info" },
            el("div", { class: "recent-title" }, r.title || "Untitled Classroom"),
            el("div", { class: "recent-code" }, r.code + (r.role === "trainer" ? " · trainer" : "")),
          ),
          el("button", { class: "btn", onclick: () => {
            state.roomId = r.code;
            setRoomInURL(r.code);
            renderUserArea();
            enterRoom();
          }}, "Open"),
        );
        list.append(row);
      }
    }).catch((e) => {
      const list = document.getElementById("my-rooms-list");
      if (list) {
        list.innerHTML = "";
        list.append(el("div", { class: "recent-row" },
          el("div", { class: "recent-info" },
            el("div", { class: "recent-title" }, "Could not load your classrooms"),
            el("div", { class: "recent-code" }, e.message || ""),
          ),
        ));
      }
    });
  }

  const recent = getRecentRooms();
  if (recent.length > 0 && !signedIn) {
    const recentList = el("div", { class: "recent-list" });
    for (const r of recent) {
      const row = el("div", { class: "recent-row" },
        el("div", { class: "recent-info" },
          el("div", { class: "recent-title" }, r.title || "Untitled Classroom"),
          el("div", { class: "recent-code" }, r.code),
        ),
        el("button", { class: "btn", onclick: () => {
          state.roomId = r.code;
          setRoomInURL(r.code);
          if (state.user) {
            renderUserArea();
            enterRoom();
          } else {
            showJoinPrompt(r.code);
          }
        }}, "Open"),
        el("button", { class: "btn-ghost recent-remove", title: "Remove from list", onclick: (e) => {
          e.stopPropagation();
          removeRecentRoom(r.code);
          renderLanding();
        }}, "×"),
      );
      recentList.append(row);
    }
    const recentCard = el("div", { class: "landing-recent" },
      el("h2", null, "Your recent classrooms"),
      recentList,
    );
    board.append(recentCard);
  }

  const createNick = el("input", { type: "text", placeholder: "Your name (e.g. Trainer Alex)" });
  if (signedIn) createNick.value = displayNameOf(state.user);
  const createBtn = el("button", { class: "btn", onclick: async () => {
    if (createBtn.disabled) return;
    createBtn.disabled = true;
    createBtn.textContent = "Creating…";
    try {
      const code = await createRoom(createNick.value);
      state.roomId = code;
      setRoomInURL(code);
      saveRecentRoom(code, "");
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
  if (signedIn) joinNick.value = displayNameOf(state.user);
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
      saveRecentRoom(code, "");
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
  board.className = "board board-sections";

  const trainer = isTrainer(state.user, state.room);
  const sortedPosts = filterAndSort(state.posts);

  // Group posts by sectionId. Posts without a section go into "Uncategorized".
  const validSectionIds = new Set(state.sections.map((s) => s.id));
  const grouped = new Map();
  for (const s of state.sections) grouped.set(s.id, []);
  const orphans = [];
  for (const p of sortedPosts) {
    if (p.sectionId && validSectionIds.has(p.sectionId)) {
      grouped.get(p.sectionId).push(p);
    } else {
      orphans.push(p);
    }
  }

  // Render configured sections in their order
  for (const section of state.sections) {
    board.append(buildSectionColumn(section, grouped.get(section.id) || [], trainer));
  }

  // Show "Uncategorized" only when there are unassigned posts OR no sections at all
  if (orphans.length > 0 || state.sections.length === 0) {
    board.append(buildSectionColumn(
      { id: null, title: state.sections.length === 0 ? "Posts" : "Uncategorized" },
      orphans,
      false,  // can't manage the orphans column
    ));
  }

  // Trainer "+ Add section" tile at the end
  if (trainer) {
    const addBtn = el("button", { class: "section-add-btn", onclick: openAddSectionModal },
      el("div", { class: "section-add-icon" }, "+"),
      el("div", null, "Add a section"),
    );
    board.append(addBtn);
  }
}

function buildSectionColumn(section, posts, trainer) {
  const col = el("section", { class: "section-column" });

  // Header with title + (trainer) actions
  const header = el("div", { class: "section-header" },
    el("h3", { class: "section-title" }, section.title || "Untitled"),
  );
  if (trainer && section.id) {
    header.append(el("div", { class: "section-actions" },
      el("button", { class: "btn-ghost", title: "Rename", onclick: (e) => { e.stopPropagation(); openRenameSectionModal(section); } }, "✏️"),
      el("button", { class: "btn-ghost", title: "Delete", onclick: (e) => { e.stopPropagation(); confirmDeleteSection(section); } }, "🗑"),
    ));
    // Section reordering — trainer drags a section by its header onto another
    header.draggable = true;
    header.style.cursor = "grab";
    header.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("application/x-section-id", section.id);
      e.dataTransfer.effectAllowed = "move";
      header.classList.add("dragging");
    });
    header.addEventListener("dragend", () => header.classList.remove("dragging"));
  }
  col.append(header);

  // Trainer drop target on the column itself: dropping a section onto this column reorders
  if (trainer && section.id) {
    col.addEventListener("dragover", (e) => {
      if (Array.from(e.dataTransfer.types).includes("application/x-section-id")) {
        e.preventDefault();
        col.classList.add("section-drop-target");
      }
    });
    col.addEventListener("dragleave", () => col.classList.remove("section-drop-target"));
    col.addEventListener("drop", async (e) => {
      if (!Array.from(e.dataTransfer.types).includes("application/x-section-id")) return;
      e.preventDefault();
      col.classList.remove("section-drop-target");
      const draggedId = e.dataTransfer.getData("application/x-section-id");
      if (!draggedId || draggedId === section.id) return;
      const dragged = state.sections.find((s) => s.id === draggedId);
      if (!dragged) return;
      // Swap orders so the dragged section takes this section's position
      try {
        await Promise.all([
          updateSection(draggedId, { order: section.order || 0 }),
          updateSection(section.id, { order: dragged.order || 0 }),
        ]);
      } catch (err) {
        toast("Reorder failed: " + (err.message || err.code), "error");
      }
    });
  }

  // "Add post here" button — opens composer with this section pre-selected
  if (state.user) {
    col.append(el("button", { class: "section-add-post", onclick: () => openComposer(section.id) },
      "+ Add post"));
  }

  // Posts in this section — drop target for moving posts between sections
  const postsWrap = el("div", { class: "section-posts" });
  postsWrap.addEventListener("dragover", (e) => {
    if (Array.from(e.dataTransfer.types).includes("application/x-post-id")) {
      e.preventDefault();
      postsWrap.classList.add("post-drop-target");
    }
  });
  postsWrap.addEventListener("dragleave", () => postsWrap.classList.remove("post-drop-target"));
  postsWrap.addEventListener("drop", async (e) => {
    if (!Array.from(e.dataTransfer.types).includes("application/x-post-id")) return;
    e.preventDefault();
    postsWrap.classList.remove("post-drop-target");
    const postId = e.dataTransfer.getData("application/x-post-id");
    if (!postId) return;
    const movedPost = state.posts.find((p) => p.id === postId);
    if (!movedPost) return;
    if (movedPost.sectionId === section.id) return; // already here
    try {
      await updatePost(postId, { sectionId: section.id || null });
      toast("Moved", "success");
    } catch (err) {
      toast("Move failed — only the post's author can move it", "error");
    }
  });
  if (posts.length === 0) {
    postsWrap.append(el("div", { class: "section-empty" }, "No posts yet"));
  } else {
    for (const p of posts) postsWrap.append(postCard(p));
  }
  col.append(postsWrap);

  return col;
}

function openAddSectionModal() {
  if (!isTrainer(state.user, state.room)) return;
  const input = el("input", { type: "text", placeholder: "Section name (e.g. Singapore)" });
  const node = el("div", null,
    el("h2", null, "Add a section"),
    el("label", null, "Section name"), input,
    el("div", { class: "modal-actions" },
      el("button", { class: "btn btn-secondary", onclick: closeModal }, "Cancel"),
      el("button", { class: "btn", onclick: async () => {
        const name = input.value.trim();
        if (!name) { toast("Section needs a name", "error"); return; }
        try { await createSection(state.roomId, name); toast("Section added", "success"); closeModal(); }
        catch (e) { toast("Failed: " + (e.message || e.code), "error"); }
      }}, "Add"),
    ),
  );
  showModal(node);
  setTimeout(() => input.focus(), 50);
}

function openRenameSectionModal(section) {
  if (!isTrainer(state.user, state.room)) return;
  const input = el("input", { type: "text" });
  input.value = section.title || "";
  const node = el("div", null,
    el("h2", null, "Rename section"),
    el("label", null, "Section name"), input,
    el("div", { class: "modal-actions" },
      el("button", { class: "btn btn-secondary", onclick: closeModal }, "Cancel"),
      el("button", { class: "btn", onclick: async () => {
        const name = input.value.trim();
        if (!name) { toast("Section needs a name", "error"); return; }
        try { await updateSection(section.id, { title: name }); toast("Renamed", "success"); closeModal(); }
        catch (e) { toast("Failed: " + (e.message || e.code), "error"); }
      }}, "Save"),
    ),
  );
  showModal(node);
  setTimeout(() => { input.focus(); input.select(); }, 50);
}

function confirmDeleteSection(section) {
  if (!isTrainer(state.user, state.room)) return;
  const postsInSection = state.posts.filter((p) => p.sectionId === section.id).length;
  const msg = postsInSection > 0
    ? `Delete section "${section.title}"? The ${postsInSection} post(s) inside will move to "Uncategorized" (they won't be deleted).`
    : `Delete section "${section.title}"?`;
  if (!confirm(msg)) return;
  deleteSection(section.id)
    .then(() => toast("Section deleted", "success"))
    .catch((e) => toast("Failed: " + (e.message || e.code), "error"));
}

function postCard(p) {
  const liked = !!state.user && (p.likes || []).includes(state.user.uid);
  const isOwn = state.user && state.user.uid === p.authorId;
  const card = el("div", { class: "post" + (p.pinned ? " pinned" : "") + (isOwn ? " draggable" : ""), onclick: () => openDetail(p) });
  if (isOwn) {
    card.draggable = true;
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("application/x-post-id", p.id);
      e.dataTransfer.effectAllowed = "move";
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
  }
  if (p.pinned) card.append(el("div", { class: "pin-icon" }, "📌 Pinned"));
  // Resolve uploaded images: prefer the new array, fall back to legacy single fields
  const images = (Array.isArray(p.imageDataUrls) && p.imageDataUrls.length > 0)
    ? p.imageDataUrls
    : (p.imageDataUrl && typeof p.imageDataUrl === "string" && p.imageDataUrl.startsWith("data:") ? [p.imageDataUrl]
       : (p.linkUrl && typeof p.linkUrl === "string" && p.linkUrl.startsWith("data:") ? [p.linkUrl] : []));
  for (const url of images) {
    const img = document.createElement("img");
    img.src = url;
    img.className = "post-image";
    img.loading = "lazy";
    img.onclick = (e) => e.stopPropagation();
    card.append(img);
  }
  // Typed link / YouTube / preview (separate from the upload)
  if (p.linkUrl && !p.linkUrl.startsWith("data:")) {
    const media = renderMediaOrLink(p.linkUrl, false, p.linkPreview);
    if (media) card.append(media);
  }
  if (p.title) card.append(el("h3", { class: "post-title" }, p.title));
  if (p.description) card.append(el("p", { class: "post-body" }, truncate(p.description, 500)));
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

function youtubeVideoId(u) {
  try {
    const url = new URL(u);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const v = url.searchParams.get("v");
      if (v) return v;
      const m = url.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
      if (m) return m[2];
    }
    return null;
  } catch { return null; }
}

function youtubeEmbedUrl(u) {
  const id = youtubeVideoId(u);
  return id ? "https://www.youtube.com/embed/" + id : null;
}

function youtubeThumbUrl(id) {
  return "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg";
}

function isImageUrl(u) {
  if (typeof u === "string" && u.startsWith("data:image/")) return true;
  try {
    const path = new URL(u).pathname.toLowerCase();
    return /\.(jpg|jpeg|png|gif|webp|svg|avif)$/.test(path);
  } catch { return false; }
}

async function compressImage(file, maxSize = 800, quality = 0.72) {
  const dataUrl = await fileToDataUrl(file);
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
  const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

// PDF.js — lazy-loaded the first time a PDF is picked.
let _pdfjsPromise = null;
function loadPdfJs() {
  if (_pdfjsPromise) return _pdfjsPromise;
  _pdfjsPromise = import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.min.mjs").then((mod) => {
    mod.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.worker.min.mjs";
    return mod;
  });
  return _pdfjsPromise;
}

async function renderPdfPageImage(pdf, pageNum, maxWidth, quality) {
  const page = await pdf.getPage(pageNum);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(maxWidth / baseViewport.width, 2);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return canvas.toDataURL("image/jpeg", quality);
}

async function pdfFirstPageImage(file, maxWidth = 800) {
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  return renderPdfPageImage(pdf, 1, maxWidth, 0.78);
}

// Render every page of the PDF as an image. Each page is stored as its own
// Firestore doc, so we don't have a per-doc size budget — only a hard page cap.
async function pdfAllPagesImages(file, opts = {}) {
  const maxPages = opts.maxPages ?? 80;
  const maxWidth = opts.maxWidth ?? 800;
  const quality = opts.quality ?? 0.7;
  const onProgress = opts.onProgress;
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const target = Math.min(totalPages, maxPages);
  const pages = [];
  for (let i = 1; i <= target; i++) {
    pages.push(await renderPdfPageImage(pdf, i, maxWidth, quality));
    if (onProgress) onProgress(i, target);
  }
  return { pages, totalPages, rendered: pages.length };
}

// Link previews via corsproxy.io (free, no key). Parses OpenGraph tags from
// the fetched HTML. Cached in localStorage so repeated views don't re-fetch.
const PREVIEW_CACHE_KEY = "padlet-link-previews";
function getPreviewCache() {
  try { return JSON.parse(localStorage.getItem(PREVIEW_CACHE_KEY)) || {}; }
  catch { return {}; }
}
function setPreviewCache(cache) {
  try { localStorage.setItem(PREVIEW_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

async function fetchLinkPreview(url) {
  const cache = getPreviewCache();
  if (cache[url]) return cache[url];
  const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(url);
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error("preview fetch failed");
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const meta = (sel) => doc.querySelector(sel)?.getAttribute("content") || "";
  const preview = {
    title:
      meta("meta[property='og:title']") ||
      meta("meta[name='twitter:title']") ||
      doc.querySelector("title")?.textContent?.trim() ||
      "",
    description:
      meta("meta[property='og:description']") ||
      meta("meta[name='twitter:description']") ||
      meta("meta[name='description']") ||
      "",
    image:
      meta("meta[property='og:image']") ||
      meta("meta[name='twitter:image']") ||
      "",
  };
  if (preview.image && !/^https?:/i.test(preview.image)) {
    try { preview.image = new URL(preview.image, url).href; } catch {}
  }
  cache[url] = preview;
  setPreviewCache(cache);
  return preview;
}

function renderMediaOrLink(url, isDetail, preview) {
  if (!url) return null;
  const ytId = youtubeVideoId(url);
  if (ytId) {
    if (isDetail) {
      // Embedded player in detail view
      const wrap = el("div", { class: "media-embed", onclick: (e) => e.stopPropagation() });
      const iframe = document.createElement("iframe");
      iframe.src = "https://www.youtube.com/embed/" + ytId;
      iframe.title = "YouTube video";
      iframe.loading = "lazy";
      iframe.allowFullscreen = true;
      iframe.setAttribute("allow", "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
      wrap.append(iframe);
      return wrap;
    }
    // Thumbnail with play overlay on the card (lighter, loads instantly)
    const thumb = el("div", { class: "yt-thumb" });
    const img = document.createElement("img");
    img.src = youtubeThumbUrl(ytId);
    img.alt = "YouTube video";
    img.loading = "lazy";
    img.onerror = () => { img.src = "https://i.ytimg.com/vi/" + ytId + "/0.jpg"; };
    thumb.append(img);
    thumb.append(el("div", { class: "yt-play" }, "▶"));
    return thumb;
  }
  if (isImageUrl(url)) {
    const img = document.createElement("img");
    img.src = url;
    img.className = isDetail ? "detail-image" : "post-image";
    img.loading = "lazy";
    img.onclick = (e) => e.stopPropagation();
    return img;
  }
  if (preview && (preview.image || preview.title)) {
    return buildLinkPreviewCard(url, preview);
  }
  return el("a", {
    class: "post-link",
    href: url,
    target: "_blank",
    rel: "noopener",
    onclick: (e) => e.stopPropagation(),
  }, "🔗 " + shortUrl(url));
}

function openDetail(p) {
  state.detailOpenFor = p.id;
  showModal(buildDetailNode(p), { wide: true });
  if (state.unsubDetailComments) state.unsubDetailComments();
  state.unsubDetailComments = subscribeComments(p.id, (comments) => renderCommentThread(p, comments));
  if (state.unsubDetailPdfPages) { state.unsubDetailPdfPages(); state.unsubDetailPdfPages = null; }
  if (p.pdfPageCount && p.pdfPageCount > 0) {
    state.unsubDetailPdfPages = subscribePdfPages(p.id, (pages) => renderPdfStack(pages));
  }
  const observer = new MutationObserver(() => {
    if (!document.getElementById("modal-root").firstChild) {
      if (state.unsubDetailComments) { state.unsubDetailComments(); state.unsubDetailComments = null; }
      if (state.unsubDetailPdfPages) { state.unsubDetailPdfPages(); state.unsubDetailPdfPages = null; }
      state.detailOpenFor = null;
      observer.disconnect();
    }
  });
  observer.observe(document.getElementById("modal-root"), { childList: true });
}

function renderPdfStack(pages) {
  const stack = document.getElementById("pdf-stack");
  if (!stack) return;
  stack.innerHTML = "";
  if (pages.length === 0) {
    stack.append(el("div", { class: "pdf-note" }, "Loading pages…"));
    return;
  }
  for (const page of pages) {
    const img = document.createElement("img");
    img.src = page.imageDataUrl;
    img.className = "pdf-page";
    img.alt = "Page " + page.pageNum;
    img.loading = "lazy";
    stack.append(img);
    stack.append(el("div", { class: "pdf-page-label" }, "Page " + page.pageNum));
  }
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
  if (p.pdfPageCount && p.pdfPageCount > 0) {
    node.append(el("div", { class: "pdf-pages", id: "pdf-stack" },
      el("div", { class: "pdf-note" }, `Loading ${p.pdfPageCount} pages…`),
    ));
  } else if (p.pdfPages && p.pdfPages.length > 0) {
    // Backwards compat for posts created before pdf pages moved to subdocs.
    const pdfWrap = el("div", { class: "pdf-pages" });
    p.pdfPages.forEach((pageUrl, i) => {
      const img = document.createElement("img");
      img.src = pageUrl;
      img.className = "pdf-page";
      img.alt = "Page " + (i + 1);
      img.loading = i === 0 ? "eager" : "lazy";
      pdfWrap.append(img);
      pdfWrap.append(el("div", { class: "pdf-page-label" }, "Page " + (i + 1)));
    });
    node.append(pdfWrap);
  } else {
    // Uploaded image(s) — supports multiple via imageDataUrls array; falls back to legacy fields
    const images = (Array.isArray(p.imageDataUrls) && p.imageDataUrls.length > 0)
      ? p.imageDataUrls
      : (p.imageDataUrl && typeof p.imageDataUrl === "string" && p.imageDataUrl.startsWith("data:") ? [p.imageDataUrl]
         : (p.linkUrl && typeof p.linkUrl === "string" && p.linkUrl.startsWith("data:") ? [p.linkUrl] : []));
    for (const url of images) {
      const img = document.createElement("img");
      img.src = url;
      img.className = "detail-image";
      node.append(img);
    }
    if (p.linkUrl && !p.linkUrl.startsWith("data:")) {
      const media = renderMediaOrLink(p.linkUrl, true, p.linkPreview);
      if (media) node.append(media);
    }
  }
  if (p.description) node.append(el("p", { class: "detail-body" }, p.description));

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

function buildMediaEditor(initial = {}) {
  const state = {
    images: Array.isArray(initial.images) ? [...initial.images] : [],
    pdfPages: null,
    linkPreview: initial.linkPreview || null,
  };

  const imageInput = el("input", { type: "file", accept: "image/*", multiple: true });
  const imageList = el("div", { class: "image-list" });
  const pdfInput = el("input", { type: "file", accept: "application/pdf" });
  const pdfStatus = el("div", { class: "pdf-status" });
  const linkInput = el("input", { type: "url", placeholder: "Paste a link or YouTube URL (optional)" });
  if (initial.linkUrl) linkInput.value = initial.linkUrl;
  const linkPreviewWrap = el("div", { class: "link-preview-wrap" });
  if (initial.linkPreview && initial.linkUrl) {
    linkPreviewWrap.append(buildLinkPreviewCard(initial.linkUrl, initial.linkPreview));
  }

  function renderImages() {
    imageList.innerHTML = "";
    state.images.forEach((url, i) => {
      const item = el("div", { class: "image-item" });
      const img = document.createElement("img");
      img.src = url;
      const remove = el("button", { type: "button", class: "image-item-remove", title: "Remove", onclick: () => {
        state.images.splice(i, 1);
        renderImages();
      }}, "×");
      item.append(img, remove);
      imageList.append(item);
    });
  }
  renderImages();

  imageInput.addEventListener("change", async () => {
    const files = Array.from(imageInput.files || []);
    for (const f of files) {
      if (f.size > 5 * 1024 * 1024) { toast(f.name + " too large (max 5MB)", "error"); continue; }
      try {
        const dataUrl = await compressImage(f);
        state.images.push(dataUrl);
        renderImages();
      } catch { toast("Could not load " + f.name, "error"); }
    }
    imageInput.value = "";
  });

  pdfInput.addEventListener("change", async () => {
    const f = pdfInput.files?.[0];
    state.pdfPages = null;
    pdfStatus.innerHTML = "";
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast("PDF too large (max 10MB)", "error"); pdfInput.value = ""; return; }
    pdfStatus.textContent = "Rendering PDF…";
    try {
      const result = await pdfAllPagesImages(f, {
        onProgress: (i, total) => { pdfStatus.textContent = `Rendering page ${i} of ${total}…`; },
      });
      if (result.pages.length === 0) throw new Error("no pages");
      state.pdfPages = result.pages;
      pdfStatus.innerHTML = "";
      const thumb = document.createElement("img");
      thumb.src = result.pages[0];
      thumb.className = "pdf-thumb";
      pdfStatus.append(thumb);
      const note = result.rendered < result.totalPages
        ? `Showing ${result.rendered} of ${result.totalPages} pages — capped at ${result.rendered}.`
        : `${result.totalPages} pages ready to upload.`;
      pdfStatus.append(el("div", { class: "pdf-note" }, note,
        " ",
        el("button", { type: "button", class: "btn-ghost", onclick: () => {
          state.pdfPages = null;
          pdfInput.value = "";
          pdfStatus.innerHTML = "";
        }}, "Remove"),
      ));
    } catch (e) {
      console.error(e);
      toast("Could not render PDF", "error");
      pdfStatus.innerHTML = "";
      pdfInput.value = "";
    }
  });

  linkInput.addEventListener("blur", async () => {
    const url = linkInput.value.trim();
    state.linkPreview = null;
    linkPreviewWrap.innerHTML = "";
    if (!url || isImageUrl(url) || youtubeEmbedUrl(url)) return;
    linkPreviewWrap.textContent = "Fetching preview…";
    try {
      const p = await fetchLinkPreview(url);
      if (!p.title && !p.image) { linkPreviewWrap.innerHTML = ""; return; }
      state.linkPreview = p;
      linkPreviewWrap.innerHTML = "";
      linkPreviewWrap.append(buildLinkPreviewCard(url, p));
    } catch {
      linkPreviewWrap.innerHTML = "";
    }
  });

  const fields = [
    el("label", null, "Add image(s) — pick multiple at once or repeat"),
    imageInput,
    imageList,
    el("label", null, "Add a PDF (optional, replaces existing)"),
    pdfInput,
    pdfStatus,
    el("label", null, "Link / YouTube URL (optional)"),
    linkInput,
    linkPreviewWrap,
  ];

  return {
    fields,
    getValues: () => ({
      imageDataUrls: state.images,
      pdfPages: state.pdfPages,
      linkUrl: linkInput.value.trim(),
      linkPreview: state.linkPreview,
    }),
  };
}

function openComposer(defaultSectionId) {
  if (!state.user) return;
  const titleInput = el("input", { type: "text", placeholder: "Title" });
  const descInput = el("textarea", { placeholder: "What's your idea, reflection, or answer?" });
  const editor = buildMediaEditor();

  // Section dropdown — only shown when sections exist
  let sectionSelect = null;
  if (state.sections.length > 0) {
    sectionSelect = el("select", null,
      el("option", { value: "" }, "Uncategorized"),
      ...state.sections.map((s) => el("option", { value: s.id }, s.title || "Untitled")),
    );
    if (defaultSectionId) sectionSelect.value = defaultSectionId;
  }

  let submitting = false;
  const submitBtn = el("button", { class: "btn", onclick: async () => {
    if (submitting) return;
    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    const v = editor.getValues();
    if (!title && !description && v.imageDataUrls.length === 0 && !v.linkUrl && !v.pdfPages) {
      toast("Add a title, description, image, or link", "error"); return;
    }
    submitting = true;
    submitBtn.textContent = "Posting…";
    try {
      await createPost(state.roomId, {
        title, description,
        sectionId: sectionSelect ? sectionSelect.value : null,
        imageDataUrls: v.imageDataUrls,
        linkUrl: v.linkUrl,
        linkPreview: v.linkPreview,
        pdfPages: v.pdfPages,
        authorName: displayNameOf(state.user),
        onPdfProgress: (done, total) => {
          submitBtn.textContent = `Uploading ${done}/${total}…`;
        },
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
    sectionSelect ? el("label", null, "Section") : null,
    sectionSelect,
    ...editor.fields,
    el("div", { class: "modal-actions" },
      el("button", { class: "btn btn-secondary", onclick: closeModal }, "Cancel"),
      submitBtn,
    ),
  );
  showModal(node);
  setTimeout(() => titleInput.focus(), 50);
}

function buildLinkPreviewCard(url, preview) {
  const card = el("a", {
    class: "link-preview",
    href: url,
    target: "_blank",
    rel: "noopener",
    onclick: (e) => e.stopPropagation(),
  });
  if (preview.image) {
    const img = document.createElement("img");
    img.src = preview.image;
    img.className = "link-preview-image";
    img.loading = "lazy";
    img.onerror = () => img.remove();
    card.append(img);
  }
  const body = el("div", { class: "link-preview-body" });
  if (preview.title) body.append(el("div", { class: "link-preview-title" }, preview.title));
  if (preview.description) body.append(el("div", { class: "link-preview-desc" }, truncate(preview.description, 160)));
  body.append(el("div", { class: "link-preview-host" }, shortUrl(url)));
  card.append(body);
  return card;
}

function openEdit(p) {
  const titleInput = el("input", { type: "text" });
  titleInput.value = p.title || "";
  const descInput = el("textarea");
  descInput.value = p.description || "";

  // Existing images: prefer the new array; fall back to the legacy single field
  const existingImages = Array.isArray(p.imageDataUrls) && p.imageDataUrls.length > 0
    ? p.imageDataUrls
    : (p.imageDataUrl && (typeof p.imageDataUrl === "string" && p.imageDataUrl.startsWith("data:"))
        ? [p.imageDataUrl]
        : (p.linkUrl && typeof p.linkUrl === "string" && p.linkUrl.startsWith("data:") ? [p.linkUrl] : []));

  const editor = buildMediaEditor({
    images: existingImages,
    linkUrl: p.linkUrl && !p.linkUrl.startsWith("data:") ? p.linkUrl : "",
    linkPreview: p.linkPreview,
  });

  let saving = false;
  const saveBtn = el("button", { class: "btn", onclick: async () => {
    if (saving) return;
    saving = true;
    saveBtn.textContent = "Saving…";
    try {
      const v = editor.getValues();
      const patch = {
        title: titleInput.value.trim(),
        description: descInput.value.trim(),
        imageDataUrls: v.imageDataUrls,
        imageDataUrl: v.imageDataUrls[0] || "",
        linkUrl: v.linkUrl,
        linkPreview: v.linkPreview || null,
      };
      // If a new PDF was picked, replacing PDFs is complex (would need to delete old pages
      // and write new ones). For now, surface a friendly note.
      if (v.pdfPages && v.pdfPages.length > 0) {
        toast("PDF replacement not supported in edit yet — delete the post and recreate to change the PDF.", "error");
        saveBtn.textContent = "Save";
        saving = false;
        return;
      }
      await updatePost(p.id, patch);
      toast("Saved", "success");
      closeModal();
    } catch (e) {
      toast("Failed: " + (e.message || e.code), "error");
      saveBtn.textContent = "Save";
      saving = false;
    }
  }}, "Save");

  const node = el("div", null,
    el("h2", null, "Edit post"),
    el("label", null, "Title"), titleInput,
    el("label", null, "Description"), descInput,
    ...editor.fields,
    p.pdfPageCount ? el("p", { class: "pdf-note" }, `This post has a ${p.pdfPageCount}-page PDF attached. To change it, delete the post and create a new one.`) : null,
    el("div", { class: "modal-actions" },
      el("button", { class: "btn btn-secondary", onclick: closeModal }, "Cancel"),
      saveBtn,
    ),
  );
  showModal(node);
}
