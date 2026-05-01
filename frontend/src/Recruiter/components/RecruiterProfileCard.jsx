import React from "react";

function RecruiterProfileCard({ recruiter }) {
  if (!recruiter) return null;

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 p-8 animate-fadeIn">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {recruiter.name}
          </h1>
          <p className="text-slate-500">{recruiter.email}</p>
        </div>

        {/* STATUS BADGE */}
        <span
          className={`px-4 py-2 rounded-full text-sm font-semibold ${
            recruiter.isVerified
              ? "bg-emerald-100 text-emerald-700"
              : "bg-red-100 text-red-600"
          }`}
        >
          {recruiter.isVerified ? "✔ Verified" : "⚠ Not Verified"}
        </span>
      </div>

      {/* COMPANY INFO */}
      <div className="mb-6">
        <p className="text-sm text-slate-500 mb-1">Company</p>
        <p className="text-lg font-semibold text-slate-800">
          {recruiter.companyName}
        </p>
      </div>

      {/* EXTRA INFO (STATIC FOR NOW) */}
      <div className="grid grid-cols-2 gap-4 mt-6">

        <div className="bg-slate-50 rounded-xl p-4 text-center">
          <p className="text-sm text-slate-500">Jobs Posted</p>
          <p className="text-2xl font-bold text-indigo-600">5</p>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 text-center">
          <p className="text-sm text-slate-500">Candidates Hired</p>
          <p className="text-2xl font-bold text-emerald-500">2</p>
        </div>

      </div>

      {/* ACTION */}
      {!recruiter.isVerified && (
        <div className="mt-6 bg-red-50 border border-red-200 p-4 rounded-xl">
          <p className="text-sm text-red-600 font-medium">
            Your account is not verified. Some features may be limited.
          </p>
        </div>
      )}
    </div>
  );
}

export default RecruiterProfileCard;