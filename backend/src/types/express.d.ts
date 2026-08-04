// src/types/express.d.ts — Augments Express Request with authenticated user
import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        care_home_id: string;
        care_home_name?: string;
        first_name?: string;
        last_name?: string;
      };
    }
  }
}
