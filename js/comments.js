import {
  collection, doc, addDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db, auth } from "./firebase.js";

const COMMENTS = collection(db, "comments");

export function subscribeComments(postId, cb) {
  const q = query(COMMENTS, where("postId", "==", postId), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    cb(items);
  }, (err) => {
    console.error("comments subscribe error", err);
    cb([], err);
  });
}

export async function addComment(roomId, postId, text) {
  const user = auth.currentUser;
  if (!user) throw new Error("not signed in");
  await addDoc(COMMENTS, {
    roomId,
    postId,
    authorId: user.uid,
    authorName: user.displayName || (user.email ? user.email.split("@")[0] : "Guest"),
    text: text.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function deleteComment(commentId) {
  await deleteDoc(doc(db, "comments", commentId));
}
