import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, writeBatch,
  query, where, onSnapshot, serverTimestamp,
  arrayUnion, arrayRemove,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db, auth } from "./firebase.js";

const POSTS = collection(db, "posts");

// Posts collection holds three doc shapes:
//   - type === "room"     → room metadata (handled by rooms.js)
//   - type === "post"     → an actual post on a room's board
//   - type === "pdf-page" → one page of a PDF attached to a post
//                            (parentPostId points to the owning post)
// We filter "post" docs client-side so we don't need a composite index.

export function subscribePosts(roomId, cb) {
  const q = query(POSTS, where("roomId", "==", roomId));
  return onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.type === "room" || data.type === "pdf-page" || data.type === "membership" || data.type === "section") return;
      items.push({ id: d.id, ...data });
    });
    cb(items);
  }, (err) => {
    console.error("posts subscribe error", err);
    cb([], err);
  });
}

export function subscribePdfPages(postId, cb) {
  const q = query(POSTS, where("parentPostId", "==", postId));
  return onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.type !== "pdf-page") return;
      items.push({ pageNum: data.pageNum, imageDataUrl: data.imageDataUrl });
    });
    items.sort((a, b) => (a.pageNum || 0) - (b.pageNum || 0));
    cb(items);
  }, (err) => {
    console.error("pdf pages subscribe error", err);
    cb([], err);
  });
}

export async function createPost(roomId, { title, description, category, sectionId, linkUrl, linkUrls, linkPreviews, imageDataUrls, linkPreview, pdfPages, authorName, onPdfProgress }) {
  const user = auth.currentUser;
  if (!user) throw new Error("not signed in");
  const hasPdf = Array.isArray(pdfPages) && pdfPages.length > 0;
  const images = Array.isArray(imageDataUrls) ? imageDataUrls.filter(Boolean) : [];
  const cover = hasPdf ? pdfPages[0] : (images[0] || "");
  const author = authorName || user.displayName || "Guest";
  const linksArr = Array.isArray(linkUrls) ? linkUrls.filter(Boolean) : (linkUrl ? [linkUrl] : []);
  const previewsArr = Array.isArray(linkPreviews) ? linkPreviews : (linkPreview ? [linkPreview] : []);
  const mainRef = await addDoc(POSTS, {
    type: "post",
    roomId,
    sectionId: sectionId || null,
    title: title || "",
    description: description || "",
    category: category || "",
    imageDataUrl: cover,           // legacy single field — kept for backward compat readers
    imageDataUrls: images,          // new: array of all images
    linkUrl: linksArr[0] || "",     // legacy single field — first link
    linkPreview: previewsArr[0] || null, // legacy single field — first preview
    linkUrls: linksArr,             // new: array of all links
    linkPreviews: previewsArr,      // new: array of previews aligned with linkUrls
    pdfPageCount: hasPdf ? pdfPages.length : 0,
    authorId: user.uid,
    authorName: author,
    likes: [],
    pinned: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (hasPdf) {
    const CHUNK = 100;
    for (let i = 0; i < pdfPages.length; i += CHUNK) {
      const batch = writeBatch(db);
      const slice = pdfPages.slice(i, i + CHUNK);
      slice.forEach((pageDataUrl, j) => {
        const pageRef = doc(POSTS);
        batch.set(pageRef, {
          type: "pdf-page",
          roomId,
          parentPostId: mainRef.id,
          pageNum: i + j + 1,
          imageDataUrl: pageDataUrl,
          authorId: user.uid,
          authorName: author,
          pinned: false,
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();
      if (onPdfProgress) onPdfProgress(Math.min(i + CHUNK, pdfPages.length), pdfPages.length);
    }
  }
  return mainRef.id;
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
  if (post.pdfPageCount && post.pdfPageCount > 0) {
    try {
      const q = query(POSTS, where("parentPostId", "==", post.id));
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    } catch (e) { console.warn("pdf page cleanup failed", e); }
  }
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
