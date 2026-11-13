import React from 'react';
import ApplicationsTable, { useApplications } from '../../components/recruiter/ApplicationsTable';

/**
 * All applications to the recruiter's jobs (card R-18, Y2). Replaces the old
 * candidates page, which called a removed route. Data and actions live in
 * ApplicationsTable: GET /api/recruiter/applications (no jobId).
 */
function Applications() {
  const data = useApplications();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 font-heading font-semibold text-foreground mb-2">Applications</h1>
        <p className="text-body-sm text-muted-foreground">
          Every application to your jobs, ranked by credibility score. Open one to see how its score
          was produced.
        </p>
      </div>
      <ApplicationsTable
        data={data}
        showJob
        emptyText="No candidate has applied to any of your jobs yet."
      />
    </div>
  );
}

export default Applications;
