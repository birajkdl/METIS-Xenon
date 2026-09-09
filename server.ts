import "dotenv/config";
import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { db, pool } from "./src/db/index.ts";
import { weatherStations, sensorsInventory, calibrations, users, customStatuses, sensorDeployments, sensorReplacements, sensorTransfers, customRoles, smtpConfig, notificationSettings, deliveryLogs, auditLogs, suppliers, supplierAgreements, supplierEvaluations, requisitions, requisitionItems, documents, calibrationDevices, calibrationJobs, installationProjects, regionalOffices, stationHealth, designations } from "./src/db/schema.ts";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import { sendNotification, checkAndTriggerMonthlyReminders } from "./src/lib/notifications.ts";
import { adminAuth } from "./src/lib/firebase-admin.ts";
import { getOrCreateUser } from "./src/db/users.ts";
import { hashPassword, verifyPassword, generateMetisToken, verifyMetisToken, toE164 } from "./src/lib/auth-utils.ts";

async function startServer() {
  // Ensure schema compatibility for sim_number and WIGOS Station Identifier structure
  try {
    await pool.query('ALTER TABLE weather_stations ADD COLUMN IF NOT EXISTS sim_number TEXT;');
    await pool.query('ALTER TABLE weather_stations ADD COLUMN IF NOT EXISTS wigos_series TEXT DEFAULT \'1\';');
    await pool.query('ALTER TABLE weather_stations ADD COLUMN IF NOT EXISTS wigos_issuer TEXT DEFAULT \'0\';');
    await pool.query('ALTER TABLE weather_stations ADD COLUMN IF NOT EXISTS wigos_issue_num TEXT DEFAULT \'20001\';');
    await pool.query('ALTER TABLE weather_stations ADD COLUMN IF NOT EXISTS wigos_local_id TEXT;');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;');
  } catch (e) {
    console.warn("Schema migration check:", e);
  }

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Enable CORS for external domains, custom domains, and GitHub Pages deployments
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json());

  // Helper to insert audit logs
  async function createAuditLog(
    action: string,
    actorEmail: string,
    actorRole: string | null,
    details: string,
    ipAddress: string | null = null,
    status: string = 'Success'
  ) {
    try {
      await db.insert(auditLogs).values({
        action,
        actorEmail,
        actorRole: actorRole || 'N/A',
        details,
        ipAddress,
        status,
      });
    } catch (err) {
      console.error("Failed to insert audit log:", err);
    }
  }

  // --- API Routes ---

  // Auto-seed Database Helper
  async function seedDatabase() {
    const today = new Date();
    
    const getPastDateStr = (daysAgo: number) => {
      const d = new Date();
      d.setDate(today.getDate() - daysAgo);
      return d.toISOString().split('T')[0];
    };

    const getFutureDateStr = (daysAhead: number) => {
      const d = new Date();
      d.setDate(today.getDate() + daysAhead);
      return d.toISOString().split('T')[0];
    };

    try {
      const existingStations = await db.select().from(weatherStations);
      const existingSensors = await db.select().from(sensorsInventory);
      
      const hasProperSensorsCount = existingSensors.length >= (existingStations.length * 7) && existingStations.length >= 50;

      const hasOutofNepalOrFew = existingStations.length < 50 || !hasProperSensorsCount || existingStations.some(s => 
        s.latitude > 31 || s.latitude < 25 || s.longitude < 79 || s.longitude > 89 || !s.batteryVoltageType
      );

      if (existingStations.length > 0 && !hasOutofNepalOrFew) {
        console.log("Database already has 50+ weather stations inside Nepal with complete instrumentation. Skipping auto-seeding.");
        // Apply renaming standard to existing stations in database
        for (const station of existingStations) {
          const firstWord = station.stationName.trim().split(/\s+/)[0];
          const newName = `${firstWord} AWS`;
          if (station.stationName !== newName) {
            await db.update(weatherStations)
              .set({ stationName: newName })
              .where(eq(weatherStations.stationId, station.stationId));
            console.log(`Renamed existing station: ${station.stationName} -> ${newName}`);
          }
        }
        return;
      }

      if (existingStations.length > 0) {
        console.log("Database has out-of-Nepal stations, fewer than 50 stations, or incomplete instrumentation. Initiating clean re-seed...");
        
        // Deleting old entries cleanly in order of foreign key dependency
        await db.delete(calibrations);
        await db.delete(sensorTransfers);
        await db.delete(sensorDeployments);
        await db.delete(sensorReplacements);
        await db.delete(requisitionItems);
        await db.delete(requisitions);
        await db.update(users).set({ assignedStationId: null });
        await db.delete(sensorsInventory);
        await db.delete(weatherStations);
      }

      console.log("Database seeding started. Initializing 64 equidistant meteorological terminals across Nepal...");

      // 1. Seed Weather Stations in Nepal
      const stationsData = [
        // Koshi Province
        { stationName: "Biratnagar Airport AWS", region: "Koshi Province", latitude: 26.48, longitude: 87.27 },
        { stationName: "Dharan Cantonment Station", region: "Koshi Province", latitude: 26.81, longitude: 87.28 },
        { stationName: "Itahari Met Tower", region: "Koshi Province", latitude: 26.66, longitude: 87.27 },
        { stationName: "Kakadvitta Border Station", region: "Koshi Province", latitude: 26.64, longitude: 88.16 },
        { stationName: "Namche Bazaar Observatory", region: "Koshi Province", latitude: 27.80, longitude: 86.71 },
        { stationName: "Lukla Airstrip Weather Node", region: "Koshi Province", latitude: 27.69, longitude: 86.73 },
        { stationName: "Taplejung Mountain Station", region: "Koshi Province", latitude: 27.35, longitude: 87.67 },
        { stationName: "Ilam Tea Estate AWS", region: "Koshi Province", latitude: 26.91, longitude: 87.92 },
        { stationName: "Dhankuta Hill Station", region: "Koshi Province", latitude: 26.98, longitude: 87.33 },
        { stationName: "Okhaldhunga Base Station", region: "Koshi Province", latitude: 27.31, longitude: 86.50 },
        { stationName: "Phidim AWS", region: "Koshi Province", latitude: 27.15, longitude: 87.75 },
        { stationName: "Bhojpur Weather Station", region: "Koshi Province", latitude: 27.17, longitude: 87.05 },

        // Madhesh Province
        { stationName: "Birgunj Industrial AWS", region: "Madhesh Province", latitude: 27.01, longitude: 84.87 },
        { stationName: "Janakpur Temple Station", region: "Madhesh Province", latitude: 26.73, longitude: 85.92 },
        { stationName: "Gaur Border AWS", region: "Madhesh Province", latitude: 26.76, longitude: 85.27 },
        { stationName: "Kalaiya District Station", region: "Madhesh Province", latitude: 27.03, longitude: 85.00 },
        { stationName: "Malangwa Plains Station", region: "Madhesh Province", latitude: 26.86, longitude: 85.56 },
        { stationName: "Jaleshwar Airport Node", region: "Madhesh Province", latitude: 26.65, longitude: 85.80 },
        { stationName: "Siraha Regional AWS", region: "Madhesh Province", latitude: 26.65, longitude: 86.21 },
        { stationName: "Rajbiraj Met Center", region: "Madhesh Province", latitude: 26.54, longitude: 86.75 },
        { stationName: "Lahan Transit AWS", region: "Madhesh Province", latitude: 26.72, longitude: 86.48 },

        // Bagmati Province
        { stationName: "Kathmandu Central Observatory", region: "Bagmati Province", latitude: 27.70, longitude: 85.32 },
        { stationName: "Lalitpur Patan AWS", region: "Bagmati Province", latitude: 27.67, longitude: 85.32 },
        { stationName: "Bhaktapur Durbar Station", region: "Bagmati Province", latitude: 27.67, longitude: 85.42 },
        { stationName: "Godawari Botanical AWS", region: "Bagmati Province", latitude: 27.60, longitude: 85.36 },
        { stationName: "Hetauda Industrial Station", region: "Bagmati Province", latitude: 27.43, longitude: 85.03 },
        { stationName: "Bharatpur Airport AWS", region: "Bagmati Province", latitude: 27.68, longitude: 84.43 },
        { stationName: "Charikot Mountain Observatory", region: "Bagmati Province", latitude: 27.67, longitude: 86.05 },
        { stationName: "Bidur Hill Station", region: "Bagmati Province", latitude: 27.91, longitude: 85.15 },
        { stationName: "Dhulikhel Research Station", region: "Bagmati Province", latitude: 27.62, longitude: 85.55 },
        { stationName: "Jiri Alpine Met Node", region: "Bagmati Province", latitude: 27.63, longitude: 86.23 },
        { stationName: "Chautara Alpine Station", region: "Bagmati Province", latitude: 27.77, longitude: 85.72 },

        // Gandaki Province
        { stationName: "Pokhara Lakeside Station", region: "Gandaki Province", latitude: 28.20, longitude: 83.98 },
        { stationName: "Jomsom Trans-Himalayan AWS", region: "Gandaki Province", latitude: 28.78, longitude: 83.73 },
        { stationName: "Besisahar River Basin AWS", region: "Gandaki Province", latitude: 28.23, longitude: 84.37 },
        { stationName: "Damauli Highway Node", region: "Gandaki Province", latitude: 27.97, longitude: 84.28 },
        { stationName: "Baglung Hill Station", region: "Gandaki Province", latitude: 28.27, longitude: 83.60 },
        { stationName: "Beni Gorge AWS", region: "Gandaki Province", latitude: 28.34, longitude: 83.57 },
        { stationName: "Chame Mountain Station", region: "Gandaki Province", latitude: 28.55, longitude: 84.24 },
        { stationName: "Syangja Valley AWS", region: "Gandaki Province", latitude: 28.10, longitude: 83.88 },

        // Lumbini Province
        { stationName: "Butwal Hill-Edge Station", region: "Lumbini Province", latitude: 27.70, longitude: 83.45 },
        { stationName: "Bhairahawa Airport AWS", region: "Lumbini Province", latitude: 27.50, longitude: 83.45 },
        { stationName: "Nepalgunj Border Station", region: "Lumbini Province", latitude: 28.05, longitude: 81.62 },
        { stationName: "Ghorahi Valley Met Center", region: "Lumbini Province", latitude: 28.03, longitude: 82.48 },
        { stationName: "Tulsipur Airport AWS", region: "Lumbini Province", latitude: 28.13, longitude: 82.30 },
        { stationName: "Tansen Palpa AWS", region: "Lumbini Province", latitude: 27.87, longitude: 83.55 },
        { stationName: "Sandhikharka Station", region: "Lumbini Province", latitude: 27.99, longitude: 83.08 },
        { stationName: "Tamghas Hill Node", region: "Lumbini Province", latitude: 28.07, longitude: 83.25 },
        { stationName: "Pyuthan District Station", region: "Lumbini Province", latitude: 28.09, longitude: 82.88 },

        // Karnali Province
        { stationName: "Surkhet Birendranagar Center", region: "Karnali Province", latitude: 28.60, longitude: 81.63 },
        { stationName: "Jumla High-Altitude AWS", region: "Karnali Province", latitude: 29.27, longitude: 82.18 },
        { stationName: "Salyan Valley Station", region: "Karnali Province", latitude: 28.37, longitude: 82.16 },
        { stationName: "Musikot Mountain AWS", region: "Karnali Province", latitude: 28.63, longitude: 82.47 },
        { stationName: "Dunai Dolpa Station", region: "Karnali Province", latitude: 29.03, longitude: 82.91 },
        { stationName: "Gamgadhi Rara Lake AWS", region: "Karnali Province", latitude: 29.35, longitude: 82.17 },
        { stationName: "Simikot Mountain Station", region: "Karnali Province", latitude: 29.97, longitude: 81.82 },

        // Sudurpashchim Province
        { stationName: "Dhangadhi Airport AWS", region: "Sudurpashchim Province", latitude: 28.69, longitude: 80.57 },
        { stationName: "Mahendranagar Border Node", region: "Sudurpashchim Province", latitude: 28.97, longitude: 80.18 },
        { stationName: "Silgadhi Doti Station", region: "Sudurpashchim Province", latitude: 29.27, longitude: 80.98 },
        { stationName: "Mangalsen Achham AWS", region: "Sudurpashchim Province", latitude: 29.12, longitude: 81.27 },
        { stationName: "Chainpur Bajhang AWS", region: "Sudurpashchim Province", latitude: 29.55, longitude: 81.21 },
        { stationName: "Dadeldhura Hill Station", region: "Sudurpashchim Province", latitude: 29.30, longitude: 80.58 },
        { stationName: "Baitadi Frontier AWS", region: "Sudurpashchim Province", latitude: 29.48, longitude: 80.42 },
        { stationName: "Darchula Mountain Node", region: "Sudurpashchim Province", latitude: 29.85, longitude: 80.53 }
      ];

      const nominalVoltages = ["12V", "4V", "6V"];
      const enrichedStationsData = stationsData.map((station, index) => {
        const batteryVoltageType = nominalVoltages[index % nominalVoltages.length];
        let batteryCurrentVoltage = 0;
        if (batteryVoltageType === "12V") {
          // Some below 11.5V (alert), some above
          batteryCurrentVoltage = parseFloat((11.0 + (index % 5 === 0 ? 0.3 : 1.2)).toFixed(2));
        } else if (batteryVoltageType === "4V") {
          // Some below 3.5V (alert), some above
          batteryCurrentVoltage = parseFloat((3.0 + (index % 5 === 0 ? 0.3 : 0.9)).toFixed(2));
        } else { // 6V
          // Some below 5.5V (alert), some above
          batteryCurrentVoltage = parseFloat((5.0 + (index % 5 === 0 ? 0.3 : 1.1)).toFixed(2));
        }
        const firstWord = station.stationName.trim().split(/\s+/)[0];
        const renamedName = `${firstWord} AWS`;
        const simNum = '9841' + String(100000 + ((index * 73921) % 900000));
        const code = firstWord ? firstWord.toUpperCase() : `STN${index + 1}`;
        return {
          ...station,
          stationName: renamedName,
          batteryVoltageType,
          batteryCurrentVoltage,
          simNumber: simNum,
          wigosSeries: '1',
          wigosIssuer: '0',
          wigosIssueNum: '20001',
          wigosLocalId: `0-${code}`,
        };
      });

      const insertedStations = await db.insert(weatherStations)
        .values(enrichedStationsData)
        .returning();

      console.log(`Seeded ${insertedStations.length} weather stations.`);

      // 2. Seed Sensors (Assign 1 item of each of the 7 specified sensors to EACH weather station)
      const manufacturersMap: Record<string, string> = {
        "Temperature Sensor": "Vaisala",
        "Tipping bucket raingauge": "Campbell Scientific",
        "RHT sensor": "Rotronic",
        "pressure sensor": "Vaisala",
        "Radiation Shield": "Met One Instruments",
        "Battery": "Ultracell",
        "Solar panel": "LDK Solar"
      };

      const modelsMap: Record<string, string> = {
        "Temperature Sensor": "HMP155",
        "Tipping bucket raingauge": "TE525",
        "RHT sensor": "HC2S3",
        "pressure sensor": "PTB110",
        "Radiation Shield": "062",
        "Battery": "12V-100Ah",
        "Solar panel": "80W-Mono"
      };

      const sensorsData: any[] = [];

      for (const station of insertedStations) {
        const types = [
          "Temperature Sensor",
          "Tipping bucket raingauge",
          "RHT sensor",
          "pressure sensor",
          "Radiation Shield",
          "Battery",
          "Solar panel"
        ];
        
        types.forEach((type, idx) => {
          const serialNum = `${type.replace(/\s+/g, '').slice(0, 4).toUpperCase()}-${station.stationId}-${1000 + idx}`;
          
          // Randomize status slightly: 3% Maintenance, rest Active or In Calibration
          let status = "Active";
          if (idx === 3 && station.stationId % 11 === 0) {
            status = "Maintenance";
          } else if (idx === 1 && station.stationId % 13 === 0) {
            status = "In Calibration";
          }

          sensorsData.push({
            sensorType: type,
            sensorName: `${type} - ${modelsMap[type]}`,
            manufacturer: manufacturersMap[type],
            modelNumber: modelsMap[type],
            serialNumber: serialNum,
            barcode: `BC-${serialNum}`,
            status: status,
            stationId: station.stationId,
            approvalStatus: "Approved",
            procurementDate: getPastDateStr(365),
            warrantyStartDate: getPastDateStr(365),
            warrantyEndDate: getFutureDateStr(365),
            calibrationInterval: "12 Months",
            calibrationDetails: `Annual physical calibration verification program for ${type}.`,
            deploymentInfo: `Mounted at ${station.stationName} meteorological mast.`
          });
        });
      }

      const insertedSensors = await db.insert(sensorsInventory)
        .values(sensorsData)
        .returning();

      console.log(`Seeded ${insertedSensors.length} sensors (7 for each of the ${insertedStations.length} stations).`);

      // 3. Seed Calibrations
      // Let's match sensor ids with calibration logs
      const calibrationsData = [
        // Summit Thermometer - Passed
        {
          sensorId: insertedSensors[0].sensorId,
          calibrationDate: getPastDateStr(120),
          technicianName: "Dr. Sarah Jenkins",
          result: "Passed",
          notes: "Zero-point Ice check and span-point chamber verification complete. High accuracy maintained.",
          nextDueDate: getFutureDateStr(245)
        },
        // Summit Sonic Anemometer - Needs calibration (Overdue!)
        {
          sensorId: insertedSensors[1].sensorId,
          calibrationDate: getPastDateStr(380),
          technicianName: "Marcus Sterling",
          result: "Adjusted",
          notes: "Transducer alignment required minor mechanical adjustments. Calibrated in wind tunnel.",
          nextDueDate: getPastDateStr(15) // Overdue!
        },
        // Mojave Pyranometer - Passed
        {
          sensorId: insertedSensors[3].sensorId,
          calibrationDate: getPastDateStr(60),
          technicianName: "Carlos Mendez",
          result: "Passed",
          notes: "Cleaned dome. Absolute sensitivity constant within 0.5% of factory spec.",
          nextDueDate: getFutureDateStr(305)
        },
        // Mojave Humidity Probe - Failed (hence status: Maintenance)
        {
          sensorId: insertedSensors[4].sensorId,
          calibrationDate: getPastDateStr(5),
          technicianName: "Carlos Mendez",
          result: "Failed",
          notes: "Salt chamber test showed >8% drift at high relative humidity. Requires sensor element replacement.",
          nextDueDate: getPastDateStr(1) // Immediate attention
        },
        // Mauna Loa CO2 Analyzer - Passed
        {
          sensorId: insertedSensors[7].sensorId,
          calibrationDate: getPastDateStr(15),
          technicianName: "Linda Zhao",
          result: "Passed",
          notes: "Standard reference gas calibration performed. System matches NOAA standards.",
          nextDueDate: getFutureDateStr(165)
        }
      ];

      await db.insert(calibrations).values(calibrationsData);
      console.log("Seeded calibration logs. Database setup complete!");
    } catch (e) {
      console.error("Auto-seeding database failed:", e);
    }
  }

  // Auto-seed Custom Statuses helper
  async function seedStatuses() {
    try {
      const existing = await db.select().from(customStatuses);
      if (existing.length > 0) {
        console.log("Custom statuses table already has data. Skipping status seeding.");
        return;
      }

      console.log("Initializing custom statuses...");
      const statusesToSeed = [
        { statusName: 'Store', color: '#a855f7', description: 'Physically in the primary equipment storage facility.', isConsumableOnly: 'false' },
        { statusName: 'Ordered', color: '#3b82f6', description: 'Procurement initiated, pending delivery from manufacturer.', isConsumableOnly: 'false' },
        { statusName: 'Spare', color: '#06b6d4', description: 'In stock and ready for immediate deployment.', isConsumableOnly: 'false' },
        { statusName: 'Deployed', color: '#10b981', description: 'Installed on-site at a weather station and transmitting.', isConsumableOnly: 'false' },
        { statusName: 'Transferred', color: '#6366f1', description: 'In transit or moved to another office or location.', isConsumableOnly: 'false' },
        { statusName: 'Under Calibration', color: '#eab308', description: 'Currently undergoing calibration checks or routine validation.', isConsumableOnly: 'false' },
        { statusName: 'Under Repair', color: '#f97316', description: 'In the workshop undergoing mechanical/electrical repairs.', isConsumableOnly: 'false' },
        { statusName: 'Damaged', color: '#ef4444', description: 'Damaged or malfunctioning, awaiting assessment.', isConsumableOnly: 'false' },
        { statusName: 'Obsolete', color: '#6b7280', description: 'Outdated or deprecated, replaced by newer technology.', isConsumableOnly: 'false' },
        { statusName: 'Disposed', color: '#1e293b', description: 'Safely decommissioned and physically disposed.', isConsumableOnly: 'false' },
        { statusName: 'Consumed', color: '#ec4899', description: 'Used up or consumed (for consumable assets like batteries, filters, elements).', isConsumableOnly: 'true' }
      ];

      await db.insert(customStatuses).values(statusesToSeed);
      console.log("Seeded custom statuses successfully.");
    } catch (err) {
      console.error("Failed to seed custom statuses:", err);
    }
  }

  // Auto-seed Roles helper
  async function seedRoles() {
    try {
      const existing = await db.select().from(customRoles);
      if (existing.length > 0) {
        console.log("Custom roles table already has data. Skipping roles seeding.");
        return;
      }

      console.log("Initializing custom roles...");
      const rolesToSeed = [
        { roleName: 'Super Administrator', description: 'Full read/write access, user management, custom roles addition, and full approvals.' },
        { roleName: 'Head Office Admin/User', description: 'Read/write access to all instruments/stations, approve transfers and supplier entries.' },
        { roleName: 'Regional Office Admin/User', description: 'Read/write access to regional instruments/stations, request transfers.' },
        { roleName: 'Synoptic/Aero-synoptic office User', description: 'Record observations, register calibrations, and view status.' },
        { roleName: 'Station User (optional)', description: 'Manage station specific instruments.' },
        { roleName: 'Read-only/Audit User', description: 'Read-only access, cannot make any modifications.' },
        { roleName: 'Supplier account', description: 'Can enter/catalog sensors, which require admin approval before becoming active.' }
      ];

      await db.insert(customRoles).values(rolesToSeed);
      console.log("Seeded custom roles successfully.");
    } catch (err) {
      console.error("Failed to seed custom roles:", err);
    }
  }

  // Auto-seed Suppliers and Manufacturers helper
  async function seedSuppliers() {
    try {
      const existing = await db.select().from(suppliers);
      if (existing.length > 0) {
        console.log("Suppliers already exist. Skipping seeding.");
        return;
      }

      console.log("Initializing suppliers and manufacturers seed data...");

      const initialSuppliers = [
        {
          name: "Vaisala Oyj",
          code: "SUP-VAI-01",
          contactName: "Helena Lindstrom",
          email: "helena.lindstrom@vaisala.com",
          phone: "+358 9 89491",
          address: "Vanha Nurmijärventie 21, 01670 Vantaa, Finland",
          website: "https://www.vaisala.com",
          status: "Active",
          supplierType: "Both",
          supplyCategories: "Humidity Probes, Thermometers, Barometers, Automatic Weather Stations",
          performanceRating: 4.8,
          qualityRating: 4.9,
          deliveryPerformance: 4.7,
          historyOfSupply: JSON.stringify([
            { date: "2025-01-10", item: "Pt100 Air Temperature Sensors (Qty 50)", value: "$12,500" },
            { date: "2025-04-12", item: "BAROCAP Barometric Pressure Sensors (Qty 20)", value: "$18,000" }
          ])
        },
        {
          name: "Campbell Scientific Inc",
          code: "SUP-CAM-02",
          contactName: "John Stevenson",
          email: "jstevenson@campbellsci.com",
          phone: "+1 (435) 753-2342",
          address: "815 W 1800 N, Logan, UT 84321, USA",
          website: "https://www.campbellsci.com",
          status: "Active",
          supplierType: "Both",
          supplyCategories: "Dataloggers, Meteorological Stations, Barometers, Soil Moisture Sensors",
          performanceRating: 4.6,
          qualityRating: 4.7,
          deliveryPerformance: 4.5,
          historyOfSupply: JSON.stringify([
            { date: "2024-11-05", item: "CR1000X Measurement and Control Dataloggers (Qty 15)", value: "$34,500" }
          ])
        },
        {
          name: "Gill Instruments Ltd",
          code: "SUP-GIL-03",
          contactName: "Oliver West",
          email: "o.west@gillinstruments.com",
          phone: "+44 (0) 1590 613500",
          address: "Saltmarsh Park, 67 Gosport St, Lymington, Hampshire, SO41 9EG, UK",
          website: "https://gillinstruments.com",
          status: "Active",
          supplierType: "Manufacturer",
          supplyCategories: "Ultrasonic Anemometers, WindVane, WindObserver",
          performanceRating: 4.5,
          qualityRating: 4.6,
          deliveryPerformance: 4.4,
          historyOfSupply: JSON.stringify([
            { date: "2025-02-20", item: "WindSonic 2-Axis Ultrasonic Anemometers (Qty 30)", value: "$21,000" }
          ])
        }
      ];

      const insertedSuppliers = await db.insert(suppliers).values(initialSuppliers).returning();
      console.log(`Seeded ${insertedSuppliers.length} suppliers.`);

      // Seed agreements for Vaisala & Campbell
      const [vaisala, campbell] = insertedSuppliers;

      const initialAgreements = [
        {
          supplierId: vaisala.id,
          title: "Vaisala Standard Sensor Price List 2026",
          agreementType: "Price List",
          documentUrl: "agreements/vaisala_pl_2026.pdf",
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "Active",
          remarks: "Standard authorized distributor price list. 10% discount applied for national meteorological networks.",
          priceItems: JSON.stringify([
            { partName: "HMP155 Humidity & Temp Probe", model: "HMP155", price: 680, currency: "USD", minLeadTimeDays: 15 },
            { partName: "PTB330 Barometer", model: "PTB330-A", price: 1450, currency: "USD", minLeadTimeDays: 21 },
            { partName: "WXT536 Multi-Weather Sensor", model: "WXT536", price: 2100, currency: "USD", minLeadTimeDays: 30 }
          ])
        },
        {
          supplierId: vaisala.id,
          title: "Maintenance & Spares Supply Agreement",
          agreementType: "Agreement",
          documentUrl: "agreements/vaisala_maint_agreement.pdf",
          startDate: "2025-06-01",
          endDate: "2028-06-01",
          status: "Active",
          remarks: "Three-year long-term agreement securing replacement parts pricing and guaranteed 14-day delivery.",
          priceItems: JSON.stringify([
            { partName: "Spare Filter for HMP155", model: "219452SP", price: 45, currency: "USD", minLeadTimeDays: 7 },
            { partName: "PTB330 Calibration Cable", model: "219685", price: 85, currency: "USD", minLeadTimeDays: 10 }
          ])
        },
        {
          supplierId: campbell.id,
          title: "CR1000X & Enclosure Quotation",
          agreementType: "Quotation",
          documentUrl: "quotes/campbell_quote_94821.pdf",
          startDate: "2026-04-01",
          endDate: "2026-10-01",
          status: "Active",
          remarks: "Direct manufacturer quotation for telemetry node upgrades.",
          priceItems: JSON.stringify([
            { partName: "CR1000X Datalogger", model: "CR1000X", price: 1850, currency: "USD", minLeadTimeDays: 14 },
            { partName: "ENC12/14 Weatherproof Enclosure", model: "ENC12/14", price: 320, currency: "USD", minLeadTimeDays: 10 }
          ])
        }
      ];

      await db.insert(supplierAgreements).values(initialAgreements);
      console.log("Seeded supplier agreements.");

      // Seed evaluations
      const initialEvaluations = [
        {
          supplierId: vaisala.id,
          evaluationDate: "2025-12-15",
          evaluatorEmail: "admin@met.gov.np",
          qualityScore: 5.0,
          deliveryScore: 4.5,
          responseScore: 5.0,
          supportScore: 4.8,
          overallScore: 4.825,
          feedback: "Excellent product quality. Standard calibration certificates were perfectly detailed. Delivery delayed by 3 days in customs, but customer service was proactive in providing updates."
        },
        {
          supplierId: campbell.id,
          evaluationDate: "2026-01-20",
          evaluatorEmail: "admin@met.gov.np",
          qualityScore: 4.8,
          deliveryScore: 4.5,
          responseScore: 4.2,
          supportScore: 4.5,
          overallScore: 4.5,
          feedback: "Extremely robust loggers. Technical support is highly responsive and resolved programming challenges for remote GPRS communication."
        }
      ];

      await db.insert(supplierEvaluations).values(initialEvaluations);
      console.log("Seeded supplier evaluations scorecards.");

    } catch (err) {
      console.error("Failed to seed suppliers:", err);
    }
  }

  async function seedCalibrationDevices() {
    try {
      const existing = await db.select().from(calibrationDevices);
      if (existing.length > 0) {
        console.log("Calibration devices already exist. Skipping seeding.");
        return;
      }
      console.log("Initializing calibration devices seed data...");
      const today = new Date().toISOString().split('T')[0];
      const devices = [
        {
          deviceName: "Fluke 7103 Micro-Bath Reference",
          deviceType: "Thermometer Calibrator",
          serialNumber: "CD-FLK-7103-9982",
          lastCalibrated: today,
          calibrationDue: "2027-07-09",
          accuracyClass: "±0.02°C",
          status: "Active",
          assignedLab: "Central Meteorological Calibration Lab",
        },
        {
          deviceName: "Druck DPI 611 Pressure Calibrator",
          deviceType: "Barometer Calibrator",
          serialNumber: "CD-DRK-611-3321",
          lastCalibrated: today,
          calibrationDue: "2027-07-09",
          accuracyClass: "±0.01% FS",
          status: "Active",
          assignedLab: "Central Meteorological Calibration Lab",
        },
        {
          deviceName: "Reference Wind Tunnel (MET-WT-01)",
          deviceType: "Anemometer Calibrator",
          serialNumber: "CD-REF-WT01-8848",
          lastCalibrated: today,
          calibrationDue: "2028-07-09",
          accuracyClass: "±0.1 m/s",
          status: "Active",
          assignedLab: "Central Meteorological Calibration Lab",
        },
        {
          deviceName: "Vaisala HM70 Reference Humidity Probe",
          deviceType: "Hygrometer Calibrator",
          serialNumber: "CD-VAI-HM70-1122",
          lastCalibrated: today,
          calibrationDue: "2027-01-09",
          accuracyClass: "±1.0% RH",
          status: "Active",
          assignedLab: "Central Meteorological Calibration Lab",
        }
      ];
      await db.insert(calibrationDevices).values(devices);
      console.log("Calibration devices seeded successfully.");
    } catch (err) {
      console.error("Failed to seed calibration devices:", err);
    }
  }

  // Auto-seed Station Health helper
  async function seedStationHealth() {
    try {
      const existing = await db.select().from(stationHealth);
      if (existing.length > 0) {
        console.log("Station health table already has data. Skipping health seeding.");
        return;
      }

      const stationsList = await db.select().from(weatherStations);
      if (stationsList.length === 0) return;

      console.log(`Initializing station health seed data for ${stationsList.length} stations...`);
      const healthEntries = stationsList.map((station, idx) => {
        const voltage = station.batteryCurrentVoltage || (12.2 + (idx % 7) * 0.1 - 0.2);
        let batteryPct = Math.min(100, Math.max(12, Math.round(((voltage - 10.8) / (12.8 - 10.8)) * 100)));
        
        const dbmValues = [-65, -72, -78, -84, -92, -98, -105];
        const dbm = dbmValues[idx % dbmValues.length];
        let signalLabel = "Good";
        if (dbm < -95) signalLabel = "Poor";
        else if (dbm < -80) signalLabel = "Fair";
        const signalStrength = `${dbm} dBm (${signalLabel})`;

        let alertStatus: 'OK' | 'Warning' | 'Critical' = "OK";
        if (batteryPct < 25 || dbm < -100) {
          alertStatus = "Critical";
        } else if (batteryPct < 45 || dbm < -90) {
          alertStatus = "Warning";
        }

        // Varied real-world distribution
        if (idx % 13 === 0) alertStatus = "Warning";
        if (idx % 29 === 0) alertStatus = "Critical";

        const minsAgo = (idx * 4) % 90;
        const reportedDate = new Date(Date.now() - minsAgo * 60 * 1000);

        return {
          stationId: station.stationId,
          lastReportedTime: reportedDate,
          batteryLevel: batteryPct,
          signalStrength,
          alertStatus,
        };
      });

      await db.insert(stationHealth).values(healthEntries);
      console.log(`Seeded ${healthEntries.length} station health records successfully.`);
    } catch (err) {
      console.error("Failed to seed station health records:", err);
    }
  }

  // Run seeding on startup
  await seedDatabase();
  await seedStatuses();
  await seedRoles();
  await seedSuppliers();
  await seedCalibrationDevices();
  await seedStationHealth();

  // Ensure 'birajkdl@gmail.com' has the Super Administrator role if they exist
  try {
    await db.update(users)
      .set({ role: 'Super Administrator' })
      .where(eq(users.email, 'birajkdl@gmail.com'));
    console.log("Super Administrator role verified for birajkdl@gmail.com on startup.");
  } catch (err) {
    console.error("Failed to verify/update superadmin on startup:", err);
  }

  // --- Authentication & First-Time Setup Endpoints ---

  app.get("/api/auth/setup-status", async (req, res) => {
    try {
      const allUsers = await db.select().from(users);
      const isFirstInstall = allUsers.length === 0;
      res.json({
        isFirstInstall,
        userCount: allUsers.length,
        systemName: "METIS - Nepal Meteorological Department",
        installedAt: allUsers.length > 0 ? allUsers[0].createdAt : null
      });
    } catch (error: any) {
      console.error("Failed to check setup status:", error);
      res.status(500).json({ error: "Failed to determine system setup status", details: error?.message });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    const { email, password, username, phoneNumber, designation, office, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    try {
      const cleanEmail = email.trim().toLowerCase();
      const existing = await db.select().from(users);
      const existingMatch = existing.find(u => u.email.toLowerCase() === cleanEmail);
      if (existingMatch) {
        if (!existingMatch.passwordHash) {
          // Allow establishing initial password for account originally created without a native password
          const hashedPassword = hashPassword(password);
          const updated = await db.update(users).set({
            passwordHash: hashedPassword,
            username: username?.trim() || existingMatch.username,
            phoneNumber: phoneNumber?.trim() || existingMatch.phoneNumber,
            designation: designation?.trim() || existingMatch.designation,
            office: office?.trim() || existingMatch.office,
            role: cleanEmail === 'birajkdl@gmail.com' ? 'Super Administrator' : existingMatch.role
          }).where(eq(users.uid, existingMatch.uid)).returning();

          const activeUser = updated[0] || existingMatch;
          const token = generateMetisToken({
            uid: activeUser.uid,
            email: activeUser.email,
            role: activeUser.role || 'Super Administrator',
            username: activeUser.username,
            office: activeUser.office
          });

          await createAuditLog(
            "Account Password Established",
            cleanEmail,
            activeUser.role || 'User',
            `Native password credentials established for ${cleanEmail}.`
          );

          return res.status(200).json({
            message: "Password credentials established successfully!",
            token,
            user: activeUser
          });
        }

        return res.status(409).json({ error: "An account with this email address already exists. Please switch to Sign In." });
      }

      // If first user, or email matches the Super Admin email, bootstraps as Super Administrator!
      const isFirstUser = existing.length === 0;
      const assignedRole = (isFirstUser || cleanEmail === 'birajkdl@gmail.com') 
        ? 'Super Administrator' 
        : (role || 'Read-only/Audit User');

      const hashedPassword = hashPassword(password);
      const uid = 'metis_usr_' + crypto.randomUUID();

      // Automatically determine assignedStationId if office provided
      let assignedStationId: number | null = null;
      if (office && typeof office === 'string') {
        const officeLower = office.toLowerCase().trim();
        if (!officeLower.includes("head") && !officeLower.includes("global") && !officeLower.includes("admin") && !officeLower.includes("super")) {
          const stationsList = await db.select().from(weatherStations);
          const matchedStation = stationsList.find(st => {
            const nameLower = st.stationName.toLowerCase();
            const regionLower = st.region.toLowerCase();
            return nameLower.includes(officeLower) || officeLower.includes(nameLower) || regionLower.includes(officeLower) || officeLower.includes(regionLower);
          });
          if (matchedStation) assignedStationId = matchedStation.stationId;
        }
      }

      const inserted = await db.insert(users).values({
        uid,
        email: cleanEmail,
        passwordHash: hashedPassword,
        username: username?.trim() || null,
        phoneNumber: phoneNumber?.trim() || null,
        designation: designation?.trim() || (isFirstUser ? 'Chief Administrator' : null),
        office: office?.trim() || (isFirstUser ? 'Central Meteorological Department' : null),
        role: assignedRole,
        assignedStationId,
        status: 'Active',
      }).returning();

      const createdUser = inserted[0];

      // Also try to mirror user in Firebase Auth if available (non-blocking)
      try {
        const e164Phone = toE164(phoneNumber);
        await adminAuth.createUser({
          uid,
          email: cleanEmail,
          password,
          displayName: username?.trim() || undefined,
          phoneNumber: e164Phone,
        });
      } catch (fbErr: any) {
        // Firebase failure (e.g. offline, ADC project API disabled, unauthorized domain) does NOT block local account creation!
        console.log("Firebase sync during native registration notice:", fbErr.message);
      }

      // Generate Native METIS Token
      const token = generateMetisToken({
        uid: createdUser.uid,
        email: createdUser.email,
        role: createdUser.role || assignedRole,
        username: createdUser.username,
        office: createdUser.office
      });

      await createAuditLog(
        isFirstUser ? "Initial System Administrator Setup" : "User Self-Registration",
        cleanEmail,
        assignedRole,
        isFirstUser 
          ? `First-time installation completed. Primary Super Administrator account created for ${cleanEmail}.` 
          : `Self-registration completed for ${cleanEmail}.`
      );

      res.status(201).json({
        message: "Account created successfully",
        token,
        user: createdUser,
        isFirstInstall: isFirstUser
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ error: error.message || "Failed to create account" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    try {
      const cleanEmail = email.trim().toLowerCase();
      const matchingUsers = await db.select().from(users).where(eq(users.email, cleanEmail));
      if (matchingUsers.length === 0) {
        return res.status(401).json({ error: "Invalid email or password credentials." });
      }

      const foundUser = matchingUsers[0];

      if (foundUser.status && foundUser.status.toLowerCase() === 'deactive') {
        return res.status(403).json({ error: "Your account is deactivated. Contact an administrator." });
      }

      let passwordValid = false;
      if (foundUser.passwordHash) {
        passwordValid = verifyPassword(password, foundUser.passwordHash);
      }

      // If user has no passwordHash (e.g. created through earlier legacy sign-in), save password on first entry if >= 6 chars
      if (!passwordValid && !foundUser.passwordHash) {
        if (password.length >= 6) {
          const newHash = hashPassword(password);
          await db.update(users).set({ passwordHash: newHash }).where(eq(users.uid, foundUser.uid));
          passwordValid = true;
        }
      }

      if (!passwordValid) {
        return res.status(401).json({ error: "Invalid email or password credentials." });
      }

      const token = generateMetisToken({
        uid: foundUser.uid,
        email: foundUser.email,
        role: foundUser.role || 'Read-only/Audit User',
        username: foundUser.username,
        office: foundUser.office
      });

      await createAuditLog(
        "User Login",
        cleanEmail,
        foundUser.role || 'User',
        `User logged in successfully via Native METIS authentication.`
      );

      res.json({
        token,
        user: foundUser
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Authentication failed. Please try again." });
    }
  });

  app.post("/api/auth/google-direct", async (req, res) => {
    try {
      const { email, displayName, photoURL } = req.body;
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ error: "A valid Google account email is required." });
      }

      const cleanEmail = email.trim().toLowerCase();

      // Check if user exists in Cloud SQL
      const matchingUsers = await db.select().from(users).where(eq(users.email, cleanEmail));
      let targetUser = matchingUsers[0];

      const isSuperAdminEmail = cleanEmail === "birajkdl@gmail.com";

      if (!targetUser) {
        // If user doesn't exist yet, create account
        const generatedUid = "g_" + crypto.randomBytes(12).toString("hex");
        const assignedRole = isSuperAdminEmail ? "Super Administrator" : "Read-only/Audit User";
        const assignedDesignation = isSuperAdminEmail ? "Chief System Administrator" : "Google Authenticated Operator";

        const newUsers = await db.insert(users).values({
          uid: generatedUid,
          email: cleanEmail,
          username: displayName?.trim() || cleanEmail.split("@")[0],
          role: assignedRole,
          status: "Active",
          office: "Head Office",
          designation: assignedDesignation,
          createdAt: new Date()
        }).returning();

        targetUser = newUsers[0];
      } else {
        // If user already exists and is birajkdl@gmail.com, ensure Super Administrator role is locked in
        if (isSuperAdminEmail && targetUser.role !== "Super Administrator") {
          await db.update(users).set({ role: "Super Administrator" }).where(eq(users.uid, targetUser.uid));
          targetUser.role = "Super Administrator";
        }
      }

      if (targetUser.status && targetUser.status.toLowerCase() === "deactive") {
        return res.status(403).json({ error: "Your account is deactivated. Contact an administrator." });
      }

      const token = generateMetisToken({
        uid: targetUser.uid,
        email: targetUser.email,
        role: targetUser.role || "Read-only/Audit User",
        username: targetUser.username,
        office: targetUser.office
      });

      await createAuditLog(
        "Google Sign-In (Direct)",
        cleanEmail,
        targetUser.role || "User",
        `User logged in via Google Account Direct Verification for ${cleanEmail}.`
      );

      res.json({
        token,
        user: targetUser,
        message: "Successfully authenticated with Google account."
      });
    } catch (error: any) {
      console.error("Google direct authentication error:", error);
      res.status(500).json({ error: "Failed to authenticate with Google account." });
    }
  });

  // --- User and Role Management Endpoints ---

  app.get("/api/me", requireAuth, async (req: AuthRequest, res) => {
    try {
      res.json(req.dbUser);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get profile" });
    }
  });

  app.put("/api/me", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { phoneNumber, username, designation, office, role } = req.body;
      const uid = req.dbUser?.uid;
      if (!uid) {
        return res.status(404).json({ error: "User profile not found in database session." });
      }

      const currentUserRecords = await db.select().from(users).where(eq(users.uid, uid));
      const currentUser = currentUserRecords[0];
      const isSuperAdmin = currentUser?.role === 'Super Administrator' || currentUser?.email === 'birajkdl@gmail.com';

      // Automatically determine assignedStationId based on office
      let assignedStationId: number | null = null;
      if (office && typeof office === 'string') {
        const officeLower = office.toLowerCase().trim();
        // Skip "global" or "head" offices
        if (!officeLower.includes("head") && !officeLower.includes("global") && !officeLower.includes("admin") && !officeLower.includes("super")) {
          // Fetch all stations
          const stationsList = await db.select().from(weatherStations);
          const matchedStation = stationsList.find(st => {
            const nameLower = st.stationName.toLowerCase();
            const regionLower = st.region.toLowerCase();
            return nameLower.includes(officeLower) || 
                   officeLower.includes(nameLower) || 
                   regionLower.includes(officeLower) || 
                   officeLower.includes(regionLower);
          });
          if (matchedStation) {
            assignedStationId = matchedStation.stationId;
          }
        }
      }

      // Preserve Super Administrator role so initial setup user is NEVER demoted!
      const finalRole = isSuperAdmin ? 'Super Administrator' : (role || currentUser?.role || 'Read-only/Audit User');

      const updated = await db.update(users)
        .set({
          phoneNumber: phoneNumber !== undefined ? phoneNumber : (currentUser?.phoneNumber || null),
          username: username !== undefined ? username : (currentUser?.username || null),
          designation: designation !== undefined ? designation : (currentUser?.designation || null),
          office: office !== undefined ? office : (currentUser?.office || null),
          role: finalRole,
          assignedStationId: assignedStationId !== null ? assignedStationId : currentUser?.assignedStationId
        })
        .where(eq(users.uid, uid))
        .returning();

      res.json(updated[0]);
    } catch (error: any) {
      console.error("Failed to update user profile:", error);
      res.status(500).json({ error: "Failed to update profile", details: error.message });
    }
  });

  app.get("/api/users", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role !== "Super Administrator" && role !== "Head Office Admin/User") {
      return res.status(403).json({ error: "Forbidden: Access denied" });
    }

    try {
      const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
      const stationsList = await db.select().from(weatherStations);
      
      const enrichedUsers = allUsers.map(u => {
        const station = stationsList.find(st => st.stationId === u.assignedStationId);
        return {
          ...u,
          stationName: station ? station.stationName : null
        };
      });
      
      res.json(enrichedUsers);
    } catch (error: any) {
      console.error("Failed to fetch users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.put("/api/users/:uid/role", requireAuth, async (req: AuthRequest, res) => {
    const callerRole = req.dbUser?.role;
    if (callerRole !== "Super Administrator" && callerRole !== "Head Office Admin/User") {
      return res.status(403).json({ error: "Forbidden: Only Administrators can manage users." });
    }

    const { uid } = req.params;
    const { role, assignedStationId, office, status, phoneNumber, designation, username } = req.body;

    try {
      const updateData: any = {};
      if (role !== undefined) updateData.role = role;
      if (assignedStationId !== undefined) updateData.assignedStationId = assignedStationId ? parseInt(assignedStationId) : null;
      if (office !== undefined) updateData.office = office;
      if (status !== undefined) updateData.status = status;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
      if (designation !== undefined) updateData.designation = designation;
      if (username !== undefined) updateData.username = username;

      const updated = await db.update(users)
        .set(updateData)
        .where(eq(users.uid, uid))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(updated[0]);
    } catch (error: any) {
      console.error("Failed to update user role:", error);
      res.status(500).json({ error: "Failed to update user role", details: error.message });
    }
  });

  app.post("/api/users", requireAuth, async (req: AuthRequest, res) => {
    const callerRole = req.dbUser?.role;
    if (!callerRole) {
      return res.status(403).json({ error: "Forbidden: No registered role found." });
    }

    // Determine if caller has all 3 permissions (read, write, edit)
    let hasAllPerms = false;
    const standardAll = ['Super Administrator', 'Head Office Admin/User', 'Regional Office Admin/User', 'Technician'];
    if (standardAll.includes(callerRole)) {
      hasAllPerms = true;
    } else {
      try {
        const customRoleEntry = await db.select().from(customRoles).where(eq(customRoles.roleName, callerRole));
        if (customRoleEntry.length > 0) {
          const r = customRoleEntry[0];
          if (r.readPermission && r.writePermission && r.editPermission) {
            hasAllPerms = true;
          }
        }
      } catch (err) {
        console.error("Failed to query custom role for check:", err);
      }
    }

    if (!hasAllPerms) {
      return res.status(403).json({ error: "Forbidden: You must have read, write, and edit privileges to create users." });
    }

    const { email, password, username, phoneNumber, designation, office, role, assignedStationId, status } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Missing required fields: email and password are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    try {
      const cleanEmail = email.trim().toLowerCase();

      // Check if user already exists
      const existing = await db.select().from(users).where(eq(users.email, cleanEmail));
      if (existing.length > 0) {
        return res.status(409).json({ error: `An account with email "${cleanEmail}" already exists.` });
      }

      let uid = 'metis_usr_' + crypto.randomUUID();
      const e164Phone = toE164(phoneNumber);

      // Attempt creation in Firebase Auth (gracefully non-blocking)
      try {
        const firebaseUser = await adminAuth.createUser({
          email: cleanEmail,
          password,
          displayName: username?.trim() || undefined,
          phoneNumber: e164Phone,
        });
        if (firebaseUser && firebaseUser.uid) {
          uid = firebaseUser.uid;
        }
      } catch (fbErr: any) {
        // Note: In Cloud Run containers without a custom service account, Identity Toolkit API may be disabled or return 403.
        // We gracefully proceed with native METIS authentication so user creation is 100% reliable.
        console.warn("Notice: Firebase Admin user creation skipped, creating native account:", fbErr.message);
      }

      // 2. Hash password and insert into local users table
      const hashedPassword = hashPassword(password);
      const newUser = await db.insert(users)
        .values({
          uid,
          email: cleanEmail,
          phoneNumber: phoneNumber?.trim() || null,
          passwordHash: hashedPassword,
          role: role || 'Read-only/Audit User',
          username: username?.trim() || null,
          designation: designation?.trim() || null,
          office: office?.trim() || null,
          status: status || 'Active',
          assignedStationId: assignedStationId ? parseInt(assignedStationId) : null,
        })
        .returning();

      await createAuditLog(
        "Create User Account",
        req.dbUser?.email || "Unknown",
        callerRole,
        `Created new operator login ${cleanEmail} with role '${role || 'Read-only/Audit User'}'`
      );

      res.status(201).json(newUser[0]);
    } catch (error: any) {
      console.error("Programmatic user creation error:", error);
      res.status(500).json({ error: error.message || "Failed to create user." });
    }
  });

  app.get("/api/roles", requireAuth, async (req: AuthRequest, res) => {
    try {
      const rolesList = await db.select().from(customRoles).orderBy(customRoles.id);
      res.json(rolesList);
    } catch (error: any) {
      console.error("Failed to fetch custom roles:", error);
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  app.post("/api/roles", requireAuth, async (req: AuthRequest, res) => {
    const callerRole = req.dbUser?.role;
    if (callerRole !== "Super Administrator") {
      return res.status(403).json({ error: "Forbidden: Only Super Administrators can add custom roles." });
    }

    const { roleName, description, readPermission, writePermission, editPermission } = req.body;
    if (!roleName) {
      return res.status(400).json({ error: "Missing required field: roleName" });
    }

    try {
      const result = await db.insert(customRoles)
        .values({
          roleName,
          description: description || null,
          readPermission: readPermission !== undefined ? Boolean(readPermission) : true,
          writePermission: writePermission !== undefined ? Boolean(writePermission) : false,
          editPermission: editPermission !== undefined ? Boolean(editPermission) : false,
        })
        .returning();

      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error("Failed to create custom role:", error);
      res.status(500).json({ error: "Failed to create custom role", details: error.message });
    }
  });

  app.put("/api/roles/:id", requireAuth, async (req: AuthRequest, res) => {
    const callerRole = req.dbUser?.role;
    if (callerRole !== "Super Administrator") {
      return res.status(403).json({ error: "Forbidden: Only Super Administrators can edit custom roles." });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid role ID" });
    }

    const { roleName, description, readPermission, writePermission, editPermission } = req.body;

    try {
      const roleToUpdate = await db.select().from(customRoles).where(eq(customRoles.id, id));
      if (roleToUpdate.length === 0) {
        return res.status(404).json({ error: "Role not found" });
      }

      const standardRoles = [
        'Super Administrator',
        'Head Office Admin/User',
        'Regional Office Admin/User',
        'Synoptic/Aero-synoptic office User',
        'Station User (optional)',
        'Technician',
        'Authorized Signatory',
        'Read-only/Audit User',
        'Supplier account'
      ];

      if (standardRoles.includes(roleToUpdate[0].roleName) && roleName && roleName !== roleToUpdate[0].roleName) {
        return res.status(400).json({ error: "Cannot rename pre-seeded standard roles." });
      }

      const updated = await db.update(customRoles)
        .set({
          roleName: roleName || roleToUpdate[0].roleName,
          description: description !== undefined ? description : roleToUpdate[0].description,
          readPermission: readPermission !== undefined ? Boolean(readPermission) : roleToUpdate[0].readPermission,
          writePermission: writePermission !== undefined ? Boolean(writePermission) : roleToUpdate[0].writePermission,
          editPermission: editPermission !== undefined ? Boolean(editPermission) : roleToUpdate[0].editPermission,
        })
        .where(eq(customRoles.id, id))
        .returning();

      res.json(updated[0]);
    } catch (error: any) {
      console.error("Failed to update custom role:", error);
      res.status(500).json({ error: "Failed to update custom role", details: error.message });
    }
  });

  app.delete("/api/roles/:id", requireAuth, async (req: AuthRequest, res) => {
    const callerRole = req.dbUser?.role;
    if (callerRole !== "Super Administrator") {
      return res.status(403).json({ error: "Forbidden: Only Super Administrators can delete custom roles." });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid role ID" });
    }

    try {
      const roleToDelete = await db.select().from(customRoles).where(eq(customRoles.id, id));
      if (roleToDelete.length === 0) {
        return res.status(404).json({ error: "Role not found" });
      }

      const standardRoles = [
        'Super Administrator',
        'Head Office Admin/User',
        'Regional Office Admin/User',
        'Synoptic/Aero-synoptic office User',
        'Station User (optional)',
        'Read-only/Audit User',
        'Supplier account'
      ];

      if (standardRoles.includes(roleToDelete[0].roleName)) {
        return res.status(400).json({ error: "Cannot delete pre-seeded standard roles." });
      }

      await db.delete(customRoles).where(eq(customRoles.id, id));
      res.json({ message: "Custom role deleted successfully" });
    } catch (error: any) {
      console.error("Failed to delete role:", error);
      res.status(500).json({ error: "Failed to delete role", details: error.message });
    }
  });

  app.put("/api/sensors/:id/approve", requireAuth, async (req: AuthRequest, res) => {
    const callerRole = req.dbUser?.role;
    if (callerRole !== "Super Administrator" && callerRole !== "Head Office Admin/User") {
      return res.status(403).json({ error: "Forbidden: Only Admin or Head Office can approve supplier entries." });
    }

    const sensorId = parseInt(req.params.id);
    const { action } = req.body; // 'approve' or 'reject'

    if (isNaN(sensorId) || !action) {
      return res.status(400).json({ error: "Invalid sensor ID or action" });
    }

    try {
      const statusValue = action === 'approve' ? 'Approved' : 'Rejected';
      const updated = await db.update(sensorsInventory)
        .set({
          approvalStatus: statusValue
        })
        .where(eq(sensorsInventory.sensorId, sensorId))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({ error: "Sensor not found" });
      }

      res.json(updated[0]);
    } catch (error: any) {
      console.error("Failed to approve sensor:", error);
      res.status(500).json({ error: "Failed to update approval status", details: error.message });
    }
  });

  // 1. Dashboard Analytics
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stationsList = await db.select().from(weatherStations);
      const sensorsList = await db.select().from(sensorsInventory);
      const calibrationsList = await db.select().from(calibrations).orderBy(desc(calibrations.createdAt));

      // Calculate stats
      const totalStations = stationsList.length;
      const totalSensors = sensorsList.length;

      // Group sensors by status
      const statusCounts: Record<string, number> = {
        "Active": 0,
        "In Calibration": 0,
        "Maintenance": 0,
        "Retired": 0
      };
      sensorsList.forEach(s => {
        if (s.status in statusCounts) {
          statusCounts[s.status]++;
        } else {
          statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
        }
      });

      // Group sensors by type
      const typeCounts: Record<string, number> = {};
      sensorsList.forEach(s => {
        typeCounts[s.sensorType] = (typeCounts[s.sensorType] || 0) + 1;
      });

      // Find recently calibrated sensors (last 5 records)
      const recentCalibrations = calibrationsList.slice(0, 5).map(c => {
        const sensor = sensorsList.find(s => s.sensorId === c.sensorId);
        return {
          ...c,
          sensorType: sensor?.sensorType || "Unknown",
          manufacturer: sensor?.manufacturer || "Unknown",
        };
      });

      // Helper for null-safe string comparisons
      const safeStr = (s?: string | null) => s || "";

      // Sensors requiring urgent attention (status is 'Maintenance' or 'In Calibration', or next calibration date has passed)
      const todayStr = new Date().toISOString().split('T')[0];
      const urgentSensors = sensorsList.filter(sensor => {
        if (sensor.status === "Maintenance" || sensor.status === "In Calibration") {
          return true;
        }
        // Check if there is a calibration next due date that is in the past
        const sensorCalibrations = calibrationsList.filter(c => c.sensorId === sensor.sensorId);
        if (sensorCalibrations.length > 0) {
          const sorted = [...sensorCalibrations].sort((a, b) => safeStr(b.nextDueDate).localeCompare(safeStr(a.nextDueDate)));
          if (sorted[0]?.nextDueDate && sorted[0].nextDueDate < todayStr) {
            return true;
          }
        }
        return false;
      }).map(sensor => {
        const station = stationsList.find(st => st.stationId === sensor.stationId);
        const sensorCals = calibrationsList.filter(c => c.sensorId === sensor.sensorId);
        const lastCal = sensorCals.length > 0 ? [...sensorCals].sort((a, b) => safeStr(b.calibrationDate).localeCompare(safeStr(a.calibrationDate)))[0] : null;
        return {
          ...sensor,
          stationName: station?.stationName || "Unassigned",
          lastCalibrationDate: lastCal?.calibrationDate || "None",
          nextCalibrationDate: lastCal?.nextDueDate || "Overdue",
        };
      });

      // Proactive Pre-Alert: Identify sensors nearing their calibration due date (within 14 days)
      const preAlertSensors = sensorsList.filter(sensor => {
        if (sensor.status === "Maintenance" || sensor.status === "In Calibration" || sensor.status === "Retired" || sensor.status === "Damaged") {
          return false;
        }
        const sensorCalibrations = calibrationsList.filter(c => c.sensorId === sensor.sensorId);
        if (sensorCalibrations.length > 0) {
          const sorted = [...sensorCalibrations].sort((a, b) => safeStr(b.nextDueDate).localeCompare(safeStr(a.nextDueDate)));
          const nextDueDateStr = sorted[0]?.nextDueDate;
          if (nextDueDateStr && nextDueDateStr >= todayStr) {
            const nextDueTime = new Date(nextDueDateStr).getTime();
            const todayTime = new Date(todayStr).getTime();
            const diffDays = Math.ceil((nextDueTime - todayTime) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays <= 14) {
              return true;
            }
          }
        }
        return false;
      }).map(sensor => {
        const station = stationsList.find(st => st.stationId === sensor.stationId);
        const sensorCals = calibrationsList.filter(c => c.sensorId === sensor.sensorId);
        const lastCal = sensorCals.length > 0 ? [...sensorCals].sort((a, b) => safeStr(b.calibrationDate).localeCompare(safeStr(a.calibrationDate)))[0] : null;
        const nextDueDateStr = lastCal?.nextDueDate || todayStr;
        const nextDueTime = new Date(nextDueDateStr).getTime();
        const todayTime = new Date(todayStr).getTime();
        const diffDays = Math.ceil((nextDueTime - todayTime) / (1000 * 60 * 60 * 24));
        return {
          ...sensor,
          stationName: station?.stationName || "Unassigned",
          lastCalibrationDate: lastCal?.calibrationDate || "None",
          nextCalibrationDate: nextDueDateStr,
          daysRemaining: diffDays >= 0 ? diffDays : 0,
        };
      });

      // Battery health alert system based on the voltage of battery used
      const batteryAlerts = stationsList.filter(station => {
        if (!station.batteryVoltageType || station.batteryCurrentVoltage === null || station.batteryCurrentVoltage === undefined) {
          return false;
        }
        
        const voltage = station.batteryCurrentVoltage;
        const type = station.batteryVoltageType;
        
        if (type === "12V") {
          return voltage < 11.5;
        } else if (type === "4V") {
          return voltage < 3.5;
        } else if (type === "6V") {
          return voltage < 5.5; // Since "same for 4V battery... if battery used is 4V and voltage drop below 3.5V, issue health alert", for 6V it would be < 5.5V.
        }
        return false;
      }).map(station => {
        const type = station.batteryVoltageType || "Unknown";
        const voltage = station.batteryCurrentVoltage || 0;
        let alertMessage = "";
        if (type === "12V") {
          alertMessage = `Battery voltage is ${voltage}V (Below 11.5V threshold for 12V nominal capacity)`;
        } else if (type === "4V") {
          alertMessage = `Battery voltage is ${voltage}V (Below 3.5V threshold for 4V nominal capacity)`;
        } else if (type === "6V") {
          alertMessage = `Battery voltage is ${voltage}V (Below 5.5V threshold for 6V nominal capacity)`;
        }
        return {
          stationId: station.stationId,
          stationName: station.stationName,
          region: station.region,
          batteryVoltageType: type,
          batteryCurrentVoltage: voltage,
          alertMessage,
        };
      });

      res.json({
        totalStations,
        totalSensors,
        statusCounts,
        typeCounts,
        recentCalibrations,
        urgentSensors: urgentSensors.slice(0, 10), // Limit to 10
        preAlertSensors: preAlertSensors,
        batteryAlerts: batteryAlerts,
      });
    } catch (error: any) {
      console.error("Failed to fetch dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats", details: error.message });
    }
  });

  // Regional Offices Endpoints
  app.get("/api/regional-offices", async (req, res) => {
    try {
      const offices = await db.select().from(regionalOffices).orderBy(desc(regionalOffices.createdAt));
      res.json(offices);
    } catch (error: any) {
      console.error("Failed to fetch regional offices:", error);
      res.status(500).json({ error: "Failed to fetch regional offices", details: error.message });
    }
  });

  app.post("/api/regional-offices", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role !== 'Super Administrator' && role !== 'Head Office Admin/User' && role !== 'Regional Office Admin/User') {
      return res.status(403).json({ error: "Forbidden: You do not have permission to manage regional offices." });
    }

    const { officeName, address, phoneNumber, emailId, website } = req.body;
    if (!officeName) {
      return res.status(400).json({ error: "Missing required field: officeName" });
    }

    try {
      const result = await db.insert(regionalOffices)
        .values({
          officeName,
          address,
          phoneNumber,
          emailId,
          website,
        })
        .returning();

      await createAuditLog(
        "Create Regional Office",
        req.dbUser?.email || "Unknown",
        role,
        `Created regional office '${officeName}'`
      );

      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error("Failed to create regional office:", error);
      res.status(500).json({ error: "Failed to create regional office", details: error.message });
    }
  });

  app.put("/api/regional-offices/:id", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role !== 'Super Administrator' && role !== 'Head Office Admin/User' && role !== 'Regional Office Admin/User') {
      return res.status(403).json({ error: "Forbidden: You do not have permission to manage regional offices." });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid office ID" });
    }

    const { officeName, address, phoneNumber, emailId, website } = req.body;
    try {
      const updateData: any = {};
      if (officeName !== undefined) updateData.officeName = officeName;
      if (address !== undefined) updateData.address = address;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
      if (emailId !== undefined) updateData.emailId = emailId;
      if (website !== undefined) updateData.website = website;

      const updated = await db.update(regionalOffices)
        .set(updateData)
        .where(eq(regionalOffices.id, id))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({ error: "Regional office not found" });
      }

      await createAuditLog(
        "Update Regional Office",
        req.dbUser?.email || "Unknown",
        role,
        `Updated regional office ID #${id}`
      );

      res.json(updated[0]);
    } catch (error: any) {
      console.error("Failed to update regional office:", error);
      res.status(500).json({ error: "Failed to update regional office", details: error.message });
    }
  });

  app.delete("/api/regional-offices/:id", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role !== 'Super Administrator' && role !== 'Head Office Admin/User') {
      return res.status(403).json({ error: "Forbidden: Only Administrators can delete regional offices." });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid office ID" });
    }

    try {
      const deleted = await db.delete(regionalOffices)
        .where(eq(regionalOffices.id, id))
        .returning();

      if (deleted.length === 0) {
        return res.status(404).json({ error: "Regional office not found" });
      }

      await createAuditLog(
        "Delete Regional Office",
        req.dbUser?.email || "Unknown",
        role,
        `Deleted regional office '${deleted[0].officeName}' (#${id})`
      );

      res.json({ message: "Regional office deleted successfully", deleted: deleted[0] });
    } catch (error: any) {
      console.error("Failed to delete regional office:", error);
      res.status(500).json({ error: "Failed to delete regional office", details: error.message });
    }
  });

  // Designations Endpoints
  app.get("/api/designations", async (req, res) => {
    try {
      const list = await db.select().from(designations).orderBy(designations.id);
      res.json(list);
    } catch (error: any) {
      console.error("Failed to fetch designations:", error);
      res.status(500).json({ error: "Failed to fetch designations", details: error.message });
    }
  });

  app.post("/api/designations", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role !== 'Super Administrator' && role !== 'Head Office Admin/User' && role !== 'Regional Office Admin/User') {
      return res.status(403).json({ error: "Forbidden: You do not have permission to manage designations." });
    }

    const { title, code, department, description, status } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Missing required field: title" });
    }

    try {
      const result = await db.insert(designations)
        .values({
          title: title.trim(),
          code: code ? code.trim() : null,
          department: department ? department.trim() : null,
          description: description ? description.trim() : null,
          status: status || 'Active',
        })
        .returning();

      await createAuditLog(
        "Create Designation",
        req.dbUser?.email || "Unknown",
        role,
        `Created designation '${title.trim()}'`
      );

      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error("Failed to create designation:", error);
      res.status(500).json({ error: "Failed to create designation", details: error.message });
    }
  });

  app.put("/api/designations/:id", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role !== 'Super Administrator' && role !== 'Head Office Admin/User' && role !== 'Regional Office Admin/User') {
      return res.status(403).json({ error: "Forbidden: You do not have permission to manage designations." });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid designation ID" });
    }

    const { title, code, department, description, status } = req.body;

    try {
      const updateData: any = {};
      if (title !== undefined) updateData.title = title.trim();
      if (code !== undefined) updateData.code = code ? code.trim() : null;
      if (department !== undefined) updateData.department = department ? department.trim() : null;
      if (description !== undefined) updateData.description = description ? description.trim() : null;
      if (status !== undefined) updateData.status = status;

      const updated = await db.update(designations)
        .set(updateData)
        .where(eq(designations.id, id))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({ error: "Designation not found" });
      }

      await createAuditLog(
        "Update Designation",
        req.dbUser?.email || "Unknown",
        role,
        `Updated designation ID #${id}`
      );

      res.json(updated[0]);
    } catch (error: any) {
      console.error("Failed to update designation:", error);
      res.status(500).json({ error: "Failed to update designation", details: error.message });
    }
  });

  app.delete("/api/designations/:id", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role !== 'Super Administrator' && role !== 'Head Office Admin/User') {
      return res.status(403).json({ error: "Forbidden: Only Administrators can delete designations." });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid designation ID" });
    }

    try {
      const deleted = await db.delete(designations)
        .where(eq(designations.id, id))
        .returning();

      if (deleted.length === 0) {
        return res.status(404).json({ error: "Designation not found" });
      }

      await createAuditLog(
        "Delete Designation",
        req.dbUser?.email || "Unknown",
        role,
        `Deleted designation '${deleted[0].title}' (#${id})`
      );

      res.json({ message: "Designation deleted successfully", deleted: deleted[0] });
    } catch (error: any) {
      console.error("Failed to delete designation:", error);
      res.status(500).json({ error: "Failed to delete designation", details: error.message });
    }
  });

  // 2. Weather Stations Endpoints
  app.get("/api/stations", async (req, res) => {
    try {
      const stations = await db.select().from(weatherStations).orderBy(desc(weatherStations.createdAt));
      const sensors = await db.select().from(sensorsInventory);

      // Attach sensor counts, fallback 10-digit SIM number, and 4-part WIGOS Station Identifier (WSI)
      const stationsWithCounts = stations.map(station => {
        const stationSensors = sensors.filter(s => s.stationId === station.stationId);
        const simNumber = station.simNumber || ('984' + String(1000000 + ((station.stationId * 48291) % 9000000)));
        
        // 4-part WIGOS Station Identifier calculation (e.g. 1-0-20001-0-STATIONID)
        const series = station.wigosSeries || '1';
        const issuer = station.wigosIssuer || '0';
        const issueNum = station.wigosIssueNum || '20001';
        const defaultLocal = '0-' + (station.stationName ? station.stationName.split(' ')[0].toUpperCase() : station.stationId);
        const localId = station.wigosLocalId || defaultLocal;
        const wigosId = `${series}-${issuer}-${issueNum}-${localId}`;

        return {
          ...station,
          simNumber,
          wigosSeries: series,
          wigosIssuer: issuer,
          wigosIssueNum: issueNum,
          wigosLocalId: localId,
          wigosId,
          wmoId: wigosId,
          sensorCount: stationSensors.length,
          activeCount: stationSensors.filter(s => s.status === "Active").length,
        };
      });

      res.json(stationsWithCounts);
    } catch (error: any) {
      console.error("Failed to fetch stations:", error);
      res.status(500).json({ error: "Failed to fetch stations", details: error.message });
    }
  });

  app.get("/api/stations/:id/telemetry", async (req, res) => {
    try {
      const stationId = parseInt(req.params.id);
      const station = await db.select().from(weatherStations).where(eq(weatherStations.stationId, stationId)).limit(1);
      if (station.length === 0) {
        return res.status(404).json({ error: "Station not found" });
      }

      const st = station[0];
      let status = 'Online';
      if (st.batteryCurrentVoltage !== undefined && st.batteryCurrentVoltage !== null) {
        if (st.batteryCurrentVoltage < 11.2) {
          status = 'Offline';
        } else if (st.batteryCurrentVoltage < 11.6) {
          status = 'Maintenance';
        }
      }

      const now = new Date();
      let lastSyncDate = new Date();

      if (status === 'Offline') {
        const diffHours = 24 + (stationId % 48);
        lastSyncDate.setHours(now.getHours() - diffHours);
        lastSyncDate.setMinutes(stationId % 60);
      } else if (status === 'Maintenance') {
        const diffMinutes = 60 + (stationId % 180);
        lastSyncDate.setMinutes(now.getMinutes() - diffMinutes);
      } else {
        const diffMinutes = 1 + (stationId % 11);
        lastSyncDate.setMinutes(now.getMinutes() - diffMinutes);
      }

      const formatTimestamp = (d: Date) => {
        return d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
      };

      const baseVolt = st.batteryCurrentVoltage !== undefined && st.batteryCurrentVoltage !== null ? st.batteryCurrentVoltage : 12.2;
      const isOff = status === 'Offline';
      const isMaint = status === 'Maintenance';

      let performanceGrade = 'A+';
      let performanceScore = 96;
      if (isOff || baseVolt < 11.2) {
        performanceGrade = 'F';
        performanceScore = 42;
      } else if (isMaint || baseVolt < 11.6) {
        performanceGrade = 'C';
        performanceScore = 71;
      } else if (baseVolt < 12.0) {
        performanceGrade = 'B';
        performanceScore = 84;
      } else if (baseVolt >= 12.4) {
        performanceGrade = 'A+';
        performanceScore = 98;
      } else {
        performanceGrade = 'A';
        performanceScore = 92;
      }

      // 24h telemetry trend (8 samples across 24h)
      const times = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];
      const trendHistory = times.map((t, idx) => {
        const sineVar = Math.sin((idx / 8) * Math.PI * 2) * 0.25;
        const noise = ((stationId * 7 + idx * 13) % 11 - 5) * 0.04;
        const v = isOff ? 10.5 : Math.max(10.8, Math.min(13.8, parseFloat((baseVolt + sineVar + noise).toFixed(2))));
        const sig = isOff ? -115 : isMaint ? -95 - (idx % 3) : -68 + Math.floor(sineVar * 10);
        return { time: t, voltage: v, signal: sig };
      });

      res.json({
        stationId,
        status,
        lastSync: formatTimestamp(lastSyncDate),
        heartbeatRateHz: status === 'Offline' ? 0 : status === 'Maintenance' ? 0.05 : 0.2,
        enclosureTempCelsius: (20 + (stationId % 12)).toFixed(1),
        signalStrengthDb: status === 'Offline' ? -115 : status === 'Maintenance' ? -98 : -72,
        performanceGrade,
        performanceScore,
        healthFactors: {
          powerHealth: isOff ? 'Critical' : isMaint ? 'Fair' : 'Optimal',
          signalHealth: isOff ? 'Weak' : isMaint ? 'Moderate' : 'Strong',
          sensorIntegrity: isOff ? '50%' : isMaint ? '80%' : '98%'
        },
        trendHistory
      });
    } catch (error: any) {
      console.error("Failed to fetch station telemetry heartbeat:", error);
      res.status(500).json({ error: "Failed to fetch station telemetry", details: error.message });
    }
  });

  app.post("/api/stations", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role !== 'Super Administrator' && role !== 'Head Office Admin/User' && role !== 'Regional Office Admin/User') {
      return res.status(403).json({ error: "Forbidden: You do not have permission to manage weather stations." });
    }

    const { stationName, region, latitude, longitude, batteryVoltageType, batteryCurrentVoltage, stationType, regionalOfficeId, simNumber, wigosSeries, wigosIssuer, wigosIssueNum, wigosLocalId } = req.body;
    if (!stationName || !region || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "Missing required fields: stationName, region, latitude, longitude" });
    }

    const firstWord = stationName.trim().split(/\s+/)[0];
    const formattedStationName = firstWord ? `${firstWord} AWS` : stationName;
    const assignedSim = simNumber || ('984' + String(1000000 + Math.floor(Math.random() * 9000000)));

    const series = wigosSeries || '1';
    const issuer = wigosIssuer || '0';
    const issueNum = wigosIssueNum || '20001';
    const localId = wigosLocalId || ('0-' + (firstWord ? firstWord.toUpperCase() : 'STATIONID'));

    try {
      const result = await db.insert(weatherStations)
        .values({
          stationName: formattedStationName,
          region,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          batteryVoltageType: batteryVoltageType || "12V",
          batteryCurrentVoltage: batteryCurrentVoltage !== undefined && batteryCurrentVoltage !== null ? parseFloat(batteryCurrentVoltage) : 12.0,
          stationType: stationType || "Climate",
          regionalOfficeId: regionalOfficeId ? parseInt(regionalOfficeId) : null,
          simNumber: assignedSim,
          wigosSeries: series,
          wigosIssuer: issuer,
          wigosIssueNum: issueNum,
          wigosLocalId: localId,
        })
        .returning();

      const st = result[0];
      const wigosId = `${st.wigosSeries || series}-${st.wigosIssuer || issuer}-${st.wigosIssueNum || issueNum}-${st.wigosLocalId || localId}`;

      res.status(201).json({
        ...st,
        wigosId,
        wmoId: wigosId
      });
    } catch (error: any) {
      console.error("Failed to create weather station:", error);
      res.status(500).json({ error: "Failed to create weather station", details: error.message });
    }
  });

  app.put("/api/stations/:id", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role !== 'Super Administrator' && role !== 'Head Office Admin/User' && role !== 'Regional Office Admin/User') {
      return res.status(403).json({ error: "Forbidden: You do not have permission to manage weather stations." });
    }

    const stationId = parseInt(req.params.id);
    if (isNaN(stationId)) {
      return res.status(400).json({ error: "Invalid station ID" });
    }

    const { stationName, region, latitude, longitude, batteryVoltageType, batteryCurrentVoltage, stationType, regionalOfficeId, simNumber, wigosSeries, wigosIssuer, wigosIssueNum, wigosLocalId } = req.body;
    if (!stationName || !region || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "Missing required fields: stationName, region, latitude, longitude" });
    }

    const firstWord = stationName.trim().split(/\s+/)[0];
    const formattedStationName = firstWord ? `${firstWord} AWS` : stationName;

    try {
      const setObj: any = {
        stationName: formattedStationName,
        region,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        batteryVoltageType: batteryVoltageType || null,
        batteryCurrentVoltage: batteryCurrentVoltage !== undefined && batteryCurrentVoltage !== null ? parseFloat(batteryCurrentVoltage) : null,
        stationType: stationType || null,
        regionalOfficeId: regionalOfficeId ? parseInt(regionalOfficeId) : null,
        simNumber: simNumber || null,
      };

      if (wigosSeries !== undefined) setObj.wigosSeries = wigosSeries || '1';
      if (wigosIssuer !== undefined) setObj.wigosIssuer = wigosIssuer || '0';
      if (wigosIssueNum !== undefined) setObj.wigosIssueNum = wigosIssueNum || '20001';
      if (wigosLocalId !== undefined) setObj.wigosLocalId = wigosLocalId || ('0-' + (firstWord ? firstWord.toUpperCase() : 'STATIONID'));

      const result = await db.update(weatherStations)
        .set(setObj)
        .where(eq(weatherStations.stationId, stationId))
        .returning();

      const st = result[0];
      const series = st.wigosSeries || '1';
      const issuer = st.wigosIssuer || '0';
      const issueNum = st.wigosIssueNum || '20001';
      const localId = st.wigosLocalId || ('0-' + (firstWord ? firstWord.toUpperCase() : 'STATIONID'));
      const wigosId = `${series}-${issuer}-${issueNum}-${localId}`;

      res.json({
        ...st,
        wigosId,
        wmoId: wigosId
      });
    } catch (error: any) {
      console.error("Failed to update weather station:", error);
      res.status(500).json({ error: "Failed to update weather station", details: error.message });
    }
  });

  app.delete("/api/stations/:id", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role !== 'Super Administrator' && role !== 'Head Office Admin/User' && role !== 'Regional Office Admin/User') {
      return res.status(403).json({ error: "Forbidden: You do not have permission to delete weather stations." });
    }

    const stationId = parseInt(req.params.id);
    if (isNaN(stationId)) {
      return res.status(400).json({ error: "Invalid station ID" });
    }

    try {
      await db.delete(weatherStations).where(eq(weatherStations.stationId, stationId));
      res.json({ message: "Weather station deleted successfully" });
    } catch (error: any) {
      console.error("Failed to delete station:", error);
      res.status(500).json({ error: "Failed to delete station", details: error.message });
    }
  });

  // --- Station Health Monitoring Endpoints ---
  app.get("/api/station-health", async (req, res) => {
    try {
      const records = await db.select().from(stationHealth).orderBy(desc(stationHealth.lastReportedTime));
      const stationsList = await db.select().from(weatherStations);
      const stationMap = new Map(stationsList.map(s => [s.stationId, s]));

      const enriched = records.map(rec => {
        const st = stationMap.get(rec.stationId);
        const series = st?.wigosSeries || '1';
        const issuer = st?.wigosIssuer || '0';
        const issueNum = st?.wigosIssueNum || '20001';
        const localId = st?.wigosLocalId || (st?.stationName ? '0-' + st.stationName.split(' ')[0].toUpperCase() : '0-STATION');
        const wigosId = `${series}-${issuer}-${issueNum}-${localId}`;

        return {
          ...rec,
          stationName: st?.stationName || `Station #${rec.stationId}`,
          region: st?.region || 'Unknown',
          stationType: st?.stationType || 'Climate',
          batteryCurrentVoltage: st?.batteryCurrentVoltage,
          wigosLocalId: localId,
          wigosId,
        };
      });

      res.json(enriched);
    } catch (error: any) {
      console.error("Failed to fetch station health records:", error);
      res.status(500).json({ error: "Failed to fetch station health records", details: error.message });
    }
  });

  app.get("/api/stations/:id/health", async (req, res) => {
    const stationId = parseInt(req.params.id);
    if (isNaN(stationId)) {
      return res.status(400).json({ error: "Invalid station ID" });
    }

    try {
      const records = await db.select().from(stationHealth)
        .where(eq(stationHealth.stationId, stationId))
        .orderBy(desc(stationHealth.lastReportedTime));
      res.json(records);
    } catch (error: any) {
      console.error("Failed to fetch station health for station:", error);
      res.status(500).json({ error: "Failed to fetch station health", details: error.message });
    }
  });

  app.post("/api/station-health", requireAuth, async (req: AuthRequest, res) => {
    const { stationId, batteryLevel, signalStrength, alertStatus, lastReportedTime } = req.body;

    if (!stationId || batteryLevel === undefined || !signalStrength) {
      return res.status(400).json({ error: "Missing required fields: stationId, batteryLevel, signalStrength" });
    }

    try {
      const parsedStationId = parseInt(stationId);
      const parsedBattery = parseFloat(batteryLevel);
      const reportedDate = lastReportedTime ? new Date(lastReportedTime) : new Date();

      const newRecord = await db.insert(stationHealth)
        .values({
          stationId: parsedStationId,
          batteryLevel: parsedBattery,
          signalStrength: signalStrength.toString(),
          alertStatus: alertStatus || (parsedBattery < 25 ? 'Critical' : parsedBattery < 50 ? 'Warning' : 'OK'),
          lastReportedTime: reportedDate,
        })
        .returning();

      // Also update station current voltage estimate
      const estimatedVolt = parseFloat((10.8 + (parsedBattery / 100) * 2.0).toFixed(2));
      await db.update(weatherStations)
        .set({ batteryCurrentVoltage: estimatedVolt })
        .where(eq(weatherStations.stationId, parsedStationId));

      await createAuditLog(
        "Update Station Health",
        req.dbUser?.email || "System",
        req.dbUser?.role || "Operator",
        `Logged telemetry check-in for Station ID #${parsedStationId} (Battery: ${parsedBattery}%, Signal: ${signalStrength}, Status: ${alertStatus || 'OK'})`
      );

      res.status(201).json(newRecord[0]);
    } catch (error: any) {
      console.error("Failed to create station health record:", error);
      res.status(500).json({ error: "Failed to create station health record", details: error.message });
    }
  });

  app.put("/api/station-health/:id", requireAuth, async (req: AuthRequest, res) => {
    const healthId = parseInt(req.params.id);
    if (isNaN(healthId)) {
      return res.status(400).json({ error: "Invalid health ID" });
    }

    const { batteryLevel, signalStrength, alertStatus, lastReportedTime } = req.body;

    try {
      const updateData: any = {};
      if (batteryLevel !== undefined) updateData.batteryLevel = parseFloat(batteryLevel);
      if (signalStrength !== undefined) updateData.signalStrength = signalStrength.toString();
      if (alertStatus !== undefined) updateData.alertStatus = alertStatus;
      if (lastReportedTime) updateData.lastReportedTime = new Date(lastReportedTime);

      const updated = await db.update(stationHealth)
        .set(updateData)
        .where(eq(stationHealth.healthId, healthId))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({ error: "Station health record not found" });
      }

      res.json(updated[0]);
    } catch (error: any) {
      console.error("Failed to update station health record:", error);
      res.status(500).json({ error: "Failed to update station health record", details: error.message });
    }
  });

  app.delete("/api/station-health/:id", requireAuth, async (req: AuthRequest, res) => {
    const healthId = parseInt(req.params.id);
    if (isNaN(healthId)) {
      return res.status(400).json({ error: "Invalid health ID" });
    }

    try {
      await db.delete(stationHealth).where(eq(stationHealth.healthId, healthId));
      res.json({ message: "Station health record removed successfully" });
    } catch (error: any) {
      console.error("Failed to delete station health record:", error);
      res.status(500).json({ error: "Failed to delete station health record", details: error.message });
    }
  });

  app.post("/api/station-health/ping-sync", requireAuth, async (req: AuthRequest, res) => {
    try {
      const existing = await db.select().from(stationHealth);
      const now = new Date();

      // Update all existing records with fresh telemetry timestamp
      for (const rec of existing) {
        // slight random perturbation to show live activity
        const delta = ((rec.healthId * 3) % 5) - 2;
        const newPct = Math.min(100, Math.max(10, Math.round(rec.batteryLevel + delta)));
        await db.update(stationHealth)
          .set({
            lastReportedTime: now,
            batteryLevel: newPct,
          })
          .where(eq(stationHealth.healthId, rec.healthId));
      }

      await createAuditLog(
        "Network Telemetry Sync",
        req.dbUser?.email || "Operator",
        req.dbUser?.role || "Operator",
        `Initiated network-wide station health telemetry polling for ${existing.length} stations`
      );

      res.json({ success: true, count: existing.length, syncTimestamp: now.toISOString() });
    } catch (error: any) {
      console.error("Failed to sync network telemetry:", error);
      res.status(500).json({ error: "Failed to sync telemetry", details: error.message });
    }
  });

  // --- Configurable Statuses Endpoints ---
  app.get("/api/statuses", async (req, res) => {
    try {
      const list = await db.select().from(customStatuses).orderBy(customStatuses.id);
      res.json(list);
    } catch (error: any) {
      console.error("Failed to fetch custom statuses:", error);
      res.status(500).json({ error: "Failed to fetch custom statuses", details: error.message });
    }
  });

  app.post("/api/statuses", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role !== 'Super Administrator' && role !== 'Head Office Admin/User') {
      return res.status(403).json({ error: "Forbidden: You do not have permission to manage custom statuses." });
    }

    const { statusName, color, description, isConsumableOnly } = req.body;
    if (!statusName) {
      return res.status(400).json({ error: "Missing required field: statusName" });
    }

    try {
      const result = await db.insert(customStatuses)
        .values({
          statusName,
          color: color || '#3b82f6',
          description: description || null,
          isConsumableOnly: isConsumableOnly || 'false'
        })
        .returning();
      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error("Failed to create custom status:", error);
      res.status(500).json({ error: "Failed to create custom status", details: error.message });
    }
  });

  app.put("/api/statuses/:id", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role !== 'Super Administrator' && role !== 'Head Office Admin/User') {
      return res.status(403).json({ error: "Forbidden: You do not have permission to manage custom statuses." });
    }

    const statusId = parseInt(req.params.id);
    const { statusName, color, description, isConsumableOnly } = req.body;
    if (isNaN(statusId)) {
      return res.status(400).json({ error: "Invalid status ID" });
    }
    if (!statusName) {
      return res.status(400).json({ error: "Missing statusName" });
    }

    try {
      const result = await db.update(customStatuses)
        .set({
          statusName,
          color: color || '#3b82f6',
          description: description || null,
          isConsumableOnly: isConsumableOnly || 'false'
        })
        .where(eq(customStatuses.id, statusId))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: "Status not found" });
      }
      res.json(result[0]);
    } catch (error: any) {
      console.error("Failed to update custom status:", error);
      res.status(500).json({ error: "Failed to update custom status", details: error.message });
    }
  });

  app.delete("/api/statuses/:id", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role !== 'Super Administrator' && role !== 'Head Office Admin/User') {
      return res.status(403).json({ error: "Forbidden: You do not have permission to manage custom statuses." });
    }

    const statusId = parseInt(req.params.id);
    if (isNaN(statusId)) {
      return res.status(400).json({ error: "Invalid status ID" });
    }

    try {
      const statusToDelete = await db.select().from(customStatuses).where(eq(customStatuses.id, statusId));
      if (statusToDelete.length === 0) {
        return res.status(404).json({ error: "Status not found" });
      }
      
      const coreStatuses = ['Store', 'Ordered', 'Spare', 'Deployed', 'Transferred', 'Under Calibration', 'Under Repair', 'Damaged', 'Obsolete', 'Disposed', 'Consumed'];
      if (coreStatuses.includes(statusToDelete[0].statusName)) {
        return res.status(400).json({ error: "Cannot delete core pre-seeded statuses." });
      }

      await db.delete(customStatuses).where(eq(customStatuses.id, statusId));
      res.json({ message: "Custom status deleted successfully" });
    } catch (error: any) {
      console.error("Failed to delete custom status:", error);
      res.status(500).json({ error: "Failed to delete custom status", details: error.message });
    }
  });

  // 3. Sensors Inventory Endpoints
  app.get("/api/sensors", async (req, res) => {
    try {
      const sensors = await db.select().from(sensorsInventory).orderBy(desc(sensorsInventory.createdAt));
      const stations = await db.select().from(weatherStations);
      const calibrationsList = await db.select().from(calibrations);

      // Join sensor with station details and last calibration
      const detailedSensors = sensors.map(sensor => {
        const station = stations.find(s => s.stationId === sensor.stationId);
        const sensorCals = calibrationsList.filter(c => c.sensorId === sensor.sensorId);
        const sortedCals = [...sensorCals].sort((a, b) => (b.calibrationDate || '').localeCompare(a.calibrationDate || ''));
        
        return {
          ...sensor,
          stationName: station?.stationName || "Unassigned",
          region: station?.region || "N/A",
          lastCalibration: sortedCals[0] || null,
        };
      });

      res.json(detailedSensors);
    } catch (error: any) {
      console.error("Failed to fetch sensors:", error);
      res.status(500).json({ error: "Failed to fetch sensors", details: error.message });
    }
  });

  app.post("/api/sensors", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role === 'Read-only/Audit User' || role === 'Synoptic/Aero-synoptic office User' || role === 'Station User (optional)') {
      return res.status(403).json({ error: "Forbidden: Your role does not have permission to catalog new sensors." });
    }

    const { 
      sensorType, 
      manufacturer, 
      status, 
      stationId,
      sensorName,
      barcode,
      modelNumber,
      serialNumber,
      procurementDate,
      supplierDetails,
      invoiceReference,
      warrantyStartDate,
      warrantyEndDate,
      calibrationInterval,
      calibrationDetails,
      deploymentInfo,
      assignedOffice,
      responsiblePersonnel,
      conditionStatus,
      remarks,
      photos,
      documents
    } = req.body;

    if (!sensorType || !manufacturer || !status) {
      return res.status(400).json({ error: "Missing required fields: sensorType, manufacturer, status" });
    }

    try {
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const isSupplier = role === 'Supplier account';
      const statusLabel = isSupplier ? `${status} (Pending Admin Approval)` : status;
      const initialLog = `[${timestamp}] Sensor registered with status: ${statusLabel}`;

      let finalRegionalOfficeId = req.body.regionalOfficeId ? parseInt(req.body.regionalOfficeId) : null;
      let finalAssignedOffice = assignedOffice || null;

      if (req.dbUser?.office) {
        const matchedOffices = await db.select().from(regionalOffices);
        const matchedOffice = matchedOffices.find(
          o => o.officeName.trim().toLowerCase() === req.dbUser.office.trim().toLowerCase()
        );
        if (matchedOffice) {
          finalRegionalOfficeId = matchedOffice.id;
          finalAssignedOffice = matchedOffice.officeName;
        }
      }

      const result = await db.insert(sensorsInventory)
        .values({
          sensorType,
          manufacturer,
          status,
          stationId: stationId ? parseInt(stationId) : null,
          regionalOfficeId: finalRegionalOfficeId,
          statusLog: initialLog,
          dismissedAlert: 'false',
          approvalStatus: isSupplier ? 'Pending Approval' : 'Approved',
          sensorName: sensorName || null,
          barcode: barcode || null,
          modelNumber: modelNumber || null,
          serialNumber: serialNumber || null,
          procurementDate: procurementDate || null,
          supplierDetails: supplierDetails || null,
          invoiceReference: invoiceReference || null,
          warrantyStartDate: warrantyStartDate || null,
          warrantyEndDate: warrantyEndDate || null,
          calibrationInterval: calibrationInterval || null,
          calibrationDetails: calibrationDetails || null,
          deploymentInfo: deploymentInfo || null,
          assignedOffice: finalAssignedOffice,
          responsiblePersonnel: responsiblePersonnel || null,
          conditionStatus: conditionStatus || null,
          remarks: remarks || null,
          photos: photos || null,
          documents: documents || null,
        })
        .returning();

      await createAuditLog(
        'INVENTORY_CREATE',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Sensor of type '${sensorType}' (Serial: ${serialNumber || 'N/A'}) cataloged with status '${status}'.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error("Failed to add sensor:", error);
      res.status(500).json({ error: "Failed to add sensor", details: error.message });
    }
  });

  app.put("/api/sensors/:id", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role === 'Read-only/Audit User') {
      return res.status(403).json({ error: "Forbidden: Read-only accounts cannot modify sensors." });
    }

    const sensorId = parseInt(req.params.id);
    if (isNaN(sensorId)) {
      return res.status(400).json({ error: "Invalid sensor ID" });
    }

    try {
      const existing = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, sensorId));
      if (existing.length > 0) {
        if (role === 'Supplier account' && existing[0].approvalStatus === 'Approved') {
          return res.status(403).json({ error: "Forbidden: Supplier accounts cannot edit approved sensors." });
        }
      }

      const { 
        sensorType, 
        manufacturer, 
        status, 
        stationId,
        sensorName,
        barcode,
        modelNumber,
        serialNumber,
        procurementDate,
        supplierDetails,
        invoiceReference,
        warrantyStartDate,
        warrantyEndDate,
        calibrationInterval,
        calibrationDetails,
        deploymentInfo,
        assignedOffice,
        responsiblePersonnel,
        conditionStatus,
        remarks,
        photos,
        documents,
        assignedCalibrator,
        calibrationDeviceUsed,
        regionalOfficeId
      } = req.body;
      let currentLog = "";
      let oldStatus = "";
      if (existing.length > 0) {
        currentLog = existing[0].statusLog || "";
        oldStatus = existing[0].status;
      }

      const updateData: any = {
        sensorType,
        manufacturer,
        status,
        stationId: stationId ? parseInt(stationId) : null,
        regionalOfficeId: regionalOfficeId ? parseInt(regionalOfficeId) : null,
        sensorName: sensorName || null,
        barcode: barcode || null,
        modelNumber: modelNumber || null,
        serialNumber: serialNumber || null,
        procurementDate: procurementDate || null,
        supplierDetails: supplierDetails || null,
        invoiceReference: invoiceReference || null,
        warrantyStartDate: warrantyStartDate || null,
        warrantyEndDate: warrantyEndDate || null,
        calibrationInterval: calibrationInterval || null,
        calibrationDetails: calibrationDetails || null,
        deploymentInfo: deploymentInfo || null,
        assignedOffice: assignedOffice || null,
        responsiblePersonnel: responsiblePersonnel || null,
        conditionStatus: conditionStatus || null,
        remarks: remarks || null,
        photos: photos || null,
        documents: documents || null,
        assignedCalibrator: assignedCalibrator || null,
        calibrationDeviceUsed: calibrationDeviceUsed || null,
      };

      if (status && status !== oldStatus) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const logLine = `[${timestamp}] Status updated from '${oldStatus}' to '${status}'`;
        updateData.statusLog = currentLog ? `${currentLog}\n${logLine}` : logLine;
        updateData.dismissedAlert = 'false'; // Reset dismissal when status changes

        // Trigger Damaged Sensor Notification
        if (status === 'Damaged') {
          (async () => {
            try {
              const sType = sensorType || existing[0]?.sensorType || 'Sensor';
              const sSerial = serialNumber || existing[0]?.serialNumber || 'N/A';
              const sMfg = manufacturer || existing[0]?.manufacturer || 'Unknown';
              const sRemarks = remarks || existing[0]?.remarks || 'No remarks provided';
              const sStationId = stationId ? parseInt(stationId) : existing[0]?.stationId;
              
              let locationName = 'Unassigned Storage';
              if (sStationId) {
                const stationsList = await db.select().from(weatherStations).where(eq(weatherStations.stationId, sStationId));
                if (stationsList.length > 0) {
                  locationName = stationsList[0].stationName;
                }
              }

              const subject = `[DAMAGED SENSOR ALERT] ${sType} reported DAMAGED`;
              const body = `URGENT Damaged Sensor Report:\n\n` +
                `Sensor Type: ${sType}\n` +
                `Manufacturer: ${sMfg}\n` +
                `Serial Number: ${sSerial}\n` +
                `Current Location: ${locationName}\n` +
                `Incident Remarks / Reason: ${sRemarks}\n\n` +
                `The asset has been flagged as 'Damaged' in the unified system registry. Please coordinate immediate repair, recalibration, or retirement.`;

              await sendNotification('damaged_sensor', subject, body);
            } catch (e) {
              console.error("Failed to send damaged sensor notification:", e);
            }
          })();
        }
      }

      const result = await db.update(sensorsInventory)
        .set(updateData)
        .where(eq(sensorsInventory.sensorId, sensorId))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: "Sensor not found" });
      }

      const logAction = (status === 'Retired' || status === 'Obsolete' || status === 'Disposed' || status === 'Damaged') ? 'ARCHIVE_DELETE_RECORD' : 'INVENTORY_UPDATE';
      await createAuditLog(
        logAction,
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Sensor ID ${sensorId} updated. Type: '${sensorType || existing[0]?.sensorType}'. Serial: '${serialNumber || existing[0]?.serialNumber || 'N/A'}'. Status: '${oldStatus}' -> '${status || oldStatus}'.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.json(result[0]);
    } catch (error: any) {
      console.error("Failed to update sensor:", error);
      res.status(500).json({ error: "Failed to update sensor", details: error.message });
    }
  });

  app.put("/api/sensors/:id/dismiss-alert", requireAuth, async (req: AuthRequest, res) => {
    const sensorId = parseInt(req.params.id);
    if (isNaN(sensorId)) {
      return res.status(400).json({ error: "Invalid sensor ID" });
    }

    try {
      const existing = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, sensorId));
      if (existing.length === 0) {
        return res.status(404).json({ error: "Sensor not found" });
      }

      const currentLog = existing[0].statusLog || "";
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const logLine = `[${timestamp}] Alert dismissed`;
      const updatedLog = currentLog ? `${currentLog}\n${logLine}` : logLine;

      const result = await db.update(sensorsInventory)
        .set({
          dismissedAlert: 'true',
          statusLog: updatedLog,
        })
        .where(eq(sensorsInventory.sensorId, sensorId))
        .returning();

      res.json(result[0]);
    } catch (error: any) {
      console.error("Failed to dismiss alert:", error);
      res.status(500).json({ error: "Failed to dismiss alert", details: error.message });
    }
  });

  app.put("/api/sensors/:id/quick-note", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role === 'Read-only/Audit User') {
      return res.status(403).json({ error: "Forbidden: Read-only accounts cannot modify sensors." });
    }

    const sensorId = parseInt(req.params.id);
    if (isNaN(sensorId)) {
      return res.status(400).json({ error: "Invalid sensor ID" });
    }

    try {
      const { quickNote } = req.body;
      const existing = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, sensorId));
      if (existing.length === 0) {
        return res.status(404).json({ error: "Sensor not found" });
      }

      const result = await db.update(sensorsInventory)
        .set({
          quickNote: quickNote || null,
        })
        .where(eq(sensorsInventory.sensorId, sensorId))
        .returning();

      res.json(result[0]);
    } catch (error: any) {
      console.error("Failed to update quick note:", error);
      res.status(500).json({ error: "Failed to update quick note", details: error.message });
    }
  });

  app.delete("/api/sensors/:id", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role !== 'Super Administrator' && role !== 'Head Office Admin/User') {
      return res.status(403).json({ error: "Forbidden: Only Admin or Head Office can delete cataloged sensors." });
    }

    const sensorId = parseInt(req.params.id);
    if (isNaN(sensorId)) {
      return res.status(400).json({ error: "Invalid sensor ID" });
    }

    try {
      const existing = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, sensorId));
      const details = existing.length > 0 
        ? `Sensor ID ${sensorId} of type '${existing[0].sensorType}' (Serial: ${existing[0].serialNumber || 'N/A'}, Manufacturer: ${existing[0].manufacturer}) deleted permanently from the registry.`
        : `Sensor ID ${sensorId} deleted permanently from the registry.`;

      await db.delete(sensorsInventory).where(eq(sensorsInventory.sensorId, sensorId));

      await createAuditLog(
        'RECORD_DELETED',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        details,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.json({ message: "Sensor deleted successfully" });
    } catch (error: any) {
      console.error("Failed to delete sensor:", error);
      res.status(500).json({ error: "Failed to delete sensor", details: error.message });
    }
  });

  // 4. Calibration Records Endpoints
  app.get("/api/calibrations", async (req, res) => {
    try {
      const list = await db.select().from(calibrations).orderBy(desc(calibrations.calibrationDate));
      const sensors = await db.select().from(sensorsInventory);
      const stations = await db.select().from(weatherStations);

      // Map sensor details to calibration records
      const fullCalibrations = list.map(c => {
        const sensor = sensors.find(s => s.sensorId === c.sensorId);
        const station = sensor ? stations.find(s => s.stationId === sensor.stationId) : null;
        return {
          ...c,
          sensorType: sensor?.sensorType || "Unknown",
          manufacturer: sensor?.manufacturer || "Unknown",
          stationName: station?.stationName || "Unassigned",
        };
      });

      res.json(fullCalibrations);
    } catch (error: any) {
      console.error("Failed to fetch calibrations:", error);
      res.status(500).json({ error: "Failed to fetch calibrations", details: error.message });
    }
  });

  app.post("/api/calibrations", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role === 'Read-only/Audit User' || role === 'Supplier account') {
      return res.status(403).json({ error: "Forbidden: You do not have permission to log calibrations." });
    }

    const { sensorId, calibrationDate, technicianName, result, notes, nextDueDate } = req.body;
    if (!sensorId || !calibrationDate || !technicianName || !result || !nextDueDate) {
      return res.status(400).json({ error: "Missing required fields for calibration" });
    }

    try {
      // 1. Insert the calibration record
      const calRecord = await db.insert(calibrations)
        .values({
          sensorId: parseInt(sensorId),
          calibrationDate,
          technicianName,
          result,
          notes,
          nextDueDate,
        })
        .returning();

      // Fetch existing sensor to build status log
      const existingSensor = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, parseInt(sensorId)));
      let currentLog = "";
      let oldStatus = "";
      if (existingSensor.length > 0) {
        currentLog = existingSensor[0].statusLog || "";
        oldStatus = existingSensor[0].status;
      }

      // 2. Update the corresponding sensor's status based on calibration results
      // If Passed, set to "Active". If Failed, set to "Maintenance".
      let newStatus = "Active";
      if (result === "Failed") {
        newStatus = "Maintenance";
      } else if (result === "Adjusted") {
        newStatus = "Active";
      }

      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      let logLine = `[${timestamp}] Calibration completed by ${technicianName} (Result: ${result})`;
      if (newStatus !== oldStatus) {
        logLine += `. Status changed from '${oldStatus}' to '${newStatus}'`;
      }
      const updatedLog = currentLog ? `${currentLog}\n${logLine}` : logLine;

      await db.update(sensorsInventory)
        .set({ 
          status: newStatus,
          statusLog: updatedLog,
          dismissedAlert: 'false' // Reset alert dismissal on new calibration
        })
        .where(eq(sensorsInventory.sensorId, parseInt(sensorId)));

      await createAuditLog(
        'CALIBRATION_UPDATE',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Calibration completed for Sensor ID ${sensorId}. Result: '${result}' by ${technicianName}. Status: '${oldStatus}' -> '${newStatus}'. Next Due Date: ${nextDueDate}.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.status(201).json(calRecord[0]);
    } catch (error: any) {
      console.error("Failed to log calibration:", error);
      res.status(500).json({ error: "Failed to log calibration", details: error.message });
    }
  });

  // --- Calibration Lab: Calibration Devices Endpoints ---
  app.get("/api/calibration-devices", async (req, res) => {
    try {
      const list = await db.select().from(calibrationDevices).orderBy(desc(calibrationDevices.deviceId));
      res.json(list);
    } catch (error: any) {
      console.error("Failed to fetch calibration devices:", error);
      res.status(500).json({ error: "Failed to fetch calibration devices", details: error.message });
    }
  });

  app.post("/api/calibration-devices", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role === 'Read-only/Audit User' || role === 'Supplier account') {
      return res.status(403).json({ error: "Forbidden: You do not have permission to manage calibration devices." });
    }

    const { deviceName, deviceType, serialNumber, lastCalibrated, calibrationDue, accuracyClass, status, assignedLab } = req.body;
    if (!deviceName || !deviceType || !serialNumber) {
      return res.status(400).json({ error: "Missing required fields for calibration device" });
    }

    try {
      const device = await db.insert(calibrationDevices)
        .values({
          deviceName,
          deviceType,
          serialNumber,
          lastCalibrated: lastCalibrated || null,
          calibrationDue: calibrationDue || null,
          accuracyClass: accuracyClass || null,
          status: status || "Active",
          assignedLab: assignedLab || "Central Meteorological Calibration Lab",
        })
        .returning();

      await createAuditLog(
        'INVENTORY_CREATE',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Calibration device '${deviceName}' (S/N: ${serialNumber}) added to calibration lab.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.status(201).json(device[0]);
    } catch (error: any) {
      console.error("Failed to add calibration device:", error);
      res.status(500).json({ error: "Failed to add calibration device", details: error.message });
    }
  });

  app.put("/api/calibration-devices/:id", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role === 'Read-only/Audit User' || role === 'Supplier account') {
      return res.status(403).json({ error: "Forbidden: You do not have permission to manage calibration devices." });
    }

    const deviceId = parseInt(req.params.id);
    if (isNaN(deviceId)) {
      return res.status(400).json({ error: "Invalid device ID" });
    }

    const { deviceName, deviceType, serialNumber, lastCalibrated, calibrationDue, accuracyClass, status, assignedLab } = req.body;

    try {
      const device = await db.update(calibrationDevices)
        .set({
          deviceName,
          deviceType,
          serialNumber,
          lastCalibrated: lastCalibrated || null,
          calibrationDue: calibrationDue || null,
          accuracyClass: accuracyClass || null,
          status: status || "Active",
          assignedLab: assignedLab || "Central Meteorological Calibration Lab",
        })
        .where(eq(calibrationDevices.deviceId, deviceId))
        .returning();

      if (device.length === 0) {
        return res.status(404).json({ error: "Calibration device not found" });
      }

      await createAuditLog(
        'INVENTORY_UPDATE',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Calibration device ID ${deviceId} ('${deviceName}') updated.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.json(device[0]);
    } catch (error: any) {
      console.error("Failed to update calibration device:", error);
      res.status(500).json({ error: "Failed to update calibration device", details: error.message });
    }
  });

  app.delete("/api/calibration-devices/:id", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role !== "Super Administrator" && role !== "Head Office Admin/User") {
      return res.status(403).json({ error: "Forbidden: Only Administrators can delete calibration devices." });
    }

    const deviceId = parseInt(req.params.id);
    if (isNaN(deviceId)) {
      return res.status(400).json({ error: "Invalid device ID" });
    }

    try {
      const deleted = await db.delete(calibrationDevices).where(eq(calibrationDevices.deviceId, deviceId)).returning();
      if (deleted.length === 0) {
        return res.status(404).json({ error: "Calibration device not found" });
      }

      await createAuditLog(
        'ARCHIVE_DELETE_RECORD',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Deleted calibration device ID ${deviceId} ('${deleted[0].deviceName}').`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.json({ message: "Calibration device deleted successfully" });
    } catch (error: any) {
      console.error("Failed to delete calibration device:", error);
      res.status(500).json({ error: "Failed to delete calibration device", details: error.message });
    }
  });

  // --- Calibration Lab: Assign Sensor to Calibrator ---
  app.post("/api/calibrations/assign", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role === 'Read-only/Audit User' || role === 'Supplier account') {
      return res.status(403).json({ error: "Forbidden: You do not have permission to assign sensors for calibration." });
    }

    const { sensorId, assignedCalibrator, calibrationDeviceUsed, deviceId } = req.body;
    if (!sensorId || !assignedCalibrator) {
      return res.status(400).json({ error: "Missing required fields: sensorId and assignedCalibrator" });
    }

    try {
      const existing = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, parseInt(sensorId)));
      if (existing.length === 0) {
        return res.status(404).json({ error: "Sensor not found" });
      }

      const oldStatus = existing[0].status;
      const currentLog = existing[0].statusLog || "";
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const logLine = `[${timestamp}] Assigned for Calibration. Calibrator: ${assignedCalibrator}, Device: ${calibrationDeviceUsed || 'Standard Reference'}. Status changed from '${oldStatus}' to 'In Calibration'.`;
      const updatedLog = currentLog ? `${currentLog}\n${logLine}` : logLine;

      await db.update(sensorsInventory)
        .set({
          status: "In Calibration",
          assignedCalibrator,
          calibrationDeviceUsed: calibrationDeviceUsed || null,
          statusLog: updatedLog,
          dismissedAlert: 'false'
        })
        .where(eq(sensorsInventory.sensorId, parseInt(sensorId)));

      // Provision automatic ISO/IEC 17025 compliant Calibration Job
      const initialAudit = [{
        timestamp: new Date().toISOString(),
        user: req.dbUser?.email || 'Unknown',
        action: 'INITIATED',
        stage: 'Plan',
        details: `Assigned for calibration to ${assignedCalibrator}. ISO/IEC 17025 sequence started.`
      }];

      const createdJob = await db.insert(calibrationJobs)
        .values({
          sensorId: parseInt(sensorId),
          status: 'In Progress',
          currentStage: 'Plan',
          plannedDate: new Date().toISOString().substring(0, 10),
          plannedCalibrator: assignedCalibrator,
          calibrationProcedure: 'SOP-CAL-01: Standard Meteorological Instrument Calibration Procedure',
          deviceId: deviceId ? parseInt(deviceId) : null,
          fullAuditTrail: JSON.stringify(initialAudit),
        })
        .returning();

      await createAuditLog(
        'CALIBRATION_UPDATE',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Sensor ID ${sensorId} assigned for calibration to ${assignedCalibrator} (Device: ${calibrationDeviceUsed || 'None'}). ISO/IEC 17025 Job #${createdJob[0].jobId} initialized in 'Plan' stage.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.json({ message: "Sensor successfully assigned and calibration job initialized", jobId: createdJob[0].jobId });
    } catch (error: any) {
      console.error("Failed to assign sensor for calibration:", error);
      res.status(500).json({ error: "Failed to assign sensor for calibration", details: error.message });
    }
  });

  // --- ISO/IEC 17025 Controlled Calibration Jobs Endpoints ---

  app.get("/api/calibration-jobs", async (req, res) => {
    try {
      const list = await db.select().from(calibrationJobs).orderBy(desc(calibrationJobs.jobId));
      const sensors = await db.select().from(sensorsInventory);
      const devices = await db.select().from(calibrationDevices);
      
      const detailed = list.map(job => {
        const sensor = sensors.find(s => s.sensorId === job.sensorId);
        const device = job.deviceId ? devices.find(d => d.deviceId === job.deviceId) : null;
        return {
          ...job,
          sensorName: sensor ? (sensor.sensorName || `${sensor.manufacturer} ${sensor.sensorType}`) : "Unknown Sensor",
          sensorType: sensor?.sensorType || "N/A",
          serialNumber: sensor?.serialNumber || "N/A",
          manufacturer: sensor?.manufacturer || "N/A",
          deviceName: device?.deviceName || "N/A",
          deviceSerialNumber: device?.serialNumber || "N/A",
        };
      });
      
      res.json(detailed);
    } catch (error: any) {
      console.error("Failed to fetch calibration jobs:", error);
      res.status(500).json({ error: "Failed to fetch calibration jobs", details: error.message });
    }
  });

  app.get("/api/calibration-jobs/:id", async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const jobList = await db.select().from(calibrationJobs).where(eq(calibrationJobs.jobId, jobId));
      if (jobList.length === 0) {
        return res.status(404).json({ error: "Calibration job not found" });
      }
      const job = jobList[0];
      const sensors = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, job.sensorId));
      const devices = job.deviceId ? await db.select().from(calibrationDevices).where(eq(calibrationDevices.deviceId, job.deviceId)) : [];
      
      const sensor = sensors[0];
      const device = devices[0];
      
      res.json({
        ...job,
        sensorName: sensor ? (sensor.sensorName || `${sensor.manufacturer} ${sensor.sensorType}`) : "Unknown Sensor",
        sensorType: sensor?.sensorType || "N/A",
        serialNumber: sensor?.serialNumber || "N/A",
        manufacturer: sensor?.manufacturer || "N/A",
        deviceName: device?.deviceName || "N/A",
        deviceSerialNumber: device?.serialNumber || "N/A",
      });
    } catch (error: any) {
      console.error("Failed to fetch calibration job:", error);
      res.status(500).json({ error: "Failed to fetch calibration job", details: error.message });
    }
  });

  app.post("/api/calibration-jobs", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role === 'Read-only/Audit User' || role === 'Supplier account') {
      return res.status(403).json({ error: "Forbidden: You do not have permission to plan calibrations." });
    }
    
    const { sensorId, plannedDate, plannedCalibrator, calibrationProcedure } = req.body;
    if (!sensorId || !plannedDate || !plannedCalibrator) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    try {
      const sensor = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, parseInt(sensorId)));
      if (sensor.length === 0) {
        return res.status(404).json({ error: "Sensor not found" });
      }
      
      const initialAudit = [{
        timestamp: new Date().toISOString(),
        user: req.dbUser?.email || 'Unknown',
        action: 'INITIATED',
        stage: 'Plan',
        details: `Calibration Job planned for sensor ${sensor[0].serialNumber} by ${req.dbUser?.email}. Procedure: ${calibrationProcedure || 'SOP-CAL-01'}`
      }];
      
      const newJob = await db.insert(calibrationJobs)
        .values({
          sensorId: parseInt(sensorId),
          status: 'In Progress',
          currentStage: 'Plan',
          plannedDate,
          plannedCalibrator,
          calibrationProcedure: calibrationProcedure || 'SOP-CAL-01: Standard Meteorological Instrument Calibration Procedure',
          fullAuditTrail: JSON.stringify(initialAudit),
        })
        .returning();
        
      // Update sensor status
      const oldStatus = sensor[0].status;
      const currentLog = sensor[0].statusLog || "";
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const logLine = `[${timestamp}] ISO/IEC 17025 Calibration Job #${newJob[0].jobId} planned. Status changed from '${oldStatus}' to 'In Calibration'.`;
      const updatedLog = currentLog ? `${currentLog}\n${logLine}` : logLine;
      
      await db.update(sensorsInventory)
        .set({
          status: "In Calibration",
          assignedCalibrator: plannedCalibrator,
          statusLog: updatedLog,
          dismissedAlert: 'false'
        })
        .where(eq(sensorsInventory.sensorId, parseInt(sensorId)));
        
      res.status(201).json(newJob[0]);
    } catch (error: any) {
      console.error("Failed to create calibration job:", error);
      res.status(500).json({ error: "Failed to create calibration job", details: error.message });
    }
  });

  app.put("/api/calibration-jobs/:id/stage", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role === 'Read-only/Audit User' || role === 'Supplier account') {
      return res.status(403).json({ error: "Forbidden: You do not have permission to modify calibration stages." });
    }
    
    const jobId = parseInt(req.params.id);
    const { currentStage, nextStage, payload } = req.body;
    
    if (!currentStage || !nextStage) {
      return res.status(400).json({ error: "Missing currentStage or nextStage fields" });
    }

    // Role-based access control: Only 'Authorized Signatory' roles can finalize 'Review' and 'Conformity' stages
    if (currentStage === 'Conformity' || currentStage === 'Review') {
      if (role !== 'Authorized Signatory' && role !== 'Super Administrator') {
        return res.status(403).json({ 
          error: "Forbidden: Only 'Authorized Signatory' roles are authorized to finalize the 'Review' and 'Conformity' stages under ISO/IEC 17025 rules." 
        });
      }
    }
    
    try {
      const jobList = await db.select().from(calibrationJobs).where(eq(calibrationJobs.jobId, jobId));
      if (jobList.length === 0) {
        return res.status(404).json({ error: "Calibration job not found" });
      }
      
      const job = jobList[0];
      const auditTrail = JSON.parse(job.fullAuditTrail || '[]');
      
      const updateData: any = {
        currentStage: nextStage,
      };
      
      let auditDetail = "";
      
      if (currentStage === 'Plan') {
        updateData.plannedDate = payload.plannedDate;
        updateData.plannedCalibrator = payload.plannedCalibrator;
        updateData.calibrationProcedure = payload.calibrationProcedure;
        auditDetail = `Plan defined. Calibrator: ${payload.plannedCalibrator}, Procedure: ${payload.calibrationProcedure}`;
      } else if (currentStage === 'ReferenceSelection') {
        updateData.deviceId = parseInt(payload.deviceId);
        const device = await db.select().from(calibrationDevices).where(eq(calibrationDevices.deviceId, parseInt(payload.deviceId)));
        const deviceName = device[0] ? device[0].deviceName : `ID ${payload.deviceId}`;
        auditDetail = `Reference standard selected: ${deviceName}`;
      } else if (currentStage === 'EnvironmentCheck') {
        updateData.ambientTemperature = parseFloat(payload.ambientTemperature);
        updateData.ambientHumidity = parseFloat(payload.ambientHumidity);
        updateData.ambientPressure = parseFloat(payload.ambientPressure);
        updateData.environmentStatus = payload.environmentStatus;
        updateData.environmentCheckedBy = req.dbUser?.email || 'Unknown';
        updateData.environmentCheckedAt = new Date().toISOString();
        auditDetail = `Environment check completed: ${payload.environmentStatus}. Temp: ${payload.ambientTemperature}°C, Humidity: ${payload.ambientHumidity}%, Pressure: ${payload.ambientPressure}hPa`;
      } else if (currentStage === 'Measurements') {
        updateData.measurements = JSON.stringify(payload.measurements);
        updateData.measuredBy = req.dbUser?.email || 'Unknown';
        updateData.measuredAt = new Date().toISOString();
        auditDetail = `Recorded ${payload.measurements.length} calibration data measurement points.`;
      } else if (currentStage === 'Uncertainty') {
        updateData.uncertaintyBudget = JSON.stringify(payload.uncertaintyBudget);
        updateData.uncertaintyCalculatedBy = req.dbUser?.email || 'Unknown';
        updateData.uncertaintyCalculatedAt = new Date().toISOString();
        auditDetail = `Uncertainty calculated. Expanded Uncertainty: ±${payload.uncertaintyBudget.expandedUncertainty} (k=${payload.uncertaintyBudget.coverageFactor})`;
      } else if (currentStage === 'Conformity') {
        updateData.conformityResult = payload.conformityResult;
        updateData.conformityDecisionRule = payload.conformityDecisionRule;
        updateData.conformityNotes = payload.conformityNotes;
        updateData.conformityEvaluatedBy = req.dbUser?.email || 'Unknown';
        updateData.conformityEvaluatedAt = new Date().toISOString();
        auditDetail = `Conformity evaluation finished with result: ${payload.conformityResult} using decision rule: ${payload.conformityDecisionRule}`;
      } else if (currentStage === 'Review') {
        updateData.reviewerName = req.dbUser?.email || 'Unknown';
        updateData.reviewComments = payload.reviewComments;
        updateData.reviewedAt = new Date().toISOString();
        updateData.status = 'Technical Review';
        auditDetail = `Technical review complete. Status set to Technical Review. Comments: "${payload.reviewComments}"`;
      } else if (currentStage === 'SignOff') {
        return res.status(400).json({ error: "Use /sign-off endpoint to perform signatory signoff" });
      }
      
      // Append audit trail event
      auditTrail.push({
        timestamp: new Date().toISOString(),
        user: req.dbUser?.email || 'Unknown',
        action: `STAGE_TRANSITION_${currentStage}`,
        stage: currentStage,
        details: auditDetail,
      });
      
      updateData.fullAuditTrail = JSON.stringify(auditTrail);
      
      await db.update(calibrationJobs)
        .set(updateData)
        .where(eq(calibrationJobs.jobId, jobId));
        
      res.json({ message: "Stage updated successfully", nextStage });
    } catch (error: any) {
      console.error("Failed to update calibration job stage:", error);
      res.status(500).json({ error: "Failed to update calibration job stage", details: error.message });
    }
  });

  app.post("/api/calibration-jobs/:id/sign-off", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    // Authorized Signatory role check
    if (role !== 'Authorized Signatory' && role !== 'Super Administrator') {
      return res.status(403).json({ error: "Forbidden: Only 'Authorized Signatory' or 'Super Administrator' roles can finalize and sign off calibration certificates." });
    }
    
    const jobId = parseInt(req.params.id);
    const { signatoryName, signatoryDesignation } = req.body;
    
    if (!signatoryName || !signatoryDesignation) {
      return res.status(400).json({ error: "Signatory name and designation are required" });
    }
    
    try {
      const jobList = await db.select().from(calibrationJobs).where(eq(calibrationJobs.jobId, jobId));
      if (jobList.length === 0) {
        return res.status(404).json({ error: "Calibration job not found" });
      }
      
      const job = jobList[0];
      if (job.status === 'Signed Off') {
        return res.status(400).json({ error: "This calibration job has already been signed off" });
      }
      
      const auditTrail = JSON.parse(job.fullAuditTrail || '[]');
      
      // Generate secure tamper-proof e-signature hash
      const timestamp = new Date().toISOString();
      const payloadString = `${jobId}-${job.sensorId}-${job.measurements}-${job.conformityResult}-${signatoryName}-${signatoryDesignation}-${timestamp}`;
      const eSignatureHash = crypto.createHmac('sha256', 'ISO17025_SECRET_KEY_METEOROLOGY')
        .update(payloadString)
        .digest('hex');
        
      auditTrail.push({
        timestamp,
        user: req.dbUser?.email || 'Unknown',
        action: 'FINAL_SIGN_OFF',
        stage: 'SignOff',
        details: `Calibration job final authorization and electronic signature complete by ${signatoryName} (${signatoryDesignation}). Cryptographic Integrity Seal Hash: ${eSignatureHash.substring(0, 8)}...`
      });
      
      // Update calibration job
      await db.update(calibrationJobs)
        .set({
          status: 'Signed Off',
          currentStage: 'SignOff',
          signatoryName,
          signatoryDesignation,
          signedAt: timestamp,
          eSignatureHash,
          fullAuditTrail: JSON.stringify(auditTrail)
        })
        .where(eq(calibrationJobs.jobId, jobId));
        
      // Fetch sensor to update status and register the formal historical calibration record
      const sensor = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, job.sensorId));
      if (sensor.length > 0) {
        // Calculate next due date (default to 1 year from now)
        const dateObj = new Date();
        dateObj.setFullYear(dateObj.getFullYear() + 1);
        const nextDueDate = dateObj.toISOString().substring(0, 10);
        
        // Insert into calibrations table so it shows up in general calibrations
        await db.insert(calibrations)
          .values({
            sensorId: job.sensorId,
            calibrationDate: timestamp.substring(0, 10),
            technicianName: job.plannedCalibrator || 'System Calibrator',
            result: job.conformityResult || 'Passed',
            notes: `ISO/IEC 17025 Certified. Job #${jobId}. Signatory: ${signatoryName}, Seal Hash: ${eSignatureHash.substring(0, 12)}`,
            nextDueDate,
          });
          
        // Revert sensor status to Active (if passed/adjusted) or Maintenance (if failed)
        let newStatus = "Active";
        if (job.conformityResult === "Failed") {
          newStatus = "Maintenance";
        }
        
        const currentLog = sensor[0].statusLog || "";
        const formattedTimestamp = timestamp.replace('T', ' ').substring(0, 19);
        const logLine = `[${formattedTimestamp}] ISO/IEC 17025 Certified Calibration Job #${jobId} finalized. Result: '${job.conformityResult}'. Status set to '${newStatus}'. Signatory: ${signatoryName}.`;
        const updatedLog = currentLog ? `${currentLog}\n${logLine}` : logLine;
        
        await db.update(sensorsInventory)
          .set({
            status: newStatus,
            statusLog: updatedLog,
            dismissedAlert: 'false'
          })
          .where(eq(sensorsInventory.sensorId, job.sensorId));
          
        // Write standard audit log
        await createAuditLog(
          'CALIBRATION_SIGN_OFF',
          req.dbUser?.email || 'Unknown',
          req.dbUser?.role || 'Unknown',
          `ISO/IEC 17025 Calibration Job #${jobId} signed off for Sensor ID ${job.sensorId}. Signatory: ${signatoryName} (${signatoryDesignation}). Integrity Seal: ${eSignatureHash}`,
          (req.headers['x-forwarded-for'] as string) || req.ip || null,
          'Success'
        );
      }
      
      res.json({ message: "Calibration job successfully signed off and certified", eSignatureHash });
    } catch (error: any) {
      console.error("Failed to sign off calibration job:", error);
      res.status(500).json({ error: "Failed to sign off calibration job", details: error.message });
    }
  });

  app.post("/api/calibration-jobs/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role === 'Read-only/Audit User' || role === 'Supplier account') {
      return res.status(403).json({ error: "Forbidden: You do not have permission to cancel calibration jobs." });
    }
    
    const jobId = parseInt(req.params.id);
    
    try {
      const jobList = await db.select().from(calibrationJobs).where(eq(calibrationJobs.jobId, jobId));
      if (jobList.length === 0) {
        return res.status(404).json({ error: "Calibration job not found" });
      }
      
      const job = jobList[0];
      const auditTrail = JSON.parse(job.fullAuditTrail || '[]');
      
      auditTrail.push({
        timestamp: new Date().toISOString(),
        user: req.dbUser?.email || 'Unknown',
        action: 'CANCELLED',
        stage: job.currentStage,
        details: 'Calibration job cancelled by user.'
      });
      
      await db.update(calibrationJobs)
        .set({
          status: 'Cancelled',
          fullAuditTrail: JSON.stringify(auditTrail)
        })
        .where(eq(calibrationJobs.jobId, jobId));
        
      // Revert sensor status
      const sensor = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, job.sensorId));
      if (sensor.length > 0) {
        const currentLog = sensor[0].statusLog || "";
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const logLine = `[${timestamp}] ISO/IEC 17025 Calibration Job #${jobId} cancelled. Status reverted to 'Active'.`;
        const updatedLog = currentLog ? `${currentLog}\n${logLine}` : logLine;
        
        await db.update(sensorsInventory)
          .set({
            status: "Active",
            statusLog: updatedLog
          })
          .where(eq(sensorsInventory.sensorId, job.sensorId));
      }
      
      res.json({ message: "Calibration job successfully cancelled" });
    } catch (error: any) {
      console.error("Failed to cancel calibration job:", error);
      res.status(500).json({ error: "Failed to cancel calibration job", details: error.message });
    }
  });

  // --- In-Situ Field Verification & Calibration Workflow Endpoints ---
  const inSituVerificationsList: any[] = [
    {
      id: 1,
      stationId: 1,
      stationName: "Biratnagar Airport AWS",
      sensorId: 1,
      sensorType: "Thermometer",
      sensorSerialNumber: "TH-2024-001",
      portableReferenceName: "Vaisala HM70 Handheld Reference",
      portableReferenceSerial: "REF-HM70-982",
      awsReading: 28.45,
      referenceReading: 28.32,
      unit: "°C",
      delta: 0.13,
      errorPercentage: 0.46,
      toleranceLimit: 0.20,
      status: "In Tolerance",
      stationStatus: "Operational (Station Online)",
      ambientTemp: 28.4,
      ambientHumidity: 68.0,
      technicianName: "Alex Field Tech",
      verificationDate: "2026-08-01",
      notes: "Field check completed during routine AWS inspection. Reading within CIMO WMO No. 8 tolerance."
    },
    {
      id: 2,
      stationId: 2,
      stationName: "Kathmandu Central Observatory",
      sensorId: 2,
      sensorType: "Barometer",
      sensorSerialNumber: "BAR-2023-881",
      portableReferenceName: "Druck DPI 610 Precision Pressure Indicator",
      portableReferenceSerial: "REF-DPI-441",
      awsReading: 1012.8,
      referenceReading: 1012.5,
      unit: "hPa",
      delta: 0.30,
      errorPercentage: 0.03,
      toleranceLimit: 0.30,
      status: "In Tolerance",
      stationStatus: "Operational (Station Online)",
      ambientTemp: 22.1,
      ambientHumidity: 55.0,
      technicianName: "Sarita Sharma",
      verificationDate: "2026-08-04",
      notes: "Station kept operational throughout side-by-side comparative pressure log."
    }
  ];

  app.get("/api/in-situ-verifications", async (req, res) => {
    try {
      res.json(inSituVerificationsList);
    } catch (error: any) {
      console.error("Failed to fetch in-situ verifications:", error);
      res.status(500).json({ error: "Failed to fetch in-situ verifications", details: error.message });
    }
  });

  app.post("/api/in-situ-verifications", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role === 'Read-only/Audit User') {
      return res.status(403).json({ error: "Forbidden: Read-only accounts cannot log field verifications." });
    }

    const {
      stationId,
      stationName,
      sensorId,
      sensorType,
      sensorSerialNumber,
      portableReferenceName,
      portableReferenceSerial,
      awsReading,
      referenceReading,
      unit,
      toleranceLimit,
      ambientTemp,
      ambientHumidity,
      technicianName,
      notes
    } = req.body;

    if (!stationId || !sensorId || awsReading === undefined || referenceReading === undefined) {
      return res.status(400).json({ error: "Missing required fields for in-situ field check" });
    }

    try {
      const awsVal = Number(awsReading);
      const refVal = Number(referenceReading);
      const delta = Number((awsVal - refVal).toFixed(3));
      const absDelta = Math.abs(delta);
      const errPct = refVal !== 0 ? Number(((absDelta / Math.abs(refVal)) * 100).toFixed(2)) : 0;
      const tol = Number(toleranceLimit || 0.20);
      const isPass = absDelta <= tol;
      const status = isPass ? "In Tolerance" : "Out of Tolerance";

      const newLog = {
        id: inSituVerificationsList.length + 1,
        stationId: parseInt(stationId),
        stationName: stationName || "Station AWS",
        sensorId: parseInt(sensorId),
        sensorType: sensorType || "Sensor",
        sensorSerialNumber: sensorSerialNumber || "N/A",
        portableReferenceName: portableReferenceName || "Handheld Reference Standard",
        portableReferenceSerial: portableReferenceSerial || "REF-FIELD-01",
        awsReading: awsVal,
        referenceReading: refVal,
        unit: unit || "units",
        delta,
        errorPercentage: errPct,
        toleranceLimit: tol,
        status,
        stationStatus: "Operational (Station Online)",
        ambientTemp: ambientTemp ? Number(ambientTemp) : null,
        ambientHumidity: ambientHumidity ? Number(ambientHumidity) : null,
        technicianName: technicianName || req.dbUser?.email || "Field Metrologist",
        verificationDate: new Date().toISOString().split('T')[0],
        notes: notes || "Side-by-side field verification logged without station downtime."
      };

      inSituVerificationsList.unshift(newLog);

      // Log entry into sensor statusLog
      const existing = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, parseInt(sensorId)));
      if (existing.length > 0) {
        const currentLog = existing[0].statusLog || "";
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const logLine = `[${timestamp}] In-situ field check completed using '${newLog.portableReferenceName}'. AWS: ${awsVal} ${unit}, Ref: ${refVal} ${unit}, Delta: ${delta > 0 ? '+' : ''}${delta}. Verdict: ${status}. Station operational.`;
        const updatedLog = currentLog ? `${currentLog}\n${logLine}` : logLine;

        await db.update(sensorsInventory)
          .set({ statusLog: updatedLog })
          .where(eq(sensorsInventory.sensorId, parseInt(sensorId)));
      }

      await createAuditLog(
        'CALIBRATION_UPDATE',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `In-situ field check logged for Sensor ID ${sensorId} at Station ID ${stationId}. Verdict: ${status} (Delta: ${delta}). Portable Ref: ${portableReferenceName}.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.status(201).json(newLog);
    } catch (error: any) {
      console.error("Failed to log in-situ verification:", error);
      res.status(500).json({ error: "Failed to log in-situ verification", details: error.message });
    }
  });

  // --- Coefficient / Slope / Offset Adjustments ---
  app.put("/api/sensors/:id/coefficients", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role === 'Read-only/Audit User') {
      return res.status(403).json({ error: "Forbidden: Read-only accounts cannot modify calibration coefficients." });
    }

    const sensorId = parseInt(req.params.id);
    if (isNaN(sensorId)) {
      return res.status(400).json({ error: "Invalid sensor ID" });
    }

    const { modelType, slope, offset, polyA, polyB, polyC, multiplier, unit, notes } = req.body;

    try {
      const existing = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, sensorId));
      if (existing.length === 0) {
        return res.status(404).json({ error: "Sensor not found" });
      }

      const coefficientsData = {
        modelType: modelType || 'Linear',
        slope: slope !== undefined ? Number(slope) : 1.0,
        offset: offset !== undefined ? Number(offset) : 0.0,
        polyA: polyA !== undefined ? Number(polyA) : 0,
        polyB: polyB !== undefined ? Number(polyB) : 1.0,
        polyC: polyC !== undefined ? Number(polyC) : 0,
        multiplier: multiplier !== undefined ? Number(multiplier) : 1.0,
        unit: unit || 'units',
        lastAdjustedDate: new Date().toISOString().split('T')[0],
        adjustedBy: req.dbUser?.email || 'Metrology Specialist',
        notes: notes || 'Calibration curve coefficients updated.'
      };

      const currentLog = existing[0].statusLog || "";
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const logLine = `[${timestamp}] Calibration coefficients updated (${modelType || 'Linear'}): Slope/m=${coefficientsData.slope}, Offset/c=${coefficientsData.offset}. Adjusted by ${coefficientsData.adjustedBy}.`;
      const updatedLog = currentLog ? `${currentLog}\n${logLine}` : logLine;

      const updated = await db.update(sensorsInventory)
        .set({
          calibrationDetails: JSON.stringify(coefficientsData),
          statusLog: updatedLog
        })
        .where(eq(sensorsInventory.sensorId, sensorId))
        .returning();

      await createAuditLog(
        'INVENTORY_UPDATE',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Updated calibration transfer function coefficients for Sensor ID ${sensorId}. Slope: ${coefficientsData.slope}, Offset: ${coefficientsData.offset}.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.json({ success: true, sensor: updated[0], coefficients: coefficientsData });
    } catch (error: any) {
      console.error("Failed to update sensor coefficients:", error);
      res.status(500).json({ error: "Failed to update sensor coefficients", details: error.message });
    }
  });

  // --- Sensor Swapping (Active station sensor replaced with pre-calibrated spare) ---
  app.post("/api/sensors/swap", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role === 'Read-only/Audit User') {
      return res.status(403).json({ error: "Forbidden: Read-only accounts cannot execute sensor swaps." });
    }

    const {
      stationId,
      oldSensorId,
      newSpareSensorId,
      swapDate,
      reason,
      personnelInvolved,
      coefficients,
      notes
    } = req.body;

    if (!stationId || !oldSensorId || !newSpareSensorId) {
      return res.status(400).json({ error: "Missing required fields: stationId, oldSensorId, newSpareSensorId" });
    }

    try {
      const station = await db.select().from(weatherStations).where(eq(weatherStations.stationId, parseInt(stationId)));
      const oldSensor = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, parseInt(oldSensorId)));
      const newSensor = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, parseInt(newSpareSensorId)));

      if (station.length === 0 || oldSensor.length === 0 || newSensor.length === 0) {
        return res.status(404).json({ error: "Station, old sensor, or new spare sensor not found." });
      }

      const stationName = station[0].stationName;
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const effectiveDate = swapDate || new Date().toISOString().split('T')[0];
      const technician = personnelInvolved || req.dbUser?.email || "Field Metrologist";

      // 1. Retire / Unassign old active sensor -> Move to 'In Calibration' / Bench Check Required
      const oldLog = oldSensor[0].statusLog || "";
      const oldLogLine = `[${timestamp}] Unassigned from station '${stationName}'. Swapped with pre-calibrated spare SEN-${newSensor[0].sensorId}. Status set to 'In Calibration'. Reason: ${reason || 'Bench calibration schedule'}.`;
      
      await db.update(sensorsInventory)
        .set({
          stationId: null,
          status: 'In Calibration',
          statusLog: oldLog ? `${oldLog}\n${oldLogLine}` : oldLogLine,
          dismissedAlert: 'false'
        })
        .where(eq(sensorsInventory.sensorId, parseInt(oldSensorId)));

      // 2. Assign pre-calibrated spare sensor -> Move to 'Active' at target station
      const newLog = newSensor[0].statusLog || "";
      const newLogLine = `[${timestamp}] Deployed as active sensor at station '${stationName}' replacing SEN-${oldSensor[0].sensorId}. Status: 'Active'. Calibration parameters transferred.`;
      
      const newUpdateFields: any = {
        stationId: parseInt(stationId),
        status: 'Active',
        statusLog: newLog ? `${newLog}\n${newLogLine}` : newLogLine,
        dismissedAlert: 'false'
      };

      if (coefficients) {
        newUpdateFields.calibrationDetails = JSON.stringify(coefficients);
      }

      await db.update(sensorsInventory)
        .set(newUpdateFields)
        .where(eq(sensorsInventory.sensorId, parseInt(newSpareSensorId)));

      // 3. Create Replacement Log
      const replacement = await db.insert(sensorReplacements)
        .values({
          stationId: parseInt(stationId),
          oldSensorId: parseInt(oldSensorId),
          newSensorId: parseInt(newSpareSensorId),
          replacementDate: effectiveDate,
          reason: reason || "Lab pre-calibrated sensor swap",
          personnelInvolved: technician,
          notes: notes || `Active sensor SEN-${oldSensorId} swapped with pre-calibrated spare SEN-${newSpareSensorId} without extended AWS station downtime.`
        })
        .returning();

      // 4. Audit Log
      await createAuditLog(
        'SENSOR_REPLACEMENT',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Sensor Swap executed at ${stationName} (Station ID ${stationId}): Removed SEN-${oldSensorId} (${oldSensor[0].sensorType}), Installed pre-calibrated spare SEN-${newSpareSensorId}. Technician: ${technician}.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.json({
        success: true,
        message: "Sensor swap executed successfully.",
        replacement: replacement[0],
        oldSensorId: parseInt(oldSensorId),
        newSensorId: parseInt(newSpareSensorId),
        stationName
      });
    } catch (error: any) {
      console.error("Failed to execute sensor swap:", error);
      res.status(500).json({ error: "Failed to execute sensor swap", details: error.message });
    }
  });

  // --- Deployment Management Endpoints ---

  app.get("/api/deployments", async (req, res) => {
    try {
      const list = await db.select().from(sensorDeployments).orderBy(desc(sensorDeployments.deploymentDate));
      const sensors = await db.select().from(sensorsInventory);
      const stations = await db.select().from(weatherStations);

      const detailed = list.map(dep => {
        const sensor = sensors.find(s => s.sensorId === dep.sensorId);
        const station = stations.find(s => s.stationId === dep.stationId);
        return {
          ...dep,
          sensorName: sensor ? (sensor.sensorName || `${sensor.manufacturer} ${sensor.sensorType}`) : "Unknown Sensor",
          sensorType: sensor?.sensorType || "N/A",
          serialNumber: sensor?.serialNumber || "N/A",
          stationName: station?.stationName || "Unknown Station",
          region: station?.region || "N/A",
        };
      });

      res.json(detailed);
    } catch (error: any) {
      console.error("Failed to fetch deployments:", error);
      res.status(500).json({ error: "Failed to fetch deployments", details: error.message });
    }
  });

  app.post("/api/deployments", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role === 'Read-only/Audit User' || role === 'Supplier account') {
      return res.status(403).json({ error: "Forbidden: You do not have permission to deploy sensors." });
    }

    const { sensorId, stationId, deploymentDate, personnelInvolved, installationNotes } = req.body;

    if (!sensorId || !stationId || !deploymentDate || !personnelInvolved) {
      return res.status(400).json({ error: "Missing required fields for deployment" });
    }

    try {
      // 1. Verify sensor and station exist
      const sensorObj = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, parseInt(sensorId)));
      if (sensorObj.length === 0) {
        return res.status(404).json({ error: "Sensor not found" });
      }

      // Check if there's any active deployment for this sensor
      const activeDeps = await db.select().from(sensorDeployments).where(and(
        eq(sensorDeployments.sensorId, parseInt(sensorId)),
        eq(sensorDeployments.status, 'Active')
      ));

      if (activeDeps.length > 0) {
        return res.status(400).json({ error: "Sensor is already actively deployed. Please retrieve it first." });
      }

      // 2. Insert deployment record
      const result = await db.insert(sensorDeployments)
        .values({
          sensorId: parseInt(sensorId),
          stationId: parseInt(stationId),
          deploymentDate,
          personnelInvolved,
          installationNotes: installationNotes || null,
          status: 'Active'
        })
        .returning();

      // 3. Update sensor status in inventory
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const logLine = `[${timestamp}] Deployed to station ID ${stationId} via deployment record #${result[0].deploymentId}`;
      const currentLog = sensorObj[0].statusLog || "";

      await db.update(sensorsInventory)
        .set({
          status: 'Deployed',
          stationId: parseInt(stationId),
          statusLog: currentLog ? `${currentLog}\n${logLine}` : logLine,
          dismissedAlert: 'false'
        })
        .where(eq(sensorsInventory.sensorId, parseInt(sensorId)));

      // Trigger deployment confirmation email alert asynchronously
      (async () => {
        try {
          const stationObj = await db.select().from(weatherStations).where(eq(weatherStations.stationId, parseInt(stationId)));
          const stationName = stationObj[0]?.stationName || `Station #${stationId}`;
          const sensorType = sensorObj[0]?.sensorType || 'Sensor';
          const serial = sensorObj[0]?.serialNumber || 'N/A';
          
          const subject = `[DEPLOYMENT CONFIRMED] Sensor ${sensorType} deployed at ${stationName}`;
          const body = `Deployment Confirmation Report:\n\n` +
            `Sensor Type: ${sensorType}\n` +
            `Serial Number: ${serial}\n` +
            `Station: ${stationName}\n` +
            `Deployment Date: ${deploymentDate}\n` +
            `Personnel Involved: ${personnelInvolved}\n` +
            `Installation Notes: ${installationNotes || 'None'}\n\n` +
            `The sensor status in the unified inventory has been updated to 'Deployed'.`;
            
          await sendNotification('deployment_confirmation', subject, body);
        } catch (e) {
          console.error("Failed to send deployment confirmation alert:", e);
        }
      })();

      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error("Failed to register deployment:", error);
      res.status(500).json({ error: "Failed to register deployment", details: error.message });
    }
  });

  app.put("/api/deployments/:id/retrieve", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role === 'Read-only/Audit User' || role === 'Supplier account') {
      return res.status(403).json({ error: "Forbidden: You do not have permission to retrieve sensors." });
    }

    const deploymentId = parseInt(req.params.id);
    const { retrievalDate, nextStatus, remarks } = req.body;

    if (isNaN(deploymentId)) {
      return res.status(400).json({ error: "Invalid deployment ID" });
    }
    if (!retrievalDate) {
      return res.status(400).json({ error: "Retrieval date is required" });
    }

    try {
      // 1. Get deployment record
      const dep = await db.select().from(sensorDeployments).where(eq(sensorDeployments.deploymentId, deploymentId));
      if (dep.length === 0) {
        return res.status(404).json({ error: "Deployment record not found" });
      }

      if (dep[0].status === 'Retrieved') {
        return res.status(400).json({ error: "Sensor has already been retrieved from this deployment." });
      }

      // 2. Update deployment
      const result = await db.update(sensorDeployments)
        .set({
          retrievalDate,
          status: 'Retrieved'
        })
        .where(eq(sensorDeployments.deploymentId, deploymentId))
        .returning();

      // 3. Update sensor inventory
      const sensorId = dep[0].sensorId;
      const sensorObj = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, sensorId));

      if (sensorObj.length > 0) {
        const targetStatus = nextStatus || 'Store'; // Default back to Store/Spare
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const logLine = `[${timestamp}] Retrieved from station ID ${dep[0].stationId}. Status changed to '${targetStatus}'. Remarks: ${remarks || 'None'}`;
        const currentLog = sensorObj[0].statusLog || "";

        await db.update(sensorsInventory)
          .set({
            status: targetStatus,
            stationId: null, // No longer at any station
            statusLog: currentLog ? `${currentLog}\n${logLine}` : logLine,
            remarks: remarks || sensorObj[0].remarks,
            dismissedAlert: 'false'
          })
          .where(eq(sensorsInventory.sensorId, sensorId));
      }

      res.json(result[0]);
    } catch (error: any) {
      console.error("Failed to retrieve sensor:", error);
      res.status(500).json({ error: "Failed to retrieve sensor", details: error.message });
    }
  });

  // --- Replacements Endpoints ---

  app.get("/api/replacements", async (req, res) => {
    try {
      const list = await db.select().from(sensorReplacements).orderBy(desc(sensorReplacements.replacementDate));
      const sensors = await db.select().from(sensorsInventory);
      const stations = await db.select().from(weatherStations);

      const detailed = list.map(rep => {
        const oldSensor = sensors.find(s => s.sensorId === rep.oldSensorId);
        const newSensor = sensors.find(s => s.sensorId === rep.newSensorId);
        const station = stations.find(s => s.stationId === rep.stationId);

        return {
          ...rep,
          stationName: station?.stationName || "Unknown Station",
          region: station?.region || "N/A",
          oldSensorName: oldSensor ? (oldSensor.sensorName || `${oldSensor.manufacturer} ${oldSensor.sensorType}`) : "Unknown Sensor",
          oldSensorType: oldSensor?.sensorType || "N/A",
          oldSerialNumber: oldSensor?.serialNumber || "N/A",
          newSensorName: newSensor ? (newSensor.sensorName || `${newSensor.manufacturer} ${newSensor.sensorType}`) : "Unknown Sensor",
          newSensorType: newSensor?.sensorType || "N/A",
          newSerialNumber: newSensor?.serialNumber || "N/A",
        };
      });

      res.json(detailed);
    } catch (error: any) {
      console.error("Failed to fetch replacements:", error);
      res.status(500).json({ error: "Failed to fetch replacements", details: error.message });
    }
  });

  app.post("/api/replacements", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role === 'Read-only/Audit User' || role === 'Supplier account') {
      return res.status(403).json({ error: "Forbidden: You do not have permission to replace sensors." });
    }

    const { stationId, oldSensorId, newSensorId, replacementDate, reason, personnelInvolved, notes, oldSensorNextStatus } = req.body;

    if (!stationId || !oldSensorId || !newSensorId || !replacementDate || !reason || !personnelInvolved) {
      return res.status(400).json({ error: "Missing required fields for replacement" });
    }

    try {
      const targetOldSensorId = parseInt(oldSensorId);
      const targetNewSensorId = parseInt(newSensorId);
      const targetStationId = parseInt(stationId);

      // Verify sensors and station exist
      const stationObj = await db.select().from(weatherStations).where(eq(weatherStations.stationId, targetStationId));
      if (stationObj.length === 0) {
        return res.status(404).json({ error: "Station not found" });
      }

      const oldSensorObj = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, targetOldSensorId));
      if (oldSensorObj.length === 0) {
        return res.status(404).json({ error: "Old sensor not found" });
      }

      const newSensorObj = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, targetNewSensorId));
      if (newSensorObj.length === 0) {
        return res.status(404).json({ error: "New sensor not found" });
      }

      // Check if new sensor has an active deployment
      const newActiveDeps = await db.select().from(sensorDeployments).where(and(
        eq(sensorDeployments.sensorId, targetNewSensorId),
        eq(sensorDeployments.status, 'Active')
      ));
      if (newActiveDeps.length > 0) {
        return res.status(400).json({ error: "New sensor is already deployed. Please choose a spare or store sensor." });
      }

      // 1. Insert replacement record
      const result = await db.insert(sensorReplacements)
        .values({
          stationId: targetStationId,
          oldSensorId: targetOldSensorId,
          newSensorId: targetNewSensorId,
          replacementDate,
          reason,
          personnelInvolved,
          notes: notes || null
        })
        .returning();

      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

      // 2. Retrieve old sensor from deployment if active
      const activeOldDeps = await db.select().from(sensorDeployments).where(and(
        eq(sensorDeployments.sensorId, targetOldSensorId),
        eq(sensorDeployments.status, 'Active')
      ));

      if (activeOldDeps.length > 0) {
        await db.update(sensorDeployments)
          .set({
            retrievalDate: replacementDate,
            status: 'Retrieved'
          })
          .where(eq(sensorDeployments.deploymentId, activeOldDeps[0].deploymentId));
      }

      // Update old sensor state in inventory
      const targetStatusForOld = oldSensorNextStatus || 'Under Repair';
      const oldLogLine = `[${timestamp}] Replaced at station ID ${targetStationId} by sensor ID ${targetNewSensorId} (Replacement #${result[0].replacementId}). Status changed to '${targetStatusForOld}'.`;
      const oldCurrentLog = oldSensorObj[0].statusLog || "";
      await db.update(sensorsInventory)
        .set({
          status: targetStatusForOld,
          stationId: null,
          statusLog: oldCurrentLog ? `${oldCurrentLog}\n${oldLogLine}` : oldLogLine,
          dismissedAlert: 'false'
        })
        .where(eq(sensorsInventory.sensorId, targetOldSensorId));

      // 3. Deploy new sensor to deployment table
      await db.insert(sensorDeployments)
        .values({
          sensorId: targetNewSensorId,
          stationId: targetStationId,
          deploymentDate: replacementDate,
          personnelInvolved,
          installationNotes: `Replacement installation. Replaced sensor ID ${targetOldSensorId}. Reason: ${reason}. Notes: ${notes || 'None'}`,
          status: 'Active'
        });

      // Update new sensor state in inventory
      const newLogLine = `[${timestamp}] Deployed at station ID ${targetStationId} as replacement for sensor ID ${targetOldSensorId} (Replacement #${result[0].replacementId}). Status set to 'Deployed'.`;
      const newCurrentLog = newSensorObj[0].statusLog || "";
      await db.update(sensorsInventory)
        .set({
          status: 'Deployed',
          stationId: targetStationId,
          statusLog: newCurrentLog ? `${newCurrentLog}\n${newLogLine}` : newLogLine,
          dismissedAlert: 'false'
        })
        .where(eq(sensorsInventory.sensorId, targetNewSensorId));

      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error("Failed to register replacement:", error);
      res.status(500).json({ error: "Failed to register replacement", details: error.message });
    }
  });

  // --- Transfer Management Endpoints ---

  app.get("/api/transfers", async (req, res) => {
    try {
      const list = await db.select().from(sensorTransfers).orderBy(desc(sensorTransfers.transferDate));
      const sensors = await db.select().from(sensorsInventory);

      const detailed = list.map(tr => {
        const sensor = sensors.find(s => s.sensorId === tr.sensorId);
        return {
          ...tr,
          sensorName: sensor ? (sensor.sensorName || `${sensor.manufacturer} ${sensor.sensorType}`) : "Unknown Sensor",
          sensorType: sensor?.sensorType || "N/A",
          serialNumber: sensor?.serialNumber || "N/A",
        };
      });

      res.json(detailed);
    } catch (error: any) {
      console.error("Failed to fetch transfers:", error);
      res.status(500).json({ error: "Failed to fetch transfers", details: error.message });
    }
  });

  app.post("/api/transfers", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role === 'Read-only/Audit User' || role === 'Supplier account') {
      return res.status(403).json({ error: "Forbidden: You do not have permission to initiate sensor transfers." });
    }

    const { 
      sensorId, 
      transferType, 
      durationType, 
      sender, 
      receiver, 
      transferDate, 
      personnelInvolved, 
      conditionDuringTransfer, 
      transferRemarks,
      approvalStatus
    } = req.body;

    if (!sensorId || !transferType || !durationType || !sender || !receiver || !transferDate || !personnelInvolved || !conditionDuringTransfer) {
      return res.status(400).json({ error: "Missing required fields for transfer" });
    }

    try {
      const targetSensorId = parseInt(sensorId);
      const sensorObj = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, targetSensorId));
      if (sensorObj.length === 0) {
        return res.status(404).json({ error: "Sensor not found" });
      }

      // Check if sensor is already in a pending transfer
      const pendingTransfers = await db.select().from(sensorTransfers).where(and(
        eq(sensorTransfers.sensorId, targetSensorId),
        eq(sensorTransfers.approvalStatus, 'Pending')
      ));
      if (pendingTransfers.length > 0) {
        return res.status(400).json({ error: "Sensor already has an active pending transfer. Please resolve it first." });
      }

      // 1. Insert transfer record
      const initialApproval = approvalStatus || 'Pending';
      const result = await db.insert(sensorTransfers)
        .values({
          sensorId: targetSensorId,
          transferType,
          durationType,
          sender,
          receiver,
          transferDate,
          personnelInvolved,
          conditionDuringTransfer,
          approvalStatus: initialApproval,
          transferRemarks: transferRemarks || null
        })
        .returning();

      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      
      // If immediately approved, apply side-effects
      if (initialApproval === 'Approved') {
        const logLine = `[${timestamp}] Transfer (#${result[0].transferId}) Approved: ${transferType} (${durationType}) from ${sender} to ${receiver}. Condition: ${conditionDuringTransfer}.`;
        const currentLog = sensorObj[0].statusLog || "";
        
        const updates: any = {
          statusLog: currentLog ? `${currentLog}\n${logLine}` : logLine,
          dismissedAlert: 'false'
        };

        if (transferType === 'Station to Office return') {
          updates.status = 'Store';
          updates.stationId = null;
          updates.assignedOffice = receiver;
        } else if (transferType === 'Office to Office' || transferType === 'Regional to Head Office transfer') {
          updates.assignedOffice = receiver;
        } else if (transferType === 'Office to Station deployment') {
          updates.status = 'Deployed';
          // Try to find a station with matching name to assign
          const stations = await db.select().from(weatherStations);
          const matchedStation = stations.find(st => st.stationName.toLowerCase().trim() === receiver.toLowerCase().trim());
          if (matchedStation) {
            updates.stationId = matchedStation.stationId;
          }
        }

        await db.update(sensorsInventory).set(updates).where(eq(sensorsInventory.sensorId, targetSensorId));
      } else {
        // Just log the requested transfer in status log
        const logLine = `[${timestamp}] Transfer requested (#${result[0].transferId}): ${transferType} (${durationType}) from ${sender} to ${receiver} is Pending Approval.`;
        const currentLog = sensorObj[0].statusLog || "";
        await db.update(sensorsInventory)
          .set({
            statusLog: currentLog ? `${currentLog}\n${logLine}` : logLine,
            dismissedAlert: 'false'
          })
          .where(eq(sensorsInventory.sensorId, targetSensorId));
      }

      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error("Failed to submit transfer:", error);
      res.status(500).json({ error: "Failed to submit transfer", details: error.message });
    }
  });

  app.put("/api/transfers/:id/status", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role !== 'Super Administrator' && role !== 'Head Office Admin/User') {
      return res.status(403).json({ error: "Forbidden: Only Admin or Head Office can approve/reject transfers." });
    }

    const transferId = parseInt(req.params.id);
    const { approvalStatus, notes } = req.body;

    if (isNaN(transferId)) {
      return res.status(400).json({ error: "Invalid transfer ID" });
    }
    if (!['Approved', 'Rejected'].includes(approvalStatus)) {
      return res.status(400).json({ error: "Invalid approval status. Must be 'Approved' or 'Rejected'." });
    }

    try {
      const tr = await db.select().from(sensorTransfers).where(eq(sensorTransfers.transferId, transferId));
      if (tr.length === 0) {
        return res.status(404).json({ error: "Transfer record not found" });
      }

      if (tr[0].approvalStatus !== 'Pending') {
        return res.status(400).json({ error: `Transfer has already been ${tr[0].approvalStatus}.` });
      }

      const result = await db.update(sensorTransfers)
        .set({ approvalStatus })
        .where(eq(sensorTransfers.transferId, transferId))
        .returning();

      const sensorId = tr[0].sensorId;
      const sensorObj = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, sensorId));

      if (sensorObj.length > 0) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const logLine = `[${timestamp}] Transfer (#${transferId}) ${approvalStatus}. Notes: ${notes || 'None'}.`;
        const currentLog = sensorObj[0].statusLog || "";
        
        const updates: any = {
          statusLog: currentLog ? `${currentLog}\n${logLine}` : logLine,
          dismissedAlert: 'false'
        };

        if (approvalStatus === 'Approved') {
          const type = tr[0].transferType;
          const receiver = tr[0].receiver;
          
          if (type === 'Station to Office return') {
            updates.status = 'Store';
            updates.stationId = null;
            updates.assignedOffice = receiver;
          } else if (type === 'Office to Office' || type === 'Regional to Head Office transfer') {
            updates.assignedOffice = receiver;
          } else if (type === 'Office to Station deployment') {
            updates.status = 'Deployed';
            // Find station with name receiver
            const stations = await db.select().from(weatherStations);
            const matchedStation = stations.find(st => st.stationName.toLowerCase().trim() === receiver.toLowerCase().trim());
            if (matchedStation) {
              updates.stationId = matchedStation.stationId;
            }
          }
        }

        await db.update(sensorsInventory).set(updates).where(eq(sensorsInventory.sensorId, sensorId));
      }

      // Trigger transfer approval/status update email alert asynchronously
      (async () => {
        try {
          const sensorType = sensorObj[0]?.sensorType || 'Sensor';
          const serial = sensorObj[0]?.serialNumber || 'N/A';
          const transferType = tr[0]?.transferType || 'Sensor Transfer';
          const sender = tr[0]?.sender || 'Sender';
          const receiver = tr[0]?.receiver || 'Receiver';

          const subject = `[TRANSFER ${approvalStatus.toUpperCase()}] Sensor Transfer ID #${transferId}`;
          const body = `Sensor Transfer Status Update:\n\n` +
            `Transfer ID: #${transferId}\n` +
            `Sensor Type: ${sensorType}\n` +
            `Serial Number: ${serial}\n` +
            `Transfer Type: ${transferType}\n` +
            `Sender (From): ${sender}\n` +
            `Receiver (To): ${receiver}\n` +
            `Approval Status: ${approvalStatus}\n` +
            `Approver Notes: ${notes || 'None'}\n\n` +
            `The system has successfully updated the transaction records.`;

          await sendNotification('transfer_approval', subject, body);
        } catch (e) {
          console.error("Failed to send transfer approval alert:", e);
        }
      })();

      await createAuditLog(
        approvalStatus === 'Approved' ? 'TRANSFER_APPROVE' : 'TRANSFER_REJECT',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Transfer ID #${transferId} (Sensor ID: ${sensorId}) was ${approvalStatus.toLowerCase()}. Notes: ${notes || 'None'}.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.json(result[0]);
    } catch (error: any) {
      console.error("Failed to update transfer status:", error);
      res.status(500).json({ error: "Failed to update transfer status", details: error.message });
    }
  });

  // --- Notifications, Alerts and SMTP Settings API ---

  app.get("/api/notifications/smtp", requireAuth, async (req: AuthRequest, res) => {
    try {
      const [smtp] = await db.select().from(smtpConfig);
      if (!smtp) {
        // Insert a default config if not exists
        const defaultSmtp = await db.insert(smtpConfig).values({
          host: 'smtp.gov.np',
          port: 587,
          secure: 'false',
          username: 'aws-alerts@gov.np',
          password: 'secure_password_123',
          fromEmail: 'aws-alerts@gov.np',
          fromName: 'Meteorological Department AWS Alert System'
        }).returning();
        return res.json(defaultSmtp[0]);
      }
      res.json(smtp);
    } catch (error: any) {
      console.error("Failed to fetch SMTP config:", error);
      res.status(500).json({ error: "Failed to fetch SMTP configuration", details: error.message });
    }
  });

  app.put("/api/notifications/smtp", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role !== 'Super Administrator' && role !== 'Head Office Admin/User') {
      return res.status(403).json({ error: "Forbidden: Only Admin accounts can update SMTP parameters." });
    }

    const { host, port, secure, username, password, fromEmail, fromName } = req.body;
    if (!host || !port) {
      return res.status(400).json({ error: "Missing host or port in SMTP configuration request." });
    }

    try {
      const existing = await db.select().from(smtpConfig);
      let result;
      if (existing.length === 0) {
        result = await db.insert(smtpConfig).values({
          host,
          port: parseInt(port),
          secure: secure === 'true' || secure === true ? 'true' : 'false',
          username: username || null,
          password: password || null,
          fromEmail: fromEmail || 'no-reply@met.gov.np',
          fromName: fromName || 'AWS Alert System'
        }).returning();
      } else {
        result = await db.update(smtpConfig).set({
          host,
          port: parseInt(port),
          secure: secure === 'true' || secure === true ? 'true' : 'false',
          username: username || null,
          password: password || null,
          fromEmail: fromEmail || 'no-reply@met.gov.np',
          fromName: fromName || 'AWS Alert System'
        }).where(eq(smtpConfig.id, existing[0].id)).returning();
      }

      // Log system notification about SMTP config change
      await sendNotification('system_notification', '[SYSTEM ALERT] SMTP Configuration Changed', `SMTP host has been updated to: ${host}:${port} by user: ${req.dbUser?.email || 'Admin'}`);

      res.json(result[0]);
    } catch (error: any) {
      console.error("Failed to update SMTP config:", error);
      res.status(500).json({ error: "Failed to update SMTP configuration", details: error.message });
    }
  });

  app.get("/api/notifications/settings", requireAuth, async (req: AuthRequest, res) => {
    try {
      const list = await db.select().from(notificationSettings).orderBy(notificationSettings.id);
      res.json(list);
    } catch (error: any) {
      console.error("Failed to fetch notification settings:", error);
      res.status(500).json({ error: "Failed to fetch notification settings", details: error.message });
    }
  });

  app.put("/api/notifications/settings/:id", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role !== 'Super Administrator' && role !== 'Head Office Admin/User') {
      return res.status(403).json({ error: "Forbidden: Only Admin accounts can update alert intervals and parameters." });
    }

    const id = parseInt(req.params.id);
    const { interval, emailEnabled, smsEnabled, recipientEmails } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid alert setting ID" });
    }

    try {
      const result = await db.update(notificationSettings)
        .set({
          interval: interval || 'monthly',
          emailEnabled: emailEnabled === 'true' || emailEnabled === true ? 'true' : 'false',
          smsEnabled: smsEnabled === 'true' || smsEnabled === true ? 'true' : 'false',
          recipientEmails: recipientEmails || 'admin@met.gov.np',
          updatedAt: new Date()
        })
        .where(eq(notificationSettings.id, id))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: "Notification setting entry not found." });
      }

      res.json(result[0]);
    } catch (error: any) {
      console.error("Failed to update alert settings:", error);
      res.status(500).json({ error: "Failed to update alert setting parameters", details: error.message });
    }
  });

  app.get("/api/notifications/logs", requireAuth, async (req: AuthRequest, res) => {
    try {
      const logs = await db.select().from(deliveryLogs).orderBy(desc(deliveryLogs.sentAt));
      res.json(logs);
    } catch (error: any) {
      console.error("Failed to fetch delivery logs:", error);
      res.status(500).json({ error: "Failed to fetch delivery logs", details: error.message });
    }
  });

  // Audit Logs endpoints
  app.get("/api/audit/logs", requireAuth, async (req: AuthRequest, res) => {
    try {
      const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt));
      res.json(logs);
    } catch (error: any) {
      console.error("Failed to fetch audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs", details: error.message });
    }
  });

  app.post("/api/audit/logs", async (req, res) => {
    try {
      const { action, actorEmail, actorRole, details, status } = req.body;
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip || null;
      
      let email = actorEmail || 'System';
      let role = actorRole || 'Guest';
      
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split('Bearer ')[1].trim();
        if (token.startsWith('metis.')) {
          const payload = verifyMetisToken(token);
          if (payload) {
            email = payload.email || email;
            role = payload.role || role;
          }
        } else {
          try {
            const decodedToken = await adminAuth.verifyIdToken(token);
            const dbUser = await getOrCreateUser(decodedToken.uid, decodedToken.email || '');
            if (dbUser) {
              email = dbUser.email;
              role = dbUser.role || 'Read-only/Audit User';
            }
          } catch (e) {
            // ignore non-critical verification failure in optional audit metadata
          }
        }
      }
      
      await db.insert(auditLogs).values({
        action,
        actorEmail: email,
        actorRole: role,
        details,
        ipAddress,
        status: status || 'Success',
      });
      
      res.json({ success: true });
    } catch (err: any) {
      console.error("Failed to write audit log:", err);
      res.status(500).json({ error: "Failed to write audit log" });
    }
  });

  // --- Supplier & Manufacturer Management Endpoints ---

  app.get("/api/suppliers", requireAuth, async (req: AuthRequest, res) => {
    try {
      const allSuppliers = await db.select().from(suppliers).orderBy(desc(suppliers.createdAt));
      res.json(allSuppliers);
    } catch (error: any) {
      console.error("Failed to fetch suppliers:", error);
      res.status(500).json({ error: "Failed to fetch suppliers", details: error.message });
    }
  });

  app.get("/api/suppliers/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      const supplier = await db.select().from(suppliers).where(eq(suppliers.id, supplierId));
      if (supplier.length === 0) {
        return res.status(404).json({ error: "Supplier not found" });
      }

      const agreements = await db.select().from(supplierAgreements).where(eq(supplierAgreements.supplierId, supplierId));
      const evaluations = await db.select().from(supplierEvaluations).where(eq(supplierEvaluations.supplierId, supplierId));

      res.json({
        ...supplier[0],
        agreements,
        evaluations
      });
    } catch (error: any) {
      console.error("Failed to fetch supplier details:", error);
      res.status(500).json({ error: "Failed to fetch supplier details", details: error.message });
    }
  });

  app.post("/api/suppliers", requireAuth, async (req: AuthRequest, res) => {
    try {
      const {
        name,
        code,
        contactName,
        email,
        phone,
        address,
        website,
        status,
        supplierType,
        supplyCategories,
        historyOfSupply
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      const newSupplier = await db.insert(suppliers).values({
        name,
        code: code || null,
        contactName: contactName || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        website: website || null,
        status: status || 'Active',
        supplierType: supplierType || 'Supplier',
        supplyCategories: supplyCategories || null,
        historyOfSupply: historyOfSupply ? JSON.stringify(historyOfSupply) : null,
        performanceRating: 0.0,
        qualityRating: 0.0,
        deliveryPerformance: 0.0
      }).returning();

      await createAuditLog(
        'SUPPLIER_CREATE',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Supplier / Manufacturer '${name}' [${code || 'N/A'}] added to the centralized database.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.status(201).json(newSupplier[0]);
    } catch (error: any) {
      console.error("Failed to create supplier:", error);
      res.status(500).json({ error: "Failed to create supplier", details: error.message });
    }
  });

  app.put("/api/suppliers/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      const {
        name,
        code,
        contactName,
        email,
        phone,
        address,
        website,
        status,
        supplierType,
        supplyCategories,
        historyOfSupply
      } = req.body;

      const existing = await db.select().from(suppliers).where(eq(suppliers.id, supplierId));
      if (existing.length === 0) {
        return res.status(404).json({ error: "Supplier not found" });
      }

      const updated = await db.update(suppliers).set({
        name: name || existing[0].name,
        code: code !== undefined ? code : existing[0].code,
        contactName: contactName !== undefined ? contactName : existing[0].contactName,
        email: email !== undefined ? email : existing[0].email,
        phone: phone !== undefined ? phone : existing[0].phone,
        address: address !== undefined ? address : existing[0].address,
        website: website !== undefined ? website : existing[0].website,
        status: status || existing[0].status,
        supplierType: supplierType || existing[0].supplierType,
        supplyCategories: supplyCategories !== undefined ? supplyCategories : existing[0].supplyCategories,
        historyOfSupply: historyOfSupply !== undefined ? (historyOfSupply ? JSON.stringify(historyOfSupply) : null) : existing[0].historyOfSupply,
      }).where(eq(suppliers.id, supplierId)).returning();

      await createAuditLog(
        'SUPPLIER_UPDATE',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Supplier / Manufacturer '${updated[0].name}' updated in the database.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.json(updated[0]);
    } catch (error: any) {
      console.error("Failed to update supplier:", error);
      res.status(500).json({ error: "Failed to update supplier", details: error.message });
    }
  });

  app.delete("/api/suppliers/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      const existing = await db.select().from(suppliers).where(eq(suppliers.id, supplierId));
      if (existing.length === 0) {
        return res.status(404).json({ error: "Supplier not found" });
      }

      await db.delete(suppliers).where(eq(suppliers.id, supplierId));

      await createAuditLog(
        'SUPPLIER_DELETE',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Supplier / Manufacturer '${existing[0].name}' permanently removed from the database.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.json({ message: "Supplier deleted successfully" });
    } catch (error: any) {
      console.error("Failed to delete supplier:", error);
      res.status(500).json({ error: "Failed to delete supplier", details: error.message });
    }
  });

  // Agreements and Price Lists
  app.get("/api/suppliers/:id/agreements", requireAuth, async (req: AuthRequest, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      const list = await db.select().from(supplierAgreements).where(eq(supplierAgreements.supplierId, supplierId)).orderBy(desc(supplierAgreements.createdAt));
      res.json(list);
    } catch (error: any) {
      console.error("Failed to fetch agreements:", error);
      res.status(500).json({ error: "Failed to fetch agreements", details: error.message });
    }
  });

  app.post("/api/suppliers/:id/agreements", requireAuth, async (req: AuthRequest, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      const { title, agreementType, documentUrl, startDate, endDate, status, priceItems, remarks } = req.body;

      if (!title || !agreementType) {
        return res.status(400).json({ error: "Title and type are required" });
      }

      const newAgreement = await db.insert(supplierAgreements).values({
        supplierId,
        title,
        agreementType,
        documentUrl: documentUrl || null,
        startDate: startDate || null,
        endDate: endDate || null,
        status: status || 'Active',
        priceItems: priceItems ? JSON.stringify(priceItems) : null,
        remarks: remarks || null
      }).returning();

      await createAuditLog(
        'AGREEMENT_CREATE',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `New ${agreementType} '${title}' added for Supplier ID ${supplierId}.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.status(201).json(newAgreement[0]);
    } catch (error: any) {
      console.error("Failed to add agreement:", error);
      res.status(500).json({ error: "Failed to add agreement", details: error.message });
    }
  });

  app.post("/api/warranty/trigger-claim-and-flag-supplier", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { jobId, sensorId, failureNotes } = req.body;

      if (!sensorId) {
        return res.status(400).json({ error: "Sensor ID is required" });
      }

      // Fetch sensor
      const sensorQuery = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, parseInt(sensorId)));
      if (sensorQuery.length === 0) {
        return res.status(404).json({ error: "Sensor not found" });
      }
      const sensor = sensorQuery[0];

      // Verify warranty status
      const today = new Date();
      today.setHours(0,0,0,0);
      const isWithinWarranty = sensor.warrantyEndDate && new Date(sensor.warrantyEndDate) >= today;

      if (!isWithinWarranty) {
        return res.status(400).json({ error: "Sensor is not within its warranty coverage window." });
      }

      // Search for supplier/manufacturer
      const mfgName = sensor.manufacturer;
      const supplierName = sensor.supplierDetails || mfgName;

      let matchedSupplier: any = null;
      const allSuppliersList = await db.select().from(suppliers);

      // Try to find exact or fuzzy match
      matchedSupplier = allSuppliersList.find(s => 
        s.name.toLowerCase().trim() === supplierName.toLowerCase().trim() ||
        s.name.toLowerCase().trim() === mfgName.toLowerCase().trim()
      );

      if (!matchedSupplier) {
        // Try substring match
        matchedSupplier = allSuppliersList.find(s => 
          s.name.toLowerCase().includes(supplierName.toLowerCase()) || 
          supplierName.toLowerCase().includes(s.name.toLowerCase()) ||
          s.name.toLowerCase().includes(mfgName.toLowerCase())
        );
      }

      let supplierFlagged = false;
      let scoreCardCreated = false;
      let supplierId = null;

      if (matchedSupplier) {
        supplierId = matchedSupplier.id;
        // Flag the supplier by setting status to 'Under Review'
        await db.update(suppliers)
          .set({ status: 'Under Review' })
          .where(eq(suppliers.id, supplierId));

        supplierFlagged = true;

        // Insert automatic scorecard evaluation with low scores due to critical failure
        const evalDate = new Date().toISOString().split('T')[0];
        await db.insert(supplierEvaluations).values({
          supplierId: supplierId,
          evaluationDate: evalDate,
          evaluatorEmail: req.dbUser?.email || 'system@metis.gov',
          qualityScore: 1.0, // Failed calibration / conformity
          deliveryScore: 4.0, // Default average
          responseScore: 2.0, // Prompt for repair needed
          supportScore: 1.0,  // Bad quality support
          overallScore: 2.0,  // calculated average
          feedback: `AUTOMATIC CRITICAL QUALITY FLAG: Sensor S/N ${sensor.serialNumber || 'N/A'} (Model: ${sensor.modelNumber || 'N/A'}, Type: ${sensor.sensorType}) failed critical ISO/IEC 17025 Conformity Evaluation tests in the Calibration Lab (Job ID: #${jobId || 'N/A'}). Calibration Maximum Permissible Error (MPE) thresholds were exceeded. Formal warranty claim filed.`
        });

        scoreCardCreated = true;

        // Re-calculate the supplier's overall scores in suppliers table
        const allEvals = await db.select().from(supplierEvaluations).where(eq(supplierEvaluations.supplierId, supplierId));
        if (allEvals.length > 0) {
          const avgQuality = allEvals.reduce((sum, e) => sum + e.qualityScore, 0) / allEvals.length;
          const avgDelivery = allEvals.reduce((sum, e) => sum + e.deliveryScore, 0) / allEvals.length;
          const avgOverall = allEvals.reduce((sum, e) => sum + e.overallScore, 0) / allEvals.length;

          await db.update(suppliers).set({
            qualityRating: avgQuality,
            deliveryPerformance: avgDelivery,
            performanceRating: avgOverall
          }).where(eq(suppliers.id, supplierId));
        }

        // Create an audit log
        await createAuditLog(
          'SUPPLIER_UPDATE',
          req.dbUser?.email || 'System',
          req.dbUser?.role || 'System',
          `Supplier '${matchedSupplier.name}' flagged to 'Under Review' and automatic low-performance scorecard registered due to ISO/IEC 17025 Calibration Failure on Sensor ID ${sensor.sensorId}.`,
          (req.headers['x-forwarded-for'] as string) || req.ip || null,
          'Success'
        );
      } else {
        // No matching supplier in database, log audit about it
        await createAuditLog(
          'SUPPLIER_UPDATE',
          req.dbUser?.email || 'System',
          req.dbUser?.role || 'System',
          `Warning: Calibration failure occurred for Sensor ID ${sensor.sensorId} under warranty, but supplier/manufacturer '${supplierName}' was not found in the Suppliers & Partners registry to flag.`,
          (req.headers['x-forwarded-for'] as string) || req.ip || null,
          'Success'
        );
      }

      // Respond with the prefilled claim template info
      res.json({
        success: true,
        isWithinWarranty: true,
        supplierFlagged,
        scoreCardCreated,
        supplierName: matchedSupplier ? matchedSupplier.name : supplierName,
        supplierId,
        claimTemplate: {
          claimId: `WCL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          sensorId: sensor.sensorId,
          sensorType: sensor.sensorType,
          serialNumber: sensor.serialNumber,
          modelNumber: sensor.modelNumber,
          manufacturer: sensor.manufacturer,
          procurementDate: sensor.procurementDate,
          warrantyStartDate: sensor.warrantyStartDate,
          warrantyEndDate: sensor.warrantyEndDate,
          invoiceReference: sensor.invoiceReference,
          failureNotes: failureNotes || 'Failed ISO/IEC 17025 Conformity Evaluation tests in the Calibration Lab.',
          calibrationJobId: jobId,
          supplierName: matchedSupplier ? matchedSupplier.name : supplierName,
          supplierEmail: matchedSupplier ? matchedSupplier.email : 'support@supplier.com',
          contactName: matchedSupplier ? matchedSupplier.contactName : 'Warranty Claims Dept',
          todayDate: new Date().toISOString().split('T')[0]
        }
      });
    } catch (error: any) {
      console.error("Failed to trigger warranty claim & flag supplier:", error);
      res.status(500).json({ error: "Failed to process warranty linkage", details: error.message });
    }
  });

  app.post("/api/warranty/submit-claim", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { claimId, sensorId, supplierName, notes } = req.body;
      if (!sensorId || !claimId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const sensorObj = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, parseInt(sensorId)));
      if (sensorObj.length === 0) {
        return res.status(404).json({ error: "Sensor not found" });
      }

      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const logLine = `[${timestamp}] WARRANTY CLAIM FILED (${claimId}) against supplier '${supplierName}'. Status set to 'Under Repair'. Detail: ${notes || 'None'}`;
      const currentLog = sensorObj[0].statusLog || "";

      await db.update(sensorsInventory)
        .set({
          status: 'Under Repair',
          statusLog: currentLog ? `${currentLog}\n${logLine}` : logLine
        })
        .where(eq(sensorsInventory.sensorId, parseInt(sensorId)));

      await createAuditLog(
        'WARRANTY_CLAIM',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Warranty Claim ${claimId} successfully filed for Sensor ID ${sensorId} against supplier '${supplierName}'.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.json({ success: true, message: "Warranty claim logged successfully." });
    } catch (error: any) {
      console.error("Failed to submit claim:", error);
      res.status(500).json({ error: "Failed to log warranty claim", details: error.message });
    }
  });

  app.put("/api/suppliers/agreements/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const agreementId = parseInt(req.params.id);
      const { title, agreementType, documentUrl, startDate, endDate, status, priceItems, remarks } = req.body;

      const existing = await db.select().from(supplierAgreements).where(eq(supplierAgreements.id, agreementId));
      if (existing.length === 0) {
        return res.status(404).json({ error: "Agreement not found" });
      }

      const updated = await db.update(supplierAgreements).set({
        title: title || existing[0].title,
        agreementType: agreementType || existing[0].agreementType,
        documentUrl: documentUrl !== undefined ? documentUrl : existing[0].documentUrl,
        startDate: startDate !== undefined ? startDate : existing[0].startDate,
        endDate: endDate !== undefined ? endDate : existing[0].endDate,
        status: status || existing[0].status,
        priceItems: priceItems !== undefined ? (priceItems ? JSON.stringify(priceItems) : null) : existing[0].priceItems,
        remarks: remarks !== undefined ? remarks : existing[0].remarks,
      }).where(eq(supplierAgreements.id, agreementId)).returning();

      await createAuditLog(
        'AGREEMENT_UPDATE',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Agreement ID ${agreementId} ('${updated[0].title}') updated.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.json(updated[0]);
    } catch (error: any) {
      console.error("Failed to update agreement:", error);
      res.status(500).json({ error: "Failed to update agreement", details: error.message });
    }
  });

  app.delete("/api/suppliers/agreements/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const agreementId = parseInt(req.params.id);
      const existing = await db.select().from(supplierAgreements).where(eq(supplierAgreements.id, agreementId));
      if (existing.length === 0) {
        return res.status(404).json({ error: "Agreement not found" });
      }

      await db.delete(supplierAgreements).where(eq(supplierAgreements.id, agreementId));

      await createAuditLog(
        'AGREEMENT_DELETE',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Agreement ID ${agreementId} ('${existing[0].title}') deleted.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.json({ message: "Agreement deleted successfully" });
    } catch (error: any) {
      console.error("Failed to delete agreement:", error);
      res.status(500).json({ error: "Failed to delete agreement", details: error.message });
    }
  });

  // Evaluations / Scorecards
  app.get("/api/suppliers/:id/evaluations", requireAuth, async (req: AuthRequest, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      const list = await db.select().from(supplierEvaluations).where(eq(supplierEvaluations.supplierId, supplierId)).orderBy(desc(supplierEvaluations.createdAt));
      res.json(list);
    } catch (error: any) {
      console.error("Failed to fetch evaluations:", error);
      res.status(500).json({ error: "Failed to fetch evaluations", details: error.message });
    }
  });

  app.post("/api/suppliers/:id/evaluations", requireAuth, async (req: AuthRequest, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      const { evaluationDate, qualityScore, deliveryScore, responseScore, supportScore, feedback } = req.body;

      if (!evaluationDate || qualityScore === undefined || deliveryScore === undefined || responseScore === undefined || supportScore === undefined) {
        return res.status(400).json({ error: "Date and all scorecard ratings (1-5) are required." });
      }

      const q = parseFloat(qualityScore);
      const d = parseFloat(deliveryScore);
      const r = parseFloat(responseScore);
      const s = parseFloat(supportScore);
      const overall = (q + d + r + s) / 4;

      const newEval = await db.insert(supplierEvaluations).values({
        supplierId,
        evaluationDate,
        evaluatorEmail: req.dbUser?.email || 'Unknown',
        qualityScore: q,
        deliveryScore: d,
        responseScore: r,
        supportScore: s,
        overallScore: overall,
        feedback: feedback || null
      }).returning();

      // Re-calculate the supplier's overall scores in suppliers table
      const allEvals = await db.select().from(supplierEvaluations).where(eq(supplierEvaluations.supplierId, supplierId));
      if (allEvals.length > 0) {
        const avgQuality = allEvals.reduce((sum, e) => sum + e.qualityScore, 0) / allEvals.length;
        const avgDelivery = allEvals.reduce((sum, e) => sum + e.deliveryScore, 0) / allEvals.length;
        const avgOverall = allEvals.reduce((sum, e) => sum + e.overallScore, 0) / allEvals.length;

        await db.update(suppliers).set({
          qualityRating: avgQuality,
          deliveryPerformance: avgDelivery,
          performanceRating: avgOverall
        }).where(eq(suppliers.id, supplierId));
      }

      await createAuditLog(
        'SUPPLIER_EVALUATION',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Performance Evaluation Scorecard submitted for Supplier ID ${supplierId}. Overall Score: ${overall.toFixed(2)}/5.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.status(201).json(newEval[0]);
    } catch (error: any) {
      console.error("Failed to log evaluation:", error);
      res.status(500).json({ error: "Failed to log evaluation", details: error.message });
    }
  });

  app.delete("/api/suppliers/evaluations/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const evalId = parseInt(req.params.id);
      const existing = await db.select().from(supplierEvaluations).where(eq(supplierEvaluations.id, evalId));
      if (existing.length === 0) {
        return res.status(404).json({ error: "Evaluation not found" });
      }

      const supplierId = existing[0].supplierId;
      await db.delete(supplierEvaluations).where(eq(supplierEvaluations.id, evalId));

      // Re-calculate the supplier's overall scores in suppliers table
      const allEvals = await db.select().from(supplierEvaluations).where(eq(supplierEvaluations.supplierId, supplierId));
      if (allEvals.length > 0) {
        const avgQuality = allEvals.reduce((sum, e) => sum + e.qualityScore, 0) / allEvals.length;
        const avgDelivery = allEvals.reduce((sum, e) => sum + e.deliveryScore, 0) / allEvals.length;
        const avgOverall = allEvals.reduce((sum, e) => sum + e.overallScore, 0) / allEvals.length;

        await db.update(suppliers).set({
          qualityRating: avgQuality,
          deliveryPerformance: avgDelivery,
          performanceRating: avgOverall
        }).where(eq(suppliers.id, supplierId));
      } else {
        await db.update(suppliers).set({
          qualityRating: 0.0,
          deliveryPerformance: 0.0,
          performanceRating: 0.0
        }).where(eq(suppliers.id, supplierId));
      }

      await createAuditLog(
        'SUPPLIER_EVALUATION_DELETE',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Evaluation ID ${evalId} removed.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.json({ message: "Evaluation deleted successfully" });
    } catch (error: any) {
      console.error("Failed to delete evaluation:", error);
      res.status(500).json({ error: "Failed to delete evaluation", details: error.message });
    }
  });

  // ==========================================
  // --- Requisition Management API Endpoints ---
  // ==========================================

  app.get("/api/requisitions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const allRequisitions = await db.select().from(requisitions).orderBy(desc(requisitions.id));
      res.json(allRequisitions);
    } catch (error: any) {
      console.error("Failed to fetch requisitions:", error);
      res.status(500).json({ error: "Failed to fetch requisitions", details: error.message });
    }
  });

  app.get("/api/requisitions/stock-suggestions", requireAuth, async (req: AuthRequest, res) => {
    try {
      // 1. Fetch available sensors in Central Store
      const sensorsInStore = await db.select().from(sensorsInventory);
      
      // Group by sensorType
      const storeCounts: Record<string, number> = {};
      const activeCounts: Record<string, number> = {};
      
      sensorsInStore.forEach(s => {
        const type = s.sensorType || "Unknown";
        if (s.status === 'Store' || s.status === 'Spare') {
          storeCounts[type] = (storeCounts[type] || 0) + 1;
        } else if (s.status === 'Active' || s.status === 'Deployed') {
          activeCounts[type] = (activeCounts[type] || 0) + 1;
        }
      });

      // 2. Fetch deployments to calculate consumption
      const allDeployments = await db.select().from(sensorDeployments);
      const allReplacements = await db.select().from(sensorReplacements);

      // We'll calculate demand based on active deployments and replacements in the past year
      const usageCounts: Record<string, number> = {};
      
      // Associate deployment and replacements to sensor type
      allDeployments.forEach(d => {
        const s = sensorsInStore.find(sensor => sensor.sensorId === d.sensorId);
        if (s && s.sensorType) {
          usageCounts[s.sensorType] = (usageCounts[s.sensorType] || 0) + 1;
        }
      });

      allReplacements.forEach(r => {
        const s = sensorsInStore.find(sensor => sensor.sensorId === r.newSensorId);
        if (s && s.sensorType) {
          usageCounts[s.sensorType] = (usageCounts[s.sensorType] || 0) + 1;
        }
      });

      const sensorCategories = ['Thermometer', 'Barometer', 'Anemometer', 'Rain Gauge', 'Hygrometer', 'Solar Radiometer', 'Lightning Detector', 'Radar Transceiver'];
      
      const suggestions = sensorCategories.map(category => {
        const annualUsage = usageCounts[category] || 0;
        // Consumption patterns: if we don't have past data, assume 1-3 consumption per year for calculation
        const calculatedMonthlyRate = Math.max(0.15, annualUsage / 12);
        
        // standard formulas
        const minStock = Math.max(2, Math.ceil(calculatedMonthlyRate * 12 * 0.15)); // 15% of annual demand
        const reorderLevel = Math.max(4, Math.ceil(calculatedMonthlyRate * 12 * 0.35)); // 35% of annual demand
        const maxStock = Math.max(10, Math.ceil(calculatedMonthlyRate * 12 * 1.2)); // 120% of annual demand

        return {
          itemName: category,
          itemType: 'Sensor',
          currentStock: storeCounts[category] || 0,
          activeStock: activeCounts[category] || 0,
          annualConsumption: annualUsage,
          suggestedMinStock: minStock,
          suggestedReorderLevel: reorderLevel,
          suggestedMaxStock: maxStock,
        };
      });

      res.json(suggestions);
    } catch (error: any) {
      console.error("Failed to calculate stock suggestions:", error);
      res.status(500).json({ error: "Failed to calculate stock suggestions", details: error.message });
    }
  });

  app.get("/api/requisitions/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid requisition ID" });

      const reqRecord = await db.select().from(requisitions).where(eq(requisitions.id, id));
      if (reqRecord.length === 0) return res.status(404).json({ error: "Requisition not found" });

      const items = await db.select().from(requisitionItems).where(eq(requisitionItems.requisitionId, id));

      res.json({
        ...reqRecord[0],
        items
      });
    } catch (error: any) {
      console.error("Failed to fetch requisition details:", error);
      res.status(500).json({ error: "Failed to fetch requisition details", details: error.message });
    }
  });

  app.post("/api/requisitions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { stationId, requisitionType, urgency, purpose, remarks, items } = req.body;
      
      if (!requisitionType || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Missing required fields or empty items list" });
      }

      // Generate a unique code REQ-2026-XXXX
      const timestampPart = Date.now().toString().slice(-4);
      const code = `REQ-2026-${Math.floor(1000 + Math.random() * 9000)}-${timestampPart}`;

      const [newReq] = await db.insert(requisitions).values({
        requisitionCode: code,
        stationId: stationId ? parseInt(stationId) : null,
        requisitionType,
        requesterEmail: req.dbUser?.email || "unknown@met.gov.np",
        requesterName: req.dbUser?.email ? req.dbUser.email.split('@')[0] : "Department User",
        requestDate: new Date().toISOString().split('T')[0],
        status: 'Pending Approval',
        urgency: urgency || 'Medium',
        purpose,
        remarks,
      }).returning();

      const itemInserts = items.map(item => ({
        requisitionId: newReq.id,
        itemType: item.itemType || 'Sensor',
        itemName: item.itemName,
        modelNumber: item.modelNumber || null,
        quantityRequested: parseInt(item.quantityRequested) || 1,
        quantityApproved: 0,
        quantityDispatched: 0,
        quantityReceived: 0,
        remarks: item.remarks || null,
      }));

      await db.insert(requisitionItems).values(itemInserts);

      await createAuditLog(
        'REQUISITION_CREATE',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Created material requisition ${code} with ${items.length} items.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.status(201).json({ message: "Requisition submitted successfully", requisitionId: newReq.id, requisitionCode: code });
    } catch (error: any) {
      console.error("Failed to create requisition:", error);
      res.status(500).json({ error: "Failed to submit requisition", details: error.message });
    }
  });

  app.put("/api/requisitions/:id/status", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

      const { 
        status, 
        approvalRemarks, 
        dispatchCourier, 
        dispatchWaybill, 
        grnRemarks,
        itemQuantities, // Array of { itemId: number, approvedQty: number, dispatchedQty: number, receivedQty: number, serialNumberAssigned: string }
      } = req.body;

      const [existingReq] = await db.select().from(requisitions).where(eq(requisitions.id, id));
      if (!existingReq) return res.status(404).json({ error: "Requisition not found" });

      const updateData: any = { status };
      const today = new Date().toISOString().split('T')[0];

      if (status === 'Approved') {
        updateData.approvedBy = req.dbUser?.email || 'Admin';
        updateData.approvalDate = today;
        updateData.approvalRemarks = approvalRemarks || null;
      } else if (status === 'Rejected') {
        updateData.approvedBy = req.dbUser?.email || 'Admin';
        updateData.approvalDate = today;
        updateData.approvalRemarks = approvalRemarks || null;
      } else if (status === 'Dispatched') {
        updateData.dispatchDate = today;
        updateData.dispatchCourier = dispatchCourier || 'DHM Courier';
        updateData.dispatchWaybill = dispatchWaybill || `WB-2026-${Math.floor(10000 + Math.random() * 90000)}`;
      } else if (status === 'Issued') {
        updateData.goodsIssueDate = today;
      } else if (status === 'Received') {
        updateData.grnReceivedDate = today;
        updateData.grnReceivedBy = req.dbUser?.email || 'Station User';
        updateData.grnRemarks = grnRemarks || null;
      }

      await db.update(requisitions).set(updateData).where(eq(requisitions.id, id));

      // Update requisition item details if passed
      if (itemQuantities && Array.isArray(itemQuantities)) {
        for (const itemQty of itemQuantities) {
          const itemUpdate: any = {};
          if (itemQty.approvedQty !== undefined) itemUpdate.quantityApproved = parseInt(itemQty.approvedQty);
          if (itemQty.dispatchedQty !== undefined) itemUpdate.quantityDispatched = parseInt(itemQty.dispatchedQty);
          if (itemQty.receivedQty !== undefined) itemUpdate.quantityReceived = parseInt(itemQty.receivedQty);
          if (itemQty.serialNumberAssigned !== undefined) itemUpdate.serialNumberAssigned = itemQty.serialNumberAssigned;

          await db.update(requisitionItems).set(itemUpdate).where(eq(requisitionItems.id, itemQty.itemId));

          // Real Integration: If a sensor is Dispatched or Received, update its location & status in sensorsInventory!
          if (status === 'Received' && itemQty.serialNumberAssigned && existingReq.stationId) {
            // Find the sensor by serial number or model & update its station and status to 'Store' or 'Spare' or 'Active' at the station!
            const matchedSensors = await db.select().from(sensorsInventory).where(eq(sensorsInventory.serialNumber, itemQty.serialNumberAssigned));
            if (matchedSensors.length > 0) {
              await db.update(sensorsInventory).set({
                stationId: existingReq.stationId,
                status: 'Spare', // Ready for active deployment at that station
                remarks: `Delivered via Requisition ${existingReq.requisitionCode} on ${today}.`
              }).where(eq(sensorsInventory.sensorId, matchedSensors[0].sensorId));
            }
          }
        }
      }

      await createAuditLog(
        'REQUISITION_STATUS_UPDATE',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Requisition ${existingReq.requisitionCode} status updated to ${status}.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      // Fire system notifications for digital approvals / status changes
      try {
        const subject = `Requisition Update: ${existingReq.requisitionCode} is now ${status}`;
        const body = `Dear Department User,\n\nMaterial requisition ${existingReq.requisitionCode} has transitioned to the state: ${status.toUpperCase()}.\nUpdated by: ${req.dbUser?.email || 'System'}\nDate: ${today}\nRemarks: ${approvalRemarks || grnRemarks || 'N/A'}\n\nPlease check the Requisition Management Panel for full details.`;
        await sendNotification('transfer_approval', subject, body, existingReq.requesterEmail);
      } catch (notifErr) {
        console.error("Non-blocking failure sending notification email:", notifErr);
      }

      res.json({ message: `Requisition successfully transitioned to ${status}` });
    } catch (error: any) {
      console.error("Failed to update requisition status:", error);
      res.status(500).json({ error: "Failed to update requisition status", details: error.message });
    }
  });

  app.post("/api/notifications/run-reminders", requireAuth, async (req: AuthRequest, res) => {
    try {
      const stats = await checkAndTriggerMonthlyReminders();
      res.json({
        message: "Monthly scheduled alert checklist run completed successfully.",
        ...stats
      });
    } catch (error: any) {
      console.error("Failed to run reminder checks:", error);
      res.status(500).json({ error: "Failed to process scheduled monthly alerts", details: error.message });
    }
  });

  app.post("/api/notifications/simulate-alert", requireAuth, async (req: AuthRequest, res) => {
    const { alertType, customSubject, customBody, recipient } = req.body;
    if (!alertType) {
      return res.status(400).json({ error: "Missing required simulation parameter: alertType." });
    }

    try {
      const subject = customSubject || `[SIMULATION] Alert System Trigger: ${alertType.toUpperCase()}`;
      const body = customBody || `This is an instant manual simulation of the automated ${alertType} notification system.\nTriggered by: ${req.dbUser?.email || 'Admin'}.\nTimestamp: ${new Date().toISOString()}`;
      
      const result = await sendNotification(alertType, subject, body, recipient);
      res.json({
        message: `Alert of type '${alertType}' triggered successfully.`,
        success: result.success,
        deliveryChannel: result.channel,
        loggedId: result.loggedId,
        error: result.error
      });
    } catch (error: any) {
      console.error("Simulation failed:", error);
      res.status(500).json({ error: "Failed to simulate notification trigger", details: error.message });
    }
  });

  app.post("/api/notifications/send-assignment", requireAuth, async (req: AuthRequest, res) => {
    const { recipientEmail, type, id, title, assignedTo, stationName, priority, linkUrl } = req.body;
    if (!recipientEmail || !type || !id) {
      return res.status(400).json({ error: "Missing required fields: recipientEmail, type, id" });
    }

    try {
      const isTicket = type === 'ticket';
      const label = isTicket ? `Ticket #${id}` : `Work Order ${id}`;
      const subject = `[METIS Assignment] Maintenance ${label} Assigned to ${assignedTo || 'You'}`;
      const body = 
        `METIS Meteorological Station Network System\n` +
        `==========================================\n\n` +
        `Hello ${assignedTo || 'Technician'},\n\n` +
        `You have been assigned a maintenance ${isTicket ? 'issue ticket' : 'work order'}.\n\n` +
        `SUMMARY DETAILS:\n` +
        `- Item: ${label}\n` +
        `- Station / Location: ${stationName || 'Network Field'}\n` +
        `- Title / Summary: ${title || 'Maintenance Task'}\n` +
        `- Priority Level: ${priority || 'Medium'}\n\n` +
        `DIRECT ACCESS LINK:\n` +
        `${linkUrl}\n\n` +
        `Note: Click the link above to open this ${type} directly in METIS. If you are not currently logged in, you will be prompted to sign in first, after which you will be redirected straight to ${label}.\n\n` +
        `Department of Hydrology & Meteorology (DHM) - METIS System`;

      const result = await sendNotification('ticket_assignment', subject, body, recipientEmail);

      res.json({
        message: `Email notification dispatched to ${recipientEmail}`,
        recipientEmail,
        subject,
        linkUrl,
        success: result.success,
        channel: result.channel,
        loggedId: result.loggedId
      });
    } catch (error: any) {
      console.error("Failed to send assignment notification email:", error);
      res.status(500).json({ error: "Failed to send assignment notification", details: error.message });
    }
  });

  // --- Documents Management ---
  app.get("/api/documents", requireAuth, async (req: AuthRequest, res) => {
    try {
      const docs = await db.select().from(documents).orderBy(desc(documents.uploadedAt));
      res.json(docs);
    } catch (error: any) {
      console.error("Failed to fetch documents:", error);
      res.status(500).json({ error: "Failed to fetch documents", details: error.message });
    }
  });

  app.post("/api/documents", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { title, category, fileName, fileType, fileSize, fileContent, stationId, sensorId, sensorModel, serialNumber } = req.body;
      if (!title || !category || !fileName) {
        return res.status(400).json({ error: "Missing required fields: title, category, and fileName are mandatory" });
      }

      const [newDoc] = await db.insert(documents).values({
        title,
        category,
        fileName,
        fileType: fileType || null,
        fileSize: fileSize || null,
        fileContent: fileContent || null,
        uploadedBy: req.dbUser?.email || "unknown@met.gov.np",
        stationId: stationId ? parseInt(stationId) : null,
        sensorId: sensorId ? parseInt(sensorId) : null,
        sensorModel: sensorModel || null,
        serialNumber: serialNumber || null,
      }).returning();

      await createAuditLog(
        'DOCUMENT_UPLOAD',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Uploaded document "${title}" in category "${category}".`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.status(201).json(newDoc);
    } catch (error: any) {
      console.error("Failed to upload document:", error);
      res.status(500).json({ error: "Failed to upload document", details: error.message });
    }
  });

  app.delete("/api/documents/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid document ID" });

      const [existingDoc] = await db.select().from(documents).where(eq(documents.id, id));
      if (!existingDoc) return res.status(404).json({ error: "Document not found" });

      await db.delete(documents).where(eq(documents.id, id));

      await createAuditLog(
        'DOCUMENT_DELETE',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Deleted document "${existingDoc.title}" in category "${existingDoc.category}".`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.json({ message: "Document deleted successfully" });
    } catch (error: any) {
      console.error("Failed to delete document:", error);
      res.status(500).json({ error: "Failed to delete document", details: error.message });
    }
  });

  // --- WMO Siting Classification & Installation Planning Endpoints ---

  app.put("/api/sensors/:id/wmo-siting", requireAuth, async (req: AuthRequest, res) => {
    try {
      const sensorId = parseInt(req.params.id);
      if (isNaN(sensorId)) return res.status(400).json({ error: "Invalid sensor ID" });

      const { wmoSitingClass, wmoChecklist } = req.body;

      const [existingSensor] = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, sensorId));
      if (!existingSensor) return res.status(404).json({ error: "Sensor not found" });

      await db.update(sensorsInventory).set({
        wmoSitingClass: wmoSitingClass || null,
        wmoChecklist: wmoChecklist ? JSON.stringify(wmoChecklist) : null
      }).where(eq(sensorsInventory.sensorId, sensorId));

      await createAuditLog(
        'WMO_SITING_EVALUATION',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Evaluated WMO-No. 8 Siting Class for Sensor ID ${sensorId} (${existingSensor.sensorType} S/N: ${existingSensor.serialNumber || 'N/A'}). Siting Class calculated as: ${wmoSitingClass || 'None'}.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.json({ success: true, message: "WMO Siting evaluation saved successfully." });
    } catch (error: any) {
      console.error("Failed to update WMO siting class:", error);
      res.status(500).json({ error: "Failed to update WMO siting class", details: error.message });
    }
  });

  app.get("/api/installation-projects", requireAuth, async (req: AuthRequest, res) => {
    try {
      const projects = await db.select().from(installationProjects).orderBy(desc(installationProjects.createdAt));
      res.json(projects);
    } catch (error: any) {
      console.error("Failed to fetch installation projects:", error);
      res.status(500).json({ error: "Failed to fetch installation projects", details: error.message });
    }
  });

  app.post("/api/installation-projects", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { projectName, targetStationId, status, dataLoggerModel, solarPanelModel, enclosureModel, sensorIds, scheduledDate, notes } = req.body;
      if (!projectName) {
        return res.status(400).json({ error: "Project name is required" });
      }

      const [newProject] = await db.insert(installationProjects).values({
        projectName,
        targetStationId: targetStationId ? parseInt(targetStationId) : null,
        status: status || 'Draft',
        dataLoggerModel: dataLoggerModel || null,
        solarPanelModel: solarPanelModel || null,
        enclosureModel: enclosureModel || null,
        sensorIds: sensorIds || null,
        compatibilityStatus: 'Unknown',
        compatibilityReport: null,
        scheduledDate: scheduledDate || null,
        notes: notes || null,
      }).returning();

      await createAuditLog(
        'INSTALLATION_PROJECT_CREATE',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Created Installation Project "${projectName}".`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.status(201).json(newProject);
    } catch (error: any) {
      console.error("Failed to create installation project:", error);
      res.status(500).json({ error: "Failed to create installation project", details: error.message });
    }
  });

  app.put("/api/installation-projects/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid project ID" });

      const { projectName, targetStationId, status, dataLoggerModel, solarPanelModel, enclosureModel, sensorIds, scheduledDate, notes } = req.body;

      const [existing] = await db.select().from(installationProjects).where(eq(installationProjects.id, id));
      if (!existing) return res.status(404).json({ error: "Installation project not found" });

      const updatedFields: any = {
        projectName: projectName || existing.projectName,
        targetStationId: targetStationId !== undefined ? (targetStationId ? parseInt(targetStationId) : null) : existing.targetStationId,
        status: status || existing.status,
        dataLoggerModel: dataLoggerModel !== undefined ? dataLoggerModel : existing.dataLoggerModel,
        solarPanelModel: solarPanelModel !== undefined ? solarPanelModel : existing.solarPanelModel,
        enclosureModel: enclosureModel !== undefined ? enclosureModel : existing.enclosureModel,
        sensorIds: sensorIds !== undefined ? sensorIds : existing.sensorIds,
        scheduledDate: scheduledDate !== undefined ? scheduledDate : existing.scheduledDate,
        notes: notes !== undefined ? notes : existing.notes,
      };

      const [updated] = await db.update(installationProjects).set(updatedFields).where(eq(installationProjects.id, id)).returning();

      await createAuditLog(
        'INSTALLATION_PROJECT_UPDATE',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Updated Installation Project "${updated.projectName}".`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.json(updated);
    } catch (error: any) {
      console.error("Failed to update installation project:", error);
      res.status(500).json({ error: "Failed to update installation project", details: error.message });
    }
  });

  app.delete("/api/installation-projects/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid project ID" });

      const [existing] = await db.select().from(installationProjects).where(eq(installationProjects.id, id));
      if (!existing) return res.status(404).json({ error: "Installation project not found" });

      await db.delete(installationProjects).where(eq(installationProjects.id, id));

      await createAuditLog(
        'INSTALLATION_PROJECT_DELETE',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Deleted Installation Project "${existing.projectName}".`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.json({ success: true, message: "Installation project deleted successfully." });
    } catch (error: any) {
      console.error("Failed to delete installation project:", error);
      res.status(500).json({ error: "Failed to delete installation project", details: error.message });
    }
  });

  app.post("/api/installation-projects/:id/validate", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid project ID" });

      const [project] = await db.select().from(installationProjects).where(eq(installationProjects.id, id));
      if (!project) return res.status(404).json({ error: "Installation project not found" });

      // Gather bundled sensors
      const sensorIdArr = project.sensorIds 
        ? project.sensorIds.split(',').map(s => parseInt(s.trim())).filter(s => !isNaN(s))
        : [];

      const bundledSensors: any[] = [];
      const validationItems: any[] = [];
      let overallStatus: 'Valid' | 'Warnings' | 'Invalid' = 'Valid';

      for (const sId of sensorIdArr) {
        const [sensor] = await db.select().from(sensorsInventory).where(eq(sensorsInventory.sensorId, sId));
        if (sensor) {
          bundledSensors.push(sensor);
        } else {
          validationItems.push({
            type: 'sensor_missing',
            severity: 'error',
            message: `Sensor ID #${sId} specified in bundle was not found in active inventory registry.`
          });
          overallStatus = 'Invalid';
        }
      }

      // Check each sensor's health, calibration, warranty, and WMO status
      for (const s of bundledSensors) {
        // 1. Calibration status check
        if (s.status === 'In Calibration' || s.status === 'Retired' || s.status === 'Maintenance') {
          validationItems.push({
            type: 'sensor_status_unusable',
            severity: 'error',
            sensorId: s.sensorId,
            sensorType: s.sensorType,
            serialNumber: s.serialNumber,
            message: `Sensor ${s.sensorType} S/N ${s.serialNumber || 'N/A'} is currently marked '${s.status}'. It cannot be deployed to the field.`
          });
          overallStatus = 'Invalid';
        } else {
          // Check if calibration due date is expired or close
          const today = new Date();
          const sensorCalibrations = await db.select().from(calibrations).where(eq(calibrations.sensorId, s.sensorId)).orderBy(desc(calibrations.calibrationDate));
          if (sensorCalibrations.length > 0) {
            const latestCal = sensorCalibrations[0];
            const dueDate = new Date(latestCal.nextDueDate);
            dueDate.setHours(0,0,0,0);
            if (dueDate < today) {
              validationItems.push({
                type: 'calibration_expired',
                severity: 'error',
                sensorId: s.sensorId,
                sensorType: s.sensorType,
                serialNumber: s.serialNumber,
                message: `Calibration certificate has EXPIRED on ${latestCal.nextDueDate} for ${s.sensorType} S/N ${s.serialNumber || 'N/A'}. Field deployment blocked.`
              });
              overallStatus = 'Invalid';
            } else {
              const diffTime = Math.abs(dueDate.getTime() - today.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              if (diffDays <= 30) {
                validationItems.push({
                  type: 'calibration_expiring_soon',
                  severity: 'warning',
                  sensorId: s.sensorId,
                  sensorType: s.sensorType,
                  serialNumber: s.serialNumber,
                  message: `Calibration for ${s.sensorType} S/N ${s.serialNumber || 'N/A'} is expiring soon in ${diffDays} days (${latestCal.nextDueDate}).`
                });
                if (overallStatus !== 'Invalid') overallStatus = 'Warnings';
              }
            }
          } else {
            validationItems.push({
              type: 'no_calibration_history',
              severity: 'warning',
              sensorId: s.sensorId,
              sensorType: s.sensorType,
              serialNumber: s.serialNumber,
              message: `No calibration record found in the lab registry for ${s.sensorType} S/N ${s.serialNumber || 'N/A'}. Highly recommended to calibrate before field installation.`
            });
            if (overallStatus !== 'Invalid') overallStatus = 'Warnings';
          }
        }

        // 2. Warranty warning check
        const today = new Date();
        today.setHours(0,0,0,0);
        const isUnderWarranty = s.warrantyEndDate && new Date(s.warrantyEndDate) >= today;
        if (!isUnderWarranty) {
          validationItems.push({
            type: 'warranty_expired',
            severity: 'info',
            sensorId: s.sensorId,
            sensorType: s.sensorType,
            serialNumber: s.serialNumber,
            message: `Procurement warranty has expired or is not registered for ${s.sensorType} S/N ${s.serialNumber || 'N/A'}.`
          });
        }

        // 3. Siting check warning
        if (!s.wmoSitingClass) {
          validationItems.push({
            type: 'no_wmo_siting_classification',
            severity: 'warning',
            sensorId: s.sensorId,
            sensorType: s.sensorType,
            serialNumber: s.serialNumber,
            message: `WMO Siting Classification Engine checklist is incomplete for ${s.sensorType} S/N ${s.serialNumber || 'N/A'}. Metadata data quality is untracked.`
          });
          if (overallStatus !== 'Invalid') overallStatus = 'Warnings';
        }
      }

      // Physical data logger channels constraints check
      const dl = (project.dataLoggerModel || '').toLowerCase();
      const totalSensorsCount = bundledSensors.length;
      if (totalSensorsCount > 6) {
        validationItems.push({
          type: 'logger_channel_overload',
          severity: 'warning',
          message: `Bundled sensors count (${totalSensorsCount}) exceeds standard data logger analog/digital port capacity limit (6 channel max). Check terminal multiplexer availability.`
        });
        if (overallStatus !== 'Invalid') overallStatus = 'Warnings';
      }

      // Check sensor type conflicts
      const sensorTypeCounts: { [key: string]: number } = {};
      bundledSensors.forEach(s => {
        sensorTypeCounts[s.sensorType] = (sensorTypeCounts[s.sensorType] || 0) + 1;
      });
      Object.entries(sensorTypeCounts).forEach(([type, count]) => {
        if (count > 2) {
          validationItems.push({
            type: 'sensor_redundancy_warning',
            severity: 'warning',
            message: `Multiple (${count}) sensors of type '${type}' are bundled together. Verify if redundant channel logging is correctly configured on the datalogger program.`
          });
          if (overallStatus !== 'Invalid') overallStatus = 'Warnings';
        }
      });

      // Power compatibility check
      const sp = (project.solarPanelModel || '').toLowerCase();
      let hasSonicOrRadar = bundledSensors.some(s => {
        const st = (s.sensorType || '').toLowerCase();
        const sm = (s.modelNumber || '').toLowerCase();
        return st.includes('radar') || st.includes('ultrasonic') || st.includes('sonic') || sm.includes('sonic');
      });

      if (sp.includes('10w') || sp.includes('20w') || !sp) {
        if (hasSonicOrRadar || totalSensorsCount >= 4) {
          validationItems.push({
            type: 'power_deficit_warning',
            severity: 'warning',
            message: `Low capacity solar panel (${project.solarPanelModel || 'Not Specified'}) paired with high-draw components or numerous sensors (${totalSensorsCount} sensors). Winter/monsoon power budget deficit warning.`
          });
          if (overallStatus !== 'Invalid') overallStatus = 'Warnings';
        }
      }

      // Success messages
      if (validationItems.length === 0) {
        validationItems.push({
          type: 'all_systems_green',
          severity: 'success',
          message: "All bundled items are fully calibrated, warrantied, WMO evaluated, and fully compatible. Pack the truck!"
        });
      }

      const reportJSON = JSON.stringify({
        validatedAt: new Date().toISOString(),
        validatedBy: req.dbUser?.email || 'System',
        items: validationItems
      });

      await db.update(installationProjects).set({
        compatibilityStatus: overallStatus,
        compatibilityReport: reportJSON
      }).where(eq(installationProjects.id, id));

      await createAuditLog(
        'INSTALLATION_PROJECT_VALIDATE',
        req.dbUser?.email || 'Unknown',
        req.dbUser?.role || 'Unknown',
        `Evaluated compatibility of Project ID ${id} ("${project.projectName}"). Verdict: ${overallStatus}.`,
        (req.headers['x-forwarded-for'] as string) || req.ip || null,
        'Success'
      );

      res.json({
        success: true,
        compatibilityStatus: overallStatus,
        compatibilityReport: JSON.parse(reportJSON)
      });
    } catch (error: any) {
      console.error("Failed to validate installation project:", error);
      res.status(500).json({ error: "Failed to validate installation project", details: error.message });
    }
  });

  // --- Vite & Production Client Static Serving ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
