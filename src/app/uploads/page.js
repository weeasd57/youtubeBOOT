'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  FaCalendarAlt, 
  FaPlay, 
  FaPause, 
  FaEdit, 
  FaTrash,
  FaClock,
  FaCheck,
  FaExclamationTriangle,
  FaPlus,
  FaFilter,
  FaSearch
} from 'react-icons/fa';
import Link from 'next/link';

export default function UploadsPage() {
  const { data: session } = useSession();
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, scheduled, published, failed
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadScheduledPosts();
  }, []);

  const loadScheduledPosts = async () => {
    try {
      setLoading(true);
      // Simulate API call - replace with real implementation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setScheduledPosts([
        {
          id: '1',
          title: 'How to Create Amazing Content for YouTube',
          description: 'A comprehensive guide on creating engaging content that your audience will love...',
          thumbnail: '/android-chrome-192x192.png',
          scheduledTime: '2024-01-15T10:00:00Z',
          status: 'scheduled',
          platform: 'YouTube',
          account: 'John Tech Channel',
          views: null,
          duration: '12:34'
        },
        {
          id: '2',
          title: 'React Next.js Tutorial - Build Modern Apps',
          description: 'Learn how to build modern web applications using React and Next.js...',
          thumbnail: '/android-chrome-192x192.png',
          scheduledTime: '2024-01-14T14:30:00Z',
          status: 'published',
          platform: 'YouTube',
          account: 'John Tech Channel',
          views: '1.2K',
          duration: '25:17'
        },
        {
          id: '3',
          title: 'Gaming Stream Highlights',
          description: 'Best moments from last week\'s gaming streams...',
          thumbnail: '/android-chrome-192x192.png',
          scheduledTime: '2024-01-13T20:00:00Z',
          status: 'failed',
          platform: 'YouTube',
          account: 'Gaming with John',
          views: null,
          duration: '8:45',
          error: 'Upload quota exceeded'
        },
        {
          id: '4',
          title: 'Weekly Tech News Update',
          description: 'Latest technology news and trends you need to know...',
          thumbnail: '/android-chrome-192x192.png',
          scheduledTime: '2024-01-16T09:00:00Z',
          status: 'scheduled',
          platform: 'YouTube',
          account: 'John Tech Channel',
          views: null,
          duration: '15:22'
        }
      ]);
    } catch (error) {
      console.error('Error loading scheduled posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPosts = scheduledPosts.filter(post => {
    const matchesFilter = filter === 'all' || post.status === filter;
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'status-info';
      case 'published': return 'status-success';
      case 'failed': return 'status-error';
      default: return 'status-info';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'scheduled': return <FaClock />;
      case 'published': return <FaCheck />;
      case 'failed': return <FaExclamationTriangle />;
      default: return <FaClock />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Scheduled Posts</h1>
          <p className="text-gray-600">Manage your scheduled content across all platforms</p>
        </div>
        
        <Link href="/schedule/new" className="btn btn-primary">
          <FaPlus />
          Schedule New Post
        </Link>
      </div>

      {/* Filters and Search */}
      <div className="mb-8 flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'All Posts' },
            { key: 'scheduled', label: 'Scheduled' },
            { key: 'published', label: 'Published' },
            { key: 'failed', label: 'Failed' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === key
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search posts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10 w-full sm:w-80"
          />
        </div>
      </div>

      {/* Posts Grid */}
      {filteredPosts.length === 0 ? (
        <div className="text-center py-12">
          <FaCalendarAlt className="text-gray-400 text-6xl mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            {searchTerm ? 'No posts found' : 'No scheduled posts'}
          </h3>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            {searchTerm 
              ? 'Try adjusting your search terms or filters.'
              : 'Start scheduling your content to see it here.'
            }
          </p>
          {!searchTerm && (
            <Link href="/schedule/new" className="btn btn-primary">
              <FaPlus />
              Schedule Your First Post
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map((post) => (
            <div key={post.id} className="card overflow-hidden">
              {/* Thumbnail */}
              <div className="aspect-video bg-gray-100 relative">
                <img
                  src={post.thumbnail}
                  alt={post.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                  {post.duration}
                </div>
                <div className={`absolute top-2 left-2 status-badge ${getStatusColor(post.status)}`}>
                  {getStatusIcon(post.status)}
                  {post.status}
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                  {post.title}
                </h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {post.description}
                </p>

                {/* Meta Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <FaCalendarAlt />
                    {formatDate(post.scheduledTime)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>📺</span>
                    {post.account}
                  </div>
                  {post.views && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>👁️</span>
                      {post.views} views
                    </div>
                  )}
                  {post.error && (
                    <div className="text-red-600 text-sm">
                      Error: {post.error}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {post.status === 'scheduled' && (
                    <>
                      <button className="btn btn-ghost flex-1">
                        <FaEdit />
                        Edit
                      </button>
                      <button className="btn btn-ghost text-red-600">
                        <FaTrash />
                      </button>
                    </>
                  )}
                  {post.status === 'published' && (
                    <button className="btn btn-ghost flex-1">
                      <FaPlay />
                      View
                    </button>
                  )}
                  {post.status === 'failed' && (
                    <>
                      <button className="btn btn-secondary flex-1">
                        <FaPlay />
                        Retry
                      </button>
                      <button className="btn btn-ghost text-red-600">
                        <FaTrash />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {filteredPosts.length > 0 && (
        <div className="mt-8 flex justify-center">
          <div className="flex gap-2">
            <button className="btn btn-ghost">Previous</button>
            <button className="btn btn-primary">1</button>
            <button className="btn btn-ghost">2</button>
            <button className="btn btn-ghost">3</button>
            <button className="btn btn-ghost">Next</button>
          </div>
        </div>
      )}
    </div>
  );
} 