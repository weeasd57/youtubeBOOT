'use client';

import { createContext, useContext, useMemo } from 'react';

const UserInfoContext = createContext();

export function UserInfoProvider({ children, user }) {
  // Memoize the user info to prevent unnecessary re-renders
  const userInfo = useMemo(() => ({
    name: user?.name,
    email: user?.email,
    image: user?.image,
  }), [user?.name, user?.email, user?.image]);

  return (
    <UserInfoContext.Provider value={userInfo}>
      {children}
    </UserInfoContext.Provider>
  );
}

export function useUserInfo() {
  const context = useContext(UserInfoContext);
  if (context === undefined) {
    throw new Error('useUserInfo must be used within a UserInfoProvider');
  }
  return context;
}
