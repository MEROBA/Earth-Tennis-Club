-- Earth Tennis Club PostgreSQL Schema
-- Target: PostgreSQL 14+

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin');
CREATE TYPE gender_type AS ENUM ('female', 'male', 'non_binary', 'prefer_not_to_say');
CREATE TYPE court_surface AS ENUM ('hard', 'clay', 'grass', 'synthetic');
CREATE TYPE room_type AS ENUM ('direct', 'group');
CREATE TYPE invite_status AS ENUM ('proposed', 'accepted', 'rejected', 'cancelled', 'completed');
CREATE TYPE forum_category AS ENUM ('strategy', 'equipment', 'training', 'general');
CREATE TYPE match_request_status AS ENUM ('pending', 'accepted', 'rejected', 'blocked');

CREATE TABLE app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_users_email_basic CHECK (position('@' in email) > 1)
);

CREATE UNIQUE INDEX uq_app_users_email_lower ON app_users (lower(email));

CREATE TABLE member_profiles (
  user_id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  display_name VARCHAR(30) NOT NULL,
  city VARCHAR(20) NOT NULL,
  gender gender_type NOT NULL,
  age SMALLINT NOT NULL CHECK (age BETWEEN 10 AND 90),
  years_playing SMALLINT NOT NULL CHECK (years_playing BETWEEN 0 AND 70),
  preferred_surface court_surface NOT NULL,
  availability_text VARCHAR(80),
  utr NUMERIC(3,1) NOT NULL CHECK (utr >= 1.0 AND utr <= 16.5),
  ntrp NUMERIC(2,1) NOT NULL CHECK (ntrp >= 1.5 AND ntrp <= 7.0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE member_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  average_score NUMERIC(4,2) NOT NULL CHECK (average_score >= 1 AND average_score <= 7),
  utr NUMERIC(3,1) NOT NULL CHECK (utr >= 1.0 AND utr <= 16.5),
  ntrp NUMERIC(2,1) NOT NULL CHECK (ntrp >= 1.5 AND ntrp <= 7.0),
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_member_assessments_user_time ON member_assessments (user_id, created_at DESC);

CREATE TABLE match_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  recommendation_score NUMERIC(5,2),
  reason_text VARCHAR(200),
  status match_request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_match_self CHECK (requester_user_id <> target_user_id)
);

CREATE UNIQUE INDEX uq_match_request_pair_active
ON match_requests (requester_user_id, target_user_id)
WHERE status = 'pending';

CREATE INDEX idx_match_requests_target_status ON match_requests (target_user_id, status, created_at DESC);

CREATE TABLE chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type room_type NOT NULL DEFAULT 'direct',
  created_by_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chat_room_participants (
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  muted_until TIMESTAMPTZ,
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX idx_chat_room_participants_user ON chat_room_participants (user_id, joined_at DESC);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  message_text VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_chat_messages_room_time ON chat_messages (room_id, created_at DESC);

CREATE TABLE courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  city VARCHAR(20) NOT NULL,
  district VARCHAR(30),
  address VARCHAR(180) NOT NULL,
  lat NUMERIC(9,6) NOT NULL,
  lng NUMERIC(9,6) NOT NULL,
  surface court_surface NOT NULL,
  court_count SMALLINT NOT NULL CHECK (court_count BETWEEN 1 AND 100),
  has_lights BOOLEAN NOT NULL DEFAULT FALSE,
  fee_note VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_courts_city_surface ON courts (city, surface);

CREATE TABLE court_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment_text VARCHAR(180) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (court_id, user_id)
);

CREATE INDEX idx_court_reviews_court_time ON court_reviews (court_id, created_at DESC);

CREATE TABLE play_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES chat_rooms(id) ON DELETE SET NULL,
  proposer_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  invitee_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  court_id UUID REFERENCES courts(id) ON DELETE SET NULL,
  court_name VARCHAR(120) NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  note VARCHAR(200),
  status invite_status NOT NULL DEFAULT 'proposed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_invite_self CHECK (proposer_user_id <> invitee_user_id)
);

CREATE INDEX idx_play_invites_invitee_status_time ON play_invites (invitee_user_id, status, scheduled_at);

CREATE TABLE forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title VARCHAR(70) NOT NULL,
  category forum_category NOT NULL,
  content VARCHAR(500) NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_forum_posts_time ON forum_posts (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_forum_posts_category_time ON forum_posts (category, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE forum_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES forum_comments(id) ON DELETE CASCADE,
  content VARCHAR(220) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_forum_comments_post_time ON forum_comments (post_id, created_at DESC) WHERE deleted_at IS NULL;

-- Refresh token session table for rotation + reuse detection.
CREATE TABLE auth_refresh_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  session_family_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip_address INET,
  expires_at TIMESTAMPTZ NOT NULL,
  rotated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  compromised_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_refresh_user_created ON auth_refresh_sessions (user_id, created_at DESC);
CREATE INDEX idx_auth_refresh_family ON auth_refresh_sessions (session_family_id, created_at DESC);

CREATE TABLE auth_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  event_type VARCHAR(40) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_audit_user_time ON auth_audit_logs (user_id, created_at DESC);
CREATE INDEX idx_auth_audit_event_time ON auth_audit_logs (event_type, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON app_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON member_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_match_requests_updated_at
BEFORE UPDATE ON match_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_courts_updated_at
BEFORE UPDATE ON courts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_court_reviews_updated_at
BEFORE UPDATE ON court_reviews
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_play_invites_updated_at
BEFORE UPDATE ON play_invites
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_forum_posts_updated_at
BEFORE UPDATE ON forum_posts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_forum_comments_updated_at
BEFORE UPDATE ON forum_comments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
