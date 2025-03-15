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

-- Create a table for global daily tasks (shared across all users)
CREATE TABLE IF NOT EXISTS global_daily_tasks (
  id SERIAL PRIMARY KEY,
  task_text TEXT NOT NULL,
  category TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 5,
  task_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Create a table for user task completions
CREATE TABLE IF NOT EXISTS user_task_completions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES global_daily_tasks(id) ON DELETE CASCADE,
  task_date DATE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, task_id, task_date)
);

-- Add index on user_id and date for faster queries
CREATE INDEX IF NOT EXISTS daily_tasks_user_date_idx ON daily_tasks(user_id, date_assigned);
CREATE INDEX IF NOT EXISTS global_tasks_date_idx ON global_daily_tasks(task_date);
CREATE INDEX IF NOT EXISTS user_completions_idx ON user_task_completions(user_id, task_date);

-- Add row level security policies
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_task_completions ENABLE ROW LEVEL SECURITY;

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

-- Create policies for global daily tasks
CREATE POLICY "Anyone can read global daily tasks" 
  ON global_daily_tasks 
  FOR SELECT 
  TO authenticated, anon
  USING (true);

-- Only allow admin users to insert, update, or delete global tasks
-- In this case, let any authenticated user create global tasks (this would be restricted in a real application)
CREATE POLICY "Only admin can insert global daily tasks" 
  ON global_daily_tasks 
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- Create policies for user task completions
CREATE POLICY "Users can read their own task completions" 
  ON user_task_completions 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own task completions" 
  ON user_task_completions 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own task completions" 
  ON user_task_completions 
  FOR UPDATE 
  USING (auth.uid() = user_id); 
