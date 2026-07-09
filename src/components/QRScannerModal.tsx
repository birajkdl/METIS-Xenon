import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Camera, 
  QrCode, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw, 
  Cpu, 
  Plus, 
  Wrench, 
  Layers, 
  Search,
  Check
} from 'lucide-react';
import jsQR from 'jsqr';
import { Sensor, WeatherStation } from '../types.ts';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  sensors: Sensor[];
  stations: WeatherStation[];
  onOpenLogCalibration: (sensorId: number) => void;
  onOpenAddSensor: (initialData?: Partial<Sensor>) => void;
  onOpenEditSensor: (sensor: Sensor) => void;
  isAuthenticated: boolean;
  onRefreshData: () => Promise<void>;
  token: string | null;
}

export default function QRScannerModal({
  isOpen,
  onClose,
  sensors,
  stations,
  onOpenLogCalibration,
  onOpenAddSensor,
  onOpenEditSensor,
  isAuthenticated,
  onRefreshData,
  token
}: QRScannerModalProps) {
  // Camera & Scanning states
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [scanningError, setScanningError] = useState<string | null>(null);
  
  // Results states
  const [scannedPayload, setScannedPayload] = useState<string | null>(null);
  const [matchedSensor, setMatchedSensor] = useState<Sensor | null>(null);
  const [associationPending, setAssociationPending] = useState<boolean>(false);
  const [associationTargetSensorId, setAssociationTargetSensorId] = useState<string>('');
  const [associationMessage, setAssociationMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Video and Canvas references for capture
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  // Play audio beep on successful scan
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime); // 1000 Hz
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15); // Beep duration 150ms
    } catch (e) {
      console.warn("Audio beep not supported or blocked by browser policy:", e);
    }
  };

  // 1. Get list of video devices
  useEffect(() => {
    if (!isOpen) return;

    const requestAndEnumerateDevices = async () => {
      try {
        // Request permission explicitly first to ensure devices can be enumerated with labels
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        setScanningError(null);
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        setVideoDevices(videoInputs);

        // Turn off temporary stream
        tempStream.getTracks().forEach(track => track.stop());

        if (videoInputs.length > 0) {
          // Default to environment/back camera if available, otherwise first camera
          const envDevice = videoInputs.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
          const defaultDevice = envDevice ? envDevice.deviceId : videoInputs[0].deviceId;
          setSelectedDeviceId(defaultDevice);
        } else {
          setScanningError("No video capture devices or camera modules detected on this unit.");
        }
      } catch (err: any) {
        console.error("Camera permission error:", err);
        setHasCameraPermission(false);
        setScanningError(err.message || "Camera access permission was denied or is blocked by your security policy.");
      }
    };

    requestAndEnumerateDevices();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // 2. Start/Restart Camera Stream based on selectedDeviceId or state
  useEffect(() => {
    if (!isOpen || !selectedDeviceId || !isScanning) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, selectedDeviceId, isScanning]);

  const startCamera = async () => {
    stopCamera();
    setScanningError(null);

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS Safari
        videoRef.current.play().catch(e => console.error("Video play failed:", e));
        
        // Start decoding frames
        scanLoopRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: any) {
      console.error("Failed to start camera device:", err);
      // Fallback constraints if exact device is rejecting connection
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play().catch(e => console.error("Fallback video play failed:", e));
          scanLoopRef.current = requestAnimationFrame(scanFrame);
        }
      } catch (innerErr) {
        setScanningError("Selected camera is busy or unavailable. Please try another device.");
      }
    }
  };

  const stopCamera = () => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // 3. Render and decode loop
  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current || !isScanning) {
      scanLoopRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data.trim()) {
        handleSuccessfulScan(code.data.trim());
        return; // Break loop
      }
    }

    scanLoopRef.current = requestAnimationFrame(scanFrame);
  };

  // 4. Handle successful barcode/QR decode
  const handleSuccessfulScan = (scannedText: string) => {
    playBeep();
    stopCamera();
    setIsScanning(false);
    setScannedPayload(scannedText);

    // Look for matching sensor
    // Match heuristics:
    // A: exact serialNumber match
    // B: exact barcode match
    // C: exact sensorId match (as integer)
    // D: payload contains "/sensors/{id}" URL
    let found: Sensor | null = null;
    
    // Check URL pattern matching e.g. "https://example.com/sensors/24"
    const urlMatch = scannedText.match(/\/sensors\/(\d+)/);
    const parsedIdFromUrl = urlMatch ? parseInt(urlMatch[1]) : NaN;

    for (const sensor of sensors) {
      if (sensor.serialNumber && sensor.serialNumber.trim() === scannedText) {
        found = sensor;
        break;
      }
      if (sensor.barcode && sensor.barcode.trim() === scannedText) {
        found = sensor;
        break;
      }
      if (sensor.sensorId.toString() === scannedText) {
        found = sensor;
        break;
      }
      if (!isNaN(parsedIdFromUrl) && sensor.sensorId === parsedIdFromUrl) {
        found = sensor;
        break;
      }
    }

    setMatchedSensor(found);
  };

  // Reset scanner to scan again
  const handleScanAgain = () => {
    setScannedPayload(null);
    setMatchedSensor(null);
    setAssociationMessage(null);
    setAssociationTargetSensorId('');
    setAssociationPending(false);
    setIsScanning(true);
  };

  // Associate the scanned QR payload as the barcode field for an existing sensor
  const handleAssociateWithSensorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!associationTargetSensorId || !scannedPayload) return;

    setAssociationPending(true);
    setAssociationMessage(null);

    try {
      const targetSensor = sensors.find(s => s.sensorId === parseInt(associationTargetSensorId));
      if (!targetSensor) throw new Error("Target sensor not found in list.");

      // Update the sensor's barcode/serial database records
      const response = await fetch(`/api/sensors/${targetSensor.sensorId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sensorType: targetSensor.sensorType,
          manufacturer: targetSensor.manufacturer,
          status: targetSensor.status,
          stationId: targetSensor.stationId,
          barcode: scannedPayload, // Save scanned code as barcode
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update sensor barcode metadata.");
      }

      await onRefreshData(); // Trigger reload in parent components
      
      // Update matched sensor details directly
      const updatedSensor = { ...targetSensor, barcode: scannedPayload };
      setMatchedSensor(updatedSensor);
      
      setAssociationMessage({
        type: 'success',
        text: `Successfully associated QR code payload with ${targetSensor.manufacturer} ${targetSensor.sensorType} (ID: ${targetSensor.sensorId})!`
      });
    } catch (err: any) {
      console.error(err);
      setAssociationMessage({
        type: 'error',
        text: err.message || "Failed to establish secure SQL bridge update."
      });
    } finally {
      setAssociationPending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-[#0d0d11] border border-[#232329] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f23] bg-[#0d0d11]">
          <div className="flex items-center space-x-2.5">
            <QrCode className="h-5 w-5 text-blue-500 animate-pulse" />
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                Sensor Camera QR Scanner
              </h3>
              <p className="text-[10px] text-zinc-500 font-mono">
                Scan telemetry tags for rapid diagnostics & calibration lookup
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isScanning ? (
            /* ACTIVE SCANNER VIEW */
            <div className="space-y-4">
              {/* Camera Source Selector if multiple */}
              {videoDevices.length > 1 && (
                <div className="flex items-center justify-between gap-3 p-2.5 bg-[#07070a] border border-[#1f1f23] rounded-lg">
                  <label className="text-[10px] font-mono uppercase text-zinc-400 flex items-center space-x-1.5 shrink-0">
                    <Camera className="h-3.5 w-3.5 text-zinc-500" />
                    <span>Video Unit:</span>
                  </label>
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="flex-1 max-w-[280px] bg-black border border-[#232329] text-xs text-zinc-300 py-1 px-2 rounded-md focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {videoDevices.map((device, index) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera Unit ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Video Stream Window */}
              <div className="relative w-full aspect-video bg-black rounded-lg border border-[#1f1f23] overflow-hidden flex items-center justify-center group">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                
                {/* Canvas used for extraction */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Laser scan animation & target frame overlay */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  {/* Square target box */}
                  <div className="w-48 h-48 border-2 border-dashed border-blue-500/50 bg-blue-500/5 rounded-lg relative flex items-center justify-center">
                    {/* Corner accents */}
                    <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-400"></span>
                    <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-400"></span>
                    <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-400"></span>
                    <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-400"></span>

                    {/* Animated scanning laser line */}
                    <div className="absolute left-0 right-0 h-0.5 bg-blue-500 shadow-lg shadow-blue-500/80 animate-bounce"></div>
                  </div>
                  
                  {/* Floating scan instruction */}
                  <span className="mt-4 px-3 py-1 bg-black/75 rounded-md text-[9px] font-mono font-semibold text-blue-400 uppercase tracking-widest border border-blue-500/25">
                    Align sensor tag QR code inside frame
                  </span>
                </div>

                {scanningError && (
                  <div className="absolute inset-0 bg-black/95 p-6 flex flex-col items-center justify-center text-center space-y-3">
                    <AlertCircle className="h-8 w-8 text-red-500" />
                    <p className="text-xs text-zinc-300 font-semibold">{scanningError}</p>
                    <button
                      onClick={startCamera}
                      className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-[10px] text-zinc-300 font-semibold rounded-md transition cursor-pointer"
                    >
                      Retry Camera Boot
                    </button>
                  </div>
                )}
              </div>

              {/* Status Message */}
              <div className="text-center">
                <p className="text-[10px] text-zinc-500 font-mono">
                  Listening for barcode/QR code matrix in video feed...
                </p>
                <div className="mt-2.5 flex justify-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" style={{ animationDelay: '0.2s' }}></span>
                </div>
              </div>
            </div>
          ) : (
            /* SCAN COMPLETED SCREEN */
            <div className="space-y-5">
              <div className="p-4 bg-[#07070a] border border-[#1f1f23] rounded-lg">
                <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">Scanned Payload Text</span>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-emerald-400 break-all select-all font-semibold">
                    {scannedPayload}
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-mono font-bold uppercase rounded shrink-0">
                    DECODED
                  </span>
                </div>
              </div>

              {matchedSensor ? (
                /* MATCHING SENSOR DETAILS CARD */
                <div className="border border-[#1f1f23] bg-gradient-to-b from-[#101014] to-[#070709] rounded-lg p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[8px] font-mono font-bold uppercase rounded">
                        MATCHED SENSOR
                      </span>
                      <h4 className="mt-1 text-sm font-bold text-white flex items-center gap-1.5">
                        <Cpu className="h-4 w-4 text-zinc-400" />
                        {matchedSensor.manufacturer} {matchedSensor.sensorType}
                      </h4>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                        ID: <span className="text-zinc-300 font-semibold">{matchedSensor.sensorId}</span>
                        {matchedSensor.serialNumber && (
                          <> | Serial: <span className="text-zinc-300 font-semibold">{matchedSensor.serialNumber}</span></>
                        )}
                      </p>
                    </div>

                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      matchedSensor.status === 'Active' ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-500' :
                      matchedSensor.status === 'In Calibration' ? 'bg-blue-500/10 border border-blue-500/25 text-blue-400 animate-pulse' :
                      matchedSensor.status === 'Maintenance' ? 'bg-amber-500/10 border border-amber-500/25 text-amber-500' :
                      'bg-zinc-800 text-zinc-400 border border-zinc-700'
                    }`}>
                      {matchedSensor.status}
                    </span>
                  </div>

                  {/* Meta details grid */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#1f1f23] text-[10px] font-mono">
                    <div>
                      <span className="text-zinc-500 block">Assigned Station:</span>
                      <span className="text-zinc-300 font-semibold">
                        {matchedSensor.stationName || "📦 Inventory Warehouse / Unassigned"}
                      </span>
                    </div>
                    {matchedSensor.assignedOffice && (
                      <div>
                        <span className="text-zinc-500 block">Assigned Office:</span>
                        <span className="text-zinc-300 font-semibold">
                          {matchedSensor.assignedOffice}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-zinc-500 block">Last Calibrated:</span>
                      <span className="text-zinc-300 font-semibold">
                        {matchedSensor.lastCalibration?.calibrationDate 
                          ? new Date(matchedSensor.lastCalibration.calibrationDate).toLocaleDateString()
                          : "Never (No record found)"}
                      </span>
                    </div>
                    {matchedSensor.lastCalibration?.nextDueDate && (
                      <div>
                        <span className="text-zinc-500 block">Calibration Due:</span>
                        <span className={`font-semibold ${
                          new Date(matchedSensor.lastCalibration.nextDueDate) < new Date()
                            ? 'text-red-400 font-bold'
                            : 'text-zinc-300'
                        }`}>
                          {new Date(matchedSensor.lastCalibration.nextDueDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Matching Actions */}
                  <div className="pt-4 border-t border-[#1f1f23] flex flex-col sm:flex-row gap-2.5">
                    <button
                      onClick={() => {
                        onClose();
                        onOpenLogCalibration(matchedSensor!.sensorId);
                      }}
                      className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold tracking-wide transition cursor-pointer"
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      <span>Log Calibration Event</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        onClose();
                        onOpenEditSensor(matchedSensor!);
                      }}
                      className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 bg-[#131316] hover:bg-[#1f1f25] text-zinc-300 border border-[#1f1f23] rounded-md text-xs font-semibold transition cursor-pointer"
                    >
                      <Layers className="h-3.5 w-3.5 text-zinc-500" />
                      <span>Configure Parameters</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* NO MATCHING SENSOR DETECTED */
                <div className="border border-dashed border-zinc-800 bg-[#0a0a0d] rounded-lg p-5 space-y-4">
                  <div className="flex items-center space-x-2.5">
                    <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                        No Matching Sensor Identified
                      </h4>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        This tag/payload does not match any current sensor ID, serial number, or registered barcode.
                      </p>
                    </div>
                  </div>

                  {/* Quick actions for unmapped sensor */}
                  <div className="pt-3 border-t border-[#1f1f23] space-y-4">
                    <div className="flex flex-col sm:flex-row gap-2">
                      {isAuthenticated ? (
                        <button
                          onClick={() => {
                            onClose();
                            // Pass initial data to populate form
                            onOpenAddSensor({
                              barcode: scannedPayload || '',
                              serialNumber: scannedPayload || ''
                            });
                          }}
                          className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-3 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/20 text-blue-400 rounded-md text-xs font-semibold tracking-wide transition cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Catalog New Sensor with this Tag</span>
                        </button>
                      ) : (
                        <p className="text-[9px] text-zinc-600 italic">
                          🔒 Authenticated operators can catalog this tag or link it to an existing asset.
                        </p>
                      )}
                    </div>

                    {/* Manual Association Form */}
                    {isAuthenticated && (
                      <form onSubmit={handleAssociateWithSensorSubmit} className="space-y-2 pt-2">
                        <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                          Or Associate with an Existing Sensor:
                        </label>
                        <div className="flex gap-2">
                          <select
                            required
                            value={associationTargetSensorId}
                            onChange={(e) => setAssociationTargetSensorId(e.target.value)}
                            className="flex-1 bg-[#131316] border border-[#1f1f23] text-xs text-zinc-300 py-2 px-3 rounded-md focus:outline-none focus:border-blue-500 cursor-pointer"
                          >
                            <option value="" disabled>-- Select Existing Sensor to Map --</option>
                            {sensors
                              .filter(s => !s.barcode || s.barcode !== scannedPayload)
                              .map(sensor => (
                                <option key={sensor.sensorId} value={sensor.sensorId}>
                                  [{sensor.sensorId}] {sensor.manufacturer} {sensor.sensorType} {sensor.serialNumber ? `(S/N: ${sensor.serialNumber})` : ''}
                                </option>
                              ))
                            }
                          </select>
                          <button
                            type="submit"
                            disabled={associationPending || !associationTargetSensorId}
                            className="px-3 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-white border border-[#1f1f23] rounded-md transition flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                          >
                            {associationPending ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5 text-blue-400" />
                            )}
                            <span>Link</span>
                          </button>
                        </div>
                      </form>
                    )}

                    {associationMessage && (
                      <div className={`p-3 rounded-md text-[10px] font-mono leading-relaxed border ${
                        associationMessage.type === 'success' 
                          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' 
                          : 'bg-red-500/10 border-red-500/25 text-red-400'
                      }`}>
                        {associationMessage.text}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action buttons footer */}
              <div className="pt-4 border-t border-[#1f1f23] flex justify-end">
                <button
                  onClick={handleScanAgain}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-[#131316] hover:bg-[#1f1f25] border border-[#1f1f23] text-zinc-300 text-xs font-semibold rounded-md transition cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-blue-500" />
                  <span>Scan Another Sensor</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
