/**
 * Eko Hedef İzleyici - JavaScript
 * This file contains the JavaScript code for the Eco Goal Tracker application.
 */

import { auth, supabase } from './supabase.js';

// Check if user is authenticated
async function checkAuth() {
  try {
    const user = await auth.getCurrentUser();
    
    // If no user is found but we have user data in localStorage,
    // this likely means the session expired or cookies were cleared
    if (!user && localStorage.getItem('user') !== null) {
      console.log('User session expired but localStorage data exists - clearing user data');
      localStorage.removeItem('user');
    }
    
    if (user) {
      // Validate that the session is active by making a simple auth-required request
      const { error } = await supabase.from('user_progress').select('count').limit(1);
      
      if (error && (error.code === 'PGRST301' || error.status === 401)) {
        console.warn('Session token appears to be invalid, attempting to refresh...');
        
        // Try to refresh the session
        const { error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('Failed to refresh session:', refreshError);
          // Session is invalid and couldn't be refreshed, sign out
          await handleLogout(); // Use our comprehensive logout function
          return null;
        }
        
        // Session refreshed, get updated user
        return await auth.getCurrentUser();
      }
    }
    
    // Return the user (or null) without redirecting
    return user;
  } catch (error) {
    console.error('Error checking authentication:', error);
    return null;
  }
}

// Application data
const categories = {
  electricity: {
    name: "Elektrik Tasarrufu",
    icon: "⚡",
    goals: [
      { text: "Kullanılmayan odaların ışıklarını kapatmak", points: 5 },
      { text: "Enerji verimli LED ampuller kullanmak", points: 10 },
      { text: "Elektronik cihazları bekleme modunda bırakmamak", points: 5 },
      { text: "Çamaşır makinesini tam doluyken çalıştırmak", points: 8 }
    ]
  },
  water: {
    name: "Su Tasarrufu",
    icon: "💧",
    goals: [
      { text: "Diş fırçalarken musluğu kapatmak", points: 5 },
      { text: "Duş süresini 5 dakika ile sınırlamak", points: 10 },
      { text: "Su sızıntılarını tamir etmek", points: 15 },
      { text: "Yağmur suyu biriktirmek", points: 20 }
    ]
  },
  waste: {
    name: "Atık Yönetimi",
    icon: "♻️",
    goals: [
      { text: "Çöpleri ayrıştırmak", points: 10 },
      { text: "Tek kullanımlık plastik kullanımını azaltmak", points: 15 },
      { text: "Kompost yapmak", points: 20 },
      { text: "Alışverişte bez torba kullanmak", points: 5 }
    ]
  },
  energy: {
    name: "Enerji Verimliliği",
    icon: "🔋",
    goals: [
      { text: "Doğal havalandırma kullanmak", points: 5 },
      { text: "Klimayı optimum sıcaklıkta kullanmak", points: 10 },
      { text: "Yalıtım önlemleri almak", points: 20 },
      { text: "Güneş enerjisi kullanmak", points: 25 }
    ]
  }
};

// Sample daily tasks that can be assigned
const dailyTaskTemplates = [
  { category: "electricity", text: "Bugün en az 1 saat ışıkları kapatın", points: 5 },
  { category: "electricity", text: "Bekleme modundaki cihazları fişten çekin", points: 8 },
  { category: "electricity", text: "Bilgisayarınızı enerji tasarrufu modunda kullanın", points: 5 },
  { category: "water", text: "Bugün kısa duş alın (5 dakikadan az)", points: 10 },
  { category: "water", text: "Su tasarrufu için musluk başlıklarını kontrol edin", points: 5 },
  { category: "water", text: "Suyu yeniden kullanma yöntemleri araştırın", points: 5 },
  { category: "waste", text: "Bugün geri dönüşüm yapın", points: 8 },
  { category: "waste", text: "Tek kullanımlık ürün kullanmamaya çalışın", points: 10 },
  { category: "waste", text: "Atık azaltma planı yapın", points: 5 },
  { category: "energy", text: "Bugün klimayı 1 saat daha az çalıştırın", points: 8 },
  { category: "energy", text: "Enerji verimliliği yüksek bir elektrikli ev aleti araştırın", points: 5 },
  { category: "energy", text: "Güneş enerjisinden nasıl faydalanabileceğinizi araştırın", points: 5 }
];

let completedGoals = new Set();
let totalPoints = 0;
let dailyTasks = [];
const maxPoints = Object.values(categories).reduce((sum, category) => 
  sum + category.goals.reduce((catSum, goal) => catSum + goal.points, 0), 0);

// DOM Elements
let elements = {};

// Storage Keys
const STORAGE_KEYS = {
  COMPLETED_GOALS: 'ecoGoalsCompleted',
  POINTS: 'ecoGoalsPoints',
  LAST_UPDATED: 'ecoGoalsLastUpdated',
  DAILY_TASKS: 'ecoDailyTasks'
};

/**
 * Initialize the application
 */
async function initApp() {
  try {
    // Cache DOM elements for future use
    elements = {
      categoriesContainer: document.getElementById('categories-container'),
      progressFill: document.getElementById('progressFill'),
      totalPoints: document.getElementById('totalPoints'),
      progressContainer: document.querySelector('.progress-container'),
      progressPercentage: document.getElementById('progressPercentage')
    };
    
    // Make sure we can access these elements
    if (!elements.categoriesContainer || !elements.progressFill || !elements.totalPoints) {
      console.error('Required DOM elements not found');
      showNotification('Uygulamayı başlatmak için gerekli elementler bulunamadı.', 'error');
      return;
    }
    
    // Check if user is authenticated, but don't force redirect
    const user = await checkAuth();
    
    // Add user info or login/register buttons to the header
    const headerElement = document.querySelector('.app-header');
    
    // First, remove any existing user-info elements to prevent duplicates
    const existingUserInfo = headerElement.querySelector('.user-info');
    if (existingUserInfo) {
      existingUserInfo.remove();
    }
    
    const userInfoDiv = document.createElement('div');
    userInfoDiv.className = 'user-info';
    
    if (user) {
      // User is logged in - show welcome and logout button
      userInfoDiv.innerHTML = `
        <span>Merhaba, ${user.email}</span>
        <button id="logout-btn" class="btn-small">Çıkış Yap</button>
      `;
      // Add logout functionality
      headerElement.appendChild(userInfoDiv);
      document.getElementById('logout-btn').addEventListener('click', async () => {
        // Perform a proper logout that clears all data
        await handleLogout();
      });
      
      // Check if there's a merge prompt to show after login
      if (sessionStorage.getItem('show_merge_prompt') === 'true') {
        showMergePrompt();
      }
    } else {
      // User is not logged in - show login/register buttons
      userInfoDiv.innerHTML = `
        <button id="login-btn" class="btn-small">Giriş Yap</button>
        <button id="register-btn" class="btn-small">Kaydol</button>
      `;
      headerElement.appendChild(userInfoDiv);
      
      // Add login and register button functionality
      document.getElementById('login-btn').addEventListener('click', () => {
        window.location.href = 'login.html';
      });
      
      document.getElementById('register-btn').addEventListener('click', () => {
        window.location.href = 'signup.html';
      });
    }
    
    // Set up event listeners for the application
    setupEventListeners();
    
    // Load user progress data (goals, points, etc.)
    await loadUserProgress();
    
    // Load daily tasks
    await loadDailyTasks();
    
    // Render the UI
    renderCategories();
    updateProgress();
    
    // Update last sync time display
    displayLastUpdated();
    
    // Clean up any stale local data
    cleanupStaleData();
    
    // Add a class to the body to indicate the app is initialized
    document.body.classList.add('app-initialized');
    
  } catch (error) {
    console.error('Error initializing app:', error);
    showNotification('Uygulama başlatılırken bir hata oluştu. Lütfen sayfayı yenileyin.', 'error');
  }
}

/**
 * Setup event listeners for the application
 */
function setupEventListeners() {
  // Set up filter buttons
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Remove active class from all buttons
      filterBtns.forEach(b => b.classList.remove('active'));
      // Add active class to clicked button
      e.target.classList.add('active');
      // Apply the filter
      applyFilter(e.target.dataset.filter);
    });
  });
  
  // Daily tasks refresh button
  const refreshTasksBtn = document.getElementById('refresh-tasks');
  refreshTasksBtn.addEventListener('click', refreshDailyTasks);
  
  // Theme toggle
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    });
  }
  
  // Scroll to top button
  const scrollToTopBtn = document.getElementById('scrollToTop');
  if (scrollToTopBtn) {
    scrollToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    // Show/hide scroll to top button based on scroll position
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        scrollToTopBtn.classList.add('visible');
      } else {
        scrollToTopBtn.classList.remove('visible');
      }
    });
  }
  
  // Pull to refresh on mobile
  const pullIndicator = document.getElementById('pullIndicator');
  let startY = 0;
  let pullDistance = 0;
  const REFRESH_THRESHOLD = 100;
  let isPulling = false;
  let isRefreshing = false;
  
  // Add touch events only on mobile devices
  if (window.matchMedia('(max-width: 768px)').matches) {
    document.addEventListener('touchstart', (e) => {
      // Only enable pull to refresh if at the top of the page
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    }, { passive: true });
    
    document.addEventListener('touchmove', (e) => {
      if (!isPulling || isRefreshing) return;
      
      const currentY = e.touches[0].clientY;
      pullDistance = currentY - startY;
      
      if (pullDistance > 0 && window.scrollY === 0) {
        // Pull down detected at the top of the page
        pullIndicator.style.transform = `translateY(${Math.min(pullDistance * 0.5, REFRESH_THRESHOLD)}px)`;
        pullIndicator.classList.add('visible');
        
        if (pullDistance > REFRESH_THRESHOLD) {
          pullIndicator.textContent = 'Yenilemek için bırakın';
        } else {
          pullIndicator.textContent = 'Yenilemek için çekin';
        }
        
        // Prevent default scrolling when pulling down
        e.preventDefault();
      }
    }, { passive: false });
    
    document.addEventListener('touchend', async () => {
      if (!isPulling || isRefreshing) return;
      
      if (pullDistance > REFRESH_THRESHOLD) {
        // Pull distance exceeded threshold, trigger refresh
        isRefreshing = true;
        pullIndicator.textContent = 'Yenileniyor...';
        pullIndicator.classList.add('refreshing');
        
        // Reload app data
        try {
          await loadUserProgress();
          await loadDailyTasks();
          renderCategories();
          updateProgress();
          showNotification('Veriler güncellendi');
        } catch (error) {
          console.error('Pull to refresh error:', error);
          showNotification('Yenileme sırasında bir hata oluştu', 'error');
        }
        
        // Reset after a delay
        setTimeout(() => {
          isRefreshing = false;
          pullIndicator.classList.remove('refreshing');
          pullIndicator.classList.remove('visible');
          pullIndicator.style.transform = 'translateY(-100%)';
        }, 1000);
      } else {
        // Pull distance did not exceed threshold, reset
        pullIndicator.classList.remove('visible');
        pullIndicator.style.transform = 'translateY(-100%)';
      }
      
      isPulling = false;
      pullDistance = 0;
    }, { passive: true });
  }
}

/**
 * Save the user's progress to Supabase
 * @returns {boolean} Whether the save was successful
 */
async function saveUserProgress() {
  try {
    // If user is not authenticated, save to localStorage instead
    const user = await checkAuth();
    if (!user) {
      return saveToLocalStorage();
    }
    
    const userId = user.id;
    
    // Convert Set to Array for storage
    const completedGoalsArray = Array.from(completedGoals);
    
    // Calculate total points from completed goals and daily tasks
    let calculatedPoints = 0;
    
    // Add points from completed goals
    completedGoalsArray.forEach(goalId => {
      const [categoryId, ...goalTextParts] = goalId.split('-');
      const goalText = goalTextParts.join('-');
      const goal = categories[categoryId]?.goals.find(g => g.text === goalText);
      if (goal) {
        calculatedPoints += goal.points;
      }
    });
    
    // Add points from completed daily tasks
    if (dailyTasks && dailyTasks.length > 0) {
      dailyTasks.forEach(task => {
        if (task.completed) {
          calculatedPoints += task.points;
        }
      });
    }
    
    // Update the total points
    totalPoints = calculatedPoints;
    
    // Save user progress to Supabase
    const { data, error } = await supabase
      .from('user_progress')
      .upsert({
        user_id: userId,
        completed_goals: completedGoalsArray,
        points: totalPoints,
        last_updated: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select();
    
    if (error) {
      console.error('Error saving user progress:', error);
      throw error;
    }
    
    // Show a success notification if we inserted/updated
    if (data) {
      updateProgress();
      displayLastUpdated(new Date());
    }
    
    return true;
  } catch (error) {
    console.error('Error in saveUserProgress:', error);
    return false;
  }
}

/**
 * Save progress to local storage (fallback option)
 */
function saveToLocalStorage() {
  try {
    const completedGoalsArray = Array.from(completedGoals);
    localStorage.setItem(STORAGE_KEYS.COMPLETED_GOALS, JSON.stringify(completedGoalsArray));
    localStorage.setItem(STORAGE_KEYS.POINTS, totalPoints.toString());
    
    // Save last update time
    localStorage.setItem(STORAGE_KEYS.LAST_UPDATED, new Date().toISOString());
    
    // Update last updated display
    displayLastUpdated();
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

/**
 * Load user progress from Supabase or localStorage
 * @returns {boolean} Whether the load was successful
 */
async function loadUserProgress() {
  try {
    // Get the current authenticated user
    const user = await checkAuth();
    
    if (user) {
      // User is authenticated, load from Supabase
      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        // If no data found for this user, that's not really an error
        if (error.code === 'PGRST116') {
          console.log('No saved progress found for user, starting fresh');
          completedGoals = new Set();
          totalPoints = 0;
          return true;
        }
        
        console.error('Error loading user progress:', error);
        throw error;
      }
      
      if (data) {
        // Load data from Supabase
        completedGoals = new Set(data.completed_goals || []);
        
        // Calculate points from completed daily tasks
        let dailyTasksPoints = 0;
        if (dailyTasks && dailyTasks.length > 0) {
          dailyTasks.forEach(task => {
            if (task.completed) {
              dailyTasksPoints += task.points;
            }
          });
        }
        
        // Calculate points from completed goals
        let completedGoalsPoints = 0;
        completedGoals.forEach(goalId => {
          const [categoryId, ...goalTextParts] = goalId.split('-');
          const goalText = goalTextParts.join('-');
          const goal = categories[categoryId]?.goals.find(g => g.text === goalText);
          if (goal) {
            completedGoalsPoints += goal.points;
          }
        });
        
        // Update total points
        totalPoints = completedGoalsPoints + dailyTasksPoints;
        
        // Update UI
        displayLastUpdated(new Date(data.last_updated));
        return true;
      }
    } else {
      // User is not authenticated, load from localStorage
      return loadFromLocalStorage();
    }
    
    return false;
  } catch (error) {
    console.error('Error in loadUserProgress:', error);
    
    // Fallback to localStorage
    return loadFromLocalStorage();
  }
}

/**
 * Load progress from local storage (fallback option)
 */
function loadFromLocalStorage() {
  try {
    // First check if we're in a non-authenticated state but have user data in localStorage
    // This could happen if the user manually cleared cookies or the session expired
    const wasLoggedIn = localStorage.getItem('user') !== null;
    const isLoggedIn = false; // If we're calling this function, we're not logged in
    
    // If the user was logged in (has user data) but is no longer logged in (session expired),
    // we should clear the localStorage data to prevent seeing another user's goals
    if (wasLoggedIn && !isLoggedIn) {
      console.log('User was previously logged in but session expired - clearing localStorage data');
      localStorage.removeItem(STORAGE_KEYS.COMPLETED_GOALS);
      localStorage.removeItem(STORAGE_KEYS.POINTS);
      localStorage.removeItem(STORAGE_KEYS.LAST_UPDATED);
      localStorage.removeItem('user');
      
      // Initialize empty state
      completedGoals = new Set();
      totalPoints = 0;
      return false;
    }
    
    // Normal flow for anonymous users
    const savedGoals = JSON.parse(localStorage.getItem(STORAGE_KEYS.COMPLETED_GOALS) || '[]');
    
    completedGoals = new Set(savedGoals);
    totalPoints = parseInt(localStorage.getItem(STORAGE_KEYS.POINTS) || '0', 10);
    
    // Display last updated time if available
    displayLastUpdated();
    
    // Update UI after loading the data
    updateUI();
    
    return true;
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    // Could add a user notification here
    return false;
  }
}

/**
 * Display the last updated timestamp
 */
function displayLastUpdated() {
  const lastUpdated = localStorage.getItem(STORAGE_KEYS.LAST_UPDATED);
  
  if (lastUpdated) {
    const lastUpdatedDate = new Date(lastUpdated);
    const dateOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    };
    const timeStr = lastUpdatedDate.toLocaleDateString('tr-TR', dateOptions);
    
    // Remove existing last-updated element if it exists
    const existingStatus = document.querySelector('.last-updated');
    if (existingStatus) {
      existingStatus.remove();
    }
    
    const statusEl = document.createElement('div');
    statusEl.className = 'last-updated';
    statusEl.innerHTML = `<small>Son güncelleme: ${timeStr}</small>`;
    
    // Make sure elements.progressContainer is available
    if (elements.progressContainer) {
      elements.progressContainer.appendChild(statusEl);
    } else {
      // Fallback to direct DOM query if elements cache isn't available
      const progressContainer = document.querySelector('.progress-container');
      if (progressContainer) {
        progressContainer.appendChild(statusEl);
      }
    }
  }
}

/**
 * Render all categories and their goals
 */
function renderCategories() {
  // First make sure we have the elements object properly initialized
  if (!elements.categoriesContainer) {
    // Try to initialize it now
    elements.categoriesContainer = document.getElementById('categories-container');
    
    // If still not available, log error and return
    if (!elements.categoriesContainer) {
      console.error('Categories container not found');
      return;
    }
  }

  elements.categoriesContainer.innerHTML = '';

  Object.entries(categories).forEach(([categoryId, category]) => {
    const categoryElement = createCategoryElement(categoryId, category);
    elements.categoriesContainer.appendChild(categoryElement);
  });
}

function createCategoryElement(categoryId, category) {
  const categoryElement = document.createElement('div');
  categoryElement.className = 'category expanded';
  
  const completedGoalsInCategory = category.goals.filter(goal => 
    completedGoals.has(`${categoryId}-${goal.text}`)
  ).length;
  
  const categoryProgress = Math.round((completedGoalsInCategory / category.goals.length) * 100);
  
  categoryElement.innerHTML = `
    <div class="category-header">
      <div class="category-title">
        ${category.icon} ${category.name}
      </div>
      <div class="category-progress">
        ${completedGoalsInCategory}/${category.goals.length} (${categoryProgress}%)
      </div>
    </div>
    <div class="category-content">
      ${category.goals.map(goal => createGoalItem(categoryId, goal)).join('')}
    </div>
  `;
  
  return categoryElement;
}

function createGoalItem(categoryId, goal) {
  const goalId = `${categoryId}-${goal.text}`;
  const isCompleted = completedGoals.has(goalId);
  
  return `
    <div class="goal-item" data-goal-id="${goalId}">
      <span class="goal-text ${isCompleted ? 'completed' : ''}">${goal.text}</span>
      <div class="goal-actions">
        <span class="points-badge">${goal.points} Puan</span>
        <button class="toggle-button ${isCompleted ? 'completed' : ''}">
          ${isCompleted ? 'Geri Al' : 'Tamamla'}
        </button>
      </div>
    </div>
  `;
}

/**
 * Toggle a goal completion status
 * @param {string} categoryId - The category ID
 * @param {string} goalText - The goal text
 */
async function toggleGoal(categoryId, goalText) {
  const goalId = `${categoryId}-${goalText}`;
  const goal = categories[categoryId].goals.find(g => g.text === goalText);
  
  if (completedGoals.has(goalId)) {
    completedGoals.delete(goalId);
    totalPoints -= goal.points;
  } else {
    completedGoals.add(goalId);
    totalPoints += goal.points;
  }
  
  // Update UI
  updateUI();
  
  // Save progress (works for both authenticated and non-authenticated users)
  await saveUserProgress();
}

// Make toggleGoal accessible globally
window.toggleGoal = toggleGoal;

function updateUI() {
  const container = document.getElementById('categories-container');
  container.innerHTML = '';
  
  // Create and append category elements
  Object.entries(categories).forEach(([categoryId, category]) => {
    const categoryElement = createCategoryElement(categoryId, category);
    container.appendChild(categoryElement);
  });
  
  // Update progress and points
  document.getElementById('totalPoints').textContent = totalPoints;
  const progressPercentage = (totalPoints / maxPoints) * 100;
  document.getElementById('progressFill').style.width = `${progressPercentage}%`;
  
  // Update progress percentage text
  const progressPercentageElement = document.getElementById('progressPercentage');
  if (progressPercentageElement) {
    progressPercentageElement.textContent = `${Math.round(progressPercentage)}%`;
  }
  
  // Reapply current filter
  const activeFilter = document.querySelector('.filter-btn.active');
  if (activeFilter) {
    applyFilter(activeFilter.dataset.filter);
  }
}

/**
 * Toggle goal completion from DOM elements
 * @param {HTMLElement} li - The list item element
 * @param {HTMLElement} span - The text span element
 * @param {HTMLElement} button - The button element
 */
async function toggleGoalCompletion(li, span, button) {
  const goalId = li.dataset.goalId;
  const goal = categories[goalId.split('-')[0]].goals.find(g => g.text === goalId.split('-')[1]);
  
  if (completedGoals.has(goalId)) {
    completedGoals.delete(goalId);
    totalPoints -= goal.points;
    span.classList.remove('completed');
    button.textContent = 'Tamamla';
  } else {
    completedGoals.add(goalId);
    totalPoints += goal.points;
    span.classList.add('completed');
    button.textContent = 'Geri Al';
  }
  
  updateProgress();
  
  // Save progress (works for both authenticated and non-authenticated users)
  await saveUserProgress();
}

/**
 * Update progress and points
 */
function updateProgress() {
  // Get all goal items with the correct selector for the current DOM structure
  const allGoalItems = document.querySelectorAll('.goal-item');
  
  // Calculate total possible points and earned points
  let earnedPoints = 0;
  
  // Use the completedGoals set to calculate earned points
  completedGoals.forEach(goalId => {
    const [categoryId, ...goalTextParts] = goalId.split('-');
    const goalText = goalTextParts.join('-');
    const goal = categories[categoryId]?.goals.find(g => g.text === goalText);
    if (goal) {
      earnedPoints += goal.points;
    }
  });
  
  // Update points display in DOM
  if (elements.totalPoints) {
    elements.totalPoints.textContent = earnedPoints;
  } else {
    // Fallback if elements cache is not initialized
    const totalPointsElement = document.getElementById('totalPoints');
    if (totalPointsElement) {
      totalPointsElement.textContent = earnedPoints;
    } else {
      console.warn('totalPoints element not found');
    }
  }
  
  // Make sure totalPoints variable is updated
  totalPoints = earnedPoints;
  
  // Update progress bar
  const percentage = maxPoints > 0 ? (earnedPoints / maxPoints) * 100 : 0;
  if (elements.progressFill) {
    elements.progressFill.style.width = percentage + '%';
  } else {
    // Fallback if elements cache is not initialized
    const progressFill = document.getElementById('progressFill');
    if (progressFill) {
      progressFill.style.width = percentage + '%';
    } else {
      console.warn('progressFill element not found');
    }
  }
  
  // Update progress percentage text if it exists
  if (elements.progressPercentage) {
    elements.progressPercentage.textContent = `${Math.round(percentage)}%`;
  } else {
    const progressPercentage = document.getElementById('progressPercentage');
    if (progressPercentage) {
      progressPercentage.textContent = `${Math.round(percentage)}%`;
    }
  }
}

// Updated apply filter function
function applyFilter(filterValue) {
  const container = document.getElementById('categories-container');
  
  // Get all goal items
  const goals = container.querySelectorAll('.goal-item');
  
  goals.forEach(goal => {
    const goalId = goal.dataset.goalId;
    const isCompleted = completedGoals.has(goalId);
    
    if (filterValue === 'all') {
      goal.style.display = 'flex';
    } else if (filterValue === 'completed' && isCompleted) {
      goal.style.display = 'flex';
    } else if (filterValue === 'incomplete' && !isCompleted) {
      goal.style.display = 'flex';
    } else {
      goal.style.display = 'none';
    }
  });
}

/**
 * Shows a prompt asking the user if they want to keep their anonymous data
 */
function showMergePrompt() {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  `;
  
  // Create modal content
  const modal = document.createElement('div');
  modal.className = 'modal-content';
  modal.style.cssText = `
    background-color: var(--container-bg);
    border-radius: 10px;
    padding: 20px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 4px 10px var(--shadow-color);
  `;
  
  // Count anonymous goals
  const tempGoals = JSON.parse(sessionStorage.getItem('temp_' + STORAGE_KEYS.COMPLETED_GOALS) || '[]');
  const tempPoints = parseInt(sessionStorage.getItem('temp_' + STORAGE_KEYS.POINTS) || '0', 10);
  
  modal.innerHTML = `
    <h3>Eski İlerlemeniz Bulundu</h3>
    <p>Önceki oturumunuzda tamamladığınız ${tempGoals.length} hedef ve kazandığınız ${tempPoints} puan tespit edildi.</p>
    <p>Bu hedefleri hesabınıza aktarmak istiyor musunuz?</p>
    <div style="display: flex; justify-content: space-between; margin-top: 20px;">
      <button id="discard-data" class="btn-small" style="background-color: #e74c3c; color: white;">Hayır, Yeni Başla</button>
      <button id="merge-data" class="btn-small" style="background-color: var(--primary-green); color: white;">Evet, Aktar</button>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Handle button clicks
  document.getElementById('discard-data').addEventListener('click', () => {
    // Discard temporary data and close modal
    discardAnonymousData();
    overlay.remove();
  });
  
  document.getElementById('merge-data').addEventListener('click', async () => {
    // Merge anonymous data with account data
    await mergeAnonymousData();
    overlay.remove();
  });
}

/**
 * Discards anonymous user data
 */
function discardAnonymousData() {
  // Clear all temporary data
  sessionStorage.removeItem('temp_' + STORAGE_KEYS.COMPLETED_GOALS);
  sessionStorage.removeItem('temp_' + STORAGE_KEYS.POINTS);
  sessionStorage.removeItem('temp_' + STORAGE_KEYS.LAST_UPDATED);
  sessionStorage.removeItem('show_merge_prompt');
  
  // Load user data from Supabase
  loadUserProgress();
}

/**
 * Merges anonymous user data with account data
 */
async function mergeAnonymousData() {
  try {
    // Get temporary data
    const tempGoalsStr = sessionStorage.getItem('temp_' + STORAGE_KEYS.COMPLETED_GOALS);
    
    if (tempGoalsStr) {
      const tempGoals = JSON.parse(tempGoalsStr);
      
      // Add temporary goals to the current set
      tempGoals.forEach(goalId => completedGoals.add(goalId));
      
      // Update UI
      renderCategories();
      updateProgress();
      
      // Save the merged data to Supabase
      await saveUserProgress();
      
      // Show success message
      showNotification('Hedefleriniz başarıyla aktarıldı!', 'success');
    }
    
    // Clear temporary data
    sessionStorage.removeItem('temp_' + STORAGE_KEYS.COMPLETED_GOALS);
    sessionStorage.removeItem('temp_' + STORAGE_KEYS.POINTS);
    sessionStorage.removeItem('temp_' + STORAGE_KEYS.LAST_UPDATED);
    sessionStorage.removeItem('show_merge_prompt');
  } catch (error) {
    console.error('Error merging anonymous data:', error);
    showNotification('Hedefler aktarılırken bir hata oluştu.', 'error');
  }
}

/**
 * Shows a notification message
 * @param {string} message - The message to display
 * @param {string} type - The type of notification ('success' or 'error')
 */
function showNotification(message, type = 'success') {
  try {
    if (!message) {
      console.warn('Empty notification message');
      message = 'Notification';
    }
    
    // Add styles for animations if they don't exist yet
    if (!document.getElementById('notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        
        @keyframes fadeOut {
          from { opacity: 1; transform: translate(-50%, 0); }
          to { opacity: 0; transform: translate(-50%, 20px); }
        }
      `;
      document.head.appendChild(style);
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 20px;
      border-radius: 5px;
      color: white;
      font-weight: bold;
      z-index: 1000;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      animation: fadeIn 0.3s, fadeOut 0.3s 3.7s;
    `;
    
    if (type === 'success') {
      notification.style.backgroundColor = 'var(--primary-green, #2ecc71)';
    } else {
      notification.style.backgroundColor = '#e74c3c';
    }
    
    document.body.appendChild(notification);
    
    // Remove notification after 4 seconds
    setTimeout(() => {
      if (notification && notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 4000);
  } catch (error) {
    // Last resort if notification system fails
    console.error('Failed to show notification:', error);
    console.error('Notification message was:', message);
    
    // Try to show an alert if everything else fails
    try {
      if (type === 'error') {
        alert('Error: ' + message);
      }
    } catch (e) {
      // Nothing more we can do
    }
  }
}

/**
 * Handle user logout
 */
async function handleLogout() {
  try {
    // Sign out from Supabase
    await supabase.auth.signOut();
    
    // Clear all user-related data from localStorage
    localStorage.removeItem('user');
    localStorage.removeItem(STORAGE_KEYS.COMPLETED_GOALS);
    localStorage.removeItem(STORAGE_KEYS.POINTS);
    localStorage.removeItem(STORAGE_KEYS.LAST_UPDATED);
    localStorage.removeItem(STORAGE_KEYS.DAILY_TASKS);
    
    // Reset application state
    completedGoals = new Set();
    totalPoints = 0;
    dailyTasks = [];
    
    // Clear UI and re-render for a guest user
    renderCategories();
    renderDailyTasks();
    updateProgress();
    
    // Refresh the page to ensure clean state
    window.location.reload();
  } catch (error) {
    console.error('Error during logout:', error);
    showNotification('Çıkış yapılırken bir hata oluştu.', 'error');
  }
}

/**
 * Clean up any stale data that might exist from previous sessions
 */
function cleanupStaleData() {
  // Check if we have user data in localStorage but no valid Supabase session
  const hasUserData = localStorage.getItem('user') !== null;
  
  // We'll check for a valid session by looking for the Supabase auth cookie
  // This is a simple check that doesn't make an API call
  const hasSupabaseCookie = document.cookie.includes('sb-') || 
                            document.cookie.includes('supabase-auth');
  
  if (hasUserData && !hasSupabaseCookie) {
    console.log('Found stale user data without valid session cookie - clearing localStorage data');
    
    // Clear all user-related localStorage data
    localStorage.removeItem(STORAGE_KEYS.COMPLETED_GOALS);
    localStorage.removeItem(STORAGE_KEYS.POINTS);
    localStorage.removeItem(STORAGE_KEYS.LAST_UPDATED);
    localStorage.removeItem('user');
  }
}

/**
 * Load the user's daily tasks
 */
async function loadDailyTasks() {
  try {
    const user = await checkAuth();
    
    if (user) {
      // User is authenticated, load tasks from the database
      const { data, error } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('user_id', user.id)
        .gte('expires_at', new Date().toISOString())
        .order('date_assigned', { ascending: false });
      
      if (error) {
        console.error('Error loading daily tasks:', error);
        throw error;
      }
      
      if (data && data.length > 0) {
        dailyTasks = data;
      } else {
        // No active tasks, generate new ones
        dailyTasks = await generateDailyTasks(user.id);
      }
    } else {
      // User is not authenticated, load from localStorage
      const storedTasks = localStorage.getItem(STORAGE_KEYS.DAILY_TASKS);
      
      if (storedTasks) {
        dailyTasks = JSON.parse(storedTasks);
        
        // Filter out expired tasks
        const now = new Date();
        dailyTasks = dailyTasks.filter(task => new Date(task.expires_at) > now);
        
        // If all tasks expired, generate new ones
        if (dailyTasks.length === 0) {
          dailyTasks = generateDailyTasksForAnonymousUser();
          localStorage.setItem(STORAGE_KEYS.DAILY_TASKS, JSON.stringify(dailyTasks));
        }
      } else {
        // No stored tasks, generate new ones
        dailyTasks = generateDailyTasksForAnonymousUser();
        localStorage.setItem(STORAGE_KEYS.DAILY_TASKS, JSON.stringify(dailyTasks));
      }
    }
    
    // Display the tasks
    renderDailyTasks();
    
  } catch (error) {
    console.error('Error in loadDailyTasks:', error);
    showNotification('Günlük görevler yüklenirken bir hata oluştu.', 'error');
  }
}

/**
 * Generate random daily tasks for a user
 * @param {string} userId - The user ID
 * @returns {Array} - The generated tasks
 */
async function generateDailyTasks(userId) {
  try {
    // Select 3 random tasks from the templates
    const selectedTasks = getRandomTasks(dailyTaskTemplates, 3);
    
    // Create the tasks in the database
    const tasks = [];
    
    for (const template of selectedTasks) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 1); // Tasks expire after 1 day
      
      const newTask = {
        user_id: userId,
        task_text: template.text,
        category: template.category,
        points: template.points,
        completed: false,
        date_assigned: new Date().toISOString(),
        expires_at: expiryDate.toISOString()
      };
      
      // Insert the task into the database
      const { data, error } = await supabase.from('daily_tasks').insert(newTask).select();
      
      if (error) {
        console.error('Error creating daily task:', error);
      } else if (data) {
        tasks.push(data[0]);
      }
    }
    
    return tasks;
  } catch (error) {
    console.error('Error generating daily tasks:', error);
    return [];
  }
}

/**
 * Generate random daily tasks for anonymous users
 * @returns {Array} - The generated tasks
 */
function generateDailyTasksForAnonymousUser() {
  try {
    // Select 3 random tasks from the templates
    const selectedTasks = getRandomTasks(dailyTaskTemplates, 3);
    
    // Create the tasks
    const tasks = [];
    
    for (const template of selectedTasks) {
      if (!template || !template.category || (!template.text && !template.task_text)) {
        console.warn('Invalid task template:', template);
        continue;
      }
      
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 1); // Tasks expire after 1 day
      
      const newTask = {
        id: Date.now() + Math.floor(Math.random() * 1000), // Generate a unique ID
        user_id: null,
        task_text: template.text || template.task_text,
        category: template.category,
        points: template.points || 5,
        completed: false,
        date_assigned: new Date().toISOString(),
        expires_at: expiryDate.toISOString()
      };
      
      tasks.push(newTask);
    }
    
    return tasks;
  } catch (error) {
    console.error('Error generating tasks for anonymous user:', error);
    return [];
  }
}

/**
 * Select random items from an array
 * @param {Array} array - The array to select from
 * @param {number} count - Number of items to select
 * @returns {Array} - Selected items
 */
function getRandomTasks(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * Render the daily tasks in the UI
 */
function renderDailyTasks() {
  try {
    const tasksList = document.getElementById('daily-tasks-list');
    if (!tasksList) {
      console.error('daily-tasks-list element not found');
      return;
    }
    
    const emptyMessage = document.getElementById('emptyTasksMessage');
    if (!emptyMessage) {
      console.warn('emptyTasksMessage element not found, creating it');
      const newEmptyMessage = document.createElement('div');
      newEmptyMessage.id = 'emptyTasksMessage';
      newEmptyMessage.className = 'empty-tasks-message';
      newEmptyMessage.textContent = 'Bugün için günlük görev bulunmuyor. Yeni görevler almak için \'Yenile\' düğmesine tıklayın.';
      tasksList.appendChild(newEmptyMessage);
    }
    
    // Clear the current tasks
    tasksList.innerHTML = '';
    
    if (!dailyTasks || dailyTasks.length === 0) {
      // Show the empty message
      emptyMessage.style.display = 'block';
      tasksList.appendChild(emptyMessage);
      return;
    }
    
    // Hide the empty message
    if (emptyMessage) {
      emptyMessage.style.display = 'none';
    }
    
    // Add each task to the list
    dailyTasks.forEach(task => {
      const taskItem = document.createElement('div');
      taskItem.className = `daily-task-item ${task.completed ? 'completed-task' : ''}`;
      taskItem.dataset.taskId = task.id;
      
      const categoryIcon = getCategoryIcon(task.category);
      const expiryTime = getExpiryTimeString(task.expires_at);
      
      taskItem.innerHTML = `
        <div class="daily-task-info">
          <div class="daily-task-text">${task.text || task.task_text}</div>
          <div class="daily-task-meta">
            <div class="daily-task-category">
              <i>${categoryIcon}</i> ${getCategoryName(task.category)}
            </div>
            <div class="daily-task-expiry">${expiryTime}</div>
          </div>
        </div>
        <div class="daily-task-actions">
          <span class="task-points-badge">${task.points} Puan</span>
          <button class="complete-task-btn" ${task.completed ? 'disabled' : ''}>
            ${task.completed ? 'Tamamlandı' : 'Tamamla'}
          </button>
        </div>
      `;
      
      // Add event listener for completing the task
      const completeBtn = taskItem.querySelector('.complete-task-btn');
      if (!task.completed && completeBtn) {
        completeBtn.addEventListener('click', () => {
          completeTask(task.id);
        });
      }
      
      tasksList.appendChild(taskItem);
    });
    
    // Add "Add Custom Task" button
    const addCustomBtn = document.createElement('button');
    addCustomBtn.className = 'add-custom-task-btn';
    addCustomBtn.textContent = '+ Özel Günlük Görev Ekle';
    addCustomBtn.addEventListener('click', showAddTaskModal);
    
    tasksList.appendChild(addCustomBtn);
  } catch (error) {
    console.error('Error rendering daily tasks:', error);
    showNotification('Günlük görevler görüntülenirken bir hata oluştu.', 'error');
  }
}

/**
 * Get the icon for a category
 * @param {string} categoryId - The category ID
 * @returns {string} - The icon
 */
function getCategoryIcon(categoryId) {
  return categories[categoryId] ? categories[categoryId].icon : '📝';
}

/**
 * Get the name for a category
 * @param {string} categoryId - The category ID
 * @returns {string} - The name
 */
function getCategoryName(categoryId) {
  return categories[categoryId] ? categories[categoryId].name : 'Diğer';
}

/**
 * Get a friendly string showing when the task expires
 * @param {string} expiryDateString - ISO date string
 * @returns {string} - Friendly expiry time
 */
function getExpiryTimeString(expiryDateString) {
  const expiryDate = new Date(expiryDateString);
  const now = new Date();
  
  const hoursLeft = Math.round((expiryDate - now) / (1000 * 60 * 60));
  
  if (hoursLeft < 1) {
    return 'Son 1 saat';
  } else if (hoursLeft < 24) {
    return `${hoursLeft} saat kaldı`;
  } else {
    return 'Yarın sona erecek';
  }
}

/**
 * Complete a daily task
 * @param {number} taskId - The task ID
 */
async function completeTask(taskId) {
  try {
    const user = await checkAuth();
    const taskIndex = dailyTasks.findIndex(task => task.id === taskId);
    
    if (taskIndex === -1) {
      console.error('Task not found:', taskId);
      return;
    }
    
    // Update the task in our local array
    dailyTasks[taskIndex].completed = true;
    dailyTasks[taskIndex].date_completed = new Date().toISOString();
    
    // Add points
    totalPoints += dailyTasks[taskIndex].points;
    
    if (user) {
      // User is authenticated, update the database
      const { error } = await supabase
        .from('daily_tasks')
        .update({
          completed: true,
          date_completed: new Date().toISOString()
        })
        .eq('id', taskId);
      
      if (error) {
        console.error('Error updating task:', error);
        showNotification('Görev güncellenirken bir hata oluştu.', 'error');
        return;
      }
      
      // Update user's points
      await saveUserProgress();
    } else {
      // User is not authenticated, save to localStorage
      localStorage.setItem(STORAGE_KEYS.DAILY_TASKS, JSON.stringify(dailyTasks));
      localStorage.setItem(STORAGE_KEYS.POINTS, totalPoints.toString());
    }
    
    // Update the UI
    renderDailyTasks();
    updateProgress();
    
    showNotification(`Tebrikler! ${dailyTasks[taskIndex].points} puan kazandınız.`);
  } catch (error) {
    console.error('Error completing task:', error);
    showNotification('Görev tamamlanırken bir hata oluştu.', 'error');
  }
}

/**
 * Show the add task modal
 */
function showAddTaskModal() {
  try {
    const modal = document.getElementById('add-task-modal');
    if (!modal) {
      console.error('add-task-modal element not found');
      showNotification('Modal bulunamadı, lütfen sayfayı yenileyin.', 'error');
      return;
    }
    
    modal.style.display = 'block';
    
    // Close when clicking the X
    const closeBtn = modal.querySelector('.close-modal');
    if (closeBtn) {
      closeBtn.onclick = () => {
        modal.style.display = 'none';
      };
    }
    
    // Close when clicking outside the modal
    window.onclick = (event) => {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    };
    
    // Handle form submission
    const form = document.getElementById('add-task-form');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        addCustomTask();
      };
    } else {
      console.error('add-task-form element not found');
      showNotification('Form bulunamadı, lütfen sayfayı yenileyin.', 'error');
    }
  } catch (error) {
    console.error('Error showing add task modal:', error);
    showNotification('Görev ekleme penceresi açılırken bir hata oluştu.', 'error');
  }
}

/**
 * Add a custom daily task
 */
async function addCustomTask() {
  try {
    const taskText = document.getElementById('task-text').value.trim();
    const category = document.getElementById('task-category').value;
    const points = parseInt(document.getElementById('task-points').value);
    
    if (!taskText || !category || isNaN(points)) {
      showNotification('Lütfen tüm alanları doldurun.', 'error');
      return;
    }
    
    const user = await checkAuth();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 1);
    
    const newTask = {
      task_text: taskText,
      category: category,
      points: points,
      completed: false,
      date_assigned: new Date().toISOString(),
      expires_at: expiryDate.toISOString()
    };
    
    if (user) {
      // User is authenticated, add to database
      newTask.user_id = user.id;
      
      const { data, error } = await supabase.from('daily_tasks').insert(newTask).select();
      
      if (error) {
        console.error('Error adding custom task:', error);
        showNotification('Görev eklenirken bir hata oluştu.', 'error');
        return;
      }
      
      if (data) {
        dailyTasks.push(data[0]);
      }
    } else {
      // User is not authenticated, add to localStorage
      newTask.id = Date.now() + Math.floor(Math.random() * 1000);
      newTask.user_id = null;
      
      dailyTasks.push(newTask);
      localStorage.setItem(STORAGE_KEYS.DAILY_TASKS, JSON.stringify(dailyTasks));
    }
    
    // Close the modal
    document.getElementById('add-task-modal').style.display = 'none';
    
    // Reset the form
    document.getElementById('add-task-form').reset();
    
    // Update the UI
    renderDailyTasks();
    
    showNotification('Yeni günlük görev eklendi.');
  } catch (error) {
    console.error('Error adding custom task:', error);
    showNotification('Görev eklenirken bir hata oluştu.', 'error');
  }
}

/**
 * Refresh daily tasks
 */
async function refreshDailyTasks() {
  try {
    const user = await checkAuth();
    
    if (user) {
      // Clear existing tasks in the database
      await supabase
        .from('daily_tasks')
        .delete()
        .eq('user_id', user.id)
        .gte('expires_at', new Date().toISOString());
      
      // Generate new tasks
      dailyTasks = await generateDailyTasks(user.id);
    } else {
      // User is not authenticated, generate new tasks for localStorage
      dailyTasks = generateDailyTasksForAnonymousUser();
      localStorage.setItem(STORAGE_KEYS.DAILY_TASKS, JSON.stringify(dailyTasks));
    }
    
    // Update the UI
    renderDailyTasks();
    
    showNotification('Günlük görevler yenilendi.');
  } catch (error) {
    console.error('Error refreshing daily tasks:', error);
    showNotification('Görevler yenilenirken bir hata oluştu.', 'error');
  }
}

// Export functions for use in other modules
export {
  initApp,
  checkAuth,
  loadUserProgress,
  saveUserProgress,
  loadDailyTasks,
  renderDailyTasks,
  refreshDailyTasks,
  handleLogout,
  showNotification
} 