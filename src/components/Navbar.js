'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaTable, FaDownload, FaBars, FaTimes, FaSync, FaHome, FaSignOutAlt, FaChevronDown, FaUser, FaList, FaUserCog } from 'react-icons/fa';
import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import AccountSwitcher from './AccountSwitcher';
import UserInfo from './UserInfo';
import { UserInfoProvider } from '@/contexts/UserInfoContext';

export default function Navbar({ user, onRefreshAuth, refreshing, themeToggle }) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const userMenuRef = useRef(null);
  const menuRef = useRef(null);
  
  // Track scroll position for adding box shadow - use useCallback to prevent recreation
  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > 10);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);
  
  // Close menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
    setIsUserMenuOpen(false);
  }, [pathname]);
  
  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target) && 
          !event.target.closest('button[aria-label="Toggle menu"]')) {
        setIsMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const isActive = (path) => {
    return pathname === path;
  };

  return (
    <UserInfoProvider user={user}>
      <div className={`sticky top-0 z-40 transition-all duration-300 ${scrolled ? 'py-1' : 'py-2'}`}>
      {/* Desktop Navigation */}
      <div className="hidden md:block">
        <div className="backdrop-blur-md bg-white/75 dark:bg-black/80 rounded-lg shadow-lg border border-white/20 dark:border-amber-600/30 mx-auto p-3">
          <div className="flex items-center justify-between">
            {/* Logo and App Name */}
            <div className="flex items-center space-x-3">
              <div className="rounded-full overflow-hidden flex items-center justify-center w-10 h-10 shadow-sm">
                <Image 
                  src="/android-chrome-192x192.png" 
                  alt="App Logo"
                  width={40}
                  height={40}
                  className="object-cover"
                />
              </div>
              <h1 className="text-base md:text-lg lg:text-xl font-bold tracking-tight dark:text-amber-50 bg-gradient-to-r from-amber-600 to-amber-400 bg-clip-text text-transparent">
                YouTube Drive Uploader
              </h1>
            </div>
            
            {/* Navigation Links */}
            <div className="flex items-center space-x-1 md:space-x-2 lg:space-x-3">
              <Link
                href="/home"
                className={`px-3 md:px-4 py-2 rounded-md font-medium text-sm md:text-base flex items-center gap-1.5 transition-all duration-300 hover:scale-105 ${
                  isActive('/home')
                    ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md dark:from-amber-700 dark:to-amber-600'
                    : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100/80 dark:hover:bg-black/50'
                }`}
              >
                <FaHome className={`${isActive('/home') ? "text-white" : "text-amber-500"} transition-all text-sm md:text-base`} />
                <span className="whitespace-nowrap">Dashboard</span>
              </Link>
              
              <Link
                href="/uploads"
                className={`px-3 md:px-4 py-2 rounded-md font-medium text-sm md:text-base flex items-center gap-1.5 transition-all duration-300 hover:scale-105 ${
                  isActive('/uploads')
                    ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md dark:from-amber-700 dark:to-amber-600'
                    : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100/80 dark:hover:bg-black/50'
                }`}
              >
                <FaTable className={`${isActive('/uploads') ? "text-white" : "text-amber-500"} transition-all text-sm md:text-base`} />
                <span className="whitespace-nowrap">Schedules</span>
              </Link>
              
              <Link
                href="/tiktok-downloader"
                className={`px-3 md:px-4 py-2 rounded-md font-medium text-sm md:text-base flex items-center gap-1.5 transition-all duration-300 hover:scale-105 ${
                  isActive('/tiktok-downloader')
                    ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md dark:from-amber-700 dark:to-amber-600'
                    : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100/80 dark:hover:bg-black/50'
                }`}
              >
                <FaDownload className={`${isActive('/tiktok-downloader') ? "text-white" : "text-amber-500"} transition-all text-sm md:text-base`} />
                <span className="whitespace-nowrap">TikTok Downloader</span>
              </Link>
              
              <Link
                href="/accounts"
                className={`px-3 md:px-4 py-2 rounded-md font-medium text-sm md:text-base flex items-center gap-1.5 transition-all duration-300 hover:scale-105 ${
                  isActive('/accounts')
                    ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md dark:from-amber-700 dark:to-amber-600'
                    : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100/80 dark:hover:bg-black/50'
                }`}
              >
                <FaUserCog className={`${isActive('/accounts') ? "text-white" : "text-amber-500"} transition-all text-sm md:text-base`} />
                <span className="whitespace-nowrap">Accounts</span>
              </Link>
            </div>
            
            {/* User Menu and Auth Controls */}
            <div className="flex items-center space-x-3 md:space-x-4">
              {themeToggle}
              
              {user && onRefreshAuth && (
                <button
                  onClick={onRefreshAuth}
                  disabled={refreshing}
                  title="Refresh Authentication"
                  className="p-2 rounded-full text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all duration-300 disabled:opacity-50 hover:scale-110"
                >
                  <FaSync className={`w-4 h-4 md:w-5 md:h-5 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              )}
              
              {/* Consolidated User Menu with Account Switcher */}
              {user && (
                <div className="relative">
                  <button 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-all"
                  >
                    <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-amber-400 dark:border-amber-600">
                      {user.image ? (
                        <Image
                          src={user.image}
                          alt={user.name || "User"}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-amber-100 dark:bg-amber-800 text-amber-600 dark:text-amber-200 font-bold">
                          {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                        </div>
                      )}
                    </div>
                    <span className="hidden lg:block text-sm font-medium truncate max-w-[120px]">{user.name}</span>
                    <FaChevronDown className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                  </button>
                  
                  {isUserMenuOpen && (
                    <div ref={userMenuRef} className="absolute right-0 mt-2 w-60 bg-white dark:bg-gray-900 shadow-lg rounded-md py-2 z-50 border border-gray-200 dark:border-gray-700">
                      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800">
                        <UserInfo />
                      </div>
                      
                      <div className="pt-2">
                        {/* Account Switcher nested inside user menu */}
                        <AccountSwitcher />
                        
                        <div className="border-t border-gray-200 dark:border-gray-800 mt-2 pt-2">
                          <button
                            onClick={() => signOut()}
                            className="w-full text-left px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                          >
                            <FaSignOutAlt className="w-4 h-4" />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden">
        {/* Mobile Header */}
        <div className="backdrop-blur-md bg-white/75 dark:bg-black/80 rounded-lg shadow-lg border border-white/20 dark:border-amber-600/30 px-4 py-3">
          <div className="flex justify-between items-center">
            <Link href="/home" className="flex items-center gap-2">
              <div className="w-7 h-7 relative rounded-full overflow-hidden shadow-sm">
                <Image 
                  src="/android-chrome-192x192.png" 
                  alt="App Logo"
                  fill
                  className="object-cover"
                />
              </div>
              <span className="font-semibold text-sm text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-amber-400 dark:from-amber-400 dark:to-amber-300">YouTube Upload</span>
            </Link>

            <div className="flex items-center gap-3">
              {themeToggle}

              {user && onRefreshAuth && (
                <button
                  onClick={onRefreshAuth}
                  disabled={refreshing}
                  title="Refresh Authentication"
                  className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50/50 dark:hover:bg-green-900/20 rounded-full transition-all"
                >
                  <FaSync className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              )}

              {/* Account Switcher for Mobile */}
              {user && (
                <AccountSwitcher />
              )}

              <button
                onClick={() => {
                  setIsMenuOpen(!isMenuOpen);
                  setIsUserMenuOpen(false);
                }}
                className="text-gray-700 dark:text-amber-50 focus:outline-none p-1.5 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 rounded-md transition-colors"
                aria-label="Toggle menu"
              >
                {isMenuOpen ?
                  <FaTimes className="w-5 h-5" /> :
                  <FaBars className="w-5 h-5" />
                }
              </button>
            </div>
          </div>

          {/* User Info and Sign Out in Mobile Header (when logged in) */}
          {user && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 relative rounded-full overflow-hidden">
                  {user.image ? (
                    <Image
                      src={user.image}
                      alt={user.name || "User"}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-blue-500 text-white text-xs">
                      {user.name ? user.name[0].toUpperCase() : 'U'}
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[150px]">
                  {user.email}
                </span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="px-3 py-1 text-xs rounded border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors flex items-center gap-1"
              >
                <FaSignOutAlt className="w-3 h-3" />
                Sign Out
              </button>
            </div>
          )}

          {/* Main mobile menu with navigation links */}
          {isMenuOpen && (
            <div className="mt-3 py-2 border-t border-gray-200 dark:border-gray-700" ref={menuRef}>
              <div className="flex flex-col space-y-2">
                <Link
                  href="/home"
                  className={`px-3 py-2.5 rounded-md font-medium text-sm flex items-center gap-2.5 transition-all duration-200 ${
                    isActive('/home')
                      ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-sm'
                      : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <FaHome className={`${isActive('/home') ? "text-white" : "text-amber-500"}`} />
                  <span>Dashboard</span>
                </Link>

                <Link
                  href="/uploads"
                  className={`px-3 py-2.5 rounded-md font-medium text-sm flex items-center gap-2.5 transition-all duration-200 ${
                    isActive('/uploads')
                      ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-sm'
                      : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <FaTable className={`${isActive('/uploads') ? "text-white" : "text-amber-500"}`} />
                  <span>Schedules</span>
                </Link>

                <Link
                  href="/tiktok-downloader"
                  className={`px-3 py-2.5 rounded-md font-medium text-sm flex items-center gap-2.5 transition-all duration-200 ${
                    isActive('/tiktok-downloader')
                      ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-sm'
                      : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <FaDownload className={`${isActive('/tiktok-downloader') ? "text-white" : "text-amber-500"}`} />
                  <span> Downloader</span>
                </Link>

                <Link
                  href="/accounts"
                  className={`px-3 py-2.5 rounded-md font-medium text-sm flex items-center gap-2.5 transition-all duration-200 ${
                    isActive('/accounts')
                      ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-sm'
                      : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <FaUserCog className={`${isActive('/accounts') ? "text-white" : "text-amber-500"}`} />
                  <span>Accounts</span>
                </Link>

                {/* Sign out is now in the header, removed from here */}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </UserInfoProvider>
  );
}