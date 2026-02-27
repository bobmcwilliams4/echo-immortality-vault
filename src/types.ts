/** Immortality Vault — TypeScript interfaces */

export interface Env {
  DB: D1Database;
  AI_ORCHESTRATOR_URL: string;
  SHARED_BRAIN_URL: string;
  ECHO_CHAT_URL: string;
  ELEVENLABS_API_KEY: string;
  CARTESIA_API_KEY: string;
  ECHO_API_KEY: string;
  // Service bindings (Workers on same account)
  AI_ORCHESTRATOR: Fetcher;
  SHARED_BRAIN: Fetcher;
  ECHO_CHAT: Fetcher;
}

// ─── User ────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email?: string;
  tier: string;
  consciousness_score: number;
  total_memories: number;
  total_interviews: number;
  voice_clone_status: string;
  created_at: string;
  updated_at: string;
}

// ─── Memory ──────────────────────────────────────────────────────────────

export interface Memory {
  id: string;
  user_id: string;
  content: string;
  category?: string;
  emotion?: string;
  importance: number;
  source: string;
  created_at: string;
}

// ─── Interview ───────────────────────────────────────────────────────────

export interface Interview {
  id: string;
  user_id: string;
  question_id?: string;
  question: string;
  answer?: string;
  emotion?: string;
  category?: string;
  session_type?: string;
  follow_ups?: string;
  created_at: string;
}

// ─── Family ──────────────────────────────────────────────────────────────

export interface FamilyMember {
  id: string;
  vault_user_id: string;
  name: string;
  relationship?: string;
  birth_date?: string;
  death_date?: string;
  bio?: string;
  photo_url?: string;
  created_at: string;
}

// ─── Voice ───────────────────────────────────────────────────────────────

export interface VoiceProfile {
  id: string;
  user_id: string;
  provider: string;
  voice_id?: string;
  clone_status: string;
  sample_count: number;
  quality_score: number;
  created_at: string;
}

// ─── Chat ────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  emotion?: string;
  timestamp?: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  ancestor_id?: string;
  message_count: number;
  last_message?: string;
  started_at: string;
  ended_at?: string;
}

// ─── Achievement ─────────────────────────────────────────────────────────

export interface Achievement {
  id: string;
  user_id: string;
  achievement_type: string;
  title?: string;
  description?: string;
  points: number;
  unlocked_at: string;
}

// ─── Question (from Python engine, replicated in TS) ─────────────────────

export interface QuestionItem {
  question_id: string;
  text: string;
  category: string;
  depth: string;
  priority: number;
  follow_up_hints: string[];
  tags: string[];
  emotion_tone: string;
}

// ─── API payloads ────────────────────────────────────────────────────────

export interface ChatRequest {
  user_id: string;
  ancestor_id?: string;
  message: string;
  session_id?: string;
}

export interface MemoryStoreRequest {
  user_id: string;
  content: string;
  category?: string;
  emotion?: string;
  importance?: number;
}

export interface InterviewAnswerRequest {
  user_id: string;
  question_id: string;
  question: string;
  answer: string;
  category?: string;
  emotion?: string;
  session_type?: string;
}

export interface VoiceSynthRequest {
  user_id: string;
  text: string;
  voice_id?: string;
  emotion?: string;
}

export interface FamilyMemberRequest {
  vault_user_id: string;
  name: string;
  relationship?: string;
  birth_date?: string;
  death_date?: string;
  bio?: string;
  photo_url?: string;
}
