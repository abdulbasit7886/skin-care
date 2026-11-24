import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import '@/site/site.css';
import { SiteDataProvider } from '@/site/SiteData';
import SiteLayout from '@/site/components/SiteLayout';
import Home from '@/site/pages/Home';
import About from '@/site/pages/About';
import Doctors from '@/site/pages/Doctors';
import Services from '@/site/pages/Services';
import Gallery from '@/site/pages/Gallery';
import Testimonials from '@/site/pages/Testimonials';
import Contact from '@/site/pages/Contact';
import NotFound from '@/site/pages/NotFound';

// The public clinic website. The EMR portal is a separate app under /portal (see src/main.jsx).
export default function Site() {
  return (
    <SiteDataProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<Home />} />
            <Route path="about" element={<About />} />
            <Route path="doctors" element={<Doctors />} />
            <Route path="services" element={<Services />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="testimonials" element={<Testimonials />} />
            <Route path="contact" element={<Contact />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SiteDataProvider>
  );
}
