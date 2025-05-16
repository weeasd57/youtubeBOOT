'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaTable, FaDownload, FaBars, FaTimes } from 'react-icons/fa';
import Image from "next/image";
import { useState, useEffect } from 'react';

export default function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  
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
  }, [pathname]);
  
  const isActive = (path) => {
    return pathname === path;
  };

  return (
    <div className={`sticky top-0 z-40 py-2 mb-8 transition-all duration-300 ${scrolled ? 'py-1' : 'py-2'}`}>
      {/* Desktop Navigation */}
      <div className="hidden md:block">
        <div className="backdrop-blur-md bg-white/75 dark:bg-black/80 rounded-lg shadow-lg border border-white/20 dark:border-amber-600/30 flex overflow-hidden transition-all duration-300 mx-auto hover:shadow-xl hover:bg-white/85 dark:hover:bg-black/90 hover:-translate-y-1">
          <Link
            href="/home"
            className={`px-6 py-3 font-medium flex items-center gap-2 transition-all duration-300 flex-1 justify-center ${
              isActive('/home')
                ? 'bg-amber-600/90 text-white shadow-sm dark:bg-amber-700/50'
                : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100/80 dark:hover:bg-black/50'
            }`}
          >
            <div className={`w-5 h-5 relative ${isActive('/home') ? "" : "opacity-80"} transition-all`}>
              <Image 
                src="/android-chrome-192x192.png" 
                alt="App Logo"
                fill
                className="object-cover"
              />
            </div>
            <span className="relative">
              Dashboard
              {isActive('/home') && (
                <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-white rounded-full animate-pulse"></span>
              )}
            </span>
          </Link>
          <Link
            href="/uploads"
            className={`px-6 py-3 font-medium flex items-center gap-2 transition-all duration-300 flex-1 justify-center ${
              isActive('/uploads')
                ? 'bg-amber-600/90 text-white shadow-sm dark:bg-amber-700/50'
                : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100/80 dark:hover:bg-black/50'
            }`}
          >
            <FaTable className={`${isActive('/uploads') ? "text-white" : "text-amber-500"} transition-all`} />
            <span className="relative">
              Schedules
              {isActive('/uploads') && (
                <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-white rounded-full animate-pulse"></span>
              )}
            </span>
          </Link>
          <Link
            href="/tiktok-downloader"
            className={`px-6 py-3 font-medium flex items-center gap-2 transition-all duration-300 flex-1 justify-center ${
              isActive('/tiktok-downloader')
                ? 'bg-amber-600/90 text-white shadow-sm dark:bg-amber-700/50'
                : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100/80 dark:hover:bg-black/50'
            }`}
          >
            <FaDownload className={`${isActive('/tiktok-downloader') ? "text-white" : "text-amber-500"} transition-all`} />
            <span className="relative">
              TikTok Downloader
              {isActive('/tiktok-downloader') && (
                <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-white rounded-full animate-pulse"></span>
              )}
            </span>
          </Link>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden">
        {/* Mobile Header */}
        <div className="backdrop-blur-md bg-white/75 dark:bg-black/80 rounded-lg shadow-lg border border-white/20 dark:border-amber-600/30 flex justify-between items-center px-4 py-3">
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
          
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-gray-700 dark:text-amber-50 focus:outline-none"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? 
              <FaTimes className="w-6 h-6" /> : 
              <FaBars className="w-6 h-6" />
            }
          </button>
        </div>
        
        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="absolute left-0 right-0 mt-2 p-2 backdrop-blur-lg bg-white/90 dark:bg-black/90 rounded-lg shadow-xl border border-white/20 dark:border-amber-600/30 z-50">
            <div className="flex flex-col">
              <Link
                href="/home"
                className={`px-4 py-3 rounded-md font-medium flex items-center gap-2 transition-all duration-300 ${
                  isActive('/home')
                    ? 'bg-amber-600/90 text-white'
                    : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100/80 dark:hover:bg-black/50'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                <div className={`w-5 h-5 relative ${isActive('/home') ? "" : "opacity-80"} transition-all`}>
                  <Image 
                    src="/android-chrome-192x192.png" 
                    alt="App Logo"
                    fill
                    className="object-cover"
                  />
                </div>
                <span>Dashboard</span>
              </Link>
              <Link
                href="/uploads"
                className={`px-4 py-3 rounded-md font-medium flex items-center gap-2 transition-all duration-300 ${
                  isActive('/uploads')
                    ? 'bg-amber-600/90 text-white'
                    : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100/80 dark:hover:bg-black/50'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                <FaTable className={`${isActive('/uploads') ? "text-white" : "text-amber-500"} transition-all`} />
                <span>Schedules</span>
              </Link>
              <Link
                href="/tiktok-downloader"
                className={`px-4 py-3 rounded-md font-medium flex items-center gap-2 transition-all duration-300 ${
                  isActive('/tiktok-downloader')
                    ? 'bg-amber-600/90 text-white'
                    : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100/80 dark:hover:bg-black/50'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                <FaDownload className={`${isActive('/tiktok-downloader') ? "text-white" : "text-amber-500"} transition-all`} />
                <span>TikTok Downloader</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 
