function Spinner({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-2.5 p-8">
      <span className="w-5 h-5 border-[3px] border-text-secondary/30 border-t-text-primary rounded-full animate-spin" />
      <span className="text-text-secondary text-sm">{label}</span>
    </div>
  );
}

export default Spinner;