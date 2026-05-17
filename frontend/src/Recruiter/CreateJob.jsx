import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Check, Sparkles, Briefcase, MapPin, Clock, ChevronDown, Zap, ArrowRight, Lightbulb } from 'lucide-react';

// Suggested Skills
const SUGGESTED_SKILLS = [
  'React', 'Node.js', 'Python', 'AWS', 'TypeScript',
  'Django', 'Machine Learning', 'Docker', 'Kubernetes',
  'MongoDB', 'SQL', 'Go', 'Rust', 'PostgreSQL', 'Redis',
  'GraphQL', 'REST APIs', 'React Native', 'Next.js', 'Vue.js'
];

// Glow Orb Component
const GlowOrb = ({ className }) => (
  <div className={`absolute w-96 h-96 rounded-full filter blur-3xl opacity-20 ${className}`}>
    <div className={`w-full h-full rounded-full bg-gradient-to-br from-accent-purple/40 to-accent-pink/30 animate-glow-pulse`} />
  </div>
);

// Animated Input Component
const AnimatedInput = ({ label, icon: Icon, ...props }) => (
  <motion.div
    className="relative group"
    whileFocusWithin={{ scale: 1.01 }}
  >
    <label className="block text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
      <Icon className="w-4 h-4 text-accent-purple" />
      {label}
    </label>
    <input
      {...props}
      className="w-full px-5 py-4 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:border-accent-purple/50 focus:ring-2 focus:ring-accent-purple/20 transition-all"
    />
    {/* Focus Glow Effect */}
    <motion.div
      className="absolute inset-0 rounded-xl border border-accent-purple/0 group-focus-within:border-accent-purple/30 pointer-events-none -z-10"
      animate={{ boxShadow: ['0 0 0px rgba(139, 92, 246, 0)', '0 0 20px rgba(139, 92, 246, 0.2)'] }}
      transition={{ duration: 0.3 }}
    />
  </motion.div>
);

// Animated Textarea Component
const AnimatedTextarea = ({ label, icon: Icon, ...props }) => (
  <motion.div
    className="relative group"
    whileFocusWithin={{ scale: 1.01 }}
  >
    <label className="block text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
      <Icon className="w-4 h-4 text-accent-purple" />
      {label}
    </label>
    <textarea
      {...props}
      className="w-full px-5 py-4 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder:text-white/20 resize-none focus:outline-none focus:border-accent-purple/50 focus:ring-2 focus:ring-accent-purple/20 transition-all"
    />
  </motion.div>
);

// Skill Tag Component
const SkillTag = ({ skill, selected, onClick, index }) => (
  <motion.button
    type="button"
    onClick={onClick}
    className={`relative px-4 py-2 rounded-xl text-sm font-medium transition-all overflow-hidden ${
      selected
        ? 'bg-accent-purple/30 border border-accent-purple/50 text-white'
        : 'bg-white/5 border border-white/10 text-white/60 hover:border-white/20'
    }`}
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: index * 0.03 }}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
  >
    {selected && (
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-accent-purple/20 to-accent-cyan/20"
        layoutId="skillBg"
      />
    )}
    <span className="relative z-10 flex items-center gap-1.5">
      {selected && <Check className="w-3 h-3 text-accent-emerald" />}
      {skill}
    </span>
  </motion.button>
);

// Form Progress Indicator
const FormProgress = ({ currentStep }) => (
  <div className="flex items-center justify-center gap-2 mb-8">
    {[1, 2, 3].map((step) => (
      <React.Fragment key={step}>
        <motion.div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            step < currentStep
              ? 'bg-accent-emerald text-white'
              : step === currentStep
              ? 'bg-accent-purple text-white'
              : 'bg-white/10 text-white/40'
          }`}
          animate={step === currentStep ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 1, repeat: step === currentStep ? Infinity : 0 }}
        >
          {step < currentStep ? <Check className="w-4 h-4" /> : step}
        </motion.div>
        {step < 3 && (
          <div className="w-12 h-0.5 bg-white/10">
            <motion.div
              className="h-full bg-gradient-to-r from-accent-purple to-accent-cyan"
              initial={{ width: '0%' }}
              animate={{ width: step < currentStep ? '100%' : '0%' }}
              transition={{ duration: 0.5 }}
            />
          </div>
        )}
      </React.Fragment>
    ))}
  </div>
);

// AI Suggestion Component
const AISuggestion = ({ text, onAccept, onDismiss }) => (
  <motion.div
    className="p-4 rounded-xl bg-accent-cyan/5 border border-accent-cyan/20"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
  >
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-accent-cyan/20 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-4 h-4 text-accent-cyan" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-accent-cyan">AI Suggestion</span>
        </div>
        <p className="text-sm text-white/60 mb-2">{text}</p>
        <div className="flex gap-2">
          <button
            onClick={onAccept}
            className="px-3 py-1.5 rounded-lg bg-accent-cyan/20 text-accent-cyan text-xs font-medium hover:bg-accent-cyan/30 transition-all"
          >
            Accept
          </button>
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 rounded-lg bg-white/5 text-white/40 text-xs font-medium hover:bg-white/10 transition-all"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  </motion.div>
);

// Main CreateJob Component
function CreateJob() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState([]);
  const [experience, setExperience] = useState('');
  const [location, setLocation] = useState('Remote');
  const [currentStep, setCurrentStep] = useState(1);
  const [showAISuggestion, setShowAISuggestion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleSkill = (skill) => {
    if (skills.includes(skill)) {
      setSkills(skills.filter((s) => s !== skill));
    } else {
      setSkills([...skills, skill]);
    }
  };

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    if (!title || skills.length === 0 || !experience || !location) {
      alert('Please fill title, location, experience level, and select at least one skill.');
      return;
    }

    if (!description.trim()) {
      alert('Please add a job description.');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      title: title.trim(),
      skills,
      description: description.trim(),
      experienceLevel: experience,
      location,
    };

    try {
      const resp = await fetch('http://localhost:5001/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`Create job failed (${resp.status}) ${txt}`);
      }

      await resp.json().catch(() => null);
      navigate('/recruiter/jobs');
    } catch (err) {
      alert(err.message || 'Failed to create job');
      setIsSubmitting(false);
    }
  };

  // Auto-show AI suggestion when description is long enough
  React.useEffect(() => {
    if (description.length > 50 && Math.random() > 0.7) {
      setShowAISuggestion(true);
    }
  }, [description]);

  return (
    <div className="min-h-screen bg-background text-white relative overflow-hidden">
      {/* Noise Overlay */}
      <div className="noise-overlay" />

      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10" />
      <GlowOrb className="top-[-10%] right-[-10%]" />
      <GlowOrb className="bottom-[-10%] left-[-10%]" />

      {/* Back Button */}
      <motion.div
        className="fixed top-24 left-6 z-10"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Link
          to="/recruiter/dashboard"
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors no-underline group"
        >
          <motion.span
            animate={{ x: [0, -5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            ←
          </motion.span>
          <span className="font-medium">Back</span>
        </Link>
      </motion.div>

      {/* Main Content */}
      <main className="relative z-10 max-w-3xl mx-auto px-6 py-24">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl font-extrabold mb-4">
            <span className="text-white">Create New </span>
            <span className="gradient-text">Job Listing</span>
          </h1>
          <p className="text-white/50 max-w-xl mx-auto">
            Fill out the details below to start receiving vetted candidates powered by AI skill verification.
          </p>
        </motion.div>

        {/* Progress Indicator */}
        <FormProgress currentStep={currentStep} />

        {/* Form Card */}
        <motion.form
          onSubmit={handleCreate}
          className="glass-card p-8 md:p-10 relative"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="corner-decoration top-left" />
          <div className="corner-decoration bottom-right" />

          {/* Step 1: Basic Info */}
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <AnimatedInput
                  label="Job Title"
                  icon={Briefcase}
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Senior Full Stack Engineer"
                />

                <AnimatedInput
                  label="Location"
                  icon={MapPin}
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Remote / Bangalore / Mumbai"
                />

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-accent-purple" />
                    Experience Level
                  </label>
                  <div className="relative">
                    <select
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      className="w-full px-5 py-4 bg-white/[0.03] border border-white/10 rounded-xl text-white appearance-none cursor-pointer focus:outline-none focus:border-accent-purple/50 focus:ring-2 focus:ring-accent-purple/20 transition-all"
                    >
                      <option value="" className="bg-background">Select Level...</option>
                      <option value="0-2 years" className="bg-background">0-2 years (Entry Level)</option>
                      <option value="2-5 years" className="bg-background">2-5 years (Mid Level)</option>
                      <option value="5+ years" className="bg-background">5+ years (Senior Level)</option>
                    </select>
                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
                  </div>
                </div>

                <div className="flex justify-end">
                  <motion.button
                    type="button"
                    onClick={nextStep}
                    disabled={!title || !experience || !location}
                    className={`px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all ${
                      title && experience && location
                        ? 'bg-gradient-to-r from-accent-purple to-accent-cyan text-white cursor-pointer'
                        : 'bg-white/10 text-white/40 cursor-not-allowed'
                    }`}
                    whileHover={title && experience && location ? { scale: 1.02 } : {}}
                    whileTap={title && experience && location ? { scale: 0.98 } : {}}
                  >
                    Next Step
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent-purple" />
                    Required Skills
                    <span className="text-xs text-white/40 ml-auto">{skills.length} selected</span>
                  </label>
                  <p className="text-xs text-white/30 mb-4">Select the core skills required for this position.</p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_SKILLS.map((skill, i) => (
                      <SkillTag
                        key={skill}
                        skill={skill}
                        selected={skills.includes(skill)}
                        onClick={() => toggleSkill(skill)}
                        index={i}
                      />
                    ))}
                  </div>
                  {skills.length === 0 && (
                    <motion.p
                      className="text-sm text-accent-amber mt-3 flex items-center gap-2"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <Lightbulb className="w-4 h-4" />
                      Select at least one skill
                    </motion.p>
                  )}
                </div>

                <div className="flex justify-between">
                  <motion.button
                    type="button"
                    onClick={prevStep}
                    className="px-6 py-3 rounded-xl font-medium bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Back
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={nextStep}
                    disabled={skills.length === 0}
                    className={`px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all ${
                      skills.length > 0
                        ? 'bg-gradient-to-r from-accent-purple to-accent-cyan text-white cursor-pointer'
                        : 'bg-white/10 text-white/40 cursor-not-allowed'
                    }`}
                    whileHover={skills.length > 0 ? { scale: 1.02 } : {}}
                    whileTap={skills.length > 0 ? { scale: 0.98 } : {}}
                  >
                    Next Step
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent-purple" />
                    Job Description
                  </label>
                  <AnimatedTextarea
                    label=""
                    icon={Sparkles}
                    rows="6"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the role responsibilities, requirements, and what makes this opportunity exciting..."
                  />

                  <AnimatePresence>
                    {showAISuggestion && (
                      <AISuggestion
                        text="Consider adding specific technologies (React 18, TypeScript) and mention remote work flexibility to increase candidate engagement."
                        onAccept={() => {
                          setDescription(prev => prev + ' Technologies: React 18, TypeScript. Remote work available.');
                          setShowAISuggestion(false);
                        }}
                        onDismiss={() => setShowAISuggestion(false)}
                      />
                    )}
                  </AnimatePresence>
                </div>

                {/* Selected Skills Preview */}
                {skills.length > 0 && (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="text-xs text-white/40 mb-2">Selected Skills</div>
                    <div className="flex flex-wrap gap-2">
                      {skills.map((skill) => (
                        <span
                          key={skill}
                          className="px-3 py-1 rounded-full bg-accent-purple/20 border border-accent-purple/30 text-accent-purple text-sm"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <motion.button
                    type="button"
                    onClick={prevStep}
                    className="px-6 py-3 rounded-xl font-medium bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Back
                  </motion.button>

                  <motion.button
                    type="submit"
                    disabled={!description.trim() || isSubmitting}
                    className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${
                      description.trim() && !isSubmitting
                        ? 'bg-gradient-to-r from-accent-purple to-accent-cyan text-white cursor-pointer shadow-glow-purple'
                        : 'bg-white/10 text-white/40 cursor-not-allowed'
                    }`}
                    whileHover={description.trim() && !isSubmitting ? { scale: 1.02 } : {}}
                    whileTap={description.trim() && !isSubmitting ? { scale: 0.98 } : {}}
                  >
                    {isSubmitting ? (
                      <>
                        <motion.div
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        Post Job Listing
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.form>

        {/* Tips */}
        <motion.div
          className="mt-8 text-center text-sm text-white/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <p>Tip: Detailed job descriptions with specific skills receive 3x more qualified applications</p>
        </motion.div>
      </main>
    </div>
  );
}

export default CreateJob;