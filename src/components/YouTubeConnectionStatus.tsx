'use client';

import { useEffect, useState } from 'react';
import { FaSync } from 'react-icons/fa';
import { useAccounts } from '@/contexts/AccountContext';
import { useMultiChannel } from '@/contexts/MultiChannelContext';

// Component to show YouTube connection status for the active account
export default function YouTubeConnectionStatus({ onRefreshSuccess }) {
  const { activeAccount, loading: accountLoading } = useAccounts();
  const { getChannelStatus, refreshChannel } = useMultiChannel();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch status when active account changes
  useEffect(() => {
    if (!activeAccount) return;
    setLoading(true);
    getChannelStatus(activeAccount.id)
      .then((res) => {
        if (res.success) {
          setStatus(res.status);
        } else {
          setStatus('error');
        }
      })
      .catch(() => setStatus('error'))
      .finally(() => setLoading(false));
  }, [activeAccount, getChannelStatus]);

  const handleRefresh = async () => {
    if (!activeAccount) return;
    setLoading(true);
    await refreshChannel(activeAccount.id, true);
    // Re-fetch status after refresh
    try {
      const res = await getChannelStatus(activeAccount.id);
      if (res.success) {
        setStatus(res.status);
      }
    } catch {}
    setLoading(false);
    if (onRefreshSuccess) onRefreshSuccess();
  };

  if (accountLoading) {
    return <div className="flex items-center gap-2"><FaSync className="animate-spin" /> Loading account...</div>;
  }

  if (!activeAccount) {
    return <div className="flex items-center gap-2">No active account</div>;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-medium">YouTube Status:</span>
      {loading ? (
        <FaSync className="animate-spin" />
      ) : (
        <span>{status || 'unknown'}</span>
      )}
      <button
        onClick={handleRefresh}
        title="Refresh YouTube status"
        className="p-1 hover:text-blue-600 dark:hover:text-blue-400"
      >
        <FaSync />
      </button>
    </div>
  );
}
