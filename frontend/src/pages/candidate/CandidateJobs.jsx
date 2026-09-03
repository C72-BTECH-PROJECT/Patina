import React, { useEffect, useState } from 'react';
import { Briefcase, MapPin } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function CandidateJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/jobs`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not load jobs.');
        setJobs(data);
      } catch (loadError) {
        setError(loadError.message || 'Could not load jobs.');
      } finally {
        setLoading(false);
      }
    };

    loadJobs();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Open Roles</h1>
      {loading && <p className="text-muted-foreground">Loading available jobs...</p>}
      {error && <p className="text-destructive">{error}</p>}
      {!loading && !error && jobs.length === 0 && (
        <div className="card p-8 text-center">
          <Briefcase className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">No jobs available</h2>
          <p className="mt-2 text-sm text-muted-foreground">Please check back when recruiters publish new opportunities.</p>
        </div>
      )}
      {!loading && !error && jobs.length > 0 && (
      <div className="grid gap-4">
        {jobs.map((job) => (
          <div key={job.id} className="card p-5">
            <div className="flex items-center gap-3 mb-2">
              <Briefcase className="w-5 h-5 text-foreground" />
              <h2 className="text-lg font-semibold text-foreground">{job.title}</h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>{job.location}</span>
              <span>•</span>
              <span>{job.experienceLevel}</span>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

export default CandidateJobs;
