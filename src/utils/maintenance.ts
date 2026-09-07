import { useState, useEffect } from 'react';
import { MaintenanceTicket, WorkOrder, WeatherStation } from '../types.ts';

export const INITIAL_TICKETS: MaintenanceTicket[] = [
  {
    ticketNumber: '100001',
    stationId: 1,
    stationName: 'Kathmandu Airport AWS',
    region: 'Bagmati Province',
    status: 'No communication',
    summary: 'Telemetry modem non-responsive & battery voltage drop',
    description: 'GSM telemetry modem stopped transmitting frames following lightning discharge. Battery voltage dropped to 10.8V during night cycle.',
    assignedTo: 'alex_field_tech',
    createdBy: 'System Monitor',
    createdAt: '2026-08-01 09:30',
    priority: 'High',
    workOrderId: 'WO-100001'
  },
  {
    ticketNumber: '100002',
    stationId: 2,
    stationName: 'Pokhara Hydromet Station',
    region: 'Gandaki Province',
    status: 'Warning',
    summary: 'Barometer drift outside WMO Class B tolerance',
    description: 'Digital barometer showing +2.4 hPa positive drift against reference traveling standard during quarterly calibration check.',
    assignedTo: 'sarah_metrology',
    createdBy: 'birajkdl',
    createdAt: '2026-08-02 14:15',
    priority: 'Medium',
    workOrderId: null
  },
  {
    ticketNumber: '100003',
    stationId: 3,
    stationName: 'Dhangadhi Met Station',
    region: 'Sudurpashchim Province',
    status: 'critical',
    summary: 'Rain gauge tipping bucket reed switch failure',
    description: 'Rain gauge tipping bucket switch fails to pulse during test dumps. Debris buildup and corroded reed contact switch.',
    assignedTo: 'carlos_mendez',
    createdBy: 'System Monitor',
    createdAt: '2026-08-04 11:00',
    priority: 'Emergency',
    workOrderId: 'WO-100001'
  },
  {
    ticketNumber: '100004',
    stationId: 4,
    stationName: 'Surkhet Regional Office AWS',
    region: 'Karnali Province',
    status: 'sensor issue',
    summary: 'Ultrasonic wind sensor transducer acoustic noise',
    description: 'Anemometer reporting intermittent 99.9 m/s wind speed spikes caused by transducer icing / acoustic noise interference.',
    assignedTo: 'john_doe_tech',
    createdBy: 'operator_surkhet',
    createdAt: '2026-08-05 16:45',
    priority: 'Medium',
    workOrderId: null
  },
  {
    ticketNumber: '100005',
    stationId: 5,
    stationName: 'Biratnagar Agromet Station',
    region: 'Koshi Province',
    status: 'firmware issue',
    summary: 'Data logger reboot loop during MQTT packet buffer dump',
    description: 'CR1000X logger reboots every 15 minutes while attempting to flush backed-up telemetry logs to central MQTT server.',
    assignedTo: 'elena_rostova',
    createdBy: 'birajkdl',
    createdAt: '2026-08-06 08:20',
    priority: 'High',
    workOrderId: null
  }
];

export const INITIAL_WORK_ORDERS: WorkOrder[] = [
  {
    workOrderId: 'WO-100001',
    workOrderTitle: 'Emergency Field Restoration & Telemetry Repair',
    ticketNumbers: ['100001', '100003'],
    assignedTeam: 'Field Maintenance Response Team Alpha',
    scheduledDate: '2026-08-10',
    priority: 'High',
    status: 'In Progress',
    scopeOfWork: '1. Replace damaged GSM modem with spare 4G LTE gateway.\n2. Swap out degraded 12V 50Ah AGM solar battery.\n3. Clean tipping bucket funnel and replace reed switch assembly.\n4. Re-verify telemetry data packet sync to central server.',
    createdBy: 'birajkdl',
    createdAt: '2026-08-04 15:00'
  }
];

export function getStoredTickets(): MaintenanceTicket[] {
  try {
    const saved = localStorage.getItem('metis_maintenance_tickets');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error(e);
  }
  return INITIAL_TICKETS;
}

export function getStoredWorkOrders(): WorkOrder[] {
  try {
    const saved = localStorage.getItem('metis_work_orders');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error(e);
  }
  return INITIAL_WORK_ORDERS;
}

export function saveTicket(
  ticketData: Omit<MaintenanceTicket, 'ticketNumber' | 'createdAt'>,
  assignedEmail?: string
): MaintenanceTicket {
  const tickets = getStoredTickets();
  let nextNum = 100006;
  try {
    const savedNum = localStorage.getItem('metis_next_ticket_num');
    if (savedNum) nextNum = parseInt(savedNum, 10);
  } catch (e) {}

  const ticketNumber = String(nextNum).padStart(6, '0');
  localStorage.setItem('metis_next_ticket_num', (nextNum + 1).toString());

  const newTicket: MaintenanceTicket = {
    ticketNumber,
    createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    workOrderId: null,
    ...ticketData
  };

  const updated = [newTicket, ...tickets];
  localStorage.setItem('metis_maintenance_tickets', JSON.stringify(updated));
  window.dispatchEvent(new Event('metis_tickets_updated'));

  // Trigger optional notification email
  const recipientEmail = assignedEmail || 'birajkdl@gmail.com';
  const linkUrl = `${window.location.origin}${window.location.pathname}?ticket=${ticketNumber}`;
  fetch('/api/notifications/send-assignment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipientEmail,
      type: 'ticket',
      id: ticketNumber,
      title: newTicket.summary,
      assignedTo: newTicket.assignedTo,
      stationName: newTicket.stationName,
      priority: newTicket.priority || 'Medium',
      linkUrl
    })
  }).catch(() => {});

  return newTicket;
}

export function useMaintenanceData() {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>(getStoredTickets);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(getStoredWorkOrders);

  useEffect(() => {
    const handleUpdate = () => {
      setTickets(getStoredTickets());
      setWorkOrders(getStoredWorkOrders());
    };

    window.addEventListener('metis_tickets_updated', handleUpdate);
    window.addEventListener('metis_work_orders_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('metis_tickets_updated', handleUpdate);
      window.removeEventListener('metis_work_orders_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  return { tickets, workOrders };
}
