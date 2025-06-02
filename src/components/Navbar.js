'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaTable, FaDownload, FaBars, FaTimes, FaSync, FaHome, FaSignOutAlt, FaChevronDown, FaUser, FaList, FaUserCog, FaMoon, FaSun, FaGoogle } from 'react-icons/fa';
import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from 'react';
import { signOut, signIn } from 'next-auth/react';
import { UserInfoProvider } from '@/contexts/UserInfoContext';

// Reusable NavLink Component
const NavLink = ({ href, icon: Icon, isActive, onClick, children }) => (
  <Link
    href={href}
    onClick={onClick}
    className={`px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-3 transition-all duration-200 ${
      isActive
        ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md transform scale-[0.98]'
        : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100/80 dark:hover:bg-gray-800/50 hover:transform hover:scale-[0.98]'
    }`}
  >
    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-amber-500'} transition-colors`} />
    <span className="font-medium">{children}</span>
  </Link>
);

export default function Navbar({ user, onRefreshAuth, refreshing, themeToggle, isLandingPage }) {
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

  // If we're on the landing page, show a simplified version of the navbar
  if (isLandingPage) {
    return (
      <UserInfoProvider user={user}>
        <div className={`sticky top-0 z-40 transition-all duration-300 ${scrolled ? 'py-1' : 'py-2'} w-full max-w-full`}>
          <div className="px-4 max-w-7xl mx-auto">
            <div className="backdrop-blur-md bg-white/75 dark:bg-black/80 rounded-lg shadow-lg border border-white/20 dark:border-amber-600/30 p-3 w-full">
              <div className="flex items-center justify-between min-w-0">
                {/* Logo and App Name */}
                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-shrink-0">
                  <div className="rounded-full overflow-hidden flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 shadow-sm">
                    <Image
                      src="/android-chrome-192x192.png"
                      alt="App Logo"
                      width={40}
                      height={40}
                      className="object-cover"
                    />
                  </div>
                  <h1 className="text-sm sm:text-base md:text-lg font-bold tracking-tight dark:text-amber-50 bg-gradient-to-r from-amber-600 to-amber-400 bg-clip-text text-transparent whitespace-nowrap truncate">
                    <span className="hidden md:inline">YouTube Drive Uploader</span>
                    <span className="hidden sm:inline md:hidden">YouTube Uploader</span>
                    <span className="sm:hidden">YT Boot</span>
                  </h1>
                </div>
                
                {/* Right side with theme toggle and sign in button */}
                <div className="flex items-center space-x-2 sm:space-x-4">
                  {/* Theme toggle button */}
                  <button 
                    onClick={themeToggle}
                    className="p-1.5 sm:p-2 rounded-full text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all duration-300 hover:scale-110"
                    title="Toggle dark/light mode"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                    </svg>
                  </button>
                  
                  {/* Mobile Menu Button - only shown on small screens */}
                  <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="sm:hidden p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-md transition-all"
                    aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                    aria-expanded={isMenuOpen}
                  >
                    {isMenuOpen ? (
                      <FaTimes className="w-4 h-4" />
                    ) : (
                      <FaBars className="w-4 h-4" />
                    )}
                  </button>
                  
                  {/* Sign In Button - hidden on mobile when menu is closed */}
                  <button
                    onClick={() => signIn('google')}
                    className="hidden sm:flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-all duration-300 hover:scale-105 shadow-md"
                  >
                    <FaGoogle className="w-3 h-3 sm:w-4 sm:h-4" /> <span>Sign In</span>
                  </button>
                </div>
              </div>
              
              {/* Mobile Menu - Landing Page */}
              {isMenuOpen && (
                <div className="sm:hidden mt-3 transform transition-all duration-300 ease-out animate-fade-in">
                  <div className="flex flex-col space-y-2 py-3 border-t border-gray-200/50 dark:border-gray-700/50">
                    <button
                      onClick={() => {
                        signIn('google');
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-2 transition-colors rounded-md"
                    >
                      <FaGoogle className="w-4 h-4" /> <span>Sign In with Google</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </UserInfoProvider>
    );
  }

  return (
    <UserInfoProvider user={user}>
      <div className={`sticky top-0 z-40 transition-all duration-300 ${scrolled ? 'py-1' : 'py-2'} w-full max-w-full`}>
      {/* Desktop Navigation */}
      <div className="hidden md:block px-4 max-w-7xl mx-auto">
        <div className="backdrop-blur-md bg-white/75 dark:bg-black/80 rounded-lg shadow-lg border border-white/20 dark:border-amber-600/30 p-3 w-full">
          <div className="flex items-center justify-between min-w-0">
            {/* Logo and App Name */}
            <div className="flex items-center space-x-3 min-w-0 flex-shrink-0">
              <div className="rounded-full overflow-hidden flex items-center justify-center w-10 h-10 shadow-sm">
                <Image
                  src="/android-chrome-192x192.png"
                  alt="App Logo"
                  width={40}
                  height={40}
                  className="object-cover"
                />
              </div>
              <h1 className="text-sm lg:text-base xl:text-lg font-bold tracking-tight dark:text-amber-50 bg-gradient-to-r from-amber-600 to-amber-400 bg-clip-text text-transparent whitespace-nowrap">
                <span className="hidden xl:inline">YouTube Drive Uploader</span>
                <span className="hidden lg:inline xl:hidden">YouTube Uploader</span>
                <span className="lg:hidden">YT Upload</span>
              </h1>
            </div>
            
            {/* Navigation Links */}
            <div className="flex items-center space-x-1 lg:space-x-2 xl:space-x-3 min-w-0 flex-1 justify-center">
              <Link
                href="/home"
                className={`px-2 lg:px-3 xl:px-4 py-2 rounded-md font-medium text-xs lg:text-sm xl:text-base flex items-center gap-1 lg:gap-1.5 transition-all duration-300 hover:scale-105 ${
                  isActive('/home')
                    ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md dark:from-amber-700 dark:to-amber-600'
                    : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100/80 dark:hover:bg-black/50'
                }`}
              >
                <FaHome className={`${isActive('/home') ? "text-white" : "text-amber-500"} transition-all text-xs lg:text-sm xl:text-base`} />
                <span className="whitespace-nowrap hidden lg:inline">Dashboard</span>
              </Link>
              
              <Link
                href="/uploads"
                className={`px-2 lg:px-3 xl:px-4 py-2 rounded-md font-medium text-xs lg:text-sm xl:text-base flex items-center gap-1 lg:gap-1.5 transition-all duration-300 hover:scale-105 ${
                  isActive('/uploads')
                    ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md dark:from-amber-700 dark:to-amber-600'
                    : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100/80 dark:hover:bg-black/50'
                }`}
              >
                <FaTable className={`${isActive('/uploads') ? "text-white" : "text-amber-500"} transition-all text-xs lg:text-sm xl:text-base`} />
                <span className="whitespace-nowrap hidden lg:inline">Schedules</span>
              </Link>
              
              <Link
                href="/uploader"
                className={`px-2 lg:px-3 xl:px-4 py-2 rounded-md font-medium text-xs lg:text-sm xl:text-base flex items-center gap-1 lg:gap-1.5 transition-all duration-300 hover:scale-105 ${
                  isActive('/uploader')
                    ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md dark:from-amber-700 dark:to-amber-600'
                    : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100/80 dark:hover:bg-black/50'
                }`}
              >
                <FaDownload className={`${isActive('/uploader') ? "text-white" : "text-amber-500"} transition-all text-xs lg:text-sm xl:text-base`} />
                <span className="whitespace-nowrap hidden xl:inline">TikTok Uploader</span>
                <span className="whitespace-nowrap hidden lg:inline xl:hidden">TikTok</span>
              </Link>
              
              <Link
                href="/accounts"
                className={`px-2 lg:px-3 xl:px-4 py-2 rounded-md font-medium text-xs lg:text-sm xl:text-base flex items-center gap-1 lg:gap-1.5 transition-all duration-300 hover:scale-105 ${
                  isActive('/accounts')
                    ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md dark:from-amber-700 dark:to-amber-600'
                    : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100/80 dark:hover:bg-black/50'
                }`}
              >
                <FaUserCog className={`${isActive('/accounts') ? "text-white" : "text-amber-500"} transition-all text-xs lg:text-sm xl:text-base`} />
                <span className="whitespace-nowrap hidden lg:inline">Accounts</span>
              </Link>
            </div>
            
            {/* User Menu and Auth Controls */}
            <div className="flex items-center space-x-3 md:space-x-4 min-w-0 flex-shrink-0">
              {/* Theme toggle button */}
              <button 
                onClick={themeToggle}
                className="p-2 rounded-full text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all duration-300 hover:scale-110"
                title="Toggle dark/light mode"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                </svg>
              </button>
              
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
              {/* Display User Info/Menu when logged in, or Sign In button when logged out */}
              <div className="relative">
                {user || pathname === '/home' ? (
                  <>
                    <button 
                      onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                      className="flex items-center gap-2 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-all"
                      aria-label="Toggle user menu"
                    >
                      <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-amber-400 dark:border-amber-600">
                        {user?.image ? (
                          <Image
                            src={user.image}
                            alt={user.name || "User"}
                            fill
                            className="object-cover"
                          />
                        ) : ( // Fallback if user image is null or undefined
                          <div className="w-full h-full flex items-center justify-center bg-amber-100 dark:bg-amber-800 text-amber-600 dark:text-amber-200 font-bold">
                            {user?.name ? user.name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || "U"}
                          </div>
                        )}
                      </div>
                      {/* Use email as fallback if name is null/undefined */}
                      <span className="hidden xl:block text-sm font-medium truncate max-w-[100px]">{user?.name || user?.email || 'User'}</span>
                      <FaChevronDown className={`w-3 h-3 text-gray-500 dark:text-gray-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isUserMenuOpen && ( // Show menu if open, regardless of user presence based on new requirement
                      <div ref={userMenuRef} className="absolute right-0 mt-2 w-60 bg-white dark:bg-gray-900 shadow-lg rounded-md py-2 z-[9999] border border-gray-200 dark:border-gray-700">
                        {user && (
                          <div className="px-4 py-2">
                            {/* Display only email */}
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                                {user.email}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        <div className="border-t border-gray-200 dark:border-gray-800 pt-2">
                          <button
                            onClick={() => {
                              signOut();
                              setIsUserMenuOpen(false); // Close menu after sign out
                            }}
                            className="w-full text-left px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors rounded-md"
                          >
                            <FaSignOutAlt className="w-4 h-4" />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    {/* Optional: Guest Icon */}
                    <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                         <FaUser className="w-4 h-4" />
                    </div>
                    <span className="hidden xl:block text-sm font-medium">Guest</span>
                     {/* Separate Sign In button always visible when logged out */}
                     <button
                         onClick={() => signIn()}
                         className="px-4 py-2 rounded-md font-medium text-sm text-white bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 transition-colors duration-300 shadow-md hover:scale-105"
                     >
                         Sign In
                     </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden px-4 max-w-full">
        <div className="backdrop-blur-md bg-white/75 dark:bg-black/80 rounded-lg shadow-lg border border-white/20 dark:border-amber-600/30 px-4 py-3 w-full">
          <div className="flex justify-between items-center">
            <Link href="/home" className="flex items-center gap-2">
              <div className="w-8 h-8 relative rounded-full overflow-hidden shadow-sm">
                <Image 
                  src="/android-chrome-192x192.png" 
                  alt="App Logo"
                  fill
                  className="object-cover"
                  sizes="32x32"
                />
              </div>
              <span className="font-semibold text-sm text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-amber-400 dark:from-amber-400 dark:to-amber-300">
                YouTube Upload
              </span>
            </Link>

            <div className="flex items-center gap-2">
              {/* Theme toggle button for mobile */}
              <button 
                onClick={themeToggle}
                className="p-1.5 rounded-full text-amber-600 dark:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-900/20 transition-all"
                aria-label="Toggle theme"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                </svg>
              </button>
              
              {user && onRefreshAuth && (
                <button
                  onClick={onRefreshAuth}
                  disabled={refreshing}
                  title="Refresh Authentication"
                  className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50/50 dark:hover:bg-green-900/20 rounded-full transition-all"
                  aria-label="Refresh authentication"
                >
                  <FaSync className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              )}
              
              <button
                onClick={() => {
                  setIsMenuOpen(!isMenuOpen);
                  setIsUserMenuOpen(false); // Close user menu when opening mobile main menu
                }}
                className="text-gray-700 dark:text-amber-50 focus:outline-none p-1.5 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 rounded-md transition-colors"
                aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isMenuOpen}
              >
                {isMenuOpen ? (
                  <FaTimes className="w-5 h-5" />
                ) : (
                  <FaBars className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Menu Panel */}
          {isMenuOpen && (
            <div
              className="mt-3 transform transition-all duration-300 ease-out animate-fade-in"
              ref={menuRef}
            >
              <div className="flex flex-col space-y-1 py-3 border-t border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-black/50 rounded-lg backdrop-blur-sm">
              <NavLink 
                href="/home" 
                icon={FaHome} 
                isActive={isActive('/home')}
                onClick={() => setIsMenuOpen(false)}
              >
                Dashboard
              </NavLink>
              
              <NavLink 
                href="/uploads" 
                icon={FaTable} 
                isActive={isActive('/uploads')}
                onClick={() => setIsMenuOpen(false)}
              >
                Schedules
              </NavLink>
              
              <NavLink 
                href="/uploader" 
                icon={FaDownload} 
                isActive={isActive('/uploader')}
                onClick={() => setIsMenuOpen(false)}
              >
                Uploader
              </NavLink>
              
              <NavLink 
                href="/accounts" 
                icon={FaUserCog} 
                isActive={isActive('/accounts')}
                onClick={() => setIsMenuOpen(false)}
              >
                Accounts
              </NavLink>

              {/* Display User Info and Sign Out when logged in, or Guest and Sign In when logged out */}
              {user || pathname === '/home' ? (
                <div className="pt-2 mt-1 border-t border-gray-200 dark:border-gray-700">
                  {user && (
                    <div className="px-3 py-2">
                      {/* Display only email */}
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                        {user.email}
                      </span>
                    </div>
                  )}
                  
                  <button
                    onClick={() => {
                      signOut();
                      setIsMenuOpen(false); // Close menu after sign out
                    }}
                    className="w-full text-left px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors rounded-md mt-1"
                  >
                    <FaSignOutAlt className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                 <div className="pt-2 mt-1 border-t border-gray-200 dark:border-gray-700">
                    <div className="px-3 py-2 text-gray-700 dark:text-amber-50 flex items-center gap-2">
                         <FaUser className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                         <span>Guest</span>
                    </div>
                     <button
                         onClick={() => {
                              signIn();
                             setIsMenuOpen(false); // Close menu after triggering sign in
                         }}
                         className="w-full text-left px-3 py-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-2 transition-colors rounded-md mt-1"
                     >
                         <span>Sign In</span>
                     </button>
                 </div>
              )}
              </div>
            </div>
          )}
        </div>
      </div>
      
    </div>
    </UserInfoProvider>
  );
}