'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaTable, FaDownload, FaBars, FaTimes, FaSync, FaHome, FaSignOutAlt, FaChevronDown, FaUser, FaList } from 'react-icons/fa';
import Image from "next/image";
import { useState, useEffect, useRef } from 'react';
import { signOut } from 'next-auth/react';

export default function Navbar({ user, onRefreshAuth, refreshing, themeToggle }) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const userMenuRef = useRef(null);
  const menuRef = useRef(null);
  
  // Track scroll position for adding box shadow
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
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
              
              {/* User Profile Menu */}
              {user && (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center space-x-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 py-1.5 px-2.5 transition-all cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                  >
                    {user.image ? (
                      <Image
                        src={user.image}
                        alt={user.name}
                        width={32}
                        height={32}
                        className="w-7 h-7 md:w-8 md:h-8 rounded-full shadow-sm"
                      />
                    ) : (
                      <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-sm">
                        <FaUser className="w-3 h-3 md:w-4 md:h-4" />
                      </div>
                    )}
                    <span className="text-xs md:text-sm font-medium dark:text-amber-100 hidden sm:block">{user.name}</span>
                    <FaChevronDown className={`text-gray-500 dark:text-gray-400 w-2.5 h-2.5 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {/* Dropdown Menu */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Signed in as</p>
                        <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{user.email}</p>
                      </div>
                      <button
                        onClick={() => signOut({ callbackUrl: '/' })}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 transition-colors"
                      >
                        <FaSignOutAlt className="w-4 h-4" />
                        Sign Out
                      </button>
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
              
              {/* User Profile Button for Mobile - Modified to sign out directly */}
              {user && (
                <button
                  className="flex items-center p-1 rounded-full hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-all"
                  title={user.name}
                >
                  {user.image ? (
                    <Image
                      src={user.image}
                      alt={user.name}
                      width={24}
                      height={24}
                      className="w-6 h-6 rounded-full shadow-sm"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-sm">
                      <FaUser className="w-3 h-3" />
                    </div>
                  )}
                </button>
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
                  <span>TikTok Downloader</span>
                </Link>
                
                {user && (
                  <button
                    onClick={() => {
                      signOut({ callbackUrl: '/' });
                      setIsMenuOpen(false);
                    }}
                    className="px-3 py-2.5 rounded-md font-medium text-sm flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 w-full text-left transition-colors"
                  >
                    <FaSignOutAlt className="text-red-500" />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 