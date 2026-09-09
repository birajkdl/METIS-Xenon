import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  onSnapshot, 
  deleteDoc, 
  serverTimestamp,
  getDocFromServer 
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, auth } from './firebase.ts';
import { handleFirestoreError, OperationType } from './firestore-errors.ts';
import { MaintenanceTicket } from '../types.ts';

export interface UserProfileDoc {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  role: 'Super Administrator' | 'Administrator' | 'Meteorologist' | 'Technician' | 'Viewer';
  office?: string;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserPreferencesDoc {
  userId: string;
  theme?: 'light' | 'dark' | 'system';
  autoRefresh?: boolean;
  pinnedStationIds?: number[];
  updatedAt?: string;
}

export interface UserActivityDoc {
  id: string;
  userId: string;
  action: string;
  details?: string;
  timestamp: string;
}

const ADMIN_EMAILS = ['birajkdl@gmail.com'];

/**
 * Checks connectivity to the provisioned Firestore database
 */
export async function verifyFirestoreConnectivity(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore client is currently offline or connecting...");
      return false;
    }
    // 'test/connection' doc might not exist, which is fine and confirms server connection
    return true;
  }
}

/**
 * Syncs user profile document to Firestore (/users/{uid})
 * Called upon successful Google authentication.
 */
export async function syncUserProfileToFirestore(
  firebaseUser: User,
  extra?: { role?: string; office?: string; designation?: string }
): Promise<UserProfileDoc> {
  const userDocRef = doc(db, 'users', firebaseUser.uid);
  const path = `users/${firebaseUser.uid}`;
  const nowStr = new Date().toISOString();

  try {
    const docSnap = await getDoc(userDocRef);
    const isMasterAdmin = ADMIN_EMAILS.includes(firebaseUser.email || '');

    if (!docSnap.exists()) {
      // Create new profile doc in Firestore
      const newRole = isMasterAdmin 
        ? 'Super Administrator' 
        : (extra?.role as any || 'Meteorologist');

      const newProfile: UserProfileDoc = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Meteorologist',
        photoURL: firebaseUser.photoURL || null,
        role: newRole,
        office: extra?.office || 'Department of Hydrology and Meteorology, Nepal',
        lastLoginAt: nowStr,
        createdAt: nowStr,
        updatedAt: nowStr
      };

      await setDoc(userDocRef, newProfile);
      return newProfile;
    } else {
      // Update existing profile with latest login timestamp and photo
      const existingData = docSnap.data() as UserProfileDoc;
      const updatedFields: Partial<UserProfileDoc> = {
        displayName: firebaseUser.displayName || existingData.displayName,
        photoURL: firebaseUser.photoURL || existingData.photoURL,
        lastLoginAt: nowStr,
        updatedAt: nowStr
      };

      if (extra?.office) {
        updatedFields.office = extra.office;
      }

      await updateDoc(userDocRef, updatedFields);
      return { ...existingData, ...updatedFields };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

/**
 * Subscribes to real-time updates for a user profile in Firestore
 */
export function subscribeToUserProfile(
  userId: string,
  onProfile: (profile: UserProfileDoc | null) => void
): () => void {
  const path = `users/${userId}`;
  const userDocRef = doc(db, 'users', userId);

  return onSnapshot(
    userDocRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onProfile(docSnap.data() as UserProfileDoc);
      } else {
        onProfile(null);
      }
    },
    (error) => {
      console.warn("User profile Firestore subscription note:", error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

/**
 * Saves user preferences to Firestore (/users/{userId}/preferences/user_prefs)
 */
export async function saveUserPreferencesToFirestore(
  userId: string,
  prefs: Partial<UserPreferencesDoc>
): Promise<void> {
  const path = `users/${userId}/preferences/user_prefs`;
  const prefRef = doc(db, 'users', userId, 'preferences', 'user_prefs');

  try {
    const payload: UserPreferencesDoc = {
      userId,
      theme: prefs.theme || 'dark',
      autoRefresh: prefs.autoRefresh !== undefined ? prefs.autoRefresh : true,
      pinnedStationIds: prefs.pinnedStationIds || [],
      updatedAt: new Date().toISOString()
    };
    await setDoc(prefRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Subscribes to real-time user preferences in Firestore
 */
export function subscribeToUserPreferences(
  userId: string,
  onPreferences: (prefs: UserPreferencesDoc | null) => void
): () => void {
  const path = `users/${userId}/preferences/user_prefs`;
  const prefRef = doc(db, 'users', userId, 'preferences', 'user_prefs');

  return onSnapshot(
    prefRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onPreferences(docSnap.data() as UserPreferencesDoc);
      } else {
        onPreferences(null);
      }
    },
    (error) => {
      console.warn("User preferences Firestore subscription note:", error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

/**
 * Records an audit activity log entry under /users/{userId}/activity/{activityId}
 */
export async function logUserActivityToFirestore(
  userId: string,
  action: string,
  details?: string
): Promise<void> {
  const actId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const path = `users/${userId}/activity/${actId}`;
  const actRef = doc(db, 'users', userId, 'activity', actId);

  try {
    const payload: UserActivityDoc = {
      id: actId,
      userId,
      action,
      details: details?.slice(0, 950),
      timestamp: new Date().toISOString()
    };
    await setDoc(actRef, payload);
  } catch (error) {
    console.warn("Could not write activity log to Firestore:", error);
  }
}

/**
 * Subscribes to real-time Maintenance Tickets in Firestore (/maintenance_tickets)
 */
export function subscribeToMaintenanceTickets(
  onTickets: (tickets: MaintenanceTicket[]) => void
): () => void {
  const path = 'maintenance_tickets';
  const ticketsCol = collection(db, 'maintenance_tickets');

  return onSnapshot(
    ticketsCol,
    (snapshot) => {
      const tickets: MaintenanceTicket[] = [];
      snapshot.forEach((docSnap) => {
        tickets.push(docSnap.data() as MaintenanceTicket);
      });
      // Sort by creation date descending
      tickets.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onTickets(tickets);
    },
    (error) => {
      console.warn("Maintenance tickets Firestore subscription note:", error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

/**
 * Saves or updates a maintenance ticket in Firestore (/maintenance_tickets/{ticketNumber})
 */
export async function saveMaintenanceTicketToFirestore(
  ticket: MaintenanceTicket,
  creatorUid?: string
): Promise<void> {
  const path = `maintenance_tickets/${ticket.ticketNumber}`;
  const ticketRef = doc(db, 'maintenance_tickets', ticket.ticketNumber);

  try {
    const cleanTicket = {
      ...ticket,
      creatorUid: creatorUid || auth.currentUser?.uid || 'system_uid',
      updatedAt: new Date().toISOString()
    };

    // Remove any undefined values
    Object.keys(cleanTicket).forEach(key => {
      if ((cleanTicket as any)[key] === undefined) {
        delete (cleanTicket as any)[key];
      }
    });

    await setDoc(ticketRef, cleanTicket, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

/**
 * Deletes a maintenance ticket from Firestore (/maintenance_tickets/{ticketNumber})
 */
export async function deleteMaintenanceTicketFromFirestore(
  ticketNumber: string
): Promise<void> {
  const path = `maintenance_tickets/${ticketNumber}`;
  const ticketRef = doc(db, 'maintenance_tickets', ticketNumber);

  try {
    await deleteDoc(ticketRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}
