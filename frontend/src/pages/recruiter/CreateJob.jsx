import React, { useEffect, useId, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles, Briefcase, MapPin, Clock, ChevronDown, Zap, ArrowRight, ArrowLeft, Lightbulb, FileText, Search, Plus, X } from 'lucide-react';
import { api, isAborted } from '../../lib/api';

// R-15 (D§8.2): the random "AI Suggestion" (no model was ever called) and the
// unsourced tip claiming more qualified applications are removed. Primary controls use
// `text-primary-foreground` on `bg-primary`; they were black text on black.
//
// R-32 (MUST 6): the fixed list of about 20 skill chips is replaced by a search over the
// parser's skill vocabulary (GET /api/skills?q=, read from nlp-engine), skills the parser
// finds in the description offered as suggestions (POST /api/skills/extract), and skills
// the recruiter types that are not in the vocabulary, added as custom. Nothing is added
// without a click or Enter. The description is written first (step 2) so its skills can be
// suggested on the skills step (step 3). Skills are saved in the parser's spelling.

const FIELD_CLASS = 'w-full px-5 py-4 bg-background border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all';

const PRIMARY_BUTTON = 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer';
const DISABLED_BUTTON = 'bg-muted text-muted-foreground cursor-not-allowed';
const SECONDARY_BUTTON = 'px-6 py-3 rounded-xl font-medium bg-background border border-input text-foreground hover:bg-muted transition-all flex items-center gap-2';
const CHIP_BUTTON = 'px-3 py-1.5 rounded-xl text-sm font-medium border transition-all flex items-center gap-1.5';

export const SEARCH_DEBOUNCE_MS = 200;

const EDGE_CHARS = ' \t.,:;/|()[]-';

/**
 * A typed skill in the form it is saved: lower case, inner spaces collapsed, edge
 * punctuation removed. The same rules as nlp-engine's normalize_skill (app/ner.py) and
 * core's basicSkillForm, without the alias table: an alias ("Postgres") is resolved by
 * the search, which returns the canonical name as its exact match.
 */
export const normaliseTypedSkill = (raw) => {
  const s = String(raw ?? '').split(/\s+/).filter(Boolean).join(' ').toLowerCase();
  let start = 0;
  let end = s.length;
  while (start < end && EDGE_CHARS.includes(s[start])) start += 1;
  while (end > start && EDGE_CHARS.includes(s[end - 1])) end -= 1;
  return s.slice(start, end);
};

const searchPath = (q) => `/api/skills?q=${encodeURIComponent(q)}`;
const skillsOf = (body) => (Array.isArray(body?.skills) ? body.skills : []);

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

/**
 * The skills step. `skills` is [{ name, custom }]; `onChange` is its state setter
 * (called with an updater function).
 * `custom` is true for a skill added as typed because the vocabulary had no exact match
 * (or could not be searched); it is shown in the form only and not saved separately.
 */
export function SkillPicker({ description, skills, onChange }) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  // The last search answered: { q, skills }, where q is the normalised query it was for.
  const [results, setResults] = useState({ q: '', skills: [] });
  const [searchState, setSearchState] = useState('idle'); // idle | loading | ready | unavailable
  const [found, setFound] = useState({ state: 'idle', skills: [] }); // idle | loading | ready | unavailable

  // Skills the parser finds in the description, offered as suggestions only.
  useEffect(() => {
    const text = (description || '').trim();
    if (!text) {
      setFound({ state: 'ready', skills: [] });
      return undefined;
    }
    const controller = new AbortController();
    setFound({ state: 'loading', skills: [] });
    api.post('/api/skills/extract', { text }, { signal: controller.signal })
      .then((body) => setFound({ state: 'ready', skills: skillsOf(body).filter((s) => typeof s === 'string' && s) }))
      .catch((err) => { if (!isAborted(err)) setFound({ state: 'unavailable', skills: [] }); });
    return () => controller.abort();
  }, [description]);

  // Search as the recruiter types, after a short pause.
  useEffect(() => {
    const q = normaliseTypedSkill(query);
    if (!q) {
      setSearchState('idle');
      return undefined;
    }
    const controller = new AbortController();
    setSearchState('loading');
    const timer = setTimeout(() => {
      api.get(searchPath(q), { signal: controller.signal })
        .then((body) => {
          setResults({ q, skills: skillsOf(body) });
          setSearchState('ready');
        })
        .catch((err) => { if (!isAborted(err)) setSearchState('unavailable'); });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // onChange is a state setter and gets an updater, so an add that finishes after a search
  // never drops a skill added meanwhile.
  const has = (name) => skills.some((s) => s.name === name);
  const add = (name, custom) => {
    if (!name) return;
    onChange((prev) => (prev.some((s) => s.name === name) ? prev : [...prev, { name, custom }]));
  };
  const remove = (name) => onChange((prev) => prev.filter((s) => s.name !== name));

  const q = normaliseTypedSkill(query);
  const current = results.q === q && searchState === 'ready' ? results.skills : null;
  const exact = current?.find((s) => s.exact) || null;

  // Enter or "Add as custom": the vocabulary's exact match when there is one, else the
  // typed text as a custom skill. Waits for the search of this exact text if it has not
  // answered yet, so "Postgres" typed quickly still becomes "postgresql".
  const addTyped = async () => {
    if (!q) return;
    let list = current;
    if (list === null && searchState !== 'unavailable') {
      try {
        list = skillsOf(await api.get(searchPath(q)));
      } catch {
        list = [];
        setSearchState('unavailable');
      }
    }
    const match = (list || []).find((s) => s.exact);
    if (match) add(match.name, false);
    else add(q, true);
    setQuery('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTyped();
    }
  };

  return (
    <fieldset>
      <legend className="w-full text-sm font-medium text-foreground mb-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-muted-foreground" />
        Required Skills
        <span className="text-xs text-muted-foreground ml-auto">{skills.length} selected</span>
      </legend>

      <div className="mb-5 p-4 rounded-xl bg-muted border border-border" data-testid="description-suggestions" data-state={found.state}>
        <div className="text-sm font-medium text-foreground mb-2">Found in your description:</div>
        {found.state === 'loading' && <p className="text-sm text-muted-foreground">Reading your description…</p>}
        {found.state === 'unavailable' && (
          <p className="text-sm text-muted-foreground" role="status">
            Suggestions are unavailable right now. You can still type skills below.
          </p>
        )}
        {found.state === 'ready' && found.skills.length === 0 && (
          <p className="text-sm text-muted-foreground">No skills from the parser's vocabulary were found in your description.</p>
        )}
        {found.state === 'ready' && found.skills.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2">
              {found.skills.map((name) => {
                const added = has(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => add(name, false)}
                    disabled={added}
                    aria-pressed={added}
                    data-testid="description-suggestion"
                    data-skill={name}
                    className={`${CHIP_BUTTON} ${added
                      ? 'bg-primary border-primary text-primary-foreground cursor-default'
                      : 'bg-background border-input text-foreground hover:bg-muted'}`}
                  >
                    {added ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    {name}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Click a skill to add it. Nothing is added until you do.</p>
          </>
        )}
      </div>

      <label htmlFor={inputId} className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        Search skills
      </label>
      <input
        id={inputId}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Type a skill, e.g. python, servicenow, r"
        autoComplete="off"
        maxLength={100}
        data-testid="skill-search-input"
        className={FIELD_CLASS}
      />

      <div className="mt-2 min-h-[1.5rem]" data-testid="skill-search-results" data-state={q ? searchState : 'idle'}>
        {q && searchState === 'loading' && <p className="text-sm text-muted-foreground">Searching…</p>}
        {q && searchState === 'unavailable' && (
          <p className="text-sm text-muted-foreground" role="status">
            Suggestions are unavailable right now. Press Enter to add “{q}” as written.
          </p>
        )}
        {current && (
          <div className="flex flex-wrap gap-2">
            {current.map((s) => {
              const added = has(s.name);
              return (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => { add(s.name, false); setQuery(''); }}
                  disabled={added}
                  data-testid="skill-option"
                  data-skill={s.name}
                  title={s.aliases?.length ? `Also written: ${s.aliases.join(', ')}` : undefined}
                  className={`${CHIP_BUTTON} ${added
                    ? 'bg-primary border-primary text-primary-foreground cursor-default'
                    : 'bg-background border-input text-foreground hover:bg-muted'}`}
                >
                  {added ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  {s.name}
                </button>
              );
            })}
          </div>
        )}
        {q && (searchState === 'unavailable' || (current && !exact)) && !has(q) && (
          <button
            type="button"
            onClick={addTyped}
            data-testid="skill-add-custom"
            className={`${CHIP_BUTTON} mt-2 bg-background border-dashed border-input text-foreground hover:bg-muted`}
          >
            <Plus className="w-3 h-3" />
            Add “{q}” as a custom skill
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        Skills are saved in the parser's spelling. A custom skill is not in the parser's vocabulary,
        so the parser will not find it in résumés.
      </p>

      {skills.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2" data-testid="selected-skills" aria-label="Selected skills">
          {skills.map((s) => (
            <li
              key={s.name}
              data-testid="selected-skill"
              data-skill={s.name}
              data-custom={s.custom ? 'true' : 'false'}
              className="px-3 py-1 rounded-full bg-background border border-border text-foreground text-sm flex items-center gap-2"
            >
              <span>{s.name}</span>
              {s.custom && <span className="text-xs text-muted-foreground border border-border rounded-full px-1.5">custom</span>}
              <button
                type="button"
                onClick={() => remove(s.name)}
                aria-label={`Remove ${s.name}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground mt-4 flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          Add at least one skill
        </p>
      )}
    </fieldset>
  );
}

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
  const [skills, setSkills] = useState([]); // [{ name, custom }]
  const [experience, setExperience] = useState('');
  const [location, setLocation] = useState('Remote');
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const experienceId = useId();

  const stepOneReady = Boolean(title.trim() && experience && location.trim());
  const stepTwoReady = Boolean(description.trim());

  const nextStep = () => {
    setFormError('');
    if (currentStep === 1 && !stepOneReady) return;
    if (currentStep === 2 && !stepTwoReady) return;
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

    if (!stepOneReady) {
      setFormError('Fill in the title, location and experience level.');
      return;
    }
    if (!stepTwoReady) {
      setFormError('Add a job description.');
      return;
    }
    if (skills.length === 0) {
      setFormError('Add at least one required skill.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    const payload = {
      title: title.trim(),
      skills: skills.map((s) => s.name),
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

  const canSubmit = stepTwoReady && skills.length > 0 && !isSubmitting;

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
                <LabelledTextarea
                  label="Job Description"
                  icon={FileText}
                  rows="8"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the role's responsibilities and requirements."
                  data-testid="job-description-input"
                />
                <p className="text-xs text-muted-foreground">
                  On the next step, skills found in this description are offered as suggestions.
                </p>

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
                    disabled={!stepTwoReady}
                    className={`px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all ${stepTwoReady ? PRIMARY_BUTTON : DISABLED_BUTTON}`}
                    whileHover={stepTwoReady ? { scale: 1.02 } : {}}
                    whileTap={stepTwoReady ? { scale: 0.98 } : {}}
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
                <SkillPicker description={description} skills={skills} onChange={setSkills} />

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
