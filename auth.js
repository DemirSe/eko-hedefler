import { auth } from './supabase.js';

// Theme toggle functionality
document.addEventListener('DOMContentLoaded', () => {
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  
  // Initialize theme based on local storage or system preference
  const currentTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  themeToggleBtn.textContent = currentTheme === 'light' ? '🌙' : '☀️';
  
  // Toggle theme on button click
  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    themeToggleBtn.textContent = newTheme === 'light' ? '🌙' : '☀️';
  });
  
  // Handle Google login button click
  const googleLoginBtn = document.getElementById('google-login-btn');
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
      const errorMessage = document.getElementById('error-message');
      
      try {
        const { data, error } = await auth.signInWithGoogle();
        
        if (error) {
          throw error;
        }
        
        // Redirect happens automatically after Google auth
      } catch (error) {
        errorMessage.textContent = error.message || 'Giriş yapılırken bir hata oluştu.';
        errorMessage.style.display = 'block';
      }
    });
  }
  
  // Check for redirect result after Google login
  const checkRedirectResult = async () => {
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
      try {
        const { data, error } = await auth.getRedirectResult();
        
        if (error) {
          throw error;
        }
        
        if (data && data.user) {
          // Store user info in local storage
          localStorage.setItem('user', JSON.stringify(data.user));
          
          // Redirect to the main app
          window.location.href = 'index.html';
        }
      } catch (error) {
        errorMessage.textContent = error.message || 'Giriş yapılırken bir hata oluştu.';
        errorMessage.style.display = 'block';
      }
    }
  };
  
  // Check for redirect result when page loads
  checkRedirectResult();
}); 