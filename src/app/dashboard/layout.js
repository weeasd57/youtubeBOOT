'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  FaHome, 
  FaCalendarAlt, 
  FaUsers, 
  FaFileVideo, 
  FaChartLine, 
  FaCog, 
  FaSignOutAlt,
  FaBars,
  FaTimes
} from 'react-icons/fa';
import ThemeToggle from '@/components/ThemeToggle';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: FaHome },
  { name: 'Schedule', href: '/uploads', icon: FaCalendarAlt },
  { name: 'Content', href: '/uploader', icon: FaFileVideo },
  { name: 'Accounts', href: '/accounts', icon: FaUsers },
  { name: 'Analytics', href: '/analytics', icon: FaChartLine },
];

export default function DashboardLayout({ children }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  return (
<<<<<<< HEAD
    <body className="dark">
      <div className="flex h-screen bg-gray-50">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-40 lg:hidden bg-black bg-opacity-50"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
              <div className="w-8 h-8 relative">
                <Image 
                  src="/android-chrome-192x192.png" 
                  alt="Content Scheduler"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
              </div>
              <span className="text-xl font-semibold text-gray-900">Content Scheduler</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* User Profile */}
            <div className="p-4 border-t border-gray-200">
              {session?.user && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 relative">
                      <Image
                        src={session.user.image || '/android-chrome-192x192.png'}
                        alt={session.user.name || 'User'}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {session.user.name}
                      </p>
                      <p className="text-sm text-gray-600 truncate">
                        {session.user.email}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <button
                      onClick={handleSignOut}
                      className="flex-1 btn btn-ghost justify-start"
                    >
                      <FaSignOutAlt />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile header */}
          <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 text-gray-600 hover:text-gray-900"
              >
                <FaBars className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 relative">
                  <Image 
                    src="/android-chrome-192x192.png" 
                    alt="Content Scheduler"
                    width={24}
                    height={24}
                    className="rounded"
                  />
                </div>
                <span className="font-semibold text-gray-900">Content Scheduler</span>
              </div>
              
              <div className="w-10"></div> {/* Spacer for centering */}
            </div>
          </div>

          {/* Page content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </body>
=======
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden bg-black bg-opacity-50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
            <div className="w-8 h-8 relative">
              <Image 
                src="/android-chrome-192x192.png" 
                alt="Content Scheduler"
                width={32}
                height={32}
                className="rounded-lg"
              />
            </div>
            <span className="text-xl font-semibold text-gray-900">Content Scheduler</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-gray-200">
            {session?.user && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 relative">
                    <Image
                      src={session.user.image || '/android-chrome-192x192.png'}
                      alt={session.user.name || 'User'}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {session.user.name}
                    </p>
                    <p className="text-sm text-gray-600 truncate">
                      {session.user.email}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <button
                    onClick={handleSignOut}
                    className="flex-1 btn btn-ghost justify-start"
                  >
                    <FaSignOutAlt />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-gray-600 hover:text-gray-900"
            >
              <FaBars className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 relative">
                <Image 
                  src="/android-chrome-192x192.png" 
                  alt="Content Scheduler"
                  width={24}
                  height={24}
                  className="rounded"
                />
              </div>
              <span className="font-semibold text-gray-900">Content Scheduler</span>
            </div>
            
            <div className="w-10"></div> {/* Spacer for centering */}
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
>>>>>>> 72edfc3ef57a65d21c6a1d935c25640a1487a9f7
  );
}