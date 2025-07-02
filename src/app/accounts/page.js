'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  FaGoogle, 
  FaYoutube, 
  FaPlus, 
  FaCheck, 
  FaExclamationTriangle,
  FaEye,
  FaTrash,
  FaRefresh,
  FaCog
} from 'react-icons/fa';

export default function AccountsPage() {
  const { data: session } = useSession();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectingAccount, setConnectingAccount] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      // Simulate API call - replace with real implementation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setAccounts([
        {
          id: '1',
          email: 'john.doe@gmail.com',
          name: 'John Doe',
          avatar: '/android-chrome-192x192.png',
          type: 'google',
          status: 'connected',
          youtubeChannels: [
            {
              id: 'UC123',
              name: 'John Tech Channel',
              subscribers: '12.5K',
              status: 'active'
            },
            {
              id: 'UC456',
              name: 'Gaming with John',
              subscribers: '8.2K',
              status: 'active'
            }
          ],
          driveInfo: {
            totalSpace: '15 GB',
            usedSpace: '8.3 GB'
          },
          lastSync: '2 minutes ago'
        },
        {
          id: '2',
          email: 'business@company.com',
          name: 'Business Account',
          avatar: '/android-chrome-192x192.png',
          type: 'google',
          status: 'connected',
          youtubeChannels: [
            {
              id: 'UC789',
              name: 'Company Official',
              subscribers: '25.1K',
              status: 'active'
            }
          ],
          driveInfo: {
            totalSpace: '100 GB',
            usedSpace: '45.7 GB'
          },
          lastSync: '5 minutes ago'
        },
        {
          id: '3',
          email: 'backup@gmail.com',
          name: 'Backup Account',
          avatar: '/android-chrome-192x192.png',
          type: 'google',
          status: 'expired',
          youtubeChannels: [],
          driveInfo: {
            totalSpace: '15 GB',
            usedSpace: '2.1 GB'
          },
          lastSync: '2 days ago'
        }
      ]);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectNewAccount = async () => {
    setConnectingAccount(true);
    try {
      // Simulate account connection
      await new Promise(resolve => setTimeout(resolve, 2000));
      // Refresh accounts list
      await loadAccounts();
    } catch (error) {
      console.error('Error connecting account:', error);
    } finally {
      setConnectingAccount(false);
    }
  };

  const refreshAccount = async (accountId) => {
    try {
      // Simulate refresh
      console.log('Refreshing account:', accountId);
    } catch (error) {
      console.error('Error refreshing account:', error);
    }
  };

  const disconnectAccount = async (accountId) => {
    if (confirm('Are you sure you want to disconnect this account?')) {
      try {
        // Simulate disconnect
        console.log('Disconnecting account:', accountId);
        await loadAccounts();
      } catch (error) {
        console.error('Error disconnecting account:', error);
      }
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Connected Accounts</h1>
          <p className="text-gray-600">Manage your Google accounts and YouTube channels</p>
        </div>
        
        <button
          onClick={connectNewAccount}
          disabled={connectingAccount}
          className="btn btn-primary"
        >
          <FaPlus />
          {connectingAccount ? 'Connecting...' : 'Connect Account'}
        </button>
      </div>

      {/* Accounts Grid */}
      <div className="space-y-6">
        {accounts.map((account) => (
          <div key={account.id} className="card">
            {/* Account Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 relative">
                    <img
                      src={account.avatar}
                      alt={account.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{account.name}</h3>
                      <div className={`status-badge ${
                        account.status === 'connected' ? 'status-success' :
                        account.status === 'expired' ? 'status-warning' :
                        'status-error'
                      }`}>
                        {account.status === 'connected' && <FaCheck />}
                        {account.status === 'expired' && <FaExclamationTriangle />}
                        {account.status}
                      </div>
                    </div>
                    <p className="text-gray-600">{account.email}</p>
                    <p className="text-sm text-gray-500">Last sync: {account.lastSync}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => refreshAccount(account.id)}
                    className="btn btn-ghost"
                    title="Refresh account"
                  >
                    <FaRefresh />
                  </button>
                  <button
                    onClick={() => disconnectAccount(account.id)}
                    className="btn btn-ghost text-red-600 hover:text-red-800"
                    title="Disconnect account"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            </div>

            {/* Account Details */}
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* YouTube Channels */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FaYoutube className="text-red-600" />
                    YouTube Channels ({account.youtubeChannels.length})
                  </h4>
                  
                  {account.youtubeChannels.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <FaYoutube className="text-gray-400 text-3xl mx-auto mb-4" />
                      <p className="text-gray-600">No YouTube channels found</p>
                      <button className="btn btn-secondary mt-4">
                        <FaRefresh />
                        Refresh Channels
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {account.youtubeChannels.map((channel) => (
                        <div key={channel.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div>
                            <h5 className="font-medium text-gray-900">{channel.name}</h5>
                            <p className="text-sm text-gray-600">{channel.subscribers} subscribers</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`status-badge ${
                              channel.status === 'active' ? 'status-success' : 'status-warning'
                            }`}>
                              {channel.status}
                            </div>
                            <button className="btn btn-ghost btn-sm">
                              <FaEye />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Google Drive Info */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FaGoogle className="text-blue-600" />
                    Google Drive Storage
                  </h4>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Storage Used</span>
                        <span className="text-sm font-medium text-gray-900">
                          {account.driveInfo.usedSpace} / {account.driveInfo.totalSpace}
                        </span>
                      </div>
                      
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: '55%' }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button className="btn btn-secondary flex-1">
                        <FaEye />
                        Browse Files
                      </button>
                      <button className="btn btn-ghost">
                        <FaCog />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {accounts.length === 0 && (
        <div className="text-center py-12">
          <FaGoogle className="text-gray-400 text-6xl mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-gray-900 mb-4">No accounts connected</h3>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Connect your Google account to start managing your YouTube channels and Google Drive files.
          </p>
          <button
            onClick={connectNewAccount}
            disabled={connectingAccount}
            className="btn btn-primary"
          >
            <FaPlus />
            {connectingAccount ? 'Connecting...' : 'Connect Your First Account'}
          </button>
        </div>
      )}
    </div>
  );
}
