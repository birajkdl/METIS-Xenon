import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Settings, 
  Database, 
  Server, 
  Bell, 
  Clock, 
  Send, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Sliders, 
  Search, 
  Save, 
  Layers,
  ChevronDown,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';

interface SMTPConfig {
  host: string;
  port: number;
  secure: string;
  username?: string;
  password?: string;
  fromEmail: string;
  fromName: string;
}

interface AlertSetting {
  id: number;
  alertType: string;
  interval: string;
  emailEnabled: string;
  smsEnabled: string;
  recipientEmails: string;
  updatedAt: string;
}

interface DeliveryLog {
  id: number;
  channel: string;
  recipient: string;
  subject: string;
  body: string;
  alertType: string;
  status: string;
  errorMessage?: string;
  sentAt: string;
}

interface NotificationsPanelProps {
  userRole: string | null;
}

export default function NotificationsPanel({ userRole }: NotificationsPanelProps) {
  const [activeTab, setActiveTab] = useState<'smtp' | 'intervals' | 'logs' | 'simulation'>('smtp');
  
  // States for server configs
  const [smtp, setSmtp] = useState<SMTPConfig>({
    host: 'smtp.gov.np',
    port: 587,
    secure: 'false',
    username: '',
    password: '',
    fromEmail: 'aws-alerts@gov.np',
    fromName: 'Meteorological Department AWS Alert System'
  });
  const [settings, setSettings] = useState<AlertSetting[]>([]);
  const [logs, setLogs] = useState<DeliveryLog[]>([]);

  // UI States
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Search state for logs
  const [searchLog, setSearchLog] = useState('');
  const [filterLogStatus, setFilterLogStatus] = useState<'all' | 'success' | 'failed'>('all');
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);

  // Simulation test state
  const [simAlertType, setSimAlertType] = useState('calibration_due');
  const [simRecipient, setSimRecipient] = useState('');
  const [simSubject, setSimSubject] = useState('');
  const [simBody, setSimBody] = useState('');

  // Fetch initial SMTP, settings and logs
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Get SMTP
      const smtpRes = await fetch('/api/notifications/smtp');
      if (smtpRes.ok) {
        const data = await smtpRes.json();
        setSmtp(data);
      }
      
      // 2. Get Settings
      const settingsRes = await fetch('/api/notifications/settings');
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data);
      }

      // 3. Get Logs
      const logsRes = await fetch('/api/notifications/logs');
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data);
      }
    } catch (err: any) {
      console.error("Failed to load notifications module data:", err);
      setErrorMsg("Failed to connect to notification telemetry endpoints.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveSMTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/notifications/smtp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smtp)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update SMTP Parameters");
      
      setSmtp(data);
      setSuccessMsg("Government SMTP secure gateways parameters saved and deployed successfully!");
      fetchData(); // reload logs to capture the system log
    } catch (err: any) {
      setErrorMsg(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInterval = async (id: number, updatedFields: Partial<AlertSetting>) => {
    setSuccessMsg('');
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch(`/api/notifications/settings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update notification setting");

      setSettings(prev => prev.map(s => s.id === id ? data : s));
      setSuccessMsg(`Interval configuration updated successfully!`);
    } catch (err: any) {
      setErrorMsg(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRunRemindersCheck = async () => {
    setSuccessMsg('');
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/notifications/run-reminders', {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to run monthly checks");

      setSuccessMsg(`Checklist executed. Reminders triggered: Calibration due(${data.calibrationsTriggered}), Warranty expiry(${data.warrantiesTriggered}), Low spare stocks(${data.lowInventoriesTriggered}).`);
      
      // Reload logs immediately to see the dispatched notifications
      const logsRes = await fetch('/api/notifications/logs');
      if (logsRes.ok) {
        const dataLogs = await logsRes.json();
        setLogs(dataLogs);
      }
    } catch (err: any) {
      setErrorMsg(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/notifications/simulate-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertType: simAlertType,
          customSubject: simSubject || undefined,
          customBody: simBody || undefined,
          recipient: simRecipient || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to dispatch simulated alert");

      if (data.success) {
        setSuccessMsg(`Simulation dispatched successfully! Delivered via ${data.deliveryChannel} (Log ID: #${data.loggedId})`);
      } else {
        setErrorMsg(`Simulation finished with issues: ${data.error || 'Check delivery logs for SMTP response details.'}`);
      }

      // Reload logs to see simulation entries
      const logsRes = await fetch('/api/notifications/logs');
      if (logsRes.ok) {
        const dataLogs = await logsRes.json();
        setLogs(dataLogs);
      }
    } catch (err: any) {
      setErrorMsg(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  // Helper descriptions for each alert type
  const getAlertDescription = (type: string) => {
    switch(type) {
      case 'calibration_due': return 'Monthly reminder list of sensors due for physical calibration checks in the next 30 days.';
      case 'warranty_expiry': return 'Monthly reminder for instruments whose supplier warranty expires in the next 30 days.';
      case 'transfer_approval': return 'Instant alert to sender & receiver when a hardware transfer is Approved or Rejected.';
      case 'deployment_confirmation': return 'Instant alert confirming successful site setup when a field worker deploys a sensor.';
      case 'damaged_sensor': return 'Instant red flag notification triggered whenever a sensor is cataloged as Damaged.';
      case 'low_inventory': return 'Monthly safety stock report triggered if spares for any sensor type drop below 2 units.';
      case 'password_reset': return 'Instant dispatch of secure OTP tokens & password reset authorization requests.';
      case 'user_activity': return 'Periodic log reporting administrative audit logs and privilege adjustments.';
      case 'system_notification': return 'Audit notices reporting core parameters modifications, database seeds, or SMTP shifts.';
      case 'push_notification': return 'Instant structural push notifications mimicking client browser websocket notifications.';
      default: return 'Automated system telemetry alert.';
    }
  };

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const query = searchLog.toLowerCase();
    const matchesSearch = 
      log.recipient.toLowerCase().includes(query) ||
      (log.subject && log.subject.toLowerCase().includes(query)) ||
      log.alertType.toLowerCase().includes(query) ||
      log.body.toLowerCase().includes(query);
    
    if (filterLogStatus === 'success') {
      return matchesSearch && log.status.startsWith('Success');
    }
    if (filterLogStatus === 'failed') {
      return matchesSearch && log.status === 'Failed';
    }
    return matchesSearch;
  });

  const isEditable = userRole === 'Super Administrator' || userRole === 'Head Office Admin/User';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-[#1f2937] dark:text-[#f3f4f6]" id="notifications-control-panel">
      
      {/* Page Title & Stats */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-[#cbd5e1] dark:border-[#27272a] pb-5 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Mail className="h-6 w-6 text-emerald-500" />
            <h1 className="text-2xl font-bold font-sans tracking-tight">Email Notifications & Alert Control</h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-sans">
            Configure secure government SMTP relay parameters, set monthly and instant telemetry alert intervals, and review audit delivery logs.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchData}
            className="p-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-md transition duration-200 text-zinc-600 dark:text-zinc-300 cursor-pointer"
            title="Refresh Notification Control Room Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={handleRunRemindersCheck}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-md transition duration-200 shadow-sm disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer uppercase tracking-wider"
          >
            <Clock className="h-4 w-4" />
            <span>Execute Monthly Reminders Scan</span>
          </button>
        </div>
      </div>

      {/* Alerts / Error and Success Banners */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-md text-xs font-medium flex items-start space-x-2">
          <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-md text-xs font-medium flex items-start space-x-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Quick Dashboard Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-[#0f0f12] border border-zinc-200 dark:border-[#1f1f23] rounded-lg shadow-xs">
          <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Secure SMTP Relay</p>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-lg font-bold font-mono text-blue-500">{smtp.host}</span>
            <span className="text-xs text-zinc-400">:{smtp.port}</span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">
            Mode: {smtp.secure === 'true' ? 'SSL/TLS (Implicit)' : 'STARTTLS (Explicit/Plain)'}
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-[#0f0f12] border border-zinc-200 dark:border-[#1f1f23] rounded-lg shadow-xs">
          <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Alert Configurations</p>
          <p className="text-2xl font-bold font-mono mt-2 text-zinc-800 dark:text-zinc-200">{settings.length}</p>
          <p className="text-[10px] text-zinc-500 mt-1">
            Active alert types monitored: {settings.filter(s => s.emailEnabled === 'true').length} Email, {settings.filter(s => s.smsEnabled === 'true').length} SMS
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-[#0f0f12] border border-zinc-200 dark:border-[#1f1f23] rounded-lg shadow-xs">
          <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Audit Delivery Logs</p>
          <p className="text-2xl font-bold font-mono mt-2 text-zinc-800 dark:text-zinc-200">{logs.length}</p>
          <p className="text-[10px] text-zinc-500 mt-1">
            Success Rate: {logs.length > 0 ? Math.round((logs.filter(l => l.status.startsWith('Success')).length / logs.length) * 100) : 100}%
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-[#0f0f12] border border-zinc-200 dark:border-[#1f1f23] rounded-lg shadow-xs">
          <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Government Relay Standard</p>
          <div className="flex items-center space-x-2 mt-2">
            <Server className="h-5 w-5 text-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wide">SECURE SSL/STARTTLS COMPLIANT</span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">
            Accepts official gov.np/military and corporate relays securely
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#cbd5e1] dark:border-[#27272a]">
        <nav className="flex space-x-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('smtp')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-all duration-150 cursor-pointer ${
              activeTab === 'smtp'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Server className="h-4 w-4" />
              <span>SMTP Relay Config</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('intervals')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-all duration-150 cursor-pointer ${
              activeTab === 'intervals'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Sliders className="h-4 w-4" />
              <span>Interval Rules & Channels</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-all duration-150 cursor-pointer ${
              activeTab === 'logs'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4" />
              <span>Delivery Logs & Audit ({filteredLogs.length})</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('simulation')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-all duration-150 cursor-pointer ${
              activeTab === 'simulation'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Send className="h-4 w-4" />
              <span>System Trigger Simulator</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Tab Panels */}
      <div className="mt-4">
        
        {/* TAB 1: SMTP Config */}
        {activeTab === 'smtp' && (
          <div className="bg-white dark:bg-[#0f0f12] border border-zinc-200 dark:border-[#1f1f23] rounded-lg p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-[#1f1f23] pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <Settings className="h-5 w-5 text-blue-500" />
                <h2 className="text-base font-bold">Secure SMTP Server Parameters</h2>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded uppercase tracking-wider">
                System Integration
              </span>
            </div>

            <form onSubmit={handleSaveSMTP} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">SMTP Host / Relay IP Address</label>
                  <input
                    type="text"
                    required
                    disabled={!isEditable}
                    value={smtp.host}
                    onChange={e => setSmtp({...smtp, host: e.target.value})}
                    placeholder="e.g. smtp.gov.np, mail.met.gov.np"
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <p className="text-[10px] text-zinc-400">Accepts government private relays, Office 365, or public relays.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">SMTP Port</label>
                  <input
                    type="number"
                    required
                    disabled={!isEditable}
                    value={smtp.port}
                    onChange={e => setSmtp({...smtp, port: parseInt(e.target.value) || 587})}
                    placeholder="587, 465, or 25"
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <p className="text-[10px] text-zinc-400">Common: 587 (STARTTLS), 465 (SSL/TLS implicit), 25 (Standard unencrypted).</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Encryption Protocol</label>
                  <select
                    disabled={!isEditable}
                    value={smtp.secure}
                    onChange={e => setSmtp({...smtp, secure: e.target.value})}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="false">STARTTLS / Opportunistic TLS (Port 587 / 25)</option>
                    <option value="true">Implicit SSL / Secure SMTPS (Port 465)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Authorized Relay Username</label>
                  <input
                    type="text"
                    disabled={!isEditable}
                    value={smtp.username || ''}
                    onChange={e => setSmtp({...smtp, username: e.target.value})}
                    placeholder="Enter email account username"
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Authorized Relay Password</label>
                  <input
                    type="password"
                    disabled={!isEditable}
                    value={smtp.password || ''}
                    onChange={e => setSmtp({...smtp, password: e.target.value})}
                    placeholder="••••••••••••••"
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <p className="text-[10px] text-zinc-400">Encrypted and secured. Leave empty if server permits anonymous relays.</p>
                </div>

                <div className="space-y-1 bg-blue-500/5 border border-blue-500/10 p-3 rounded-md flex flex-col justify-center">
                  <div className="flex items-start space-x-2">
                    <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400">Government Gateway Support</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Our integrated email module handles TLS certificates flexibly, allowing smooth operation even with governmental custom internal firewalls or self-signed secure relays.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Sender Address (From)</label>
                  <input
                    type="email"
                    required
                    disabled={!isEditable}
                    value={smtp.fromEmail}
                    onChange={e => setSmtp({...smtp, fromEmail: e.target.value})}
                    placeholder="aws-alerts@met.gov.np"
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Sender Display Name (From Name)</label>
                  <input
                    type="text"
                    required
                    disabled={!isEditable}
                    value={smtp.fromName}
                    onChange={e => setSmtp({...smtp, fromName: e.target.value})}
                    placeholder="e.g. Department of Meteorology Alert Terminal"
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {isEditable ? (
                <div className="flex justify-end pt-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-md transition duration-200 shadow-xs flex items-center space-x-2 cursor-pointer uppercase tracking-wider"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save SMTP Relay Configuration</span>
                  </button>
                </div>
              ) : (
                <p className="text-xs text-red-400 mt-2 font-mono">
                  * Read-only account: You must have administrative credentials to alter secure SMTP relays parameters.
                </p>
              )}
            </form>
          </div>
        )}

        {/* TAB 2: Alert Intervals & Settings */}
        {activeTab === 'intervals' && (
          <div className="bg-white dark:bg-[#0f0f12] border border-zinc-200 dark:border-[#1f1f23] rounded-lg p-6 space-y-4 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-100 dark:border-[#1f1f23] pb-3 mb-4 gap-2">
              <div>
                <h2 className="text-base font-bold flex items-center space-x-2">
                  <Sliders className="h-5 w-5 text-emerald-500" />
                  <span>Configurable Alert Intervals and Telemetry Handlers</span>
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Manage email dispatch frequencies and configure phone number delivery log parameters for future SMS expansion.
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded uppercase tracking-wider">
                10 Alerts Monitored
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[10px] uppercase text-zinc-400 font-bold tracking-wider">
                    <th className="py-3 px-3">Alert Type</th>
                    <th className="py-3 px-3">Purpose & Logic Trigger</th>
                    <th className="py-3 px-3">Interval Frequency</th>
                    <th className="py-3 px-3">Target Recipient Email Group</th>
                    <th className="py-3 px-3">Email Channel</th>
                    <th className="py-3 px-3">SMS Channel</th>
                    {isEditable && <th className="py-3 px-3 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                  {settings.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-all">
                      <td className="py-3 px-3 font-mono font-bold text-zinc-800 dark:text-zinc-200">
                        {item.alertType}
                      </td>
                      <td className="py-3 px-3 text-[11px] text-zinc-500 dark:text-zinc-400 max-w-xs">
                        {getAlertDescription(item.alertType)}
                      </td>
                      <td className="py-3 px-3">
                        <select
                          disabled={!isEditable}
                          value={item.interval}
                          onChange={(e) => handleUpdateInterval(item.id, { interval: e.target.value })}
                          className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-1.5 py-1 text-[11px] font-sans text-zinc-800 dark:text-zinc-200"
                        >
                          <option value="instantly">Instantly</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly Reminders</option>
                          <option value="disabled">Disabled</option>
                        </select>
                      </td>
                      <td className="py-3 px-3 font-mono text-[10px]">
                        <input
                          type="text"
                          disabled={!isEditable}
                          defaultValue={item.recipientEmails}
                          onBlur={(e) => handleUpdateInterval(item.id, { recipientEmails: e.target.value })}
                          className="bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800 px-1.5 py-1 rounded w-full border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <button
                          disabled={!isEditable}
                          onClick={() => handleUpdateInterval(item.id, { emailEnabled: item.emailEnabled === 'true' ? 'false' : 'true' })}
                          className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border transition cursor-pointer ${
                            item.emailEnabled === 'true'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                              : 'bg-zinc-500/10 border-transparent text-zinc-500 line-through'
                          }`}
                        >
                          {item.emailEnabled === 'true' ? 'Active' : 'Muted'}
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        <button
                          disabled={!isEditable}
                          onClick={() => handleUpdateInterval(item.id, { smsEnabled: item.smsEnabled === 'true' ? 'false' : 'true' })}
                          className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border transition cursor-pointer ${
                            item.smsEnabled === 'true'
                              ? 'bg-blue-500/10 border-blue-500/20 text-blue-500 animate-pulse'
                              : 'bg-zinc-500/10 border-transparent text-zinc-500'
                          }`}
                          title={item.smsEnabled === 'true' ? 'SMS support is active in dispatch loop' : 'SMS channel muted'}
                        >
                          {item.smsEnabled === 'true' ? 'Enabled (Sim)' : 'SMS Ready'}
                        </button>
                      </td>
                      {isEditable && (
                        <td className="py-3 px-3 text-right text-[10px] text-zinc-400 italic">
                          Auto-saved
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-md text-xs text-zinc-500 dark:text-zinc-400 mt-4 space-y-1">
              <p className="font-bold text-emerald-600 dark:text-emerald-400">💡 SMS Architecture Support Verified</p>
              <p>
                Our notification dispatch core is structurally wired for dual delivery channels (Email and SMS). If SMS is enabled, the system automatically logs Simulated gateway delivery to recipient phone contacts, which provides a drop-in integration point for cellular SMS services (e.g., Twilio or government cellular SMS networks) without further architectural rewrites.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: Live Delivery Logs */}
        {activeTab === 'logs' && (
          <div className="bg-white dark:bg-[#0f0f12] border border-zinc-200 dark:border-[#1f1f23] rounded-lg p-6 space-y-4 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-100 dark:border-[#1f1f23] pb-3 mb-4 gap-2">
              <div>
                <h2 className="text-base font-bold flex items-center space-x-2">
                  <Database className="h-5 w-5 text-blue-500" />
                  <span>Integrated Delivery and SMTP Gateway Audit Logs</span>
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Real-time reporting of telemetry messages dispatched across Email and SMS channels.
                </p>
              </div>
              
              {/* Filter controls */}
              <div className="flex items-center space-x-2">
                <select
                  value={filterLogStatus}
                  onChange={(e) => setFilterLogStatus(e.target.value as any)}
                  className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1 text-xs text-zinc-800 dark:text-zinc-200"
                >
                  <option value="all">All Statuses</option>
                  <option value="success">Success Only</option>
                  <option value="failed">Failed Only</option>
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                value={searchLog}
                onChange={(e) => setSearchLog(e.target.value)}
                placeholder="Search logs by recipient, subject, text, alert type..."
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded pl-10 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {filteredLogs.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 font-sans text-xs">
                  No communication dispatch logs match the query parameters.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[10px] uppercase text-zinc-400 font-bold tracking-wider">
                      <th className="py-3 px-3 w-10">ID</th>
                      <th className="py-3 px-3">Sent At</th>
                      <th className="py-3 px-3">Channel</th>
                      <th className="py-3 px-3">Alert Type</th>
                      <th className="py-3 px-3">Recipient Address</th>
                      <th className="py-3 px-3">Subject / Alert Context</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Report</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs font-sans">
                    {filteredLogs.map((log) => {
                      const isSelected = selectedLogId === log.id;
                      const isSuccess = log.status.startsWith('Success');
                      return (
                        <React.Fragment key={log.id}>
                          <tr className={`hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-all ${isSelected ? 'bg-zinc-50/70 dark:bg-zinc-900/70' : ''}`}>
                            <td className="py-3 px-3 font-mono font-bold text-zinc-400 text-[11px]">
                              #{log.id}
                            </td>
                            <td className="py-3 px-3 font-mono text-zinc-400 text-[10px]">
                              {new Date(log.sentAt).toLocaleString()}
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded-sm font-bold text-[9px] uppercase border ${
                                log.channel === 'Email' ? 'bg-emerald-500/10 border-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 border-blue-500/10 text-blue-500'
                              }`}>
                                {log.channel}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-[10px] text-zinc-800 dark:text-zinc-200">
                              {log.alertType}
                            </td>
                            <td className="py-3 px-3 font-mono text-[10px] truncate max-w-[140px]" title={log.recipient}>
                              {log.recipient}
                            </td>
                            <td className="py-3 px-3 font-bold truncate max-w-xs text-zinc-700 dark:text-zinc-300">
                              {log.subject || '(SMS Notification)'}
                            </td>
                            <td className="py-3 px-3">
                              <span className={`flex items-center space-x-1 font-semibold text-[10px] ${
                                isSuccess ? 'text-emerald-500' : 'text-red-500'
                              }`}>
                                {isSuccess ? (
                                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 shrink-0" />
                                )}
                                <span>{log.status}</span>
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => setSelectedLogId(isSelected ? null : log.id)}
                                className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-[10px] font-bold rounded uppercase cursor-pointer"
                              >
                                {isSelected ? 'Close' : 'View'}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded content view */}
                          {isSelected && (
                            <tr>
                              <td colSpan={8} className="py-4 px-6 bg-zinc-50 dark:bg-[#08080a] border-t border-b border-zinc-100 dark:border-zinc-800">
                                <motion.div 
                                  initial={{ opacity: 0, y: -5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="space-y-3"
                                >
                                  <div>
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Email Headers / Technical Context</p>
                                    <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400 mt-1">
                                      <span className="font-bold">Recipient:</span> {log.recipient} | <span className="font-bold">Subject:</span> {log.subject || 'N/A'}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Message Payload / Alert Body</p>
                                    <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 p-4 rounded text-xs text-zinc-700 dark:text-zinc-300 font-sans mt-1 whitespace-pre-wrap">
                                      {log.body}
                                    </div>
                                  </div>

                                  {log.errorMessage && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded">
                                      <p className="text-[10px] font-bold text-red-500 uppercase tracking-wide">SMTP Remote Error Message</p>
                                      <p className="text-xs font-mono text-red-600 dark:text-red-400 mt-1">{log.errorMessage}</p>
                                    </div>
                                  )}
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: Simulation Trigger Controls */}
        {activeTab === 'simulation' && (
          <div className="bg-white dark:bg-[#0f0f12] border border-zinc-200 dark:border-[#1f1f23] rounded-lg p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-[#1f1f23] pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <Send className="h-5 w-5 text-emerald-500 animate-pulse" />
                <h2 className="text-base font-bold">Manual Trigger Simulation Center</h2>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-purple-500/10 text-purple-500 border border-purple-500/20 rounded uppercase tracking-wider">
                Ad-hoc Dispatches
              </span>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-sans max-w-3xl">
              Use this sandbox simulator to manually trigger any of the ten supported alerts instantly. This tests SMTP connection stability, STARTTLS ports validation, and recipients delivery parameters without having to trigger hardware incidents.
            </p>

            <form onSubmit={handleSimulateAlert} className="space-y-4 max-w-3xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Select Alert Type to Simulate</label>
                  <select
                    value={simAlertType}
                    onChange={e => setSimAlertType(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="calibration_due">Calibration Due Monthly Reminder</option>
                    <option value="warranty_expiry">Warranty Expiry Monthly Reminder</option>
                    <option value="transfer_approval">Transfer Approval Update</option>
                    <option value="deployment_confirmation">Deployment Confirmation Dispatch</option>
                    <option value="damaged_sensor">Damaged Sensor Red-Flag Alert</option>
                    <option value="low_inventory">Low Spare Stock Alert</option>
                    <option value="password_reset">Password Reset Request Code</option>
                    <option value="user_activity">User Account Status Change Notice</option>
                    <option value="system_notification">System Parameters Audit Notice</option>
                    <option value="push_notification">Instant Simulated Push Notification</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Target Tester Email Recipient</label>
                  <input
                    type="text"
                    value={simRecipient}
                    onChange={e => setSimRecipient(e.target.value)}
                    placeholder="e.g. tester@met.gov.np (Leave empty for default groups)"
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <p className="text-[10px] text-zinc-400">Default settings groups will still be notified if this is empty.</p>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Custom Alert Subject Override (Optional)</label>
                  <input
                    type="text"
                    value={simSubject}
                    onChange={e => setSimSubject(e.target.value)}
                    placeholder="Enter custom subject to test SMTP delivery text strings"
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Custom Alert Body Override (Optional)</label>
                  <textarea
                    rows={4}
                    value={simBody}
                    onChange={e => setSimBody(e.target.value)}
                    placeholder="Enter custom multiline body content..."
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-md transition duration-200 shadow-xs flex items-center space-x-2 cursor-pointer uppercase tracking-wider"
                >
                  <Send className="h-4 w-4" />
                  <span>Dispatch Simulated Test Alert</span>
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
      
    </div>
  );
}
