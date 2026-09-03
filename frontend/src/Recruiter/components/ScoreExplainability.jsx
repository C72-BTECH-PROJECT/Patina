import React from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle, AlertCircle, XCircle, TrendingUp, TrendingDown,
  FileText, BarChart3, Shield
} from 'lucide-react';

const GithubIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

function ScoreExplainability({ score, compact = false }) {
  if (!score) return null;

  const {
    compositeScore = 0,
    nlpScore = 0,
    githubScore = 0,
    assessmentScore = 0,
    weightConfig = { nlp: 0.3, github: 0.35, assessment: 0.35 },
    skillBreakdown = [],
    flaggedInconsistencies = [],
    explanation = {},
  } = score;

  const scoreColor =
    compositeScore >= 80 ? 'success' :
    compositeScore >= 60 ? 'warning' :
    'destructive';

  const scoreHsl = {
    success: 'hsl(var(--success))',
    warning: 'hsl(var(--warning))',
    destructive: 'hsl(var(--destructive))',
  };

  const subScores = [
    {
      label: 'Resume Match',
      score: nlpScore,
      weight: weightConfig.nlp,
      icon: FileText,
      description: 'Semantic similarity between your resume and job requirements',
    },
    {
      label: 'GitHub Verified',
      score: githubScore,
      weight: weightConfig.github,
      icon: GithubIcon,
      description: 'Code contributions, commit frequency, and language proficiency',
    },
    {
      label: 'Assessment',
      score: assessmentScore,
      weight: weightConfig.assessment,
      icon: BarChart3,
      description: 'Performance on AI-generated technical questions',
    },
  ];

  if (compact) {
    return (
      <div className="space-y-3">
        {subScores.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-body-sm text-foreground">{item.label}</span>
              <span className="text-caption text-muted-foreground">
                (×{(item.weight * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full bg-${item.score >= 80 ? 'success' : item.score >= 50 ? 'warning' : 'destructive'}`}
                  style={{ width: `${item.score}%` }}
                />
              </div>
              <span className="text-body-sm font-medium text-foreground w-8 text-right">
                {item.score}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Composite Score Header */}
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
            <circle
              cx="60" cy="60" r="50"
              fill="none"
              stroke={scoreHsl[scoreColor]}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 50}
              strokeDashoffset={2 * Math.PI * 50 - (compositeScore / 100) * 2 * Math.PI * 50}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-h3 font-bold text-${scoreColor}`}>{compositeScore}</span>
          </div>
        </div>
        <div>
          <h3 className="text-body font-medium text-foreground">Credibility Score</h3>
          <p className="text-caption text-muted-foreground mt-0.5">
            Weighted: NLP {(weightConfig.nlp * 100).toFixed(0)}% + GitHub {(weightConfig.github * 100).toFixed(0)}% + Assessment {(weightConfig.assessment * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Sub-Scores */}
      <div className="space-y-3">
        <h4 className="text-body-sm font-medium text-foreground flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          Score Breakdown
        </h4>
        {subScores.map((item) => (
          <div key={item.label} className="p-3 rounded-md bg-secondary/50">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <item.icon className="w-4 h-4 text-primary" />
                <span className="text-body-sm font-medium text-foreground">{item.label}</span>
                <span className="badge badge-secondary text-[10px]">
                  Weight: {(item.weight * 100).toFixed(0)}%
                </span>
              </div>
              <span className={`text-body-sm font-bold text-${item.score >= 80 ? 'success' : item.score >= 50 ? 'warning' : 'destructive'}`}>
                {item.score}
              </span>
            </div>
            <div className="w-full h-1.5 bg-border rounded-full overflow-hidden mb-1.5">
              <motion.div
                className={`h-full rounded-full bg-${item.score >= 80 ? 'success' : item.score >= 50 ? 'warning' : 'destructive'}`}
                initial={{ width: 0 }}
                animate={{ width: `${item.score}%` }}
                transition={{ duration: 0.8, delay: 0.2 }}
              />
            </div>
            <p className="text-caption text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </div>

      {/* Skill Breakdown */}
      {skillBreakdown.length > 0 && (
        <div>
          <h4 className="text-body-sm font-medium text-foreground mb-3">Per-Skill Analysis</h4>
          <div className="space-y-2">
            {skillBreakdown.map((skill) => (
              <div key={skill.name} className="p-3 rounded-md bg-secondary/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-body-sm font-medium text-foreground">{skill.name}</span>
                  <div className="flex items-center gap-1.5">
                    {skill.githubVerified && (
                      <span className="badge badge-success text-[10px]">
                        <CheckCircle className="w-3 h-3 mr-0.5" />GitHub
                      </span>
                    )}
                    {!skill.githubVerified && (
                      <span className="badge badge-secondary text-[10px]">
                        <XCircle className="w-3 h-3 mr-0.5" />No GitHub
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-caption text-muted-foreground block mb-0.5">Resume</span>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-${skill.nlpMatch >= 80 ? 'success' : skill.nlpMatch >= 50 ? 'warning' : 'destructive'}`}
                          style={{ width: `${skill.nlpMatch}%` }}
                        />
                      </div>
                      <span className="text-caption font-medium text-foreground">{skill.nlpMatch}%</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-caption text-muted-foreground block mb-0.5">GitHub</span>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${skill.githubVerified ? 'bg-success' : 'bg-border'}`}
                          style={{ width: skill.githubVerified ? '100%' : '0%' }}
                        />
                      </div>
                      <span className="text-caption font-medium text-foreground">
                        {skill.githubVerified ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-caption text-muted-foreground block mb-0.5">Test</span>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-${skill.assessmentScore >= 80 ? 'success' : skill.assessmentScore >= 50 ? 'warning' : 'destructive'}`}
                          style={{ width: `${skill.assessmentScore || 0}%` }}
                        />
                      </div>
                      <span className="text-caption font-medium text-foreground">
                        {skill.assessmentScore || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flagged Inconsistencies */}
      {flaggedInconsistencies.length > 0 && (
        <div className="p-3 rounded-md bg-warning/10 border border-warning/20">
          <h4 className="text-body-sm font-medium text-warning mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Flagged Inconsistencies ({flaggedInconsistencies.length})
          </h4>
          <div className="space-y-1.5">
            {flaggedInconsistencies.map((flag, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-warning mt-2 flex-shrink-0" />
                <p className="text-body-sm text-foreground">{flag}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Explanation */}
      {Object.keys(explanation).length > 0 && (
        <div>
          <h4 className="text-body-sm font-medium text-foreground mb-2">How this score was calculated</h4>
          <div className="space-y-1.5">
            {Object.entries(explanation).map(([key, value]) => (
              <div key={key} className="flex items-start gap-2 text-caption">
                <span className="text-muted-foreground font-medium w-28 flex-shrink-0">{key}:</span>
                <span className="text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ScoreExplainability;
