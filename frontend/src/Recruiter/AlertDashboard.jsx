import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, AlertCircle, Info, CheckCircle, XCircle,
  Shield, Eye, Clock, Filter, Users
} from 'lucide-react';
import EmptyState from '../components/EmptyState';

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
};

const MOCK_ALERTS = [
  {
    id: 'a1',
    candidateName: 'Priya Sharma',
    candidateId: 'c1',
    severity: 'high',
    type: 'skill_mismatch',
    message: 'Claims "Expert" in Python but scored 12/100 on Python assessment.',
    detail: 'Resume lists 5 Python projects, but GitHub shows 0 Python repositories. Assessment performance contradicts claimed expertise.',
    timestamp: '2 hours ago',
    jobTitle: 'Full Stack Developer',
    read: false,
  },
  {
    id: 'a2',
    candidateName: 'Arjun Patel',
    candidateId: 'c2',
    severity: 'high',
    type: 'plagiarism',
    message: 'Potential resume content duplication detected.',
    detail: 'Project descriptions match 3 other applicants verbatim. Possible copy-paste from a shared template.',
    timestamp: '5 hours ago',
    jobTitle: 'Backend Engineer',
    read: false,
  },
  {
    id: 'a3',
    candidateName: 'Neha Gupta',
    candidateId: 'c3',
    severity: 'medium',
    type: 'inconsistency',
    message: 'Claims 3 years of React experience but first commit in React repo is 4 months old.',
    detail: 'GitHub activity timeline does not align with stated experience duration.',
    timestamp: '1 day ago',
    jobTitle: 'Frontend Developer',
    read: true,
  },
  {
    id: 'a4',
    candidateName: 'Rohit Kumar',
    candidateId: 'c4',
    severity: 'medium',
    type: 'unverified',
    message: 'Docker listed as primary skill with zero verification.',
    detail: 'No GitHub repositories contain Dockerfiles. No assessment questions answered for containerization topics.',
    timestamp: '1 day ago',
    jobTitle: 'DevOps Engineer',
    read: true,
  },
  {
    id: 'a5',
    candidateName: 'Sneha Reddy',
    candidateId: 'c5',
    severity: 'low',
    type: 'incomplete',
    message: 'Assessment partially completed — 2 of 5 questions unanswered.',
    detail: 'Skipped the system design and database architecture questions. Partial results may not reflect full capability.',
    timestamp: '2 days ago',
    jobTitle: 'Full Stack Developer',
    read: true,
  },
  {
    id: 'a6',
    candidateName: 'Vikram Singh',
    candidateId: 'c6',
    severity: 'low',
    type: 'info',
    message: 'GitHub profile is private — limited verification possible.',
    detail: 'Candidate connected GitHub OAuth but repositories are private. Only public contribution data available.',
    timestamp: '3 days ago',
    jobTitle: 'Software Engineer',
    read: true,
  },
];

function AlertDashboard() {
  const [alerts, setAlerts] = useState(MOCK_ALERTS);
  const [filterSeverity, setFilterSeverity] = useState('all');

  const filtered = filterSeverity === 'all'
    ? alerts
    : alerts.filter((a) => a.severity === filterSeverity);

  const unreadCount = alerts.filter((a) => !a.read).length;

  const severityConfig = {
    high: {
      icon: AlertTriangle,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
      border: 'border-destructive/20',
      label: 'High',
    },
    medium: {
      icon: AlertCircle,
      color: 'text-warning',
      bg: 'bg-warning/10',
      border: 'border-warning/20',
      label: 'Medium',
    },
    low: {
      icon: Info,
      color: 'text-muted-foreground',
      bg: 'bg-secondary',
      border: 'border-border',
      label: 'Low',
    },
  };

  const markAsRead = (id) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, read: true } : a))
    );
  };

  const markAllRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
  };

  return (
    <div>
      <motion.div {...fadeUp} className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-h1 text-foreground">Alerts</h1>
            <p className="text-body text-muted-foreground mt-1">
              Flagged inconsistencies and verification warnings
            </p>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-body-sm text-primary hover:text-primary/80 transition-colors">
              Mark all read ({unreadCount})
            </button>
          )}
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div {...fadeUp} transition={{ delay: 0.05, duration: 0.35 }} className="grid grid-cols-3 gap-4 mb-4">
        <div className="card p-4 text-center">
          <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </div>
          <p className="text-h2 font-bold text-foreground">
            {alerts.filter((a) => a.severity === 'high').length}
          </p>
          <p className="text-caption text-muted-foreground">High Severity</p>
        </div>
        <div className="card p-4 text-center">
          <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-2">
            <AlertCircle className="w-4 h-4 text-warning" />
          </div>
          <p className="text-h2 font-bold text-foreground">
            {alerts.filter((a) => a.severity === 'medium').length}
          </p>
          <p className="text-caption text-muted-foreground">Medium</p>
        </div>
        <div className="card p-4 text-center">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center mx-auto mb-2">
            <Info className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-h2 font-bold text-foreground">
            {alerts.filter((a) => a.severity === 'low').length}
          </p>
          <p className="text-caption text-muted-foreground">Low</p>
        </div>
      </motion.div>

      {/* Filter */}
      <motion.div {...fadeUp} transition={{ delay: 0.1, duration: 0.35 }} className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-muted-foreground" />
        {['all', 'high', 'medium', 'low'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterSeverity(s)}
            className={`px-3 py-1.5 rounded-md text-caption font-medium transition-colors ${
              filterSeverity === s
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            {s === 'high' && alerts.filter((a) => a.severity === 'high' && !a.read).length > 0 && (
              <span className="ml-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] inline-flex items-center justify-center">
                {alerts.filter((a) => a.severity === 'high' && !a.read).length}
              </span>
            )}
          </button>
        ))}
      </motion.div>

      {/* Alerts List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title="No Alerts"
          description="All candidates look good — no inconsistencies flagged."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((alert, index) => {
            const severity = severityConfig[alert.severity];
            const SevIcon = severity.icon;

            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`card p-4 ${!alert.read ? 'ring-1 ring-primary/20' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full ${severity.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <SevIcon className={`w-4 h-4 ${severity.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-body-sm font-medium text-foreground">
                        {alert.candidateName}
                      </h3>
                      <span className={`badge text-[10px] ${severity.bg} ${severity.color} border ${severity.border}`}>
                        {severity.label}
                      </span>
                      {!alert.read && (
                        <span className="badge badge-primary text-[10px]">New</span>
                      )}
                    </div>

                    <p className="text-body-sm text-foreground font-medium mb-1">
                      {alert.message}
                    </p>

                    <p className="text-caption text-muted-foreground mb-2">
                      {alert.detail}
                    </p>

                    <div className="flex items-center gap-3 text-caption text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        {alert.jobTitle}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {alert.timestamp}
                      </span>
                    </div>
                  </div>

                  {!alert.read && (
                    <button
                      onClick={() => markAsRead(alert.id)}
                      className="text-caption text-primary hover:text-primary/80 transition-colors flex-shrink-0"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AlertDashboard;
