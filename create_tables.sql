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

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS global_tasks_date_idx ON global_daily_tasks(task_date);
CREATE INDEX IF NOT EXISTS user_completions_idx ON user_task_completions(user_id, task_date);

-- Add row level security
ALTER TABLE global_daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_task_completions ENABLE ROW LEVEL SECURITY;

-- Create policies for global daily tasks
CREATE POLICY "Anyone can read global daily tasks" 
  ON global_daily_tasks 
  FOR SELECT 
  TO authenticated, anon
  USING (true);

-- Only allow admin users to insert, update, or delete global tasks
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