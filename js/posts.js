import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs,
  query, where, onSnapshot, serverTimestamp,
  arrayUnion, arrayRemove,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db, auth } from "./firebase.js";

const POSTS = collection(db, "posts");

// Posts collection holds two doc shapes:
//   - type === "room"  → room metadata (handled by rooms.js)
//   - type === "post"  → an actual post on a room's board
// We filter to only "post" docs client-side so we don't need a composite index.

export function subscribePosts(roomId, cb) {
  const q = query(POSTS, where("roomId", "==", roomId));
  return onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.type === "room") return;
      items.push({ id: d.id, ...data });
    });
    cb(items);
  }, (err) => {
    console.error("posts subscribe error", err);
    cb([], err);
  });
}

export async function createPost(roomId, { title, description, category, linkUrl, authorName }) {
  const user = auth.currentUser;
  if (!user) throw new Error("not signed in");
  const docRef = await addDoc(POSTS, {
    type: "post",
    roomId,
    title: title || "",
    description: description || "",
    category: category || "",
    linkUrl: linkUrl || "",
    authorId: user.uid,
    authorName: authorName || user.displayName || "Guest",
    likes: [],
    pinned: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updatePost(postId, patch) {
  await updateDoc(doc(db, "posts", postId), { ...patch, updatedAt: serverTimestamp() });
}

export async function deletePost(post) {
  try {
    const q = query(collection(db, "comments"), where("postId", "==", post.id));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  } catch (e) { console.warn("comment cleanup failed", e); }
  await deleteDoc(doc(db, "posts", post.id));
}

export async function toggleLike(postId, uid, currentlyLiked) {
  await updateDoc(doc(db, "posts", postId), {
    likes: currentlyLiked ? arrayRemove(uid) : arrayUnion(uid),
  });
}

export async function setPinned(postId, pinned) {
  await updateDoc(doc(db, "posts", postId), { pinned: !!pinned, updatedAt: serverTimestamp() });
}
