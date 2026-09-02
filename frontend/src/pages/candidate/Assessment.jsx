import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, ChevronLeft, ChevronRight, Send, AlertCircle,
  CheckCircle, Sparkles, FileText, Loader2
} from 'lucide-react';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';

const MOCK_QUESTIONS = [
  {
    id: 1,
    skill: 'React',
    difficulty: 'medium',
    question: 'Explain how you would optimize a React application that re-renders excessively when a parent component updates frequently. What hooks or patterns would you use and why?',
    rubric: 'Should mention useMemo, useCallback, React.memo, or component composition patterns.',
  },
  {
    id: 2,
    skill: 'Node.js',
    difficulty: 'hard',
    question: 'Describe how you would design a rate-limiting middleware for an Express API. What data structures would you use and how would you handle distributed systems?',
    rubric: 'Should discuss token bucket or sliding window algorithms, Redis for distributed rate limiting.',
  },
  {
    id: 3,
    skill: 'MongoDB',
    difficulty: 'medium',
    question: 'When would you choose MongoDB over PostgreSQL for a project? Give a specific example from your experience where document-based storage was the right choice.',
    rubric: 'Should mention flexible schemas, nested documents, or specific use cases like catalogs or logs.',
  },
  {
    id: 4,
    skill: 'Python',
    difficulty: 'easy',
    question: 'What is the difference between a list and a tuple in Python? In what scenarios would you prefer one over the other?',
    rubric: 'Should mention mutability vs immutability, performance, and use cases like dictionary keys.',
  },
  {
    id: 5,
    skill: 'System Design',
    difficulty: 'hard',
    question: 'You are tasked with designing a real-time notification system for 1 million users. Walk me through your architecture, the technologies you would use, and how you would ensure reliability.',
    rubric: 'Should mention message queues, WebSocket or SSE, fan-out strategies, and retry mechanisms.',
  },
];

function Assessment() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(1800);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const resp = await fetch('http://localhost:5000/api/assessment/generate');
        if (resp.ok) {
          const data = await resp.json();
          if (data.questions?.length > 0) {
            setQuestions(data.questions);
          } else {
            setQuestions(MOCK_QUESTIONS);
          }
        } else {
          setQuestions(MOCK_QUESTIONS);
        }
      } catch {
        setQuestions(MOCK_QUESTIONS);
      }
      setLoading(false);
    };
    fetchQuestions();
  }, []);

  useEffect(() => {
    if (submitted || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [submitted, timeLeft]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const current = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const isLast = currentIndex === questions.length - 1;
  const isTimeUp = timeLeft <= 0;

  const handleAnswer = (value) => {
    setAnswers((prev) => ({ ...prev, [current.id]: value }));
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    try {
      await fetch('http://localhost:5000/api/assessment/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, questionCount: questions.length }),
      });
    } catch {
      // continue even if backend is not ready
    }
    setTimeout(() => navigate('/candidate/results'), 1500);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Spinner />
        <p className="text-body-sm text-muted-foreground">Loading assessment...</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center"
        >
          <CheckCircle className="w-8 h-8 text-success" />
        </motion.div>
        <h2 className="text-h2 text-foreground">Assessment Submitted</h2>
        <p className="text-body-sm text-muted-foreground">Calculating your credibility score...</p>
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      </div>
    );
  }

  if (isTimeUp && answeredCount < questions.length) {
    return (
      <div className="max-w-lg mx-auto">
        <motion.div
          className="card p-8 text-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-7 h-7 text-warning" />
          </div>
          <h2 className="text-h2 text-foreground mb-2">Time's Up</h2>
          <p className="text-body text-muted-foreground mb-6">
            You answered {answeredCount} of {questions.length} questions. Submitting your responses now.
          </p>
          <Button onClick={handleSubmit} fullWidth>
            <Send className="w-4 h-4" />
            Submit Assessment
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-h2 text-foreground">Skill Assessment</h1>
            <p className="text-body-sm text-muted-foreground mt-1">
              AI-generated questions based on your projects and skills
            </p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-md ${
            timeLeft < 300 ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-foreground'
          }`}>
            <Clock className="w-4 h-4" />
            <span className="text-body-sm font-mono font-medium">{formatTime(timeLeft)}</span>
          </div>
        </div>
      </motion.div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-caption text-muted-foreground">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="text-caption text-muted-foreground">
            {answeredCount} answered
          </span>
        </div>
        <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="card p-6 mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="badge badge-primary text-[10px]">
              <Sparkles className="w-3 h-3 mr-1" />
              {current.skill}
            </span>
            <span className={`badge text-[10px] ${
              current.difficulty === 'easy' ? 'badge-success' :
              current.difficulty === 'medium' ? 'badge-warning' :
              'badge-danger'
            }`}>
              {current.difficulty}
            </span>
            {answers[current.id] && (
              <span className="badge badge-success text-[10px]">
                <CheckCircle className="w-3 h-3 mr-1" />
                Answered
              </span>
            )}
          </div>

          <h2 className="text-body font-medium text-foreground leading-relaxed mb-4">
            {current.question}
          </h2>

          <textarea
            value={answers[current.id] || ''}
            onChange={(e) => handleAnswer(e.target.value)}
            placeholder="Type your answer here..."
            rows={6}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-body-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
          />

          <div className="flex items-center justify-between mt-3">
            <span className="text-caption text-muted-foreground">
              {(answers[current.id] || '').split(/\s+/).filter(Boolean).length} words
            </span>
            {answers[current.id] && (
              <button
                onClick={() => handleAnswer('')}
                className="text-caption text-muted-foreground hover:text-destructive transition-colors"
              >
                Clear answer
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </Button>

        <div className="flex items-center gap-1.5">
          {questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(i)}
              className={`w-8 h-8 rounded-md text-caption font-medium transition-colors ${
                i === currentIndex
                  ? 'bg-primary text-primary-foreground'
                  : answers[q.id]
                  ? 'bg-success/10 text-success'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {isLast ? (
          <Button
            onClick={handleSubmit}
            disabled={answeredCount === 0}
          >
            <Send className="w-4 h-4" />
            Submit
          </Button>
        ) : (
          <Button
            onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Info Banner */}
      <div className="mt-6 p-3 rounded-md bg-primary/5 border border-primary/10">
        <div className="flex items-start gap-2">
          <FileText className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-body-sm text-foreground font-medium">About this assessment</p>
            <p className="text-caption text-muted-foreground mt-0.5">
              Questions are generated by AI based on your resume and project data.
              Answer honestly — the evaluation considers depth and practical reasoning,
              not just correct answers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Assessment;
