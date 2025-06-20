'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useAccounts } from '@/contexts/AccountContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaSignOutAlt, FaPlus, FaCheck, FaStar, FaTrash, FaUser, FaSync, FaArrowLeft } from 'react-icons/fa';
import Link from 'next/link';
import Image from 'next/image';
import ThemeToggle from '@/components/ThemeToggle';

// Component that safely uses search params
function AccountSwitcher({ accounts, switchAccount, router }) {
  const searchParams = useSearchParams();
  const [processingSwitch, setProcessingSwitch] = useState(false);

  // معالجة معلمة switchTo في URL
  useEffect(() => {
    const switchToId = searchParams.get('switchTo');
    if (switchToId && !processingSwitch) {
      console.log(`Found switchTo parameter with account ID: ${switchToId}`);
      setProcessingSwitch(true);
      
      // تأخير قصير لضمان تحميل الحسابات قبل التبديل
      const timer = setTimeout(async () => {
        try {
          // البحث عن الحساب في قائمة الحسابات
          const accountExists = accounts?.some(acc => acc.id === switchToId);
          
          if (accountExists) {
            console.log(`Switching to account: ${switchToId}`);
            // تنظيف ذاكرة التخزين المؤقت
            localStorage.removeItem('driveFolders');
            localStorage.removeItem('driveFoldersTimestamp');
            localStorage.removeItem('lastHomeFolderRefresh');
            localStorage.removeItem('lastDriveFolderCheck');
            localStorage.removeItem('lastTokenFetch');
            localStorage.removeItem('cachedUserTokens');
            localStorage.removeItem('lastDriveRefresh');
            
            // تعيين علامات تبديل الحساب
            localStorage.setItem('accountSwitched', 'true');
            localStorage.setItem('accountSwitchedTimestamp', Date.now().toString());
            
            // تبديل الحساب
            await switchAccount(switchToId);
            
            // توجيه المستخدم إلى الصفحة الرئيسية بعد التبديل
            setTimeout(() => {
              router.push('/home');
            }, 500);
          } else {
            console.warn(`Account with ID ${switchToId} not found`);
          }
        } catch (error) {
          console.error('Error processing switchTo parameter:', error);
        } finally {
          setProcessingSwitch(false);
        }
      }, 1000); // تأخير بمقدار 1 ثانية
      
      return () => clearTimeout(timer);
    }
  }, [searchParams, accounts, switchAccount, router, processingSwitch]);

  return null; // This component just handles the effect, no UI
}

export default function AccountsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  const [apiError, setApiError] = useState(null);
  const {
    accounts,
    activeAccount,
    loading,
    switchAccount,
    setPrimaryAccount,
    removeAccount,
    error
  } = useAccounts();
  
  const [confirmingRemove, setConfirmingRemove] = useState(null);
  const [fixingData, setFixingData] = useState(false);

  const handleRefreshAuth = async () => {
    setRefreshing(true);
    try {
      // Refresh accounts data
      window.location.reload();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Redirect if not authenticated
  if (status === 'unauthenticated') {
    router.push('/');
    return null;
  }

  const handleAddAccount = async () => {
    if (!session?.user?.id) {
      toast.error("يرجى تسجيل الدخول أولاً قبل إضافة حساب جديد");
      return;
    }

    setAddingAccount(true);
    setApiError(null);
    
    try {
      const response = await fetch('/api/auth/generate-link-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate linking token');
      }

      const { token: linkToken } = await response.json();
      
      // Add loading toast
      const toastId = toast.loading('جاري فتح نافذة تسجيل الدخول بجوجل...');
      
      // Prepare state with linking token
      const state = JSON.stringify({ linkToken });
      
      // Initiate Google sign in
      await signIn('google', { 
        callbackUrl: '/accounts', 
        state 
      });
      
      // Clear loading toast
      toast.dismiss(toastId);

    } catch (error) {
      console.error('Error adding account:', error);
      setApiError(error.message);
    } finally {
      setAddingAccount(false);
    }
  };

  const handleSwitchAccount = async (accountId) => {
    await switchAccount(accountId);
  };

  const handleSetPrimary = async (accountId) => {
    await setPrimaryAccount(accountId);
  };

  const handleRemoveAccount = async (accountId) => {
    if (confirmingRemove === accountId) {
      await removeAccount(accountId);
      setConfirmingRemove(null);
    } else {
      setConfirmingRemove(accountId);
      // Reset confirm state after 3 seconds
      setTimeout(() => setConfirmingRemove(null), 3000);
    }
  };

  const handleFixMissingData = async () => {
    setFixingData(true);
    try {
      const response = await fetch('/api/accounts/fix-missing-data', {
        method: 'POST',
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Fix result:', result);
        // Refresh accounts after fixing
        window.location.reload();
      } else {
        console.error('Failed to fix account data');
      }
    } catch (error) {
      console.error('Error fixing account data:', error);
    } finally {
      setFixingData(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <>
      {/* Wrap the search params usage in a suspense boundary */}
      <Suspense fallback={null}>
        <AccountSwitcher 
          accounts={accounts} 
          switchAccount={switchAccount} 
          router={router} 
        />
      </Suspense>
      
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Manage Accounts</h1>
          </div>
          <button
            onClick={handleAddAccount}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            disabled={addingAccount}
          >
            {addingAccount ? (
              <>
                <FaSync className="animate-spin" /> Generating Link...
              </>
            ) : (
              <>
                <FaPlus /> Add New Account
              </>
            )}
          </button>
        </div>
      
      {apiError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 text-red-700 dark:text-red-400">
          {apiError}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center py-12">
          <FaSync className="animate-spin text-amber-500 w-8 h-8" />
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden mb-6">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-2">Connected Google Accounts</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Manage the Google accounts you've connected to YouTube Boot. 
                Your primary account will be used by default for all operations.
              </p>
            </div>
            
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {accounts.length === 0 ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  No accounts connected yet. Add your first Google account to get started.
                </div>
              ) : (
                accounts.map(account => (
                  <div 
                    key={account.id}
                    className={`p-4 flex items-center justify-between ${
                      activeAccount?.id === account.id ? 'bg-amber-50 dark:bg-amber-900/20' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center overflow-hidden">
                        {account.image ? (
                          <Image 
                            src={account.image} 
                            alt="" 
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-medium">
                            {getInitials(account.name)}
                          </span>
                        )}
                      </div>
                      
                      <div>
                        <div className="font-medium flex items-center">
                          {account.name}
                          {account.is_primary && (
                            <span className="ml-2 text-amber-500 text-xs flex items-center gap-1">
                              <FaStar className="w-3 h-3" /> Primary
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {account.email}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {activeAccount?.id !== account.id && (
                        <button
                          onClick={() => handleSwitchAccount(account.id)}
                          className="px-3 py-1 text-xs rounded border border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-white transition-colors"
                        >
                          Switch to
                        </button>
                      )}
                      
                      {!account.is_primary && (
                        <button
                          onClick={() => handleRemoveAccount(account.id)}
                          className={`px-3 py-1 text-xs rounded border ${
                            confirmingRemove === account.id
                              ? 'border-red-600 bg-red-600 text-white'
                              : 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white'
                          } transition-colors`}
                        >
                          {confirmingRemove === account.id ? 'Confirm Remove' : 'Remove'}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="flex justify-center gap-4">
            {accounts.some(acc => !acc.email) && (
              <button
                onClick={handleFixMissingData}
                disabled={fixingData}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <FaSync className={`w-4 h-4 ${fixingData ? 'animate-spin' : ''}`} />
                Fix Missing Data
              </button>
            )}
          </div>
          
          <div className="mt-8 bg-gray-50 dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-semibold mb-3">About Multiple Accounts</h3>
            <div className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                The multiple accounts feature allows you to connect several Google accounts to YouTube Boot
                and easily switch between them.
              </p>
              <div>
                <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-1">How it works:</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Connect multiple Google accounts to upload videos to different YouTube channels</li>
                  <li>Set one account as your primary account that will be used by default</li>
                  <li>Easily switch between accounts without signing out</li>
                  <li>Each account maintains its own tokens and permissions</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
      </div>
    </>
  );
}
