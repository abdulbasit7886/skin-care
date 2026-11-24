import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '@/site/components/Header';
import Footer from '@/site/components/Footer';

function ScrollToTopOnNavigate() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function SiteLayout() {
  return (
    <div className="hs-site">
      <a href="#main" className="hs-skip">Skip to content</a>
      <ScrollToTopOnNavigate />
      <Header />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
