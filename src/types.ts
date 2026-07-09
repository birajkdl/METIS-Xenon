export interface WeatherStation {
  stationId: number;
  stationName: string;
  region: string;
  latitude: number;
  longitude: number;
  batteryVoltageType?: string | null;
  batteryCurrentVoltage?: number | null;
  stationType?: string | null;
  createdAt: string;
  sensorCount?: number;
  activeCount?: number;
}

export interface Sensor {
  sensorId: number;
  sensorType: string;
  manufacturer: string;
  status: string; // "Active", "In Calibration", "Maintenance", "Retired"
  stationId: number | null;
  createdAt: string;
  stationName?: string;
  region?: string;
  statusLog?: string | null;
  dismissedAlert?: string | null;
  lastCalibration?: Calibration | null;
  sensorName?: string | null;
  barcode?: string | null;
  modelNumber?: string | null;
  serialNumber?: string | null;
  procurementDate?: string | null;
  supplierDetails?: string | null;
  invoiceReference?: string | null;
  warrantyStartDate?: string | null;
  warrantyEndDate?: string | null;
  calibrationInterval?: string | null;
  calibrationDetails?: string | null;
  deploymentInfo?: string | null;
  assignedOffice?: string | null;
  responsiblePersonnel?: string | null;
  conditionStatus?: string | null;
  remarks?: string | null;
  photos?: string | null;
  documents?: string | null;
  approvalStatus?: string | null;
}

export interface Calibration {
  calibrationId: number;
  sensorId: number;
  calibrationDate: string;
  technicianName: string;
  result: string; // "Passed", "Failed", "Adjusted"
  notes: string | null;
  nextDueDate: string;
  createdAt: string;
  sensorType?: string;
  manufacturer?: string;
  stationName?: string;
}

export interface DashboardStats {
  totalStations: number;
  totalSensors: number;
  statusCounts: {
    Active: number;
    "In Calibration": number;
    Maintenance: number;
    Retired: number;
    [key: string]: number;
  };
  typeCounts: Record<string, number>;
  recentCalibrations: Calibration[];
  urgentSensors: Array<Sensor & { lastCalibrationDate: string; nextCalibrationDate: string }>;
  preAlertSensors?: Array<Sensor & { lastCalibrationDate: string; nextCalibrationDate: string; daysRemaining: number; stationName: string }>;
  batteryAlerts?: Array<{ stationId: number; stationName: string; region: string; batteryVoltageType: string; batteryCurrentVoltage: number; alertMessage: string }>;
}

export interface CustomStatus {
  id: number;
  statusName: string;
  color: string;
  description: string | null;
  isConsumableOnly: string; // 'true' or 'false'
  createdAt: string;
}

export interface SensorDeployment {
  deploymentId: number;
  sensorId: number;
  stationId: number;
  deploymentDate: string;
  retrievalDate: string | null;
  personnelInvolved: string;
  installationNotes: string | null;
  status: string; // 'Active' or 'Retrieved'
  createdAt: string;

  // Joined fields
  sensorName?: string;
  sensorType?: string;
  serialNumber?: string;
  stationName?: string;
  region?: string;
}

export interface SensorReplacement {
  replacementId: number;
  stationId: number;
  oldSensorId: number;
  newSensorId: number;
  replacementDate: string;
  reason: string;
  personnelInvolved: string;
  notes: string | null;
  createdAt: string;

  // Joined fields
  stationName?: string;
  region?: string;
  oldSensorName?: string;
  oldSensorType?: string;
  oldSerialNumber?: string;
  newSensorName?: string;
  newSensorType?: string;
  newSerialNumber?: string;
}

export interface SensorTransfer {
  transferId: number;
  sensorId: number;
  transferType: 'Office to Office' | 'Office to Station deployment' | 'Station to Office return' | 'Regional to Head Office transfer';
  durationType: 'Permanent' | 'Temporary';
  sender: string;
  receiver: string;
  transferDate: string;
  personnelInvolved: string;
  conditionDuringTransfer: string;
  approvalStatus: 'Pending' | 'Approved' | 'Rejected';
  transferRemarks: string | null;
  createdAt: string;

  // Joined fields
  sensorName?: string;
  sensorType?: string;
  serialNumber?: string;
}

export interface AppDocument {
  id: number;
  title: string;
  category: 'Manuals' | 'SOP' | 'Wiring Diagram' | 'Calibration Certificate' | 'Other documents';
  fileName: string;
  fileType: string | null;
  fileSize: string | null;
  fileContent: string | null;
  uploadedBy: string | null;
  stationId: number | null;
  sensorId: number | null;
  sensorModel?: string | null;
  serialNumber?: string | null;
  uploadedAt: string;
}

