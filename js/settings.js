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

export function subscribeBoardTitle(cb) {
  return onSnapshot(BOARD_DOC, (snap) => {
    cb(snap.exists() ? (snap.data().title || "") : "");
  }, (err) => {
    console.error("title subscribe error", err);
    cb("", err);
  });
}

export async function setBoardTitle(text) {
  await setDoc(BOARD_DOC, { title: text || "" }, { merge: true });
}
