import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Trophy, CheckCircle, AlertCircle, ArrowRight, FileText,
  Briefcase, Star, BarChart3, Download
} from 'lucide-react';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';

const GithubIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

function Results() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const mapped = (a) => {
      if (!a) return null;
      const compositeScore = a.credibilityScore ?? a.matchPercentage ?? null;
      const semantic = Number(a.semantic_similarity ?? a.matchPercentage / 100);
      const matchPct = typeof a.matchPercentage === 'number' ? a.matchPercentage : Math.round(semantic * 100);
      const vskills = Array.isArray(a.verifiedSkills) ? a.verifiedSkills : [];
      const skillBreakdown = vskills.map((s) => ({
        name: s.name,
        nlpMatch: matchPct,
        githubVerified: Boolean(s.verified),
        assessmentScore: 0,
        status: s.verified ? 'verified' : 'unverified',
      }));
      const flagged = Array.isArray(a.flag) && a.flag.length
        ? a.flag
        : (Array.isArray(a.extractedSkills) && vskills.length
            ? vskills.filter((s) => !s.verified).map((s) => `${s.name} listed but not verified against GitHub activity.`)
          : []);
      return {
        compositeScore,
        nlpScore: matchPct,
        githubScore: compositeScore,
        assessmentScore: compositeScore,
        matchLevel: a.match_level || a.matchLevel || '',
        skillBreakdown,
        flaggedInconsistencies: flagged,
      };
    };

    const fromState = mapped(location.state?.analysis);
    if (fromState) {
      setResult(fromState);
      setLoading(false);
      return;
    }

    const fetchResult = async () => {
      try {
        const resp = await fetch('http://localhost:5000/api/candidate-analysis');
        if (resp.ok) {
          const data = await resp.json();
          const m = mapped(data);
          if (m) setResult(m);
        }
      } catch {
        // unreachable data — fall back to mock below
      }

      // Mock data for demo
      setResult((prev) => prev || {
        compositeScore: 74,
        nlpScore: 82,
        githubScore: 68,
        assessmentScore: 71,
        matchLevel: 'Strong Match',
        skillBreakdown: [
          { name: 'React.js', nlpMatch: 95, githubVerified: true, assessmentScore: 88, status: 'verified' },
          { name: 'Node.js', nlpMatch: 88, githubVerified: true, assessmentScore: 76, status: 'verified' },
          { name: 'Python', nlpMatch: 72, githubVerified: false, assessmentScore: 64, status: 'partial' },
          { name: 'MongoDB', nlpMatch: 80, githubVerified: true, assessmentScore: 82, status: 'verified' },
          { name: 'Docker', nlpMatch: 45, githubVerified: false, assessmentScore: 30, status: 'unverified' },
          { name: 'AWS', nlpMatch: 30, githubVerified: false, assessmentScore: 0, status: 'unverified' },
        ],
        flaggedInconsistencies: [
          'Claims "Expert" in AWS but has no repository evidence or assessment performance.',
          'Docker listed as primary skill but minimal commits in container-related repos.',
        ],
        assessmentQuestions: 5,
        assessmentAnswered: 5,
      });

      setLoading(false);
    };

    const timer = setTimeout(fetchResult, 800);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Spinner />
        <p className="text-body-sm text-muted-foreground">Calculating your credibility score...</p>
      </div>
    );
  }

  const scoreColor =
    result.compositeScore >= 80 ? 'text-success' :
    result.compositeScore >= 60 ? 'text-warning' :
    'text-destructive';

  const scoreBg =
    result.compositeScore >= 80 ? 'bg-success' :
    result.compositeScore >= 60 ? 'bg-warning' :
    'bg-destructive';

  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (result.compositeScore / 100) * circumference;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <motion.div {...fadeUp} className="text-center mb-8">
        <div className={`w-16 h-16 rounded-full ${result.compositeScore >= 80 ? 'bg-success/10' : result.compositeScore >= 60 ? 'bg-warning/10' : 'bg-destructive/10'} flex items-center justify-center mx-auto mb-4`}>
          <Trophy className={`w-8 h-8 ${scoreColor}`} />
        </div>
        <h1 className="text-h1 text-foreground mb-2">Your Credibility Score</h1>
        <p className="text-body text-muted-foreground">
          Based on your resume, GitHub activity, and assessment performance
        </p>
      </motion.div>

      {/* Score Ring */}
      <motion.div
        {...fadeUp}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="card p-8 mb-6"
      >
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="relative w-36 h-36 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
              <motion.circle
                cx="60" cy="60" r="54"
                fill="none"
                stroke="hsl(var(--color, var(--primary)))"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.2, delay: 0.3, ease: 'easeOut' }}
                style={{ stroke: result.compositeScore >= 80 ? 'hsl(var(--success))' : result.compositeScore >= 60 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                className={`text-h1 font-extrabold ${scoreColor}`}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
              >
                {result.compositeScore}
              </motion.span>
              <span className="text-caption text-muted-foreground">/100</span>
            </div>
          </div>

          <div className="flex-1 text-center md:text-left">
            <span className={`badge ${result.compositeScore >= 80 ? 'badge-success' : result.compositeScore >= 60 ? 'badge-warning' : 'badge-danger'} mb-3`}>
              {result.matchLevel}
            </span>
            <h2 className="text-h3 font-heading font-semibold text-foreground mb-2">
              {result.compositeScore >= 80
                ? 'Excellent — You stand out as a strong candidate.'
                : result.compositeScore >= 60
                ? 'Good foundation — Some areas can be strengthened.'
                : 'Developing — Focus on building verifiable skills.'}
            </h2>
            <p className="text-body-sm text-muted-foreground leading-relaxed">
              Your score combines resume analysis, GitHub verification, and assessment results.
              Recruiters see this score along with a detailed breakdown.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Sub-Scores */}
      <motion.div
        {...fadeUp}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="grid grid-cols-3 gap-4 mb-6"
      >
        {[
          { label: 'Resume Match', score: result.nlpScore, icon: FileText, color: 'primary' },
          { label: 'GitHub Verified', score: result.githubScore, icon: GithubIcon, color: 'success' },
          { label: 'Assessment', score: result.assessmentScore, icon: BarChart3, color: 'warning' },
        ].map((item) => (
          <div key={item.label} className="card p-4 text-center">
            <item.icon className={`w-5 h-5 text-${item.color} mx-auto mb-2`} />
            <p className="text-h2 font-bold text-foreground">{item.score}</p>
            <p className="text-caption text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Skill Breakdown */}
      <motion.div
        {...fadeUp}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="card p-6 mb-6"
      >
        <h3 className="text-body font-medium text-foreground mb-4 flex items-center gap-2">
          <Star className="w-4 h-4 text-warning" />
          Skill Breakdown
        </h3>
        <div className="space-y-3">
          {result.skillBreakdown.map((skill) => (
            <div key={skill.name} className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
              <div className="flex items-center gap-3">
                <span className="text-body-sm font-medium text-foreground w-28">{skill.name}</span>
                <div className="flex-1 max-w-[200px] h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${skill.nlpMatch >= 80 ? 'bg-success' : skill.nlpMatch >= 50 ? 'bg-warning' : 'bg-destructive'}`}
                    style={{ width: `${skill.nlpMatch}%` }}
                  />
                </div>
                <span className="text-caption text-muted-foreground w-10 text-right">{skill.nlpMatch}%</span>
              </div>
              <div className="flex items-center gap-2">
                {skill.githubVerified ? (
                  <span className="badge badge-success text-[10px]">
                    <CheckCircle className="w-3 h-3 mr-1" />GitHub
                  </span>
                ) : (
                  <span className="badge badge-secondary text-[10px]">No GitHub</span>
                )}
                {skill.assessmentScore > 0 && (
                  <span className="badge badge-primary text-[10px]">Test: {skill.assessmentScore}%</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Flagged Inconsistencies */}
      {result.flaggedInconsistencies.length > 0 && (
        <motion.div
          {...fadeUp}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="p-4 rounded-md bg-warning/10 border border-warning/20 mb-6"
        >
          <h3 className="text-body font-medium text-warning mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Areas for Improvement
          </h3>
          <div className="space-y-2">
            {result.flaggedInconsistencies.map((flag, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-warning mt-2 flex-shrink-0" />
                <p className="text-body-sm text-foreground">{flag}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Actions */}
      <motion.div
        {...fadeUp}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <Link to="/candidate/dashboard" className="btn btn-primary flex-1 justify-center">
          <ArrowRight className="w-4 h-4" />
          Go to Dashboard
        </Link>
        <Link to="/candidate/jobs" className="btn btn-outline flex-1 justify-center">
          <Briefcase className="w-4 h-4" />
          Browse Jobs
        </Link>
      </motion.div>
    </div>
  );
}

export default Results;
