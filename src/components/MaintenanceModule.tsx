import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Plus, 
  Ticket, 
  ClipboardList, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  User, 
  Building2, 
  Filter, 
  Search, 
  Calendar, 
  ChevronRight, 
  Trash2, 
  Edit3, 
  Eye, 
  X, 
  Check, 
  FileText, 
  Send,
  AlertCircle,
  ShieldAlert,
  ArrowRight,
  Hash,
  Users,
  Mail,
  Copy,
  ExternalLink,
  Archive,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { WeatherStation, MaintenanceTicket, WorkOrder, Sensor, TicketNote, SensorReplacementRequest } from '../types.ts';
import TicketDetailModal from './maintenance/TicketDetailModal.tsx';
import ArchivedTicketsView from './maintenance/ArchivedTicketsView.tsx';
import { subscribeToMaintenanceTickets, saveMaintenanceTicketToFirestore } from '../lib/firestore-service.ts';
import { Cloud, CloudCheck, Database } from 'lucide-react';

interface MaintenanceModuleProps {
  stations: WeatherStation[];
  sensors?: Sensor[];
  currentUser?: any;
  initialTab?: 'tickets' | 'work-orders' | 'archive';
  selectedTicketNumber?: string | null;
  selectedWorkOrderId?: string | null;
  selectedStationId?: number | null;
  autoOpenCreateTicket?: boolean;
}

const DEFAULT_USERNAMES = [
  'birajkdl',
  'john_doe_tech',
  'sarah_metrology',
  'alex_field_tech',
  'carlos_mendez',
  'elena_rostova',
  'operator_dhangadhi',
  'operator_pokhara',
  'operator_surkhet'
];

const INITIAL_TICKETS: MaintenanceTicket[] = [
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

const INITIAL_WORK_ORDERS: WorkOrder[] = [
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

export default function MaintenanceModule({ 
  stations, 
  sensors = [],
  currentUser,
  initialTab,
  selectedTicketNumber,
  selectedWorkOrderId,
  selectedStationId,
  autoOpenCreateTicket
}: MaintenanceModuleProps) {
  const [activeTab, setActiveTab] = useState<'tickets' | 'work-orders' | 'archive'>(initialTab || 'tickets');
  const [ticketCreationBanner, setTicketCreationBanner] = useState<string | null>(null);
  
  // Storage backed state
  const [tickets, setTickets] = useState<MaintenanceTicket[]>(() => {
    try {
      const saved = localStorage.getItem('metis_maintenance_tickets');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_TICKETS;
  });

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(() => {
    try {
      const saved = localStorage.getItem('metis_work_orders');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_WORK_ORDERS;
  });

  // Track next 6-digit ticket counter
  const [nextTicketNum, setNextTicketNum] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('metis_next_ticket_num');
      if (saved) return parseInt(saved, 10);
    } catch (e) {
      console.error(e);
    }
    return 100006;
  });

  const [firestoreSynced, setFirestoreSynced] = useState<boolean>(false);

  // Real-time Firestore synchronizer for maintenance tickets
  useEffect(() => {
    let isMounted = true;
    const unsubscribe = subscribeToMaintenanceTickets((cloudTickets) => {
      if (!isMounted) return;
      if (cloudTickets && cloudTickets.length > 0) {
        setTickets(cloudTickets);
        setFirestoreSynced(true);
      } else {
        // Seed initial tickets to Firestore if cloud collection is fresh
        INITIAL_TICKETS.forEach(t => {
          saveMaintenanceTicketToFirestore(t, currentUser?.uid).catch(() => {});
        });
        setFirestoreSynced(true);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [currentUser]);

  // Save changes
  useEffect(() => {
    localStorage.setItem('metis_maintenance_tickets', JSON.stringify(tickets));
    window.dispatchEvent(new Event('metis_tickets_updated'));
  }, [tickets]);

  useEffect(() => {
    localStorage.setItem('metis_work_orders', JSON.stringify(workOrders));
    window.dispatchEvent(new Event('metis_work_orders_updated'));
  }, [workOrders]);

  useEffect(() => {
    localStorage.setItem('metis_next_ticket_num', nextTicketNum.toString());
  }, [nextTicketNum]);

  // Split Active vs Archived Tickets
  const activeTickets = tickets.filter(t => !t.isArchived);
  const archivedTickets = tickets.filter(t => t.isArchived);

  // Synchronize selected ticket detail if ticket gets modified
  useEffect(() => {
    if (selectedTicketDetail) {
      const fresh = tickets.find(t => t.ticketNumber === selectedTicketDetail.ticketNumber);
      if (fresh) {
        setSelectedTicketDetail(fresh);
      }
    }
  }, [tickets]);

  // Combined available usernames list
  const availableUsernames = React.useMemo(() => {
    const list = [...DEFAULT_USERNAMES];
    if (currentUser?.email) {
      const u = currentUser.username || currentUser.displayName || currentUser.email.split('@')[0];
      if (u && !list.includes(u)) {
        list.unshift(u);
      }
    }
    return list;
  }, [currentUser]);

  // Filters & Searches
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('All');
  const [ticketStationFilter, setTicketStationFilter] = useState<string>('All');
  const [ticketAssigneeFilter, setTicketAssigneeFilter] = useState<string>('All');

  const [workOrderSearch, setWorkOrderSearch] = useState('');
  const [workOrderStatusFilter, setWorkOrderStatusFilter] = useState<string>('All');

  // Modal States
  const [isAddTicketModalOpen, setIsAddTicketModalOpen] = useState(false);
  const [isCreateWorkOrderModalOpen, setIsCreateWorkOrderModalOpen] = useState(false);
  const [selectedTicketDetail, setSelectedTicketDetail] = useState<MaintenanceTicket | null>(null);
  const [selectedWorkOrderDetail, setSelectedWorkOrderDetail] = useState<WorkOrder | null>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
    if (selectedStationId) {
      setTicketStationFilter(selectedStationId.toString());
      setNewTicketStationId(selectedStationId);
    }
    if (autoOpenCreateTicket) {
      setIsAddTicketModalOpen(true);
    }
    if (selectedTicketNumber) {
      const match = tickets.find(t => t.ticketNumber === selectedTicketNumber || t.ticketNumber === selectedTicketNumber.replace('MNT-', ''));
      if (match) {
        setSelectedTicketDetail(match);
        setActiveTab('tickets');
      }
    }
    if (selectedWorkOrderId) {
      const match = workOrders.find(w => w.workOrderId === selectedWorkOrderId);
      if (match) {
        setSelectedWorkOrderDetail(match);
        setActiveTab('work-orders');
      }
    }
  }, [initialTab, selectedTicketNumber, selectedWorkOrderId, selectedStationId, autoOpenCreateTicket, tickets, workOrders]);

  // New Ticket Form
  const [newTicketStationId, setNewTicketStationId] = useState<number | ''>('');
  const [newTicketStatus, setNewTicketStatus] = useState<string>('No communication');
  const [newTicketSummary, setNewTicketSummary] = useState('');
  const [newTicketDescription, setNewTicketDescription] = useState('');
  const [newTicketAssignedTo, setNewTicketAssignedTo] = useState<string>(availableUsernames[0] || 'birajkdl');
  const [newTicketPriority, setNewTicketPriority] = useState<'Low' | 'Medium' | 'High' | 'Emergency'>('Medium');

  // New Work Order Form
  const [newWoTitle, setNewWoTitle] = useState('');
  const [newWoAssignedTeam, setNewWoAssignedTeam] = useState('Field Maintenance Response Team Alpha');
  const [newWoPriority, setNewWoPriority] = useState<'Low' | 'Medium' | 'High' | 'Emergency'>('Medium');
  const [newWoScheduledDate, setNewWoScheduledDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [newWoSelectedTicketNums, setNewWoSelectedTicketNums] = useState<string[]>([]);
  const [newWoScopeOfWork, setNewWoScopeOfWork] = useState('');

  // Email Notification & Link Dispatch States
  const [newTicketAssignedEmail, setNewTicketAssignedEmail] = useState('birajkdl@gmail.com');
  const [newWoAssignedEmail, setNewWoAssignedEmail] = useState('field_ops@met.gov.np');
  const [dispatchToast, setDispatchToast] = useState<{
    recipientEmail: string;
    itemType: 'ticket' | 'work-order';
    itemId: string;
    title: string;
    linkUrl: string;
  } | null>(null);

  const handleSendAssignmentEmail = async (
    recipientEmail: string,
    type: 'ticket' | 'work-order',
    id: string,
    title: string,
    assignedTo: string,
    stationName: string,
    priority: string
  ) => {
    const targetEmail = recipientEmail.trim() || currentUser?.email || 'birajkdl@gmail.com';
    const linkUrl = `${window.location.origin}${window.location.pathname}?${type === 'ticket' ? 'ticket' : 'workOrder'}=${id}`;
    
    try {
      await fetch('/api/notifications/send-assignment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipientEmail: targetEmail,
          type,
          id,
          title,
          assignedTo,
          stationName,
          priority,
          linkUrl
        })
      });
    } catch (e) {
      console.error("Assignment email send failed:", e);
    }

    setDispatchToast({
      recipientEmail: targetEmail,
      itemType: type,
      itemId: id,
      title,
      linkUrl
    });
  };

  // Form submit handler for creating a ticket
  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketStationId || !newTicketSummary.trim() || !newTicketDescription.trim() || !newTicketAssignedTo) {
      alert('Please fill out all required fields (Station, Status, Summary, Description, and Assigned To).');
      return;
    }

    const st = stations.find(s => s.stationId === Number(newTicketStationId));
    const stationName = st ? st.stationName : `Station #${newTicketStationId}`;
    const region = st ? st.region : 'Regional Network';

    // Format 6-digit ticket number in increasing order
    const ticketNumberStr = String(nextTicketNum).padStart(6, '0');

    const createdBy = currentUser?.displayName || currentUser?.email || 'System User';
    const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const newTicket: MaintenanceTicket = {
      ticketNumber: ticketNumberStr,
      stationId: Number(newTicketStationId),
      stationName,
      region,
      status: newTicketStatus,
      summary: newTicketSummary.trim(),
      description: newTicketDescription.trim(),
      assignedTo: newTicketAssignedTo,
      createdBy,
      createdAt,
      priority: newTicketPriority,
      workOrderId: null,
      notes: [],
      sensorRequests: [],
      isResolved: false,
      isAcknowledged: false,
      isArchived: false
    };

    setTickets(prev => [newTicket, ...prev]);
    setNextTicketNum(prev => prev + 1);

    // Persist new ticket to Firestore
    saveMaintenanceTicketToFirestore(newTicket, currentUser?.uid).catch(err => {
      console.warn("Firestore ticket creation notice:", err);
    });

    // Auto-dispatch assignment email with direct link
    handleSendAssignmentEmail(
      newTicketAssignedEmail,
      'ticket',
      ticketNumberStr,
      newTicketSummary.trim(),
      newTicketAssignedTo,
      stationName,
      newTicketPriority
    );

    // Reset Form
    setNewTicketStationId('');
    setNewTicketSummary('');
    setNewTicketDescription('');
    setNewTicketStatus('No communication');
    setIsAddTicketModalOpen(false);

    // Immediately open Ticket Workspace for follow-up notes and sensor replacement
    setSelectedTicketDetail(newTicket);
    setTicketCreationBanner(`Ticket #${ticketNumberStr} created and saved! You can now immediately log follow-up notes or request/assign a working replacement sensor below.`);
  };

  // Follow-up note logging handler
  const handleAddTicketNote = (ticketNumber: string, content: string, category: TicketNote['category']) => {
    const author = currentUser?.displayName || currentUser?.username || currentUser?.email?.split('@')[0] || 'birajkdl';
    const authorEmail = currentUser?.email || 'birajkdl@gmail.com';
    const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const newNote: TicketNote = {
      id: `note-${ticketNumber}-${Date.now()}`,
      ticketNumber,
      author,
      authorEmail,
      category,
      content,
      createdAt
    };

    setTickets(prev => prev.map(t => {
      if (t.ticketNumber === ticketNumber) {
        const updated = {
          ...t,
          notes: [newNote, ...(t.notes || [])]
        };
        saveMaintenanceTicketToFirestore(updated, currentUser?.uid).catch(err => {
          console.warn("Firestore note update notice:", err);
        });
        return updated;
      }
      return t;
    }));
  };

  // Sensor replacement request & immediate assignment handler
  const handleRequestSensorReplacement = (
    ticketNumber: string,
    reqData: Omit<SensorReplacementRequest, 'id' | 'requestedAt' | 'ticketNumber' | 'status'>,
    assignImmediately?: boolean,
    assignedData?: {
      sensorId?: number;
      serial?: string;
      model?: string;
      type?: string;
      manufacturer?: string;
      notes?: string;
    }
  ) => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const author = currentUser?.displayName || currentUser?.username || currentUser?.email?.split('@')[0] || 'birajkdl';
    const reqId = `req-${ticketNumber}-${Date.now()}`;

    const newReq: SensorReplacementRequest = {
      id: reqId,
      ticketNumber,
      stationId: reqData.stationId,
      stationName: reqData.stationName,
      faultySensorId: reqData.faultySensorId || null,
      faultySensorType: reqData.faultySensorType,
      faultySensorSerial: reqData.faultySensorSerial || null,
      faultySensorModel: reqData.faultySensorModel || null,
      faultReason: reqData.faultReason,
      requestedBy: reqData.requestedBy,
      requestedAt: now,
      status: assignImmediately && assignedData ? 'Assigned / In Transit' : 'Requested',
      assignedSensorId: assignedData?.sensorId || null,
      assignedSensorSerial: assignedData?.serial || null,
      assignedSensorModel: assignedData?.model || null,
      assignedSensorType: assignedData?.type || reqData.faultySensorType,
      assignedSensorManufacturer: assignedData?.manufacturer || null,
      assignedBy: assignImmediately && assignedData ? author : null,
      assignedAt: assignImmediately && assignedData ? now : null,
      assignmentNotes: assignedData?.notes || null
    };

    const autoNoteContent = assignImmediately && assignedData
      ? `Requested replacement for faulty ${reqData.faultySensorType} (${reqData.faultReason}). Immediately assigned working unit SN: ${assignedData.serial} (${assignedData.model || assignedData.type}).`
      : `Requested replacement for faulty ${reqData.faultySensorType}. Reason: ${reqData.faultReason}.`;

    const autoNote: TicketNote = {
      id: `note-req-${Date.now()}`,
      ticketNumber,
      author,
      category: 'Sensor Replacement Note',
      content: autoNoteContent,
      createdAt: now
    };

    setTickets(prev => prev.map(t => {
      if (t.ticketNumber === ticketNumber) {
        const updated = {
          ...t,
          status: t.status === 'No communication' ? t.status : 'sensor issue',
          sensorRequests: [newReq, ...(t.sensorRequests || [])],
          notes: [autoNote, ...(t.notes || [])]
        };
        saveMaintenanceTicketToFirestore(updated, currentUser?.uid).catch(err => console.warn("Firestore sensor req sync note:", err));
        return updated;
      }
      return t;
    }));
  };

  // Assign working sensor to existing request
  const handleAssignWorkingSensor = (
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
  ) => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const autoNote: TicketNote = {
      id: `note-asn-${Date.now()}`,
      ticketNumber,
      author: assignment.assignedBy,
      category: 'Sensor Replacement Note',
      content: `Assigned working sensor SN: ${assignment.assignedSensorSerial} (${assignment.assignedSensorModel || assignment.assignedSensorType}) to replace faulty equipment.${assignment.assignmentNotes ? ` Remarks: ${assignment.assignmentNotes}` : ''}`,
      createdAt: now
    };

    setTickets(prev => prev.map(t => {
      if (t.ticketNumber === ticketNumber) {
        const updatedRequests = (t.sensorRequests || []).map(r => {
          if (r.id === requestId) {
            return {
              ...r,
              status: 'Assigned / In Transit' as const,
              assignedSensorId: assignment.assignedSensorId || null,
              assignedSensorSerial: assignment.assignedSensorSerial || null,
              assignedSensorModel: assignment.assignedSensorModel || null,
              assignedSensorType: assignment.assignedSensorType || r.faultySensorType,
              assignedSensorManufacturer: assignment.assignedSensorManufacturer || null,
              assignedBy: assignment.assignedBy,
              assignedAt: now,
              assignmentNotes: assignment.assignmentNotes || null
            };
          }
          return r;
        });

        const updated = {
          ...t,
          sensorRequests: updatedRequests,
          notes: [autoNote, ...(t.notes || [])]
        };
        saveMaintenanceTicketToFirestore(updated, currentUser?.uid).catch(err => console.warn("Firestore sensor assign sync note:", err));
        return updated;
      }
      return t;
    }));
  };

  // Problem solved / resolution handler
  const handleResolveTicket = (ticketNumber: string, resolutionNotes: string) => {
    const author = currentUser?.displayName || currentUser?.username || currentUser?.email?.split('@')[0] || 'birajkdl';
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const autoNote: TicketNote = {
      id: `note-res-${Date.now()}`,
      ticketNumber,
      author,
      category: 'Progress Update',
      content: `Problem marked as solved by ${author}. Resolution: "${resolutionNotes}". Awaiting verification & acknowledgment.`,
      createdAt: now
    };

    setTickets(prev => prev.map(t => {
      if (t.ticketNumber === ticketNumber) {
        const updated = {
          ...t,
          status: 'Problem Solved (Awaiting Ack)',
          isResolved: true,
          resolvedAt: now,
          resolvedBy: author,
          resolutionNotes,
          notes: [autoNote, ...(t.notes || [])]
        };
        saveMaintenanceTicketToFirestore(updated, currentUser?.uid).catch(err => console.warn("Firestore resolve sync note:", err));
        return updated;
      }
      return t;
    }));
  };

  // Acknowledgment handler
  const handleAcknowledgeTicket = (ticketNumber: string, acknowledgmentNotes: string) => {
    const author = currentUser?.displayName || currentUser?.username || currentUser?.email?.split('@')[0] || 'birajkdl';
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const autoNote: TicketNote = {
      id: `note-ack-${Date.now()}`,
      ticketNumber,
      author,
      category: 'Progress Update',
      content: `Problem resolution ACKNOWLEDGED by ${author}: "${acknowledgmentNotes}". Ticket is verified and eligible to be closed & stored in archive.`,
      createdAt: now
    };

    setTickets(prev => prev.map(t => {
      if (t.ticketNumber === ticketNumber) {
        const updated = {
          ...t,
          isAcknowledged: true,
          acknowledgedAt: now,
          acknowledgedBy: author,
          acknowledgmentNotes,
          notes: [autoNote, ...(t.notes || [])]
        };
        saveMaintenanceTicketToFirestore(updated, currentUser?.uid).catch(err => console.warn("Firestore ack sync note:", err));
        return updated;
      }
      return t;
    }));
  };

  // Close and archive ticket (strictly validates isAcknowledged!)
  const handleCloseAndArchive = (ticketNumber: string, remarks?: string) => {
    const author = currentUser?.displayName || currentUser?.username || currentUser?.email?.split('@')[0] || 'birajkdl';
    const target = tickets.find(t => t.ticketNumber === ticketNumber);
    if (!target) return;

    if (!target.isAcknowledged) {
      alert('Action Denied: Resolution must be acknowledged by anyone before this ticket can be closed and archived.');
      return;
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const autoNote: TicketNote = {
      id: `note-arc-${Date.now()}`,
      ticketNumber,
      author,
      category: 'General Note',
      content: `Ticket officially closed and stored in permanent archive by ${author}.${remarks ? ` Remarks: ${remarks}` : ''}`,
      createdAt: now
    };

    setTickets(prev => prev.map(t => {
      if (t.ticketNumber === ticketNumber) {
        const updated = {
          ...t,
          status: 'Closed & Archived',
          isArchived: true,
          archivedAt: now,
          archivedBy: author,
          archiveRemarks: remarks || null,
          notes: [autoNote, ...(t.notes || [])]
        };
        saveMaintenanceTicketToFirestore(updated, currentUser?.uid).catch(err => console.warn("Firestore archive sync note:", err));
        return updated;
      }
      return t;
    }));

    setSelectedTicketDetail(null);
  };

  // Restore ticket from archive back to active
  const handleRestoreTicket = (ticketNumber: string) => {
    const author = currentUser?.displayName || currentUser?.username || currentUser?.email?.split('@')[0] || 'birajkdl';
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const autoNote: TicketNote = {
      id: `note-rst-${Date.now()}`,
      ticketNumber,
      author,
      category: 'General Note',
      content: `Ticket restored from archive to active queue by ${author}.`,
      createdAt: now
    };

    setTickets(prev => prev.map(t => {
      if (t.ticketNumber === ticketNumber) {
        return {
          ...t,
          status: 'Warning',
          isArchived: false,
          notes: [autoNote, ...(t.notes || [])]
        };
      }
      return t;
    }));
  };

  // Form submit handler for creating a Work Order
  const handleCreateWorkOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWoTitle.trim() || !newWoAssignedTeam.trim() || newWoSelectedTicketNums.length === 0) {
      alert('Please provide a Work Order Title, Assignee Team, and select at least 1 ticket to assign.');
      return;
    }

    const woId = `WO-${Math.floor(100000 + Math.random() * 900000)}`;
    const createdBy = currentUser?.displayName || currentUser?.email || 'birajkdl';
    const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const newWo: WorkOrder = {
      workOrderId: woId,
      workOrderTitle: newWoTitle.trim(),
      ticketNumbers: newWoSelectedTicketNums,
      assignedTeam: newWoAssignedTeam.trim(),
      scheduledDate: newWoScheduledDate,
      priority: newWoPriority,
      status: 'Assigned',
      scopeOfWork: newWoScopeOfWork.trim(),
      createdBy,
      createdAt
    };

    // Update tickets to link to this Work Order
    setTickets(prev => prev.map(t => {
      if (newWoSelectedTicketNums.includes(t.ticketNumber)) {
        return { ...t, workOrderId: woId };
      }
      return t;
    }));

    setWorkOrders(prev => [newWo, ...prev]);

    // Auto-dispatch assignment email with direct link
    handleSendAssignmentEmail(
      newWoAssignedEmail,
      'work-order',
      woId,
      newWoTitle.trim(),
      newWoAssignedTeam.trim(),
      'Field Network',
      newWoPriority
    );

    // Reset Form
    setNewWoTitle('');
    setNewWoScopeOfWork('');
    setNewWoSelectedTicketNums([]);
    setIsCreateWorkOrderModalOpen(false);
  };

  // Quick ticket deletion
  const handleDeleteTicket = (ticketNum: string) => {
    if (confirm(`Are you sure you want to delete Ticket #${ticketNum}?`)) {
      setTickets(prev => prev.filter(t => t.ticketNumber !== ticketNum));
      // Unlink from work orders if any
      setWorkOrders(prev => prev.map(wo => ({
        ...wo,
        ticketNumbers: wo.ticketNumbers.filter(tn => tn !== ticketNum)
      })));
    }
  };

  // Update Work Order Status
  const handleUpdateWoStatus = (woId: string, newStatus: WorkOrder['status']) => {
    setWorkOrders(prev => prev.map(wo => {
      if (wo.workOrderId === woId) {
        return { 
          ...wo, 
          status: newStatus,
          completedAt: newStatus === 'Completed' ? new Date().toISOString().replace('T', ' ').substring(0, 16) : wo.completedAt
        };
      }
      return wo;
    }));
  };

  // Filtered Tickets (Active unarchived queue)
  const filteredTickets = activeTickets.filter(t => {
    const matchesSearch = 
      t.ticketNumber.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.stationName.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.summary.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.description.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.assignedTo.toLowerCase().includes(ticketSearch.toLowerCase());

    const matchesStatus = ticketStatusFilter === 'All' || t.status.toLowerCase() === ticketStatusFilter.toLowerCase();
    const matchesStation = ticketStationFilter === 'All' || t.stationId.toString() === ticketStationFilter;
    const matchesAssignee = ticketAssigneeFilter === 'All' || t.assignedTo === ticketAssigneeFilter;

    return matchesSearch && matchesStatus && matchesStation && matchesAssignee;
  });

  // Filtered Work Orders
  const filteredWorkOrders = workOrders.filter(wo => {
    const matchesSearch = 
      wo.workOrderId.toLowerCase().includes(workOrderSearch.toLowerCase()) ||
      wo.workOrderTitle.toLowerCase().includes(workOrderSearch.toLowerCase()) ||
      wo.assignedTeam.toLowerCase().includes(workOrderSearch.toLowerCase()) ||
      wo.ticketNumbers.some(tn => tn.includes(workOrderSearch));

    const matchesStatus = workOrderStatusFilter === 'All' || wo.status === workOrderStatusFilter;

    return matchesSearch && matchesStatus;
  });

  // Helper for Status Badge Styling
  const renderStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'no communication') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1 w-fit">
          <ShieldAlert className="h-3 w-3" />
          No communication
        </span>
      );
    }
    if (s === 'warning') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1 w-fit">
          <AlertTriangle className="h-3 w-3" />
          Warning
        </span>
      );
    }
    if (s === 'critical') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-600/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 w-fit animate-pulse">
          <AlertCircle className="h-3 w-3 text-rose-400" />
          Critical
        </span>
      );
    }
    if (s === 'sensor issue') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30 flex items-center gap-1 w-fit">
          <Wrench className="h-3 w-3 text-purple-400" />
          Sensor issue
        </span>
      );
    }
    if (s === 'firmware issue') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 w-fit">
          <FileText className="h-3 w-3 text-cyan-400" />
          Firmware issue
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center gap-1 w-fit">
        <Clock className="h-3 w-3" />
        {status}
      </span>
    );
  };

  const renderWoStatusBadge = (status: WorkOrder['status']) => {
    switch (status) {
      case 'In Progress':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">In Progress</span>;
      case 'Completed':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Completed</span>;
      case 'Assigned':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">Assigned</span>;
      case 'Draft':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">Draft</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 text-zinc-100 pb-12">
      {/* Module Header Banner */}
      <div className="bg-gradient-to-r from-[#0d131f] via-[#0f172a] to-[#0d131f] border border-blue-500/20 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-blue-400 text-xs font-mono font-bold uppercase tracking-widest mb-1.5">
              <Wrench className="h-4 w-4" />
              <span>Operations & Field Services</span>
            </div>
            <h1 className="text-2xl font-serif font-bold text-white tracking-tight">Station Maintenance & Work Orders</h1>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
              Track station issue tickets with unique 6-digit reference numbers, assign engineers, and dispatch field work orders for meteorological network maintenance.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                <Database className="h-3 w-3 text-emerald-400" />
                Firestore Persistence Active
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-zinc-400 bg-zinc-900/60 border border-zinc-800">
                <CloudCheck className="h-3 w-3 text-blue-400" />
                Cloud Real-Time Listener Connected
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <div className="bg-[#080c14] border border-[#1e293b] rounded-lg p-3 flex items-center gap-4 text-center">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase font-mono block">Active Tickets</span>
                <span className="text-lg font-bold font-mono text-blue-400">{activeTickets.length}</span>
              </div>
              <div className="w-px h-8 bg-[#1e293b]"></div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase font-mono block">Work Orders</span>
                <span className="text-lg font-bold font-mono text-purple-400">{workOrders.length}</span>
              </div>
              <div className="w-px h-8 bg-[#1e293b]"></div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase font-mono block">Archived</span>
                <span className="text-lg font-bold font-mono text-amber-400">{archivedTickets.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 mt-6 pt-4 border-t border-[#1e293b] overflow-x-auto">
          <button
            id="tab-btn-tickets"
            onClick={() => setActiveTab('tickets')}
            className={`px-5 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-2 transition cursor-pointer shrink-0 ${
              activeTab === 'tickets'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 border border-blue-500'
                : 'bg-[#090e17] text-zinc-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            <Ticket className="h-4 w-4" />
            <span>1. Active Tickets</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'tickets' ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
              {activeTickets.length}
            </span>
          </button>

          <button
            id="tab-btn-work-orders"
            onClick={() => setActiveTab('work-orders')}
            className={`px-5 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-2 transition cursor-pointer shrink-0 ${
              activeTab === 'work-orders'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40 border border-purple-500'
                : 'bg-[#090e17] text-zinc-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            <span>2. Work Orders</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'work-orders' ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
              {workOrders.length}
            </span>
          </button>

          <button
            id="tab-btn-archived-tickets"
            onClick={() => setActiveTab('archive')}
            className={`px-5 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-2 transition cursor-pointer shrink-0 ${
              activeTab === 'archive'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/40 border border-amber-500'
                : 'bg-[#090e17] text-zinc-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            <Archive className="h-4 w-4" />
            <span>3. Archived Tickets</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'archive' ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
              {archivedTickets.length}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: TICKETS */}
      {activeTab === 'tickets' && (
        <div className="space-y-5">
          {/* Action Bar & Controls */}
          <div className="bg-[#0b0e14] border border-[#1a2230] p-4 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  value={ticketSearch}
                  onChange={e => setTicketSearch(e.target.value)}
                  placeholder="Search 6-digit ticket #, station, issue, or assignee..."
                  className="w-full pl-9 pr-3 py-2 bg-[#06080c] border border-[#1e293b] rounded-lg text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Status Filter */}
              <select
                value={ticketStatusFilter}
                onChange={e => setTicketStatusFilter(e.target.value)}
                className="px-3 py-2 bg-[#06080c] border border-[#1e293b] rounded-lg text-xs font-mono text-zinc-300 focus:outline-none focus:border-blue-500"
              >
                <option value="All">All Issue Statuses</option>
                <option value="No communication">No communication</option>
                <option value="Warning">Warning</option>
                <option value="critical">Critical</option>
                <option value="sensor issue">Sensor issue</option>
                <option value="firmware issue">Firmware issue</option>
                <option value="others">Others</option>
              </select>

              {/* Station Filter */}
              <select
                value={ticketStationFilter}
                onChange={e => setTicketStationFilter(e.target.value)}
                className="px-3 py-2 bg-[#06080c] border border-[#1e293b] rounded-lg text-xs font-mono text-zinc-300 focus:outline-none focus:border-blue-500 max-w-[180px] truncate"
              >
                <option value="All">All Stations</option>
                {stations.map(st => (
                  <option key={st.stationId} value={st.stationId}>{st.stationName}</option>
                ))}
              </select>

              {/* Assignee Filter */}
              <select
                value={ticketAssigneeFilter}
                onChange={e => setTicketAssigneeFilter(e.target.value)}
                className="px-3 py-2 bg-[#06080c] border border-[#1e293b] rounded-lg text-xs font-mono text-zinc-300 focus:outline-none focus:border-blue-500"
              >
                <option value="All">All Assignees</option>
                {availableUsernames.map(usr => (
                  <option key={usr} value={usr}>{usr}</option>
                ))}
              </select>
            </div>

            {/* PLUS Symbol Button to Add New Ticket */}
            <button
              id="btn-add-ticket-modal"
              onClick={() => setIsAddTicketModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-2 shadow-lg shadow-blue-900/30 border border-blue-400/30 transition cursor-pointer shrink-0"
            >
              <div className="p-1 bg-white/20 rounded">
                <Plus className="h-4 w-4 stroke-[3]" />
              </div>
              <span>Create Ticket</span>
            </button>
          </div>

          {/* Tickets List Table */}
          <div className="bg-[#0b0e14] border border-[#1a2230] rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-[#070a10] border-b border-[#1a2230] text-zinc-400 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3.5 px-4">Ticket #</th>
                    <th className="py-3.5 px-4">Station Name</th>
                    <th className="py-3.5 px-4">Issue Status</th>
                    <th className="py-3.5 px-4">Summary & Description</th>
                    <th className="py-3.5 px-4">Assigned Username</th>
                    <th className="py-3.5 px-4">Work Order</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#161f2e]">
                  {filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-500">
                        <Ticket className="h-8 w-8 mx-auto text-zinc-600 mb-2" />
                        <p className="text-sm font-sans">No tickets found matching current filters.</p>
                        <button 
                          onClick={() => setIsAddTicketModalOpen(true)} 
                          className="mt-3 text-xs text-blue-400 hover:underline font-mono"
                        >
                          + Create a new station ticket
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredTickets.map(ticket => (
                      <tr key={ticket.ticketNumber} className="hover:bg-[#0f1522] transition-colors group">
                        {/* Unique 6-digit ticket number */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/30">
                            #{ticket.ticketNumber}
                          </span>
                        </td>

                        {/* Station Name */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-zinc-100 font-sans text-sm">{ticket.stationName}</div>
                          <span className="text-[10px] text-zinc-500">{ticket.region || 'Met Network'}</span>
                        </td>

                        {/* Status Dropdown / Badge */}
                        <td className="py-3.5 px-4">
                          {renderStatusBadge(ticket.status)}
                        </td>

                        {/* Summary */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-semibold text-zinc-200 line-clamp-1">{ticket.summary}</div>
                          <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5 font-sans">{ticket.description}</p>
                        </td>

                        {/* Assigned Username */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-1.5 bg-[#070a10] border border-[#1e293b] px-2.5 py-1 rounded-md w-fit text-zinc-300">
                            <User className="h-3 w-3 text-blue-400" />
                            <span className="font-bold text-blue-300">{ticket.assignedTo}</span>
                          </div>
                        </td>

                        {/* Work Order Link */}
                        <td className="py-3.5 px-4">
                          {ticket.workOrderId ? (
                            <span className="px-2 py-0.5 bg-purple-500/10 text-purple-300 border border-purple-500/30 rounded text-[10px] font-bold">
                              {ticket.workOrderId}
                            </span>
                          ) : (
                            <span className="text-zinc-600 text-[10px] italic">Unassigned</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => setSelectedTicketDetail(ticket)}
                            className="p-1.5 hover:bg-blue-500/20 text-zinc-400 hover:text-blue-300 rounded transition cursor-pointer"
                            title="View Ticket Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTicket(ticket.ticketNumber)}
                            className="p-1.5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 rounded transition cursor-pointer"
                            title="Delete Ticket"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WORK ORDER */}
      {activeTab === 'work-orders' && (
        <div className="space-y-5">
          {/* Action Bar */}
          <div className="bg-[#0b0e14] border border-[#1a2230] p-4 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  value={workOrderSearch}
                  onChange={e => setWorkOrderSearch(e.target.value)}
                  placeholder="Search Work Order ID, title, assigned team, or ticket #..."
                  className="w-full pl-9 pr-3 py-2 bg-[#06080c] border border-[#1e293b] rounded-lg text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500"
                />
              </div>

              <select
                value={workOrderStatusFilter}
                onChange={e => setWorkOrderStatusFilter(e.target.value)}
                className="px-3 py-2 bg-[#06080c] border border-[#1e293b] rounded-lg text-xs font-mono text-zinc-300 focus:outline-none focus:border-purple-500"
              >
                <option value="All">All Work Order Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Assigned">Assigned</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>

            <button
              id="btn-create-work-order-modal"
              onClick={() => {
                if (tickets.length === 0) {
                  alert('Please create at least one maintenance ticket first.');
                  return;
                }
                setIsCreateWorkOrderModalOpen(true);
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-2 shadow-lg shadow-purple-900/30 border border-purple-400/30 transition cursor-pointer shrink-0"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>Create Work Order</span>
            </button>
          </div>

          {/* Work Orders Grid / List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredWorkOrders.length === 0 ? (
              <div className="col-span-full bg-[#0b0e14] border border-[#1a2230] p-12 rounded-xl text-center text-zinc-500">
                <ClipboardList className="h-8 w-8 mx-auto text-zinc-600 mb-2" />
                <p className="text-sm font-sans">No work orders created yet.</p>
                <button
                  onClick={() => setIsCreateWorkOrderModalOpen(true)}
                  className="mt-3 text-xs text-purple-400 hover:underline font-mono"
                >
                  + Create Work Order by assigning tickets
                </button>
              </div>
            ) : (
              filteredWorkOrders.map(wo => {
                const assignedTicketObjs = tickets.filter(t => wo.ticketNumbers.includes(t.ticketNumber));
                return (
                  <div key={wo.workOrderId} className="bg-[#0b0e14] border border-[#1a2230] hover:border-purple-500/40 p-5 rounded-xl space-y-4 shadow-xl transition-all">
                    <div className="flex items-start justify-between border-b border-[#182130] pb-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/30">
                            {wo.workOrderId}
                          </span>
                          <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                            wo.priority === 'Emergency' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                            wo.priority === 'High' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                            'bg-zinc-800 text-zinc-400'
                          }`}>
                            {wo.priority} Priority
                          </span>
                        </div>
                        <h3 className="font-bold text-white text-base mt-2">{wo.workOrderTitle}</h3>
                      </div>

                      <div>{renderWoStatusBadge(wo.status)}</div>
                    </div>

                    <div className="space-y-2 text-xs font-mono text-zinc-300">
                      <div className="flex justify-between py-1 border-b border-[#141a26]">
                        <span className="text-zinc-500 flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-purple-400" />
                          Maintenance Team:
                        </span>
                        <span className="font-semibold text-zinc-100">{wo.assignedTeam}</span>
                      </div>

                      <div className="flex justify-between py-1 border-b border-[#141a26]">
                        <span className="text-zinc-500 flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-blue-400" />
                          Scheduled Date:
                        </span>
                        <span className="text-zinc-200">{wo.scheduledDate}</span>
                      </div>
                    </div>

                    {/* Assigned Tickets List */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">
                        Assigned Tickets ({wo.ticketNumbers.length}):
                      </span>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {assignedTicketObjs.map(t => (
                          <div key={t.ticketNumber} className="bg-[#06080d] p-2 rounded border border-[#161f2e] flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2 truncate pr-2">
                              <span className="font-mono font-bold text-blue-400 text-[11px]">#{t.ticketNumber}</span>
                              <span className="text-zinc-200 truncate">{t.stationName}</span>
                            </div>
                            <div className="shrink-0">{renderStatusBadge(t.status)}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="pt-3 border-t border-[#182130] flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-1">
                        <span className="text-[10px] text-zinc-500 font-mono">Status:</span>
                        <select
                          value={wo.status}
                          onChange={e => handleUpdateWoStatus(wo.workOrderId, e.target.value as WorkOrder['status'])}
                          className="px-2 py-1 bg-[#06080d] border border-[#1e293b] rounded text-[10px] font-mono text-purple-300 font-bold focus:outline-none"
                        >
                          <option value="Draft">Draft</option>
                          <option value="Assigned">Assigned</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                          <option value="On Hold">On Hold</option>
                        </select>
                      </div>

                      <button
                        onClick={() => setSelectedWorkOrderDetail(wo)}
                        className="px-3 py-1.5 bg-[#141b27] hover:bg-[#1e283a] text-purple-300 rounded text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Work Order Sheet</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ARCHIVED TICKETS REPOSITORY */}
      {activeTab === 'archive' && (
        <ArchivedTicketsView
          archivedTickets={archivedTickets}
          stations={stations}
          onViewTicket={(t) => setSelectedTicketDetail(t)}
          onRestoreTicket={handleRestoreTicket}
        />
      )}

      {/* MODAL 1: ADD NEW TICKET (+ SYMBOL MODAL) */}
      {isAddTicketModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b0e14] border border-blue-500/40 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-[#1b2536] pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-600/20 rounded-lg border border-blue-500/30">
                  <Plus className="h-5 w-5 text-blue-400 stroke-[3]" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-white">Create Station Issue Ticket</h3>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Auto-generated Ticket Number: <strong className="text-blue-400">#{String(nextTicketNum).padStart(6, '0')}</strong>
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsAddTicketModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4 text-xs font-mono">
              {/* Station Selection Dropdown */}
              <div>
                <label className="block text-zinc-300 font-bold mb-1">
                  Station <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={newTicketStationId}
                  onChange={e => setNewTicketStationId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#06080d] border border-[#1e293b] rounded-lg text-zinc-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Select Station from list --</option>
                  {stations.map(st => (
                    <option key={st.stationId} value={st.stationId}>
                      {st.stationName} ({st.region})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Dropdown */}
              <div>
                <label className="block text-zinc-300 font-bold mb-1">
                  Status <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={newTicketStatus}
                  onChange={e => setNewTicketStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-[#06080d] border border-[#1e293b] rounded-lg text-zinc-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="No communication">No communication</option>
                  <option value="Warning">Warning</option>
                  <option value="critical">Critical</option>
                  <option value="sensor issue">Sensor issue</option>
                  <option value="firmware issue">Firmware issue</option>
                  <option value="others">Others</option>
                </select>
              </div>

              {/* Summary */}
              <div>
                <label className="block text-zinc-300 font-bold mb-1">
                  Summary <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTicketSummary}
                  onChange={e => setNewTicketSummary(e.target.value)}
                  placeholder="e.g., Telemetry packet loss or power failure"
                  className="w-full px-3 py-2 bg-[#06080d] border border-[#1e293b] rounded-lg text-zinc-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-zinc-300 font-bold mb-1">
                  Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={newTicketDescription}
                  onChange={e => setNewTicketDescription(e.target.value)}
                  placeholder="Detailed explanation of the issue, observed telemetry voltage, or sensor drift..."
                  className="w-full px-3 py-2 bg-[#06080d] border border-[#1e293b] rounded-lg text-zinc-200 focus:outline-none focus:border-blue-500 font-sans text-xs"
                />
              </div>

              {/* Assigned To & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-bold mb-1">
                    Assigned To <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={newTicketAssignedTo}
                    onChange={e => {
                      setNewTicketAssignedTo(e.target.value);
                      if (e.target.value === currentUser?.displayName || e.target.value === currentUser?.username) {
                        setNewTicketAssignedEmail(currentUser.email || 'birajkdl@gmail.com');
                      } else {
                        setNewTicketAssignedEmail(`${e.target.value.toLowerCase()}@met.gov.np`);
                      }
                    }}
                    className="w-full px-3 py-2 bg-[#06080d] border border-[#1e293b] rounded-lg text-zinc-200 focus:outline-none focus:border-blue-500"
                  >
                    {availableUsernames.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 font-bold mb-1">Priority</label>
                  <select
                    value={newTicketPriority}
                    onChange={e => setNewTicketPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#06080d] border border-[#1e293b] rounded-lg text-zinc-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>
              </div>

              {/* Mandatory User Email Address for Assignment Link */}
              <div>
                <label className="block text-zinc-300 font-bold mb-1 flex items-center justify-between">
                  <span>Assigned User Email <span className="text-red-400">*</span></span>
                  <span className="text-[10px] text-blue-400 font-normal">Receives Direct Access Link</span>
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 absolute left-3 top-2.5 text-zinc-500" />
                  <input
                    type="email"
                    required
                    value={newTicketAssignedEmail}
                    onChange={e => setNewTicketAssignedEmail(e.target.value)}
                    placeholder="user@met.gov.np"
                    className="w-full pl-9 pr-3 py-2 bg-[#06080d] border border-[#1e293b] rounded-lg text-zinc-200 focus:outline-none focus:border-blue-500 text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#1b2536] flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddTicketModalOpen(false)}
                  className="px-4 py-2 bg-[#121926] hover:bg-[#1a2336] text-zinc-300 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition cursor-pointer shadow-lg shadow-blue-900/40"
                >
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE WORK ORDER */}
      {isCreateWorkOrderModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b0e14] border border-purple-500/40 rounded-xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#1b2536] pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-purple-600/20 rounded-lg border border-purple-500/30">
                  <ClipboardList className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-white">Create Work Order</h3>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Bundle tickets into a maintenance dispatch order
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsCreateWorkOrderModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWorkOrder} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-zinc-300 font-bold mb-1">
                  Work Order Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newWoTitle}
                  onChange={e => setNewWoTitle(e.target.value)}
                  placeholder="e.g., Regional AWS Telemetry & Sensor Recalibration"
                  className="w-full px-3 py-2 bg-[#06080d] border border-[#1e293b] rounded-lg text-zinc-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-bold mb-1">Assigned Maintenance Team</label>
                  <select
                    value={newWoAssignedTeam}
                    onChange={e => setNewWoAssignedTeam(e.target.value)}
                    className="w-full px-3 py-2 bg-[#06080d] border border-[#1e293b] rounded-lg text-zinc-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="Field Maintenance Response Team Alpha">Field Response Team Alpha</option>
                    <option value="Telemetry & Electronics Squad">Telemetry & Electronics Squad</option>
                    <option value="Metrology & Sensor Lab Crew">Metrology & Sensor Lab Crew</option>
                    <option value="Regional Emergency Response Unit">Regional Emergency Unit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 font-bold mb-1">Scheduled Maintenance Date</label>
                  <input
                    type="date"
                    required
                    value={newWoScheduledDate}
                    onChange={e => setNewWoScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#06080d] border border-[#1e293b] rounded-lg text-zinc-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Select Tickets to Assign */}
              <div>
                <label className="block text-zinc-300 font-bold mb-1">
                  Assign Created Tickets <span className="text-red-400">*</span>
                </label>
                <div className="bg-[#06080d] border border-[#1e293b] rounded-lg p-3 max-h-44 overflow-y-auto space-y-2">
                  {tickets.map(t => {
                    const isChecked = newWoSelectedTicketNums.includes(t.ticketNumber);
                    return (
                      <label key={t.ticketNumber} className={`flex items-start space-x-3 p-2 rounded border cursor-pointer transition ${
                        isChecked ? 'bg-purple-950/30 border-purple-500/50' : 'bg-[#0a0e17] border-[#182130]'
                      }`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setNewWoSelectedTicketNums(prev => [...prev, t.ticketNumber]);
                            } else {
                              setNewWoSelectedTicketNums(prev => prev.filter(x => x !== t.ticketNumber));
                            }
                          }}
                          className="mt-0.5 rounded border-zinc-700 bg-zinc-900 text-purple-600 focus:ring-purple-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-blue-400 font-mono">#{t.ticketNumber}</span>
                            <span className="text-[10px] text-zinc-400">{t.stationName}</span>
                          </div>
                          <p className="text-[11px] text-zinc-300 font-sans truncate">{t.summary}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-bold mb-1">Scope of Work & Instructions</label>
                <textarea
                  rows={3}
                  value={newWoScopeOfWork}
                  onChange={e => setNewWoScopeOfWork(e.target.value)}
                  placeholder="Specific tasks, replacement equipment, safety procedures..."
                  className="w-full px-3 py-2 bg-[#06080d] border border-[#1e293b] rounded-lg text-zinc-200 focus:outline-none focus:border-purple-500 font-sans text-xs"
                />
              </div>

              <div className="pt-3 border-t border-[#1b2536] flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCreateWorkOrderModalOpen(false)}
                  className="px-4 py-2 bg-[#121926] hover:bg-[#1a2336] text-zinc-300 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition cursor-pointer shadow-lg shadow-purple-900/40"
                >
                  Create Work Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: TICKET LIFECYCLE, FOLLOW-UP NOTES & SENSOR REPLACEMENT WORKSPACE */}
      {selectedTicketDetail && (
        <TicketDetailModal
          ticket={selectedTicketDetail}
          stations={stations}
          sensors={sensors}
          currentUser={currentUser}
          bannerMessage={ticketCreationBanner}
          onClose={() => {
            setSelectedTicketDetail(null);
            setTicketCreationBanner(null);
          }}
          onAddNote={handleAddTicketNote}
          onRequestSensor={handleRequestSensorReplacement}
          onAssignSensor={handleAssignWorkingSensor}
          onResolve={handleResolveTicket}
          onAcknowledge={handleAcknowledgeTicket}
          onArchive={handleCloseAndArchive}
          onUpdateStatus={(ticketNum, newStatus) => {
            setTickets(prev => prev.map(t => t.ticketNumber === ticketNum ? { ...t, status: newStatus } : t));
          }}
          onSendEmail={handleSendAssignmentEmail}
        />
      )}

      {/* MODAL 4: WORK ORDER SHEET VIEW */}
      {selectedWorkOrderDetail && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b0e14] border border-purple-500/40 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#1b2536] pb-3">
              <div>
                <span className="text-[10px] font-mono text-purple-400 uppercase font-bold">Maintenance Work Order Sheet</span>
                <h3 className="font-serif text-lg font-bold text-white">{selectedWorkOrderDetail.workOrderId}</h3>
              </div>
              <button
                onClick={() => setSelectedWorkOrderDetail(null)}
                className="text-zinc-400 hover:text-white p-1 rounded transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="bg-[#06080d] p-3 rounded-lg border border-[#1a2230] space-y-1.5">
                <h4 className="font-bold text-white text-sm font-sans">{selectedWorkOrderDetail.workOrderTitle}</h4>
                <div className="flex justify-between text-zinc-400">
                  <span>Assigned Team:</span>
                  <span className="text-purple-300 font-bold">{selectedWorkOrderDetail.assignedTeam}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Scheduled Date:</span>
                  <span className="text-zinc-200">{selectedWorkOrderDetail.scheduledDate}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Priority:</span>
                  <span className="text-amber-400 font-bold">{selectedWorkOrderDetail.priority}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Status:</span>
                  <div>{renderWoStatusBadge(selectedWorkOrderDetail.status)}</div>
                </div>
              </div>

              <div>
                <span className="text-zinc-500 font-bold uppercase text-[10px] block mb-1">Assigned Tickets</span>
                <div className="space-y-1 bg-[#06080d] p-2 rounded border border-[#1a2230] max-h-32 overflow-y-auto">
                  {selectedWorkOrderDetail.ticketNumbers.map(tn => {
                    const t = tickets.find(x => x.ticketNumber === tn);
                    return (
                      <div key={tn} className="flex items-center justify-between text-[11px] py-1 border-b border-[#141a26] last:border-0">
                        <span className="text-blue-400 font-bold">#{tn}</span>
                        <span className="text-zinc-200 truncate max-w-[200px]">{t ? t.stationName : 'Station'}</span>
                        <span className="text-zinc-400">{t ? t.status : ''}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedWorkOrderDetail.scopeOfWork && (
                <div>
                  <span className="text-zinc-500 font-bold uppercase text-[10px] block mb-1">Scope of Work & Instructions</span>
                  <p className="text-zinc-300 font-sans whitespace-pre-wrap bg-[#06080d] p-2.5 rounded border border-[#1a2230] text-xs">
                    {selectedWorkOrderDetail.scopeOfWork}
                  </p>
                </div>
              )}

              {/* Direct Email Notification Dispatch Box */}
              <div className="bg-[#070a10] p-3 rounded-lg border border-purple-500/30 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-300 font-bold flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-purple-400" />
                    Dispatch Work Order Email Link
                  </span>
                  <span className="text-[10px] text-purple-400 font-mono">Registered Email ID</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="email"
                    defaultValue={currentUser?.email || 'field_ops@met.gov.np'}
                    id={`wo-detail-email-${selectedWorkOrderDetail.workOrderId}`}
                    className="flex-1 px-2.5 py-1.5 bg-[#06080d] border border-[#1e293b] rounded text-zinc-200 text-xs focus:outline-none focus:border-purple-500 font-mono"
                    placeholder="team_lead@met.gov.np"
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById(`wo-detail-email-${selectedWorkOrderDetail.workOrderId}`) as HTMLInputElement;
                      const emailVal = input && input.value ? input.value : currentUser?.email || 'field_ops@met.gov.np';
                      handleSendAssignmentEmail(
                        emailVal,
                        'work-order',
                        selectedWorkOrderDetail.workOrderId,
                        selectedWorkOrderDetail.workOrderTitle,
                        selectedWorkOrderDetail.assignedTeam,
                        'Field Network',
                        selectedWorkOrderDetail.priority || 'Medium'
                      );
                    }}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold text-xs flex items-center space-x-1 transition cursor-pointer shrink-0 shadow-sm"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Send Link</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#1b2536] flex justify-end">
              <button
                onClick={() => setSelectedWorkOrderDetail(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition font-mono text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMAIL DISPATCH SUCCESS POPUP TOAST */}
      {dispatchToast && (
        <div 
          id="email-assignment-dispatch-toast"
          className="fixed bottom-6 right-6 z-50 max-w-lg w-[calc(100vw-3rem)] bg-[#0c120e]/95 backdrop-blur-md border border-green-500/50 shadow-2xl shadow-black/90 rounded-2xl p-5 text-zinc-100 animate-in fade-in slide-in-from-bottom-5"
        >
          <div className="flex items-center justify-between pb-3 border-b border-green-500/20">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-green-500/20 border border-green-500/40 rounded-xl text-green-400 shrink-0">
                <Mail className="h-5 w-5 animate-bounce" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-green-400">
                  Email Dispatch Logged
                </h4>
                <p className="text-[11px] text-zinc-300 font-mono">
                  Recipient: <strong className="text-white font-sans">{dispatchToast.recipientEmail}</strong>
                </p>
              </div>
            </div>
            <button
              id="close-email-toast-btn"
              onClick={() => setDispatchToast(null)}
              className="text-zinc-400 hover:text-white p-1 rounded transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 space-y-3 text-xs">
            <p className="text-zinc-300 leading-relaxed">
              An email notification for <strong className="text-amber-300 font-mono">{dispatchToast.itemType === 'ticket' ? `Ticket #${dispatchToast.itemId}` : `Work Order ${dispatchToast.itemId}`}</strong> was dispatched with a direct clearance link.
            </p>

            <div className="bg-[#050806] p-3 rounded-xl border border-green-500/20 space-y-1 font-mono text-[11px]">
              <div className="text-zinc-500 text-[10px] font-bold uppercase">Direct Access Link:</div>
              <div className="text-blue-300 break-all bg-[#080d09] p-2 rounded border border-blue-500/20 select-all">
                {dispatchToast.linkUrl}
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <button
                id="copy-email-link-btn"
                onClick={() => {
                  navigator.clipboard.writeText(dispatchToast.linkUrl);
                  alert('Direct email access link copied to clipboard!');
                }}
                className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer border border-zinc-700"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Link</span>
              </button>

              <a
                id="test-email-link-btn"
                href={dispatchToast.linkUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer text-center shadow-md shadow-green-600/20"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Test Link (New Tab)</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
