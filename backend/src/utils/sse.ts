// src/utils/sse.ts — Server-Sent Events manager
import { Response } from 'express';

interface SSEClient {
  userId: string;
  res: Response;
}

class SSEManager {
  // Map: careHomeId → Map: userId → Response
  private homes = new Map<string, Map<string, Response>>();

  addClient(careHomeId: string, userId: string, res: Response) {
    if (!this.homes.has(careHomeId)) {
      this.homes.set(careHomeId, new Map());
    }
    this.homes.get(careHomeId)!.set(userId, res);
  }

  removeClient(careHomeId: string, userId: string) {
    this.homes.get(careHomeId)?.delete(userId);
    if (this.homes.get(careHomeId)?.size === 0) {
      this.homes.delete(careHomeId);
    }
  }

  broadcast(careHomeId: string, data: object, excludeUserId?: string) {
    const clients = this.homes.get(careHomeId);
    if (!clients) return;
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const [userId, res] of clients.entries()) {
      if (userId === excludeUserId) continue;
      try { res.write(payload); } catch { this.removeClient(careHomeId, userId); }
    }
  }

  clientCount(careHomeId: string): number {
    return this.homes.get(careHomeId)?.size ?? 0;
  }
}

export const sseManager = new SSEManager();
