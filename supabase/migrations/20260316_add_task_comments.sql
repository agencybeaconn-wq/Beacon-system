-- Migration: Add comments system for tasks/demands
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by task
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);

-- RLS policies
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on tasks they can access" ON task_comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert comments" ON task_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON task_comments
  FOR DELETE USING (auth.uid() = user_id);
