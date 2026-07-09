import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db/index.ts";
import { weatherStations, sensorsInventory, calibrations, users, customStatuses, sensorDeployments, sensorReplacements, sensorTransfers, customRoles, smtpConfig, notificationSettings, deliveryLogs, auditLogs, suppliers, supplierAgreements, supplierEvaluations, requisitions, requisitionItems, documents } from "./src/db/schema.ts";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import { sendNotification, checkAndTriggerMonthlyReminders } from "./src/lib/notifications.ts";
import { adminAuth } from "./src/lib/firebase-admin.ts";
import { getOrCreateUser } from "./src/db/users.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

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
        return {
          ...station,
          stationName: renamedName,
          batteryVoltageType,
          batteryCurrentVoltage,
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

  // Run seeding on startup
  await seedDatabase();
  await seedStatuses();
  await seedRoles();
  await seedSuppliers();

  // Ensure 'birajkdl@gmail.com' has the Super Administrator role if they exist
  try {
    await db.update(users)
      .set({ role: 'Super Administrator' })
      .where(eq(users.email, 'birajkdl@gmail.com'));
    console.log("Super Administrator role verified for birajkdl@gmail.com on startup.");
  } catch (err) {
    console.error("Failed to verify/update superadmin on startup:", err);
  }

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

      // Automatically determine assignedStationId based on office
      let assignedStationId: number | null = null;
      if (office && typeof office === 'string') {
        const officeLower = office.toLowerCase().trim();
        // Skip "global" or "head" offices
        if (!officeLower.includes("head") && !officeLower.includes("global") && !officeLower.includes("admin") && !officeLower.includes("super")) {
          // Fetch all stations
          const stationsList = await db.select().from(weatherStations);
          // Try to find a match where the office text matches or is a substring of stationName or region (or vice versa)
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

      const updated = await db.update(users)
        .set({
          phoneNumber: phoneNumber || null,
          username: username || null,
          designation: designation || null,
          office: office || null,
          role: role || 'Read-only/Audit User',
          assignedStationId: assignedStationId
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
    if (callerRole !== "Super Administrator") {
      return res.status(403).json({ error: "Forbidden: Only Super Administrators can manage roles." });
    }

    const { uid } = req.params;
    const { role, assignedStationId } = req.body;

    try {
      const updated = await db.update(users)
        .set({
          role,
          assignedStationId: assignedStationId ? parseInt(assignedStationId) : null
        })
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

    const { roleName, description } = req.body;
    if (!roleName) {
      return res.status(400).json({ error: "Missing required field: roleName" });
    }

    try {
      const result = await db.insert(customRoles)
        .values({
          roleName,
          description: description || null
        })
        .returning();

      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error("Failed to create custom role:", error);
      res.status(500).json({ error: "Failed to create custom role", details: error.message });
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

      // Sensors requiring urgent attention (status is 'Maintenance' or 'In Calibration', or next calibration date has passed)
      const todayStr = new Date().toISOString().split('T')[0];
      const urgentSensors = sensorsList.filter(sensor => {
        if (sensor.status === "Maintenance" || sensor.status === "In Calibration") {
          return true;
        }
        // Check if there is a calibration next due date that is in the past
        const sensorCalibrations = calibrationsList.filter(c => c.sensorId === sensor.sensorId);
        if (sensorCalibrations.length > 0) {
          const sorted = [...sensorCalibrations].sort((a, b) => b.nextDueDate.localeCompare(a.nextDueDate));
          if (sorted[0].nextDueDate < todayStr) {
            return true;
          }
        }
        return false;
      }).map(sensor => {
        const station = stationsList.find(st => st.stationId === sensor.stationId);
        const sensorCals = calibrationsList.filter(c => c.sensorId === sensor.sensorId);
        const lastCal = sensorCals.length > 0 ? sensorCals.sort((a, b) => b.calibrationDate.localeCompare(a.calibrationDate))[0] : null;
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
          const sorted = [...sensorCalibrations].sort((a, b) => b.nextDueDate.localeCompare(a.nextDueDate));
          const nextDueDateStr = sorted[0].nextDueDate;
          if (nextDueDateStr >= todayStr) {
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
        const lastCal = sensorCals.length > 0 ? sensorCals.sort((a, b) => b.calibrationDate.localeCompare(a.calibrationDate))[0] : null;
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

  // 2. Weather Stations Endpoints
  app.get("/api/stations", async (req, res) => {
    try {
      const stations = await db.select().from(weatherStations).orderBy(desc(weatherStations.createdAt));
      const sensors = await db.select().from(sensorsInventory);

      // Attach sensor counts
      const stationsWithCounts = stations.map(station => {
        const stationSensors = sensors.filter(s => s.stationId === station.stationId);
        return {
          ...station,
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

  app.post("/api/stations", requireAuth, async (req: AuthRequest, res) => {
    const role = req.dbUser?.role;
    if (role !== 'Super Administrator' && role !== 'Head Office Admin/User' && role !== 'Regional Office Admin/User') {
      return res.status(403).json({ error: "Forbidden: You do not have permission to manage weather stations." });
    }

    const { stationName, region, latitude, longitude, batteryVoltageType, batteryCurrentVoltage, stationType } = req.body;
    if (!stationName || !region || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "Missing required fields: stationName, region, latitude, longitude" });
    }

    const firstWord = stationName.trim().split(/\s+/)[0];
    const formattedStationName = firstWord ? `${firstWord} AWS` : stationName;

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
        })
        .returning();

      res.status(201).json(result[0]);
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

    const { stationName, region, latitude, longitude, batteryVoltageType, batteryCurrentVoltage, stationType } = req.body;
    if (!stationName || !region || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "Missing required fields: stationName, region, latitude, longitude" });
    }

    const firstWord = stationName.trim().split(/\s+/)[0];
    const formattedStationName = firstWord ? `${firstWord} AWS` : stationName;

    try {
      const result = await db.update(weatherStations)
        .set({
          stationName: formattedStationName,
          region,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          batteryVoltageType: batteryVoltageType || null,
          batteryCurrentVoltage: batteryCurrentVoltage !== undefined && batteryCurrentVoltage !== null ? parseFloat(batteryCurrentVoltage) : null,
          stationType: stationType || null,
        })
        .where(eq(weatherStations.stationId, stationId))
        .returning();

      res.json(result[0]);
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
        const sortedCals = [...sensorCals].sort((a, b) => b.calibrationDate.localeCompare(a.calibrationDate));
        
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

      const result = await db.insert(sensorsInventory)
        .values({
          sensorType,
          manufacturer,
          status,
          stationId: stationId ? parseInt(stationId) : null,
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
          assignedOffice: assignedOffice || null,
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
        documents
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
        const token = authHeader.split('Bearer ')[1];
        try {
          const decodedToken = await adminAuth.verifyIdToken(token);
          const dbUser = await getOrCreateUser(decodedToken.uid, decodedToken.email || '');
          if (dbUser) {
            email = dbUser.email;
            role = dbUser.role || 'Read-only/Audit User';
          }
        } catch (e) {
          // ignore
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
