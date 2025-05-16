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
            <div className="flex items-center space-x-2">
              <div className="rounded-full overflow-hidden flex items-center justify-center w-10 h-10">
                <Image 
                  src="/android-chrome-192x192.png" 
                  alt="App Logo"
                  width={40}
                  height={40}
                  className="object-cover"
                />
              </div>
              <h1 className="text-lg md:text-xl font-bold dark:text-amber-50">
                YouTube Drive Uploader
              </h1>
            </div>
            
            {/* Navigation Links */}
            <div className="flex items-center space-x-2">
              <Link
                href="/home"
                className={`px-4 py-2 rounded-md font-medium flex items-center gap-1.5 transition-all duration-300 ${
                  isActive('/home')
                    ? 'bg-amber-600/90 text-white shadow-sm dark:bg-amber-700/50'
                    : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100/80 dark:hover:bg-black/50'
                }`}
              >
                <FaHome className={`${isActive('/home') ? "text-white" : "text-amber-500"} transition-all`} />
                <span>Dashboard</span>
              </Link>
              
              <Link
                href="/dashboard/queue"
                className={`px-4 py-2 rounded-md font-medium flex items-center gap-1.5 transition-all duration-300 ${
                  isActive('/dashboard/queue')
                    ? 'bg-amber-600/90 text-white shadow-sm dark:bg-amber-700/50'
                    : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100/80 dark:hover:bg-black/50'
                }`}
              >
                <FaList className={`${isActive('/dashboard/queue') ? "text-white" : "text-amber-500"} transition-all`} />
                <span>إدارة الطابور</span>
              </Link>
              
              <Link
                href="/uploads"
                className={`px-4 py-2 rounded-md font-medium flex items-center gap-1.5 transition-all duration-300 ${
                  isActive('/uploads')
                    ? 'bg-amber-600/90 text-white shadow-sm dark:bg-amber-700/50'
                    : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100/80 dark:hover:bg-black/50'
                }`}
              >
                <FaTable className={`${isActive('/uploads') ? "text-white" : "text-amber-500"} transition-all`} />
                <span>Schedules</span>
              </Link>
              
              <Link
                href="/tiktok-downloader"
                className={`px-4 py-2 rounded-md font-medium flex items-center gap-1.5 transition-all duration-300 ${
                  isActive('/tiktok-downloader')
                    ? 'bg-amber-600/90 text-white shadow-sm dark:bg-amber-700/50'
                    : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100/80 dark:hover:bg-black/50'
                }`}
              >
                <FaDownload className={`${isActive('/tiktok-downloader') ? "text-white" : "text-amber-500"} transition-all`} />
                <span>TikTok Downloader</span>
              </Link>
            </div>
            
            {/* User Menu and Auth Controls */}
            <div className="flex items-center space-x-4">
              {themeToggle}
              
              {user && onRefreshAuth && (
                <button
                  onClick={onRefreshAuth}
                  disabled={refreshing}
                  title="Refresh Authentication"
                  className="p-2 rounded-full text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all duration-300 disabled:opacity-50"
                >
                  <FaSync className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              )}
              
              {/* User Profile Menu */}
              {user && (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center space-x-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 py-1 px-2 transition-all cursor-pointer"
                  >
                    {user.image ? (
                      <Image
                        src={user.image}
                        alt={user.name}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white">
                        <FaUser />
                      </div>
                    )}
                    <span className="text-sm font-medium dark:text-amber-100">{user.name}</span>
                    <FaChevronDown className={`text-gray-500 dark:text-gray-400 w-3 h-3 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
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
                        className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
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
              <div className="w-7 h-7 relative">
                <Image 
                  src="/android-chrome-192x192.png" 
                  alt="App Logo"
                  fill
                  className="object-cover"
                />
              </div>
              <span className="font-semibold text-gray-800 dark:text-amber-50">YouTube Upload</span>
            </Link>
            
            <div className="flex items-center gap-2">
              {themeToggle}
              
              {user && onRefreshAuth && (
                <button
                  onClick={onRefreshAuth}
                  disabled={refreshing}
                  title="Refresh Authentication"
                  className="p-2 text-green-600 dark:text-green-400"
                >
                  <FaSync className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              )}
              
              {/* User Profile Button for Mobile */}
              {user && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(!isUserMenuOpen);
                      setIsMenuOpen(false);
                    }}
                    className="flex items-center"
                  >
                    {user.image ? (
                      <Image
                        src={user.image}
                        alt={user.name}
                        width={24}
                        height={24}
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-white">
                        <FaUser className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                  
                  {/* User menu dropdown for mobile */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center">
                          {user.image ? (
                            <Image
                              src={user.image}
                              alt={user.name}
                              width={24}
                              height={24}
                              className="w-6 h-6 rounded-full mr-2"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-white mr-2">
                              <FaUser className="w-3 h-3" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium dark:text-amber-100 truncate">{user.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                          </div>
                        </div>
                      </div>

                      <div className="py-1">
                        <Link
                          href="/home"
                          className={`px-4 py-2 text-sm flex items-center gap-2 ${
                            isActive('/home')
                              ? 'text-amber-600 font-medium bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400'
                              : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                          } w-full text-left`}
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <FaHome className="w-4 h-4 text-amber-500" />
                          <span>Dashboard</span>
                        </Link>
                        
                        <Link
                          href="/dashboard/queue"
                          className={`px-4 py-2 text-sm flex items-center gap-2 ${
                            isActive('/dashboard/queue')
                              ? 'text-amber-600 font-medium bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400'
                              : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                          } w-full text-left`}
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <FaList className="w-4 h-4 text-amber-500" />
                          <span>إدارة الطابور</span>
                        </Link>
                        
                        <Link
                          href="/uploads"
                          className={`px-4 py-2 text-sm flex items-center gap-2 ${
                            isActive('/uploads')
                              ? 'text-amber-600 font-medium bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400'
                              : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                          } w-full text-left`}
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <FaTable className="w-4 h-4 text-amber-500" />
                          <span>Schedules</span>
                        </Link>
                        
                        <Link
                          href="/tiktok-downloader"
                          className={`px-4 py-2 text-sm flex items-center gap-2 ${
                            isActive('/tiktok-downloader')
                              ? 'text-amber-600 font-medium bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400'
                              : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                          } w-full text-left`}
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <FaDownload className="w-4 h-4 text-amber-500" />
                          <span>TikTok Downloader</span>
                        </Link>
                      </div>
                      
                      <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
                        <button
                          onClick={() => signOut({ callbackUrl: '/' })}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                        >
                          <FaSignOutAlt className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <button 
                onClick={() => {
                  setIsMenuOpen(!isMenuOpen);
                  setIsUserMenuOpen(false);
                }}
                className="text-gray-700 dark:text-amber-50 focus:outline-none ml-1"
                aria-label="Toggle menu"
              >
                {isMenuOpen ? 
                  <FaTimes className="w-6 h-6" /> : 
                  <FaBars className="w-6 h-6" />
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
                  className={`px-3 py-2 rounded-md font-medium flex items-center gap-2 ${
                    isActive('/home')
                      ? 'bg-amber-600/90 text-white'
                      : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <FaHome className={`${isActive('/home') ? "text-white" : "text-amber-500"}`} />
                  <span>Dashboard</span>
                </Link>
                
                <Link
                  href="/dashboard/queue"
                  className={`px-3 py-2 rounded-md font-medium flex items-center gap-2 ${
                    isActive('/dashboard/queue')
                      ? 'bg-amber-600/90 text-white'
                      : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <FaList className={`${isActive('/dashboard/queue') ? "text-white" : "text-amber-500"}`} />
                  <span>إدارة الطابور</span>
                </Link>
                
                <Link
                  href="/uploads"
                  className={`px-3 py-2 rounded-md font-medium flex items-center gap-2 ${
                    isActive('/uploads')
                      ? 'bg-amber-600/90 text-white'
                      : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <FaTable className={`${isActive('/uploads') ? "text-white" : "text-amber-500"}`} />
                  <span>Schedules</span>
                </Link>
                
                <Link
                  href="/tiktok-downloader"
                  className={`px-3 py-2 rounded-md font-medium flex items-center gap-2 ${
                    isActive('/tiktok-downloader')
                      ? 'bg-amber-600/90 text-white'
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
                    className="px-3 py-2 rounded-md font-medium flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 w-full text-left"
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