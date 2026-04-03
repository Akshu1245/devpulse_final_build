/**
 * DevPulse Notification Center
 * 
 * Central hub for all notifications and alerts.
 */

import React, { useState, useEffect, useRef } from 'react';
import './NotificationCenter.css';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export type NotificationType =
  | 'vulnerability_found'
  | 'scan_complete'
  | 'budget_alert'
  | 'compliance_issue'
  | 'shadow_api_detected'
  | 'agent_guard_triggered'
  | 'system_alert'
  | 'welcome'
  | 'info';

interface NotificationCenterProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDismiss,
  onClearAll,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationType | 'all'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredNotifications = notifications.filter(
    (n) => filter === 'all' || n.type === filter
  );

  const groupedByDate = groupByDate(filteredNotifications);

  const getNotificationIcon = (type: NotificationType) => {
    const icons: Record<NotificationType, React.ReactNode> = {
      vulnerability_found: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 2L2 18h16L10 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M10 8v4M10 14v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
      scan_complete: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
          <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      budget_alert: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
          <path d="M10 6v.5M10 13.5v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M7 9h6M7 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
      compliance_issue: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M3 8h14" stroke="currentColor" strokeWidth="2" />
          <circle cx="6.5" cy="6.5" r="0.5" fill="currentColor" />
        </svg>
      ),
      shadow_api_detected: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2" />
          <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
      agent_guard_triggered: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 2L3 5v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V5l-7-3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      system_alert: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
          <path d="M10 6v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="10" cy="14" r="1" fill="currentColor" />
        </svg>
      ),
      welcome: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 2a8 8 0 100 16 8 8 0 000-16z" stroke="currentColor" strokeWidth="2" />
          <path d="M8 10l4-4 2 2-4 4H8v-2z" fill="currentColor" />
        </svg>
      ),
      info: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
          <path d="M10 9v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="10" cy="6.5" r="1" fill="currentColor" />
        </svg>
      ),
    };
    return icons[type];
  };

  const getPriorityColor = (priority: Notification['priority']) => {
    const colors = {
      low: '#6b7280',
      medium: '#f59e0b',
      high: '#ef4444',
      critical: '#dc2626',
    };
    return colors[priority];
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="notification-center" ref={dropdownRef}>
      <button
        className="notification-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M18 8A6 6 0 106 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            <div className="header-actions">
              {unreadCount > 0 && (
                <button className="mark-all-btn" onClick={onMarkAllAsRead}>
                  Mark all as read
                </button>
              )}
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="filter-select"
              >
                <option value="all">All</option>
                <option value="vulnerability_found">Vulnerabilities</option>
                <option value="scan_complete">Scans</option>
                <option value="budget_alert">Budget</option>
                <option value="system_alert">System</option>
              </select>
            </div>
          </div>

          <div className="notification-list">
            {groupedByDate.length === 0 ? (
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="20" stroke="#d1d5db" strokeWidth="2" />
                  <path
                    d="M24 14v10l6 4"
                    stroke="#d1d5db"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <p>No notifications</p>
              </div>
            ) : (
              groupedByDate.map((group) => (
                <div key={group.date} className="notification-group">
                  <div className="group-header">{group.date}</div>
                  {group.items.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={onMarkAsRead}
                      onDismiss={onDismiss}
                      getIcon={getNotificationIcon}
                      getPriorityColor={getPriorityColor}
                      formatTime={formatTime}
                    />
                  ))}
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="notification-footer">
              <button className="clear-all-btn" onClick={onClearAll}>
                Clear all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Notification Item Component
interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDismiss: (id: string) => void;
  getIcon: (type: NotificationType) => React.ReactNode;
  getPriorityColor: (priority: Notification['priority']) => string;
  formatTime: (date: Date) => string;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onDismiss,
  getIcon,
  getPriorityColor,
  formatTime,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`notification-item ${notification.read ? 'read' : 'unread'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => !notification.read && onMarkAsRead(notification.id)}
    >
      <div
        className="notification-icon"
        style={{ color: getPriorityColor(notification.priority) }}
      >
        {getIcon(notification.type)}
      </div>

      <div className="notification-content">
        <div className="notification-title">{notification.title}</div>
        <div className="notification-message">{notification.message}</div>
        <div className="notification-meta">
          <span className="notification-time">{formatTime(notification.timestamp)}</span>
          {notification.priority === 'critical' && (
            <span className="priority-badge critical">Critical</span>
          )}
          {notification.priority === 'high' && (
            <span className="priority-badge high">High</span>
          )}
        </div>
      </div>

      {isHovered && (
        <div className="notification-actions">
          {!notification.read && (
            <button
              className="action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead(notification.id);
              }}
              title="Mark as read"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 8l3 3 7-7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          <button
            className="action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(notification.id);
            }}
            title="Dismiss"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

// Helper function to group notifications by date
function groupByDate(notifications: Notification[]) {
  const groups: { date: string; items: Notification[] }[] = [];
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const formatDateLabel = (date: Date) => {
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const sorted = [...notifications].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );

  let currentGroup: { date: string; items: Notification[] } | null = null;

  for (const notification of sorted) {
    const label = formatDateLabel(notification.timestamp);
    if (!currentGroup || currentGroup.date !== label) {
      currentGroup = { date: label, items: [] };
      groups.push(currentGroup);
    }
    currentGroup.items.push(notification);
  }

  return groups;
}

// Demo data for testing
export const demoNotifications: Notification[] = [
  {
    id: '1',
    type: 'vulnerability_found',
    title: 'Critical SQL Injection Found',
    message: 'Endpoint /api/users is vulnerable to SQL injection via the id parameter.',
    timestamp: new Date(Date.now() - 5 * 60000),
    read: false,
    priority: 'critical',
    actionUrl: '/vulnerabilities/1',
  },
  {
    id: '2',
    type: 'budget_alert',
    title: 'Budget Threshold Reached',
    message: 'You have used 85% of your monthly LLM budget ($85 of $100).',
    timestamp: new Date(Date.now() - 30 * 60000),
    read: false,
    priority: 'high',
    actionUrl: '/costs',
  },
  {
    id: '3',
    type: 'scan_complete',
    title: 'Scan Complete',
    message: 'Weekly security scan completed. Found 3 new vulnerabilities.',
    timestamp: new Date(Date.now() - 2 * 3600000),
    read: true,
    priority: 'medium',
    actionUrl: '/scans/123',
  },
  {
    id: '4',
    type: 'shadow_api_detected',
    title: 'Shadow API Detected',
    message: 'Undocumented API endpoint /api/internal/metrics detected in traffic.',
    timestamp: new Date(Date.now() - 24 * 3600000),
    read: true,
    priority: 'medium',
  },
  {
    id: '5',
    type: 'agent_guard_triggered',
    title: 'Agent Paused',
    message: 'Claude Agent "code-reviewer" was paused due to excessive API usage.',
    timestamp: new Date(Date.now() - 2 * 24 * 3600000),
    read: true,
    priority: 'high',
    actionUrl: '/agent-guard',
  },
];

export default NotificationCenter;
