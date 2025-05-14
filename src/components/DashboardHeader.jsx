'use client';

import Link from 'next/link';
import { LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardHeader({ onSidebarToggle }) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white px-4 dark:bg-gray-950">
      <div className="flex items-center">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onSidebarToggle}
          className="mr-2 md:hidden"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
        <Link href="/" className="flex items-center">
          <span className="text-xl font-bold">YoutubeBOOT</span>
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          asChild
        >
          <Link href="/auth/signout">
            <LogOut className="h-5 w-5" />
            <span className="sr-only">Sign Out</span>
          </Link>
        </Button>
      </div>
    </header>
  );
} 