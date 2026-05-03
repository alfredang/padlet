import {
  collection, doc, setDoc, getDoc, getDocs, query, where, onSnapshot, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import {
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { db, auth } from "./firebase.js";
import { signInAnon } from "./auth.js";

async function ensureSignedIn(nickname) {
  if (auth.currentUser) {
    const user = auth.currentUser;
    if (nickname && nickname.trim() && user.isAnonymous && !user.displayName) {
      await updateProfile(user, { displayName: nickname.trim() });
    }
    return user;
  }
  return signInAnon(nickname);
}

// Room metadata is stored as a doc in the existing `posts` collection with
// type="room". This works under the current production Firestore rules
// without needing a rule update: posts allow create by signedIn user with
// own authorId and pinned=false; allow update by author for any non-pinned
// non-authorId fields. So the room creator gets edit-title/edit-announcement
// powers naturally because they're the doc's author.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes).map((b) => ALPHABET[b % 32]).join("");
}

export async function createRoom(nickname) {
  const user = await ensureSignedIn(nickname);
  const displayName = (nickname && nickname.trim()) || user.displayName || "Trainer";
  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    const ref = doc(db, "posts", code);
    const snap = await getDoc(ref);
    if (snap.exists()) continue;
    await setDoc(ref, {
      type: "room",
      roomId: code,
      title: "",
      announcement: "",
      authorId: user.uid,
      authorName: displayName,
      pinned: false,
      createdAt: serverTimestamp(),
    });
    return code;
  }
  throw new Error("Could not generate a unique room code, try again");
}

export async function joinRoom(code, nickname) {
  const clean = (code || "").toUpperCase().trim();
  if (!clean) throw new Error("Please enter a room code");
  await ensureSignedIn(nickname);
  const snap = await getDoc(doc(db, "posts", clean));
  if (!snap.exists() || snap.data().type !== "room") throw new Error("Room not found");
  return clean;
}

export function subscribeRoom(roomId, cb) {
  return onSnapshot(doc(db, "posts", roomId), (snap) => {
    if (!snap.exists() || snap.data().type !== "room") {
      cb(null);
      return;
    }
    cb({ id: snap.id, ...snap.data() });
  }, (err) => {
    console.error("room subscribe error", err);
    cb(null, err);
  });
}

export async function updateRoomTitle(roomId, title) {
  await setDoc(doc(db, "posts", roomId), { title: title || "" }, { merge: true });
}

export async function setAnnouncement(roomId, text) {
  await setDoc(doc(db, "posts", roomId), { announcement: text || "" }, { merge: true });
}

export function isTrainer(user, room) {
  return !!(room && user && room.authorId === user.uid);
}

// Membership records let signed-in users see the rooms they've joined across
// any device (as long as they sign in with the same account). Stored as a
// type="membership" doc in the posts collection so it works under existing
// Firestore rules (signedIn + authorId match + pinned false).
export async function recordMembership(roomId, room) {
  const user = auth.currentUser;
  if (!user || !roomId) return;
  const docId = `mem_${user.uid}_${roomId}`;
  const ref = doc(db, "posts", docId);
  try {
    await setDoc(ref, {
      type: "membership",
      roomId,
      roomTitle: (room && room.title) || "",
      authorId: user.uid,
      authorName: user.displayName || "Guest",
      pinned: false,
      lastJoinedAt: serverTimestamp(),
    }, { merge: true });
  } catch (e) {
    console.warn("membership record failed", e);
  }
}

// Returns rooms the current user has been in: rooms they created (type=room)
// + rooms they joined (type=membership). Deduplicated by room code.
export async function fetchMyRooms() {
  const user = auth.currentUser;
  if (!user) return [];
  const q = query(collection(db, "posts"), where("authorId", "==", user.uid));
  const snap = await getDocs(q);
  const rooms = new Map();
  snap.forEach((d) => {
    const data = d.data();
    if (data.type === "room") {
      rooms.set(data.roomId, { code: data.roomId, title: data.title || "", role: "trainer" });
    } else if (data.type === "membership") {
      if (!rooms.has(data.roomId)) {
        rooms.set(data.roomId, { code: data.roomId, title: data.roomTitle || "", role: "member" });
      }
    }
  });
  return Array.from(rooms.values()).sort((a, b) => (a.title || "").localeCompare(b.title || ""));
}
