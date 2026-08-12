import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  FileSearch,
  FileUp,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

const features = [
  {
    icon: FileSearch,
    title: "Make your experience clear",
    description: "Turn your resume, projects, and skills into a profile recruiters can understand at a glance.",
    color: "text-accent-purple",
    background: "bg-accent-purple/15",
  },
  {
    icon: BadgeCheck,
    title: "Show evidence of your skills",
    description: "Bring together the work behind your claims so your strengths are easier to recognise.",
    color: "text-accent-cyan",
    background: "bg-accent-cyan/15",
  },
  {
    icon: BriefcaseBusiness,
    title: "Find the right opportunities",
    description: "Explore roles that fit your experience and take the next step with confidence.",
    color: "text-accent-emerald",
    background: "bg-accent-emerald/15",
  },
];

const steps = [
  ["01", "Share your profile", "Upload your resume and add the work that represents you best."],
  ["02", "Build trust", "Present a clearer, evidence-led picture of your skills and experience."],
  ["03", "Move forward", "Discover relevant roles and put your best work in front of recruiters."],
];

function Dashboard() {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-accent-purple/20 blur-3xl" />
      <div className="absolute top-72 -right-20 h-80 w-80 rounded-full bg-accent-cyan/15 blur-3xl" />

      <section className="relative pt-8 pb-20 text-center md:pt-14 md:pb-28">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-4xl"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent-purple/30 bg-accent-purple/10 px-4 py-2 text-sm font-medium text-accent-purple">
            <Sparkles className="h-4 w-4" />
            About Patina
          </div>
          <h1 className="font-display text-4xl font-extrabold leading-tight text-white md:text-6xl">
            Your work deserves to be <span className="bg-gradient-to-r from-accent-purple to-accent-cyan bg-clip-text text-transparent">seen clearly.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/65 md:text-lg">
            Patina helps candidates turn their experience into a profile that is credible, easy to understand, and ready for the opportunities ahead.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/candidate/upload" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan px-6 py-3 font-semibold text-white no-underline transition hover:shadow-glow-purple">
              <FileUp className="h-5 w-5" />
              Add your resume
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/candidate/jobs" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-semibold text-white no-underline transition hover:border-accent-cyan/40 hover:bg-white/10">
              Browse jobs
            </Link>
          </div>
        </motion.div>
      </section>

      <section className="relative pb-20">
        <div className="grid gap-5 md:grid-cols-3">
          {features.map(({ icon: Icon, title, description, color, background }, index) => (
            <motion.article
              key={title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + index * 0.1, duration: 0.45 }}
              className="glass-card p-6"
            >
              <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${background}`}>
                <Icon className={`h-6 w-6 ${color}`} />
              </div>
              <h2 className="text-xl font-bold text-white">{title}</h2>
              <p className="mt-3 leading-6 text-white/60">{description}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="relative mb-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-10">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-emerald/15">
              <ShieldCheck className="h-6 w-6 text-accent-emerald" />
            </div>
            <h2 className="text-3xl font-bold text-white">A more human way to present potential.</h2>
            <p className="mt-4 leading-7 text-white/60">
              Patina is built around the idea that a resume is only the beginning. It gives candidates room to show the substance of their work and gives recruiters a clearer starting point for meaningful conversations.
            </p>
            <div className="mt-6 flex items-center gap-3 text-sm text-white/70">
              <Users className="h-5 w-5 text-accent-cyan" />
              Built for candidates and the teams hiring them.
            </div>
          </div>

          <div className="space-y-4">
            {steps.map(([number, title, description]) => (
              <div key={number} className="flex gap-4 rounded-2xl border border-white/5 bg-background/40 p-5">
                <span className="text-sm font-bold text-accent-purple">{number}</span>
                <div>
                  <h3 className="font-semibold text-white">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-white/55">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
