import { useState, useEffect } from 'react';
import { MaintenanceTicket, WorkOrder, WeatherStation, TicketNote, SensorReplacementRequest } from '../types.ts';

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
    workOrderId: 'WO-100001',
    notes: [
      {
        id: 'note-100001-1',
        ticketNumber: '100001',
        author: 'alex_field_tech',
        authorEmail: 'alex_field_tech@met.gov.np',
        category: 'Field Inspection',
        content: 'Inspected station enclosure. Found 12V 50Ah solar battery degraded and modem power LED unlit following thunderstorms. Recommending replacement sensor and communication unit.',
        createdAt: '2026-08-01 14:10'
      },
      {
        id: 'note-100001-2',
        ticketNumber: '100001',
        author: 'birajkdl',
        authorEmail: 'birajkdl@gmail.com',
        category: 'Sensor Replacement Note',
        content: 'Requested working 4G Gateway and PT100 temperature backup sensor from central inventory for immediate field dispatch.',
        createdAt: '2026-08-01 16:30'
      }
    ],
    sensorRequests: [
      {
        id: 'req-100001-1',
        ticketNumber: '100001',
        stationId: 1,
        stationName: 'Kathmandu Airport AWS',
        faultySensorType: 'Telemetry Modem & Power Logger',
        faultReason: 'Surge protector blown, voltage dropped to 10.8V',
        requestedBy: 'alex_field_tech',
        requestedAt: '2026-08-01 14:15',
        status: 'Assigned / In Transit',
        assignedSensorSerial: 'GW-4G-9021',
        assignedSensorModel: 'Campbell CR1000X 4G Gateway',
        assignedSensorType: 'Data Logger & Modem',
        assignedSensorManufacturer: 'Campbell Scientific',
        assignedBy: 'birajkdl',
        assignedAt: '2026-08-01 16:45',
        assignmentNotes: 'Dispatched from Central Met Store with calibrated antenna kit.'
      }
    ]
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
    workOrderId: null,
    notes: [
      {
        id: 'note-100002-1',
        ticketNumber: '100002',
        author: 'sarah_metrology',
        authorEmail: 'sarah_metrology@met.gov.np',
        category: 'Diagnostic Finding',
        content: 'In-situ verification confirmed positive bias (+2.4 hPa). Checked pressure inlet filter, found minor dust accumulation. Cleaned port and performed two-point chamber calibration.',
        createdAt: '2026-08-03 10:20'
      }
    ],
    sensorRequests: [
      {
        id: 'req-100002-1',
        ticketNumber: '100002',
        stationId: 2,
        stationName: 'Pokhara Hydromet Station',
        faultySensorType: 'Digital Barometer (PTB210)',
        faultReason: 'Zero drift of +2.4 hPa exceeding tolerance',
        requestedBy: 'sarah_metrology',
        requestedAt: '2026-08-02 15:00',
        status: 'Installed & Tested',
        assignedSensorSerial: 'BARO-PTB330-4412',
        assignedSensorModel: 'Vaisala PTB330 Class A Barometer',
        assignedSensorType: 'Barometric Pressure',
        assignedSensorManufacturer: 'Vaisala',
        assignedBy: 'birajkdl',
        assignedAt: '2026-08-02 16:10',
        assignmentNotes: 'High-precision traveling spare deployed.'
      }
    ],
    isResolved: true,
    resolvedAt: '2026-08-03 12:00',
    resolvedBy: 'sarah_metrology',
    resolutionNotes: 'Replaced barometer with calibrated Vaisala PTB330 (BARO-PTB330-4412). In-situ verification showed zero error delta (+0.05 hPa). Sensor operating cleanly within WMO Class A specifications.',
    isAcknowledged: false
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
    workOrderId: 'WO-100001',
    notes: [
      {
        id: 'note-100003-1',
        ticketNumber: '100003',
        author: 'carlos_mendez',
        authorEmail: 'carlos_mendez@met.gov.np',
        category: 'Field Inspection',
        content: 'Dismantled rain gauge housing. Reed switch glass cracked and oxidized. Tipping bucket mechanism calibrated with dynamic syringe test.',
        createdAt: '2026-08-04 13:45'
      }
    ],
    sensorRequests: [
      {
        id: 'req-100003-1',
        ticketNumber: '100003',
        stationId: 3,
        stationName: 'Dhangadhi Met Station',
        faultySensorType: 'Tipping Bucket Rain Gauge',
        faultReason: 'Corroded reed switch contact, pulse dropout during monsoon',
        requestedBy: 'carlos_mendez',
        requestedAt: '2026-08-04 11:30',
        status: 'Assigned / In Transit',
        assignedSensorSerial: 'RG-TB4-7721',
        assignedSensorModel: 'Hydrological Services TB4 0.2mm Gauge',
        assignedSensorType: 'Precipitation',
        assignedSensorManufacturer: 'Hydrological Services',
        assignedBy: 'birajkdl',
        assignedAt: '2026-08-04 14:00',
        assignmentNotes: 'Brand new 0.2mm resolution tipping bucket assembly dispatched.'
      }
    ]
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
    workOrderId: null,
    notes: [
      {
        id: 'note-100004-1',
        ticketNumber: '100004',
        author: 'operator_surkhet',
        authorEmail: 'operator_surkhet@met.gov.np',
        category: 'Progress Update',
        content: 'Monitored 10-minute telemetry logs. 99.9 m/s erroneous readings occurred between 02:00 and 05:00 during heavy condensation. Heating element check advised.',
        createdAt: '2026-08-05 17:30'
      }
    ]
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
  },
  {
    ticketNumber: '100000',
    stationId: 1,
    stationName: 'Kathmandu Airport AWS',
    region: 'Bagmati Province',
    status: 'Resolved & Archived',
    summary: 'Pyranometer leveling bubble misalignment & solar irradiance recalibration',
    description: 'Solar radiation pyranometer displaced during mast tension wire tightening. Leveling spirit bubble tilted 3 degrees off-horizontal.',
    assignedTo: 'birajkdl',
    createdBy: 'birajkdl',
    createdAt: '2026-07-20 10:00',
    priority: 'Low',
    workOrderId: null,
    notes: [
      {
        id: 'note-100000-1',
        ticketNumber: '100000',
        author: 'birajkdl',
        authorEmail: 'birajkdl@gmail.com',
        category: 'Field Inspection',
        content: 'Adjusted leveling screws using optical level gauge. Solar radiation values matched reference Pyranometer CMP11 within 0.8%.',
        createdAt: '2026-07-20 11:30'
      }
    ],
    isResolved: true,
    resolvedAt: '2026-07-20 12:00',
    resolvedBy: 'birajkdl',
    resolutionNotes: 'Re-aligned spirit bubble, securely fastened mounting bracket, cleaned optical glass dome.',
    isAcknowledged: true,
    acknowledgedAt: '2026-07-20 14:00',
    acknowledgedBy: 'sarah_metrology',
    acknowledgmentNotes: 'Reviewed 24-hour clear sky solar curve. Data consistency validated and approved.',
    isArchived: true,
    archivedAt: '2026-07-21 09:00',
    archivedBy: 'birajkdl',
    archiveRemarks: 'Routine maintenance completed successfully. Filed in permanent archive.'
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
  let nextNum = 100007;
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
    notes: [],
    sensorRequests: [],
    isResolved: false,
    isAcknowledged: false,
    isArchived: false,
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

export function updateTicket(
  ticketNumber: string,
  updates: Partial<MaintenanceTicket>
): MaintenanceTicket | null {
  const tickets = getStoredTickets();
  let updatedTicket: MaintenanceTicket | null = null;

  const updated = tickets.map(t => {
    if (t.ticketNumber === ticketNumber) {
      updatedTicket = { ...t, ...updates };
      return updatedTicket;
    }
    return t;
  });

  if (updatedTicket) {
    localStorage.setItem('metis_maintenance_tickets', JSON.stringify(updated));
    window.dispatchEvent(new Event('metis_tickets_updated'));
  }

  return updatedTicket;
}

export function addTicketNote(
  ticketNumber: string,
  noteData: Omit<TicketNote, 'id' | 'createdAt' | 'ticketNumber'>
): TicketNote {
  const noteId = `note-${ticketNumber}-${Date.now()}`;
  const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 16);

  const newNote: TicketNote = {
    id: noteId,
    ticketNumber,
    createdAt,
    ...noteData
  };

  const tickets = getStoredTickets();
  const updated = tickets.map(t => {
    if (t.ticketNumber === ticketNumber) {
      const existingNotes = t.notes || [];
      return {
        ...t,
        notes: [newNote, ...existingNotes]
      };
    }
    return t;
  });

  localStorage.setItem('metis_maintenance_tickets', JSON.stringify(updated));
  window.dispatchEvent(new Event('metis_tickets_updated'));
  return newNote;
}

export function requestSensorReplacement(
  ticketNumber: string,
  reqData: Omit<SensorReplacementRequest, 'id' | 'requestedAt' | 'ticketNumber' | 'status'>
): SensorReplacementRequest {
  const reqId = `req-${ticketNumber}-${Date.now()}`;
  const requestedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);

  const newReq: SensorReplacementRequest = {
    id: reqId,
    ticketNumber,
    requestedAt,
    status: 'Requested',
    ...reqData
  };

  const tickets = getStoredTickets();
  const updated = tickets.map(t => {
    if (t.ticketNumber === ticketNumber) {
      const existingReqs = t.sensorRequests || [];
      // Also automatically log a follow-up note about this sensor replacement request!
      const autoNote: TicketNote = {
        id: `note-auto-${Date.now()}`,
        ticketNumber,
        author: reqData.requestedBy,
        category: 'Sensor Replacement Note',
        content: `Requested replacement working sensor for faulty sensor (${reqData.faultySensorType}). Reason: ${reqData.faultReason}`,
        createdAt: requestedAt
      };
      return {
        ...t,
        sensorRequests: [newReq, ...existingReqs],
        notes: [autoNote, ...(t.notes || [])]
      };
    }
    return t;
  });

  localStorage.setItem('metis_maintenance_tickets', JSON.stringify(updated));
  window.dispatchEvent(new Event('metis_tickets_updated'));
  return newReq;
}

export function assignWorkingSensor(
  ticketNumber: string,
  requestId: string,
  assignment: {
    assignedSensorId?: number | null;
    assignedSensorSerial?: string | null;
    assignedSensorModel?: string | null;
    assignedSensorType?: string | null;
    assignedSensorManufacturer?: string | null;
    assignedBy: string;
    assignmentNotes?: string | null;
  }
): boolean {
  const assignedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
  const tickets = getStoredTickets();

  let matched = false;
  const updated = tickets.map(t => {
    if (t.ticketNumber === ticketNumber) {
      const reqs = (t.sensorRequests || []).map(r => {
        if (r.id === requestId) {
          matched = true;
          return {
            ...r,
            status: 'Assigned / In Transit' as const,
            assignedSensorId: assignment.assignedSensorId || null,
            assignedSensorSerial: assignment.assignedSensorSerial || null,
            assignedSensorModel: assignment.assignedSensorModel || null,
            assignedSensorType: assignment.assignedSensorType || null,
            assignedSensorManufacturer: assignment.assignedSensorManufacturer || null,
            assignedBy: assignment.assignedBy,
            assignedAt,
            assignmentNotes: assignment.assignmentNotes || null
          };
        }
        return r;
      });

      // Also log an automatic follow-up note
      const autoNote: TicketNote = {
        id: `note-auto-assign-${Date.now()}`,
        ticketNumber,
        author: assignment.assignedBy,
        category: 'Sensor Replacement Note',
        content: `Assigned replacement working sensor: ${assignment.assignedSensorType || 'Sensor'} (Serial: ${assignment.assignedSensorSerial || 'N/A'}, Model: ${assignment.assignedSensorModel || 'N/A'}${assignment.assignmentNotes ? ` - Notes: ${assignment.assignmentNotes}` : ''}). Status: Assigned / In Transit.`,
        createdAt: assignedAt
      };

      return {
        ...t,
        sensorRequests: reqs,
        notes: [autoNote, ...(t.notes || [])]
      };
    }
    return t;
  });

  if (matched) {
    localStorage.setItem('metis_maintenance_tickets', JSON.stringify(updated));
    window.dispatchEvent(new Event('metis_tickets_updated'));
  }
  return matched;
}

export function resolveTicket(
  ticketNumber: string,
  resolution: {
    resolvedBy: string;
    resolutionNotes: string;
  }
): boolean {
  const resolvedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
  const tickets = getStoredTickets();

  let matched = false;
  const updated = tickets.map(t => {
    if (t.ticketNumber === ticketNumber) {
      matched = true;
      const autoNote: TicketNote = {
        id: `note-resolve-${Date.now()}`,
        ticketNumber,
        author: resolution.resolvedBy,
        category: 'Progress Update',
        content: `Problem marked as SOLVED: ${resolution.resolutionNotes}. (Awaiting acknowledgment before archiving).`,
        createdAt: resolvedAt
      };
      return {
        ...t,
        isResolved: true,
        resolvedAt,
        resolvedBy: resolution.resolvedBy,
        resolutionNotes: resolution.resolutionNotes,
        notes: [autoNote, ...(t.notes || [])]
      };
    }
    return t;
  });

  if (matched) {
    localStorage.setItem('metis_maintenance_tickets', JSON.stringify(updated));
    window.dispatchEvent(new Event('metis_tickets_updated'));
  }
  return matched;
}

export function acknowledgeTicket(
  ticketNumber: string,
  ack: {
    acknowledgedBy: string;
    acknowledgmentNotes: string;
  }
): boolean {
  const acknowledgedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
  const tickets = getStoredTickets();

  let matched = false;
  const updated = tickets.map(t => {
    if (t.ticketNumber === ticketNumber) {
      matched = true;
      const autoNote: TicketNote = {
        id: `note-ack-${Date.now()}`,
        ticketNumber,
        author: ack.acknowledgedBy,
        category: 'Progress Update',
        content: `Problem resolution ACKNOWLEDGED by ${ack.acknowledgedBy}: "${ack.acknowledgmentNotes}". Ticket is now eligible for archiving.`,
        createdAt: acknowledgedAt
      };
      return {
        ...t,
        isAcknowledged: true,
        acknowledgedAt,
        acknowledgedBy: ack.acknowledgedBy,
        acknowledgmentNotes: ack.acknowledgmentNotes,
        notes: [autoNote, ...(t.notes || [])]
      };
    }
    return t;
  });

  if (matched) {
    localStorage.setItem('metis_maintenance_tickets', JSON.stringify(updated));
    window.dispatchEvent(new Event('metis_tickets_updated'));
  }
  return matched;
}

export function closeAndArchiveTicket(
  ticketNumber: string,
  archiveData: {
    archivedBy: string;
    archiveRemarks?: string;
  }
): { success: boolean; error?: string } {
  const tickets = getStoredTickets();
  const ticket = tickets.find(t => t.ticketNumber === ticketNumber);

  if (!ticket) {
    return { success: false, error: `Ticket #${ticketNumber} not found.` };
  }

  if (!ticket.isAcknowledged) {
    return {
      success: false,
      error: `Cannot close and archive ticket: The problem solution has not been acknowledged yet. METIS network protocol requires that resolution is verified and acknowledged before archiving.`
    };
  }

  const archivedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
  const autoNote: TicketNote = {
    id: `note-archive-${Date.now()}`,
    ticketNumber,
    author: archiveData.archivedBy,
    category: 'General Note',
    content: `Ticket officially closed and stored in archive by ${archiveData.archivedBy}.${archiveData.archiveRemarks ? ` Remarks: ${archiveData.archiveRemarks}` : ''}`,
    createdAt: archivedAt
  };

  const updated = tickets.map(t => {
    if (t.ticketNumber === ticketNumber) {
      return {
        ...t,
        status: 'Closed & Archived',
        isArchived: true,
        archivedAt,
        archivedBy: archiveData.archivedBy,
        archiveRemarks: archiveData.archiveRemarks || null,
        notes: [autoNote, ...(t.notes || [])]
      };
    }
    return t;
  });

  localStorage.setItem('metis_maintenance_tickets', JSON.stringify(updated));
  window.dispatchEvent(new Event('metis_tickets_updated'));
  return { success: true };
}

export function restoreArchivedTicket(
  ticketNumber: string,
  restoredBy: string
): boolean {
  const restoredAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
  const tickets = getStoredTickets();

  let matched = false;
  const updated = tickets.map(t => {
    if (t.ticketNumber === ticketNumber) {
      matched = true;
      const autoNote: TicketNote = {
        id: `note-restore-${Date.now()}`,
        ticketNumber,
        author: restoredBy,
        category: 'General Note',
        content: `Ticket restored to active maintenance by ${restoredBy}.`,
        createdAt: restoredAt
      };
      return {
        ...t,
        isArchived: false,
        status: t.status === 'Closed & Archived' ? 'Warning' : t.status,
        notes: [autoNote, ...(t.notes || [])]
      };
    }
    return t;
  });

  if (matched) {
    localStorage.setItem('metis_maintenance_tickets', JSON.stringify(updated));
    window.dispatchEvent(new Event('metis_tickets_updated'));
  }
  return matched;
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

