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
  
  // Handle login form submission
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const errorMessage = document.getElementById('error-message');
      
      try {
        console.log('Attempting login with:', { email, password: '******' });
        const { data, error } = await auth.signIn(email, password);
        
        if (error) {
          console.error('Login error details:', error);
          throw error;
        }
        
        // Store user info in local storage
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Redirect to the main app
        window.location.href = 'index.html';
      } catch (error) {
        console.error('Full error object:', error);
        errorMessage.textContent = `Error: ${error.message}` || 'Giriş yapılırken bir hata oluştu.';
        errorMessage.style.display = 'block';
      }
    });
  }
  
  // Handle signup form submission
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirm-password').value;
      const errorMessage = document.getElementById('error-message');
      const successMessage = document.getElementById('success-message');
      
      // Reset messages
      errorMessage.style.display = 'none';
      successMessage.style.display = 'none';
      
      // Validate passwords match
      if (password !== confirmPassword) {
        errorMessage.textContent = 'Şifreler eşleşmiyor.';
        errorMessage.style.display = 'block';
        return;
      }
      
      try {
        console.log('Attempting signup with:', { email, password: '******' });
        const { data, error } = await auth.signUp(email, password);
        
        if (error) {
          console.error('Signup error details:', error);
          throw error;
        }
        
        console.log('Signup successful:', data);
        
        // Show success message
        successMessage.textContent = 'Kaydınız başarıyla oluşturuldu! Hemen giriş yapabilirsiniz.';
        successMessage.style.display = 'block';
        
        // Clear form
        signupForm.reset();
        
        // Add redirect to login page after a short delay
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 2000);
      } catch (error) {
        console.error('Full signup error:', error);
        errorMessage.textContent = `Error: ${error.message}` || 'Kayıt olurken bir hata oluştu.';
        errorMessage.style.display = 'block';
      }
    });
  }
  
  // Handle forgot password link
  const forgotPasswordLink = document.getElementById('forgot-password');
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const errorMessage = document.getElementById('error-message');
      
      if (!email) {
        errorMessage.textContent = 'Lütfen e-posta adresinizi giriniz.';
        errorMessage.style.display = 'block';
        return;
      }
      
      try {
        const { error } = await auth.resetPassword(email);
        
        if (error) {
          throw error;
        }
        
        // Show success message
        errorMessage.textContent = 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.';
        errorMessage.style.display = 'block';
        errorMessage.style.color = '#27ae60';
        errorMessage.style.backgroundColor = 'rgba(46, 204, 113, 0.1)';
      } catch (error) {
        errorMessage.textContent = error.message || 'Şifre sıfırlama bağlantısı gönderilirken bir hata oluştu.';
        errorMessage.style.display = 'block';
      }
    });
  }
}); 