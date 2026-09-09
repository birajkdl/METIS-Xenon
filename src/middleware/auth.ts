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
    let dbUser;
    try {
      dbUser = await getOrCreateUser(decodedToken.uid, decodedToken.email || '');
    } catch (dbErr) {
      console.warn("Cloud SQL getOrCreateUser notice, providing fallback:", dbErr);
      const isSuper = (decodedToken.email || '').toLowerCase() === 'birajkdl@gmail.com';
      dbUser = {
        id: 1,
        uid: decodedToken.uid,
        email: decodedToken.email || '',
        role: isSuper ? 'Super Administrator' : 'Meteorologist',
        assignedStationId: null,
        office: 'Department of Hydrology and Meteorology, Nepal',
        createdAt: new Date(),
        username: (decodedToken as any).name || (decodedToken.email ? decodedToken.email.split('@')[0] : 'User'),
        designation: isSuper ? 'Chief System Administrator' : 'Senior Meteorologist',
        phoneNumber: (decodedToken as any).phone_number || null,
        status: 'Active'
      };
    }
    req.dbUser = dbUser;
    
    return next();
  } catch (error: any) {
    if (error?.code === 'auth/id-token-expired') {
      console.warn('Firebase ID token expired:', error.message);
      return res.status(401).json({ 
        error: 'Unauthorized: Firebase ID token has expired. Please refresh your session.',
        code: 'auth/id-token-expired'
      });
    }
    console.warn('Firebase ID token verification failed:', error?.message || error);
    return res.status(401).json({ 
      error: 'Unauthorized: Invalid authentication credentials.',
      code: error?.code || 'auth/invalid-token'
    });
  }
};

