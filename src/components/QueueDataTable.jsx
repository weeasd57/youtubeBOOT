'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader, SearchIcon, ExternalLinkIcon, CheckCircleIcon, AlertCircleIcon, PlayIcon } from 'lucide-react';

// Initialize Supabase client - avoid errors if environment variables are not available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabaseInitializationError = null;
if (!supabaseUrl || !supabaseAnonKey) {
  supabaseInitializationError = "Application configuration error: Missing Supabase URL or Key. Please contact support.";
  console.error(supabaseInitializationError);
}

// Create Supabase client only if URLs are available
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export default function QueueDataTable({ filterStatus }) {
  const { session } = useAuth();
  
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(supabaseInitializationError); // Initialize with potential config error
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const [actionLoading, setActionLoading] = useState(null);

  // Fetch video data from Supabase
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      // Error is already set by supabaseInitializationError
      return;
    }
    
    const fetchVideos = async () => {
      try {
        setLoading(true);
        
        // Build Supabase query
        let query = supabase
          .from('video_queue')
          .select('*');
        
        // Apply status filter if specified
        if (filterStatus) {
          query = query.eq('status', filterStatus);
        }
        
        // Always filter by current user (no admin exception)
        if (session?.user) {
          query = query.eq('user_email', session.user.email);
        } else if (!session && !supabase) {
           // Early exit if Supabase isn't initialized and no session
          setLoading(false);
          return;
        }
        
        // Order results
        query = query.order('created_at', { ascending: false });
        
        const { data, error: queryError } = await query;
        
        if (queryError) {
          console.error('Supabase query error:', queryError);
          throw queryError; // Throw the actual error object
        }
        
        setVideos(data || []);
        setError(null); // Clear previous errors
      } catch (err) {
        console.error('Error fetching video data:', err);
        setError(`Failed to load video data: ${err.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchVideos();
    
    // Set up subscription for real-time changes
    const channel = supabase
      .channel('video_queue_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'video_queue',
        filter: session?.user ? `user_email=eq.${session.user.email}` : undefined
      }, (payload) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('Received real-time update:', payload);
        }
        fetchVideos(); // Refetch data on change
      })
      .subscribe((status, err) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('Subscription status:', status);
        }
        if (err) {
          console.error('Subscription error:', err);
          // Optionally, set an error state related to real-time updates
        }
      });
    
    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [filterStatus, session]); // supabase is not added as a dependency as it's not expected to change

  // Filter videos by search term
  const filteredVideos = videos.filter(video => 
    video.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    video.video_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    video.url?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Get badge color based on status
  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Not available';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  // Handle priority update
  const handleUpdatePriority = async (id, newPriority) => {
    if (!supabase) {
      alert('Database connection is not available. Cannot update priority.');
      return;
    }
    try {
      setActionLoading(id);
      
      const { error: updateError } = await supabase
        .from('video_queue')
        .update({ priority: newPriority })
        .eq('id', id);
      
      if (updateError) throw updateError;
    } catch (err) {
      console.error('Error updating priority:', err);
      alert(`Failed to update priority: ${err.message || 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle reprocessing request
  const handleReprocess = async (id) => {
    if (!supabase) {
      alert('Database connection is not available. Cannot reprocess video.');
      return;
    }
    try {
      setActionLoading(id);
      
      const { error: updateError } = await supabase
        .from('video_queue')
        .update({
          status: 'pending',
          error_message: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (updateError) throw updateError;
    } catch (err) {
      console.error('Error reprocessing video:', err);
      alert(`Failed to reprocess video: ${err.message || 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle immediate processing of a single video
  const handleProcessNow = async (id) => {
    const cronApiKey = process.env.NEXT_PUBLIC_CRON_API_KEY;
    if (!cronApiKey) {
      alert('Configuration error: CRON API Key is missing. Cannot process video.');
      console.error('Missing NEXT_PUBLIC_CRON_API_KEY');
      return;
    }

    try {
      setActionLoading(id);
      
      const response = await fetch('/api/process-single-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cronApiKey}`
        },
        body: JSON.stringify({ videoId: id })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to process video (server error)');
      }
      // Optionally, provide feedback on successful initiation
      // alert('Video processing initiated.');
    } catch (err) {
      console.error('Error processing video:', err);
      alert(`Failed to process video: ${err.message || 'Unknown client-side error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Translate video status
  const translateStatus = (status) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'processing':
        return 'Processing';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader className="animate-spin mr-2" />
        <p>Loading data...</p>
      </div>
    );
  }

  // Render error state if error is present (includes config errors)
  if (error) {
    return (
      <div className="bg-red-50 text-red-800 p-4 rounded-md">
        <AlertCircleIcon className="inline-block mr-2" />
        <strong>Error:</strong> <p className="inline-block">{error}</p>
        {/* Only show Try Again if it's not a config error */}
        {!supabaseInitializationError && (
          <Button 
            variant="outline" 
            className="mt-2 block" 
            onClick={() => {
              setError(null); // Clear error to allow re-fetch
              // Note: fetchVideos will be called by useEffect if dependencies change or on initial load
              // For a direct re-fetch, one might need to trigger useEffect or call fetchVideos directly
              // For now, we rely on the existing useEffect logic or a page reload for simplicity.
              // A more robust solution might involve a manual refetch function.
              window.location.reload(); // Simplest way to force re-fetch and re-init
            }}
          >
            Try Again
          </Button>
        )}
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-md shadow">
      <div className="p-4">
        {/* Search bar */}
        <div className="relative mb-4">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <Input
            placeholder="Search videos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-50"
          />
        </div>
        
        {/* Show result count */}
        <p className="text-sm text-gray-500 mb-2">
          Showing {filteredVideos.length} of {videos.length} videos
          {filterStatus ? ` (${translateStatus(filterStatus)})` : ''}
        </p>
        
        {filteredVideos.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No videos to display
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Video ID</TableHead>
                  <TableHead>Date Added</TableHead>
                  <TableHead>Last Update</TableHead>
                  <TableHead>File Size</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-left">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVideos.map((video) => (
                  <TableRow key={video.id}>
                    <TableCell>
                      <Badge className={`${getStatusBadgeStyle(video.status)} px-2 py-1`}>
                        {translateStatus(video.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium truncate max-w-[200px]" title={video.title}>
                      {video.title || 'Untitled'}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{video.video_id || 'Not available'}</TableCell>
                    <TableCell className="text-sm">{formatDate(video.created_at)}</TableCell>
                    <TableCell className="text-sm">{formatDate(video.updated_at)}</TableCell>
                    <TableCell>{formatFileSize(video.file_size)}</TableCell>
                    <TableCell>
                      <select
                        className="border rounded p-1 text-sm bg-gray-50"
                        value={video.priority || 0}
                        onChange={(e) => handleUpdatePriority(video.id, parseInt(e.target.value))}
                        disabled={actionLoading === video.id}
                      >
                        <option value="0">Normal</option>
                        <option value="1">High</option>
                        <option value="2">Urgent</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {video.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReprocess(video.id)}
                            disabled={actionLoading === video.id}
                            title="Reprocess"
                          >
                            {actionLoading === video.id ? (
                              <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                              <Loader className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        
                        {video.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleProcessNow(video.id)}
                            disabled={actionLoading === video.id}
                            title="Process Now"
                          >
                            {actionLoading === video.id ? (
                              <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                              <PlayIcon className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        
                        {video.web_view_link && (
                          <Button
                            size="sm"
                            variant="outline"
                            as="a"
                            href={video.web_view_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View in Drive"
                          >
                            <ExternalLinkIcon className="w-4 h-4" />
                          </Button>
                        )}
                        
                        {video.error_message && (
                          <span
                            className="text-red-500 cursor-help"
                            title={video.error_message}
                          >
                            <AlertCircleIcon className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
} 
