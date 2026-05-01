import {
  doc, onSnapshot, setDoc,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "./firebase.js";

const BOARD_DOC = doc(db, "settings", "board");

export function subscribeAnnouncement(cb) {
  return onSnapshot(BOARD_DOC, (snap) => {
    cb(snap.exists() ? (snap.data().announcement || "") : "");
  }, (err) => {
    console.error("settings subscribe error", err);
    cb("", err);
  });
}

export async function setAnnouncement(text) {
  await setDoc(BOARD_DOC, { announcement: text || "" }, { merge: true });
}
