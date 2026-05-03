import {
  doc, setDoc, getDoc, onSnapshot, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "./firebase.js";
import { signInAnon } from "./auth.js";

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
  const user = await signInAnon(nickname);
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
      authorName: (nickname || "Trainer").trim() || "Trainer",
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
  await signInAnon(nickname);
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
