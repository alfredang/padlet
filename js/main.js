import { onAuthChange, signInAnon, signInGoogle, signOutUser, displayNameOf } from "./auth.js";
import { subscribePosts, subscribePdfPages, createPost, updatePost, deletePost, toggleLike, setPinned } from "./posts.js";
import { subscribeComments, addComment, deleteComment } from "./comments.js";
import {
  createRoom, joinRoom, subscribeRoom, updateRoomTitle, setAnnouncement, isTrainer,
  recordMembership, fetchMyRooms, deleteRoom,
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
  document.getElementById("refresh-posts").addEventListener("click", () => {
    if (state._reattachSubscriptions) {
      state._reattachSubscriptions();
      toast("Reconnected — posts refreshed", "success");
    }
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
  state.postsRetryDelay = 1000;
  state.sectionsRetryDelay = 1000;

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

  function attachPosts() {
    if (state.unsubPosts) { state.unsubPosts(); state.unsubPosts = null; }
    state.unsubPosts = subscribePosts(state.roomId, (items, err) => {
      if (err) {
        console.error("subscribePosts error — retrying", err);
        toast("Posts disconnected — reconnecting…", "info");
        const delay = Math.min(state.postsRetryDelay, 30000);
        state.postsRetryDelay = Math.min(delay * 2, 30000);
        setTimeout(() => { if (state.roomId) attachPosts(); }, delay);
        return;
      }
      state.postsRetryDelay = 1000;
      state.posts = items;
      console.log("[posts]", items.length, "loaded for room", state.roomId);
      renderBoard();
      if (state.detailOpenFor) {
        const fresh = state.posts.find((p) => p.id === state.detailOpenFor);
        if (fresh) refreshDetailModal(fresh);
      }
    });
  }

  function attachSections() {
    if (state.unsubSections) { state.unsubSections(); state.unsubSections = null; }
    state.unsubSections = subscribeSections(state.roomId, (sections, err) => {
      if (err) {
        console.error("subscribeSections error — retrying", err);
        const delay = Math.min(state.sectionsRetryDelay, 30000);
        state.sectionsRetryDelay = Math.min(delay * 2, 30000);
        setTimeout(() => { if (state.roomId) attachSections(); }, delay);
        return;
      }
      state.sectionsRetryDelay = 1000;
      state.sections = sections;
      renderBoard();
    });
  }

  state._reattachSubscriptions = () => { attachPosts(); attachSections(); };
  attachPosts();
  attachSections();
}

function showInRoomShell() {
  document.getElementById("toolbar").hidden = false;
  document.getElementById("fab").hidden = false;
  const refreshBtn = document.getElementById("refresh-posts");
  if (refreshBtn) refreshBtn.hidden = false;
  document.getElementById("announcement").classList.remove("hidden");
  document.getElementById("board-title-edit").hidden = false;
  const board = document.getElementById("board");
  board.classList.remove("board-landing");
  board.innerHTML = "";
}

function showLanding() {
  document.getElementById("toolbar").hidden = true;
  document.getElementById("fab").hidden = true;
  document.getElementById("export-csv").hidden = true;
  const refreshBtn = document.getElementById("refresh-posts");
  if (refreshBtn) refreshBtn.hidden = true;
  document.getElementById("announcement").classList.add("hidden");
  document.getElementById("board-title-edit").hidden = true;
  document.getElementById("board-title").textContent = "Padlet Classrooms";
  document.getElementById("board").classList.add("board-landing");
  renderLanding();
}

function showJoinPrompt(code) {
  document.getElementById("toolbar").hidden = true;
  document.getElementById("fab").hidden = true;
  document.getElementById("export-csv").hidden = true;
  document.getElementById("announcement").classList.add("hidden");
  document.getElementById("board-title-edit").hidden = true;
  document.getElementById("board-title").textContent = "Join classroom " + code;
  document.getElementById("board").classList.add("board-landing");
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
        const actions = [
          el("button", { class: "btn", onclick: () => {
            state.roomId = r.code;
            setRoomInURL(r.code);
            renderUserArea();
            enterRoom();
          }}, "Open"),
        ];
        if (r.role === "trainer") {
          actions.push(el("button", {
            class: "btn-ghost recent-delete",
            title: "Delete classroom",
            onclick: async (e) => {
              e.stopPropagation();
              if (!confirm(`Delete classroom "${r.title || "Untitled Classroom"}" (${r.code})?\n\nThis will remove the classroom, its sections, and your own posts. Posts created by other people may remain.`)) return;
              try {
                await deleteRoom(r.code);
                removeRecentRoom(r.code);
                toast("Classroom deleted", "success");
                renderLanding();
              } catch (err) {
                toast("Delete failed: " + (err.message || err.code), "error");
              }
            },
          }, "🗑"));
        }
        const row = el("div", { class: "recent-row" },
          el("div", { class: "recent-info" },
            el("div", { class: "recent-title" }, r.title || "Untitled Classroom"),
            el("div", { class: "recent-code" }, r.code + (r.role === "trainer" ? " · trainer" : "")),
          ),
          ...actions,
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

  // Build section indices: top-level sections, sub-sections grouped by parent
  const validSectionIds = new Set(state.sections.map((s) => s.id));
  const topSections = state.sections.filter((s) => !s.parentSectionId);
  const subsByParent = new Map();
  for (const s of state.sections) {
    if (s.parentSectionId && validSectionIds.has(s.parentSectionId)) {
      if (!subsByParent.has(s.parentSectionId)) subsByParent.set(s.parentSectionId, []);
      subsByParent.get(s.parentSectionId).push(s);
    }
  }

  // Group posts by sectionId
  const postsBySection = new Map();
  for (const s of state.sections) postsBySection.set(s.id, []);
  const orphans = [];
  for (const p of sortedPosts) {
    if (p.sectionId && validSectionIds.has(p.sectionId)) {
      postsBySection.get(p.sectionId).push(p);
    } else {
      orphans.push(p);
    }
  }

  // Render top-level columns (which contain their sub-sections + own posts)
  for (const top of topSections) {
    board.append(buildSectionColumn(top, postsBySection, subsByParent, trainer));
  }

  // Show "Uncategorized" only when there are unassigned posts OR no sections at all
  if (orphans.length > 0 || topSections.length === 0) {
    board.append(buildOrphanColumn(orphans, topSections.length === 0));
  }

  // "+ Add section" tile — any signed-in user can add a section
  if (state.user) {
    const addBtn = el("button", { class: "section-add-btn", onclick: () => openAddSectionModal(null) },
      el("div", { class: "section-add-icon" }, "+"),
      el("div", null, "Add a section"),
    );
    board.append(addBtn);
  }
}

function buildOrphanColumn(orphans, isOnlyColumn) {
  const col = el("section", { class: "section-column" });
  const header = el("div", { class: "section-header" },
    el("h3", { class: "section-title" }, isOnlyColumn ? "Posts" : "Uncategorized"),
  );
  if (state.user && !isOnlyColumn) {
    header.append(el("div", { class: "section-actions" },
      el("button", { class: "btn-ghost", title: "Add post", onclick: (e) => { e.stopPropagation(); openComposer(null); } }, "➕"),
      el("button", { class: "btn-ghost", title: "Rename — converts Uncategorized into a real section", onclick: (e) => { e.stopPropagation(); openRenameUncategorizedModal(orphans); } }, "✏️"),
      el("button", { class: "btn-ghost", title: "Remove column (moves posts to first section)", onclick: async (e) => {
        e.stopPropagation();
        const firstSection = (state.sections || []).find((s) => !s.parentSectionId);
        if (!firstSection) {
          toast("No other section to move posts into.", "error");
          return;
        }
        const n = orphans.length;
        if (n > 0 && !confirm(`Move ${n} post${n === 1 ? "" : "s"} into "${firstSection.title || "Untitled"}" and remove the Uncategorized column?`)) return;
        try {
          await Promise.all(orphans.map((p) => updatePost(p.id, { sectionId: firstSection.id })));
          toast(n > 0 ? `Moved ${n} post${n === 1 ? "" : "s"} to "${firstSection.title || "Untitled"}"` : "Column removed", "success");
        } catch (err) {
          toast("Move failed — only the author can move their own posts.", "error");
        }
      }}, "🗑"),
    ));
  } else if (state.user && isOnlyColumn) {
    header.append(el("div", { class: "section-actions" },
      el("button", { class: "btn-ghost", title: "Add post", onclick: (e) => { e.stopPropagation(); openComposer(null); } }, "➕"),
    ));
  }
  col.append(header);
  if (state.user) {
    col.append(el("button", { class: "section-add-post", onclick: () => openComposer(null) },
      "+ Add post"));
  }
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
    try { await updatePost(postId, { sectionId: null }); toast("Moved", "success"); }
    catch (err) { toast("Move failed — only the author can move posts", "error"); }
  });
  if (orphans.length === 0) {
    postsWrap.append(el("div", { class: "section-empty" }, "No posts yet"));
  } else {
    for (const p of orphans) postsWrap.append(postCard(p));
  }
  col.append(postsWrap);
  return col;
}

function buildSectionColumn(section, postsBySection, subsByParent, trainer) {
  const col = el("section", { class: "section-column" });

  // Header with title + (trainer / author) actions + section reorder drag
  const header = el("div", { class: "section-header" },
    el("h3", { class: "section-title" }, section.title || "Untitled"),
  );
  const ownsSection = state.user && section.authorId === state.user.uid;
  const canManageSection = trainer || ownsSection;
  if (state.user && section.id) {
    const actions = el("div", { class: "section-actions" });
    // Anyone signed in can add a sub-section
    actions.append(el("button", { class: "btn-ghost", title: "Add sub-section", onclick: (e) => { e.stopPropagation(); openAddSectionModal(section.id); } }, "➕"));
    if (canManageSection) {
      actions.append(el("button", { class: "btn-ghost", title: "Rename", onclick: (e) => { e.stopPropagation(); openRenameSectionModal(section); } }, "✏️"));
      actions.append(el("button", { class: "btn-ghost", title: "Delete", onclick: (e) => { e.stopPropagation(); confirmDeleteSection(section); } }, "🗑"));
    }
    header.append(actions);
  }
  if (trainer && section.id) {
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

  // "Add post here" button for this top-level section
  if (state.user) {
    col.append(el("button", { class: "section-add-post", onclick: () => openComposer(section.id) },
      "+ Add post"));
  }

  // Posts directly under this section (not in a sub-section)
  col.append(buildPostsDropZone(postsBySection.get(section.id) || [], section.id));

  // Sub-sections inside this column
  const subs = subsByParent.get(section.id) || [];
  for (const sub of subs) {
    col.append(buildSubSection(sub, postsBySection.get(sub.id) || [], trainer));
  }

  return col;
}

function buildSubSection(sub, posts, trainer) {
  const wrap = el("div", { class: "sub-section" });
  const header = el("div", { class: "sub-section-header" },
    el("span", { class: "sub-section-title" }, "↳ " + (sub.title || "Untitled")),
  );
  const ownsSub = state.user && sub.authorId === state.user.uid;
  if (trainer || ownsSub) {
    header.append(el("div", { class: "sub-section-actions" },
      el("button", { class: "btn-ghost", title: "Rename", onclick: (e) => { e.stopPropagation(); openRenameSectionModal(sub); } }, "✏️"),
      el("button", { class: "btn-ghost", title: "Delete", onclick: (e) => { e.stopPropagation(); confirmDeleteSection(sub); } }, "🗑"),
    ));
  }
  wrap.append(header);
  if (state.user) {
    wrap.append(el("button", { class: "section-add-post sub-add-post", onclick: () => openComposer(sub.id) },
      "+ Add post"));
  }
  wrap.append(buildPostsDropZone(posts, sub.id));
  return wrap;
}

function buildPostsDropZone(posts, sectionId) {
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
    if (movedPost.sectionId === sectionId) return;
    try {
      await updatePost(postId, { sectionId: sectionId || null });
      toast("Moved", "success");
    } catch (err) {
      toast("Move failed — only the post's author can move it", "error");
    }
  });
  if (posts.length === 0) {
    postsWrap.append(el("div", { class: "section-empty" }, "Drop posts here"));
  } else {
    for (const p of posts) postsWrap.append(postCard(p));
  }
  return postsWrap;
}

function openAddSectionModal(parentSectionId) {
  if (!state.user) { toast("Sign in to add a section.", "error"); return; }
  const isSub = !!parentSectionId;
  const parent = isSub ? state.sections.find((s) => s.id === parentSectionId) : null;
  const input = el("input", { type: "text", placeholder: isSub ? "Sub-section name" : "Section name" });
  const node = el("div", null,
    el("h2", null, isSub ? `Add sub-section under "${parent ? parent.title : "section"}"` : "Add a section"),
    el("label", null, isSub ? "Sub-section name" : "Section name"), input,
    el("div", { class: "modal-actions" },
      el("button", { class: "btn btn-secondary", onclick: closeModal }, "Cancel"),
      el("button", { class: "btn", onclick: async () => {
        const name = input.value.trim();
        if (!name) { toast("Section needs a name", "error"); return; }
        try { await createSection(state.roomId, name, { parentSectionId: parentSectionId || null }); toast(isSub ? "Sub-section added" : "Section added", "success"); closeModal(); }
        catch (e) { toast("Failed: " + (e.message || e.code), "error"); }
      }}, "Add"),
    ),
  );
  showModal(node);
  setTimeout(() => input.focus(), 50);
}

function openRenameUncategorizedModal(orphans) {
  if (!isTrainer(state.user, state.room)) {
    toast("Only the trainer can rename sections.", "error");
    return;
  }
  const input = el("input", { type: "text", placeholder: "Section name (e.g. General)" });
  const node = el("div", null,
    el("h2", null, "Rename Uncategorized"),
    el("p", { class: "landing-hint" }, `This will create a new section with the name you choose and move ${orphans.length} post${orphans.length === 1 ? "" : "s"} into it.`),
    el("label", null, "Section name"), input,
    el("div", { class: "modal-actions" },
      el("button", { class: "btn btn-secondary", onclick: closeModal }, "Cancel"),
      el("button", { class: "btn", onclick: async () => {
        const name = input.value.trim();
        if (!name) { toast("Section needs a name", "error"); return; }
        try {
          const newId = await createSection(state.roomId, name);
          let movedCount = 0;
          let skipped = 0;
          await Promise.all(orphans.map(async (p) => {
            try { await updatePost(p.id, { sectionId: newId }); movedCount++; }
            catch { skipped++; }
          }));
          if (skipped > 0) {
            toast(`Renamed. Moved ${movedCount} post${movedCount === 1 ? "" : "s"} — ${skipped} couldn't be moved (only authors can move their own posts).`, "info");
          } else {
            toast(`Renamed Uncategorized to "${name}"`, "success");
          }
          closeModal();
        } catch (e) {
          toast("Failed: " + (e.message || e.code), "error");
        }
      }}, "Rename"),
    ),
  );
  showModal(node);
  setTimeout(() => input.focus(), 50);
}

function openRenameSectionModal(section) {
  const trainer = isTrainer(state.user, state.room);
  const owns = state.user && section.authorId === state.user.uid;
  if (!trainer && !owns) { toast("Only the trainer or the section's creator can rename it.", "error"); return; }
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
  const trainer = isTrainer(state.user, state.room);
  const owns = state.user && section.authorId === state.user.uid;
  if (!trainer && !owns) { toast("Only the trainer or the section's creator can delete it.", "error"); return; }
  const subs = state.sections.filter((s) => s.parentSectionId === section.id);
  const postsInThis = state.posts.filter((p) => p.sectionId === section.id).length;
  const postsInSubs = state.posts.filter((p) => subs.some((s) => s.id === p.sectionId)).length;
  let msg = `Delete section "${section.title}"?`;
  if (subs.length > 0) msg += ` Its ${subs.length} sub-section(s) will also be deleted.`;
  if (postsInThis + postsInSubs > 0) msg += ` ${postsInThis + postsInSubs} post(s) will move to "Uncategorized".`;
  if (!confirm(msg)) return;
  Promise.all(subs.map((s) => deleteSection(s.id)))
    .then(() => deleteSection(section.id))
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
  // Typed link(s) / YouTube / previews — multi-link supported via linkUrls[]
  const cardLinks = Array.isArray(p.linkUrls) && p.linkUrls.length > 0
    ? p.linkUrls.map((url, i) => ({ url, preview: (p.linkPreviews && p.linkPreviews[i]) || null }))
    : (p.linkUrl && !p.linkUrl.startsWith("data:") ? [{ url: p.linkUrl, preview: p.linkPreview }] : []);
  for (const { url, preview } of cardLinks) {
    if (!url || url.startsWith("data:")) continue;
    const media = renderMediaOrLink(url, false, preview);
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
  const cached = cache[url];
  // Only trust cache when it has useful data — empty entries retry next time
  if (cached && (cached.title || cached.image)) return cached;

  // Try multiple CORS proxies — different proxies have different success rates
  // for different sites, so we fall through on failure
  const proxies = [
    (u) => "https://corsproxy.io/?" + encodeURIComponent(u),
    (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
    (u) => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u),
  ];
  let html = null;
  for (const buildUrl of proxies) {
    try {
      const res = await fetch(buildUrl(url));
      if (res.ok) { html = await res.text(); if (html) break; }
    } catch {}
  }
  if (!html) throw new Error("preview fetch failed");

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
  // Only cache useful results so empty fetches can be retried later
  if (preview.title || preview.image) {
    cache[url] = preview;
    setPreviewCache(cache);
  }
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
  // Always render a card. If no OG data was fetched, buildLinkPreviewCard renders
  // a minimal card with a link-icon banner so it stays visually consistent.
  return buildLinkPreviewCard(url, preview || { title: "", description: "", image: "" });
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
    const detailLinks = Array.isArray(p.linkUrls) && p.linkUrls.length > 0
      ? p.linkUrls.map((url, i) => ({ url, preview: (p.linkPreviews && p.linkPreviews[i]) || null }))
      : (p.linkUrl && !p.linkUrl.startsWith("data:") ? [{ url: p.linkUrl, preview: p.linkPreview }] : []);
    for (const { url, preview } of detailLinks) {
      if (!url || url.startsWith("data:")) continue;
      const media = renderMediaOrLink(url, true, preview);
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
  }
  if (own || trainer) {
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
  // Resolve initial links: prefer arrays, fall back to legacy single fields
  const initialLinks = (() => {
    if (Array.isArray(initial.linkUrls) && initial.linkUrls.length > 0) {
      const previews = Array.isArray(initial.linkPreviews) ? initial.linkPreviews : [];
      return initial.linkUrls.map((url, i) => ({ url: url || "", preview: previews[i] || null }));
    }
    if (initial.linkUrl) return [{ url: initial.linkUrl, preview: initial.linkPreview || null }];
    return [];
  })();

  const state = {
    images: Array.isArray(initial.images) ? [...initial.images] : [],
    pdfPages: null,
    links: initialLinks,
  };

  const imageInput = el("input", { type: "file", accept: "image/*", multiple: true, hidden: true });
  const imageList = el("div", { class: "image-list" });
  const pdfInput = el("input", { type: "file", accept: "application/pdf", hidden: true });
  const pdfStatus = el("div", { class: "pdf-status" });
  const linksContainer = el("div", { class: "composer-links" });

  function renderLinks() {
    linksContainer.innerHTML = "";
    linksContainer.hidden = state.links.length === 0;
    state.links.forEach((link, idx) => {
      const input = el("input", { type: "url", class: "composer-link-input", placeholder: "Paste a link or YouTube URL" });
      input.value = link.url || "";
      const previewWrap = el("div", { class: "link-preview-wrap" });
      if (link.preview && link.url) previewWrap.append(buildLinkPreviewCard(link.url, link.preview));

      input.addEventListener("input", () => { state.links[idx].url = input.value; });
      input.addEventListener("blur", async () => {
        const url = input.value.trim();
        state.links[idx].url = url;
        state.links[idx].preview = null;
        previewWrap.innerHTML = "";
        if (!url || isImageUrl(url) || youtubeEmbedUrl(url)) return;
        previewWrap.textContent = "Fetching preview…";
        try {
          const p = await fetchLinkPreview(url);
          if (!p.title && !p.image) { previewWrap.innerHTML = ""; return; }
          state.links[idx].preview = p;
          previewWrap.innerHTML = "";
          previewWrap.append(buildLinkPreviewCard(url, p));
        } catch {
          previewWrap.innerHTML = "";
        }
      });

      const remove = el("button", { type: "button", class: "composer-link-remove", title: "Remove link", onclick: () => {
        state.links.splice(idx, 1);
        renderLinks();
      }}, "×");

      linksContainer.append(
        el("div", { class: "composer-link-row" }, input, remove),
        previewWrap,
      );
    });

    if (state.links.length > 0) {
      linksContainer.append(el("button", {
        type: "button",
        class: "composer-add-more",
        onclick: () => {
          state.links.push({ url: "", preview: null });
          renderLinks();
          const inputs = linksContainer.querySelectorAll(".composer-link-input");
          const last = inputs[inputs.length - 1];
          if (last) last.focus();
        },
      }, "+ Add another link"));
    }
  }
  renderLinks();

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

  const tile = (icon, label, onClick, title) => el("button", {
    type: "button",
    class: "composer-tile",
    title: title || label,
    onclick: onClick,
  },
    el("span", { class: "composer-tile-icon" }, icon),
    el("span", { class: "composer-tile-label" }, label),
  );

  const tiles = el("div", { class: "composer-tiles" },
    tile("🖼️", "Image", () => imageInput.click(), "Upload one or more images"),
    tile("📄", "PDF", () => pdfInput.click(), "Upload a PDF"),
    tile("🔗", "Link", () => {
      // Always append a new empty link row and focus it. Multi-link supported.
      state.links.push({ url: "", preview: null });
      renderLinks();
      const inputs = linksContainer.querySelectorAll(".composer-link-input");
      const last = inputs[inputs.length - 1];
      if (last) setTimeout(() => last.focus(), 30);
    }, "Add a link or YouTube URL — click multiple times to add more"),
  );

  const tilesArea = el("div", { class: "composer-tiles-wrap" },
    tiles,
    el("div", { class: "composer-tiles-hint" }, "Add an image, PDF, or link"),
  );

  const attachments = el("div", { class: "composer-attachments" },
    imageInput,
    pdfInput,
    imageList,
    pdfStatus,
    linksContainer,
  );

  return {
    tilesArea,
    attachments,
    // Async so we can resolve any link previews that haven't been fetched yet
    // (e.g. user typed a URL and clicked Submit before the blur fetch finished).
    getValues: async () => {
      await Promise.all(state.links.map(async (l) => {
        const url = (l.url || "").trim();
        if (!url || l.preview) return;
        if (isImageUrl(url) || youtubeEmbedUrl(url)) return;
        try {
          const p = await fetchLinkPreview(url);
          if (p && (p.title || p.image)) l.preview = p;
        } catch {}
      }));
      const valid = state.links.filter((l) => (l.url || "").trim());
      const linkUrls = valid.map((l) => l.url.trim());
      const linkPreviews = valid.map((l) => l.preview || null);
      return {
        imageDataUrls: state.images,
        pdfPages: state.pdfPages,
        linkUrls,
        linkPreviews,
        // Backward compat — first link
        linkUrl: linkUrls[0] || "",
        linkPreview: linkPreviews[0] || null,
      };
    },
  };
}

function openComposer(defaultSectionId) {
  if (!state.user) return;
  const titleInput = el("input", { type: "text", class: "composer-subject", placeholder: "Subject" });
  const descInput = el("textarea", { class: "composer-body", placeholder: "Write something fantastic…" });
  const editor = buildMediaEditor();

  // Section dropdown — only shown when sections exist; sub-sections are indented
  let sectionSelect = null;
  if (state.sections.length > 0) {
    const tops = state.sections.filter((s) => !s.parentSectionId);
    const childrenByParent = new Map();
    for (const s of state.sections) {
      if (s.parentSectionId) {
        if (!childrenByParent.has(s.parentSectionId)) childrenByParent.set(s.parentSectionId, []);
        childrenByParent.get(s.parentSectionId).push(s);
      }
    }
    const opts = [el("option", { value: "" }, "Uncategorized")];
    for (const top of tops) {
      opts.push(el("option", { value: top.id }, top.title || "Untitled"));
      for (const child of (childrenByParent.get(top.id) || [])) {
        opts.push(el("option", { value: child.id }, "    ↳ " + (child.title || "Untitled")));
      }
    }
    sectionSelect = el("select", null, ...opts);
    if (defaultSectionId) sectionSelect.value = defaultSectionId;
  }

  let submitting = false;
  const submitBtn = el("button", { class: "btn composer-submit", onclick: async () => {
    if (submitting) return;
    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    submitting = true;
    submitBtn.textContent = "Posting…";
    const v = await editor.getValues();
    if (!title && !description && v.imageDataUrls.length === 0 && v.linkUrls.length === 0 && !v.pdfPages) {
      toast("Add a subject, description, image, or link", "error");
      submitBtn.textContent = "Submit";
      submitting = false;
      return;
    }
    try {
      await createPost(state.roomId, {
        title, description,
        sectionId: sectionSelect ? sectionSelect.value : null,
        imageDataUrls: v.imageDataUrls,
        linkUrl: v.linkUrl,
        linkPreview: v.linkPreview,
        linkUrls: v.linkUrls,
        linkPreviews: v.linkPreviews,
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
      submitBtn.textContent = "Submit";
      submitting = false;
    }
  }}, "Submit");

  const node = el("div", { class: "composer" },
    el("div", { class: "composer-header" },
      el("button", { class: "composer-close-btn", onclick: closeModal, title: "Close", type: "button" }, "×"),
      submitBtn,
    ),
    titleInput,
    descInput,
    editor.tilesArea,
    editor.attachments,
    sectionSelect ? el("div", { class: "composer-section-row" },
      el("span", { class: "composer-section-label" }, "Section"),
      sectionSelect,
    ) : null,
  );
  showModal(node, { className: "composer-modal" });
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
  const host = shortUrl(url);

  function renderInto(p) {
    card.innerHTML = "";
    const hasImage = !!p.image;
    const hasMeta = !!(p.title || p.description);
    if (hasImage) {
      const img = document.createElement("img");
      img.src = p.image;
      img.className = "link-preview-image";
      img.loading = "lazy";
      img.onerror = () => img.remove();
      card.append(img);
    } else if (!hasMeta) {
      card.append(el("div", { class: "link-preview-icon" }, "🔗"));
    }
    const body = el("div", { class: "link-preview-body" });
    const titleText = p.title && p.title !== host ? p.title : host;
    body.append(el("div", { class: "link-preview-title" }, titleText));
    if (p.description) body.append(el("div", { class: "link-preview-desc" }, truncate(p.description, 160)));
    body.append(el("div", { class: "link-preview-host" }, host));
    card.append(body);
  }

  renderInto(preview || { title: "", description: "", image: "" });

  // If we don't have rich preview data yet, try to fetch it now and re-render the card.
  // This makes old posts whose preview was never fetched get the rich card retroactively.
  const hasAny = preview && (preview.title || preview.image || preview.description);
  if (!hasAny) {
    fetchLinkPreview(url).then((p) => {
      if (p && (p.title || p.image)) renderInto(p);
    }).catch(() => {});
  }

  return card;
}

function openEdit(p) {
  const titleInput = el("input", { type: "text", class: "composer-subject", placeholder: "Subject" });
  titleInput.value = p.title || "";
  const descInput = el("textarea", { class: "composer-body", placeholder: "Write something fantastic…" });
  descInput.value = p.description || "";

  // Existing images: prefer the new array; fall back to the legacy single field
  const existingImages = Array.isArray(p.imageDataUrls) && p.imageDataUrls.length > 0
    ? p.imageDataUrls
    : (p.imageDataUrl && (typeof p.imageDataUrl === "string" && p.imageDataUrl.startsWith("data:"))
        ? [p.imageDataUrl]
        : (p.linkUrl && typeof p.linkUrl === "string" && p.linkUrl.startsWith("data:") ? [p.linkUrl] : []));

  // Resolve initial links from new arrays first, fall back to legacy single field
  const initialLinkUrls = Array.isArray(p.linkUrls) && p.linkUrls.length > 0
    ? p.linkUrls
    : (p.linkUrl && !p.linkUrl.startsWith("data:") ? [p.linkUrl] : []);
  const initialLinkPreviews = Array.isArray(p.linkPreviews) && p.linkPreviews.length > 0
    ? p.linkPreviews
    : (p.linkPreview ? [p.linkPreview] : []);

  const editor = buildMediaEditor({
    images: existingImages,
    linkUrls: initialLinkUrls,
    linkPreviews: initialLinkPreviews,
  });

  let saving = false;
  const saveBtn = el("button", { class: "btn composer-submit", onclick: async () => {
    if (saving) return;
    saving = true;
    saveBtn.textContent = "Saving…";
    try {
      const v = await editor.getValues();
      const patch = {
        title: titleInput.value.trim(),
        description: descInput.value.trim(),
        imageDataUrls: v.imageDataUrls,
        imageDataUrl: v.imageDataUrls[0] || "",
        linkUrls: v.linkUrls,
        linkPreviews: v.linkPreviews,
        linkUrl: v.linkUrl,
        linkPreview: v.linkPreview || null,
      };
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

  const node = el("div", { class: "composer" },
    el("div", { class: "composer-header" },
      el("button", { class: "composer-close-btn", onclick: closeModal, title: "Close", type: "button" }, "×"),
      saveBtn,
    ),
    titleInput,
    descInput,
    editor.tilesArea,
    editor.attachments,
    p.pdfPageCount ? el("p", { class: "pdf-note" }, `This post has a ${p.pdfPageCount}-page PDF attached. To change it, delete the post and create a new one.`) : null,
  );
  showModal(node, { className: "composer-modal" });
}
