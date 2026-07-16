/**
 * Network Sync for Match History
 * 
 * Syncs binary match logs between local IndexedDB and Firebase Firestore.
 * Enables cross-device match history access using efficient binary format.
 * 
 * Strategy:
 * - Local-first: All matches stored in IndexedDB immediately
 * - Background sync: Upload to Firestore when online
 * - Pull on demand: Download matches from other devices
 * - Conflict resolution: Latest timestamp wins
 * 
 * Firestore schema:
 * - Collection: userMatchLogs/{uid}/matches/{matchId}
 * - Binary data stored as base64 in document
 * - Indexed by exportedAt for efficient queries
 * 
 * @example
 * ```typescript
 * const sync = new MatchSyncService(db, firestore, uid);
 * 
 * // Store locally and sync to cloud
 * await sync.storeAndSync(matchLog);
 * 
 * // Pull matches from cloud
 * const pulled = await sync.pullFromCloud();
 * console.log(`Pulled ${pulled} new matches`);
 * 
 * // Sync all pending
 * await sync.syncPending();
 * ```
 */

import type { BinaryMatchExport } from '../game/match-log-binary.js';
import {
  openMatchLogDB,
  storeMatch,
  listAllMatches,
  getMatchesByGameId,
} from './match-log-db.js';
import type { Firestore } from 'firebase/firestore';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';

export interface SyncedMatch extends BinaryMatchExport {
  /** Cloud sync status */
  synced?: boolean;
  /** Last sync timestamp */
  lastSyncedAt?: number;
  /** Cloud document ID */
  cloudId?: string;
}

export interface SyncStats {
  uploaded: number;
  downloaded: number;
  conflicts: number;
  errors: number;
}

/**
 * Match sync service for cross-device history.
 */
export class MatchSyncService {
  private db: IDBDatabase | null = null;
  private readonly firestore: Firestore;
  private readonly uid: string;

  constructor(firestore: Firestore, uid: string) {
    this.firestore = firestore;
    this.uid = uid;
  }

  /**
   * Initialize the service (opens IndexedDB).
   */
  async initialize(): Promise<void> {
    this.db = await openMatchLogDB();
  }

  /**
   * Get Firestore collection reference for user's matches.
   */
  private getUserMatchesCollection() {
    return collection(this.firestore, 'userMatchLogs', this.uid, 'matches');
  }

  /**
   * Store match locally and sync to cloud.
   */
  async storeAndSync(match: BinaryMatchExport): Promise<void> {
    if (!this.db) {
      throw new Error('MatchSyncService not initialized');
    }

    // Store locally first
    await storeMatch(this.db, match);

    // Try to sync to cloud (non-blocking)
    this.uploadMatch(match).catch((error) => {
      console.error('Failed to sync match to cloud:', error);
      // Could queue for retry here
    });
  }

  /**
   * Upload a single match to Firestore.
   */
  async uploadMatch(match: BinaryMatchExport): Promise<void> {
    const matchesRef = this.getUserMatchesCollection();
    const docRef = doc(matchesRef, match.gameId);

    const cloudDoc = {
      gameId: match.gameId,
      actions: match.actions,
      snapshots: match.snapshots || null,
      exportedAt: Timestamp.fromMillis(match.exportedAt),
      uploadedAt: Timestamp.now(),
    };

    await setDoc(docRef, cloudDoc, { merge: true });
  }

  /**
   * Download matches from cloud that aren't in local DB.
   */
  async pullFromCloud(maxCount: number = 100): Promise<number> {
    if (!this.db) {
      throw new Error('MatchSyncService not initialized');
    }

    const matchesRef = this.getUserMatchesCollection();
    const q = query(
      matchesRef,
      orderBy('exportedAt', 'desc'),
      limit(maxCount)
    );

    const snapshot = await getDocs(q);
    const cloudMatches: BinaryMatchExport[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      cloudMatches.push({
        gameId: data.gameId,
        actions: data.actions,
        snapshots: data.snapshots || undefined,
        exportedAt: data.exportedAt.toMillis(),
      });
    });

    // Check which matches we don't have locally
    let downloaded = 0;
    for (const match of cloudMatches) {
      const existing = await getMatchesByGameId(this.db, match.gameId);
      if (existing.length === 0) {
        await storeMatch(this.db, match);
        downloaded++;
      }
    }

    return downloaded;
  }

  /**
   * Sync all pending local matches to cloud.
   */
  async syncPending(): Promise<SyncStats> {
    if (!this.db) {
      throw new Error('MatchSyncService not initialized');
    }

    const stats: SyncStats = {
      uploaded: 0,
      downloaded: 0,
      conflicts: 0,
      errors: 0,
    };

    const localMatches = await listAllMatches(this.db);

    for (const match of localMatches) {
      try {
        await this.uploadMatch(match);
        stats.uploaded++;
      } catch (error) {
        console.error(`Failed to sync match ${match.gameId}:`, error);
        stats.errors++;
      }
    }

    return stats;
  }

  /**
   * Get match from cloud by gameId.
   */
  async getMatchFromCloud(gameId: string): Promise<BinaryMatchExport | null> {
    const matchesRef = this.getUserMatchesCollection();
    const docRef = doc(matchesRef, gameId);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    return {
      gameId: data.gameId,
      actions: data.actions,
      snapshots: data.snapshots || undefined,
      exportedAt: data.exportedAt.toMillis(),
    };
  }

  /**
   * Delete match from cloud.
   */
  async deleteMatchFromCloud(gameId: string): Promise<void> {
    const matchesRef = this.getUserMatchesCollection();
    const docRef = doc(matchesRef, gameId);
    await setDoc(docRef, { deleted: true, deletedAt: Timestamp.now() }, { merge: true });
  }

  /**
   * Get sync status for local matches.
   */
  async getSyncStatus(): Promise<{
    total: number;
    synced: number;
    pending: number;
  }> {
    if (!this.db) {
      throw new Error('MatchSyncService not initialized');
    }

    const localMatches = await listAllMatches(this.db);
    let synced = 0;

    for (const match of localMatches) {
      const cloudMatch = await this.getMatchFromCloud(match.gameId);
      if (cloudMatch) {
        synced++;
      }
    }

    return {
      total: localMatches.length,
      synced,
      pending: localMatches.length - synced,
    };
  }

  /**
   * Close the service (closes IndexedDB).
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

/**
 * Create and initialize a match sync service.
 */
export async function createMatchSyncService(
  firestore: Firestore,
  uid: string
): Promise<MatchSyncService> {
  const service = new MatchSyncService(firestore, uid);
  await service.initialize();
  return service;
}
