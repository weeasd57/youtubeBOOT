'use client';

import Image from "next/image";
import { signOut } from 'next-auth/react';
import { FaSignOutAlt } from 'react-icons/fa';
import { useUserInfo } from '@/contexts/UserInfoContext';

export default function UserInfo() {
  const userInfo = useUserInfo();

  if (!userInfo) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 relative rounded-full overflow-hidden">
          {userInfo.image ? (
            <Image
              src={userInfo.image}
              alt={userInfo.name || "User"}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-blue-500 text-white">
              {userInfo.name ? userInfo.name[0].toUpperCase() : 'U'}
            </div>
          )}
        </div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[150px]">
          {userInfo.email}
        </span>
      </div>
      <button
        onClick={(e) => {
          e.preventDefault();
          signOut({ callbackUrl: '/' });
        }}
        className="px-3 py-1.5 text-sm rounded border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors flex items-center gap-1.5"
      >
        <FaSignOutAlt className="w-3 h-3" />
        Sign Out
      </button>
    </div>
  );
}
