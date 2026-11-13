import React, { useId, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles, Briefcase, MapPin, Clock, ChevronDown, Zap, ArrowRight, ArrowLeft, Lightbulb, FileText } from 'lucide-react';
import { api } from '../../lib/api';

// R-15 (D§8.2): the random "AI Suggestion" (no model was ever called) and the
// unsourced tip claiming more qualified applications are removed. Primary controls use
// `text-primary-foreground` on `bg-primary`; they were black text on black.

// Suggested Skills
const SUGGESTED_SKILLS = [
  'React', 'Node.js', 'Python', 'AWS', 'TypeScript',
  'Django', 'Machine Learning', 'Docker', 'Kubernetes',
  'MongoDB', 'SQL', 'Go', 'Rust', 'PostgreSQL', 'Redis',
  'GraphQL', 'REST APIs', 'React Native', 'Next.js', 'Vue.js'
];

const FIELD_CLASS = 'w-full px-5 py-4 bg-background border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all';

const PRIMARY_BUTTON = 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer';
const DISABLED_BUTTON = 'bg-muted text-muted-foreground cursor-not-allowed';
const SECONDARY_BUTTON = 'px-6 py-3 rounded-xl font-medium bg-background border border-input text-foreground hover:bg-muted transition-all flex items-center gap-2';

// Labelled input; the label is tied to the input, extra props (data-testid) go to the input.
const LabelledInput = ({ label, icon: Icon, ...props }) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        {label}
      </label>
      <input id={id} {...props} className={FIELD_CLASS} />
    </div>
  );
};

// Labelled textarea.
const LabelledTextarea = ({ label, icon: Icon, ...props }) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        {label}
      </label>
      <textarea id={id} {...props} className={`${FIELD_CLASS} resize-none`} />
    </div>
  );
};

// Skill Tag Component
const SkillTag = ({ skill, selected, onClick, index }) => (
  <motion.button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={`relative px-4 py-2 rounded-xl text-sm font-medium transition-all ${
      selected
        ? 'bg-primary border border-primary text-primary-foreground'
        : 'bg-background border border-input text-foreground hover:bg-muted'
    }`}
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: index * 0.03 }}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
  >
    <span className="flex items-center gap-1.5">
      {selected && <Check className="w-3 h-3" />}
      {skill}
    </span>
  </motion.button>
);

// Form Progress Indicator
const FormProgress = ({ currentStep }) => (
  <div className="flex items-center justify-center gap-2 mb-8" aria-label={`Step ${currentStep} of 3`}>
    {[1, 2, 3].map((step) => (
      <React.Fragment key={step}>
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            step < currentStep
              ? 'bg-success text-success-foreground'
              : step === currentStep
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {step < currentStep ? <Check className="w-4 h-4" /> : step}
        </div>
        {step < 3 && (
          <div className="w-12 h-0.5 bg-muted">
            <motion.div
              className="h-full bg-primary"
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

// Main CreateJob Component
function CreateJob() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState([]);
  const [experience, setExperience] = useState('');
  const [location, setLocation] = useState('Remote');
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const experienceId = useId();

  const stepOneReady = Boolean(title.trim() && experience && location.trim());

  const toggleSkill = (skill) => {
    if (skills.includes(skill)) {
      setSkills(skills.filter((s) => s !== skill));
    } else {
      setSkills([...skills, skill]);
    }
  };

  const nextStep = () => {
    setFormError('');
    if (currentStep === 1 && !stepOneReady) return;
    if (currentStep === 2 && skills.length === 0) return;
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    setFormError('');
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    // Enter in a step-1 field submits the form; treat it as "Next Step".
    if (currentStep < 3) {
      nextStep();
      return;
    }

    if (!stepOneReady || skills.length === 0) {
      setFormError('Fill in the title, location and experience level, and select at least one skill.');
      return;
    }
    if (!description.trim()) {
      setFormError('Add a job description.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    const payload = {
      title: title.trim(),
      skills,
      description: description.trim(),
      experienceLevel: experience,
      location: location.trim(),
    };

    try {
      await api.post('/api/jobs', payload);
      navigate('/recruiter/jobs');
    } catch (err) {
      setFormError(err.message);
      setIsSubmitting(false);
    }
  };

  const canSubmit = Boolean(description.trim()) && !isSubmitting;

  return (
    <div className="relative text-foreground">
      <div className="mb-6">
        <Link
          to="/recruiter/jobs"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors no-underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-medium">Back to jobs</span>
        </Link>
      </div>

      <main className="relative max-w-3xl mx-auto pb-12">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl font-extrabold mb-4 text-foreground">Create New Job Listing</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Applicants to this job are scored against the skills you select here.
          </p>
        </motion.div>

        {/* Progress Indicator */}
        <FormProgress currentStep={currentStep} />

        {/* Form Card */}
        <motion.form
          onSubmit={handleCreate}
          className="card p-8 md:p-10 relative"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          noValidate
        >
          {formError && (
            <p role="alert" className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {formError}
            </p>
          )}

          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <LabelledInput
                  label="Job Title"
                  icon={Briefcase}
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Senior Full Stack Engineer"
                  data-testid="job-title-input"
                />

                <LabelledInput
                  label="Location"
                  icon={MapPin}
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Remote / Bangalore / Mumbai"
                />

                <div>
                  <label htmlFor={experienceId} className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    Experience Level
                  </label>
                  <div className="relative">
                    <select
                      id={experienceId}
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      className={`${FIELD_CLASS} appearance-none cursor-pointer`}
                    >
                      <option value="">Select Level...</option>
                      <option value="0-2 years">0-2 years (Entry Level)</option>
                      <option value="2-5 years">2-5 years (Mid Level)</option>
                      <option value="5+ years">5+ years (Senior Level)</option>
                    </select>
                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div className="flex justify-end">
                  <motion.button
                    type="button"
                    onClick={nextStep}
                    disabled={!stepOneReady}
                    className={`px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all ${stepOneReady ? PRIMARY_BUTTON : DISABLED_BUTTON}`}
                    whileHover={stepOneReady ? { scale: 1.02 } : {}}
                    whileTap={stepOneReady ? { scale: 0.98 } : {}}
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
                <fieldset>
                  <legend className="w-full text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-muted-foreground" />
                    Required Skills
                    <span className="text-xs text-muted-foreground ml-auto">{skills.length} selected</span>
                  </legend>
                  <p className="text-xs text-muted-foreground mb-4">Select the core skills required for this position.</p>
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
                    <p className="text-sm text-muted-foreground mt-3 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4" />
                      Select at least one skill
                    </p>
                  )}
                </fieldset>

                <div className="flex justify-between">
                  <motion.button
                    type="button"
                    onClick={prevStep}
                    className={SECONDARY_BUTTON}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={nextStep}
                    disabled={skills.length === 0}
                    className={`px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all ${skills.length > 0 ? PRIMARY_BUTTON : DISABLED_BUTTON}`}
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
                <LabelledTextarea
                  label="Job Description"
                  icon={FileText}
                  rows="6"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the role's responsibilities and requirements."
                />

                {/* Selected Skills Preview */}
                {skills.length > 0 && (
                  <div className="p-4 rounded-xl bg-muted border border-border">
                    <div className="text-xs text-muted-foreground mb-2">Selected Skills</div>
                    <div className="flex flex-wrap gap-2">
                      {skills.map((skill) => (
                        <span
                          key={skill}
                          className="px-3 py-1 rounded-full bg-background border border-border text-foreground text-sm"
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
                    className={SECONDARY_BUTTON}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </motion.button>

                  <motion.button
                    type="submit"
                    disabled={!canSubmit}
                    data-testid="job-submit"
                    className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${canSubmit ? PRIMARY_BUTTON : DISABLED_BUTTON}`}
                    whileHover={canSubmit ? { scale: 1.02 } : {}}
                    whileTap={canSubmit ? { scale: 0.98 } : {}}
                  >
                    {isSubmitting ? (
                      <>
                        <motion.div
                          className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full"
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
      </main>
    </div>
  );
}

export default CreateJob;
