import React from "react";
import { Briefcase, MapPin } from "lucide-react";

const sampleJobs = [
  { id: "open-1", title: "Frontend Developer", location: "Remote", type: "Full-time" },
  { id: "open-2", title: "Backend Engineer", location: "Bangalore", type: "Full-time" },
  { id: "open-3", title: "Data Analyst", location: "Mumbai", type: "Contract" },
];

function CandidateJobs() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Open Roles</h1>
      <div className="grid gap-4">
        {sampleJobs.map((job) => (
          <div key={job.id} className="glass-card p-5 border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <Briefcase className="w-5 h-5 text-accent-purple" />
              <h2 className="text-lg font-semibold text-white">{job.title}</h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-white/60">
              <MapPin className="w-4 h-4" />
              <span>{job.location}</span>
              <span>•</span>
              <span>{job.type}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CandidateJobs;
