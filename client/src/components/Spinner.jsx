function Spinner({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-2.5 p-8">
      {/* Punchy Crimson Red Spinner with Neon Glow */}
      <span className="w-5 h-5 border-[3px] border-red-950/40 border-t-red-500 rounded-full animate-spin drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
      <span className="text-zinc-400 font-mono text-sm tracking-wide">{label}</span>
    </div>
  );
}

export default Spinner;