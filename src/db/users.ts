import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string) {
  try {
    const existingUsers = await db.select().from(users);
    const existingUser = existingUsers.find(u => u.uid === uid);
    
    if (existingUser) {
      // If email has changed, or if it is the superadmin email and has the wrong role, update it
      const needsRoleUpdate = email === 'birajkdl@gmail.com' && existingUser.role !== 'Super Administrator';
      if (existingUser.email !== email || needsRoleUpdate) {
        const updated = await db.update(users)
          .set({ 
            email,
            ...(needsRoleUpdate ? { role: 'Super Administrator' } : {})
          })
          .where(eq(users.uid, uid))
          .returning();
        return updated[0];
      }
      return existingUser;
    }

    // If matching user exists by email, link UID
    const existingByEmail = existingUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingByEmail) {
      const updated = await db.update(users)
        .set({
          uid,
          email,
          ...(email.toLowerCase() === 'birajkdl@gmail.com' ? { role: 'Super Administrator' } : {})
        })
        .where(eq(users.id, existingByEmail.id))
        .returning();
      return updated[0];
    }

    // If first user, or email matches the Super Admin email, bootstraps as Super Admin
    let role = 'Read-only/Audit User';
    if (existingUsers.length === 0 || email === 'birajkdl@gmail.com') {
      role = 'Super Administrator';
    }

    const result = await db.insert(users)
      .values({
        uid,
        email,
        role,
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error("Failed to get or create user:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
