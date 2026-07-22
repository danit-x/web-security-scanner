const SEVERITY_STYLES = {
  CRITICAL: {
    bg: 'bg-red-950/40 border-red-900 text-red-500 shadow-[0_0_10px_rgba(153,27,27,0.3)]',
    label: 'Critical',
  },
  HIGH: {
    bg: 'bg-red-950/20 border-red-950 text-red-600',
    label: 'High',
  },
  MEDIUM: {
    bg: 'bg-amber-950/20 border-amber-900/60 text-amber-500',
    label: 'Medium',
  },
  LOW: {
    bg: 'bg-black/40 border-[#8f706b]/40 text-[#8f706b]',
    label: 'Low',
  },
};

function FindingCard({ finding }) {
  const severityStyle = SEVERITY_STYLES[finding.severity] || {
    bg: 'bg-black/40 border-gray-800 text-gray-500',
    label: finding.severity || 'Unknown',
  };

  return (
    <div className="bg-[#050000]/80 border border-red-950/60 rounded-none p-4 mb-3 backdrop-blur-sm">
      <span className={`inline-block px-2.5 py-0.5 border text-[10px] font-mono tracking-widest uppercase rounded-none mb-2 ${severityStyle.bg}`}>
        {severityStyle.label}
      </span>

      <p className="text-white/90 font-mono text-sm mb-2.5 leading-relaxed">
        {finding.description}
      </p>

      <div className="bg-black/60 border-l-2 border-[#8f706b]/60 rounded-none px-3 py-2.5">
        <span className="text-[#8f706b] text-xs font-bold uppercase tracking-wider">Recommendation:</span>{' '}
        <span className="text-white/80 text-sm font-mono">{finding.recommendation}</span>
      </div>
    </div>
  );
}

export default FindingCard;