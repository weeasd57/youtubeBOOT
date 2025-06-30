'use client';

import { useState, useEffect } from 'react';
import { useAccounts } from '@/contexts/AccountContext.tsx';
import { useSession, signIn, signOut } from 'next-auth/react';
import { FaSignOutAlt, FaPlus, FaCheck, FaStar, FaTrash, FaUser, FaSync } from 'react-icons/fa';
import Image from 'next/image';
import { toast } from 'react-hot-toast';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export default function AccountSwitcher() {
  const { data: session, status } = useSession();
  const { 
    accounts, 
    activeAccount, 
    loading, 
    switchAccount, 
    removeAccount 
  } = useAccounts();
  
  const [isOpen, setIsOpen] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(null);
  
  // Check if screen is mobile sized
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && !event.target.closest('.account-switcher-container')) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  // Close dropdown on mobile
  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
  }, [isMobile]);

  if (status === 'loading' || loading) {
    return (
      <div className="relative px-3 py-2 h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <FaSync className="animate-spin text-gray-600 dark:text-gray-300" />
      </div>
    );
  }

  if (status !== 'authenticated') {
    return null;
  }

  const handleAddAccount = () => {
    // Use redirect: false to prevent automatic page navigation
    // This prevents the current session from being terminated
    signIn('google', { 
      callbackUrl: '/accounts',
      redirect: false
    }).then(() => {
      // Open Google sign-in in a new window to preserve current session
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        '/api/auth/signin/google', 
        'GoogleSignIn', 
        `width=${width},height=${height},left=${left},top=${top}`
      );
      
      toast.success('Please sign in with Google in the popup window');
      setIsOpen(false);
    }).catch(error => {
      console.error('Sign in error:', error);
      toast.error('Failed to open sign in window');
    });
  };

  const handleSwitchAccount = async (accountId) => {
    await switchAccount(accountId);
    setIsOpen(false);
  };

  const handleRemoveAccount = async (e, accountId) => {
    e.stopPropagation();
    
    if (confirmingRemove === accountId) {
      await removeAccount(accountId);
      setConfirmingRemove(null);
    } else {
      setConfirmingRemove(accountId);
      // Reset confirm state after 3 seconds
      setTimeout(() => setConfirmingRemove(null), 3000);
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
    <div className="relative account-switcher-container">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        aria-expanded={isOpen}
      >
        <div className="relative h-8 w-8 overflow-hidden rounded-full">
          {activeAccount?.image || session?.user?.image ? (
            <Image
              src={activeAccount?.image || session?.user?.image}
              alt={activeAccount?.name || session?.user?.name || "User"}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-blue-500 text-white">
              {getInitials(activeAccount?.name || session?.user?.name)}
            </div>
          )}
        </div>
        <span className="max-w-[100px] truncate text-sm font-medium">
          {activeAccount?.name || session?.user?.name}
        </span>
      </button>

      {isOpen && !isMobile && (
        <div className="absolute right-0 mt-2 w-64 rounded-md bg-white dark:bg-gray-900 shadow-lg z-50 py-1 border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <div className="font-semibold">Accounts</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{session.user.email}</div>
          </div>

          <div className="max-h-60 overflow-y-auto">
            {accounts
              .filter((account, index, self) =>
                index === self.findIndex(a => a.email === account.email)
              )
              .map(account => (
              <div
                key={account.id}
                onClick={() => handleSwitchAccount(account.id)}
                className={`px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  activeAccount?.id === account.id ? 'bg-gray-50 dark:bg-gray-800' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="relative h-8 w-8 overflow-hidden rounded-full">
                    {account.image ? (
                      <Image
                        src={account.image}
                        alt={account.name || "User"}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-blue-500 text-white">
                        {getInitials(account.name)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {account.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {account.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {activeAccount?.id === account.id && (
                    <span className="text-green-500 mr-2">
                      <FaCheck className="w-4 h-4" />
                    </span>
                  )}
                  <button
                    onClick={(e) => handleRemoveAccount(e, account.id)}
                    className={`${
                      confirmingRemove === account.id
                        ? 'text-red-600 hover:text-red-800'
                        : 'text-gray-500 hover:text-gray-700'
                    } p-1`}
                    title={confirmingRemove === account.id ? "Click again to confirm" : "Remove account"}
                  >
                    <FaTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
