/**
 * Eko Hedef İzleyici - JavaScript
 * This file contains the JavaScript code for the Eco Goal Tracker application.
 */

import { auth, supabase } from './supabase.js';

// Check if user is authenticated
async function checkAuth() {
  const user = await auth.getCurrentUser();
  // Return the user (or null) without redirecting
  return user;
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

let completedGoals = new Set();
let totalPoints = 0;
const maxPoints = Object.values(categories).reduce((sum, category) => 
  sum + category.goals.reduce((catSum, goal) => catSum + goal.points, 0), 0);

// DOM Elements
let elements = {};

// Storage Keys
const STORAGE_KEYS = {
  COMPLETED_GOALS: 'ecoGoalsCompleted',
  POINTS: 'ecoGoalsPoints',
  LAST_UPDATED: 'ecoGoalsLastUpdated'
};

/**
 * Initialize the application
 */
async function initApp() {
  // Check if user is authenticated, but don't force redirect
  const user = await checkAuth();
  
  // Add user info or login/register buttons to the header
  const headerElement = document.querySelector('.app-header');
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
      await auth.signOut();
      window.location.reload(); // Reload the page after logout
    });
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
  
  // Cache DOM elements
  elements = {
    categoriesContainer: document.getElementById('categories-container'),
    progressFill: document.getElementById('progressFill'),
    totalPoints: document.getElementById('totalPoints'),
    progressContainer: document.querySelector('.progress-container')
  };

  // Load saved data from Supabase or localStorage
  let dataLoaded = false;
  if (user) {
    // If logged in, try to load from Supabase
    dataLoaded = await loadUserProgress();
  } else {
    // If not logged in, only try to load from localStorage
    dataLoaded = loadFromLocalStorage();
  }
  
  // Then render categories with the loaded data
  renderCategories();
  setupEventListeners();
  updateProgress();
}

/**
 * Set up event listeners using event delegation
 */
function setupEventListeners() {
  // Event delegation for goal buttons
  elements.categoriesContainer.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button || !button.classList.contains('toggle-button')) return; // Not a toggle button click
    
    const goalItem = button.closest('.goal-item');
    if (!goalItem) return;
    
    const goalId = goalItem.dataset.goalId;
    if (!goalId) return;
    
    const [categoryId, ...goalTextParts] = goalId.split('-');
    const goalText = goalTextParts.join('-'); // In case goal text has hyphens
    
    const goal = categories[categoryId]?.goals.find(g => g.text === goalText);
    if (!goal) return;
    
    const textSpan = goalItem.querySelector('.goal-text');
    
    // Toggle goal completion
    if (completedGoals.has(goalId)) {
      completedGoals.delete(goalId);
      totalPoints -= goal.points;
      textSpan.classList.remove('completed');
      button.classList.remove('completed');
      button.textContent = 'Tamamla';
    } else {
      completedGoals.add(goalId);
      totalPoints += goal.points;
      textSpan.classList.add('completed');
      button.classList.add('completed');
      button.textContent = 'Geri Al';
    }
    
    // Update progress and save
    updateProgress();
    await saveUserProgress();
  });
}

/**
 * Save user progress to Supabase
 */
async function saveUserProgress() {
  try {
    const user = await auth.getCurrentUser();
    
    // Always store in localStorage regardless of authentication
    saveToLocalStorage();
    
    // If user is authenticated, also store in Supabase
    if (user) {
      console.log('Saving to Supabase:', { completedGoals, totalPoints });
      
      const completedGoalsArray = Array.from(completedGoals);
      
      // Recalculate totalPoints from completedGoals to ensure accuracy
      let calculatedPoints = 0;
      completedGoalsArray.forEach(goalId => {
        const [categoryId, ...goalTextParts] = goalId.split('-');
        const goalText = goalTextParts.join('-');
        const goal = categories[categoryId]?.goals.find(g => g.text === goalText);
        if (goal) {
          calculatedPoints += goal.points;
        }
      });
      
      // Use calculated points to ensure consistency
      totalPoints = calculatedPoints;
      
      const userData = {
        user_id: user.id,
        completed_goals: completedGoalsArray,
        points: totalPoints,
        last_updated: new Date().toISOString()
      };
      
      // Save to Supabase
      const { error } = await supabase
        .from('user_progress')
        .upsert(
          userData,
          { onConflict: 'user_id' }
        );
      
      if (error) {
        console.error('Error saving to Supabase:', error);
        throw error;
      }
      
      // Update points display after saving
      updateProgress();
    }
    
    // Update last updated display
    displayLastUpdated();
  } catch (error) {
    console.error('Failed to save progress:', error);
    // Fallback to localStorage only
    saveToLocalStorage();
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
 * Load user progress from Supabase
 */
async function loadUserProgress() {
  try {
    const user = await auth.getCurrentUser();
    if (!user) return false;
    
    // Try to load from Supabase
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (error) {
      console.error('Error loading from Supabase:', error);
      // Fallback to localStorage
      return loadFromLocalStorage();
    }
    
    if (data) {
      completedGoals = new Set(data.completed_goals);
      totalPoints = data.points;
      
      // Also update localStorage as backup
      localStorage.setItem(STORAGE_KEYS.COMPLETED_GOALS, JSON.stringify(data.completed_goals));
      localStorage.setItem(STORAGE_KEYS.POINTS, data.points.toString());
      localStorage.setItem(STORAGE_KEYS.LAST_UPDATED, data.last_updated);
      
      displayLastUpdated();
      
      // Update UI after loading data from Supabase
      renderCategories();
      updateProgress();
      
      return true;
    } else {
      // No data found in Supabase, try localStorage
      return loadFromLocalStorage();
    }
  } catch (error) {
    console.error('Failed to load progress from Supabase:', error);
    // Fallback to localStorage
    return loadFromLocalStorage();
  }
}

/**
 * Load progress from local storage (fallback option)
 */
function loadFromLocalStorage() {
  try {
    const savedGoals = JSON.parse(localStorage.getItem(STORAGE_KEYS.COMPLETED_GOALS) || '[]');
    
    completedGoals = new Set(savedGoals);
    totalPoints = parseInt(localStorage.getItem(STORAGE_KEYS.POINTS) || '0', 10);
    
    // Display last updated time if available
    displayLastUpdated();
    
    // Update UI after loading the data
    updateUI();
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    // Could add a user notification here
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
    elements.progressContainer.appendChild(statusEl);
  }
}

/**
 * Render all categories and their goals
 */
function renderCategories() {
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
    }
  }
  
  // Update progress percentage text if it exists
  const progressPercentage = document.getElementById('progressPercentage');
  if (progressPercentage) {
    progressPercentage.textContent = `${Math.round(percentage)}%`;
  }
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Call the async initApp function
  initApp().catch(error => {
    console.error('Error initializing app:', error);
  });
  
  // Set up theme toggle
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
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
  }
});

// Make sure our event listeners are set up for filtering with the new buttons
document.addEventListener('DOMContentLoaded', function() {
  // Add event listeners for filter buttons
  const filterButtons = document.querySelectorAll('.filter-btn');
  
  filterButtons.forEach(button => {
    button.addEventListener('click', function() {
      // Remove active class from all buttons
      filterButtons.forEach(btn => btn.classList.remove('active'));
      
      // Add active class to clicked button
      this.classList.add('active');
      
      // Apply the filter
      const filterValue = this.dataset.filter;
      applyFilter(filterValue);
    });
  });
});

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