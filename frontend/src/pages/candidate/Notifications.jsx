import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../../components/Spinner';
import { Bell, CheckCircle2, CheckCircle, XCircle } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function CandidateNotifications() {
  const { authFetch } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const response = await authFetch(`${API_BASE_URL}/api/notifications`);
        const data = await response.json();
        if (response.ok) {
          setNotifications(data.notifications || []);
        }
      } catch (err) {
        console.error('Failed to load notifications:', err);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [authFetch]);

  const markAsRead = async (id) => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
        method: 'POST',
      });
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, read: true } : prev)
        );
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const getNotificationStyle = (notification) => {
    const type = notification.type || '';
    const isRejected = type === 'rejected';
    const isShortlisted = type === 'shortlisted';

    if (isRejected) {
      return {
        container: 'bg-destructive/5 border border-destructive/20',
        iconBg: 'bg-destructive/10 text-destructive',
        icon: XCircle,
        message: 'text-destructive',
        badge: 'bg-destructive/10 text-destructive',
      };
    }

    if (isShortlisted) {
      return {
        container: 'bg-success/5 border border-success/20',
        iconBg: 'bg-success/10 text-success',
        icon: CheckCircle,
        message: 'text-success',
        badge: 'bg-success/10 text-success',
      };
    }

    return {
      container: 'bg-muted/50 border border-border',
      iconBg: 'bg-muted text-muted-foreground',
      icon: Bell,
      message: 'text-foreground',
      badge: 'bg-muted text-muted-foreground',
    };
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Spinner size="lg" />
        <p className="text-body-sm text-muted-foreground">Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-extrabold text-foreground mb-6">Notifications</h1>
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <p className="text-body-sm text-muted-foreground text-center py-10">No notifications yet.</p>
        ) : (
          notifications.map((notification) => {
            const style = getNotificationStyle(notification);
            const Icon = style.icon;

            return (
              <div
                key={notification.id}
                className={`card p-4 flex items-start gap-3 ${style.container} ${notification.read ? 'opacity-75' : ''}`}
              >
                <div className={`mt-0.5 rounded-md p-2 ${style.iconBg}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${style.message}`}>{notification.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(notification.created_at).toLocaleString()}
                  </p>
                </div>
                {!notification.read && (
                  <button
                    onClick={() => markAsRead(notification.id)}
                    className="text-xs text-foreground hover:text-foreground/80 transition-colors flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark read
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default CandidateNotifications;
