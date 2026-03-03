import { useMemo, useState, useCallback, useRef } from "react";
import ECGWaveformPanel from "./ECGWaveformPanel";
import Header from "./Header";
import LeftSidebar from "./LeftSidebar";
import { parseMicroSdBin } from "../utils/parseMicroSdBin";
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
  if (lowerLabel.includes("cry")) return "#ff9500";
  if (lowerLabel.includes("eat") || lowerLabel.includes("feed")) return "#34c759";
  if (lowerLabel.includes("sleep") || lowerLabel.includes("rest")) return "#007aff";
  if (lowerLabel.includes("active")) return "#ff2d55";
  return "#af52de";
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function formatDate(unixMs: number): string {
  return new Date(unixMs).toLocaleString();
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="apple-card p-4">
      <div className="text-xs font-medium mb-1" style={{ color: "var(--tertiary-label)" }}>{label}</div>
      <div className="text-xl font-semibold" style={{ color: color || "var(--label)" }}>{value}</div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div 
        className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: "var(--timberwolf)", borderTopColor: "var(--cornell-red)" }}
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
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedActivity = useMemo(() => {
    return activities.find((a) => a.id === selectedActivityId) ?? null;
  }, [activities, selectedActivityId]);

  const stats = useMemo(() => {
    if (!points || !meta) return null;
    
    const values = points.map(p => p.v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const duration = points.length / meta.sampleRateHz;
    
    return { min: Math.round(min), max: Math.round(max), duration, totalActivities: activities.length };
  }, [points, meta, activities]);

  const subtitle = useMemo(() => {
    if (!points) return "Upload a .bin file to begin analysis";
    if (!meta) return fileName || "Loaded ECG";
    const duration = formatTime(points.length / meta.sampleRateHz);
    return `${fileName} - ${meta.numChannels} ch - ${meta.sampleRateHz} Hz - ${duration}`;
  }, [points, meta, fileName]);

  const processFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    
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
    } catch (err) {
      console.error("Error processing file:", err);
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

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
    if (file && (file.name.endsWith(".bin") || file.type === "application/octet-stream")) {
      processFile(file);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--secondary-bg)" }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Header />
      <LeftSidebar />

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
          style={{ background: "rgba(255, 255, 255, 0.9)", backdropFilter: "blur(8px)" }}
        >
          <div className="apple-card p-12 text-center" style={{ border: "2px dashed var(--cornell-red)" }}>
            <svg className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--cornell-red)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div className="text-lg font-medium" style={{ color: "var(--cornell-red)" }}>Drop .bin file here</div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="pl-20 pt-16 pr-4 pb-4" style={{ minHeight: "100vh" }}>
        {/* Top bar with patient info */}
        <div className="apple-card mb-4 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255, 59, 48, 0.12)" }}
            >
              <svg className="w-6 h-6" style={{ color: "var(--cornell-red)" }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--label)" }}>Patient: GIGI</h2>
              <div className="text-xs" style={{ color: "var(--tertiary-label)" }}>ID: 12345</div>
            </div>
          </div>
          
          <button
            onClick={onUploadClick}
            disabled={isLoading}
            className="apple-button apple-button-primary text-sm disabled:opacity-50"
            type="button"
            data-testid="upload-btn"
          >
            Upload ECG
          </button>
        </div>

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            <StatCard label="Duration" value={formatTime(stats.duration)} />
            <StatCard label="Sample Rate" value={`${meta?.sampleRateHz} Hz`} />
            <StatCard label="Min / Max" value={`${stats.min} / ${stats.max}`} />
            <StatCard label="Events" value={String(stats.totalActivities)} color="var(--cornell-red)" />
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="apple-card mb-4 p-4" style={{ background: "rgba(255, 59, 48, 0.08)" }}>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" style={{ color: "var(--cornell-red)" }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <span className="text-sm" style={{ color: "var(--cornell-red)" }}>{error}</span>
            </div>
          </div>
        )}

        {/* Main content area */}
        <div className="flex gap-4" style={{ height: "calc(100vh - 220px)" }}>
          {/* ECG Panel */}
          <section className="flex-1 min-w-0">
            {isLoading ? (
              <div className="apple-card h-full flex items-center justify-center">
                <div className="text-center">
                  <LoadingSpinner />
                  <div className="text-sm mt-4" style={{ color: "var(--tertiary-label)" }}>Processing ECG data...</div>
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
          </section>

          {/* Right sidebar */}
          <aside className="w-72 shrink-0 flex flex-col gap-4 overflow-hidden">
            {/* Activity Log */}
            <div className="apple-card flex-1 flex flex-col p-4 overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold" style={{ color: "var(--label)" }}>Activity Log</h3>
                {activities.length > 0 && (
                  <span 
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "rgba(255, 59, 48, 0.12)", color: "var(--cornell-red)" }}
                  >
                    {activities.length}
                  </span>
                )}
              </div>

              {activities.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-center">
                  <div>
                    <svg className="w-10 h-10 mx-auto mb-2" style={{ color: "var(--timberwolf)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-xs" style={{ color: "var(--tertiary-label)" }}>
                      {points ? "No activities detected" : "Upload data to see activities"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                  {activities.map((a, index) => {
                    const isActive = a.id === selectedActivityId;
                    const color = getActivityColor(a.label);
                    
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelectedActivityId(a.id)}
                        className="w-full text-left rounded-xl px-3 py-3 transition-all"
                        style={{
                          background: isActive ? `${color}15` : "var(--secondary-bg)",
                          border: isActive ? `1px solid ${color}40` : "1px solid var(--separator)",
                        }}
                        data-testid={`activity-${index}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium" style={{ color }}>{a.label}</span>
                          {a.confidence && (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--secondary-bg)", color: "var(--tertiary-label)" }}>
                              {Math.round(a.confidence * 100)}%
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--tertiary-label)" }}>
                          <span>{formatTime(a.tSec)}</span>
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                          </svg>
                          <span>{formatTime(a.tSec + a.durationSec)}</span>
                          <span className="ml-auto font-medium" style={{ color: isActive ? color : "var(--silver)" }}>
                            {formatTime(a.durationSec)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* File Info */}
            {meta && (
              <div className="apple-card shrink-0 p-4">
                <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--label)" }}>File Info</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span style={{ color: "var(--tertiary-label)" }}>File ID</span>
                    <span style={{ color: "var(--secondary-label)" }}>{meta.fileId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--tertiary-label)" }}>Channels</span>
                    <span style={{ color: "var(--secondary-label)" }}>{meta.numChannels}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--tertiary-label)" }}>ADC Bits</span>
                    <span style={{ color: "var(--secondary-label)" }}>{meta.adcBits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--tertiary-label)" }}>Recorded</span>
                    <span style={{ color: "var(--secondary-label)" }}>{formatDate(meta.startUnixMs)}</span>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
