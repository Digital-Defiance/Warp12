/**
 * IndexedDB Storage Layer for Binary Match Logs
 * 
 * Stores thousands of matches locally with efficient binary format.
 * Supports CRUD operations and query by various criteria.
 * 
 * Schema:
 * - Database: warp12-matches
 * - Store: matches
 * - Indexes: gameId, exportedAt, playerIds
 * 
 * @example
 * ```typescript
 * const db = await openMatchLogDB();
 * 
 * // Store a match
 * await storeMatch(db, exportedLog);
 * 
 * // Retrieve by gameId
 * const match = await getMatch(db, 'match-123');
 * 
 * // List recent matches
 * const recent = await listRecentMatches(db, 10);
 * 
 * // Delete old matches
 * await deleteMatch(db, 'match-123');
 * ```
 */

import type { BinaryMatchExport } from '../game/match-log-binary.js';

const DB_NAME = 'warp12-matches';
const DB_VERSION = 1;
const STORE_NAME = 'matches';

export interface StoredMatch extends BinaryMatchExport {
  /** Internal DB key (auto-increment) */
  id?: number;
}

/**
 * Open or create the IndexedDB database.
 */
export function openMatchLogDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store with auto-incrementing key
      const store = db.createObjectStore(STORE_NAME, {
        keyPath: 'id',
        autoIncrement: true,
      });

      // Indexes for efficient queries
      store.createIndex('gameId', 'gameId', { unique: false });
      store.createIndex('exportedAt', 'exportedAt', { unique: false });
      
      // Note: Cannot directly index arrays, so we'll use manual filtering for playerIds
    };
  });
}

/**
 * Store a binary match log.
 */
export function storeMatch(
  db: IDBDatabase,
  match: BinaryMatchExport
): Promise<number> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(match);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as number);
  });
}

/**
 * Get a match by internal DB id.
 */
export function getMatchById(
  db: IDBDatabase,
  id: number
): Promise<StoredMatch | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Get matches by gameId (may return multiple if same gameId was logged multiple times).
 */
export function getMatchesByGameId(
  db: IDBDatabase,
  gameId: string
): Promise<StoredMatch[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('gameId');
    const request = index.getAll(gameId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * List recent matches (most recent first).
 */
export function listRecentMatches(
  db: IDBDatabase,
  limit: number = 50
): Promise<StoredMatch[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('exportedAt');
    const request = index.openCursor(null, 'prev'); // Descending order

    const results: StoredMatch[] = [];

    request.onerror = () => reject(request.error);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor && results.length < limit) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
  });
}

/**
 * List all matches (warning: may be large).
 */
export function listAllMatches(db: IDBDatabase): Promise<StoredMatch[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Find matches involving specific player(s).
 * Note: This requires scanning all matches (no index on array elements).
 */
export function findMatchesByPlayer(
  db: IDBDatabase,
  playerId: string
): Promise<StoredMatch[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.openCursor();

    const results: StoredMatch[] = [];

    request.onerror = () => reject(request.error);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const match = cursor.value as StoredMatch;
        if (match.actions.playerIds.includes(playerId)) {
          results.push(match);
        }
        cursor.continue();
      } else {
        resolve(results);
      }
    };
  });
}

/**
 * Delete a match by internal DB id.
 */
export function deleteMatch(db: IDBDatabase, id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Delete all matches by gameId.
 */
export function deleteMatchesByGameId(
  db: IDBDatabase,
  gameId: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('gameId');
    const request = index.openCursor(IDBKeyRange.only(gameId));

    let deleted = 0;

    request.onerror = () => reject(request.error);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        deleted++;
        cursor.continue();
      } else {
        resolve(deleted);
      }
    };
  });
}

/**
 * Delete old matches (older than specified date).
 */
export function deleteOldMatches(
  db: IDBDatabase,
  olderThan: Date
): Promise<number> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('exportedAt');
    const range = IDBKeyRange.upperBound(olderThan.getTime());
    const request = index.openCursor(range);

    let deleted = 0;

    request.onerror = () => reject(request.error);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        deleted++;
        cursor.continue();
      } else {
        resolve(deleted);
      }
    };
  });
}

/**
 * Get total number of stored matches.
 */
export function getMatchCount(db: IDBDatabase): Promise<number> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Clear all matches (destructive).
 */
export function clearAllMatches(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
