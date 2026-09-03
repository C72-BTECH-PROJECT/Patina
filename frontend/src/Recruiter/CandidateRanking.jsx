import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Medal, Award, CheckCircle, XCircle, Clock,
  ChevronDown, ArrowUpDown, Filter, Users
} from 'lucide-react';
import { jobs, applications, candidates } from '../data/recruiter/mockData';
import EmptyState from '../components/EmptyState';
import ScoreExplainability from './components/ScoreExplainability';

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
};

function CandidateRanking() {
  const [selectedJob, setSelectedJob] = useState('all');
  const [sortBy, setSortBy] = useState('score');
  const [expandedRank, setExpandedRank] = useState(null);

  // Build candidate list with scores
  const candidateMap = {};
  applications.forEach((app) => {
    const candidate = candidates.find((c) => c._id === app.candidate);
    if (!candidate) return;

    if (!candidateMap[app.candidate]) {
      candidateMap[app.candidate] = {
        ...candidate,
        applications: [],
        avgScore: 0,
        highestScore: 0,
        totalApps: 0,
      };
    }
    candidateMap[app.candidate].applications.push(app);
    candidateMap[app.candidate].totalApps += 1;
    candidateMap[app.candidate].highestScore = Math.max(
      candidateMap[app.candidate].highestScore,
      app.credibilityScore
    );
  });

  // Calculate average scores
  Object.values(candidateMap).forEach((c) => {
    const scores = c.applications.map((a) => a.credibilityScore);
    c.avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  });

  let ranked = Object.values(candidateMap);

  // Filter by job
  if (selectedJob !== 'all') {
    ranked = ranked.filter((c) =>
      c.applications.some((a) => a.job === selectedJob)
    );
  }

  // Sort
  if (sortBy === 'score') {
    ranked.sort((a, b) => b.highestScore - a.highestScore);
  } else if (sortBy === 'name') {
    ranked.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (sortBy === 'apps') {
    ranked.sort((a, b) => b.totalApps - a.totalApps);
  }

  const getRankBadge = (index) => {
    if (index === 0) return { icon: Trophy, color: 'text-warning', bg: 'bg-warning/10', label: '#1' };
    if (index === 1) return { icon: Medal, color: 'text-muted-foreground', bg: 'bg-secondary', label: '#2' };
    if (index === 2) return { icon: Award, color: 'text-warning/60', bg: 'bg-warning/5', label: '#3' };
    return { icon: null, color: 'text-muted-foreground', bg: '', label: `#${index + 1}` };
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div>
      <motion.div {...fadeUp} className="mb-6">
        <h1 className="text-h1 text-foreground">Candidate Rankings</h1>
        <p className="text-body text-muted-foreground mt-1">
          Candidates ranked by credibility score across all job applications
        </p>
      </motion.div>

      {/* Filters */}
      <motion.div {...fadeUp} transition={{ delay: 0.05, duration: 0.35 }} className="card p-4 mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={selectedJob}
              onChange={(e) => setSelectedJob(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-background px-3 text-body-sm text-foreground appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All Jobs</option>
              {jobs.map((job) => (
                <option key={job._id} value={job._id}>{job.title}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            <span className="text-caption text-muted-foreground">Sort:</span>
            {['score', 'name', 'apps'].map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-2.5 py-1 rounded-md text-caption font-medium transition-colors ${
                  sortBy === s
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                {s === 'score' ? 'Score' : s === 'name' ? 'Name' : 'Applications'}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Stats Bar */}
      <motion.div {...fadeUp} transition={{ delay: 0.1, duration: 0.35 }} className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 text-center">
          <Users className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-h2 font-bold text-foreground">{ranked.length}</p>
          <p className="text-caption text-muted-foreground">Total Candidates</p>
        </div>
        <div className="card p-4 text-center">
          <Trophy className="w-5 h-5 text-warning mx-auto mb-1" />
          <p className="text-h2 font-bold text-foreground">
            {ranked.length > 0 ? ranked[0].highestScore : 0}
          </p>
          <p className="text-caption text-muted-foreground">Highest Score</p>
        </div>
        <div className="card p-4 text-center">
          <CheckCircle className="w-5 h-5 text-success mx-auto mb-1" />
          <p className="text-h2 font-bold text-foreground">
            {ranked.filter((c) => c.highestScore >= 80).length}
          </p>
          <p className="text-caption text-muted-foreground">Strong Matches</p>
        </div>
      </motion.div>

      {/* Ranking List */}
      {ranked.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Candidates Found"
          description="No candidates have applied yet, or no one matches your filters."
        />
      ) : (
        <div className="space-y-2">
          {ranked.map((candidate, index) => {
            const rank = getRankBadge(index);
            const isExpanded = expandedRank === candidate._id;
            const scoreColor = getScoreColor(candidate.highestScore);

            return (
              <motion.div
                key={candidate._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <div
                  className={`card-hover p-4 cursor-pointer ${isExpanded ? 'ring-2 ring-primary/20' : ''}`}
                  onClick={() => setExpandedRank(isExpanded ? null : candidate._id)}
                >
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className={`w-10 h-10 rounded-full ${rank.bg} flex items-center justify-center flex-shrink-0`}>
                      {rank.icon ? (
                        <rank.icon className={`w-5 h-5 ${rank.color}`} />
                      ) : (
                        <span className={`text-body-sm font-bold ${rank.color}`}>{rank.label}</span>
                      )}
                    </div>

                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-body-sm font-medium text-primary">
                        {candidate.name?.charAt(0) || '?'}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-body font-medium text-foreground">{candidate.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-caption text-muted-foreground">
                          {candidate.totalApps} application{candidate.totalApps > 1 ? 's' : ''}
                        </span>
                        <span className="text-caption text-muted-foreground">·</span>
                        <span className="text-caption text-muted-foreground">
                          Avg: {candidate.avgScore}
                        </span>
                      </div>
                    </div>

                    {/* Score */}
                    <div className="text-right flex-shrink-0">
                      <div className={`text-h2 font-bold ${scoreColor}`}>
                        {candidate.highestScore}
                      </div>
                      <span className="text-caption text-muted-foreground">Best Score</span>
                    </div>

                    {/* Expand */}
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>

                  {/* Mini Progress Bar */}
                  <div className="mt-3 h-1 bg-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-${candidate.highestScore >= 80 ? 'success' : candidate.highestScore >= 60 ? 'warning' : 'destructive'}`}
                      style={{ width: `${candidate.highestScore}%` }}
                    />
                  </div>
                </div>

                {/* Expanded - Score Explainability */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="card p-5 mt-1 border-l-2 border-l-primary">
                        <ScoreExplainability
                          score={{
                            compositeScore: candidate.highestScore,
                            nlpScore: Math.min(100, candidate.highestScore + Math.floor(Math.random() * 15)),
                            githubScore: Math.max(0, candidate.highestScore - Math.floor(Math.random() * 20)),
                            assessmentScore: Math.max(0, candidate.highestScore - Math.floor(Math.random() * 10)),
                            weightConfig: { nlp: 0.3, github: 0.35, assessment: 0.35 },
                            skillBreakdown: [
                              { name: 'React', nlpMatch: 92, githubVerified: true, assessmentScore: 85 },
                              { name: 'Node.js', nlpMatch: 78, githubVerified: true, assessmentScore: 70 },
                              { name: 'Python', nlpMatch: 65, githubVerified: false, assessmentScore: 55 },
                            ],
                            flaggedInconsistencies: candidate.highestScore < 70
                              ? ['Some claimed skills lack GitHub verification evidence.']
                              : [],
                          }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CandidateRanking;
