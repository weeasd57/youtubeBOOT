import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAccounts } from './AccountContext';
import { fetchDriveFoldersWithCache, fetchDriveFilesWithCache } from '@/utils/driveHelpers';

// Create context
const MultiDriveContext = createContext();

export function MultiDriveProvider({ children }) {
  const [drivesInfo, setDrivesInfo] = useState({});
  const [loadingDrives, setLoadingDrives] = useState({});
  const [errors, setErrors] = useState({});
  const { accounts } = useAccounts();
  const prevAccountIds = useRef(null);

  // Keep track of fetch requests to prevent duplicates
  const pendingFetches = useRef(new Map());

  // Fetch drive info for a specific account
  const fetchDriveInfo = useCallback(async (accountId, forceRefresh = false) => {
    if (!accountId || loadingDrives[accountId]) return;
    
    // Check if there's already a pending fetch for this account
    if (!forceRefresh && pendingFetches.current.has(accountId)) {
      console.log(`Existing fetch pending for account ${accountId}, waiting...`);
      try {
        return await pendingFetches.current.get(accountId);
      } catch (error) {
        console.error('Error waiting for pending fetch:', error);
      }
    }

    setLoadingDrives(prev => ({ ...prev, [accountId]: true }));
    setErrors(prev => ({ ...prev, [accountId]: null }));

    const fetchPromise = (async () => {
      try {
        console.log(`Fetching drive info for account: ${accountId}${forceRefresh ? ' (force refresh)' : ''}`);
        
        const result = await fetchDriveFoldersWithCache({
          forceRefresh: forceRefresh,
          accountId: accountId,
          onFolderCheck: () => {}
        });
        
        if (result.success) {
          setDrivesInfo(prev => {
            // Ensure accountInfo is an object with folders and files initialized as arrays from the start
            const accountInfo = {
              folders: [],
              files: [],
              ...(prev[accountId] || {}), // Merge with existing properties, handling null/undefined prev[accountId]
            };

            const oldFolders = Array.isArray(accountInfo.folders) ? accountInfo.folders : []; // Ensure oldFolders is an array
            const newFolders = result.folders || [];

            const foldersChanged =
              oldFolders.length !== newFolders.length ||
              newFolders.some((newFolder, index) => {
                const oldFolder = oldFolders[index];
                return !oldFolder || oldFolder.id !== newFolder.id || oldFolder.name !== newFolder.name;
              });

            if (!foldersChanged) {
              console.log(`Folders for account ${accountId} are identical, skipping state update.`);
              return prev; // Return previous state to prevent re-render
            }

            return {
              ...prev,
              [accountId]: {
                ...accountInfo,
                folders: newFolders,
                status: 'connected',
                lastUpdated: new Date().toISOString()
              }
            };
          });
        } else {
          // If the request was successful but returned no folders, initialize with empty arrays
          setDrivesInfo(prev => ({
            ...prev,
            [accountId]: {
              folders: [],
              files: [], // Initialize files as empty array too, for consistency
              status: 'no_data',
              lastUpdated: new Date().toISOString()
            }
          }));
          
          // Set error if available
          if (result.error) {
            setErrors(prev => ({ ...prev, [accountId]: result.error }));
          }
        }

        return result;
      } catch (error) {
        console.error(`Error fetching drive info for account ${accountId}:`, error);
        setErrors(prev => ({ 
          ...prev, 
          [accountId]: error.message || 'An unexpected error occurred' 
        }));
        throw error;
      } finally {
        setLoadingDrives(prev => ({ ...prev, [accountId]: false }));
        pendingFetches.current.delete(accountId);
      }
    })();

    // Store the promise for deduplication
    pendingFetches.current.set(accountId, fetchPromise);

    return fetchPromise;
  }, [loadingDrives]);

  // Fetch files for a specific drive (account)
  const fetchDriveFiles = useCallback(async (accountId, forceRefresh = false) => {
    if (!accountId || loadingDrives[accountId]) return;
    
    setLoadingDrives(prev => ({ ...prev, [accountId]: true }));
    
    try {
      console.log(`Fetching drive files for account: ${accountId}${forceRefresh ? ' (force refresh)' : ''}`);
      
      const result = await fetchDriveFilesWithCache({
        forceRefresh,
        accountId,
        folderId: null // Get all files from root
      });
      
      if (result.success) {
        console.log(`Drive files response for account ${accountId}:`, result);
        
        setDrivesInfo(prev => {
          // Ensure accountInfo is an object with folders and files initialized as arrays from the start
          const accountInfo = {
            folders: [],
            files: [],
            ...(prev[accountId] || {}), // Merge with existing properties, handling null/undefined prev[accountId]
          };

          const oldFiles = Array.isArray(accountInfo.files) ? accountInfo.files : []; // Ensure oldFiles is an array
          const newFiles = result.files || [];

          const filesChanged =
            oldFiles.length !== newFiles.length ||
            newFiles.some((newFile, index) => {
              const oldFile = oldFiles[index];
              return !oldFile || oldFile.id !== newFile.id || oldFile.name !== newFile.name;
            });
          
          if (!filesChanged) {
            console.log(`Files for account ${accountId} are identical, skipping state update.`);
            return prev; // Return previous state to prevent re-render
          }

          return {
            ...prev,
            [accountId]: {
              ...accountInfo,
              files: newFiles,
              status: 'connected',
              lastUpdated: new Date().toISOString()
            }
          };
        });
      } else {
        // If the request was not successful, or returned no files, initialize with empty arrays
        setDrivesInfo(prev => ({
          ...prev,
          [accountId]: {
            folders: Array.isArray((prev[accountId] || {}).folders) ? (prev[accountId] || {}).folders : [],
            files: [],
            status: 'no_data',
            lastUpdated: new Date().toISOString()
          }
        }));
        setErrors(prev => ({ 
          ...prev, 
          [accountId]: result.error || 'Failed to fetch drive files' 
        }));
      }
    } catch (error) {
      console.error(`Error fetching drive files for account ${accountId}:`, error);
      setErrors(prev => ({ 
        ...prev, 
        [accountId]: error.message || 'An unexpected error occurred' 
      }));
    } finally {
      setLoadingDrives(prev => ({ ...prev, [accountId]: false }));
    }
  }, [loadingDrives]);

  // Optimized refreshDrive function
  const refreshDrive = useCallback((accountId, force = false) => {
    if (!accountId) return;
    
    const lastUpdate = drivesInfo[accountId]?.lastUpdated;
    const now = Date.now();
    const minRefreshInterval = 5000; // 5 seconds between refreshes
    
    if (!force && lastUpdate) {
      const timeSinceLastUpdate = now - new Date(lastUpdate).getTime();
      if (timeSinceLastUpdate < minRefreshInterval) {
        console.log(`Refresh for account ${accountId} throttled. Last update was ${timeSinceLastUpdate}ms ago.`);
        return;
      }
    }
    
    return fetchDriveInfo(accountId, force);
  }, [drivesInfo, fetchDriveInfo]);

  // Fetch all drives when accounts change
  useEffect(() => {
    if (accounts && accounts.length > 0) {
      // تجنب الاستدعاءات المتكررة باستخدام وقت تأخير وفحص التغييرات الفعلية
      const currentAccountIds = accounts.map(acc => acc.id).sort().join(',');
      
      // تحقق من وجود تغيير فعلي في الحسابات
      if (prevAccountIds.current === currentAccountIds) {
        console.log('No change in accounts list, skipping redundant drive info fetch');
        return;
      }
      
      // تحديث قائمة الحسابات السابقة
      prevAccountIds.current = currentAccountIds;
      
      // تأخير استدعاء الحسابات المتعددة لتجنب العديد من الطلبات المتزامنة
      accounts.forEach((account, index) => {
        // Only fetch if we don't already have info for this account
        if (!drivesInfo[account.id] && !loadingDrives[account.id]) {
          // تأخير متزايد لكل حساب
          setTimeout(() => {
            console.log(`Delayed fetch for account ${account.id} (${index + 1}/${accounts.length})`);
            fetchDriveInfo(account.id);
          }, index * 2000); // 2 second delay between each account
        }
      });
    }
  }, [accounts, drivesInfo, loadingDrives, fetchDriveInfo]);
  
  // Optimized account switching: no full state reset
  useEffect(() => {
    const handleAccountSwitch = (e) => {
      if (e.key === 'accountSwitched' && e.newValue === 'true') {
        console.log('Account switch detected in MultiDriveContext - optimized refresh');
        localStorage.removeItem('accountSwitched');

        if (accounts?.[0]?.id) {
          // تحديث مخصص للحساب الحالي فقط
          fetchDriveInfo(accounts[0].id, true);
          setTimeout(() => fetchDriveFiles(accounts[0].id, true), 500);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleAccountSwitch);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleAccountSwitch);
      }
    };
  }, [accounts]);

  // Function to refresh all drives
  const refreshAllDrives = () => {
    if (accounts && accounts.length > 0) {
      // تحقق من وقت آخر تحديث شامل
      const lastGlobalUpdate = localStorage.getItem('lastGlobalDriveUpdate');
      const now = Date.now();
      const minGlobalRefreshInterval = 60000; // دقيقة واحدة على الأقل بين التحديثات الشاملة
      
      if (lastGlobalUpdate) {
        const timeSinceLastUpdate = now - parseInt(lastGlobalUpdate);
        if (timeSinceLastUpdate < minGlobalRefreshInterval) {
          console.log(`Global refresh throttled. Last update was ${timeSinceLastUpdate}ms ago.`);
          return; // تجاهل طلب التحديث الشامل إذا كان حديثًا جدًا
        }
      }
      
      // تسجيل وقت التحديث الشامل
      localStorage.setItem('lastGlobalDriveUpdate', now.toString());
      
      // جدولة التحديثات بتأخير متزايد
      accounts.forEach((account, index) => {
        setTimeout(() => {
          console.log(`Scheduled refresh for account ${account.id} (${index + 1}/${accounts.length})`);
          fetchDriveInfo(account.id, true);
          
          // تأخير إضافي لطلب الملفات
          setTimeout(() => {
            fetchDriveFiles(account.id, true);
          }, 1000);
          
        }, index * 3000); // 3 ثوانٍ لكل حساب
      });
    }
  };

  return (
    <MultiDriveContext.Provider
      value={{
        drivesInfo,
        loadingDrives,
        errors,
        refreshDrive,
        refreshAllDrives,
        fetchDriveFiles
      }}
    >
      {children}
    </MultiDriveContext.Provider>
  );
}

// Custom hook to use the context
export function useMultiDrive() {
  const context = useContext(MultiDriveContext);
  if (context === undefined) {
    throw new Error('useMultiDrive must be used within a MultiDriveProvider');
  }
  return context;
}