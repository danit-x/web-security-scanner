const SEVERITY_STYLES = {
  CRITICAL: { bg: 'bg-critical', label: 'Critical' },
  HIGH: { bg: 'bg-high', label: 'High' },
  MEDIUM: { bg: 'bg-medium', label: 'Medium' },
  LOW: { bg: 'bg-low', label: 'Low' },
};

function FindingCard({ finding }) {
  const severityStyle = SEVERITY_STYLES[finding.severity] || {
    bg: 'bg-text-muted',
    label: finding.severity || 'Unknown',
  };

  return (
    <div className="bg-bg border border-border rounded-lg p-4 mb-3">
      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide text-bg mb-2 ${severityStyle.bg}`}>
        {severityStyle.label}
      </span>

      <p className="text-text-primary text-sm mb-2.5 leading-relaxed">
        {finding.description}
      </p>

      <div className="bg-surface rounded-md px-3 py-2.5">
        <span className="text-text-secondary text-xs font-bold">Recommendation:</span>{' '}
        <span className="text-text-primary/90 text-sm">{finding.recommendation}</span>
      </div>
    </div>
  );
}

export default FindingCard;