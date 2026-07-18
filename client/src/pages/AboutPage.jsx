// pages/AboutPage.jsx
// Public-facing explanation of what the scanner does, what it deliberately
// does NOT do, and why ownership/permission matters. Linked from the
// disclaimer checkbox on Dashboard.

import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

function AboutPage() {
  return (
    <>
      <Navbar />
      <main style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.title}>About This Scanner</h1>

          <section style={styles.section}>
            <h2 style={styles.heading}>What it does</h2>
            <p style={styles.text}>
              This tool runs a set of passive security checks against a URL you
              provide: HTTP security headers, SSL/TLS certificate validity,
              exposed sensitive files (like <code>.env</code> or{' '}
              <code>.git/config</code>), cookie security flags, mixed content,
              outdated JavaScript libraries, and basic CORS configuration.
              Results are graded A–F with specific recommendations for each
              issue found.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.heading}>What it doesn't do</h2>
            <p style={styles.text}>
              This is a passive scanner only. It does not attempt to exploit
              any vulnerability, brute-force credentials, inject payloads, or
              perform any active attack. It simply requests the page like a
              normal browser would and inspects the response.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.heading}>Why permission matters</h2>
            <p style={styles.text}>
              Scanning a website you don't own or have permission to test —
              even with passive, non-destructive checks — can violate a
              site's terms of service or, depending on jurisdiction, computer
              misuse laws. Always confirm you have explicit authorization
              before scanning a target, and only use this tool on sites you
              own or are contractually permitted to assess.
            </p>
          </section>

          <Link to="/dashboard" style={styles.backLink}>
            ← Back to Dashboard
          </Link>
        </div>
      </main>
    </>
  );
}

const styles = {
  page: {
    display: 'flex',
    justifyContent: 'center',
    minHeight: 'calc(100vh - 65px)',
    backgroundColor: '#0f172a',
    padding: '1rem 1rem 2rem',
  },
  card: {
    backgroundColor: '#1e293b',
    padding: '1.25rem 1.25rem 1.5rem',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '650px',
  },
  title: { color: '#f8fafc', fontSize: '1.5rem', marginBottom: '1.5rem' },
  section: { marginBottom: '1.5rem' },
  heading: { color: '#f8fafc', fontSize: '1.05rem', marginBottom: '0.5rem' },
  text: { color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.6 },
  backLink: {
    display: 'inline-block',
    color: '#60a5fa',
    fontSize: '0.9rem',
    textDecoration: 'none',
    marginTop: '1rem',
  },
};

export default AboutPage;