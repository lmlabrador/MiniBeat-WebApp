import { useMemo, useState, useCallback, useRef } from "react";
import ECGWaveformPanel from "./ECGWaveformPanel";
import { parseMicroSdBin, generateDemoFile } from "../utils/parseMicroSdBin";
import type { ActivityLogItem, ECGPoint } from "../utils/parseMicroSdBin";

type BinMeta = {
  fileId: number;
  adcBits: number;
  numChannels: number;
  sampleRateHz: number;
  startUnixMs: number;
  samplesPerBlock: number;
};

function downsample(points: ECGPoint[], maxPoints = 25000): ECGPoint[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const out: ECGPoint[] = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  return out;
}

function getActivityColor(label: string): string {
  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes("cry")) return "rgba(255, 152, 0, 0.35)"; // orange
  if (lowerLabel.includes("eat") || lowerLabel.includes("feed")) return "rgba(76, 175, 80, 0.35)"; // green
  if (lowerLabel.includes("sleep") || lowerLabel.includes("rest")) return "rgba(33, 150, 243, 0.35)"; // blue
  if (lowerLabel.includes("active")) return "rgba(233, 30, 99, 0.35)"; // pink
  return "rgba(156, 39, 176, 0.35)"; // purple
}

function getActivityTextColor(label: string): string {
  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes("cry")) return "#ff9800";
  if (lowerLabel.includes("eat") || lowerLabel.includes("feed")) return "#4caf50";
  if (lowerLabel.includes("sleep") || lowerLabel.includes("rest")) return "#2196f3";
  if (lowerLabel.includes("active")) return "#e91e63";
  return "#9c27b0";
}

function getActivityIcon(label: string): string {
  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes("cry")) return "😢";
  if (lowerLabel.includes("eat") || lowerLabel.includes("feed")) return "🍼";
  if (lowerLabel.includes("sleep")) return "😴";
  if (lowerLabel.includes("rest")) return "🛋️";
  if (lowerLabel.includes("active")) return "🏃";
  return "📊";
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function formatDate(unixMs: number): string {
  return new Date(unixMs).toLocaleString();
}

// Stats card component
function StatCard({ label, value, subtext, color }: { label: string; value: string; subtext?: string; color?: string }) {
  return (
    <div 
      className="rounded-xl p-3 transition-all duration-200 hover:scale-[1.02]"
      style={{ 
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)'
      }}
    >
      <div className="text-xs mb-1" style={{ color: '#666' }}>{label}</div>
      <div className="text-lg font-semibold" style={{ color: color || '#ccc' }}>{value}</div>
      {subtext && <div className="text-xs mt-0.5" style={{ color: '#555' }}>{subtext}</div>}
    </div>
  );
}

// Loading spinner
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div 
        className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ 
          borderColor: 'rgba(180, 60, 60, 0.2)',
          borderTopColor: '#b43c3c'
        }}
      />
    </div>
  );
}

export default function DashboardLayout() {
  const [fileName, setFileName] = useState<string>("");
  const [meta, setMeta] = useState<BinMeta | null>(null);
  const [points, setPoints] = useState<ECGPoint[] | null>(null);
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [analysisText, setAnalysisText] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedActivity = useMemo(() => {
    return activities.find((a) => a.id === selectedActivityId) ?? null;
  }, [activities, selectedActivityId]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!points || !meta) return null;
    
    const values = points.map(p => p.v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const duration = points.length / meta.sampleRateHz;
    
    // Count activities by type
    const activityCounts: Record<string, number> = {};
    activities.forEach(a => {
      const key = a.label.toLowerCase();
      activityCounts[key] = (activityCounts[key] || 0) + 1;
    });
    
    return {
      min: Math.round(min),
      max: Math.round(max),
      avg: Math.round(avg),
      duration,
      totalActivities: activities.length,
      activityCounts,
    };
  }, [points, meta, activities]);

  const subtitle = useMemo(() => {
    if (!points) return "No file loaded. Upload a .bin file or load demo data.";
    if (!meta) return fileName || "Loaded ECG";
    const duration = formatTime(points.length / meta.sampleRateHz);
    return `${fileName} • ${meta.numChannels} ch • ${meta.sampleRateHz} Hz • ${duration} • ${activities.length} events`;
  }, [points, meta, fileName, activities.length]);

  const processFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setAnalysisText("");
    
    // Simulate processing delay for smoother UX
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseMicroSdBin(buffer);

      setFileName(file.name);
      setMeta({
        fileId: parsed.fileId,
        adcBits: parsed.adcBits,
        numChannels: parsed.numChannels,
        sampleRateHz: parsed.sampleRateHz,
        startUnixMs: parsed.startUnixMs,
        samplesPerBlock: parsed.samplesPerBlock,
      });
      setPoints(downsample(parsed.ecg, 25000));
      setActivities(parsed.activities);

      if (parsed.activities.length > 0) {
        setSelectedActivityId(parsed.activities[0].id);
      } else {
        setSelectedActivityId(null);
      }
      
      // Generate analysis summary
      generateAnalysis(parsed.activities);
      
    } catch (error) {
      console.error('Error processing file:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadDemoData = useCallback(() => {
    setIsLoading(true);
    setAnalysisText("");
    
    setTimeout(() => {
      const demo = generateDemoFile();
      
      setFileName("demo_ecg_data.bin");
      setMeta({
        fileId: demo.fileId,
        adcBits: demo.adcBits,
        numChannels: demo.numChannels,
        sampleRateHz: demo.sampleRateHz,
        startUnixMs: demo.startUnixMs,
        samplesPerBlock: demo.samplesPerBlock,
      });
      setPoints(downsample(demo.ecg, 25000));
      setActivities(demo.activities);

      if (demo.activities.length > 0) {
        setSelectedActivityId(demo.activities[0].id);
      }
      
      generateAnalysis(demo.activities);
      setIsLoading(false);
    }, 500);
  }, []);

  const generateAnalysis = (activityList: ActivityLogItem[]) => {
    if (activityList.length === 0) {
      setAnalysisText("No activities detected in this recording.");
      return;
    }
    
    // Count by type
    const counts: Record<string, { count: number; totalDuration: number }> = {};
    activityList.forEach(a => {
      const key = a.label;
      if (!counts[key]) counts[key] = { count: 0, totalDuration: 0 };
      counts[key].count++;
      counts[key].totalDuration += a.durationSec;
    });
    
    const lines: string[] = [];
    lines.push(`Detected ${activityList.length} activity events:\n`);
    
    Object.entries(counts).forEach(([label, data]) => {
      lines.push(`• ${label}: ${data.count}x (${formatTime(data.totalDuration)} total)`);
    });
    
    // Find longest activity
    const longest = activityList.reduce((a, b) => a.durationSec > b.durationSec ? a : b);
    lines.push(`\nLongest event: ${longest.label} (${formatTime(longest.durationSec)})`);
    
    setAnalysisText(lines.join('\n'));
  };

  const onUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.bin') || file.type === 'application/octet-stream')) {
      processFile(file);
    }
  };

  return (
    <main
      className="flex flex-col p-4 overflow-hidden"
      style={{ height: "100vh", background: '#0a0a0c' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".bin,application/octet-stream"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Drag overlay */}
      {isDragOver && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
        >
          <div 
            className="rounded-2xl p-12 text-center"
            style={{ 
              background: 'rgba(180, 60, 60, 0.1)',
              border: '2px dashed #b43c3c'
            }}
          >
            <div className="text-4xl mb-4">📂</div>
            <div className="text-xl" style={{ color: '#b43c3c' }}>Drop .bin file here</div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header 
        className="mb-4 shrink-0 rounded-xl p-4 flex items-center justify-between"
        style={{ 
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        <div className="flex items-center gap-4">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
            style={{ background: 'rgba(180, 60, 60, 0.2)' }}
          >
            👶
          </div>
          <div>
            <h2 className="text-base font-medium" style={{ color: '#ddd' }}>
              Patient: GIGI
            </h2>
            <div className="text-xs" style={{ color: '#666' }}>ID: 12345</div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={loadDemoData}
            disabled={isLoading}
            className="rounded-lg px-4 py-2 text-sm transition-all duration-200 hover:scale-[1.02] disabled:opacity-50"
            style={{ 
              color: '#888',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
            type="button"
            data-testid="load-demo-btn"
          >
            Load Demo
          </button>
          <button
            onClick={onUploadClick}
            disabled={isLoading}
            className="rounded-lg px-4 py-2 text-sm transition-all duration-200 hover:scale-[1.02] disabled:opacity-50"
            style={{ 
              color: '#b43c3c',
              background: 'rgba(180, 60, 60, 0.1)',
              border: '1px solid rgba(180, 60, 60, 0.3)'
            }}
            type="button"
            data-testid="upload-btn"
          >
            Upload ECG
          </button>
        </div>
      </header>

      {/* Body: ECG (left) + Sidebar (right) */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Left — ECG waveform */}
        <section className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Stats row */}
          {stats && (
            <div 
              className="grid grid-cols-5 gap-3 shrink-0"
              style={{ animation: 'fadeIn 0.3s ease-out' }}
            >
              <StatCard label="Duration" value={formatTime(stats.duration)} />
              <StatCard label="Sample Rate" value={`${meta?.sampleRateHz} Hz`} />
              <StatCard label="Min Value" value={String(stats.min)} />
              <StatCard label="Max Value" value={String(stats.max)} />
              <StatCard label="Events" value={String(stats.totalActivities)} color="#b43c3c" />
            </div>
          )}
          
          {/* ECG Panel */}
          <div className="min-h-0 flex-1">
            {isLoading ? (
              <div 
                className="h-full rounded-xl flex items-center justify-center"
                style={{ 
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
              >
                <div className="text-center">
                  <LoadingSpinner />
                  <div className="text-sm mt-4" style={{ color: '#666' }}>Processing ECG data...</div>
                </div>
              </div>
            ) : (
              <ECGWaveformPanel
                data={points ?? undefined}
                subtitle={subtitle}
                yLabel="ADC"
                jumpTo={selectedActivity ? selectedActivity.tSec : null}
                highlightWindowSec={selectedActivity ? selectedActivity.durationSec : 8}
                highlightColor={selectedActivity ? getActivityColor(selectedActivity.label) : null}
              />
            )}
          </div>
        </section>

        {/* Right — Sidebar */}
        <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-hidden">
          {/* Activity Log */}
          <div 
            className="flex-1 flex flex-col rounded-xl p-4 overflow-hidden"
            style={{ 
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)'
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium" style={{ color: '#aaa' }}>
                Activity Log
              </h3>
              {activities.length > 0 && (
                <span 
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(180, 60, 60, 0.2)', color: '#b43c3c' }}
                >
                  {activities.length}
                </span>
              )}
            </div>

            {activities.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center">
                <div>
                  <div className="text-3xl mb-2 opacity-30">📋</div>
                  <p className="text-xs" style={{ color: '#555' }}>
                    {points ? "No activities detected" : "Load data to see activities"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {activities.map((a, index) => {
                  const isActive = a.id === selectedActivityId;
                  const icon = getActivityIcon(a.label);
                  
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelectedActivityId(a.id)}
                      className="w-full text-left rounded-lg px-3 py-2.5 transition-all duration-150 hover:scale-[1.01]"
                      style={{
                        background: isActive ? `${getActivityTextColor(a.label)}15` : 'rgba(255,255,255,0.02)',
                        border: isActive ? `1px solid ${getActivityTextColor(a.label)}50` : '1px solid rgba(255,255,255,0.05)',
                        animation: `slideIn 0.2s ease-out ${index * 0.03}s both`
                      }}
                      data-testid={`activity-${index}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">{icon}</span>
                        <span className="text-sm font-medium" style={{ color: getActivityTextColor(a.label) }}>
                          {a.label}
                        </span>
                        {a.confidence && (
                          <span 
                            className="text-xs ml-auto px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(255,255,255,0.05)', color: '#666' }}
                          >
                            {Math.round(a.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs" style={{ color: '#666' }}>
                        <span>{formatTime(a.tSec)}</span>
                        <span>→</span>
                        <span>{formatTime(a.tSec + a.durationSec)}</span>
                        <span 
                          className="ml-auto font-medium"
                          style={{ color: isActive ? getActivityTextColor(a.label) : '#888' }}
                        >
                          {formatTime(a.durationSec)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Analysis */}
          <div 
            className="shrink-0 rounded-xl p-4"
            style={{ 
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              maxHeight: '200px'
            }}
          >
            <h3 className="text-sm font-medium mb-3" style={{ color: '#aaa' }}>
              Analysis Summary
            </h3>
            
            {!analysisText ? (
              <div className="text-center py-4">
                <div className="text-2xl mb-2 opacity-30">🤖</div>
                <p className="text-xs" style={{ color: '#555' }}>
                  Load data to generate analysis
                </p>
              </div>
            ) : (
              <pre 
                className="text-xs whitespace-pre-wrap overflow-y-auto custom-scrollbar"
                style={{ color: '#888', maxHeight: '120px' }}
              >
                {analysisText}
              </pre>
            )}
          </div>

          {/* File Info */}
          {meta && (
            <div 
              className="shrink-0 rounded-xl p-4"
              style={{ 
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)'
              }}
            >
              <h3 className="text-sm font-medium mb-2" style={{ color: '#aaa' }}>
                File Info
              </h3>
              <div className="space-y-1 text-xs" style={{ color: '#666' }}>
                <div className="flex justify-between">
                  <span>File ID</span>
                  <span style={{ color: '#888' }}>{meta.fileId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Channels</span>
                  <span style={{ color: '#888' }}>{meta.numChannels}</span>
                </div>
                <div className="flex justify-between">
                  <span>ADC Bits</span>
                  <span style={{ color: '#888' }}>{meta.adcBits}</span>
                </div>
                <div className="flex justify-between">
                  <span>Recorded</span>
                  <span style={{ color: '#888' }}>{formatDate(meta.startUnixMs)}</span>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2);
        }
      `}</style>
    </main>
  );
}
