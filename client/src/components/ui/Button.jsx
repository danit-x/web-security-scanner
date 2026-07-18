// components/ui/Button.jsx
// Shared button component so every page uses identical styling.
// variant="primary" for main actions, "secondary" for less prominent ones,
// "danger" for destructive actions like logout.

function Button({ children, variant = 'primary', disabled, className = '', ...props }) {
  const base = 'px-4 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-primary hover:bg-primary-hover text-white',
    secondary: 'bg-transparent border border-border text-text-primary hover:bg-surface',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`.trim()}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;