import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const SUGGESTED_SKILLS = ["React", "Node.js", "Python", "AWS", "TypeScript", "Django", "Machine Learning", "Docker", "Kubernetes", "MongoDB", "SQL", "Go"];

function CreateJob() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState([]);
  const [experience, setExperience] = useState('');

  const toggleSkill = (skill) => {
    if (skills.includes(skill)) {
      setSkills(skills.filter(s => s !== skill));
    } else {
      setSkills([...skills, skill]);
    }
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if(!title || skills.length === 0) {
      alert("Please fill title and select at least one skill.");
      return;
    }
    // Simulate pushing to backend and navigating
    setTimeout(() => {
      navigate('/recruiter/jobs');
    }, 500);
  };

  return (
    <div className="max-w-3xl mx-auto animate-fadeIn">
      <div className="mb-8">
        <Link to="/recruiter/dashboard" className="text-slate-500 hover:text-indigo-600 mb-4 inline-block font-medium">← Back to Dashboard</Link>
        <h1 className="text-3xl font-bold text-slate-800">Create New Job Listing</h1>
        <p className="text-slate-500 mt-2">Fill out the details below to start receiving vetted candidates.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        <form onSubmit={handleCreate} className="flex flex-col gap-6">
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Job Title</label>
            <input 
              type="text" 
              required 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              placeholder="e.g., Senior Full Stack Engineer"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Required Skills</label>
            <p className="text-xs text-slate-500 mb-3">Select the core skills required for this position to filter credibility scores appropriately.</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_SKILLS.map(skill => {
                const isSelected = skills.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all transform hover:scale-105 active:scale-95 border-2 ${
                      isSelected 
                        ? 'bg-indigo-100 text-indigo-700 border-indigo-200' 
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {isSelected && <span className="mr-1">✓</span>}
                    {skill}
                  </button>
                );
              })}
            </div>
            {skills.length === 0 && <span className="text-amber-500 text-xs mt-2 block animate-pulse">Select at least one skill.</span>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Experience Level</label>
              <select 
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                className="w-full px-4 py-3 bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors appearance-none"
              >
                <option value="">Select Level...</option>
                <option value="0-2 years">0-2 years (Entry Level)</option>
                <option value="2-5 years">2-5 years (Mid Level)</option>
                <option value="5+ years">5+ years (Senior Level)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
            <textarea 
              rows="4"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
              placeholder="Describe the role responsibilities..."
            ></textarea>
          </div>

          <div className="pt-6 mt-2 border-t border-slate-100 flex justify-end">
            <button 
              type="submit" 
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-sm"
            >
              Post Job Listing
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

export default CreateJob;