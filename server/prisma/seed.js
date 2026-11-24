// Creates the first super admin (from .env). With SEED_DEMO=true (development only) it also
// creates a demo facility with sample staff logins, catalog and a few appointments for today.
// Safe to run more than once.
import { prisma } from '../src/db.js';
import { config } from '../src/config.js';
import { hashPassword, PASSWORD_RULE } from '../src/password.js';
import { clinicDate } from '../src/time.js';

const env = process.env;

async function seedSuperAdmin() {
  const existing = await prisma.user.findFirst({ where: { role: 'super_admin' } });
  if (existing) {
    console.log(`✓ Super admin already exists (${existing.username})`);
    return existing;
  }
  const username = (env.SUPER_ADMIN_USERNAME || 'superadmin').toLowerCase();
  const password = env.SUPER_ADMIN_PASSWORD;
  if (!password || !PASSWORD_RULE.test(password)) {
    throw new Error('Set SUPER_ADMIN_PASSWORD in .env (8+ chars, one uppercase, one number, one special character).');
  }
  const user = await prisma.user.create({
    data: {
      username,
      email: env.SUPER_ADMIN_EMAIL?.toLowerCase() || null,
      full_name: 'System Super Admin',
      role: 'super_admin',
      password_hash: await hashPassword(password),
      password_changed_at: new Date(),
    },
  });
  console.log(`✓ Created super admin "${username}"`);
  return user;
}

async function seedDemo() {
  const name = 'Dr Safoora Skin Chemistry';
  if (await prisma.facility.findFirst({ where: { name } })) {
    console.log('✓ Demo facility already exists');
    return;
  }
  const password = env.DEMO_PASSWORD;
  if (!password || !PASSWORD_RULE.test(password)) throw new Error('Set DEMO_PASSWORD in .env to seed demo users.');
  const hash = await hashPassword(password);

  const f = await prisma.facility.create({
    data: {
      name,
      address: 'Main Boulevard, Gulberg III, Lahore',
      contact_number: '0300-0000000',
      email: 'info@example.com',
    },
  });
  const fid = f.id;

  const drSafoora = await prisma.doctor.create({
    data: {
      facility_id: fid, title: 'Dr.', first_name: 'Safoora', last_name: 'Ahmed', name: 'Dr. Safoora Ahmed',
      specialization: 'Consultant Dermatologist', sex: 'Female', consultation_fee: 3000, followup_fee: 1500,
      color: '#1d4a44', email: 'dr.safoora@example.com',
      bio: 'Consultant dermatologist focused on medical and aesthetic skin care.',
    },
  });
  const drBilal = await prisma.doctor.create({
    data: {
      facility_id: fid, title: 'Dr.', first_name: 'Bilal', last_name: 'Khan', name: 'Dr. Bilal Khan',
      specialization: 'Dermatologist', sex: 'Male', consultation_fee: 2500, followup_fee: 1200,
      color: '#9d2f5a', email: 'dr.bilal@example.com',
    },
  });
  const frontDesk = await prisma.employee.create({
    data: {
      facility_id: fid, first_name: 'Sana', last_name: 'Iqbal', designation: 'Receptionist', role: 'reception',
      mobile: '0300-1111111', email: 'frontdesk@example.com',
      permissions: ['/patients', '/scheduling', '/import-chart', '/archived-records', '/appointments', '/reception'],
      landing_page: '/appointments',
    },
  });
  const accounts = await prisma.employee.create({
    data: {
      facility_id: fid, first_name: 'Usman', last_name: 'Ali', designation: 'Accountant', role: 'accounts',
      mobile: '0300-2222222', email: 'accounts@example.com',
    },
  });
  const admin = await prisma.employee.create({
    data: {
      facility_id: fid, first_name: 'Clinic', last_name: 'Admin', designation: 'Director', role: 'admin',
      mobile: '0300-3333333', email: 'admin@example.com',
    },
  });

  const logins = [
    { username: 'clinicadmin', full_name: 'Clinic Admin', role: 'admin', employee_id: admin.id, email: 'admin@example.com' },
    { username: 'dr.safoora', full_name: drSafoora.name, role: 'doctor', doctor_id: drSafoora.id, email: 'dr.safoora@example.com' },
    { username: 'dr.bilal', full_name: drBilal.name, role: 'doctor', doctor_id: drBilal.id, email: 'dr.bilal@example.com' },
    { username: 'frontdesk', full_name: 'Sana Iqbal', role: 'reception', employee_id: frontDesk.id, email: 'frontdesk@example.com' },
    { username: 'accounts', full_name: 'Usman Ali', role: 'accounts', employee_id: accounts.id, email: 'accounts@example.com' },
  ];
  for (const l of logins) {
    await prisma.user.create({ data: { ...l, facility_id: fid, password_hash: hash, password_changed_at: new Date() } });
  }

  const services = ['Skin Analysis', 'Chemical Peel', 'Hydrafacial', 'Laser Hair Removal', 'Acne Treatment'];
  const procedures = [['Mole Removal', 5000], ['PRP Therapy', 12000], ['Botox (per area)', 25000], ['Cryotherapy', 4000]];
  const labs = ['CBC', 'LFTs', 'Thyroid Profile', 'Vitamin D', 'Serum Ferritin', 'Fungal Scraping'];
  await prisma.service.createMany({ data: services.map((n, i) => ({ facility_id: fid, name: n, price: 2000 + i * 1000 })) });
  await prisma.procedure.createMany({ data: procedures.map(([n, p]) => ({ facility_id: fid, name: n, price: p })) });
  await prisma.labTest.createMany({ data: labs.map((n) => ({ facility_id: fid, name: n })) });
  await prisma.taxRate.create({ data: { facility_id: fid, rate: 5, effective_date: '2025-07-01', note: 'PRA sales tax on services' } });

  const today = clinicDate();
  const patients = [
    { first_name: 'Ayesha', last_name: 'Malik', mobile: '0321-4567890', sex: 'Female', age: '29' },
    { first_name: 'Hamza', last_name: 'Raza', mobile: '0333-1234567', sex: 'Male', age: '34' },
    { first_name: 'Fatima', last_name: 'Noor', mobile: '0345-7654321', sex: 'Female', age: '41' },
  ];
  let i = 0;
  for (const p of patients) {
    i += 1;
    const pt = await prisma.patient.create({
      data: { facility_id: fid, ...p, name: `${p.first_name} ${p.last_name}`, mrn: `MRN-DEMO-${String(i).padStart(4, '0')}` },
    });
    const doc = i === 3 ? drBilal : drSafoora;
    await prisma.appointment.create({
      data: {
        facility_id: fid, patient_id: pt.id, patient_name: pt.name, mrn: pt.mrn,
        doctor_id: doc.id, doctor_name: doc.name, date: today, start_time: `${String(16 + i).padStart(2, '0')}:00`,
        type: 'in_clinic', status: 'booked', reason: 'Consultation',
      },
    });
  }
  console.log(`✓ Created demo facility "${name}" with logins: ${logins.map((l) => l.username).join(', ')} (password from DEMO_PASSWORD)`);
}

try {
  await seedSuperAdmin();
  if (env.SEED_DEMO === 'true') {
    if (config.isProd) console.log('• SEED_DEMO ignored in production');
    else await seedDemo();
  }
} catch (e) {
  console.error('Seed failed:', e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
