import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4/+esm'

// Replace with your Supabase URL and anon key
const supabaseUrl = 'https://gjpqcphyvvsnvghqmsyw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcHFjcGh5dnZzbnZnaHFtc3l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4OTM5MDYsImV4cCI6MjA1NzQ2OTkwNn0.UsaVCJje6v7S3mbPNUUEpdlIBACGStPYx2s0Hs5wnX8'

// Initialize the Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey)

// Auth helper functions
export const auth = {
  // Get current user
  getCurrentUser: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },
  
  // Sign up
  signUp: async (username, password) => {
    // Generate a fake email using the username for Supabase auth
    const email = `${username}@example.com`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username,
          email_confirmed: true
        }
      }
    })
    return { data, error }
  },
  
  // Sign in
  signIn: async (username, password) => {
    // Generate a fake email using the username for Supabase auth
    const email = `${username}@example.com`;
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  },
  
  // Sign out
  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  },
  
  // We don't need resetPassword for username-based auth, but keeping a stub
  resetPassword: async (email) => {
    return { error: { message: 'Password reset not available for username-based authentication' } }
  }
} 