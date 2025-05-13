'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import PageContainer from '@/components/PageContainer';

export default function DebugPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [driveData, setDriveData] = useState(null);
  const [error, setError] = useState(null);

  const fetchDriveDebugInfo = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/drive/debug');
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      const data = await response.json();
      setDriveData(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch drive data');
      console.error('Error fetching drive debug info:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Load data on initial mount
  useEffect(() => {
    if (status === 'authenticated') {
      fetchDriveDebugInfo();
    }
  }, [status]);

  return (
    <PageContainer>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Drive Debug Information</h1>
        
        <div className="mb-4">
          <button 
            onClick={fetchDriveDebugInfo}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh Data'}
          </button>
        </div>
        
        {error && (
          <div className="p-4 mb-4 bg-red-100 text-red-800 rounded border border-red-300">
            {error}
          </div>
        )}
        
        {loading && <p>Loading drive data...</p>}
        
        {driveData && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Summary</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="bg-blue-50 p-4 rounded border border-blue-200">
                  <p className="text-sm text-blue-600">Total Files</p>
                  <p className="text-2xl font-bold">{driveData.totalFiles}</p>
                </div>
                <div className="bg-green-50 p-4 rounded border border-green-200">
                  <p className="text-sm text-green-600">Folders</p>
                  <p className="text-2xl font-bold">{driveData.foldersCount}</p>
                </div>
              </div>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold mb-2">Mime Types</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="py-2 px-4 border-b text-left">Mime Type</th>
                      <th className="py-2 px-4 border-b text-left">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(driveData.mimeTypeCounts).map(([mimeType, count]) => (
                      <tr key={mimeType} className="border-b">
                        <td className="py-2 px-4">{mimeType}</td>
                        <td className="py-2 px-4">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold mb-2">Folders ({driveData.folders.length})</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="py-2 px-4 border-b text-left">Name</th>
                      <th className="py-2 px-4 border-b text-left">ID</th>
                      <th className="py-2 px-4 border-b text-left">Mime Type</th>
                      <th className="py-2 px-4 border-b text-left">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driveData.folders.map(folder => (
                      <tr key={folder.id} className="border-b">
                        <td className="py-2 px-4">{folder.name}</td>
                        <td className="py-2 px-4 text-xs">{folder.id}</td>
                        <td className="py-2 px-4 text-xs">{folder.mimeType}</td>
                        <td className="py-2 px-4 text-xs">{new Date(folder.createdTime).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
} 