import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function Upload() {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const navigate = useNavigate();

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'application/pdf' || droppedFile.name.endsWith('.pdf'))) {
      setFile(droppedFile);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleAnalyze = () => {
    navigate('/processing');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200">
      <header className="flex justify-between items-center py-5 px-6 md:px-12 bg-white shadow-sm">
        <Link to="/" className="flex items-center gap-2 no-underline text-slate-500 font-medium transition-colors hover:text-indigo-500">
          <span>←</span> Back
        </Link>
        <div className="flex items-center gap-2 text-xl font-bold text-indigo-500">
          <span className="w-8 h-8 flex items-center justify-center bg-indigo-500 text-white rounded-lg text-lg">✓</span>
<span className="font-extrabold tracking-tight text-2xl">PATINA</span>
        </div>
        <div className="w-[100px]"></div>
      </header>

      <main className="flex justify-center items-center min-h-[calc(100vh-80px)] py-12 px-6">
        <div className="max-w-2xl w-full">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800 text-center mb-3">Upload Your Resume</h1>
          <p className="text-lg text-slate-500 text-center mb-10">
            Upload your resume to start the skill verification process
          </p>

          <div
            className={`bg-white border-2 border-dashed rounded-2xl p-10 md:p-16 text-center transition-all cursor-pointer ${
              isDragging ? 'border-indigo-500 bg-indigo-50' : file ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-indigo-500 hover:bg-indigo-50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="flex items-center justify-between gap-4">
                <div className="text-5xl">📄</div>
                <div className="flex-1 text-left">
                  <span className="block font-semibold text-slate-800 text-lg">{file.name}</span>
                  <span className="block text-sm text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </div>
                <button
                  className="w-8 h-8 flex items-center justify-center bg-red-100 text-red-500 hover:bg-red-200 border-none rounded-full text-xl cursor-pointer transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                >
                  ×
                </button>
              </div>
            ) : (
              <>
                <div className="text-6xl mb-4">📁</div>
                <p className="text-lg text-slate-500 mb-2">
                  Drag and drop your resume here, or{' '}
                  <label className="text-indigo-500 cursor-pointer font-medium hover:underline">
                    browse
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </p>
                <p className="text-sm text-slate-400">Supports PDF files only</p>
              </>
            )}
          </div>

          <div className="mt-8 p-8 bg-white rounded-xl shadow-sm text-center">
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Connect GitHub (Optional)</h3>
            <p className="text-slate-500 mb-6">
              Connect your GitHub profile to verify your coding activity and contributions
            </p>
            <button className="inline-flex items-center gap-2 py-3 px-6 bg-[#24292e] hover:bg-[#1b1f22] text-white border-none rounded-lg text-base font-semibold cursor-pointer transition-all hover:-translate-y-0.5">
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="currentColor"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Login with GitHub
            </button>
          </div>

          <div className="mt-8 text-center">
            <button
              className={`group inline-flex items-center justify-center py-4 px-8 rounded-lg font-medium text-lg text-white transition-all ${file ? 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer shadow-md shadow-indigo-500/30' : 'bg-slate-400 cursor-not-allowed'}`}
              onClick={handleAnalyze}
              disabled={!file}
            >
              Analyze Resume
              <span className={`ml-2 transition-transform ${file ? 'group-hover:translate-x-1' : ''}`}>→</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Upload;