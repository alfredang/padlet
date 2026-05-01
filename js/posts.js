import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs,
  query, where, orderBy, onSnapshot, serverTimestamp,
  arrayUnion, arrayRemove,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL, deleteObject,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-storage.js";
import { db, storage, auth } from "./firebase.js";

const POSTS = collection(db, "posts");

export function subscribePosts(cb) {
  const q = query(POSTS, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    cb(items);
  }, (err) => {
    console.error("posts subscribe error", err);
    cb([], err);
  });
}

async function uploadImage(file) {
  const user = auth.currentUser;
  if (!user) throw new Error("not signed in");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const id = crypto.randomUUID();
  const path = `post-images/${user.uid}/${id}-${safeName}`;
  const r = ref(storage, path);
  await uploadBytes(r, file);
  const url = await getDownloadURL(r);
  return { url, path };
}

export async function createPost({ title, description, category, file, linkUrl, authorName }) {
  const user = auth.currentUser;
  if (!user) throw new Error("not signed in");
  let imageUrl = "";
  let imagePath = "";
  if (file) {
    const up = await uploadImage(file);
    imageUrl = up.url;
    imagePath = up.path;
  }
  const docRef = await addDoc(POSTS, {
    title: title || "",
    description: description || "",
    category: category || "",
    imageUrl,
    imagePath,
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

export async function updatePost(id, patch) {
  await updateDoc(doc(db, "posts", id), { ...patch, updatedAt: serverTimestamp() });
}

export async function deletePost(post) {
  if (post.imagePath) {
    try { await deleteObject(ref(storage, post.imagePath)); } catch (e) { /* best effort */ }
  }
  // Delete associated comments
  try {
    const commentsQ = query(collection(db, "comments"), where("postId", "==", post.id));
    const snap = await getDocs(commentsQ);
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
