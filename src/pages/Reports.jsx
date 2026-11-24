import React, { useEffect, useMemo, useState } from 'react';
import { Printer, Loader2, FileDown, FileSpreadsheet } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { addMonths, format, parseISO } from 'date-fns';
import { downloadReportPdf, downloadReportCsv, downloadAppointmentsCsv, downloadPraTaxCsv } from '@/lib/reportsExport';
import SummaryCard from '@/components/reports/SummaryCard';
import AppointmentReport from '@/components/reports/AppointmentReport';
import PraTaxReport from '@/components/reports/PraTaxReport';

const money = (n) => `Rs ${Number(n || 0).toLocaleString()}`;

const REPORT_TYPES = [
  { key: 'financial', label: 'Financial', description: 'Financial summary by doctor for the selected date range.' },
  { key: 'in_clinic', label: 'In-Clinic Patients', description: 'In-clinic visits in the selected range — cancelled and no-show appointments excluded.' },
  { key: 'online', label: 'Online Consultations', description: 'Online consultations in the selected range — cancelled and no-show appointments excluded.' },
  { key: 'cancelled', label: 'Cancelled Appointments', description: 'Appointments marked cancelled in the selected range.' },
  { key: 'no_show', label: 'No-Show Appointments', description: 'No-show appointments — auto-marked 30 minutes after the booked slot.' },
  { key: 'pra_tax', label: 'Monthly PRA Tax', description: 'PRA tax included in each visit’s consultation charge, with the total payable to the authority for the month.' },
];

// Appointment-based reports, with the filter each one applies on top of the date range.
const APPOINTMENT_REPORTS = {
  in_clinic: {
    filter: { type: 'in_clinic', status: { $nin: ['cancelled', 'no_show'] } },
    totalLabel: 'In-Clinic Visits',
    countLabel: 'Visits',
    detailTitle: 'In-clinic appointments',
    emptyLabel: 'No in-clinic appointments in this range.',
    showStatus: true,
  },
  online: {
    filter: { type: 'online', status: { $nin: ['cancelled', 'no_show'] } },
    totalLabel: 'Online Consults',
    countLabel: 'Consults',
    detailTitle: 'Online consultations',
    emptyLabel: 'No online consultations in this range.',
    showStatus: true,
  },
  cancelled: {
    filter: { status: 'cancelled' },
    totalLabel: 'Cancelled',
    countLabel: 'Cancelled',
    detailTitle: 'Appointments marked Cancelled',
    emptyLabel: 'No cancelled appointments in this range.',
  },
  no_show: {
    filter: { status: 'no_show' },
    totalLabel: 'Total No-Shows',
    countLabel: 'No-Show Count',
    detailTitle: 'Appointments marked No-Show',
    emptyLabel: 'No no-shows in this range.',
  },
};

const emptyTotals = () => ({
  count: 0, sum_total: 0, sum_tax_amount: 0, sum_amount_paid: 0, sum_balance: 0,
  sum_consultation_fee: 0, sum_services_total: 0, sum_procedures_total: 0,
});

export default function Reports() {
  const { toast } = useToast();
  const [reportType, setReportType] = useState('financial');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState('all');
  const [rows, setRows] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState({});
  const [praInvoices, setPraInvoices] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { items } = await api.entities.Doctor.filter({}, { sort: 'name', limit: 200, fields: ['name'] });
        setDoctors(items);
      } catch (e) {
        /* non-critical */
      }
    })();
  }, []);

  const range = useMemo(() => {
    const s = parseISO(startDate);
    const e = parseISO(endDate);
    return {
      startISO: format(s, 'yyyy-MM-dd'),
      endISO: format(e, 'yyyy-MM-dd'),
      label: startDate === endDate
        ? format(s, 'dd MMM yyyy')
        : `${format(s, 'dd MMM yyyy')} – ${format(e, 'dd MMM yyyy')}`,
    };
  }, [startDate, endDate]);

  // A single report may cover at most one month.
  const maxEndDate = format(addMonths(parseISO(startDate), 1), 'yyyy-MM-dd');

  const handleStartChange = (value) => {
    if (!value) return;
    setStartDate(value);
    const capped = format(addMonths(parseISO(value), 1), 'yyyy-MM-dd');
    if (endDate < value) setEndDate(value);
    else if (endDate > capped) {
      setEndDate(capped);
      toast({ title: 'Range capped at one month' });
    }
  };

  const handleEndChange = (value) => {
    if (!value) return;
    if (value < startDate) {
      setStartDate(value);
      setEndDate(value);
      return;
    }
    if (value > maxEndDate) {
      setEndDate(maxEndDate);
      toast({
        title: 'Range capped at one month',
        description: `Latest end date is ${format(parseISO(maxEndDate), 'dd MMM yyyy')}.`,
      });
      return;
    }
    setEndDate(value);
  };

  const loadFinancial = async () => {
    const query = {
      visit_date: { $gte: range.startISO, $lte: range.endISO },
    };
    if (doctorId !== 'all') query.doctor_id = doctorId;
    const res = await api.entities.Invoice.aggregate({
      query,
      groupBy: 'doctor_name',
      sum: ['total', 'tax_amount', 'amount_paid', 'balance', 'consultation_fee', 'services_total', 'procedures_total'],
      sort: '-sum_total',
    });
    setRows(res.rows || []);
  };

  const activeType = REPORT_TYPES.find((t) => t.key === reportType);
  // In-clinic, online, cancelled and no-show reports all read the appointment list.
  const apptConfig = APPOINTMENT_REPORTS[reportType];

  const loadAppointments = async () => {
    const query = {
      date: { $gte: range.startISO, $lte: range.endISO },
      ...apptConfig.filter,
    };
    if (doctorId !== 'all') query.doctor_id = doctorId;
    const res = await api.entities.Appointment.filter(query, { sort: '-date', limit: 1000 });
    const items = res.items || [];
    setAppointments(items);
    // amounts invoiced against these visits
    const ids = items.map((a) => a.id);
    if (ids.length) {
      const invRes = await api.entities.Invoice.filter({ appointment_id: { $in: ids } }, { limit: 1000 });
      setInvoices(Object.fromEntries((invRes.items || []).map((inv) => [inv.appointment_id, inv])));
    } else {
      setInvoices({});
    }
  };

  // Every invoice in the range, one row per visit, for the PRA tax return.
  const loadPraTax = async () => {
    const query = {
      visit_date: { $gte: range.startISO, $lte: range.endISO },
    };
    if (doctorId !== 'all') query.doctor_id = doctorId;
    const res = await api.entities.Invoice.filter(query, { sort: 'visit_date', limit: 1000 });
    setPraInvoices(res.items || []);
  };

  const load = async () => {
    setLoading(true);
    try {
      if (apptConfig) await loadAppointments();
      else if (reportType === 'pra_tax') await loadPraTax();
      else await loadFinancial();
    } catch (e) {
      toast({ title: 'Could not load report', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [reportType, startDate, endDate, doctorId]);

  const grand = rows.reduce((acc, r) => {
    Object.keys(acc).forEach((k) => { acc[k] += Number(r[k] || 0); });
    return acc;
  }, emptyTotals());

  const exportMeta = () => {
    const slug = startDate === endDate ? startDate : `${startDate}_${endDate}`;
    const doctor = doctorId !== 'all' ? (doctors.find((d) => d.id === doctorId)?.name || '') : '';
    return { title: range.label, doctor, slug };
  };

  const doctorLabel = doctorId === 'all' ? 'All doctors' : (doctors.find((d) => d.id === doctorId)?.name || '');

  // The PRA return is filed per month, so that report opens on the current month.
  const handleReportType = (value) => {
    setReportType(value);
    if (value === 'pra_tax') {
      const now = new Date();
      setStartDate(format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd'));
      setEndDate(format(now, 'yyyy-MM-dd'));
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:px-10 print:max-w-none print:px-4">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="font-display text-2xl font-semibold">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">{activeType.description}</p>
        </div>
        <div className="flex gap-2">
          {apptConfig ? (
            <Button variant="outline" onClick={() => downloadAppointmentsCsv(exportMeta(), appointments, invoices)} className="gap-2" disabled={loading || appointments.length === 0}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
          ) : reportType === 'pra_tax' ? (
            <Button variant="outline" onClick={() => downloadPraTaxCsv(exportMeta(), praInvoices)} className="gap-2" disabled={loading || praInvoices.length === 0}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => downloadReportPdf(exportMeta(), rows, grand)} className="gap-2" disabled={loading || rows.length === 0}><FileDown className="h-4 w-4" /> PDF</Button>
              <Button variant="outline" onClick={() => downloadReportCsv(exportMeta(), rows, grand)} className="gap-2" disabled={loading || rows.length === 0}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
            </>
          )}
          <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Print</Button>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-2xl border border-border bg-card p-4 print:hidden">
        <div className="space-y-1.5">
          <Label>Report</Label>
          <Select value={reportType} onValueChange={handleReportType}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {REPORT_TYPES.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Start date</Label>
          <Input type="date" value={startDate} onChange={(e) => handleStartChange(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label>End date</Label>
          <Input type="date" value={endDate} min={startDate} max={maxEndDate} onChange={(e) => handleEndChange(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label>Doctor</Label>
          <Select value={doctorId} onValueChange={setDoctorId}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All doctors</SelectItem>
              {doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">Up to one month per report.</p>
      </div>

      {/* Report header (print) */}
      <div className="mb-4 hidden print:block">
        <h1 className="font-display text-xl font-semibold">Dr Safoora Skin Chemistry</h1>
        <p className="text-sm">
          {activeType.label} — {range.label} — {doctorLabel}
        </p>
      </div>

      <p className="mb-3 text-sm font-medium text-muted-foreground">
        {range.label} · {doctorLabel}
      </p>

      {apptConfig ? (
        <AppointmentReport loading={loading} appointments={appointments} invoices={invoices} config={apptConfig} />
      ) : reportType === 'pra_tax' ? (
        <PraTaxReport loading={loading} invoices={praInvoices} />
      ) : (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard label="Total Invoiced" value={money(grand.sum_total)} tone="primary" />
            <SummaryCard label="PRA Tax (incl.)" value={money(grand.sum_tax_amount)} tone="amber" />
            <SummaryCard label="Collected" value={money(grand.sum_amount_paid)} tone="emerald" />
            <SummaryCard label="Outstanding" value={money(grand.sum_balance)} tone="rose" />
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {loading ? (
              <div className="flex items-center justify-center p-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading report…
              </div>
            ) : rows.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No invoices found for this period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Doctor</th>
                      <th className="px-4 py-3 text-right">Visits</th>
                      <th className="px-4 py-3 text-right">Consultation</th>
                      <th className="px-4 py-3 text-right">Services</th>
                      <th className="px-4 py-3 text-right">Procedures</th>
                      <th className="px-4 py-3 text-right">Invoiced</th>
                      <th className="px-4 py-3 text-right">PRA Tax (incl.)</th>
                      <th className="px-4 py-3 text-right">Payable</th>
                      <th className="px-4 py-3 text-right">Collected</th>
                      <th className="px-4 py-3 text-right">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.doctor_name || '—'} className="border-t border-border">
                        <td className="px-4 py-3 font-medium">{r.doctor_name || '—'}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{r.count || 0}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{money(r.sum_consultation_fee)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{money(r.sum_services_total)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{money(r.sum_procedures_total)}</td>
                        <td className="px-4 py-3 text-right">{money(r.sum_total)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{money(r.sum_tax_amount)}</td>
                        <td className="px-4 py-3 text-right font-medium">{money(r.sum_total)}</td>
                        <td className="px-4 py-3 text-right text-emerald-700">{money(r.sum_amount_paid)}</td>
                        <td className="px-4 py-3 text-right text-amber-700">{money(r.sum_balance)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                      <td className="px-4 py-3">Grand Total</td>
                      <td className="px-4 py-3 text-right">{grand.count}</td>
                      <td className="px-4 py-3 text-right">{money(grand.sum_consultation_fee)}</td>
                      <td className="px-4 py-3 text-right">{money(grand.sum_services_total)}</td>
                      <td className="px-4 py-3 text-right">{money(grand.sum_procedures_total)}</td>
                      <td className="px-4 py-3 text-right">{money(grand.sum_total)}</td>
                      <td className="px-4 py-3 text-right">{money(grand.sum_tax_amount)}</td>
                      <td className="px-4 py-3 text-right">{money(grand.sum_total)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{money(grand.sum_amount_paid)}</td>
                      <td className="px-4 py-3 text-right text-amber-700">{money(grand.sum_balance)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}