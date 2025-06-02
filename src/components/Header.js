'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FaBars, FaTimes, FaUserCircle } from 'react-icons/fa';
import ThemeToggle from './ThemeToggle';

/**
 * رأس التطبيق مع شعار، قائمة تنقل، وأزرار أخرى
 * 
 * @param {Object} props خصائص المكون
 * @param {Object} props.user بيانات المستخدم المسجل دخوله
 * @param {Function} props.onSignOut دالة لتسجيل الخروج
 * @returns {JSX.Element}
 */
export default function Header({ user, onSignOut }) {
  const [menuOpen, setMenuOpen] = useState(false);

  // تبديل حالة قائمة الجوال
  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-md w-full z-10">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* شعار التطبيق */}
        <Link href="/home" className="flex items-center">
          <div className="relative w-8 h-8 mr-2">
            <Image 
              src="/android-chrome-192x192.png" 
              alt="App Logo"
              fill
              className="object-contain"
            />
          </div>
          <span className="text-xl font-bold text-gray-800 dark:text-white">YouTube Boot</span>
        </Link>

        {/* أزرار التنقل - الشاشة الكبيرة */}
        <nav className="hidden md:flex items-center space-x-6">
          <Link href="/home" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">
            الرئيسية
          </Link>
          <Link href="/schedule" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">
            الجدول
          </Link>
          <Link href="/uploader" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">
            رفع TikTok
          </Link>
          <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">
            لوحة التحكم
          </Link>
        </nav>

        {/* أزرار الإجراءات - الشاشة الكبيرة */}
        <div className="hidden md:flex items-center space-x-4">
          <ThemeToggle />
          
          {user ? (
            <div className="flex items-center space-x-2">
              <div className="relative w-8 h-8 rounded-full overflow-hidden">
                {user.image ? (
                  <Image 
                    src={user.image} 
                    alt={user.name || 'User'}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <FaUserCircle className="w-full h-full text-gray-400" />
                )}
              </div>
              <button 
                onClick={onSignOut}
                className="px-3 py-1 text-sm text-gray-600 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400"
              >
                تسجيل الخروج
              </button>
            </div>
          ) : (
            <Link 
              href="/api/auth/signin"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              تسجيل الدخول
            </Link>
          )}
        </div>

        {/* زر القائمة - الشاشة الصغيرة */}
        <button 
          className="md:hidden text-gray-600 dark:text-gray-200 focus:outline-none" 
          onClick={toggleMenu}
        >
          {menuOpen ? (
            <FaTimes className="h-6 w-6" />
          ) : (
            <FaBars className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* قائمة الجوال */}
      {menuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-800 shadow-lg py-4 px-4">
          <nav className="flex flex-col space-y-3">
            <Link 
              href="/home" 
              className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 py-2"
              onClick={() => setMenuOpen(false)}
            >
              الرئيسية
            </Link>
            <Link 
              href="/schedule" 
              className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 py-2"
              onClick={() => setMenuOpen(false)}
            >
              الجدول
            </Link>
            <Link 
              href="/uploader" 
              className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 py-2"
              onClick={() => setMenuOpen(false)}
            >
              رفع TikTok
            </Link>
            <Link 
              href="/dashboard" 
              className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 py-2"
              onClick={() => setMenuOpen(false)}
            >
              لوحة التحكم
            </Link>
            
            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <ThemeToggle />
              
              {user ? (
                <div className="flex items-center">
                  <div className="relative w-8 h-8 rounded-full overflow-hidden mr-2">
                    {user.image ? (
                      <Image 
                        src={user.image} 
                        alt={user.name || 'User'}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <FaUserCircle className="w-full h-full text-gray-400" />
                    )}
                  </div>
                  <button 
                    onClick={onSignOut}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400"
                  >
                    تسجيل الخروج
                  </button>
                </div>
              ) : (
                <Link 
                  href="/api/auth/signin"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  onClick={() => setMenuOpen(false)}
                >
                  تسجيل الدخول
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}