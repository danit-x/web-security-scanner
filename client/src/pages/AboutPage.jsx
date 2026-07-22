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
      <main className="min-h-[calc(100vh-65px)] bg-[#050000] flex justify-center items-start p-4 sm:p-8">
        {/* Main Card */}
        <div className="w-full max-w-2xl p-8 sm:p-12 bg-[#050000]/60 backdrop-blur-xl border border-red-950/80 shadow-[0_10px_30px_rgba(0,0,0,0.8)] rounded-none relative z-10">
          
          <div className="space-y-2 text-center border-b border-[#8f706b]/20 pb-6 mb-8">
            <h1 className="text-3xl sm:text-4xl text-white tracking-widest font-metal drop-shadow-[0_2px_4px_rgba(0,0,0,1)] uppercase">
              About This Scanner
            </h1>
            <p className="text-xs uppercase tracking-[0.2em] text-[#8f706b] font-bold">
              System Specifications & Directives
            </p>
          </div>

          <div className="space-y-8">
            <section className="space-y-2">
              <h2 className="text-sm uppercase tracking-widest font-metal text-white border-l-2 border-red-900 pl-3">
                What it does
              </h2>
              <p className="text-xs sm:text-sm text-[#8f706b] leading-relaxed tracking-wider">
                This tool runs a set of passive security checks against a URL you
                provide: HTTP security headers, SSL/TLS certificate validity,
                exposed sensitive files (like <code className="bg-black/60 border border-[#8f706b]/30 text-white px-1.5 py-0.5 rounded-none font-mono text-xs">.env</code> or{' '}
                <code className="bg-black/60 border border-[#8f706b]/30 text-white px-1.5 py-0.5 rounded-none font-mono text-xs">.git/config</code>), cookie security flags, mixed content,
                outdated JavaScript libraries, and basic CORS configuration.
                Results are graded A–F with specific recommendations for each
                issue found.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm uppercase tracking-widest font-metal text-white border-l-2 border-red-900 pl-3">
                What it doesn't do
              </h2>
              <p className="text-xs sm:text-sm text-[#8f706b] leading-relaxed tracking-wider">
                This is a passive scanner only. It does not attempt to exploit
                any vulnerability, brute-force credentials, inject payloads, or
                perform any active attack. It simply requests the page like a
                normal browser would and inspects the response.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm uppercase tracking-widest font-metal text-white border-l-2 border-red-900 pl-3">
                Why permission matters
              </h2>
              <p className="text-xs sm:text-sm text-[#8f706b] leading-relaxed tracking-wider">
                Scanning a website you don't own or have permission to test —
                even with passive, non-destructive checks — can violate a
                site's terms of service or, depending on jurisdiction, computer
                misuse laws. Always confirm you have explicit authorization
                before scanning a target, and only use this tool on sites you
                own or are contractually permitted to assess.
              </p>
            </section>

            <div className="pt-4 border-t border-[#8f706b]/20">
              <Link 
                to="/dashboard" 
                className="inline-flex items-center text-xs uppercase tracking-widest font-metal text-white hover:text-red-700 transition-colors gap-2"
              >
                <span>←</span> Return To Dashboard
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export default AboutPage;