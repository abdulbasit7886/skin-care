import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import PageHeader from '@/site/components/PageHeader';
import GalleryTile from '@/site/components/GalleryTile';
import { gallery } from '@/site/content';
import { usePageTitle } from '@/site/SiteData';

// First tile is larger to give the grid a focal point.
const tileClass = (i) => (i === 0 ? 'aspect-[4/3] sm:col-span-2 lg:row-span-2 lg:aspect-auto' : 'aspect-[4/3]');

export default function Gallery() {
  usePageTitle('Gallery');
  const [active, setActive] = useState(null);
  return (
    <>
      <PageHeader title="Inside the clinic" lead="A look at where you will be seen and treated." />
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
        <div className="grid auto-rows-auto gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {gallery.map((item, i) => (
            <GalleryTile key={item.src || item.caption} item={item} className={tileClass(i)} onOpen={() => setActive(item)} />
          ))}
        </div>
      </section>

      <Dialog open={!!active} onOpenChange={(open) => { if (!open) setActive(null); }}>
        <DialogContent className="max-w-4xl border-none bg-[#fcfaf7] p-3 sm:p-4">
          {active && (
            <>
              <img src={active.src} alt={active.caption} className="max-h-[78vh] w-full rounded-xl object-contain" />
              <DialogTitle className="px-1 pt-2 font-body text-base font-normal text-[#1e4842]">{active.caption}</DialogTitle>
              <DialogDescription className="sr-only">Enlarged gallery photo</DialogDescription>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
