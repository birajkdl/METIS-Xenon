# METIS Firestore Security Specification & ABAC Test Suite

## 1. Data Invariants

1. **Identity & Authentication Invariant**: A user profile document at `/users/{userId}` can only be created or modified if `request.auth.uid == userId` and the user's email is verified (`request.auth.token.email_verified == true`), unless performed by a verified administrator (`birajkdl@gmail.com` or document in `/admins/{adminId}`).
2. **Immutability of Identity & Ownership**: Fields such as `uid`, `email`, and `createdAt` are immutable after creation.
3. **Role Escalation Prevention**: Standard users cannot grant themselves or elevate their own `role` beyond `"Viewer"` or default tier during creation or update. The `role` field cannot be altered except by an authenticated administrator.
4. **Preference Subcollection Isolation**: `/users/{userId}/preferences/{preferenceId}` documents strictly belong to `userId`. Only `request.auth.uid == userId` can read or write preferences.
5. **Announcement Integrity**: Public can read `/announcements/{announcementId}`, but only authenticated administrators can create, update, or delete announcements.
6. **Field Boundary Constraints**: All string fields must adhere strictly to maximum size boundaries (`name <= 128`, `email <= 256`, `title <= 200`, `message <= 2000`).

---

## 2. The "Dirty Dozen" Payloads (Must Return PERMISSION_DENIED)

1. **Payload 1: Unauthenticated User Profile Read/Write**
   - Path: `/users/target_user_123`
   - Request: Anonymous / Unauthenticated write.
   - Expected: PERMISSION_DENIED.

2. **Payload 2: Identity Spoofing (Owner ID Mismatch)**
   - Path: `/users/target_user_123`
   - Request: Auth UID `attacker_456` attempting to create `/users/target_user_123`.
   - Expected: PERMISSION_DENIED.

3. **Payload 3: Privilege Escalation (Self-Assigned Super Administrator Role)**
   - Path: `/users/attacker_456`
   - Payload: `{ "uid": "attacker_456", "email": "attacker@evil.com", "role": "Super Administrator" }`
   - Expected: PERMISSION_DENIED.

4. **Payload 4: Shadow Field Injection (Denial of Wallet / Extra fields)**
   - Path: `/users/user_123`
   - Payload: `{ "uid": "user_123", "email": "user@example.com", "role": "Viewer", "isAdmin": true, "secretBackdoor": "yes" }`
   - Expected: PERMISSION_DENIED.

5. **Payload 5: Immutable Field Mutation (Attempting to overwrite createdAt or uid)**
   - Path: `/users/user_123`
   - Update: `{ "uid": "hijacked_id" }`
   - Expected: PERMISSION_DENIED.

6. **Payload 6: Cross-User Subcollection Intrusion**
   - Path: `/users/victim_123/preferences/pref_1`
   - Request: Auth UID `attacker_456` writing to victim's preferences subcollection.
   - Expected: PERMISSION_DENIED.

7. **Payload 7: Unverified Email Write Attempt**
   - Path: `/users/unverified_123`
   - Request: User with `email_verified: false` attempting document creation.
   - Expected: PERMISSION_DENIED.

8. **Payload 8: Non-Admin Announcement Creation**
   - Path: `/announcements/ann_1`
   - Request: Standard user (`Viewer`) creating a system announcement.
   - Expected: PERMISSION_DENIED.

9. **Payload 9: Announcement Modification by Non-Admin**
   - Path: `/announcements/ann_1`
   - Request: Standard authenticated user attempting to alter or delete an announcement.
   - Expected: PERMISSION_DENIED.

10. **Payload 10: Oversized Payload Injection (String Buffer Overflow Attack)**
    - Path: `/announcements/ann_2`
    - Payload: `{ "title": "A".repeat(5000), "message": "B".repeat(100000) }`
    - Expected: PERMISSION_DENIED.

11. **Payload 11: Document ID Poisoning (Injection Attack in ID path)**
    - Path: `/users/!@#$%^&*()_invalid_path_segment_overflow`
    - Request: Path with non-standard injection characters exceeding 128 characters.
    - Expected: PERMISSION_DENIED.

12. **Payload 12: Global Catch-All Root Intrusion**
    - Path: `/system_secrets/config` or `/non_existent_collection/leak`
    - Request: Any read or write to unmapped collections.
    - Expected: PERMISSION_DENIED.

---

## 3. Test Runner Verification Plan

Each scenario targets Firestore security rules via integration asserts:
- `assertFails(setDoc(doc(db, '/users/target_123'), ...))`
- `assertFails(updateDoc(doc(db, '/users/user_123'), ...))`
- `assertFails(setDoc(doc(db, '/announcements/ann_1'), ...))`
Ensuring zero-trust validation for all entity lifecycles.
