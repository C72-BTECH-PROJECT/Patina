import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Filter, ChevronRight, Users, Briefcase, CheckCircle, Clock, XCircle, FileText, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../../components/Spinner';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

function AllCandidates() {
  const { authFetch } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    const loadCandidates = async () => {
      try {
        const response = await authFetch(`${API_BASE_URL}/api/recruiter/applicants`);
        if (response.ok) {
          const data = await response.json();
          setCandidates(data || []);
        }
      } catch (err) {
        console.error('Failed to load candidates:', err);
      } finally {
        setLoading(false);
      }
    };
    loadCandidates();
  }, [authFetch]);

  const filteredCandidates = React.useMemo(() => {
    let filtered = [...candidates];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.candidateInfo?.name?.toLowerCase().includes(query) ||
        c.candidateInfo?.email?.toLowerCase().includes(query) ||
        c.jobTitle?.toLowerCase().includes(query)
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(c => c.status === filterStatus);
    }

    return filtered.sort((a, b) => (b.credibilityScore || 0) - (a.credibilityScore || 0));
  }, [candidates, searchQuery, filterStatus]);

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const viewResume = async (candidateId) => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/resume/candidate/${candidateId}`);
      if (!response.ok) {
        alert('Resume not found for this candidate.');
        return;
      }
      const data = await response.json();
      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('Failed to open resume:', err);
      alert('Could not open resume.');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      shortlisted: 'bg-success/10 text-success border-success/20',
      rejected: 'bg-destructive/10 text-destructive border-destructive/20',
      applied: 'bg-warning/10 text-warning border-warning/20',
    };
    const icons = {
      shortlisted: CheckCircle,
      rejected: XCircle,
      applied: Clock,
    };
    const Icon = icons[status] || Clock;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.applied}`}>
        <Icon className="w-3 h-3" />
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Spinner size="lg" />
        <p className="text-body-sm text-muted-foreground">Loading all candidates...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/recruiter/dashboard" className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">All Candidates</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filteredCandidates.length} candidate{filteredCandidates.length !== 1 ? 's' : ''} across all jobs
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search candidates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Statuses</option>
          <option value="applied">Pending</option>
          <option value="shortlisted">Shortlisted</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {filteredCandidates.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No candidates found</h3>
          <p className="text-sm text-muted-foreground">
            {searchQuery || filterStatus !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'No candidates have applied for your jobs yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCandidates.map((candidate, index) => (
            <motion.div
              key={candidate.applicationId || candidate._id || index}
              className="card p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-foreground text-lg">
                      {(candidate.candidateInfo?.name || 'UN').split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground truncate">
                        {candidate.candidateInfo?.name || 'Unknown'}
                      </h3>
                      {getStatusBadge(candidate.status)}
                    </div>
                    <div className="text-sm text-muted-foreground truncate mt-0.5">
                      {candidate.candidateInfo?.email || 'No contact info'}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        {candidate.jobTitle || 'Unknown Job'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className={`text-2xl font-extrabold ${getScoreColor(candidate.credibilityScore)}`}>
                      {candidate.credibilityScore}
                    </div>
                    <div className="text-xs text-muted-foreground">Score</div>
                  </div>
                  <button
                    onClick={() => viewResume(candidate.candidateId)}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                    title="View resume"
                  >
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </button>
                  <Link
                    to={`/recruiter/jobs/${candidate.jobId}`}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                    title="View job"
                  >
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AllCandidates;
