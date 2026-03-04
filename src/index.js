import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';
import App, { PublicArtistPage } from './App';
import PrivacyPolicy from './PrivacyPolicy';
import TermsOfService from './TermsOfService';
import CookiePolicy from './CookiePolicy';
import CookieConsentBanner from './CookieConsentBanner';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/artist/:artistSlug" element={<PublicArtistPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/cookies" element={<CookiePolicy />} />
        </Routes>
        <CookieConsentBanner />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);

// Register service worker for PWA
serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    console.log('New version available! Refresh to update.');
  },
  onSuccess: (registration) => {
    console.log('App ready for offline use');
  }
});
