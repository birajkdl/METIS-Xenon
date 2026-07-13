import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, doublePrecision, boolean } from 'drizzle-orm/pg-core';

// 1. Users Table (for Firebase Auth users)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  phoneNumber: text('phone_number'), // Mandatory during signup
  role: text('role').default('Read-only/Audit User'), // Default role
  assignedStationId: integer('assigned_station_id'), // Optional assigned station for "Station User"
  username: text('username'),
  designation: text('designation'),
  office: text('office'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 1.5. Regional Offices Table
export const regionalOffices = pgTable('regional_offices', {
  id: serial('id').primaryKey(),
  officeName: text('office_name').notNull().unique(),
  address: text('address'),
  phoneNumber: text('phone_number'),
  emailId: text('email_id'),
  website: text('website'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Weather Stations Table
export const weatherStations = pgTable('weather_stations', {
  stationId: serial('station_id').primaryKey(),
  stationName: text('station_name').notNull(),
  region: text('region').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  batteryVoltageType: text('battery_voltage_type'),
  batteryCurrentVoltage: doublePrecision('battery_current_voltage'),
  stationType: text('station_type'),
  regionalOfficeId: integer('regional_office_id').references(() => regionalOffices.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
});

// 3. Sensors Inventory Table
export const sensorsInventory = pgTable('sensors_inventory', {
  sensorId: serial('sensor_id').primaryKey(),
  sensorType: text('sensor_type').notNull(), // e.g. "Thermometer", "Barometer", "Anemometer"
  manufacturer: text('manufacturer').notNull(),
  status: text('status').notNull(), // e.g. "Active", "In Calibration", "Maintenance", "Retired"
  stationId: integer('station_id').references(() => weatherStations.stationId, { onDelete: 'set null' }),
  regionalOfficeId: integer('regional_office_id').references(() => regionalOffices.id, { onDelete: 'set null' }),
  approvalStatus: text('approval_status').default('Approved'), // 'Pending Approval', 'Approved', 'Rejected'
  statusLog: text('status_log'), // Store recent status change history
  dismissedAlert: text('dismissed_alert').default('false'), // 'true' or 'false'
  sensorName: text('sensor_name'),
  barcode: text('barcode'),
  modelNumber: text('model_number'),
  serialNumber: text('serial_number'),
  procurementDate: text('procurement_date'),
  supplierDetails: text('supplier_details'),
  invoiceReference: text('invoice_reference'),
  warrantyStartDate: text('warranty_start_date'),
  warrantyEndDate: text('warranty_end_date'),
  calibrationInterval: text('calibration_interval'),
  calibrationDetails: text('calibration_details'),
  deploymentInfo: text('deployment_info'),
  assignedOffice: text('assigned_office'),
  responsiblePersonnel: text('responsible_personnel'),
  conditionStatus: text('condition_status'),
  remarks: text('remarks'),
  quickNote: text('quick_note'),
  assignedCalibrator: text('assigned_calibrator'), // Assigned calibrator/technician name when in calibration
  calibrationDeviceUsed: text('calibration_device_used'), // Name or reference of standard equipment used
  photos: text('photos'), // Comma-separated or JSON list of photos/URLs
  documents: text('documents'), // Comma-separated or JSON list of documents/URLs
  wmoSitingClass: text('wmo_siting_class'), // e.g., "Class 1", "Class 2", etc.
  wmoChecklist: text('wmo_checklist'), // JSON string representing WMO siting classification checklist details
  createdAt: timestamp('created_at').defaultNow(),
});

// 4. Calibration Records Table (Rich feature for Calibration Management)
export const calibrations = pgTable('calibrations', {
  calibrationId: serial('calibration_id').primaryKey(),
  sensorId: integer('sensor_id')
    .references(() => sensorsInventory.sensorId, { onDelete: 'cascade' })
    .notNull(),
  calibrationDate: text('calibration_date').notNull(), // YYYY-MM-DD
  technicianName: text('technician_name').notNull(),
  result: text('result').notNull(), // Passed, Failed, Adjusted
  notes: text('notes'),
  nextDueDate: text('next_due_date').notNull(), // YYYY-MM-DD
  createdAt: timestamp('created_at').defaultNow(),
});

// 5. Custom Statuses Table (For configurable status tracking)
export const customStatuses = pgTable('custom_statuses', {
  id: serial('id').primaryKey(),
  statusName: text('status_name').notNull().unique(),
  color: text('color').default('#3b82f6'), // Tailwind / CSS hex color
  description: text('description'),
  isConsumableOnly: text('is_consumable_only').default('false'), // 'true' or 'false'
  createdAt: timestamp('created_at').defaultNow(),
});

// 6. Sensor Deployments Table
export const sensorDeployments = pgTable('sensor_deployments', {
  deploymentId: serial('deployment_id').primaryKey(),
  sensorId: integer('sensor_id')
    .references(() => sensorsInventory.sensorId, { onDelete: 'cascade' })
    .notNull(),
  stationId: integer('station_id')
    .references(() => weatherStations.stationId, { onDelete: 'cascade' })
    .notNull(),
  deploymentDate: text('deployment_date').notNull(), // YYYY-MM-DD
  retrievalDate: text('retrieval_date'), // YYYY-MM-DD
  personnelInvolved: text('personnel_involved').notNull(),
  installationNotes: text('installation_notes'),
  status: text('status').default('Active'), // 'Active' or 'Retrieved'
  createdAt: timestamp('created_at').defaultNow(),
});

// 7. Sensor Replacements Table
export const sensorReplacements = pgTable('sensor_replacements', {
  replacementId: serial('replacement_id').primaryKey(),
  stationId: integer('station_id')
    .references(() => weatherStations.stationId, { onDelete: 'cascade' })
    .notNull(),
  oldSensorId: integer('old_sensor_id')
    .references(() => sensorsInventory.sensorId, { onDelete: 'cascade' })
    .notNull(),
  newSensorId: integer('new_sensor_id')
    .references(() => sensorsInventory.sensorId, { onDelete: 'cascade' })
    .notNull(),
  replacementDate: text('replacement_date').notNull(), // YYYY-MM-DD
  reason: text('reason').notNull(),
  personnelInvolved: text('personnel_involved').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 8. Sensor Transfers Table
export const sensorTransfers = pgTable('sensor_transfers', {
  transferId: serial('transfer_id').primaryKey(),
  sensorId: integer('sensor_id')
    .references(() => sensorsInventory.sensorId, { onDelete: 'cascade' })
    .notNull(),
  transferType: text('transfer_type').notNull(), // 'Office to Office', 'Office to Station', 'Station to Office', 'Regional to Head Office'
  durationType: text('duration_type').notNull(), // 'Permanent', 'Temporary'
  sender: text('sender').notNull(),
  receiver: text('receiver').notNull(),
  transferDate: text('transfer_date').notNull(), // YYYY-MM-DD
  personnelInvolved: text('personnel_involved').notNull(),
  conditionDuringTransfer: text('condition_during_transfer').notNull(),
  approvalStatus: text('approval_status').default('Pending'), // 'Pending', 'Approved', 'Rejected'
  transferRemarks: text('transfer_remarks'),
  createdAt: timestamp('created_at').defaultNow(),
});

// --- Relations ---

export const usersRelations = relations(users, () => ({}));

export const weatherStationsRelations = relations(weatherStations, ({ many }) => ({
  sensors: many(sensorsInventory),
  deployments: many(sensorDeployments),
  replacements: many(sensorReplacements),
}));

export const sensorsInventoryRelations = relations(sensorsInventory, ({ one, many }) => ({
  station: one(weatherStations, {
    fields: [sensorsInventory.stationId],
    references: [weatherStations.stationId],
  }),
  calibrations: many(calibrations),
  deployments: many(sensorDeployments),
  transfers: many(sensorTransfers),
}));

export const calibrationsRelations = relations(calibrations, ({ one }) => ({
  sensor: one(sensorsInventory, {
    fields: [calibrations.sensorId],
    references: [sensorsInventory.sensorId],
  }),
}));

export const sensorDeploymentsRelations = relations(sensorDeployments, ({ one }) => ({
  sensor: one(sensorsInventory, {
    fields: [sensorDeployments.sensorId],
    references: [sensorsInventory.sensorId],
  }),
  station: one(weatherStations, {
    fields: [sensorDeployments.stationId],
    references: [weatherStations.stationId],
  }),
}));

export const sensorReplacementsRelations = relations(sensorReplacements, ({ one }) => ({
  station: one(weatherStations, {
    fields: [sensorReplacements.stationId],
    references: [weatherStations.stationId],
  }),
  oldSensor: one(sensorsInventory, {
    fields: [sensorReplacements.oldSensorId],
    references: [sensorsInventory.sensorId],
  }),
  newSensor: one(sensorsInventory, {
    fields: [sensorReplacements.newSensorId],
    references: [sensorsInventory.sensorId],
  }),
}));

export const sensorTransfersRelations = relations(sensorTransfers, ({ one }) => ({
  sensor: one(sensorsInventory, {
    fields: [sensorTransfers.sensorId],
    references: [sensorsInventory.sensorId],
  }),
}));

// 9. Custom Roles Table
export const customRoles = pgTable('custom_roles', {
  id: serial('id').primaryKey(),
  roleName: text('role_name').notNull().unique(),
  description: text('description'),
  readPermission: boolean('read_permission').default(true).notNull(),
  writePermission: boolean('write_permission').default(false).notNull(),
  editPermission: boolean('edit_permission').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 10. SMTP Configuration Table
export const smtpConfig = pgTable('smtp_config', {
  id: serial('id').primaryKey(),
  host: text('host').notNull().default('smtp.example.gov'),
  port: integer('port').notNull().default(587),
  secure: text('secure').notNull().default('false'), // 'true' for SSL/TLS, 'false' for STARTTLS/plain
  username: text('username'),
  password: text('password'),
  fromEmail: text('from_email').notNull().default('no-reply@met.gov.np'),
  fromName: text('from_name').notNull().default('Meteorology Department AWS Alert System'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 11. Notification Alert Settings / Configurable Intervals Table
export const notificationSettings = pgTable('notification_settings', {
  id: serial('id').primaryKey(),
  alertType: text('alert_type').notNull().unique(), // e.g. 'calibration_due', 'warranty_expiry', 'transfer_approval', etc.
  interval: text('interval').notNull().default('monthly'), // 'instantly', 'daily', 'weekly', 'monthly', 'disabled'
  emailEnabled: text('email_enabled').notNull().default('true'), // 'true' or 'false'
  smsEnabled: text('sms_enabled').notNull().default('false'), // For future SMS support
  recipientEmails: text('recipient_emails').notNull().default('admin@met.gov.np'), // Comma-separated recipient emails
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 12. Notification and Communication Delivery Logs Table
export const deliveryLogs = pgTable('delivery_logs', {
  id: serial('id').primaryKey(),
  channel: text('channel').notNull().default('Email'), // 'Email' or 'SMS' (for future proofing)
  recipient: text('recipient').notNull(), // Email address or phone number
  subject: text('subject'),
  body: text('body').notNull(),
  alertType: text('alert_type').notNull(),
  status: text('status').notNull(), // 'Success', 'Failed'
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at').defaultNow(),
});

// 13. Audit Trails and Activity Logs Table
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  action: text('action').notNull(), // e.g. 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'INVENTORY_CREATE', 'INVENTORY_UPDATE', 'INVENTORY_DELETE', 'TRANSFER_APPROVE', 'TRANSFER_REJECT', 'CALIBRATION_UPDATE', 'ARCHIVE_DELETE_RECORD'
  actorEmail: text('actor_email').notNull().default('System'),
  actorRole: text('actor_role'),
  details: text('details').notNull(),
  ipAddress: text('ip_address'),
  status: text('status').notNull().default('Success'), // 'Success' or 'Failed'
  createdAt: timestamp('created_at').defaultNow(),
});

// 14. Suppliers and Manufacturers Table
export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code'), // unique supplier code, e.g. "SUP-012"
  contactName: text('contact_name'),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  website: text('website'),
  status: text('status').notNull().default('Active'), // 'Active', 'Inactive', 'Under Review'
  supplierType: text('supplier_type').notNull().default('Supplier'), // 'Supplier', 'Manufacturer', 'Both'
  supplyCategories: text('supply_categories'), // e.g., 'Anemometers, Barometers, Solar Radiation, Spare Parts'
  performanceRating: doublePrecision('performance_rating').default(0.0),
  qualityRating: doublePrecision('quality_rating').default(0.0),
  deliveryPerformance: doublePrecision('delivery_performance').default(0.0),
  historyOfSupply: text('history_of_supply'), // JSON text representing supply history items
  createdAt: timestamp('created_at').defaultNow(),
});

// 15. Price Lists, Quotations, and Agreements Table
export const supplierAgreements = pgTable('supplier_agreements', {
  id: serial('id').primaryKey(),
  supplierId: integer('supplier_id')
    .references(() => suppliers.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  agreementType: text('agreement_type').notNull(), // 'Price List', 'Quotation', 'Agreement'
  documentUrl: text('document_url'), // PDF, scan, or text reference
  startDate: text('start_date'), // YYYY-MM-DD
  endDate: text('end_date'), // YYYY-MM-DD
  status: text('status').notNull().default('Active'), // 'Draft', 'Active', 'Expired', 'Suspended'
  priceItems: text('price_items'), // JSON list of items & prices e.g. [{"partName":"Anemometer Bearing","model":"AB-102","price":45.00,"leadTimeDays":10}]
  remarks: text('remarks'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 16. Supplier Performance Evaluations (Scorecards) Table
export const supplierEvaluations = pgTable('supplier_evaluations', {
  id: serial('id').primaryKey(),
  supplierId: integer('supplier_id')
    .references(() => suppliers.id, { onDelete: 'cascade' })
    .notNull(),
  evaluationDate: text('evaluation_date').notNull(), // YYYY-MM-DD
  evaluatorEmail: text('evaluator_email').notNull(),
  qualityScore: doublePrecision('quality_score').notNull(), // 1 to 5 scale
  deliveryScore: doublePrecision('delivery_score').notNull(), // 1 to 5 scale
  responseScore: doublePrecision('response_score').notNull(), // 1 to 5 scale
  supportScore: doublePrecision('support_score').notNull(), // 1 to 5 scale
  overallScore: doublePrecision('overall_score').notNull(), // calculated average
  feedback: text('feedback'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  agreements: many(supplierAgreements),
  evaluations: many(supplierEvaluations),
}));

export const supplierAgreementsRelations = relations(supplierAgreements, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [supplierAgreements.supplierId],
    references: [suppliers.id],
  }),
}));

export const supplierEvaluationsRelations = relations(supplierEvaluations, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [supplierEvaluations.supplierId],
    references: [suppliers.id],
  }),
}));

// 17. Requisitions Table
export const requisitions = pgTable('requisitions', {
  id: serial('id').primaryKey(),
  requisitionCode: text('requisition_code').notNull().unique(), // e.g. "REQ-2026-0001"
  stationId: integer('station_id')
    .references(() => weatherStations.stationId, { onDelete: 'set null' }),
  requisitionType: text('requisition_type').notNull(), // 'Manual', 'Automatic', 'Radar', 'Lightning'
  requesterEmail: text('requester_email').notNull(),
  requesterName: text('requester_name'),
  requestDate: text('request_date').notNull(), // YYYY-MM-DD
  status: text('status').notNull().default('Pending Approval'), // 'Pending Approval', 'Approved', 'Dispatched', 'Issued', 'Received', 'Rejected'
  urgency: text('urgency').notNull().default('Medium'), // 'Low', 'Medium', 'High', 'Emergency'
  purpose: text('purpose'),
  remarks: text('remarks'),
  approvedBy: text('approved_by'),
  approvalDate: text('approval_date'),
  approvalRemarks: text('approval_remarks'),
  dispatchDate: text('dispatch_date'),
  dispatchCourier: text('dispatch_courier'),
  dispatchWaybill: text('dispatch_waybill'),
  goodsIssueDate: text('goods_issue_date'),
  grnReceivedDate: text('grn_received_date'),
  grnReceivedBy: text('grn_received_by'),
  grnRemarks: text('grn_remarks'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 18. Requisition Items Table
export const requisitionItems = pgTable('requisition_items', {
  id: serial('id').primaryKey(),
  requisitionId: integer('requisition_id')
    .references(() => requisitions.id, { onDelete: 'cascade' })
    .notNull(),
  itemType: text('item_type').notNull(), // 'Sensor', 'Spare Part', 'Tool', 'Accessory'
  itemName: text('item_name').notNull(),
  modelNumber: text('model_number'),
  quantityRequested: integer('quantity_requested').notNull(),
  quantityApproved: integer('quantity_approved'),
  quantityDispatched: integer('quantity_dispatched'),
  quantityReceived: integer('quantity_received'),
  serialNumberAssigned: text('serial_number_assigned'), // Serial assigned when issuing
  remarks: text('remarks'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const requisitionsRelations = relations(requisitions, ({ one, many }) => ({
  station: one(weatherStations, {
    fields: [requisitions.stationId],
    references: [weatherStations.stationId],
  }),
  items: many(requisitionItems),
}));

export const requisitionItemsRelations = relations(requisitionItems, ({ one }) => ({
  requisition: one(requisitions, {
    fields: [requisitionItems.requisitionId],
    references: [requisitions.id],
  }),
}));


// 19. Documents Table
export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  category: text('category').notNull(), // 'Manuals', 'SOP', 'Wiring Diagram', 'Calibration Certificate', 'Other documents'
  fileName: text('file_name').notNull(),
  fileType: text('file_type'),
  fileSize: text('file_size'),
  fileContent: text('file_content'), // Can store base64 string or mock data
  uploadedBy: text('uploaded_by'),
  stationId: integer('station_id'),
  sensorId: integer('sensor_id'),
  sensorModel: text('sensor_model'),
  serialNumber: text('serial_number'),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
});


// 20. Calibration Devices Table (Reference standard equipment used in the calibration lab)
export const calibrationDevices = pgTable('calibration_devices', {
  deviceId: serial('device_id').primaryKey(),
  deviceName: text('device_name').notNull(), // e.g. "Reference Temperature Liquid Bath", "Wind Tunnel Reference Anemometer"
  deviceType: text('device_type').notNull(), // e.g. "Thermometer Calibrator", "Barometer Calibrator", "Anemometer Calibrator"
  serialNumber: text('serial_number').notNull(),
  lastCalibrated: text('last_calibrated'), // YYYY-MM-DD
  calibrationDue: text('calibration_due'), // YYYY-MM-DD
  accuracyClass: text('accuracy_class'), // e.g. "Class A", "±0.01°C"
  status: text('status').default('Active'), // 'Active', 'In Calibration', 'Maintenance', 'Retired'
  assignedLab: text('assigned_lab').default('Central Meteorological Calibration Lab'),
  createdAt: timestamp('created_at').defaultNow(),
});


// 21. ISO/IEC 17025 Compliant Calibration Jobs Table
export const calibrationJobs = pgTable('calibration_jobs', {
  jobId: serial('job_id').primaryKey(),
  sensorId: integer('sensor_id')
    .references(() => sensorsInventory.sensorId, { onDelete: 'cascade' })
    .notNull(),
  status: text('status').default('Pending'), // 'Pending', 'In Progress', 'Technical Review', 'Signed Off', 'Cancelled'
  currentStage: text('current_stage').default('Plan'), // 'Plan', 'ReferenceSelection', 'EnvironmentCheck', 'Measurements', 'Uncertainty', 'Conformity', 'Review', 'SignOff'
  
  // 1. Plan Stage
  plannedDate: text('planned_date'), // YYYY-MM-DD
  plannedCalibrator: text('planned_calibrator'),
  calibrationProcedure: text('calibration_procedure'), // Standard SOP followed
  
  // 2. Reference Standard Selection Stage
  deviceId: integer('device_id')
    .references(() => calibrationDevices.deviceId, { onDelete: 'set null' }),
  
  // 3. Environment Check Stage
  ambientTemperature: doublePrecision('ambient_temperature'), // °C
  ambientHumidity: doublePrecision('ambient_humidity'), // % RH
  ambientPressure: doublePrecision('ambient_pressure'), // hPa
  environmentStatus: text('environment_status'), // 'Within Limits', 'Outside Limits'
  environmentCheckedBy: text('environment_checked_by'),
  environmentCheckedAt: text('environment_checked_at'), // YYYY-MM-DD HH:MM:SS
  
  // 4. Measurements Stage
  measurements: text('measurements'), // JSON array string of reading points: [{ refValue, sensorValue, error }]
  measuredBy: text('measured_by'),
  measuredAt: text('measured_at'),
  
  // 5. Uncertainty Stage
  uncertaintyBudget: text('uncertainty_budget'), // JSON string: { repeatability, referenceUncertainty, resolutionError, combinedUncertainty, expandedUncertainty, coverageFactor }
  uncertaintyCalculatedBy: text('uncertainty_calculated_by'),
  uncertaintyCalculatedAt: text('uncertainty_calculated_at'),
  
  // 6. Conformity Stage (Pass/Fail)
  conformityResult: text('conformity_result'), // 'Passed', 'Failed', 'Adjusted'
  conformityDecisionRule: text('conformity_decision_rule'), // Decision rule applied (WMO / ILAC-G8 guidelines)
  conformityNotes: text('conformity_notes'),
  conformityEvaluatedBy: text('conformity_evaluated_by'),
  conformityEvaluatedAt: text('conformity_evaluated_at'),
  
  // 7. Technical Review Stage
  reviewerName: text('reviewer_name'),
  reviewComments: text('review_comments'),
  reviewedAt: text('reviewed_at'), // YYYY-MM-DD HH:MM:SS
  
  // 8. Authorized-Signatory Sign-off Stage
  signatoryName: text('signatory_name'),
  signatoryDesignation: text('signatory_designation'),
  signedAt: text('signed_at'), // YYYY-MM-DD HH:MM:SS
  eSignatureHash: text('e_signature_hash'), // Tamper-proof digital hash (e.g., SHA256 of measurements + signatory name + timestamp)
  
  // Audit Trail & Logs
  fullAuditTrail: text('full_audit_trail'), // JSON array of tamper-proof chronological event logs
  createdAt: timestamp('created_at').defaultNow(),
});

// 22. Installation Projects (Sandbox & Bundling) Table
export const installationProjects = pgTable('installation_projects', {
  id: serial('id').primaryKey(),
  projectName: text('project_name').notNull(),
  targetStationId: integer('target_station_id').references(() => weatherStations.stationId, { onDelete: 'set null' }),
  status: text('status').notNull().default('Draft'), // 'Draft', 'Approved', 'Packed', 'Deployed'
  dataLoggerModel: text('data_logger_model'),
  solarPanelModel: text('solar_panel_model'),
  enclosureModel: text('enclosure_model'),
  sensorIds: text('sensor_ids'), // Comma-separated list of sensor IDs bundled, e.g. "1,4,12"
  compatibilityStatus: text('compatibility_status').default('Unknown'), // 'Valid', 'Warnings', 'Invalid'
  compatibilityReport: text('compatibility_report'), // JSON text of compatibility check results
  scheduledDate: text('scheduled_date'), // YYYY-MM-DD
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const installationProjectsRelations = relations(installationProjects, ({ one }) => ({
  station: one(weatherStations, {
    fields: [installationProjects.targetStationId],
    references: [weatherStations.stationId],
  }),
}));




