'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  FaCalendarAlt, 
  FaUsers, 
  FaFileVideo, 
  FaChartLine,
  FaPlus,
  FaArrowUp,
  FaArrowDown,
  FaClock,
  FaCheck,
  FaExclamationTriangle
} from 'react-icons/fa';
import Link from 'next/link';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState({
    scheduledPosts: 0,
    publishedToday: 0,
    totalAccounts: 0,
    pendingApproval: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    // Simulate loading stats - replace with real API calls
    setStats({
      scheduledPosts: 24,
      publishedToday: 8,
      totalAccounts: 3,
      pendingApproval: 2
    });

    setRecentActivity([
      {
        id: 1,
        type: 'published',
        title: 'New Video Published',
        description: 'How to Create Amazing Content',
        account: 'YouTube Channel 1',
        time: '2 hours ago',
        status: 'success'
      },
      {
        id: 2,
        type: 'scheduled',
        title: 'Post Scheduled',
        description: 'Weekly Tutorial #5',
        account: 'YouTube Channel 2',
        time: '4 hours ago',
        status: 'scheduled'
      },
      {
        id: 3,
        type: 'failed',
        title: 'Upload Failed',
        description: 'Connection timeout',
        account: 'YouTube Channel 1',
        time: '6 hours ago',
        status: 'error'
      }
    ]);
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
<<<<<<< HEAD
    <div className="p-8 bg-background text-foreground">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50 mb-2">
          Welcome back, {session.user?.name}!
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
=======
    <div className="p-8">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {session.user?.name}!
        </h1>
        <p className="text-gray-600">
>>>>>>> 72edfc3ef57a65d21c6a1d935c25640a1487a9f7
          Here's what's happening with your content today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Scheduled Posts */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
<<<<<<< HEAD
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Scheduled Posts</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-50">{stats.scheduledPosts}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <FaCalendarAlt className="text-blue-600 dark:text-blue-300 text-xl" />
=======
              <p className="text-sm font-medium text-gray-600">Scheduled Posts</p>
              <p className="text-3xl font-bold text-gray-900">{stats.scheduledPosts}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FaCalendarAlt className="text-blue-600 text-xl" />
>>>>>>> 72edfc3ef57a65d21c6a1d935c25640a1487a9f7
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <FaArrowUp className="text-green-500 mr-1" />
            <span className="text-green-500 font-medium">12%</span>
<<<<<<< HEAD
            <span className="text-gray-600 dark:text-gray-400 ml-1">from last week</span>
=======
            <span className="text-gray-600 ml-1">from last week</span>
>>>>>>> 72edfc3ef57a65d21c6a1d935c25640a1487a9f7
          </div>
        </div>

        {/* Published Today */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
<<<<<<< HEAD
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Published Today</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-50">{stats.publishedToday}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <FaFileVideo className="text-green-600 dark:text-green-300 text-xl" />
=======
              <p className="text-sm font-medium text-gray-600">Published Today</p>
              <p className="text-3xl font-bold text-gray-900">{stats.publishedToday}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <FaFileVideo className="text-green-600 text-xl" />
>>>>>>> 72edfc3ef57a65d21c6a1d935c25640a1487a9f7
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <FaArrowUp className="text-green-500 mr-1" />
            <span className="text-green-500 font-medium">8%</span>
<<<<<<< HEAD
            <span className="text-gray-600 dark:text-gray-400 ml-1">from yesterday</span>
=======
            <span className="text-gray-600 ml-1">from yesterday</span>
>>>>>>> 72edfc3ef57a65d21c6a1d935c25640a1487a9f7
          </div>
        </div>

        {/* Connected Accounts */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
<<<<<<< HEAD
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Connected Accounts</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-50">{stats.totalAccounts}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
              <FaUsers className="text-purple-600 dark:text-purple-300 text-xl" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <Link href="/accounts" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
=======
              <p className="text-sm font-medium text-gray-600">Connected Accounts</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalAccounts}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <FaUsers className="text-purple-600 text-xl" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <Link href="/accounts" className="text-blue-600 hover:text-blue-800">
>>>>>>> 72edfc3ef57a65d21c6a1d935c25640a1487a9f7
              Manage accounts
            </Link>
          </div>
        </div>

        {/* Pending Approval */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
<<<<<<< HEAD
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Approval</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-50">{stats.pendingApproval}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
              <FaExclamationTriangle className="text-orange-600 dark:text-orange-300 text-xl" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-orange-600 dark:text-orange-400">Needs attention</span>
=======
              <p className="text-sm font-medium text-gray-600">Pending Approval</p>
              <p className="text-3xl font-bold text-gray-900">{stats.pendingApproval}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <FaExclamationTriangle className="text-orange-600 text-xl" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-orange-600">Needs attention</span>
>>>>>>> 72edfc3ef57a65d21c6a1d935c25640a1487a9f7
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="card">
<<<<<<< HEAD
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Recent Activity</h2>
                <Link href="/uploads" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm">
=======
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                <Link href="/uploads" className="text-blue-600 hover:text-blue-800 text-sm">
>>>>>>> 72edfc3ef57a65d21c6a1d935c25640a1487a9f7
                  View all
                </Link>
              </div>
            </div>
            
            <div className="p-6">
              {recentActivity.length === 0 ? (
                <div className="text-center py-8">
<<<<<<< HEAD
                  <FaFileVideo className="text-gray-400 dark:text-gray-600 text-3xl mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No recent activity</p>
=======
                  <FaFileVideo className="text-gray-400 text-3xl mx-auto mb-4" />
                  <p className="text-gray-600">No recent activity</p>
>>>>>>> 72edfc3ef57a65d21c6a1d935c25640a1487a9f7
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
<<<<<<< HEAD
                    <div key={activity.id} className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
=======
                    <div key={activity.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
>>>>>>> 72edfc3ef57a65d21c6a1d935c25640a1487a9f7
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        activity.status === 'success' ? 'bg-green-100' :
                        activity.status === 'scheduled' ? 'bg-blue-100' :
                        'bg-red-100'
                      }`}>
                        {activity.status === 'success' && <FaCheck className="text-green-600" />}
                        {activity.status === 'scheduled' && <FaClock className="text-blue-600" />}
                        {activity.status === 'error' && <FaExclamationTriangle className="text-red-600" />}
                      </div>
                      
                      <div className="flex-1">
<<<<<<< HEAD
                        <h3 className="font-medium text-gray-900 dark:text-gray-50">{activity.title}</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">{activity.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
=======
                        <h3 className="font-medium text-gray-900">{activity.title}</h3>
                        <p className="text-gray-600 text-sm">{activity.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
>>>>>>> 72edfc3ef57a65d21c6a1d935c25640a1487a9f7
                          <span>{activity.account}</span>
                          <span>•</span>
                          <span>{activity.time}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-6">
          {/* Quick Actions Card */}
          <div className="card">
<<<<<<< HEAD
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Quick Actions</h2>
=======
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
>>>>>>> 72edfc3ef57a65d21c6a1d935c25640a1487a9f7
            </div>
            
            <div className="p-6 space-y-4">
              <Link 
                href="/uploads" 
<<<<<<< HEAD
                className="block p-4 bg-blue-50 dark:bg-blue-900 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-lg transition-colors"
=======
                className="block p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
>>>>>>> 72edfc3ef57a65d21c6a1d935c25640a1487a9f7
              >
                <div className="flex items-center gap-3">
                  <FaCalendarAlt className="text-blue-600" />
                  <div>
<<<<<<< HEAD
                    <h3 className="font-medium text-gray-900 dark:text-gray-50">Schedule Post</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Create a new scheduled post</p>
=======
                    <h3 className="font-medium text-gray-900">Schedule Post</h3>
                    <p className="text-sm text-gray-600">Create a new scheduled post</p>
>>>>>>> 72edfc3ef57a65d21c6a1d935c25640a1487a9f7
                  </div>
                </div>
              </Link>

              <Link 
                href="/accounts" 
<<<<<<< HEAD
                className="block p-4 bg-green-50 dark:bg-green-900 hover:bg-green-100 dark:hover:bg-green-800 rounded-lg transition-colors"
=======
                className="block p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
>>>>>>> 72edfc3ef57a65d21c6a1d935c25640a1487a9f7
              >
                <div className="flex items-center gap-3">
                  <FaUsers className="text-green-600" />
                  <div>
<<<<<<< HEAD
                    <h3 className="font-medium text-gray-900 dark:text-gray-50">Manage Accounts</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Connect or switch accounts</p>
=======
                    <h3 className="font-medium text-gray-900">Manage Accounts</h3>
                    <p className="text-sm text-gray-600">Connect or switch accounts</p>
>>>>>>> 72edfc3ef57a65d21c6a1d935c25640a1487a9f7
                  </div>
                </div>
              </Link>

              <Link 
                href="/uploader" 
<<<<<<< HEAD
                className="block p-4 bg-purple-50 dark:bg-purple-900 hover:bg-purple-100 dark:hover:bg-purple-800 rounded-lg transition-colors"
=======
                className="block p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
>>>>>>> 72edfc3ef57a65d21c6a1d935c25640a1487a9f7
              >
                <div className="flex items-center gap-3">
                  <FaFileVideo className="text-purple-600" />
                  <div>
<<<<<<< HEAD
                    <h3 className="font-medium text-gray-900 dark:text-gray-50">Upload Content</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Add new videos to library</p>
=======
                    <h3 className="font-medium text-gray-900">Upload Content</h3>
                    <p className="text-sm text-gray-600">Add new videos to library</p>
>>>>>>> 72edfc3ef57a65d21c6a1d935c25640a1487a9f7
                  </div>
                </div>
              </Link>
            </div>
          </div>

          {/* Performance Overview */}
          <div className="card">
<<<<<<< HEAD
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">This Week</h2>
=======
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">This Week</h2>
>>>>>>> 72edfc3ef57a65d21c6a1d935c25640a1487a9f7
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
<<<<<<< HEAD
                  <span className="text-sm text-gray-600 dark:text-gray-400">Posts Scheduled</span>
                  <span className="font-medium">24</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Posts Published</span>
                  <span className="font-medium">18</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Success Rate</span>
=======
                  <span className="text-sm text-gray-600">Posts Scheduled</span>
                  <span className="font-medium">24</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Posts Published</span>
                  <span className="font-medium">18</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Success Rate</span>
>>>>>>> 72edfc3ef57a65d21c6a1d935c25640a1487a9f7
                  <span className="font-medium text-green-600">95%</span>
                </div>
              </div>
              
              <div className="mt-6">
                <div className="flex items-center justify-between text-sm mb-2">
<<<<<<< HEAD
                  <span className="text-gray-600 dark:text-gray-400">Weekly Goal</span>
=======
                  <span className="text-gray-600">Weekly Goal</span>
>>>>>>> 72edfc3ef57a65d21c6a1d935c25640a1487a9f7
                  <span className="text-gray-900">18/20 posts</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '90%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}