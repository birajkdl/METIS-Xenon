import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  QrCode, 
  CheckCircle, 
  Info,
  AlertCircle,
  Clipboard,
  FileDown
} from 'lucide-react';
import { Sensor } from '../types.ts';
import QRCode from 'qrcode';

interface SensorLabelModalProps {
  sensor: Sensor | null;
  onClose: () => void;
}

export default function SensorLabelModal({ sensor, onClose }: SensorLabelModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isGeneratingLabel, setIsGeneratingLabel] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Fallback if serial number doesn't exist
  const getLabelContent = () => {
    if (!sensor) return '';
    return sensor.serialNumber || `SEN-${sensor.sensorId.toString().padStart(4, '0')}`;
  };

  const qrValue = getLabelContent();

  // Generate QR code on load/sensor change
  useEffect(() => {
    if (!sensor) return;

    const generateQR = async () => {
      try {
        const url = await QRCode.toDataURL(qrValue, {
          width: 300,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
        setQrDataUrl(url);
      } catch (err) {
        console.error('Failed to generate QR Code:', err);
      }
    };

    generateQR();
  }, [sensor, qrValue]);

  if (!sensor) return null;

  const handleCopyText = () => {
    navigator.clipboard.writeText(qrValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Trigger print directly for the label
  const handlePrintLabel = () => {
    // Create a temporary print stylesheet to isolate the label
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden !important;
        }
        #print-label-area, #print-label-area * {
          visibility: visible !important;
        }
        #print-label-area {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 4in !important;
          height: 2in !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          box-shadow: none !important;
          background: white !important;
          color: black !important;
        }
      }
    `;
    document.head.appendChild(style);
    window.print();
    // Cleanup style after print dialog closes
    setTimeout(() => {
      document.head.removeChild(style);
    }, 500);
  };

  // Compile and download high-resolution PNG of the label via Canvas
  const handleDownloadLabelPNG = async () => {
    if (!sensor || !qrDataUrl) return;
    setIsGeneratingLabel(true);
    setDownloadError(null);

    try {
      // Create offscreen canvas: 800 x 400 (standard 2:1 label proportion)
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to create 2D canvas context.');
      }

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 800, 400);

      // Border and Guide Lines
      ctx.strokeStyle = '#222222';
      ctx.lineWidth = 4;
      ctx.strokeRect(12, 12, 776, 376); // outer border

      // Dotted die-cut lines
      ctx.strokeStyle = '#aaaaaa';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(20, 20, 760, 360);
      ctx.setLineDash([]); // Reset line dash

      // Header Text Banner
      ctx.fillStyle = '#000000';
      ctx.fillRect(32, 32, 450, 36);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px "Inter", sans-serif';
      ctx.fillText('METEOROLOGICAL SENSOR REGISTRY', 48, 56);

      // Draw Main Information Block
      ctx.fillStyle = '#000000';
      
      // Label fields
      const drawField = (label: string, value: string, yPos: number, isMonospace = false, isBold = false) => {
        ctx.font = 'bold 13px "Courier New", monospace';
        ctx.fillStyle = '#666666';
        ctx.fillText(label, 36, yPos);

        ctx.fillStyle = '#000000';
        if (isMonospace) {
          ctx.font = isBold ? 'bold 18px "Courier New", monospace' : '15px "Courier New", monospace';
        } else {
          ctx.font = isBold ? 'bold 18px "Inter", sans-serif' : '15px "Inter", sans-serif';
        }
        ctx.fillText(value, 150, yPos);
      };

      const displayType = sensor.sensorType.toUpperCase();
      const displayBrand = sensor.manufacturer;
      const displayModel = sensor.modelNumber || 'N/A';
      const displaySN = sensor.serialNumber || 'NOT REGISTERED';
      const displayAssetId = `SEN-${sensor.sensorId.toString().padStart(4, '0')}`;
      const displayStation = sensor.stationName || 'UNASSIGNED FIELD DEPOT';

      drawField('ASSET TYPE:', displayType, 105, false, true);
      drawField('BRAND/MFR :', displayBrand, 145, false, false);
      drawField('MODEL NO  :', displayModel, 185, true, false);
      
      // Divider line
      ctx.strokeStyle = '#dddddd';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(32, 210);
      ctx.lineTo(482, 210);
      ctx.stroke();

      drawField('SERIAL NO :', displaySN, 245, true, true);
      drawField('ASSET ID  :', displayAssetId, 285, true, true);
      drawField('STATION   :', displayStation.substring(0, 30), 325, false, false);

      // Draw Sub-Footer Branding info
      ctx.fillStyle = '#888888';
      ctx.font = '9px "Courier New", monospace';
      ctx.fillText(`GEN TIME: ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC`, 36, 362);

      // Load QR Code and Draw on Right Hand side
      const qrImg = new Image();
      qrImg.src = qrDataUrl;
      await new Promise<void>((resolve, reject) => {
        qrImg.onload = () => {
          // Draw QR code image on right panel (centered inside 280x280 space)
          // Bounds: X from 495 to 765, Y from 60 to 330
          ctx.drawImage(qrImg, 500, 48, 260, 260);
          resolve();
        };
        qrImg.onerror = () => {
          reject(new Error('Failed to render QR Code image asset onto canvas.'));
        };
      });

      // Under QR Code label description
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(displaySN, 630, 335);
      ctx.font = '8px "Courier New", monospace';
      ctx.fillText('SCAN FOR LIFECYCLE LOGS', 630, 352);

      // Trigger automatic browser download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `label_${displayAssetId}_${displaySN.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();

    } catch (err: any) {
      console.error(err);
      setDownloadError(err.message || 'Error occurred generating label compilation.');
    } finally {
      setIsGeneratingLabel(false);
    }
  };

  // Download QR code only
  const handleDownloadQrOnly = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `qr_${sensor.serialNumber || 'sensor_' + sensor.sensorId}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
      <div 
        className="relative w-full max-w-3xl bg-[#0f0f12] border border-[#1f1f23] rounded-lg shadow-2xl overflow-hidden font-sans"
        id="sensor-label-generator-modal"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#1f1f23] px-6 py-4 bg-black/40">
          <div className="flex items-center space-x-2.5">
            <QrCode className="h-5 w-5 text-blue-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Generate Printable Asset Tag
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/5 rounded-md text-zinc-400 hover:text-white transition cursor-pointer"
            id="close-qr-modal-btn"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Warn if no serial number */}
          {!sensor.serialNumber && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-md p-3.5 flex items-start space-x-2.5">
              <AlertCircle className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-zinc-400 leading-relaxed">
                <span className="text-amber-400 font-semibold block">Missing Serial Number Registry</span>
                This sensor does not have a unique hardware serial number registered. The label barcode content will fall back to its catalog Asset ID (<span className="font-mono text-zinc-200">SEN-{sensor.sensorId.toString().padStart(4, '0')}</span>).
              </div>
            </div>
          )}

          {/* Label Preview Container */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
              <span>Physical Sticker Mockup (Standard 4" x 2" Label)</span>
              <span>Dotted boundary indicates border bleed</span>
            </div>

            {/* High-fidelity CSS Physical Label Mockup */}
            <div className="flex justify-center py-6 bg-black/50 border border-[#1f1f23] rounded-lg">
              <div 
                ref={previewRef}
                id="print-label-area"
                className="w-full max-w-[500px] aspect-[2/1] bg-white text-black p-4 border border-zinc-300 shadow-lg rounded-sm relative flex flex-col justify-between font-sans select-none overflow-hidden"
                style={{ contentVisibility: 'auto' }}
              >
                {/* Outer Die-cut dashed border */}
                <div className="absolute inset-1.5 border border-dashed border-zinc-300 pointer-events-none rounded-xs"></div>

                <div className="flex-1 flex space-x-4 z-10">
                  {/* Left Metadata Side */}
                  <div className="flex-1 flex flex-col justify-between pr-2 border-r border-zinc-100">
                    <div>
                      {/* Registry Badge */}
                      <div className="bg-black text-[9px] font-bold text-white px-2 py-0.5 tracking-wider inline-block rounded-xs mb-2">
                        METEOROLOGICAL ASSET
                      </div>

                      {/* Main sensor metrics */}
                      <div className="space-y-1">
                        <div>
                          <span className="text-[8px] font-mono font-bold text-zinc-400 block tracking-wider leading-none">ASSET TYPE</span>
                          <span className="text-xs font-bold font-sans text-black leading-tight uppercase">{sensor.sensorType}</span>
                        </div>
                        <div>
                          <span className="text-[8px] font-mono font-bold text-zinc-400 block tracking-wider leading-none">MANUFACTURER</span>
                          <span className="text-[10px] font-semibold text-zinc-800 leading-none">{sensor.manufacturer}</span>
                        </div>
                        <div>
                          <span className="text-[8px] font-mono font-bold text-zinc-400 block tracking-wider leading-none">MODEL / MODEL NO</span>
                          <span className="text-[10px] font-mono text-zinc-800 leading-none">{sensor.modelNumber || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 pt-1.5 border-t border-zinc-100 font-mono text-[9px] text-zinc-700">
                      <div className="flex justify-between">
                        <span className="font-bold text-zinc-400">SERIAL NO:</span>
                        <span className="font-bold text-black">{sensor.serialNumber || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-bold text-zinc-400">ASSET ID:</span>
                        <span className="font-bold text-black">SEN-{sensor.sensorId.toString().padStart(4, '0')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right QR Code Side */}
                  <div className="w-[110px] shrink-0 flex flex-col items-center justify-center">
                    {qrDataUrl ? (
                      <img 
                        src={qrDataUrl} 
                        alt="Sensor QR Code" 
                        className="w-24 h-24 p-0.5 border border-zinc-200 bg-white"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-zinc-100 border border-zinc-200 animate-pulse flex items-center justify-center">
                        <QrCode className="h-6 w-6 text-zinc-300" />
                      </div>
                    )}
                    <span className="text-[8px] font-mono font-bold text-black mt-1.5 leading-none">
                      {sensor.serialNumber ? sensor.serialNumber : `SEN-${sensor.sensorId.toString().padStart(4, '0')}`}
                    </span>
                    <span className="text-[6px] font-mono text-zinc-400 mt-0.5 tracking-wider leading-none">
                      SCAN FOR LIFECYCLE LOGS
                    </span>
                  </div>
                </div>

                {/* Footer Brand Info */}
                <div className="text-[7px] text-zinc-400 font-mono flex justify-between pt-1 border-t border-zinc-100 mt-1 z-10">
                  <span>STATION: {sensor.stationName || 'UNASSIGNED FIELD DEPOT'}</span>
                  <span>NATIONAL WEATHER REGISTRY</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Info Section */}
          <div className="bg-[#111113] border border-[#1f1f23] rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 text-xs">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">QR Data Payload</span>
              <div className="flex items-center space-x-2 bg-black border border-[#1f1f23] rounded-md p-2.5 font-mono">
                <span className="text-zinc-200 select-all truncate flex-1">{qrValue}</span>
                <button
                  onClick={handleCopyText}
                  className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-md transition cursor-pointer"
                  title="Copy QR Data to Clipboard"
                >
                  {copied ? (
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Clipboard className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 leading-normal">
                This QR code directly encodes the unique serial number or internal index identifier. Scanning this sticker with the platform's QR Reader automatically loads this sensor's maintenance cycles, active health charts, and deployment transfers.
              </p>
            </div>

            <div className="space-y-2.5 text-xs flex flex-col justify-center">
              <div className="flex items-start space-x-2">
                <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <span className="text-zinc-400 leading-normal text-[11px]">
                  Labels are pre-scaled to fit industry standard **4" x 2" (101.6mm x 50.8mm)** industrial thermal adhesive label rolls (such as Zebra, Brother, or DYMO). Perfect for weatherproof silver polyester or thermal transfer synthetic face stocks.
                </span>
              </div>
            </div>
          </div>

          {downloadError && (
            <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-md text-xs font-mono text-red-400 leading-normal">
              {downloadError}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="border-t border-[#1f1f23] px-6 py-4 bg-black/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <button
            onClick={handleDownloadQrOnly}
            className="inline-flex items-center justify-center space-x-1.5 text-xs text-zinc-400 hover:text-white transition cursor-pointer self-start sm:self-center"
          >
            <Download className="h-4 w-4 text-zinc-500" />
            <span>Download QR Image Only</span>
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 bg-transparent hover:bg-white/5 border border-[#1f1f23] text-zinc-400 hover:text-white font-semibold rounded-md text-xs transition cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handlePrintLabel}
              className="flex-1 sm:flex-initial px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-md text-xs border border-zinc-700 transition cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <Printer className="h-4 w-4 text-zinc-300" />
              <span>Print Label</span>
            </button>
            <button
              onClick={handleDownloadLabelPNG}
              disabled={isGeneratingLabel}
              className="flex-1 sm:flex-initial px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-md text-xs transition cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50"
            >
              {isGeneratingLabel ? (
                <>
                  <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4" />
                  <span>Download Full Label (PNG)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
