import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { jobs, applications, candidates } from "./data/mockData";
import CandidateModal from "./components/CandidateModal";

function JobDetails() {
  const { id } = useParams();

  const job = jobs.find(j => j._id === id);
  const apps = applications.filter(a => a.job === id);

  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [filterScore, setFilterScore] = useState(0);
  const [activeTab, setActiveTab] = useState("all");

  if (!job) {
    return <div className="text-center py-12">Job not found</div>;
  }

  // 🎯 FILTER + SORT LOGIC
  const filteredApps = apps
    .filter(app => {
      if (filterScore > 0 && app.credibilityScore < filterScore) return false;
      if (activeTab !== "all" && app.status !== activeTab) return false;
      return true;
    })
    .sort((a, b) => b.credibilityScore - a.credibilityScore);

  return (
    <div className="p-6 animate-fadeIn">

      {/* 🔙 BACK */}
      <Link
        to="/recruiter/jobs"
        className="text-slate-500 hover:text-indigo-600 mb-6 inline-block font-medium"
      >
        ← Back to Jobs
      </Link>

      {/* 🧾 JOB INFO */}
      <div className="bg-white rounded-2xl shadow-sm border p-8 mb-8">
        <h1 className="text-3xl font-bold mb-2">{job.title}</h1>
        <p className="text-slate-600 mb-4">{job.description}</p>

        <div className="flex flex-wrap gap-2">
          <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-semibold">
            {job.experienceLevel}
          </span>

          {job.requiredSkills.map(skill => (
            <span
              key={skill}
              className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* 📊 FILTER + TABS */}
      <div className="bg-white rounded-xl p-6 mb-6 shadow-sm border">

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          {["all", "applied", "shortlisted", "rejected"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition 
                ${activeTab === tab
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600"}
              `}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Score Filter */}
        <div>
          <label className="text-sm font-semibold text-slate-600">
            Minimum Score: {filterScore}+
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={filterScore}
            onChange={(e) => setFilterScore(Number(e.target.value))}
            className="w-full mt-2 accent-indigo-600"
          />
        </div>
      </div>

      {/* 📋 RESULTS */}
      <h2 className="text-xl font-bold mb-4">
        Showing {filteredApps.length} Candidates
      </h2>

      <div className="grid gap-4">

        {filteredApps.map(app => {
          const candidate = candidates.find(c => c._id === app.candidate);

          if (!candidate) return null;

          return (
            <div
              key={app._id}
              className="bg-white p-6 rounded-xl shadow border flex justify-between items-center hover:shadow-md transition"
            >
              <div className="flex items-center gap-4">

                {/* Avatar */}
                <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-lg">
                  {candidate.name.charAt(0)}
                </div>

                {/* Info */}
                <div>
                  <h3 className="font-bold text-lg">{candidate.name}</h3>

                  <div className="flex gap-3 mt-1 text-sm">

                    <span className="text-slate-500">
                      Score:
                      <span className="ml-1 font-semibold text-indigo-600">
                        {app.credibilityScore}
                      </span>
                    </span>

                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold
                        ${app.status === "shortlisted"
                          ? "bg-green-100 text-green-700"
                          : app.status === "rejected"
                          ? "bg-red-100 text-red-700"
                          : "bg-slate-100 text-slate-600"}
                      `}
                    >
                      {app.status}
                    </span>

                  </div>
                </div>
              </div>

              {/* Button */}
              <button
                onClick={() => setSelectedCandidate({
                                ...app,
                                ...candidate
                                })}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
              >
                View
              </button>
            </div>
          );
        })}

        {/* EMPTY STATE */}
        {filteredApps.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No candidates found
          </div>
        )}
      </div>

      {/* 🔍 MODAL */}
      {selectedCandidate && (
        <CandidateModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
        />
      )}
    </div>
  );
}

export default JobDetails;