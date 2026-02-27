'use client';
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { useFirebase } from '../provider';
import { UserProfile } from '@/lib/types';

export function useAuth() {
  const context = useFirebase();
  if (context === undefined) {
    throw new Error('useAuth must be used within a FirebaseProvider');
  }
  return context;
}

export function useUser() {
  const { auth, firestore } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || !firestore) {
      setLoading(false);
      return;
    }

    let profileListenerUnsubscribe: Unsubscribe | null = null;

    const authStateListenerUnsubscribe = onAuthStateChanged(auth, (userState) => {
      // Clean up previous profile listener if user changes
      if (profileListenerUnsubscribe) {
        profileListenerUnsubscribe();
      }
      
      setUser(userState);

      if (userState) {
        setLoading(true); // When user is found, start loading the profile
        const userDocRef = doc(firestore, 'users', userState.uid);
        profileListenerUnsubscribe = onSnapshot(userDocRef, 
          (snapshot) => {
            if (snapshot.exists()) {
              // Combine doc data with the ID to ensure uid is always present
              setUserProfile({ ...snapshot.data(), uid: snapshot.id, id: snapshot.id } as UserProfile);
            } else {
              // User is authenticated, but no profile doc exists.
              setUserProfile(null);
            }
            setLoading(false); // Finished loading profile data
          }, 
          (error) => {
            console.error("Error listening to user profile:", error);
            setUserProfile(null);
            setLoading(false);
          }
        );
      } else {
        // User is logged out
        setUserProfile(null);
        setLoading(false);
      }
    });

    // Cleanup listeners on unmount
    return () => {
      authStateListenerUnsubscribe();
      if (profileListenerUnsubscribe) {
        profileListenerUnsubscribe();
      }
    };
  }, [auth, firestore]);

  return { user, userProfile, loading };
}
