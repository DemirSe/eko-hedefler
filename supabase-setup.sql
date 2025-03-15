-- Create a table for user progress
CREATE TABLE IF NOT EXISTS user_progress (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_goals JSONB NOT NULL DEFAULT '[]'::jsonb,
  points INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create a table for daily tasks
CREATE TABLE IF NOT EXISTS daily_tasks (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  task_text TEXT NOT NULL,
  category TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 5,
  completed BOOLEAN NOT NULL DEFAULT false,
  date_assigned DATE NOT NULL DEFAULT CURRENT_DATE,
  date_completed TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '1 day')
);

-- Add index on user_id and date for faster queries
CREATE INDEX IF NOT EXISTS daily_tasks_user_date_idx ON daily_tasks(user_id, date_assigned);

-- Add row level security policies
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read only their own data
CREATE POLICY "Users can read their own progress" 
  ON user_progress 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own data
CREATE POLICY "Users can insert their own progress" 
  ON user_progress 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own data
CREATE POLICY "Users can update their own progress" 
  ON user_progress 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create policies for daily tasks
CREATE POLICY "Users can read their own daily tasks" 
  ON daily_tasks 
  FOR SELECT 
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own daily tasks" 
  ON daily_tasks 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their own daily tasks" 
  ON daily_tasks 
  FOR UPDATE 
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can delete their own daily tasks" 
  ON daily_tasks 
  FOR DELETE 
  USING (auth.uid() = user_id OR user_id IS NULL); 