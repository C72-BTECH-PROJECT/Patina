import React from 'react';
import { Link } from 'react-router-dom';
import { User, Building2, ArrowRight } from 'lucide-react';
import PatinaMark from '../../components/PatinaMark';

const RoleCard = ({ to, icon: Icon, title, description, delay, color }) => (
  <div>
    <Link
      to={to}
      className="group relative block card p-8 shadow-pop anim-rise text-center no-underline hover:border-foreground/20 transition-colors"
    >
      <div className="w-14 h-14 rounded-xl mx-auto mb-5 flex items-center justify-center bg-muted group-hover:bg-foreground/10 transition-colors">
        <Icon className="w-7 h-7 text-foreground" />
      </div>

      <h2 className="text-xl font-semibold text-foreground mb-2">
        {title}
      </h2>

      <p className="text-body-sm text-muted-foreground leading-relaxed mb-5">
        {description}
      </p>

      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground group-hover:gap-2.5 transition-all">
        Get Started
        <ArrowRight className="w-4 h-4" />
      </span>
    </Link>
  </div>
);

function RoleSelection() {
  return (
    <div className="min-h-screen auth-bg bg-background text-foreground">
      <header className="flex justify-between items-center py-4 px-6 border-b border-border">
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <PatinaMark size={28} />
          <span className="font-display font-bold text-[15px] tracking-[.14em] text-foreground">PATINA</span>
        </Link>

        <Link
          to="/"
          className="text-body-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Home
        </Link>
      </header>

      <main className="flex-1 flex justify-center items-center min-h-[calc(100vh-73px)] py-12 px-6">
        <div className="max-w-3xl w-full text-center">
          <div className="mb-12 anim-rise">
            <h1 className="text-3xl md:text-4xl font-bold mb-3 text-foreground">
              How would you like to use <span className="text-foreground">PATINA</span>?
            </h1>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto">
              Choose your role to get started.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RoleCard
              to="/signup"
              icon={User}
              title="I'm a Candidate"
              description="Upload your resume, apply to jobs, and take a short technical assessment. Each application gets a credibility score that shows how it was worked out."
              delay={0.1}
              color="#0a0a0a"
            />

            <RoleCard
              to="/signup"
              icon={Building2}
              title="I'm a Recruiter"
              description="Post jobs, review the applications to them ranked by credibility score, see the evidence behind each score, and shortlist or reject."
              delay={0.2}
              color="#0a0a0a"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default RoleSelection;
