// Public website content for the clinic.
// Edit this one file to change what the website says.
//
// Anything marked TODO is a placeholder and must be replaced with the clinic's real
// details before the site goes live. When the clinic's facility record in the EMR has a
// name, address, phone or email, the website uses those instead of the values below.

export const clinic = {
  name: 'Dr Safoora Skin Chemistry',
  tagline: 'Dermatology and skin care, planned around your skin.',
  intro:
    'Medical and aesthetic dermatology under one roof. We diagnose before we treat, explain every option, and follow up until your skin is where you want it to be.',
  address: 'Clinic address, City, Pakistan', // TODO: full street address
  phone: '+92 300 0000000', // TODO: clinic phone number as it should be displayed
  whatsapp: '923000000000', // TODO: WhatsApp number, digits only, country code first (no + or spaces)
  email: 'info@example.com', // TODO: clinic email address
  hours: [
    // TODO: confirm opening hours
    { days: 'Monday to Saturday', time: '11:00 am to 8:00 pm' },
    { days: 'Sunday', time: 'Closed' },
  ],
};

export const social = {
  instagram: 'https://www.instagram.com/', // TODO: clinic Instagram profile URL
  youtube: 'https://www.youtube.com/', // TODO: clinic YouTube channel URL
  facebook: 'https://www.facebook.com/', // TODO: clinic Facebook page URL
  // WhatsApp uses clinic.whatsapp above.
};

export const about = {
  heading: 'A skin clinic that starts with a diagnosis',
  paragraphs: [
    // TODO: replace with the clinic's own story
    'Dr Safoora Skin Chemistry was founded on a simple idea: good skin care is medical care. Every visit begins with a proper consultation, so treatment is based on what your skin actually needs rather than on what is fashionable.',
    'We treat the full range of skin, hair and nail conditions, from acne and pigmentation to eczema and hair loss, and we offer aesthetic procedures in the same clinic, delivered by the same doctors who know your history.',
    'Your records are kept securely in our electronic medical record system, so every follow-up picks up exactly where the last one left off.',
  ],
  firstVisit: {
    title: 'Visiting for the first time?',
    // TODO: confirm what patients should bring and how long a first consultation takes
    text: 'Bring any previous prescriptions, reports and the skin care products you currently use. Allow about 20 minutes for your first consultation.',
  },
  values: [
    {
      title: 'Diagnosis first',
      text: 'We find the cause before recommending a treatment, and we tell you when something is better left alone.',
    },
    {
      title: 'Plain explanations',
      text: 'You leave every appointment knowing what we found, what we suggest, what it costs and what to expect.',
    },
    {
      title: 'Evidence-based care',
      text: 'Treatments and products are chosen on clinical evidence, not trends.',
    },
    {
      title: 'Continuity',
      text: 'The doctor who starts your treatment sees it through, with your full history on record at every visit.',
    },
  ],
};

// Shown on the home page under "What we treat".
export const concerns = [
  { name: 'Acne and acne scars', text: 'Active breakouts, marks and textural scarring.' },
  { name: 'Pigmentation and melasma', text: 'Dark patches, uneven tone and sun damage.' },
  { name: 'Eczema and psoriasis', text: 'Long-term plans for chronic, inflamed skin.' },
  { name: 'Hair and scalp', text: 'Hair fall, thinning and scalp conditions.' },
  { name: 'Ageing skin', text: 'Fine lines, laxity and dullness.' },
  { name: 'Moles, warts and skin tags', text: 'Assessment and safe removal.' },
];

// Used when the EMR has no services or procedures yet. When the EMR does list them,
// any matching name below lends its description to the live entry.
export const fallbackServices = [
  { name: 'Dermatology consultation', description: 'A full assessment of your skin, hair or nail concern with a treatment plan.' },
  { name: 'Follow-up consultation', description: 'Progress review and adjustments to your ongoing treatment.' },
  { name: 'Chemical peels', description: 'Controlled exfoliation for pigmentation, acne and dull skin.' },
  { name: 'Microneedling', description: 'Collagen induction for acne scars, texture and fine lines.' },
  { name: 'Laser treatments', description: 'Targeted treatment for hair removal, pigmentation and redness.' },
  { name: 'Hydrafacial', description: 'Deep cleansing, extraction and hydration in one session.' },
  { name: 'PRP therapy', description: 'Platelet-rich plasma for hair thinning and skin rejuvenation.' },
  { name: 'Mole and skin tag removal', description: 'Assessment and minor procedures for benign growths.' },
];

// Used when the EMR has no doctors marked for the website yet.
export const fallbackDoctors = [
  {
    id: 'founder',
    title: 'Dr',
    name: 'Safoora', // TODO: full name
    specialization: 'Consultant Dermatologist', // TODO: confirm title and qualifications
    photo_url: '',
    bio: 'Founder of the clinic. Sees patients for medical and aesthetic dermatology.', // TODO: short professional bio
  },
];

// Gallery photos. Put the image files in public/site/gallery/ using these names, or change the names here.
// Until a photo exists, the site shows a neutral placeholder tile with the caption.
export const gallery = [
  { src: '/site/gallery/reception.jpg', caption: 'Reception' },
  { src: '/site/gallery/consultation-room.jpg', caption: 'Consultation room' },
  { src: '/site/gallery/procedure-room.jpg', caption: 'Procedure room' },
  { src: '/site/gallery/laser-suite.jpg', caption: 'Laser suite' },
  { src: '/site/gallery/waiting-area.jpg', caption: 'Waiting area' },
  { src: '/site/gallery/clinic-entrance.jpg', caption: 'Clinic entrance' },
];

// TODO: SAMPLE REVIEWS — replace with real reviews that patients have agreed to publish,
// then set `sample: false` (or remove the field). Entries with `sample: true` are labelled
// "Sample review" on the site so they are never mistaken for genuine ones.
export const testimonials = [
  {
    name: 'Sample patient',
    text: 'The doctor explained exactly what was causing my breakouts and what each step of the treatment would do. Three months in, my skin is the clearest it has been in years.',
    rating: 5,
    sample: true,
  },
  {
    name: 'Sample patient',
    text: 'I came in for pigmentation and was surprised how much time was spent on the consultation. No pressure to buy anything, just a clear plan.',
    rating: 5,
    sample: true,
  },
  {
    name: 'Sample patient',
    text: 'Booking was easy, the clinic runs on time, and my follow-up visits pick up right where we left off.',
    rating: 4,
    sample: true,
  },
];
