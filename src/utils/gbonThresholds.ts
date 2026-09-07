import { Sensor, WeatherStation } from '../types.ts';

export interface GBONThresholdConfig {
  telemetryMaxAgeMins: number; // e.g. 30 mins
  tempMin: number; // -40.0
  tempMax: number; // 60.0
  baroDriftMaxHpa: number; // 1.5 hPa
  windSpeedMaxMs: number; // 50.0 m/s
  humidityMin: number; // 0
  humidityMax: number; // 100
  batteryMinVoltage: number; // 11.5 V
}

export const DEFAULT_GBON_THRESHOLDS: GBONThresholdConfig = {
  telemetryMaxAgeMins: 30,
  tempMin: -40.0,
  tempMax: 60.0,
  baroDriftMaxHpa: 1.5,
  windSpeedMaxMs: 50.0,
  humidityMin: 0.0,
  humidityMax: 100.0,
  batteryMinVoltage: 11.5,
};

export interface GBONAlertItem {
  id: string;
  sensorId?: number;
  sensorType?: string;
  stationId: number;
  stationName: string;
  region: string;
  type: 'gbon_window_risk' | 'off_line' | 'out_of_tolerance' | 'battery_drop';
  severity: 'critical' | 'high' | 'medium';
  title: string;
  message: string;
  symptomValue: string;
  thresholdLimit: string;
  nextGbonWindowUtc: string;
  minutesToGbonWindow: number;
  createdAt: string;
  dismissed: boolean;
}

export function getStoredThresholds(): GBONThresholdConfig {
  try {
    const saved = localStorage.getItem('metis_gbon_thresholds');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return DEFAULT_GBON_THRESHOLDS;
}

export function saveStoredThresholds(config: GBONThresholdConfig) {
  localStorage.setItem('metis_gbon_thresholds', JSON.stringify(config));
  window.dispatchEvent(new Event('metis_thresholds_updated'));
}

export function getNextGBONWindowInfo() {
  const now = new Date();
  const currentUtcHour = now.getUTCHours();
  
  // GBON mandatory synoptic hours: 00, 03, 06, 09, 12, 15, 18, 21
  const synopticHours = [0, 3, 6, 9, 12, 15, 18, 21, 24];
  const nextHour = synopticHours.find(h => h > currentUtcHour) ?? 24;
  
  const target = new Date(now);
  if (nextHour === 24) {
    target.setUTCDate(target.getUTCDate() + 1);
    target.setUTCHours(0, 0, 0, 0);
  } else {
    target.setUTCHours(nextHour, 0, 0, 0);
  }

  const diffMs = target.getTime() - now.getTime();
  const minutesLeft = Math.max(0, Math.floor(diffMs / (1000 * 60)));
  const formattedUtc = `${String(target.getUTCHours()).padStart(2, '0')}:00 UTC`;

  return {
    nextWindowUtc: formattedUtc,
    minutesLeft,
    targetTimestamp: target.getTime()
  };
}

export function generateGBONThresholdAlerts(
  stations: WeatherStation[],
  sensors: Sensor[],
  thresholds: GBONThresholdConfig = getStoredThresholds()
): GBONAlertItem[] {
  const alerts: GBONAlertItem[] = [];
  const gbonInfo = getNextGBONWindowInfo();

  stations.forEach(st => {
    const stSensors = sensors.filter(s => s.stationId === st.stationId);
    const voltage = st.batteryCurrentVoltage !== undefined && st.batteryCurrentVoltage !== null
      ? Number(st.batteryCurrentVoltage)
      : 12.0;

    // 1. Check Station Off-line / Communication Failure Threshold
    const stStatus = st.status || 'Active';
    const isStationOffline = stStatus === 'No communication' || stStatus === 'critical' || stStatus === 'Warning';
    if (isStationOffline) {
      alerts.push({
        id: `gbon-offline-st-${st.stationId}`,
        stationId: st.stationId,
        stationName: st.stationName,
        region: st.region,
        type: isStationOffline ? 'off_line' : 'gbon_window_risk',
        severity: gbonInfo.minutesLeft <= 45 ? 'critical' : 'high',
        title: `Telemetry Off-line: GBON Risk at ${st.stationName}`,
        message: `Station telemetry modem non-responsive (${stStatus}). Risk of missing mandatory ${gbonInfo.nextWindowUtc} GBON synoptic window.`,
        symptomValue: `Modem State: ${stStatus}`,
        thresholdLimit: `Telemetry Max Age: < ${thresholds.telemetryMaxAgeMins} mins`,
        nextGbonWindowUtc: gbonInfo.nextWindowUtc,
        minutesToGbonWindow: gbonInfo.minutesLeft,
        createdAt: new Date().toISOString().substring(0, 16),
        dismissed: false
      });
    }

    // 2. Check Battery Voltage Threshold
    if (voltage < thresholds.batteryMinVoltage) {
      alerts.push({
        id: `gbon-battery-st-${st.stationId}`,
        stationId: st.stationId,
        stationName: st.stationName,
        region: st.region,
        type: 'battery_drop',
        severity: voltage < 11.0 ? 'critical' : 'high',
        title: `Battery Cutoff Threshold Exceeded (${voltage.toFixed(1)}V)`,
        message: `Solar battery voltage dropped below ${thresholds.batteryMinVoltage}V operational limit. Telemetry transmitter at risk before ${gbonInfo.nextWindowUtc} window.`,
        symptomValue: `${voltage.toFixed(1)} V`,
        thresholdLimit: `Min Cutoff: ${thresholds.batteryMinVoltage} V`,
        nextGbonWindowUtc: gbonInfo.nextWindowUtc,
        minutesToGbonWindow: gbonInfo.minutesLeft,
        createdAt: new Date().toISOString().substring(0, 16),
        dismissed: false
      });
    }

    // 3. Check Sensor Out-of-Tolerance & Out-of-Calibration Thresholds
    stSensors.forEach(sensor => {
      const lastCal = sensor.lastCalibration;
      const isOverdue = lastCal && new Date(lastCal.nextDueDate) < new Date();
      const isFailed = lastCal && lastCal.result === 'Failed';
      const isSensorDamaged = sensor.status === 'Damaged' || sensor.status === 'Maintenance';

      if (isFailed || isSensorDamaged) {
        alerts.push({
          id: `gbon-out-tolerance-sen-${sensor.sensorId}`,
          sensorId: sensor.sensorId,
          sensorType: sensor.sensorType,
          stationId: st.stationId,
          stationName: st.stationName,
          region: st.region,
          type: 'out_of_tolerance',
          severity: 'high',
          title: `Sensor Out-of-Tolerance (${sensor.sensorType})`,
          message: isFailed 
            ? `Calibration check failed out-of-spec readings. Data frame invalid for WMO GBON quality control.`
            : `Sensor flagged in maintenance/damaged state. Transmission stream invalid.`,
          symptomValue: isFailed ? 'Calibration Check: Failed' : `Status: ${sensor.status}`,
          thresholdLimit: `WMO GBON Class B/C Tolerance`,
          nextGbonWindowUtc: gbonInfo.nextWindowUtc,
          minutesToGbonWindow: gbonInfo.minutesLeft,
          createdAt: new Date().toISOString().substring(0, 16),
          dismissed: false
        });
      } else if (isOverdue) {
        alerts.push({
          id: `gbon-cal-overdue-sen-${sensor.sensorId}`,
          sensorId: sensor.sensorId,
          sensorType: sensor.sensorType,
          stationId: st.stationId,
          stationName: st.stationName,
          region: st.region,
          type: 'out_of_tolerance',
          severity: 'medium',
          title: `Calibration Overdue - GBON Compliance Warning`,
          message: `Sensor calibration interval expired on ${lastCal.nextDueDate}. Drift tolerance unverified for mandatory GBON submission.`,
          symptomValue: `Overdue since ${lastCal.nextDueDate}`,
          thresholdLimit: `Annual Calibration Cycle`,
          nextGbonWindowUtc: gbonInfo.nextWindowUtc,
          minutesToGbonWindow: gbonInfo.minutesLeft,
          createdAt: new Date().toISOString().substring(0, 16),
          dismissed: false
        });
      }
    });
  });

  return alerts;
}
