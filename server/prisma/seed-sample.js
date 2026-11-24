// Adds realistic sample clinic activity to the demo facility (development only):
// patients, ~6 weeks of appointments (completed / no-show / cancelled / upcoming),
// EMRs with prescriptions, paid & printed invoices, a few corrected invoices,
// addenda and website enquiries. Run after `npm run db:seed`. Skips if already present.
import { prisma } from '../src/db.js';
import { config } from '../src/config.js';
import { clinicDate, clinicTime, clinicDayBoundary, parseTimeToMinutes } from '../src/time.js';

const FACILITY_NAME = 'Dr Safoora Skin Chemistry';
const MARK = 'MRN-2026-1'; // sample patients use MRN-2026-1xxx

// ---------------------------------------------------------------- deterministic randomness
let seed = 20261125;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
const sample = (arr, n) => [...arr].sort(() => rand() - 0.5).slice(0, n);
const pad = (n, w = 2) => String(n).padStart(w, '0');

// ---------------------------------------------------------------- reference data
const FEMALE = ['Ayesha', 'Fatima', 'Zainab', 'Hira', 'Sana', 'Maryam', 'Iqra', 'Amna', 'Mahnoor', 'Rabia', 'Sadia', 'Noor', 'Areeba', 'Khadija', 'Saba', 'Anum', 'Mehwish', 'Hafsa', 'Laiba', 'Kiran'];
const MALE = ['Ahmed', 'Ali', 'Hamza', 'Usman', 'Bilal', 'Hassan', 'Omar', 'Saad', 'Faisal', 'Imran', 'Zeeshan', 'Danish', 'Shahzaib', 'Waqas', 'Adeel', 'Kamran', 'Asad', 'Junaid', 'Fahad', 'Talha'];
const SURNAMES = ['Khan', 'Malik', 'Butt', 'Chaudhry', 'Sheikh', 'Qureshi', 'Raza', 'Hussain', 'Iqbal', 'Siddiqui', 'Mirza', 'Javed', 'Aslam', 'Akhtar', 'Rana', 'Shah', 'Baig', 'Nawaz', 'Tariq', 'Farooq'];
const AREAS = ['Gulberg III', 'DHA Phase 5', 'Model Town', 'Johar Town', 'Bahria Town', 'Garden Town', 'Cantt', 'Faisal Town', 'Wapda Town', 'Valencia', 'Township', 'Iqbal Town'];
const PROFESSIONS = ['Student', 'Teacher', 'Banker', 'Engineer', 'Housewife', 'Doctor', 'Business', 'Software Developer', 'Accountant', 'Nurse', 'Lawyer', 'Designer', 'Shopkeeper', 'Retired'];
const REFERRALS = ['Self', 'Self', 'Instagram', 'Google search', 'Friend / family', 'Facebook', 'Dr. Asma (GP)', 'Website'];

const CASES = [
  {
    complaint: 'Pimples on face for 6 months', history: 'Papules and pustules on cheeks and forehead, worse before menses. Using OTC face washes without benefit.',
    differential: 'Acne vulgaris; Rosacea; Folliculitis', diagnosis: 'Acne vulgaris (moderate, inflammatory)',
    treatment: 'Oral doxycycline with topical adapalene/benzoyl peroxide. Gentle skin care.',
    rx: ['Cap Doxycycline 100 mg — 1, OD, 6 weeks, after meals', 'Gel Adapalene 0.1% — HS, 8 weeks, pea-sized amount on whole face', 'Gel Benzoyl peroxide 2.5% — OD, 8 weeks, morning', 'Cream Sunscreen SPF 50 — BD, 8 weeks'],
    labs: [], services: ['Acne Treatment'], procedures: [], advise: 'Avoid picking lesions. Non-comedogenic products only. Review in 6 weeks.', followup: 42,
  },
  {
    complaint: 'Dark patches on cheeks', history: 'Brown symmetrical patches on malar area for 1 year, worse with sun exposure. History of OCP use.',
    differential: 'Melasma; Post-inflammatory hyperpigmentation; Lichen planus pigmentosus', diagnosis: 'Melasma (epidermal type)',
    treatment: 'Triple combination cream at night, strict photoprotection, tranexamic acid.',
    rx: ['Cream Hydroquinone/Tretinoin/Fluocinolone — HS, 8 weeks, thin layer on patches', 'Tab Tranexamic acid 250 mg — 1, BD, 12 weeks, after meals', 'Cream Sunscreen SPF 50 — TDS, 12 weeks, reapply every 3 hours outdoors'],
    labs: ['Thyroid Profile'], services: ['Chemical Peel'], procedures: [], advise: 'Strict sun protection, wide-brimmed hat. Avoid hormonal pills if possible.', followup: 56,
  },
  {
    complaint: 'Itchy dry skin on arms and behind knees', history: 'Recurrent itchy eczema since childhood, flares in winter. Family history of asthma.',
    differential: 'Atopic dermatitis; Contact dermatitis; Scabies', diagnosis: 'Atopic dermatitis (flare)',
    treatment: 'Mid-potency topical steroid for 2 weeks, liberal emollients, antihistamine at night.',
    rx: ['Cream Mometasone 0.1% — OD, 2 weeks, on active patches only', 'Lotion Emollient — TDS, 8 weeks, whole body after bath', 'Tab Cetirizine 10 mg — 1, HS, 2 weeks'],
    labs: ['CBC'], services: [], procedures: [], advise: 'Lukewarm short baths, cotton clothing, avoid fragranced soaps.', followup: 14,
  },
  {
    complaint: 'Scaly plaques on elbows and scalp', history: 'Well-demarcated erythematous plaques with silvery scales for 2 years. Mild itching.',
    differential: 'Psoriasis vulgaris; Seborrheic dermatitis; Lichen simplex chronicus', diagnosis: 'Chronic plaque psoriasis (BSA ~5%)',
    treatment: 'Topical calcipotriol/betamethasone, coal tar shampoo.',
    rx: ['Ointment Calcipotriol/Betamethasone — OD, 4 weeks, on plaques', 'Solution Coal tar shampoo — Alternate day, 8 weeks, leave 5 minutes then rinse', 'Lotion Emollient — BD, 8 weeks'],
    labs: ['LFTs', 'CBC'], services: [], procedures: [], advise: 'Moisturise regularly. Avoid smoking and stress triggers.', followup: 28,
  },
  {
    complaint: 'Ring-shaped itchy rash on groin and waist', history: 'Annular itchy lesions with active border for 2 months; used steroid cream from pharmacy which worsened it.',
    differential: 'Tinea corporis/cruris; Nummular eczema; Erythema annulare', diagnosis: 'Tinea corporis et cruris (steroid-modified)',
    treatment: 'Oral itraconazole with topical antifungal. Stop topical steroids.',
    rx: ['Cap Itraconazole 100 mg — 2, OD, 4 weeks, after meals', 'Cream Luliconazole 1% — BD, 4 weeks, beyond the edge of lesions', 'Powder Clotrimazole dusting powder — OD, 4 weeks'],
    labs: ['Fungal Scraping', 'LFTs'], services: [], procedures: [], advise: 'Keep areas dry, wash clothes separately, treat family members if itchy.', followup: 21,
  },
  {
    complaint: 'Excessive hair fall for 3 months', history: 'Diffuse hair shedding after a febrile illness 4 months ago. No patches.',
    differential: 'Telogen effluvium; Androgenetic alopecia; Iron deficiency', diagnosis: 'Telogen effluvium',
    treatment: 'Reassurance, nutritional supplements, PRP advised.',
    rx: ['Tab Biotin 10 mg — 1, OD, 12 weeks', 'Solution Minoxidil 5% — BD, 12 weeks, 1 ml on scalp', 'Cap Iron + Folic acid — 1, OD, 8 weeks'],
    labs: ['CBC', 'Serum Ferritin', 'Vitamin D', 'Thyroid Profile'], services: ['Skin Analysis'], procedures: ['PRP Therapy'], advise: 'Balanced protein-rich diet. Expect improvement over 3–6 months.', followup: 30,
  },
  {
    complaint: 'Round bald patch on scalp', history: 'Single coin-sized smooth patch noticed 3 weeks ago. No scaling.',
    differential: 'Alopecia areata; Tinea capitis; Trichotillomania', diagnosis: 'Alopecia areata (single patch)',
    treatment: 'Intralesional triamcinolone, topical steroid.',
    rx: ['Solution Clobetasol 0.05% scalp — OD, 4 weeks, on patch only'],
    labs: ['Thyroid Profile', 'Vitamin D'], services: [], procedures: ['Intralesional Steroid Injection'], advise: 'Good prognosis for single patch. Repeat injection in 4 weeks.', followup: 28,
  },
  {
    complaint: 'Warts on fingers', history: 'Multiple rough papules on fingers for 5 months, slowly increasing.',
    differential: 'Verruca vulgaris; Callus', diagnosis: 'Verruca vulgaris (multiple)',
    treatment: 'Cryotherapy session, salicylic acid paint.',
    rx: ['Solution Salicylic acid 16.7% — HS, 6 weeks, after soaking and filing'],
    labs: [], services: [], procedures: ['Cryotherapy'], advise: 'Do not pick warts. Repeat cryotherapy every 2–3 weeks as needed.', followup: 21,
  },
  {
    complaint: 'Itchy wheals all over body', history: 'Recurrent transient wheals for 8 weeks, each lasting < 24 hours. No angioedema.',
    differential: 'Chronic spontaneous urticaria; Urticarial vasculitis', diagnosis: 'Chronic spontaneous urticaria',
    treatment: 'Second-generation antihistamine, up-dosing if needed.',
    rx: ['Tab Fexofenadine 180 mg — 1, BD, 4 weeks', 'Tab Montelukast 10 mg — 1, HS, 4 weeks'],
    labs: ['CBC', 'Thyroid Profile'], services: [], procedures: [], advise: 'Avoid NSAIDs and tight clothing. Keep a symptom diary.', followup: 28,
  },
  {
    complaint: 'White patches on hands', history: 'Depigmented macules on dorsum of hands for 1 year, slowly spreading.',
    differential: 'Vitiligo; Pityriasis alba; Post-inflammatory hypopigmentation', diagnosis: 'Vitiligo (acrofacial, active)',
    treatment: 'Topical tacrolimus, phototherapy discussed.',
    rx: ['Ointment Tacrolimus 0.1% — BD, 12 weeks, on patches', 'Tab Vitamin D3 50,000 IU — 1, Weekly, 8 weeks'],
    labs: ['Thyroid Profile', 'Vitamin D', 'CBC'], services: [], procedures: [], advise: 'Sun protection on patches. Avoid trauma to skin (Koebner).', followup: 42,
  },
  {
    complaint: 'Intense itching at night, family members also itchy', history: 'Itchy papules on finger webs, wrists and waist for 3 weeks.',
    differential: 'Scabies; Papular urticaria; Eczema', diagnosis: 'Scabies',
    treatment: 'Permethrin for patient and all household contacts.',
    rx: ['Cream Permethrin 5% — Stat, 1 weeks, neck down overnight, repeat after 7 days', 'Tab Levocetirizine 5 mg — 1, HS, 2 weeks'],
    labs: [], services: [], procedures: [], advise: 'Treat all family members together. Hot-wash bedding and clothes.', followup: 14,
  },
  {
    complaint: 'Redness and flushing on cheeks', history: 'Persistent central facial erythema with occasional papules, flushing with heat and spicy food.',
    differential: 'Rosacea; Acne vulgaris; Seborrheic dermatitis', diagnosis: 'Papulopustular rosacea',
    treatment: 'Topical ivermectin, avoid triggers.',
    rx: ['Cream Ivermectin 1% — OD, 8 weeks, whole face', 'Cream Sunscreen SPF 50 (mineral) — BD, 8 weeks'],
    labs: [], services: ['Hydrafacial'], procedures: [], advise: 'Avoid hot drinks, spicy food, saunas. Use gentle cleansers.', followup: 42,
  },
  {
    complaint: 'Mole on back, wants removal', history: 'Raised brown mole for many years, rubs against clothing. No change in size or colour.',
    differential: 'Compound melanocytic naevus; Seborrheic keratosis', diagnosis: 'Benign compound naevus',
    treatment: 'Shave excision done under local anaesthesia.',
    rx: ['Ointment Fusidic acid 2% — BD, 1 weeks, on wound', 'Tab Paracetamol 500 mg — 2, SOS, 3 days, for pain'],
    labs: [], services: [], procedures: ['Mole Removal'], advise: 'Keep dressing dry for 48 hours. Review for histopathology if needed.', followup: 10,
  },
  {
    complaint: 'Fine lines on forehead, wants anti-ageing treatment', history: 'Dynamic forehead lines and crow\'s feet. No prior treatments.',
    differential: 'Dynamic rhytides', diagnosis: 'Dynamic facial rhytides (cosmetic consultation)',
    treatment: 'Botulinum toxin to forehead area, skin care regimen.',
    rx: ['Cream Retinol 0.3% — HS, 12 weeks, alternate nights initially', 'Cream Sunscreen SPF 50 — BD, 12 weeks'],
    labs: [], services: ['Skin Analysis'], procedures: ['Botox (per area)'], advise: 'Do not lie down or rub the area for 4 hours after Botox.', followup: 14,
  },
  {
    complaint: 'Dandruff and itchy flaky scalp', history: 'Greasy scales on scalp and eyebrows, worse in winter.',
    differential: 'Seborrheic dermatitis; Psoriasis; Tinea capitis', diagnosis: 'Seborrheic dermatitis',
    treatment: 'Ketoconazole shampoo and mild topical steroid.',
    rx: ['Solution Ketoconazole 2% shampoo — Alternate day, 4 weeks, leave 5 minutes', 'Lotion Hydrocortisone 1% — OD, 1 weeks, eyebrows'],
    labs: [], services: [], procedures: [], advise: 'Continue shampoo weekly as maintenance.', followup: 28,
  },
  {
    complaint: 'Unwanted facial hair', history: 'Coarse hair on chin and upper lip, irregular periods.',
    differential: 'Hirsutism (PCOS); Idiopathic hirsutism', diagnosis: 'Hirsutism — ?PCOS',
    treatment: 'Laser hair removal sessions, gynae referral.',
    rx: ['Cream Eflornithine 11.5% — BD, 8 weeks, on affected area'],
    labs: ['Thyroid Profile', 'CBC'], services: ['Laser Hair Removal'], procedures: [], advise: 'Monthly laser sessions. Ultrasound pelvis and hormonal profile via gynaecologist.', followup: 30,
  },
];

const EXTRA_CATALOG = {
  services: [['Microneedling', 8000], ['Carbon Laser Facial', 7000]],
  procedures: [['Intralesional Steroid Injection', 3500], ['Wart Cautery', 3000], ['Skin Biopsy', 6000]],
  labs: ['KOH Mount', 'Fasting Blood Sugar', 'Serum Zinc'],
};

// ---------------------------------------------------------------- helpers
const at = (ymd, hhmm, plusMinutes = 0) => {
  const start = clinicDayBoundary(ymd);
  return new Date(start.getTime() + (parseTimeToMinutes(hhmm) + plusMinutes) * 60000);
};
const addDays = (ymd, n) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};
const weekday = (ymd) => new Date(`${ymd}T12:00:00Z`).getUTCDay(); // 0 = Sunday
const SLOTS = ['16:00', '16:20', '16:40', '17:00', '17:20', '17:40', '18:00', '18:20', '18:40', '19:00', '19:20', '19:40', '20:00', '20:20', '20:40'];

async function main() {
  if (config.isProd) throw new Error('Sample data is for development only.');
  const facility = await prisma.facility.findFirst({ where: { name: FACILITY_NAME, deleted_at: null } });
  if (!facility) throw new Error(`Demo facility "${FACILITY_NAME}" not found — run npm run db:seed with SEED_DEMO=true first.`);
  const fid = facility.id;
  if (await prisma.patient.findFirst({ where: { facility_id: fid, mrn: { startsWith: MARK } } })) {
    console.log('✓ Sample data already present — nothing to do.');
    return;
  }

  const users = await prisma.user.findMany({ where: { facility_id: fid } });
  const userBy = (role) => users.find((u) => u.role === role);
  const frontDesk = userBy('reception');
  const admin = userBy('admin');
  const doctors = await prisma.doctor.findMany({ where: { facility_id: fid, deleted_at: null }, orderBy: { name: 'asc' } });
  if (!doctors.length) throw new Error('No doctors in the demo facility.');
  const doctorUser = Object.fromEntries(users.filter((u) => u.doctor_id).map((u) => [u.doctor_id, u]));

  // ---- catalog top-up
  const have = async (model, name) => !!(await prisma[model].findFirst({ where: { facility_id: fid, name, deleted_at: null } }));
  for (const [name, price] of EXTRA_CATALOG.services) if (!(await have('service', name))) await prisma.service.create({ data: { facility_id: fid, name, price } });
  for (const [name, price] of EXTRA_CATALOG.procedures) if (!(await have('procedure', name))) await prisma.procedure.create({ data: { facility_id: fid, name, price } });
  for (const name of EXTRA_CATALOG.labs) if (!(await have('labTest', name))) await prisma.labTest.create({ data: { facility_id: fid, name } });
  const [services, procedures, labs, taxRates] = await Promise.all([
    prisma.service.findMany({ where: { facility_id: fid, deleted_at: null } }),
    prisma.procedure.findMany({ where: { facility_id: fid, deleted_at: null } }),
    prisma.labTest.findMany({ where: { facility_id: fid, deleted_at: null } }),
    prisma.taxRate.findMany({ where: { facility_id: fid, deleted_at: null }, orderBy: { effective_date: 'desc' } }),
  ]);
  const priceOf = (list, name) => Number(list.find((x) => x.name === name)?.price || 0);
  const labNames = new Set(labs.map((l) => l.name));
  const taxRateFor = (ymd) => Number(taxRates.find((t) => t.effective_date <= ymd)?.rate || 8);

  const today = clinicDate();
  const nowMin = parseTimeToMinutes(clinicTime());

  // ---- patients
  const patientRows = [];
  for (let i = 0; i < 42; i++) {
    const female = chance(0.62);
    const first = pick(female ? FEMALE : MALE);
    const last = pick(SURNAMES);
    const registered = addDays(today, -int(1, 75));
    patientRows.push({
      facility_id: fid,
      mrn: `${MARK}${pad(i + 1, 3)}`,
      first_name: first,
      last_name: last,
      name: `${first} ${last}`,
      sex: female ? 'Female' : 'Male',
      age: String(int(16, 62)),
      mobile: `03${int(0, 4)}${int(0, 9)}-${int(1000000, 9999999)}`,
      cnic: `35202-${int(1000000, 9999999)}-${int(1, 9)}`,
      father_husband: `${pick(MALE)} ${last}`,
      address: `House ${int(1, 250)}, Street ${int(1, 30)}, ${pick(AREAS)}, Lahore`,
      profession: pick(PROFESSIONS),
      referred_by: pick(REFERRALS),
      previous_diagnosis: chance(0.15) ? pick(['Diabetes', 'Hypertension', 'Asthma', 'Hypothyroidism', 'PCOS']) : null,
      created_by: frontDesk?.id ?? null,
      created_date: at(registered, '15:30', int(0, 300)),
      updated_date: at(registered, '15:30', int(0, 300)),
    });
  }
  const patients = await prisma.patient.createManyAndReturn({ data: patientRows });
  const caseFor = new Map(patients.map((p) => [p.id, pick(CASES)])); // each patient has an ongoing problem

  // ---- appointments: 6 weeks back, 1 week ahead, Mon–Sat evening clinic
  const taken = new Set(
    (await prisma.appointment.findMany({ where: { facility_id: fid, deleted_at: null }, select: { doctor_id: true, date: true, start_time: true } }))
      .map((a) => `${a.doctor_id}|${a.date}|${a.start_time}`),
  );
  const apptRows = [];
  for (let d = -42; d <= 7; d++) {
    const date = addDays(today, d);
    if (weekday(date) === 0) continue; // closed on Sundays
    for (const doc of doctors) {
      const count = d > 0 ? int(1, 4) : int(2, 6);
      for (const slot of sample(SLOTS, count).sort()) {
        const key = `${doc.id}|${date}|${slot}`;
        if (taken.has(key)) continue;
        taken.add(key);
        const patient = pick(patients);
        let status = 'booked';
        if (d < 0) {
          const r = rand();
          status = r < 0.76 ? 'completed' : r < 0.88 ? 'no_show' : 'cancelled';
        } else if (d === 0) {
          const start = parseTimeToMinutes(slot);
          if (start + 30 <= nowMin) status = chance(0.85) ? 'completed' : 'no_show';
          else if (start <= nowMin) status = 'checked_in';
          else status = chance(0.1) ? 'cancelled' : 'booked';
        } else if (chance(0.08)) status = 'cancelled';
        apptRows.push({
          facility_id: fid,
          patient_id: patient.id,
          patient_name: patient.name,
          mrn: patient.mrn,
          doctor_id: doc.id,
          doctor_name: doc.name,
          date,
          start_time: slot,
          duration_minutes: 20,
          type: chance(0.15) ? 'online' : 'in_clinic',
          status,
          reason: caseFor.get(patient.id).complaint,
          created_by: frontDesk?.id ?? null,
          created_date: at(addDays(date, -int(0, 5)), '12:00', int(0, 360)),
          updated_date: at(date, slot, 30),
        });
      }
    }
  }
  apptRows.sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
  const appointments = await prisma.appointment.createManyAndReturn({ data: apptRows });

  // ---- EMRs + invoices for completed visits
  const lastVisit = new Map(); // `${patient}|${doctor}` -> date
  const emrRows = [];
  const invoiceDrafts = [];
  for (const a of appointments.filter((x) => x.status === 'completed')) {
    const doc = doctors.find((x) => x.id === a.doctor_id);
    const c = caseFor.get(a.patient_id);
    const key = `${a.patient_id}|${a.doctor_id}`;
    const prev = lastVisit.get(key);
    const isFollowup = !!prev && addDays(prev, 45) >= a.date;
    lastVisit.set(key, a.date);
    const svc = c.services.filter((n) => services.some((s) => s.name === n));
    const proc = isFollowup && chance(0.5) ? [] : c.procedures.filter((n) => procedures.some((p) => p.name === n));
    const savedAt = at(a.date, a.start_time, int(12, 25));
    emrRows.push({
      facility_id: fid,
      appointment_id: a.id,
      patient_id: a.patient_id,
      patient_name: a.patient_name,
      mrn: a.mrn,
      doctor_id: a.doctor_id,
      doctor_name: a.doctor_name,
      visit_date: a.date,
      chief_complaint: isFollowup ? `Follow-up: ${c.complaint.toLowerCase()}` : c.complaint,
      history_chief_complaint: isFollowup ? `On treatment since ${prev}. ${pick(['Improving.', 'Partial improvement.', 'Much better, mild residual symptoms.', 'No significant change.'])}` : c.history,
      past_history: chance(0.3) ? pick(['No significant past history', 'Diabetes on metformin', 'Hypothyroid on levothyroxine', 'Asthma, uses inhaler PRN']) : 'Nil significant',
      allergies: chance(0.12) ? pick(['Penicillin', 'Sulfa drugs', 'NSAIDs']) : 'NKDA',
      labs_tests: isFollowup ? [] : c.labs.filter((l) => labNames.has(l)),
      differential_diagnosis: c.differential,
      diagnosis: c.diagnosis,
      treatment: isFollowup ? `Continue current treatment. ${c.treatment}` : c.treatment,
      prescription: c.rx.map((line, i) => `${i + 1}. ${line}`).join('\n'),
      services_offered: svc,
      procedures_performed: proc,
      advise: c.advise,
      followup_date: addDays(a.date, c.followup),
      created_by: doctorUser[a.doctor_id]?.id ?? null,
      created_date: savedAt,
      updated_date: savedAt,
    });
    const consultation = isFollowup ? Number(doc.followup_fee || 0) : Number(doc.consultation_fee || 0);
    const servicesTotal = svc.reduce((s, n) => s + priceOf(services, n), 0);
    const proceduresTotal = proc.reduce((s, n) => s + priceOf(procedures, n), 0);
    const total = consultation + servicesTotal + proceduresTotal;
    const rate = taxRateFor(a.date);
    invoiceDrafts.push({
      appt: a, savedAt, isFollowup,
      data: {
        facility_id: fid, appointment_id: a.id, patient_id: a.patient_id, patient_name: a.patient_name, mrn: a.mrn,
        doctor_id: a.doctor_id, doctor_name: a.doctor_name, visit_type: isFollowup ? 'followup' : 'consultation',
        visit_date: a.date, visit_time: a.start_time, consultation_fee: consultation,
        service_items: svc, services_total: servicesTotal, procedure_items: proc, procedures_total: proceduresTotal,
        total, tax_rate: rate, tax_amount: Math.round(consultation * rate) / 100, discount_amount: 0,
      },
    });
  }
  const emrs = await prisma.eMR.createManyAndReturn({ data: emrRows });
  const emrByAppt = new Map(emrs.map((e) => [e.appointment_id, e]));

  const invoiceRows = invoiceDrafts.map(({ appt, savedAt, data }) => {
    const isToday = appt.date === today;
    const unpaid = isToday ? chance(0.4) : chance(0.05);
    const partial = !unpaid && !isToday && chance(0.04);
    const paid = unpaid ? 0 : partial ? Math.round(data.total / 2) : data.total;
    const printed = paid === data.total && paid > 0;
    const t = new Date(savedAt.getTime() + int(5, 30) * 60000);
    return {
      ...data,
      emr_id: emrByAppt.get(appt.id)?.id ?? null,
      amount_paid: paid,
      balance: data.total - paid,
      status: paid >= data.total && paid > 0 ? 'paid' : 'unpaid',
      payment_mode: paid > 0 ? pick(['cash', 'cash', 'cash', 'online_transfer', 'debit_card', 'credit_card']) : null,
      printed,
      printed_at: printed ? t : null,
      created_by: doctorUser[appt.doctor_id]?.id ?? null,
      created_date: savedAt,
      updated_date: t,
    };
  });
  const invoices = await prisma.invoice.createManyAndReturn({ data: invoiceRows });

  // ---- a few admin corrections of printed invoices (shows "Corrected Invoice" + audit trail)
  const correctable = invoices.filter((inv) => inv.printed && inv.visit_date < addDays(today, -3));
  for (const inv of sample(correctable, Math.min(3, correctable.length))) {
    const discount = pick([500, 1000]);
    const correctedAt = new Date(inv.printed_at.getTime() + int(1, 48) * 3600000);
    const updated = await prisma.invoice.update({
      where: { id: inv.id },
      data: {
        discount_amount: discount, total: inv.total - discount, amount_paid: inv.amount_paid - discount,
        is_corrected: true, revision: 1, corrected_at: correctedAt, corrected_by: admin?.full_name ?? 'Clinic Admin',
        updated_date: correctedAt,
      },
    });
    await prisma.auditLog.create({
      data: {
        facility_id: fid, entity: 'Invoice', record_id: inv.id, action: 'correct_invoice',
        user_id: admin?.id ?? null, user_name: admin?.full_name ?? 'Clinic Admin', user_role: 'admin',
        summary: 'Invoice corrected (revision 1) — courtesy discount applied after printing',
        changes: {
          discount_amount: { from: 0, to: discount },
          total: { from: inv.total, to: updated.total },
          amount_paid: { from: inv.amount_paid, to: updated.amount_paid },
        },
        created_date: correctedAt,
      },
    });
  }

  // ---- addenda on a few older EMRs
  const older = emrs.filter((e) => e.visit_date < addDays(today, -7) && e.labs_tests.length);
  for (const e of sample(older, Math.min(6, older.length))) {
    const when = new Date(e.created_date.getTime() + int(2, 6) * 86400000);
    await prisma.eMRAddendum.create({
      data: {
        facility_id: fid, emr_id: e.id, emr_doctor_id: e.doctor_id, doctor_id: e.doctor_id, doctor_name: e.doctor_name,
        text: pick([
          `Lab results reviewed: ${e.labs_tests.join(', ')} within normal limits. Continue same treatment.`,
          `Reports received: ${e.labs_tests[0]} mildly deranged. Patient informed by phone; supplement added.`,
          'Patient called reporting mild irritation with topical; advised to reduce to alternate nights.',
        ]),
        created_by: doctorUser[e.doctor_id]?.id ?? null, created_date: when, updated_date: when,
      },
    });
  }

  // ---- website enquiries
  await prisma.contactMessage.createMany({
    data: [
      { name: 'Rabia Shah', email: 'rabia.shah@example.com', phone: '0321-5550101', subject: 'Laser hair removal packages', message: 'Assalam o Alaikum, what is the cost of a full-face laser package and how many sessions are needed?', created_date: at(addDays(today, -2), '10:15') },
      { name: 'Omar Farooq', phone: '0333-5550202', subject: 'Appointment for acne', message: 'I would like to book an appointment with Dr. Safoora this week for acne scars. Which evenings are available?', created_date: at(addDays(today, -1), '21:40') },
      { name: 'Hina Javed', email: 'hina.j@example.com', subject: 'Online consultation', message: 'Do you offer online consultations for patients outside Lahore? I live in Multan.', is_read: true, created_date: at(addDays(today, -6), '13:05') },
      { name: 'Saad Mirza', email: 'saad.m@example.com', phone: '0300-5550303', subject: 'PRP for hair', message: 'Is PRP therapy suitable for early hair thinning? Please share the price per session.', created_date: at(today, '09:20') },
    ],
  });

  const count = (s) => appointments.filter((a) => a.status === s).length;
  console.log(`✓ Sample data added to "${FACILITY_NAME}":
   patients ${patients.length}, appointments ${appointments.length} (completed ${count('completed')}, booked ${count('booked')}, checked-in ${count('checked_in')}, no-show ${count('no_show')}, cancelled ${count('cancelled')})
   EMRs ${emrs.length}, invoices ${invoices.length} (printed ${invoices.filter((i) => i.printed).length}, unpaid ${invoices.filter((i) => i.status === 'unpaid').length}), corrected 3, addenda ${Math.min(6, older.length)}, website messages 4`);
}

try {
  await main();
} catch (e) {
  console.error('Sample seed failed:', e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
