import React, { useCallback, useEffect, useState } from 'react';
import Spinner from '../../components/Spinner';
import { Bell, CheckCircle2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { api, isAborted } from '../../lib/api';

// R-15 (F23, D§8.1): loading, empty and error are three distinct states; a failed
// load is never shown as "No notifications yet". "Mark read" updates only the one
// row it names (the old updater put the whole list in place of every other row),
// and a failed mark is reported on that row instead of being swallowed.

const getNotificationStyle = (notification) => {
  const type = notification.type || '';

  if (type === 'rejected') {
    return {
      container: 'bg-destructive/5 border border-destructive/20',
      iconBg: 'bg-destructive/10 text-destructive',
      icon: XCircle,
      message: 'text-destructive',
    };
  }

  if (type === 'shortlisted') {
    return {
      container: 'bg-success/5 border border-success/20',
      iconBg: 'bg-success/10 text-success',
      icon: CheckCircle,
      message: 'text-success',
    };
  }

  return {
    container: 'bg-muted/50 border border-border',
    iconBg: 'bg-muted text-muted-foreground',
    icon: Bell,
    message: 'text-foreground',
  };
};

const formatTime = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : null;
};

function CandidateNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [marking, setMarking] = useState({}); // id -> true while the request runs
  const [markErrors, setMarkErrors] = useState({}); // id -> message

  const loadNotifications = useCallback(async (signal) => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.get('/api/notifications', { signal, cache: 'no-store' });
      setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
    } catch (err) {
      if (isAborted(err)) return;
      setLoadError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadNotifications(controller.signal);
    return () => controller.abort();
  }, [loadNotifications]);

  const markAsRead = async (id) => {
    setMarking((prev) => ({ ...prev, [id]: true }));
    setMarkErrors((prev) => {
      const { [id]: _dropped, ...rest } = prev;
      return rest;
    });
    try {
      await api.post(`/api/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (err) {
      setMarkErrors((prev) => ({ ...prev, [id]: err.message }));
    } finally {
      setMarking((prev) => {
        const { [id]: _done, ...rest } = prev;
        return rest;
      });
    }
  };

  let body;
  if (loading) {
    body = (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
        <Spinner size="lg" />
        <p className="text-body-sm text-muted-foreground">Loading notifications...</p>
      </div>
    );
  } else if (loadError) {
    body = (
      <div role="alert" className="card p-6 border-destructive/30">
        <p className="font-semibold text-destructive">Could not load your notifications.</p>
        <p className="mt-1 text-sm text-destructive">{loadError}</p>
        <button
          type="button"
          onClick={() => loadNotifications()}
          className="mt-4 inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
      </div>
    );
  } else if (notifications.length === 0) {
    body = <p className="text-body-sm text-muted-foreground text-center py-10">No notifications yet.</p>;
  } else {
    body = (
      <ul className="space-y-3">
        {notifications.map((notification) => {
          const style = getNotificationStyle(notification);
          const Icon = style.icon;
          const time = formatTime(notification.created_at);

          return (
            <li
              key={notification.id}
              className={`card p-4 flex items-start gap-3 ${style.container} ${notification.read ? 'opacity-75' : ''}`}
            >
              <div className={`mt-0.5 rounded-md p-2 ${style.iconBg}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${style.message}`}>{notification.message}</p>
                {time && <p className="text-xs text-muted-foreground mt-1">{time}</p>}
                {markErrors[notification.id] && (
                  <p role="alert" className="text-xs text-destructive mt-1">
                    Could not mark as read: {markErrors[notification.id]}
                  </p>
                )}
              </div>
              {!notification.read && (
                <button
                  type="button"
                  onClick={() => markAsRead(notification.id)}
                  disabled={Boolean(marking[notification.id])}
                  className="text-xs text-foreground hover:text-foreground/80 transition-colors flex items-center gap-1 disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {marking[notification.id] ? 'Marking...' : 'Mark read'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-extrabold text-foreground mb-6">Notifications</h1>
      {body}
    </div>
  );
}

export default CandidateNotifications;
