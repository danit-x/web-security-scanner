// components/ui/Input.jsx
function Input({ className = '', ...props }) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2.5 rounded-lg bg-bg border border-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-primary disabled:opacity-50 ${className}`.trim()}
    />
  );
}

export default Input;