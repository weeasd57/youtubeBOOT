import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAccounts } from './AccountContext';
import { fetchDriveFoldersWithCache, fetchDriveFilesWithCache } from '@/utils/driveHelpers';

// Create context
const MultiDriveContext = createContext();

export function MultiDriveProvider({ children }) {
  const [drivesInfo, setDrivesInfo] = useState({});
  const [loadingDrives, setLoadingDrives] = useState({});
  const [errors, setErrors] = useState({});
  const { accounts } = useAccounts();
  
  // إضافة الـ useRef في أعلى المكون (خارج أي useEffect)
  const prevAccountIds = useRef(null);

  // Fetch drive info for a specific account
  const fetchDriveInfo = async (accountId, forceRefresh = false) => {
    if (!accountId || loadingDrives[accountId]) return;
    
    setLoadingDrives(prev => ({ ...prev, [accountId]: true }));
    setErrors(prev => ({ ...prev, [accountId]: null }));
    
    try {
      console.log(`Fetching drive info for account: ${accountId}${forceRefresh ? ' (force refresh)' : ''}`);
      
      const result = await fetchDriveFoldersWithCache({
        forceRefresh: forceRefresh,
        accountId: accountId,
        onFolderCheck: () => {}
      });
      
      if (result.success) {
        console.log(`Drive info response for account ${accountId}:`, result);
        
        setDrivesInfo(prev => ({ 
          ...prev, 
          [accountId]: {
            folders: result.folders || [],
            status: 'connected',
            lastUpdated: new Date().toISOString()
          }
        }));
      } else {
        // Clear existing data if the request was successful but returned no folders
        setDrivesInfo(prev => ({
          ...prev,
          [accountId]: null
        }));
        
        // Set error if available
        if (result.error) {
          setErrors(prev => ({ ...prev, [accountId]: result.error }));
        }
      }
    } catch (error) {
      console.error(`Error fetching drive info for account ${accountId}:`, error);
      setErrors(prev => ({ 
        ...prev, 
        [accountId]: error.message || 'An unexpected error occurred' 
      }));
    } finally {
      setLoadingDrives(prev => ({ ...prev, [accountId]: false }));
    }
  };

  // Fetch files for a specific drive (account)
  const fetchDriveFiles = async (accountId, forceRefresh = false) => {
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
          const currentAccountInfo = prev[accountId] || {};
          return { 
            ...prev, 
            [accountId]: {
              ...currentAccountInfo,
              files: result.files || [],
              status: 'connected',
              lastUpdated: new Date().toISOString()
            }
          };
        });
      } else {
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
  };

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
      const delay = 2000; // تأخير أولي بمقدار 2 ثانية
      
      accounts.forEach((account, index) => {
        // Only fetch if we don't already have info for this account
        if (!drivesInfo[account.id] && !loadingDrives[account.id]) {
          // تأخير متزايد لكل حساب
          setTimeout(() => {
            console.log(`Delayed fetch for account ${account.id} (${index + 1}/${accounts.length})`);
            fetchDriveInfo(account.id);
          }, delay + (index * 1500)); // زيادة 1.5 ثانية لكل حساب
        }
      });
    }
  }, [accounts]);
  
  // Listen for account switching events
  useEffect(() => {
    const handleAccountSwitch = (e) => {
      if (e.key === 'accountSwitched' && e.newValue === 'true') {
        console.log('Account switch detected in MultiDriveContext, clearing data');
        
        // تنظيف بيانات الحسابات الحالية
        setDrivesInfo({});
        setLoadingDrives({});
        setErrors({});
        
        // إعادة تعيين متغير المقارنة
        prevAccountIds.current = null;
        
        // الانتظار للحصول على الحسابات الجديدة ثم تحديث البيانات
        setTimeout(() => {
          if (accounts && accounts.length > 0) {
            console.log('Loading new account data after switch', accounts);
            const currentActiveAccount = accounts[0];
            if (currentActiveAccount) {
              fetchDriveInfo(currentActiveAccount.id, true);
              fetchDriveFiles(currentActiveAccount.id, true);
            }
          }
        }, 1000);
      }
    };
    
    // Add event listener
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleAccountSwitch);
      
      // Check if there was a recent account switch
      const accountSwitchedTimestamp = localStorage.getItem('accountSwitchedTimestamp');
      if (accountSwitchedTimestamp) {
        const timestamp = parseInt(accountSwitchedTimestamp, 10);
        const now = Date.now();
        
        // If the account was switched in the last 5 seconds
        if (now - timestamp < 5000) {
          console.log('Recent account switch detected in MultiDriveContext');
          
          // تنظيف بيانات الحسابات الحالية
          setDrivesInfo({});
          setLoadingDrives({});
          setErrors({});
          
          // إعادة تعيين متغير المقارنة
          prevAccountIds.current = null;
        }
      }
    }
    
    // Cleanup
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleAccountSwitch);
      }
    };
  }, [accounts]);

  // Function to refresh a specific drive
  const refreshDrive = (accountId) => {
    if (accountId) {
      // تجنب التحديثات المتكررة عن طريق التحقق من الوقت المنقضي منذ آخر تحديث
      const lastUpdate = drivesInfo[accountId]?.lastUpdated;
      const now = Date.now();
      const minRefreshInterval = 30000; // 30 ثانية على الأقل بين التحديثات
      
      if (lastUpdate) {
        const timeSinceLastUpdate = now - new Date(lastUpdate).getTime();
        if (timeSinceLastUpdate < minRefreshInterval) {
          console.log(`Refresh for account ${accountId} throttled. Last update was ${timeSinceLastUpdate}ms ago.`);
          return; // تجاهل طلب التحديث إذا كان حديثًا جدًا
        }
      }
      
      fetchDriveInfo(accountId, true);
      // تأخير طلب الملفات لتجنب الاستدعاءات المتزامنة
      setTimeout(() => {
        fetchDriveFiles(accountId, true);
      }, 1500);
    }
  };

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