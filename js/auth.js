import {
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { auth } from "./firebase.js";

export async function signInAnon(nickname) {
  const cred = await signInAnonymously(auth);
  if (nickname && nickname.trim()) {
    await updateProfile(cred.user, { displayName: nickname.trim() });
  }
  return cred.user;
}

export async function signInGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export function signOutUser() {
  return signOut(auth);
}

export function onAuthChange(cb) {
  return onAuthStateChanged(auth, cb);
}

export function displayNameOf(user) {
  if (!user) return "";
  if (user.displayName) return user.displayName;
  if (user.email) return user.email.split("@")[0];
  return "Guest";
}
