import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <div className="mt-auto py-8 border-t border-white/5">
      <div className="max-w-6xl mx-auto px-4 text-center">
        <div className="flex items-center justify-center gap-4 text-sm text-white/40">
          <Link to="/privacy" className="hover:text-white/70 transition-colors">Privacy Policy</Link>
          <span>&middot;</span>
          <Link to="/terms" className="hover:text-white/70 transition-colors">Terms of Service</Link>
          <span>&middot;</span>
          <Link to="/cookies" className="hover:text-white/70 transition-colors">Cookie Policy</Link>
        </div>
        <p className="text-white/20 text-xs mt-3">&copy; {new Date().getFullYear()} MySetlists</p>
      </div>
    </div>
  );
}
