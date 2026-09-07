import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getOrCreateUser } from '../db/users.ts';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { verifyMetisToken } from '../lib/auth-utils.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken | { uid: string; email?: string; [key: string]: any };
  dbUser?: {
    id: number;
    uid: string;
    email: string;
    role: string | null;
    assignedStationId: number | null;
    office: string | null;
    createdAt: Date | null;
    username?: string | null;
    designation?: string | null;
    phoneNumber?: string | null;
    status?: string | null;
  };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Empty token' });
  }

  // 1. First, check if token is a Native METIS cryptographic token
  if (token.startsWith('metis.')) {
    const payload = verifyMetisToken(token);
    if (payload && payload.uid) {
      try {
        const foundUsers = await db.select().from(users).where(eq(users.uid, payload.uid));
        if (foundUsers.length > 0) {
          req.dbUser = foundUsers[0];
          req.user = { uid: payload.uid, email: payload.email, role: foundUsers[0].role || payload.role };
          return next();
        }
      } catch (dbErr) {
        console.error("Database lookup failed for native token:", dbErr);
      }
    }
  }

  // 2. Fallback to Firebase ID Token
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    
    // Automatically register/get user in Cloud SQL
    const dbUser = await getOrCreateUser(decodedToken.uid, decodedToken.email || '');
    req.dbUser = dbUser;
    
    return next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

