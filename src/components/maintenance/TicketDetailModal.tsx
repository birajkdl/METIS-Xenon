import React, { useState } from 'react';
import { 
  X, 
  Send, 
  Mail, 
  MessageSquare, 
  Cpu, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ShieldAlert, 
  AlertCircle, 
  Wrench, 
  FileText, 
  Plus, 
  Check, 
  Lock, 
  Archive, 
  Sparkles,
  ArrowRight,
  User,
  Building2,
  Calendar,
  Layers,
  ChevronDown
} from 'lucide-react';
import { WeatherStation, Sensor, MaintenanceTicket, TicketNote, SensorReplacementRequest } from '../../types.ts';

interface TicketDetailModalProps {
  ticket: MaintenanceTicket;
  stations: WeatherStation[];
  sensors?: Sensor[];
  currentUser?: any;
  bannerMessage?: string | null;
  initialTab?: 'overview' | 'notes' | 'sensors' | 'resolution';
  onClose: () => void;
  onAddNote: (ticketNumber: string, content: string, category: TicketNote['category']) => void;
  onRequestSensor: (
    ticketNumber: string,
    req: Omit<SensorReplacementRequest, 'id' | 'requestedAt' | 'ticketNumber' | 'status'>,
    assignImmediately?: boolean,
    assignedData?: {
      sensorId?: number;
      serial?: string;
      model?: string;
      type?: string;
      manufacturer?: string;
      notes?: string;
    }
  ) => void;
  onAssignSensor: (
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
  ) => void;
  onResolve: (ticketNumber: string, resolutionNotes: string) => void;
  onAcknowledge: (ticketNumber: string, acknowledgmentNotes: string) => void;
  onArchive: (ticketNumber: string, remarks?: string) => void;
  onUpdateStatus: (ticketNumber: string, status: string) => void;
  onSendEmail: (
    recipientEmail: string,
    type: 'ticket',
    id: string,
    title: string,
    assignedTo: string,
    stationName: string,
    priority: string
  ) => void;
}

export default function TicketDetailModal({
  ticket,
  stations,
  sensors = [],
  currentUser,
  bannerMessage,
  initialTab = 'notes',
  onClose,
  onAddNote,
  onRequestSensor,
  onAssignSensor,
  onResolve,
  onAcknowledge,
  onArchive,
  onUpdateStatus,
  onSendEmail
}: TicketDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'sensors' | 'resolution'>(initialTab);

  // Note form state
  const [noteContent, setNoteContent] = useState('');
  const [noteCategory, setNoteCategory] = useState<TicketNote['category']>('Progress Update');

  // Request Sensor form state
  const [isRequestFormOpen, setIsRequestFormOpen] = useState(false);
  const [faultySensorType, setFaultySensorType] = useState('');
  const [selectedStationSensorId, setSelectedStationSensorId] = useState<string>('');
  const [faultReason, setFaultReason] = useState('');
  const [assignImmediately, setAssignImmediately] = useState(true);
  const [selectedWorkingSpareId, setSelectedWorkingSpareId] = useState<string>('');
  const [manualSerial, setManualSerial] = useState('');
  const [manualModel, setManualModel] = useState('');
  const [assignmentRemarks, setAssignmentRemarks] = useState('');

  // Assign existing request modal
  const [assigningRequestId, setAssigningRequestId] = useState<string | null>(null);
  const [assignModalSpareId, setAssignModalSpareId] = useState<string>('');
  const [assignModalNotes, setAssignModalNotes] = useState('');

  // Resolution form state
  const [resolutionInput, setResolutionInput] = useState('');
  const [isEditingResolution, setIsEditingResolution] = useState(false);

  // Acknowledgment form state
  const [ackInput, setAckInput] = useState('');

  // Archive modal state
  const [isArchivePromptOpen, setIsArchivePromptOpen] = useState(false);
  const [archiveRemarks, setArchiveRemarks] = useState('');
  const [archiveWarning, setArchiveWarning] = useState<string | null>(null);

  // Filter station sensors (sensors installed at this station)
  const stationSensors = React.useMemo(() => {
    return sensors.filter(s => s.stationId === ticket.stationId);
  }, [sensors, ticket.stationId]);

  // Available working spare sensors (sensors with status 'Active' or not currently faulted)
  const availableSpares = React.useMemo(() => {
    return sensors.filter(s => {
      // Spares or active sensors in other stations or inventory
      const statusMatch = s.status === 'Active' || s.status === 'Good';
      return statusMatch;
    });
  }, [sensors]);

  const currentUserName = currentUser?.displayName || currentUser?.username || currentUser?.email?.split('@')[0] || 'birajkdl';

  const notesList = ticket.notes || [];
  const sensorRequestsList = ticket.sensorRequests || [];

  const handleAddNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    onAddNote(ticket.ticketNumber, noteContent.trim(), noteCategory);
    setNoteContent('');
  };

  const handleSensorRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!faultySensorType.trim() || !faultReason.trim()) {
      alert('Please specify the sensor type and the fault reason.');
      return;
    }

    const stSensor = stationSensors.find(s => s.sensorId === Number(selectedStationSensorId));
    const chosenSpare = availableSpares.find(s => s.sensorId === Number(selectedWorkingSpareId));

    const reqData: Omit<SensorReplacementRequest, 'id' | 'requestedAt' | 'ticketNumber' | 'status'> = {
      stationId: ticket.stationId,
      stationName: ticket.stationName,
      faultySensorId: stSensor ? stSensor.sensorId : null,
      faultySensorType: faultySensorType.trim(),
      faultySensorSerial: stSensor ? stSensor.serialNumber : null,
      faultySensorModel: stSensor ? stSensor.model : null,
      faultReason: faultReason.trim(),
      requestedBy: currentUserName
    };

    let assignedData: any = undefined;
    if (assignImmediately) {
      if (chosenSpare) {
        assignedData = {
          sensorId: chosenSpare.sensorId,
          serial: chosenSpare.serialNumber || `SN-${chosenSpare.sensorId}`,
          model: chosenSpare.model || chosenSpare.sensorType,
          type: chosenSpare.sensorType,
          manufacturer: chosenSpare.manufacturer || 'METIS Certified',
          notes: assignmentRemarks.trim() || 'Assigned directly upon ticket creation'
        };
      } else if (manualSerial.trim()) {
        assignedData = {
          serial: manualSerial.trim(),
          model: manualModel.trim() || faultySensorType.trim(),
          type: faultySensorType.trim(),
          manufacturer: 'Standard Stock',
          notes: assignmentRemarks.trim() || 'Manual replacement unit assigned'
        };
      }
    }

    onRequestSensor(ticket.ticketNumber, reqData, assignImmediately, assignedData);

    // Reset Form
    setIsRequestFormOpen(false);
    setFaultySensorType('');
    setSelectedStationSensorId('');
    setFaultReason('');
    setSelectedWorkingSpareId('');
    setManualSerial('');
    setManualModel('');
    setAssignmentRemarks('');
  };

  const handleAssignModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningRequestId) return;
    const chosenSpare = availableSpares.find(s => s.sensorId === Number(assignModalSpareId));

    onAssignSensor(ticket.ticketNumber, assigningRequestId, {
      assignedSensorId: chosenSpare ? chosenSpare.sensorId : null,
      assignedSensorSerial: chosenSpare?.serialNumber || 'N/A',
      assignedSensorModel: chosenSpare?.model || 'METIS Sensor',
      assignedSensorType: chosenSpare?.sensorType || 'Diagnostic Unit',
      assignedSensorManufacturer: chosenSpare?.manufacturer || 'Certified Metrology',
      assignedBy: currentUserName,
      assignmentNotes: assignModalNotes.trim() || 'Assigned from central spares inventory'
    });

    setAssigningRequestId(null);
    setAssignModalSpareId('');
    setAssignModalNotes('');
  };

  const handleResolveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionInput.trim()) {
      alert('Please describe how the problem was resolved.');
      return;
    }
    onResolve(ticket.ticketNumber, resolutionInput.trim());
    setIsEditingResolution(false);
  };

  const handleAcknowledgeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ackInput.trim()) {
      alert('Please provide acknowledgment remarks or verification notes.');
      return;
    }
    onAcknowledge(ticket.ticketNumber, ackInput.trim());
    setAckInput('');
  };

  const handleTryArchive = () => {
    if (!ticket.isAcknowledged) {
      setArchiveWarning('Resolution Acknowledgment Required: The ticket cannot be closed and stored in archive until the problem resolution has been acknowledged by anyone.');
      return;
    }
    setArchiveWarning(null);
    setIsArchivePromptOpen(true);
  };

  const handleConfirmArchive = () => {
    onArchive(ticket.ticketNumber, archiveRemarks.trim());
    setIsArchivePromptOpen(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#0c1017] border border-blue-500/40 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative font-sans">
        
        {/* Top Header */}
        <div className="bg-[#090d14] border-b border-[#1b2636] px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-400">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30">
                  #{ticket.ticketNumber}
                </span>
                <span className="text-xs text-zinc-400 font-mono">
                  Station: <strong className="text-white">{ticket.stationName}</strong>
                </span>
                {ticket.isArchived && (
                  <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                    <Archive className="h-3 w-3" />
                    Archived
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white mt-0.5 line-clamp-1">{ticket.summary}</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-lg transition cursor-pointer"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Immediate creation highlight banner */}
        {bannerMessage && (
          <div className="bg-gradient-to-r from-emerald-950/80 via-blue-950/80 to-emerald-950/80 border-b border-emerald-500/30 px-5 py-2.5 flex items-center justify-between text-xs text-emerald-200">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-emerald-400 shrink-0 animate-pulse" />
              <span>{bannerMessage}</span>
            </div>
            <button
              onClick={() => setActiveTab('sensors')}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold font-mono transition shrink-0 ml-2 cursor-pointer"
            >
              + Request Sensor &rarr;
            </button>
          </div>
        )}

        {/* Lifecycle Steps Bar */}
        <div className="bg-[#070a10] border-b border-[#16202e] px-5 py-2.5 flex items-center justify-between text-[11px] font-mono overflow-x-auto gap-2">
          <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
            <span className="flex items-center gap-1 text-blue-400 font-bold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              1. Created & Saved
            </span>
            <ArrowRight className="h-3 w-3 text-zinc-600" />
            <span className={`flex items-center gap-1 font-bold ${sensorRequestsList.length > 0 || notesList.length > 0 ? 'text-purple-400' : 'text-zinc-500'}`}>
              <MessageSquare className="h-3.5 w-3.5" />
              2. Follow-up & Sensors ({notesList.length} notes, {sensorRequestsList.length} sensors)
            </span>
            <ArrowRight className="h-3 w-3 text-zinc-600" />
            <span className={`flex items-center gap-1 font-bold ${ticket.isResolved ? 'text-emerald-400' : 'text-zinc-500'}`}>
              <Check className="h-3.5 w-3.5" />
              3. Solved
            </span>
            <ArrowRight className="h-3 w-3 text-zinc-600" />
            <span className={`flex items-center gap-1 font-bold ${ticket.isAcknowledged ? 'text-cyan-400' : 'text-zinc-500'}`}>
              <ShieldCheck className="h-3.5 w-3.5" />
              4. Acknowledged
            </span>
            <ArrowRight className="h-3 w-3 text-zinc-600" />
            <span className={`flex items-center gap-1 font-bold ${ticket.isArchived ? 'text-amber-400' : 'text-zinc-500'}`}>
              <Archive className="h-3.5 w-3.5" />
              5. Closed & Archived
            </span>
          </div>
        </div>

        {/* Navigation Tabs inside Modal */}
        <div className="bg-[#090d14] px-5 pt-3 border-b border-[#1b2636] flex items-center space-x-2 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-4 py-2 rounded-t-lg text-xs font-mono font-bold flex items-center space-x-2 transition cursor-pointer border-b-2 ${
              activeTab === 'notes'
                ? 'bg-[#0f1724] text-blue-400 border-blue-500'
                : 'text-zinc-400 hover:text-zinc-200 border-transparent'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Follow-up Notes</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-500/20 text-blue-300">
              {notesList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('sensors')}
            className={`px-4 py-2 rounded-t-lg text-xs font-mono font-bold flex items-center space-x-2 transition cursor-pointer border-b-2 ${
              activeTab === 'sensors'
                ? 'bg-[#0f1724] text-purple-400 border-purple-500'
                : 'text-zinc-400 hover:text-zinc-200 border-transparent'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>Sensor Replacement & Assignment</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500/20 text-purple-300">
              {sensorRequestsList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('resolution')}
            className={`px-4 py-2 rounded-t-lg text-xs font-mono font-bold flex items-center space-x-2 transition cursor-pointer border-b-2 ${
              activeTab === 'resolution'
                ? 'bg-[#0f1724] text-emerald-400 border-emerald-500'
                : 'text-zinc-400 hover:text-zinc-200 border-transparent'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Resolution & Archive Gate</span>
            {ticket.isAcknowledged ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300">
                Ready to Archive
              </span>
            ) : ticket.isResolved ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300">
                Needs Ack
              </span>
            ) : null}
          </button>

          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-t-lg text-xs font-mono font-bold flex items-center space-x-2 transition cursor-pointer border-b-2 ${
              activeTab === 'overview'
                ? 'bg-[#0f1724] text-zinc-200 border-zinc-400'
                : 'text-zinc-400 hover:text-zinc-200 border-transparent'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Ticket Overview</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#0a0e16]">
          
          {/* TAB 1: FOLLOW-UP NOTES */}
          {activeTab === 'notes' && (
            <div className="space-y-5">
              {/* Form to log follow-up notes */}
              <div className="bg-[#0e1420] border border-blue-500/30 rounded-xl p-4 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4" />
                    Log Ticket Follow-up Note
                  </span>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    Author: <strong className="text-white">{currentUserName}</strong>
                  </span>
                </div>

                <form onSubmit={handleAddNoteSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <label className="text-[10px] font-mono text-zinc-400 uppercase font-bold block mb-1">
                        Category
                      </label>
                      <select
                        value={noteCategory}
                        onChange={e => setNoteCategory(e.target.value as TicketNote['category'])}
                        className="w-full bg-[#070a10] border border-[#1e2a3a] text-zinc-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-blue-500"
                      >
                        <option value="Progress Update">Progress Update</option>
                        <option value="Field Inspection">Field Inspection</option>
                        <option value="Diagnostic Finding">Diagnostic Finding</option>
                        <option value="Sensor Replacement Note">Sensor Replacement Note</option>
                        <option value="General Note">General Note</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-mono text-zinc-400 uppercase font-bold block mb-1">
                        Note Details & Inspection Findings
                      </label>
                      <textarea
                        required
                        rows={2}
                        value={noteContent}
                        onChange={e => setNoteContent(e.target.value)}
                        placeholder="Log diagnostic findings, station telemetry check, in-situ testing, or parts required..."
                        className="w-full bg-[#070a10] border border-[#1e2a3a] text-zinc-200 rounded-lg p-2.5 text-xs placeholder-zinc-600 focus:outline-none focus:border-blue-500 resize-none font-sans"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-zinc-500 font-mono">
                      Notes are timestamped and preserved in the ticket audit log.
                    </span>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-md shadow-blue-900/30"
                    >
                      <Plus className="h-3.5 w-3.5 stroke-[3]" />
                      <span>Log Follow-up Note</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Notes Timeline Feed */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
                  Ticket Activity Feed & Notes ({notesList.length})
                </h4>

                {notesList.length === 0 ? (
                  <div className="bg-[#0b0f17] border border-[#192434] rounded-xl p-8 text-center text-zinc-500 font-mono text-xs">
                    <MessageSquare className="h-8 w-8 mx-auto text-zinc-600 mb-2" />
                    <p className="text-zinc-400">No notes logged on this ticket yet.</p>
                    <p className="text-[11px] text-zinc-600 mt-1">
                      As the creator or field tech, use the form above to add immediate inspection updates or diagnostic notes.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notesList.map((note, idx) => (
                      <div
                        key={note.id || idx}
                        className="bg-[#0c1119] border border-[#1a2536] rounded-xl p-3.5 space-y-2 relative shadow-sm"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-blue-300 font-mono flex items-center gap-1">
                              <User className="h-3 w-3 text-blue-400" />
                              {note.author}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              note.category === 'Sensor Replacement Note'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : note.category === 'Field Inspection'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : note.category === 'Diagnostic Finding'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                            }`}>
                              {note.category}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {note.createdAt}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-200 leading-relaxed font-sans bg-[#070a10] p-2.5 rounded-lg border border-[#151e2c]">
                          {note.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SENSOR REPLACEMENT & ALLOCATION */}
          {activeTab === 'sensors' && (
            <div className="space-y-5">
              {/* Header + Add Request Button */}
              <div className="bg-[#0e131d] border border-purple-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-purple-400" />
                    <span>Station Sensor Replacement & Assignment</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Request a replacement sensor for faulty equipment at <strong className="text-purple-300">{ticket.stationName}</strong>. You can immediately assign working spares from inventory.
                  </p>
                </div>

                {!isRequestFormOpen && (
                  <button
                    onClick={() => setIsRequestFormOpen(true)}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-md shadow-purple-900/30 shrink-0"
                  >
                    <Plus className="h-4 w-4 stroke-[3]" />
                    <span>Request New Working Sensor</span>
                  </button>
                )}
              </div>

              {/* Sensor Replacement Form */}
              {isRequestFormOpen && (
                <form onSubmit={handleSensorRequestSubmit} className="bg-[#0f1422] border border-purple-500/40 rounded-xl p-4 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-[#1f2a3e] pb-2.5">
                    <span className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Cpu className="h-4 w-4" />
                      Sensor Replacement Request Form
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsRequestFormOpen(false)}
                      className="text-zinc-400 hover:text-white p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                    {/* Station & Faulty Sensor */}
                    <div>
                      <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1">
                        Select Faulty Sensor at Station (or Enter Type) <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={selectedStationSensorId}
                        onChange={e => {
                          const val = e.target.value;
                          setSelectedStationSensorId(val);
                          const chosen = stationSensors.find(s => s.sensorId === Number(val));
                          if (chosen) {
                            setFaultySensorType(chosen.sensorType);
                          }
                        }}
                        className="w-full bg-[#070a10] border border-[#1e2a3a] text-zinc-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-purple-500"
                      >
                        <option value="">-- Choose from {stationSensors.length} sensors installed at station --</option>
                        {stationSensors.map(s => (
                          <option key={s.sensorId} value={s.sensorId}>
                            {s.sensorType} (SN: {s.serialNumber || 'N/A'}, Model: {s.model || 'Standard'}) - {s.status}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1">
                        Faulty Sensor Name / Type <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={faultySensorType}
                        onChange={e => setFaultySensorType(e.target.value)}
                        placeholder="e.g. Ultrasonic Anemometer, Barometer PTB210, Rain Gauge..."
                        className="w-full bg-[#070a10] border border-[#1e2a3a] text-zinc-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 uppercase font-bold block mb-1">
                      Fault Description & Reason for Replacement <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={faultReason}
                      onChange={e => setFaultReason(e.target.value)}
                      placeholder="Describe the failure mode (e.g. erratic readings, lightning damage, heater burnout, reed switch corrosion, zero drift > 5%)..."
                      className="w-full bg-[#070a10] border border-[#1e2a3a] text-zinc-200 rounded-lg p-2.5 text-xs placeholder-zinc-600 focus:outline-none focus:border-purple-500 resize-none font-sans"
                    />
                  </div>

                  {/* Immediate Assignment Checkbox & Selection */}
                  <div className="bg-[#0a0f18] border border-purple-500/20 p-3.5 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center space-x-2 cursor-pointer text-xs font-mono font-bold text-purple-300">
                        <input
                          type="checkbox"
                          checked={assignImmediately}
                          onChange={e => setAssignImmediately(e.target.checked)}
                          className="rounded border-zinc-700 text-purple-600 focus:ring-purple-500 h-4 w-4 cursor-pointer"
                        />
                        <span>Immediately Allocate / Assign Working Sensor from Inventory</span>
                      </label>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        Creator / Tech can assign right now
                      </span>
                    </div>

                    {assignImmediately && (
                      <div className="space-y-3 pt-2 border-t border-[#182232] text-xs font-mono">
                        <div>
                          <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1">
                            Select Available Working Spare Sensor from Inventory
                          </label>
                          <select
                            value={selectedWorkingSpareId}
                            onChange={e => {
                              setSelectedWorkingSpareId(e.target.value);
                              const chosen = availableSpares.find(s => s.sensorId === Number(e.target.value));
                              if (chosen) {
                                setManualSerial(chosen.serialNumber || '');
                                setManualModel(chosen.model || '');
                              }
                            }}
                            className="w-full bg-[#070a10] border border-[#1e2a3a] text-zinc-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-purple-500"
                          >
                            <option value="">-- Choose from inventory spares ({availableSpares.length} available) --</option>
                            {availableSpares.map(s => (
                              <option key={s.sensorId} value={s.sensorId}>
                                {s.sensorType} | SN: {s.serialNumber || 'N/A'} | Model: {s.model || 'Standard'} ({s.manufacturer || 'Met Office'})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1">
                              Working Sensor Serial #
                            </label>
                            <input
                              type="text"
                              value={manualSerial}
                              onChange={e => setManualSerial(e.target.value)}
                              placeholder="e.g. SN-WND-9921 or RG-TB4-7721"
                              className="w-full bg-[#070a10] border border-[#1e2a3a] text-zinc-200 rounded-lg p-2 text-xs focus:outline-none focus:border-purple-500"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1">
                              Working Sensor Model / Spec
                            </label>
                            <input
                              type="text"
                              value={manualModel}
                              onChange={e => setManualModel(e.target.value)}
                              placeholder="e.g. Vaisala PTB330 or Campbell CR1000X"
                              className="w-full bg-[#070a10] border border-[#1e2a3a] text-zinc-200 rounded-lg p-2 text-xs focus:outline-none focus:border-purple-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1">
                            Dispatch / Assignment Remarks
                          </label>
                          <input
                            type="text"
                            value={assignmentRemarks}
                            onChange={e => setAssignmentRemarks(e.target.value)}
                            placeholder="e.g. Calibrated unit dispatched via field vehicle. Kit includes mounting bracket."
                            className="w-full bg-[#070a10] border border-[#1e2a3a] text-zinc-200 rounded-lg p-2 text-xs focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#1f2a3e]">
                    <button
                      type="button"
                      onClick={() => setIsRequestFormOpen(false)}
                      className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-mono"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-md shadow-purple-900/30"
                    >
                      <Check className="h-4 w-4 stroke-[3]" />
                      <span>{assignImmediately ? 'Submit & Assign Working Sensor' : 'Submit Sensor Request'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* List of Sensor Replacement Requests */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
                  Requested Sensor Replacements ({sensorRequestsList.length})
                </h4>

                {sensorRequestsList.length === 0 ? (
                  <div className="bg-[#0b0f17] border border-[#192434] rounded-xl p-8 text-center text-zinc-500 font-mono text-xs">
                    <Cpu className="h-8 w-8 mx-auto text-zinc-600 mb-2" />
                    <p className="text-zinc-400">No sensor replacements requested yet for this ticket.</p>
                    <p className="text-[11px] text-zinc-600 mt-1">
                      If a sensor is damaged or reading erratically, click &quot;Request New Working Sensor&quot; above.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sensorRequestsList.map((req, idx) => (
                      <div
                        key={req.id || idx}
                        className="bg-[#0c1119] border border-[#1b2738] rounded-xl p-4 space-y-3 shadow-md"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#16202e] pb-2.5">
                          <div>
                            <span className="text-[10px] font-mono text-purple-400 font-bold uppercase">Faulty Sensor:</span>
                            <h4 className="text-sm font-bold text-white font-mono">{req.faultySensorType}</h4>
                            {req.faultySensorSerial && (
                              <span className="text-[10px] text-zinc-500 font-mono">
                                Serial: {req.faultySensorSerial}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                              req.status === 'Installed & Tested'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : req.status === 'Assigned / In Transit'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}>
                              {req.status}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              Requested {req.requestedAt} by {req.requestedBy}
                            </span>
                          </div>
                        </div>

                        <div className="bg-[#070a10] p-2.5 rounded-lg border border-[#151e2c] text-xs">
                          <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold block mb-0.5">
                            Fault Symptom / Diagnostic Reason:
                          </span>
                          <p className="text-zinc-200 font-sans">{req.faultReason}</p>
                        </div>

                        {/* Assigned working sensor details */}
                        {req.assignedSensorSerial ? (
                          <div className="bg-[#09111e] border border-blue-500/20 rounded-lg p-3 space-y-1.5 text-xs font-mono">
                            <div className="flex items-center justify-between text-blue-300 font-bold text-[11px]">
                              <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                Working Sensor Assigned & In Transit
                              </span>
                              <span className="text-zinc-400 text-[10px]">
                                Assigned by: {req.assignedBy} ({req.assignedAt})
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-zinc-300 text-[11px] pt-1">
                              <div>Serial: <strong className="text-white">{req.assignedSensorSerial}</strong></div>
                              <div>Model: <strong className="text-white">{req.assignedSensorModel || 'N/A'}</strong></div>
                              <div>Type: <strong className="text-white">{req.assignedSensorType || req.faultySensorType}</strong></div>
                            </div>
                            {req.assignmentNotes && (
                              <p className="text-[10px] text-zinc-400 italic pt-1">
                                Notes: {req.assignmentNotes}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between bg-[#120f08] border border-amber-500/20 p-2.5 rounded-lg text-xs">
                            <span className="text-amber-300 font-mono text-[11px]">
                              Waiting for working sensor assignment.
                            </span>
                            <button
                              onClick={() => setAssigningRequestId(req.id)}
                              className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-mono font-bold cursor-pointer"
                            >
                              Assign Working Sensor Now
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assign modal */}
              {assigningRequestId && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                  <div className="bg-[#0d131f] border border-purple-500/40 rounded-xl p-5 max-w-md w-full space-y-4 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-[#1b2536] pb-2.5">
                      <h4 className="font-bold text-white text-sm">Assign Working Sensor from Inventory</h4>
                      <button onClick={() => setAssigningRequestId(null)} className="text-zinc-400 hover:text-white">
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <form onSubmit={handleAssignModalSubmit} className="space-y-3">
                      <div>
                        <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1">
                          Select Working Unit from Warehouse / Spares
                        </label>
                        <select
                          required
                          value={assignModalSpareId}
                          onChange={e => setAssignModalSpareId(e.target.value)}
                          className="w-full bg-[#06080d] border border-[#1e2a3a] text-zinc-200 rounded-lg p-2.5 text-xs focus:outline-none"
                        >
                          <option value="">-- Select Spare Sensor --</option>
                          {availableSpares.map(s => (
                            <option key={s.sensorId} value={s.sensorId}>
                              {s.sensorType} (SN: {s.serialNumber || 'N/A'}, Model: {s.model || 'Standard'})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1">
                          Assignment & Calibration Remarks
                        </label>
                        <input
                          type="text"
                          value={assignModalNotes}
                          onChange={e => setAssignModalNotes(e.target.value)}
                          placeholder="e.g. Inspected and cleared for deployment."
                          className="w-full bg-[#06080d] border border-[#1e2a3a] text-zinc-200 rounded-lg p-2 text-xs focus:outline-none"
                        />
                      </div>

                      <div className="flex justify-end space-x-2 pt-2 border-t border-[#1b2536]">
                        <button
                          type="button"
                          onClick={() => setAssigningRequestId(null)}
                          className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded"
                        >
                          Assign Unit
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RESOLUTION & ARCHIVE GATE */}
          {activeTab === 'resolution' && (
            <div className="space-y-6">
              {/* Mandatory Rule Callout */}
              <div className="bg-[#09111c] border border-cyan-500/30 rounded-xl p-4 text-xs font-mono space-y-1">
                <span className="text-cyan-400 font-bold uppercase text-[10px] flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  METIS Maintenance Protocol Rule
                </span>
                <p className="text-zinc-300 font-sans">
                  The ticket can be closed and stored in archive <strong>only after the problem solve is acknowledged by anyone</strong>. This guarantees that field repairs and sensor replacements have undergone verification before being sealed into the archive.
                </p>
              </div>

              {/* STEP 1: PROBLEM SOLVED */}
              <div className={`border rounded-xl p-4 space-y-3 ${ticket.isResolved ? 'bg-[#08130e] border-emerald-500/40' : 'bg-[#0c1017] border-[#1b2636]'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono ${
                      ticket.isResolved ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      1
                    </span>
                    <h4 className="font-bold text-sm text-white">
                      Step 1: Mark Problem as Solved
                    </h4>
                  </div>

                  {ticket.isResolved && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Problem Solved
                    </span>
                  )}
                </div>

                {ticket.isResolved && !isEditingResolution ? (
                  <div className="bg-[#050b07] border border-emerald-500/20 rounded-lg p-3 space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between text-emerald-300 font-bold">
                      <span>✓ Solved by {ticket.resolvedBy}</span>
                      <span className="text-zinc-500 text-[10px]">{ticket.resolvedAt}</span>
                    </div>
                    <p className="text-zinc-200 font-sans leading-relaxed pt-1">
                      {ticket.resolutionNotes}
                    </p>
                    <button
                      onClick={() => {
                        setResolutionInput(ticket.resolutionNotes || '');
                        setIsEditingResolution(true);
                      }}
                      className="text-[10px] text-zinc-400 hover:text-white underline cursor-pointer mt-1 block"
                    >
                      Update resolution details
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleResolveSubmit} className="space-y-3 font-mono text-xs">
                    <p className="text-zinc-400 font-sans text-xs">
                      When repairs, sensor replacement, or configuration fixes are completed, enter the actions taken and mark the issue as solved.
                    </p>
                    <textarea
                      required
                      rows={3}
                      value={resolutionInput}
                      onChange={e => setResolutionInput(e.target.value)}
                      placeholder="e.g. Replaced faulty rain gauge reed switch assembly with spare RG-TB4-7721. Completed 5 test tipping dumps, all telemetry pulses registered accurately on CR1000X data logger."
                      className="w-full bg-[#06080d] border border-[#1e2a3a] text-zinc-200 rounded-lg p-2.5 text-xs placeholder-zinc-600 focus:outline-none focus:border-emerald-500 resize-none font-sans"
                    />
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-zinc-500">
                        Resolved By: <strong className="text-white">{currentUserName}</strong>
                      </span>
                      <div className="flex items-center space-x-2">
                        {isEditingResolution && (
                          <button
                            type="button"
                            onClick={() => setIsEditingResolution(false)}
                            className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded text-xs"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center space-x-1.5 transition cursor-pointer shadow-md shadow-emerald-900/30"
                        >
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                          <span>Mark Problem as Solved</span>
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>

              {/* STEP 2: ACKNOWLEDGE PROBLEM RESOLUTION */}
              <div className={`border rounded-xl p-4 space-y-3 ${
                ticket.isAcknowledged 
                  ? 'bg-[#061118] border-cyan-500/40' 
                  : ticket.isResolved 
                  ? 'bg-[#120f07] border-amber-500/40' 
                  : 'bg-[#090c12] border-[#161f2c] opacity-60'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono ${
                      ticket.isAcknowledged ? 'bg-cyan-500 text-white' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      2
                    </span>
                    <h4 className="font-bold text-sm text-white">
                      Step 2: Acknowledge Problem Resolution
                    </h4>
                  </div>

                  {ticket.isAcknowledged ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      Acknowledged & Verified
                    </span>
                  ) : ticket.isResolved ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Pending Acknowledgment by Anyone
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Locked (Resolve step 1 first)
                    </span>
                  )}
                </div>

                {!ticket.isResolved ? (
                  <p className="text-zinc-500 text-xs font-mono italic">
                    The problem must be marked as solved in Step 1 before anyone can review and acknowledge the resolution.
                  </p>
                ) : ticket.isAcknowledged ? (
                  <div className="bg-[#040d12] border border-cyan-500/20 rounded-lg p-3 space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between text-cyan-300 font-bold">
                      <span>✓ Acknowledged by {ticket.acknowledgedBy}</span>
                      <span className="text-zinc-500 text-[10px]">{ticket.acknowledgedAt}</span>
                    </div>
                    <p className="text-zinc-200 font-sans leading-relaxed pt-1">
                      &quot;{ticket.acknowledgmentNotes}&quot;
                    </p>
                    <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 pt-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Prerequisite verified: Ticket is now officially eligible to be closed and archived!
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleAcknowledgeSubmit} className="space-y-3 font-mono text-xs">
                    <div className="bg-[#1a1407] border border-amber-500/30 rounded-lg p-2.5 text-amber-200 text-xs font-sans">
                      <strong>Verification Required:</strong> Anyone (creator, supervisor, or another technician) can review the telemetry data and acknowledge this resolution to unlock archiving.
                    </div>
                    <textarea
                      required
                      rows={2}
                      value={ackInput}
                      onChange={e => setAckInput(e.target.value)}
                      placeholder="e.g. Checked live telemetry packets for past 6 hours. Battery voltage normal at 13.8V and rain gauge data stream validated."
                      className="w-full bg-[#06080d] border border-[#1e2a3a] text-zinc-200 rounded-lg p-2.5 text-xs placeholder-zinc-600 focus:outline-none focus:border-cyan-500 resize-none font-sans"
                    />
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-zinc-400">
                        Acknowledging As: <strong className="text-white">{currentUserName}</strong>
                      </span>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs flex items-center space-x-1.5 transition cursor-pointer shadow-md shadow-cyan-900/30"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Acknowledge Problem Resolution</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* STEP 3: CLOSE & STORE IN ARCHIVE */}
              <div className={`border rounded-xl p-4 space-y-3 ${
                ticket.isArchived 
                  ? 'bg-[#100e08] border-amber-500/40' 
                  : ticket.isAcknowledged 
                  ? 'bg-[#0d1624] border-blue-500/40' 
                  : 'bg-[#090c12] border-[#161f2c]'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono ${
                      ticket.isArchived ? 'bg-amber-500 text-white' : ticket.isAcknowledged ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500'
                    }`}>
                      3
                    </span>
                    <h4 className="font-bold text-sm text-white">
                      Step 3: Close & Store in Archive
                    </h4>
                  </div>

                  {ticket.isArchived ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <Archive className="h-3 w-3" />
                      Closed & Stored in Archive
                    </span>
                  ) : ticket.isAcknowledged ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Unlocked & Ready to Archive
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Locked (Requires Acknowledgment)
                    </span>
                  )}
                </div>

                {archiveWarning && (
                  <div className="bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs p-3 rounded-lg flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                    <span>{archiveWarning}</span>
                  </div>
                )}

                {ticket.isArchived ? (
                  <div className="bg-[#0b0a06] border border-amber-500/20 rounded-lg p-3 space-y-1 text-xs font-mono">
                    <div className="text-amber-300 font-bold">
                      Archived by {ticket.archivedBy} on {ticket.archivedAt}
                    </div>
                    {ticket.archiveRemarks && (
                      <p className="text-zinc-400 italic">
                        Remarks: {ticket.archiveRemarks}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <p className="text-xs text-zinc-400 font-sans">
                      {ticket.isAcknowledged 
                        ? 'Problem resolution has been verified and acknowledged. You may now permanently archive this ticket.'
                        : 'Cannot close yet: problem solve must be acknowledged by anyone before this ticket can be archived.'}
                    </p>

                    <button
                      onClick={handleTryArchive}
                      disabled={!ticket.isAcknowledged}
                      className={`px-5 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-2 transition shrink-0 ${
                        ticket.isAcknowledged
                          ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white cursor-pointer shadow-lg shadow-amber-900/30 border border-amber-400/40'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                      }`}
                    >
                      {ticket.isAcknowledged ? <Archive className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      <span>Close & Store in Archive</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Archive Confirmation Dialog */}
              {isArchivePromptOpen && (
                <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
                  <div className="bg-[#0e121a] border border-amber-500/50 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl font-mono text-xs">
                    <div className="flex items-center space-x-3 text-amber-400 border-b border-[#1f283a] pb-3">
                      <div className="p-2 bg-amber-500/20 rounded-xl border border-amber-500/40">
                        <Archive className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Confirm Close & Store in Archive</h3>
                        <span className="text-[10px] text-zinc-400">Ticket #{ticket.ticketNumber}</span>
                      </div>
                    </div>

                    <p className="text-zinc-300 font-sans leading-relaxed">
                      This ticket will be marked as <strong>Closed & Archived</strong> and stored in the permanent Archive Repository. It will be moved out of the active tickets queue.
                    </p>

                    <div>
                      <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1">
                        Optional Archive Remarks / Filing Code
                      </label>
                      <input
                        type="text"
                        value={archiveRemarks}
                        onChange={e => setArchiveRemarks(e.target.value)}
                        placeholder="e.g. Field repair verified, spares inventory updated."
                        className="w-full bg-[#06080d] border border-[#1e2a3a] text-zinc-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="flex justify-end space-x-2 pt-2 border-t border-[#1f283a]">
                      <button
                        onClick={() => setIsArchivePromptOpen(false)}
                        className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmArchive}
                        className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded cursor-pointer shadow-md shadow-amber-900/40"
                      >
                        Confirm Close & Archive
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: OVERVIEW & EMAIL DISPATCH */}
          {activeTab === 'overview' && (
            <div className="space-y-4 text-xs font-mono">
              <div className="bg-[#070a10] p-4 rounded-xl border border-[#172232] space-y-2">
                <div className="flex justify-between py-1 border-b border-[#141d2c]">
                  <span className="text-zinc-400">Target Station:</span>
                  <span className="text-white font-bold">{ticket.stationName} ({ticket.region || 'Regional Network'})</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#141d2c]">
                  <span className="text-zinc-400">Assigned Technician / Lead:</span>
                  <span className="text-blue-300 font-bold">{ticket.assignedTo}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#141d2c]">
                  <span className="text-zinc-400">Created By & Timestamp:</span>
                  <span className="text-zinc-300">{ticket.createdBy} ({ticket.createdAt})</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#141d2c]">
                  <span className="text-zinc-400">Priority Level:</span>
                  <span className="text-amber-400 font-bold">{ticket.priority || 'Medium'}</span>
                </div>
                <div className="flex justify-between py-1 items-center">
                  <span className="text-zinc-400">Current Issue Status:</span>
                  <select
                    value={ticket.status}
                    onChange={e => onUpdateStatus(ticket.ticketNumber, e.target.value)}
                    className="px-2.5 py-1 bg-[#090e17] border border-[#1e2a3a] text-zinc-200 rounded font-mono text-xs focus:outline-none"
                  >
                    <option value="No communication">No communication</option>
                    <option value="Warning">Warning</option>
                    <option value="critical">Critical</option>
                    <option value="sensor issue">Sensor issue</option>
                    <option value="firmware issue">Firmware issue</option>
                    <option value="Problem Solved (Awaiting Ack)">Problem Solved (Awaiting Ack)</option>
                    <option value="Closed & Archived">Closed & Archived</option>
                    <option value="others">Others</option>
                  </select>
                </div>
              </div>

              <div>
                <span className="text-zinc-500 font-bold uppercase text-[10px] block mb-1">Issue Summary</span>
                <p className="text-zinc-100 font-semibold bg-[#070a10] p-3 rounded-lg border border-[#172232]">
                  {ticket.summary}
                </p>
              </div>

              <div>
                <span className="text-zinc-500 font-bold uppercase text-[10px] block mb-1">Detailed Description</span>
                <p className="text-zinc-300 font-sans leading-relaxed bg-[#070a10] p-3 rounded-lg border border-[#172232]">
                  {ticket.description}
                </p>
              </div>

              {/* Direct Email Notification Dispatch Box */}
              <div className="bg-[#070c14] p-3.5 rounded-xl border border-blue-500/30 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-200 font-bold flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-blue-400" />
                    Dispatch Ticket Direct Clearance Link
                  </span>
                  <span className="text-[10px] text-blue-400 font-mono">Assigned Email Notification</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="email"
                    defaultValue={currentUser?.email || `${ticket.assignedTo.toLowerCase()}@met.gov.np`}
                    id={`ticket-overview-email-${ticket.ticketNumber}`}
                    className="flex-1 px-3 py-2 bg-[#05080f] border border-[#1e293b] rounded-lg text-zinc-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
                    placeholder="user@met.gov.np"
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById(`ticket-overview-email-${ticket.ticketNumber}`) as HTMLInputElement;
                      const emailVal = input && input.value ? input.value : currentUser?.email || `${ticket.assignedTo.toLowerCase()}@met.gov.np`;
                      onSendEmail(
                        emailVal,
                        'ticket',
                        ticket.ticketNumber,
                        ticket.summary,
                        ticket.assignedTo,
                        ticket.stationName,
                        ticket.priority || 'Medium'
                      );
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer shrink-0 shadow-md shadow-blue-900/30"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Send Link</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-[#090d14] border-t border-[#1b2636] px-5 py-3 flex items-center justify-between shrink-0">
          <div className="text-[11px] font-mono text-zinc-500">
            METIS Metrology Service Ticket #{ticket.ticketNumber}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition font-mono text-xs font-bold cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
