'use client';

import { useCallback, useEffect, useState } from 'react';

interface NewsletterStats {
  totalSubscribers: number;
  confirmedSubscribers: number;
  pendingSubscribers: number;
  unsubscribedSubscribers: number;
  totalEditions: number;
  sentEditions: number;
  totalEmailsSent: number;
  totalOpens: number;
  totalClicks: number;
  averageOpenRate: number;
  averageClickRate: number;
}

interface NewsletterEdition {
  id: string;
  title: string;
  status: string;
  sentAt: number | null;
  recipientCount: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
  createdAt: number;
}

export default function AdminNewsletterPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [stats, setStats] = useState<NewsletterStats | null>(null);
  const [editions, setEditions] = useState<NewsletterEdition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const fetchStats = useCallback(() => {
    void fetch('/api/admin/newsletter/stats', {
      headers: { 'X-Admin-Key': adminKey },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStats(data.stats);
        }
      })
      .catch(() => {
        // Silently ignore stats refresh failures
      });
  }, [adminKey]);

  const fetchEditions = useCallback(() => {
    void fetch('/api/admin/newsletter/editions', {
      headers: { 'X-Admin-Key': adminKey },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setEditions(data.editions);
        }
      })
      .catch(() => {
        // Editions endpoint might not exist yet
        setEditions([]);
      });
  }, [adminKey]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
      fetchEditions();
    }
  }, [fetchEditions, fetchStats, isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    fetch('/api/admin/newsletter/stats', {
      headers: { 'X-Admin-Key': adminKey },
    })
      .then((res) => {
        if (res.ok) {
          return res.json();
        }
        throw new Error('Unauthorized');
      })
      .then((data) => {
        setStats(data.stats);
        setIsAuthenticated(true);
      })
      .catch(() => {
        setError('Invalid admin key');
      })
      .finally(() => setLoading(false));
  };

  const handlePreview = async () => {
    setActionLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/newsletter/generate?language=en&daysBack=7', {
        headers: { 'X-Admin-Key': adminKey },
      });

      const data = await res.json();

      if (data.success) {
        setPreviewHtml(data.newsletter.contentHtml);
        setShowPreview(true);
      } else {
        setError(data.error || 'Failed to generate preview');
      }
    } catch {
      setError('Network error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSend = async () => {
    if (!confirm('Are you sure you want to generate and send the newsletter to all subscribers?')) {
      return;
    }

    setActionLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/newsletter/generate', {
        method: 'POST',
        headers: {
          'X-Admin-Key': adminKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ send: true, language: 'en', daysBack: 7 }),
      });

      const data = await res.json();

      if (data.success) {
        setActionMessage(data.message);
        fetchStats();
        fetchEditions();
      } else {
        setError(data.error || 'Failed to send newsletter');
      }
    } catch {
      setError('Network error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendTest = async () => {
    const testEmail = prompt('Enter test email address:');
    if (!testEmail) {
      return;
    }

    setActionLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/newsletter/test', {
        method: 'POST',
        headers: {
          'X-Admin-Key': adminKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testEmail,
          title: 'Test Newsletter from BestBlogs.dev',
          content:
            "<p>This is a test newsletter.</p><p>If you're seeing this, the email system is working correctly!</p>",
        }),
      });

      const data = await res.json();

      if (data.success) {
        setActionMessage('Test email sent successfully!');
      } else {
        setError(data.error || 'Failed to send test email');
      }
    } catch {
      setError('Network error');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            Newsletter Admin
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Enter your admin key to continue.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="adminKey"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Admin Key
              </label>
              <input
                type="password"
                id="adminKey"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {loading ? 'Verifying...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
            Newsletter Admin
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Manage subscribers and send newsletters
          </p>
        </div>
        <button
          onClick={() => setIsAuthenticated(false)}
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Logout
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Total Subscribers</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
              {stats.totalSubscribers}
            </p>
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">
              {stats.confirmedSubscribers} confirmed
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Emails Sent</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
              {stats.totalEmailsSent}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Open Rate</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
              {(stats.averageOpenRate * 100).toFixed(1)}%
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Click Rate</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
              {(stats.averageClickRate * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mb-8 space-y-4">
        <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Actions</h2>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              void handlePreview();
            }}
            disabled={actionLoading}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {actionLoading ? 'Generating...' : 'Preview Newsletter'}
          </button>

          <button
            onClick={() => {
              void handleSend();
            }}
            disabled={actionLoading}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {actionLoading ? 'Sending...' : 'Generate & Send'}
          </button>

          <button
            onClick={() => {
              void handleSendTest();
            }}
            disabled={actionLoading}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {actionLoading ? 'Sending...' : 'Send Test Email'}
          </button>
        </div>

        {actionMessage && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
            {actionMessage}
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-6 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                Newsletter Preview
              </h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Close
              </button>
            </div>
            <div
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      )}

      {/* Recent Editions */}
      {editions.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Recent Newsletters
          </h2>
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Title</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Status</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                    Recipients
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Opens</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {editions.map((edition) => (
                  <tr key={edition.id}>
                    <td className="px-4 py-3 text-zinc-950 dark:text-zinc-50">{edition.title}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full px-2 py-1 text-xs font-medium">
                        {edition.status === 'sent' && (
                          <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Sent
                          </span>
                        )}
                        {edition.status === 'draft' && (
                          <span className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                            Draft
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {edition.recipientCount}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {edition.openCount}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {edition.sentAt ? new Date(edition.sentAt).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
