/**
 * Safely gets an item from localStorage with error handling
 * @param {string} key - The key to retrieve
 * @param {any} defaultValue - Default value if item doesn't exist
 * @returns {any} The parsed item or defaultValue
 */
export const getStorageItem = (key, defaultValue = null) => {
  if (typeof window === 'undefined') {
    return defaultValue;
  }
  
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error getting item from localStorage (${key}):`, error);
    return defaultValue;
  }
};

/**
 * Safely sets an item in localStorage with error handling
 * @param {string} key - The key to set
 * @param {any} value - The value to store (will be JSON stringified)
 * @returns {boolean} Success status
 */
export const setStorageItem = (key, value) => {
  if (typeof window === 'undefined') {
    return false;
  }
  
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error setting item in localStorage (${key}):`, error);
    return false;
  }
};

/**
 * Safely removes an item from localStorage with error handling
 * @param {string} key - The key to remove
 * @returns {boolean} Success status
 */
export const removeStorageItem = (key) => {
  if (typeof window === 'undefined') {
    return false;
  }
  
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Error removing item from localStorage (${key}):`, error);
    return false;
  }
};

/**
 * Clears all items in localStorage with a specific prefix
 * @param {string} prefix - The prefix to match
 * @returns {number} Number of items cleared
 */
export const clearStorageItemsWithPrefix = (prefix) => {
  if (typeof window === 'undefined') {
    return 0;
  }
  
  try {
    let count = 0;
    Object.keys(window.localStorage).forEach(key => {
      if (key.startsWith(prefix)) {
        window.localStorage.removeItem(key);
        count++;
      }
    });
    return count;
  } catch (error) {
    console.error(`Error clearing localStorage items with prefix (${prefix}):`, error);
    return 0;
  }
}; 