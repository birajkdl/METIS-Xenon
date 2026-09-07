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
  regionalOfficeId?: number | null;
  simNumber?: string | null;
  status?: string | null;
  wigosSeries?: string | null;
  wigosIssuer?: string | null;
  wigosIssueNum?: string | null;
  wigosLocalId?: string | null;
  wigosId?: string | null;
  wmoId?: string | null;
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
  calibrationDueDate?: string | null;
  deploymentInfo?: string | null;
  assignedOffice?: string | null;
  responsiblePersonnel?: string | null;
  conditionStatus?: string | null;
  remarks?: string | null;
  quickNote?: string | null;
  assignedCalibrator?: string | null;
  calibrationDeviceUsed?: string | null;
  photos?: string | null;
  documents?: string | null;
  approvalStatus?: string | null;
  wmoSitingClass?: string | null;
  wmoChecklist?: string | null;
  regionalOfficeId?: number | null;
  coefficients?: SensorCoefficients | null;
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

export interface CalibrationDevice {
  deviceId: number;
  deviceName: string;
  deviceType: string;
  serialNumber: string;
  lastCalibrated: string | null;
  calibrationDue: string | null;
  accuracyClass: string | null;
  status: string; // 'Active', 'In Calibration', 'Maintenance', 'Retired'
  assignedLab: string;
  createdAt: string;
}

export interface CalibrationTestPoint {
  refValue: number;
  sensorValue: number;
  error: number;
  uncertainty?: number;
}

export interface UncertaintyBudget {
  repeatability: number;
  referenceUncertainty: number;
  resolutionError: number;
  combinedUncertainty: number;
  expandedUncertainty: number;
  coverageFactor: number; // usually k=2
}

export interface CalibrationAuditEvent {
  timestamp: string;
  user: string;
  action: string;
  stage: string;
  details: string;
}

export interface CalibrationJob {
  jobId: number;
  sensorId: number;
  status: string; // 'Pending', 'In Progress', 'Technical Review', 'Signed Off', 'Cancelled'
  currentStage: string; // 'Plan', 'ReferenceSelection', 'EnvironmentCheck', 'Measurements', 'Uncertainty', 'Conformity', 'Review', 'SignOff'
  
  // Plan Stage
  plannedDate: string | null;
  plannedCalibrator: string | null;
  calibrationProcedure: string | null;
  
  // Reference Standard
  deviceId: number | null;
  
  // Environment Check
  ambientTemperature: number | null;
  ambientHumidity: number | null;
  ambientPressure: number | null;
  environmentStatus: string | null;
  environmentCheckedBy: string | null;
  environmentCheckedAt: string | null;
  
  // Measurements
  measurements: string | null; // JSON parsed/unparsed: CalibrationTestPoint[]
  measuredBy: string | null;
  measuredAt: string | null;
  
  // Uncertainty
  uncertaintyBudget: string | null; // JSON parsed/unparsed: UncertaintyBudget
  uncertaintyCalculatedBy: string | null;
  uncertaintyCalculatedAt: string | null;
  
  // Conformity
  conformityResult: string | null; // 'Passed', 'Failed', 'Adjusted'
  conformityDecisionRule: string | null;
  conformityNotes: string | null;
  conformityEvaluatedBy: string | null;
  conformityEvaluatedAt: string | null;
  
  // Technical Review
  reviewerName: string | null;
  reviewComments: string | null;
  reviewedAt: string | null;
  
  // Authorized Sign-off
  signatoryName: string | null;
  signatoryDesignation: string | null;
  signedAt: string | null;
  eSignatureHash: string | null;
  
  // Audit Trail
  fullAuditTrail: string | null; // JSON parsed/unparsed: CalibrationAuditEvent[]
  createdAt: string;
  
  // Relational details mapped by API
  sensorName?: string;
  sensorType?: string;
  serialNumber?: string;
  manufacturer?: string;
  deviceName?: string;
  deviceSerialNumber?: string;
}

export interface SensorCoefficients {
  modelType: 'Linear' | 'Polynomial' | 'Multi-Point Curve';
  slope: number;
  offset: number;
  polyA?: number;
  polyB?: number;
  polyC?: number;
  multiplier?: number;
  unit?: string;
  equationFormula?: string;
  lastAdjustedDate?: string;
  adjustedBy?: string;
  notes?: string;
}

export interface InSituVerification {
  id: number;
  stationId: number;
  stationName: string;
  sensorId: number;
  sensorType: string;
  sensorSerialNumber: string;
  portableReferenceName: string;
  portableReferenceSerial: string;
  awsReading: number;
  referenceReading: number;
  unit: string;
  delta: number;
  errorPercentage: number;
  toleranceLimit: number;
  status: 'In Tolerance' | 'Out of Tolerance';
  stationStatus: string;
  ambientTemp?: number | null;
  ambientHumidity?: number | null;
  technicianName: string;
  verificationDate: string;
  notes?: string;
}

export interface SensorSwapPayload {
  stationId: number;
  stationName?: string;
  oldSensorId: number;
  newSpareSensorId: number;
  swapDate: string;
  reason: string;
  personnelInvolved: string;
  transferCertificates?: boolean;
  coefficients?: SensorCoefficients;
  notes?: string;
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

export interface MaintenanceTicket {
  ticketNumber: string; // 6-digit number, e.g. "100001"
  stationId: number;
  stationName: string;
  region?: string;
  status: 'No communication' | 'Warning' | 'critical' | 'sensor issue' | 'firmware issue' | 'others' | string;
  summary: string;
  description: string;
  assignedTo: string; // Username / Person name
  createdBy?: string;
  createdAt: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Emergency';
  workOrderId?: string | null; // Linked work order ID
}

export interface WorkOrder {
  workOrderId: string; // e.g. "WO-100001"
  workOrderTitle: string;
  ticketNumbers: string[]; // Assigned 6-digit ticket numbers
  assignedTeam: string; // Maintenance team / Lead
  scheduledDate: string;
  priority: 'Low' | 'Medium' | 'High' | 'Emergency';
  status: 'Draft' | 'Assigned' | 'In Progress' | 'Completed' | 'On Hold' | 'Cancelled';
  scopeOfWork: string;
  createdBy: string;
  createdAt: string;
  completedAt?: string | null;
  completionNotes?: string | null;
}

export interface StationHealth {
  healthId: number;
  stationId: number;
  lastReportedTime: string;
  batteryLevel: number; // percentage (0 - 100)
  signalStrength: string; // e.g. "-78 dBm (Good)"
  alertStatus: 'OK' | 'Warning' | 'Critical' | string;
  createdAt?: string;
  // Joined station details
  stationName?: string;
  region?: string;
  stationType?: string | null;
  batteryCurrentVoltage?: number | null;
  wigosLocalId?: string | null;
  wigosId?: string | null;
}

export interface Designation {
  id: number;
  title: string;
  code?: string | null;
  department?: string | null;
  description?: string | null;
  status: 'Active' | 'Inactive' | string;
  createdAt?: string;
}

export interface RegionalOffice {
  id: number;
  officeName: string;
  address?: string | null;
  phoneNumber?: string | null;
  emailId?: string | null;
  website?: string | null;
  createdAt?: string;
}



