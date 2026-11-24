import React, { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

// Front desk reassigns an arrived patient to another doctor.
export default function ChangeDoctorDialog({ appointment, doctors, open, onOpenChange, onSaved }) {
  const { toast } = useToast();
  const [doctorId, setDoctorId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && appointment) setDoctorId(appointment.doctor_id || '');
  }, [open, appointment]);

  const save = async () => {
    const doctor = doctors.find((d) => d.id === doctorId);
    if (!doctor || !appointment) return;
    setSaving(true);
    try {
      const updated = await api.entities.Appointment.update(appointment.id, {
        doctor_id: doctor.id,
        doctor_name: doctor.name,
      });
      onSaved(updated);
      toast({ title: 'Doctor changed', description: `${appointment.patient_name} is now with ${doctor.name}.` });
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Could not change doctor', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Change doctor</DialogTitle>
          <DialogDescription>
            {appointment ? `${appointment.patient_name} · ${appointment.mrn || ''}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label>Assigned doctor</Label>
          <Select value={doctorId} onValueChange={setDoctorId}>
            <SelectTrigger><SelectValue placeholder="Select a doctor" /></SelectTrigger>
            <SelectContent>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !doctorId || doctorId === appointment?.doctor_id}>
            {saving ? 'Saving…' : 'Change doctor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}