// components/GradeBadge.jsx
// The prominent grade display — used on ReportPage (large) and
// HistoryPage cards (small). A circular badge with the letter grade
// and numeric score, color-coded by grade.

const getGradeColor = (grade) => {
  if (grade === 'A' || grade === 'B') return 'bg-grade-good';
  if (grade === 'C') return 'bg-grade-mid';
  return 'bg-grade-bad'; // D, E, F
};

function GradeBadge({ grade, score, size = 'large' }) {
  const sizeClasses = size === 'large'
    ? 'w-20 h-20 text-3xl sm:w-28 sm:h-28 sm:text-5xl'
    : 'w-14 h-14 text-xl sm:w-16 sm:h-16 sm:text-2xl';

  const scoreTextSize = size === 'large' ? 'text-sm' : 'text-[10px]';

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-full shadow-lg ${sizeClasses} ${getGradeColor(grade)}`}
    >
      <span className="font-extrabold text-bg leading-none">{grade}</span>
      <span className={`font-semibold text-bg/80 mt-1 ${scoreTextSize}`}>{score}/100</span>
    </div>
  );
}

export default GradeBadge;