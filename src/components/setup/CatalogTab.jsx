import React, { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { useToast } from '@/components/ui/use-toast';
import CatalogSection from '@/components/setup/CatalogSection';

export default function CatalogTab({ canEditCharges = true }) {
  const { toast } = useToast();
  const [procedures, setProcedures] = useState([]);
  const [services, setServices] = useState([]);
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [p, s, l] = await Promise.all([
          api.entities.Procedure.filter({}, { sort: 'name', limit: 500 }),
          api.entities.Service.filter({}, { sort: 'name', limit: 500 }),
          api.entities.LabTest.filter({}, { sort: 'name', limit: 500 }),
        ]);
        setProcedures(p.items);
        setServices(s.items);
        setLabs(l.items);
      } catch (e) {
        toast({ title: 'Could not load catalog', description: e?.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <CatalogSection title="Procedures" entity="Procedure" singular="Procedure" withPrice items={procedures} onChange={setProcedures} canEditCharges={canEditCharges} />
      <CatalogSection title="Lab Tests" entity="LabTest" singular="Lab test" items={labs} onChange={setLabs} />
      <CatalogSection title="Services Offered" entity="Service" singular="Service" withPrice items={services} onChange={setServices} canEditCharges={canEditCharges} />
    </div>
  );
}