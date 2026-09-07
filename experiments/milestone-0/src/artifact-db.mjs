import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export function openArtifactExperimentDb(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) throw new Error('database path is required');
  mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  const db = new DatabaseSync(path.resolve(filePath));
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      phase TEXT NOT NULL,
      state TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content_location TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      size INTEGER NOT NULL,
      sealed_at TEXT NOT NULL,
      FOREIGN KEY(run_id) REFERENCES runs(id)
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      UNIQUE(run_id, sequence),
      FOREIGN KEY(run_id) REFERENCES runs(id)
    );
    CREATE TABLE IF NOT EXISTS review_decisions (
      run_id TEXT PRIMARY KEY,
      decision TEXT NOT NULL,
      change_package_artifact_id TEXT NOT NULL,
      change_package_sha256 TEXT NOT NULL,
      FOREIGN KEY(run_id) REFERENCES runs(id)
    );
  `);
  return db;
}

export function withImmediateTransaction(db, operation) {
  if (!db || typeof db.exec !== 'function') throw new Error('database handle is required');
  if (typeof operation !== 'function') throw new Error('transaction operation must be a function');
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}
