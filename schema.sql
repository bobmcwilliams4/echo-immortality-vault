-- Immortality Vault D1 Schema v1.0
-- 7 tables for digital consciousness preservation

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    tier TEXT DEFAULT 'free',
    consciousness_score REAL DEFAULT 0,
    total_memories INTEGER DEFAULT 0,
    total_interviews INTEGER DEFAULT 0,
    voice_clone_status TEXT DEFAULT 'none',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    emotion TEXT,
    importance INTEGER DEFAULT 5,
    source TEXT DEFAULT 'manual',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS interviews (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    question_id TEXT,
    question TEXT NOT NULL,
    answer TEXT,
    emotion TEXT,
    category TEXT,
    session_type TEXT,
    follow_ups TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS family_members (
    id TEXT PRIMARY KEY,
    vault_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    relationship TEXT,
    birth_date TEXT,
    death_date TEXT,
    bio TEXT,
    photo_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (vault_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS voice_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT DEFAULT 'elevenlabs',
    voice_id TEXT,
    clone_status TEXT DEFAULT 'pending',
    sample_count INTEGER DEFAULT 0,
    quality_score REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    achievement_type TEXT NOT NULL,
    title TEXT,
    description TEXT,
    points INTEGER DEFAULT 0,
    unlocked_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    ancestor_id TEXT,
    message_count INTEGER DEFAULT 0,
    last_message TEXT,
    started_at TEXT DEFAULT (datetime('now')),
    ended_at TEXT
);

-- Video recordings for biometric capture
CREATE TABLE IF NOT EXISTS video_recordings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    interview_id TEXT,
    question_id TEXT,
    r2_key TEXT NOT NULL,
    duration_seconds REAL,
    file_size INTEGER,
    mime_type TEXT DEFAULT 'video/mp4',
    camera_facing TEXT DEFAULT 'front',
    biometric_status TEXT DEFAULT 'pending',
    transcription TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Biometric capture data (face mesh, emotion, lip sync, mannerisms, body pose)
CREATE TABLE IF NOT EXISTS biometric_captures (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    capture_type TEXT NOT NULL,
    data_json TEXT NOT NULL,
    confidence REAL DEFAULT 0,
    frame_start INTEGER,
    frame_end INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (video_id) REFERENCES video_recordings(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(user_id, category);
CREATE INDEX IF NOT EXISTS idx_interviews_user ON interviews(user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_category ON interviews(user_id, category);
CREATE INDEX IF NOT EXISTS idx_family_vault ON family_members(vault_user_id);
CREATE INDEX IF NOT EXISTS idx_voice_user ON voice_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_video_user ON video_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_video_interview ON video_recordings(interview_id);
CREATE INDEX IF NOT EXISTS idx_biometric_video ON biometric_captures(video_id);
CREATE INDEX IF NOT EXISTS idx_biometric_user ON biometric_captures(user_id);
