function Dashboard() {
  const storedUser = localStorage.getItem('user');
  const user = storedUser ? JSON.parse(storedUser) : null;

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Dashboard</h1>
        <p style={styles.text}>
          Welcome to your dashboard{user ? `, ${user.name}` : ''}.
        </p>
        <p style={styles.note}>
          This is a placeholder page for authenticated users.
        </p>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: '24px',
    background: '#eef2f1',
  },
  card: {
    width: '100%',
    maxWidth: '560px',
    padding: '32px',
    borderRadius: '10px',
    background: '#ffffff',
    boxShadow: '0 14px 34px rgba(0, 0, 0, 0.08)',
    textAlign: 'center',
  },
  title: {
    marginBottom: '16px',
    fontSize: '32px',
    color: '#173c35',
  },
  text: {
    marginBottom: '12px',
    fontSize: '18px',
    color: '#2f4a44',
  },
  note: {
    fontSize: '14px',
    color: '#5f6e6a',
  },
};

export default Dashboard;
