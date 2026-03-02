import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  CartesianGrid,
} from "recharts";

const ECGPoint = { t: 0, v: 0 };

function makeDemoECG(n = 250 * 180) {
  const fs = 250;
  const out = [];

  for (let i = 0; i < n; i++) {
    const t = i / fs;
    const phase = t % 1.0;

    let v = 0;

    // P
    if (phase > 0.15 && phase < 0.22) {
      v += 0.12 * Math.sin(((phase - 0.15) / 0.07) * Math.PI);
    }
    // QRS
    if (phase > 0.38 && phase < 0.42) v -= 0.15;
    if (phase > 0.42 && phase < 0.44) v += 1.2;
    if (phase > 0.44 && phase < 0.48) v -= 0.35;
    // T
    if (phase > 0.6 && phase < 0.75) {
      v += 0.25 * Math.sin(((phase - 0.6) / 0.15) * Math.PI);
    }

    // baseline + noise
    v += 0.05 * Math.sin(2 * Math.PI * 0.33 * t);
    v += 0.01 * Math.sin(2 * Math.PI * 22 * t);

    const adc = Math.round(2048 + v * 1200);
    out.push({ t, v: Math.max(0, Math.min(4095, adc)) });
  }

  return out;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function clampDomain([l, r], [b0, b1]) {
  const span = Math.max(1e-9, r - l);
  const total = b1 - b0;

  if (!Number.isFinite(span) || span <= 0 || total <= 0) return [b0, b1];
  if (span >= total) return [b0, b1];

  const maxLeft = b1 - span;
  const left = clamp(l, b0, maxLeft);
  return [left, left + span];
}

function buildTicks(domain, step = 0.5, maxTicks = 220) {
  const [l, r] = domain;
  const span = r - l;
  if (!Number.isFinite(span) || span <= 0) return [];

  const est = Math.floor(span / step) + 1;
  const effectiveStep = est > maxTicks ? span / maxTicks : step;

  const start = Math.ceil(l / effectiveStep) * effectiveStep;
  const ticks = [];
  for (let x = start; x <= r + 1e-9; x += effectiveStep) {
    ticks.push(Number(x.toFixed(6)));
    if (ticks.length > maxTicks + 5) break;
  }
  return ticks;
}

// Timeline Scrollbar Component with position indicator
function TimelineScrollbar({
  totalDomain,
  viewDomain,
  onViewChange,
  height = 40,
}) {
  const trackRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef(null);

  const totalSpan = totalDomain[1] - totalDomain[0];
  const viewSpan = viewDomain[1] - viewDomain[0];
  
  // Calculate thumb position and width as percentages
  const thumbLeft = ((viewDomain[0] - totalDomain[0]) / totalSpan) * 100;
  const thumbWidth = (viewSpan / totalSpan) * 100;

  const handleTrackClick = (e) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercent = clickX / rect.width;
    
    // Center the view at clicked position
    const clickTime = totalDomain[0] + clickPercent * totalSpan;
    const newLeft = clickTime - viewSpan / 2;
    const newDomain = clampDomain([newLeft, newLeft + viewSpan], totalDomain);
    onViewChange(newDomain);
  };

  const handleThumbMouseDown = (e) => {
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      viewLeft: viewDomain[0],
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      if (!trackRef.current || !dragStartRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaPercent = deltaX / rect.width;
      const deltaTime = deltaPercent * totalSpan;
      
      const newLeft = dragStartRef.current.viewLeft + deltaTime;
      const newDomain = clampDomain([newLeft, newLeft + viewSpan], totalDomain);
      onViewChange(newDomain);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, totalDomain, viewSpan, onViewChange, totalSpan]);

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div 
      className="mt-3 px-2"
      data-testid="timeline-scrollbar"
    >
      {/* Time labels */}
      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--silver)' }}>
        <span>{formatTime(totalDomain[0])}</span>
        <span className="font-medium" style={{ color: 'var(--cornell-red)' }}>
          {formatTime(viewDomain[0])} - {formatTime(viewDomain[1])}
        </span>
        <span>{formatTime(totalDomain[1])}</span>
      </div>
      
      {/* Scrollbar track */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="relative rounded-full cursor-pointer transition-all"
        style={{
          height: `${height}px`,
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
        }}
        data-testid="scrollbar-track"
      >
        {/* Mini waveform preview in track */}
        <div 
          className="absolute inset-0 rounded-full overflow-hidden opacity-30"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, var(--cornell-red) 20%, var(--cornell-red) 80%, transparent 100%)',
            maskImage: 'linear-gradient(90deg, transparent, black 10%, black 90%, transparent)',
            WebkitMaskImage: 'linear-gradient(90deg, transparent, black 10%, black 90%, transparent)',
          }}
        />
        
        {/* Thumb / Current view indicator */}
        <div
          onMouseDown={handleThumbMouseDown}
          className="absolute top-0 bottom-0 rounded-full cursor-grab active:cursor-grabbing transition-shadow"
          style={{
            left: `${thumbLeft}%`,
            width: `${Math.max(thumbWidth, 2)}%`,
            background: 'linear-gradient(180deg, rgba(180, 60, 60, 0.9) 0%, rgba(140, 40, 40, 0.9) 100%)',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            boxShadow: isDragging 
              ? '0 0 20px rgba(180, 60, 60, 0.6), inset 0 1px 0 rgba(255,255,255,0.2)' 
              : '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
          }}
          data-testid="scrollbar-thumb"
        >
          {/* Grip lines */}
          <div className="absolute inset-0 flex items-center justify-center gap-1">
            <div className="w-0.5 h-3 rounded-full bg-white/40" />
            <div className="w-0.5 h-4 rounded-full bg-white/50" />
            <div className="w-0.5 h-3 rounded-full bg-white/40" />
          </div>
        </div>
      </div>
    </div>
  );
}

function EcgChart({
  data,
  xDomain,
  yLabel,
  referenceArea,
  referenceAreaColor,
  suppressTooltip,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
}) {
  const ticks = useMemo(() => buildTicks(xDomain, 0.5), [xDomain]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 10, right: 18, bottom: 10, left: 10 }}
        onMouseDown={(s) => onMouseDown?.(s ?? {})}
        onMouseMove={(s) => onMouseMove?.(s ?? {})}
        onMouseUp={(s) => onMouseUp?.(s ?? {})}
        onMouseLeave={() => onMouseLeave?.()}
      >
        <CartesianGrid strokeDasharray="3 3" />

        <XAxis
          dataKey="t"
          type="number"
          domain={xDomain}
          allowDataOverflow
          ticks={ticks}
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => `${v.toFixed(1)}s`}
          minTickGap={18}
          axisLine={false}
          tickLine={false}
        />

        <YAxis
          domain={[0, 4095]}
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => v.toFixed(0)}
          axisLine={false}
          tickLine={false}
          width={55}
          label={{ value: yLabel, angle: -90, position: "insideLeft" }}
        />

        <Tooltip
          cursor={{ stroke: "rgba(0,0,0,0.15)", strokeWidth: 1 }}
          isAnimationActive={false}
          wrapperStyle={{
            display: suppressTooltip ? "none" : "block",
            pointerEvents: "none",
          }}
          formatter={(value) => {
            const num = typeof value === "number" ? value : Number(value);
            if (!Number.isFinite(num)) return ["—", yLabel];
            return [num.toFixed(0), yLabel];
          }}
          labelFormatter={(label) => {
            const num = typeof label === "number" ? label : Number(label);
            if (!Number.isFinite(num)) return "t=—";
            return `t=${num.toFixed(3)}s`;
          }}
        />

        {referenceArea && (
          <ReferenceArea
            x1={referenceArea.left}
            x2={referenceArea.right}
            strokeOpacity={0}
            fillOpacity={0.12}
            fill={referenceAreaColor ?? "var(--cornell-red)"}
          />
        )}

        <Line
          type="monotone"
          dataKey="v"
          dot={false}
          strokeWidth={2}
          stroke="var(--cornell-red)"
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function ECGWaveformPanel({
  title = "ECG Waveform - Channel 1",
  subtitle = "Demo data (will be replaced by uploaded file)",
  data,
  yLabel = "ADC (0-4095)",
  jumpTo = null,
  highlightWindowSec = 8,
  highlightColor = null,
}) {
  const chartData = useMemo(() => data ?? makeDemoECG(), [data]);

  const baseDomain = useMemo(() => {
    if (chartData.length < 2) return [0, 25];
    return [chartData[0].t, chartData[chartData.length - 1].t];
  }, [chartData]);

  // -------------------------
  // Config
  // -------------------------
  const DEFAULT_OVERVIEW_SEC = 25;

  // -------------------------
  // Refs for wheel-pan scaling
  // -------------------------
  const overviewPanelRef = useRef(null);
  const zoomPanelRef = useRef(null);

  // -------------------------
  // Overview window (TOP) - 25s by default
  // -------------------------
  const [overviewDomain, setOverviewDomain] = useState(() => {
    return [0, DEFAULT_OVERVIEW_SEC];
  });

  useEffect(() => {
    // reset to first 25s whenever data changes
    const dom = clampDomain(
      [baseDomain[0], baseDomain[0] + DEFAULT_OVERVIEW_SEC],
      baseDomain,
    );
    setOverviewDomain(dom);

    // clear zoom/overlays
    setZoomViewDomain(null);
    setSelectionArea(null);
    setActivityHighlight(null);

    dragStartTRef.current = null;
    dragEndTRef.current = null;
    setIsDragging(false);
  }, [baseDomain[0], baseDomain[1]]);

  // -------------------------
  // Selection (drag highlight on overview)
  // -------------------------
  const [isDragging, setIsDragging] = useState(false);
  const dragStartTRef = useRef(null);
  const dragEndTRef = useRef(null);

  const [selectionArea, setSelectionArea] = useState(null);

  // -------------------------
  // Activity highlight overlay (jump-to)
  // -------------------------
  const [activityHighlight, setActivityHighlight] = useState(null);

  // -------------------------
  // Zoom window (BOTTOM)
  // -------------------------
  const [zoomViewDomain, setZoomViewDomain] = useState(null);

  const resetAll = () => {
    const dom = clampDomain(
      [baseDomain[0], baseDomain[0] + DEFAULT_OVERVIEW_SEC],
      baseDomain,
    );
    setOverviewDomain(dom);

    setZoomViewDomain(null);
    setSelectionArea(null);
    setActivityHighlight(null);

    dragStartTRef.current = null;
    dragEndTRef.current = null;
    setIsDragging(false);
  };

  // -------------------------
  // Jump-to: open zoom around the event + show overlay in overview
  // -------------------------
  useEffect(() => {
    if (jumpTo == null) return;
    if (chartData.length < 2) return;

    const jt = clamp(jumpTo, baseDomain[0], baseDomain[1]);

    // move overview window to include jt (keep span)
    setOverviewDomain((prev) => {
      const span = prev[1] - prev[0];
      const left = jt - span * 0.2;
      return clampDomain([left, left + span], baseDomain);
    });

    const hlLeft = clamp(jt, baseDomain[0], baseDomain[1]);
    const hlRight = clamp(
      jt + Math.max(0.1, highlightWindowSec),
      baseDomain[0],
      baseDomain[1],
    );
    setActivityHighlight({ left: hlLeft, right: hlRight });

    const span = Math.max(1, highlightWindowSec);
    const left = jt - span * 0.2;
    const dom = clampDomain([left, left + span], baseDomain);
    setZoomViewDomain(dom);
  }, [jumpTo, highlightWindowSec, baseDomain, chartData.length]);

  // -------------------------
  // Wheel-pan overview (TOP) only (no zoom)
  // -------------------------
  const panOverviewBySeconds = (deltaSec) => {
    setOverviewDomain((prev) => {
      const span = prev[1] - prev[0];
      return clampDomain(
        [prev[0] + deltaSec, prev[0] + deltaSec + span],
        baseDomain,
      );
    });
  };

  const onOverviewWheel = (e) => {
    // Use deltaY (vertical scroll) for horizontal panning
    const delta = -e.deltaY;
    if (delta === 0) return;

    e.preventDefault();

    const el = overviewPanelRef.current;
    const w = el?.clientWidth ?? 800;
    const span = overviewDomain[1] - overviewDomain[0];

    const secPerPx = span / Math.max(1, w);
    panOverviewBySeconds(delta * secPerPx);
  };

  // -------------------------
  // Drag selection on overview -> zoom panel opens below
  // -------------------------
  const onOverviewMouseDown = (s) => {
    if (typeof s?.activeLabel !== "number") return;

    setIsDragging(true);
    dragStartTRef.current = s.activeLabel;
    dragEndTRef.current = s.activeLabel;

    setSelectionArea({ left: s.activeLabel, right: s.activeLabel });
    setActivityHighlight(null);
  };

  const onOverviewMouseMove = (s) => {
    if (!isDragging) return;
    if (typeof s?.activeLabel !== "number") return;

    dragEndTRef.current = s.activeLabel;

    const a = dragStartTRef.current;
    const b = dragEndTRef.current;
    if (a == null || b == null) return;

    const left = clamp(Math.min(a, b), overviewDomain[0], overviewDomain[1]);
    const right = clamp(Math.max(a, b), overviewDomain[0], overviewDomain[1]);
    setSelectionArea({ left, right });
  };

  const finalizeSelectionToZoom = () => {
    const a = dragStartTRef.current;
    const b = dragEndTRef.current;
    if (a == null || b == null) return;

    const left = clamp(Math.min(a, b), overviewDomain[0], overviewDomain[1]);
    const right = clamp(Math.max(a, b), overviewDomain[0], overviewDomain[1]);

    if (right - left < 0.02) return;

    const dom = clampDomain([left, right], baseDomain);
    setZoomViewDomain(dom);
  };

  const onOverviewMouseUp = () => {
    if (!isDragging) return;
    finalizeSelectionToZoom();

    setIsDragging(false);
    dragStartTRef.current = null;
    dragEndTRef.current = null;
  };

  useEffect(() => {
    const onWinUp = () => {
      if (!isDragging) return;
      finalizeSelectionToZoom();

      setIsDragging(false);
      dragStartTRef.current = null;
      dragEndTRef.current = null;
    };

    const onKey = (ev) => {
      if (ev.key === "Escape") {
        setIsDragging(false);
        dragStartTRef.current = null;
        dragEndTRef.current = null;
        setSelectionArea(null);
      }
    };

    window.addEventListener("mouseup", onWinUp);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mouseup", onWinUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [isDragging, overviewDomain[0], overviewDomain[1], baseDomain]);

  // -------------------------
  // Wheel-pan zoom (BOTTOM) only
  // -------------------------
  const panZoomBySeconds = (deltaSec) => {
    setZoomViewDomain((prev) => {
      if (!prev) return prev;
      const span = prev[1] - prev[0];
      return clampDomain(
        [prev[0] + deltaSec, prev[0] + deltaSec + span],
        baseDomain,
      );
    });
  };

  const onZoomWheel = (e) => {
    if (!zoomViewDomain) return;

    const delta = -e.deltaY;
    if (delta === 0) return;

    e.preventDefault();

    const el = zoomPanelRef.current;
    const w = el?.clientWidth ?? 800;
    const span = zoomViewDomain[1] - zoomViewDomain[0];

    const secPerPx = span / Math.max(1, w);
    panZoomBySeconds(delta * secPerPx);
  };

  // Buttons: adjust zoom window span
  const setZoomWindow = (sec) => {
    setZoomViewDomain((prev) => {
      const anchor = prev ? prev[0] : baseDomain[0];
      return clampDomain([anchor, anchor + sec], baseDomain);
    });
  };

  return (
    <div className="frosted-glass rounded-2xl p-6 shadow-lg" data-testid="ecg-waveform-panel">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3
            className="text-md font-medium"
            style={{ color: "var(--eerie-black)" }}
          >
            {title}
          </h3>
          <p className="text-sm" style={{ color: "var(--silver)" }}>
            {subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={resetAll}
          className="frosted-glass glow-hover rounded-xl px-4 py-2 text-sm transition-all duration-300"
          style={{ color: "var(--cornell-red)" }}
          data-testid="reset-button"
        >
          Reset
        </button>
      </div>

      {/* OVERVIEW PLOT */}
      <div
        ref={overviewPanelRef}
        onWheel={onOverviewWheel}
        className="ecg-paper-bg rounded-xl p-4"
        style={{
          width: "100%",
          height: 420,
          position: "relative",
          overflowY: "hidden",
          userSelect: "none",
        }}
        data-testid="overview-chart"
      >
        <EcgChart
          data={chartData}
          xDomain={overviewDomain}
          yLabel={yLabel}
          referenceArea={selectionArea ?? activityHighlight}
          referenceAreaColor={activityHighlight ? highlightColor : undefined}
          suppressTooltip={isDragging}
          onMouseDown={onOverviewMouseDown}
          onMouseMove={onOverviewMouseMove}
          onMouseUp={onOverviewMouseUp}
        />
      </div>

      {/* Timeline Scrollbar for Overview */}
      <TimelineScrollbar
        totalDomain={baseDomain}
        viewDomain={overviewDomain}
        onViewChange={setOverviewDomain}
        height={32}
      />

      {/* ZOOM VIEW */}
      {zoomViewDomain && (
        <div
          className="mt-6 ecg-paper-bg rounded-xl p-4"
          style={{ width: "100%", height: 320, position: "relative" }}
          data-testid="zoom-view"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div
                className="text-sm font-medium"
                style={{ color: "var(--eerie-black)" }}
              >
                Zoom View
              </div>
              <div className="text-xs" style={{ color: "var(--silver)" }}>
                {zoomViewDomain[0].toFixed(3)}s → {zoomViewDomain[1].toFixed(3)}s
              </div>
            </div>

            <div className="flex items-center gap-2">
              {[1, 2, 5, 10].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setZoomWindow(sec)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    backdropFilter: "blur(10px)",
                    color: "var(--silver)",
                  }}
                  title={`Set zoom window to ${sec}s`}
                  data-testid={`zoom-${sec}s-button`}
                >
                  {sec}s
                </button>
              ))}

              <button
                type="button"
                onClick={() => setZoomViewDomain(null)}
                className="frosted-glass glow-hover rounded-xl px-3 py-1.5 text-sm transition-all duration-300"
                style={{ color: "var(--cornell-red)" }}
                data-testid="close-zoom-button"
              >
                Close
              </button>
            </div>
          </div>

          <div
            ref={zoomPanelRef}
            onWheel={onZoomWheel}
            style={{
              width: "100%",
              height: "calc(100% - 80px)",
              position: "relative",
              overflowX: "auto",
              overflowY: "hidden",
              userSelect: "none",
            }}
            data-testid="zoom-chart"
          >
            <EcgChart
              data={chartData}
              xDomain={zoomViewDomain}
              yLabel={yLabel}
              referenceArea={null}
              suppressTooltip={false}
            />
          </div>

          {/* Timeline Scrollbar for Zoom View */}
          <TimelineScrollbar
            totalDomain={baseDomain}
            viewDomain={zoomViewDomain}
            onViewChange={setZoomViewDomain}
            height={28}
          />
        </div>
      )}
    </div>
  );
}
