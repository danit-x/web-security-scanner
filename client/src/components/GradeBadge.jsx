// components/GradeBadge.jsx
// The prominent grade display — used on ReportPage (large) and
// HistoryPage cards (small). A circular badge with the letter grade
// and numeric score, color-coded by grade.

const getGradeColor = (grade) => {
  if (grade === 'A' || grade === 'B') return 'bg-emerald-950/40 border-emerald-800 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]';
  if (grade === 'C') return 'bg-amber-950/40 border-amber-800 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]';
  return 'bg-red-950/40 border-red-900 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]'; // D, E, F
};

function GradeBadge({ grade, score, size = 'large' }) {
  const sizeClasses = size === 'large'
    ? 'w-20 h-20 text-3xl sm:w-28 sm:h-28 sm:text-5xl border-2'
    : 'w-14 h-14 text-xl sm:w-16 sm:h-16 sm:text-2xl border';

  const scoreTextSize = size === 'large' ? 'text-xs sm:text-sm' : 'text-[10px]';

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-none backdrop-blur-sm ${sizeClasses} ${getGradeColor(grade)}`}
    >
      <span className="font-metal font-bold leading-none tracking-wider">{grade}</span>
      <span className={`font-mono mt-1 opacity-80 ${scoreTextSize}`}>{score}/100</span>
    </div>
  );
}

export default GradeBadge;