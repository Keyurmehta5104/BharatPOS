import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  updateProfile
} from "firebase/auth";
import type { UserCredential } from "firebase/auth";
import { auth } from "./firebase";

export const logoutUser = async (): Promise<void> => {
  await signOut(auth);
};

export const registerUser = async (email: string, password: string, displayName: string): Promise<UserCredential> => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  if (userCredential.user) {
    await updateProfile(userCredential.user, {
      displayName: displayName
    });
  }
  return userCredential;
};

export const loginUser = async (email: string, password: string): Promise<UserCredential> => {
  return await signInWithEmailAndPassword(auth, email, password);
};
