// components/Spinner.jsx
// Small reusable loading spinner. Uses the same CSS keyframe animation
// ("spin") already defined in App.css for the scan button's spinner.

function Spinner({ label = 'Loading...' }) {
  return (
    <div style={styles.wrapper}>
      <span style={styles.spinner} />
      <span style={styles.label}>{label}</span>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.6rem',
    padding: '2rem',
  },
  spinner: {
    width: '20px',
    height: '20px',
    border: '3px solid rgba(226, 232, 240, 0.3)',
    borderTopColor: '#f8fafc',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  label: {
    color: '#94a3b8',
    fontSize: '0.95rem',
  },
};

export default Spinner;