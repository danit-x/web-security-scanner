// components/ui/Card.jsx
function Card({ children, className = '' }) {
  return (
    <div className={`bg-surface rounded-xl p-8 ${className}`}>
      {children}
    </div>
  );
}

export default Card;