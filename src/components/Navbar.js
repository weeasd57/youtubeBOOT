'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaYoutube, FaTable, FaDownload, FaVideo } from 'react-icons/fa';

export default function Navbar() {
  const pathname = usePathname();
  
  const isActive = (path) => {
    return pathname === path;
  };

  return (
    <div className="sticky top-0 z-40 py-2 mb-8">
      <div className="backdrop-blur-md bg-white/75 dark:bg-black/80 rounded-lg shadow-lg border border-white/20 dark:border-amber-600/30 flex overflow-hidden transition-all duration-300 mx-auto hover:shadow-xl hover:bg-white/85 dark:hover:bg-black/90 hover:-translate-y-1">
        <Link
          href="/home"
          className={`px-6 py-3 font-medium flex items-center gap-2 transition-all duration-300 flex-1 justify-center ${
            isActive('/home')
              ? 'bg-amber-600/90 text-white shadow-sm dark:bg-amber-700/50'
              : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100/80 dark:hover:bg-black/50'
          }`}
        >
          <FaYoutube className={`${isActive('/home') ? "text-white" : "text-red-500"} transition-all`} />
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
        <Link
          href="/tiktok-videos"
          className={`px-6 py-3 font-medium flex items-center gap-2 transition-all duration-300 flex-1 justify-center ${
            isActive('/tiktok-videos')
              ? 'bg-amber-600/90 text-white shadow-sm dark:bg-amber-700/50'
              : 'text-gray-700 dark:text-amber-50 hover:bg-gray-100/80 dark:hover:bg-black/50'
          }`}
        >
          <FaVideo className={`${isActive('/tiktok-videos') ? "text-white" : "text-amber-500"} transition-all`} />
          <span className="relative">
            TikTok Videos
            {isActive('/tiktok-videos') && (
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-white rounded-full animate-pulse"></span>
            )}
          </span>
        </Link>
      </div>
    </div>
  );
} 