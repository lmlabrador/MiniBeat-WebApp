import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";

function makeDemoECG(n = 250 * 180) {
  const fs = 250;
  const times = new Float64Array(n);
  const values = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / fs;
    const phase = t % 1.0;

    let v = 0;

    // P wave
    if (phase > 0.15 && phase < 0.22) {
      v += 0.12 * Math.sin(((phase - 0.15) / 0.07) * Math.PI);
    }
    // QRS complex
    if (phase > 0.38 && phase < 0.42) v -= 0.15;
    if (phase > 0.42 && phase < 0.44) v += 1.2;
    if (phase > 0.44 && phase < 0.48) v -= 0.35;
    // T wave
    if (phase > 0.6 && phase < 0.75) {
      v += 0.25 * Math.sin(((phase - 0.6) / 0.15) * Math.PI);
    }

    // baseline + noise
    v += 0.05 * Math.sin(2 * Math.PI * 0.33 * t);
    v += 0.01 * Math.sin(2 * Math.PI * 22 * t);

    const adc = Math.round(2048 + v * 1200);
    times[i] = t;
    values[i] = Math.max(0, Math.min(4095, adc));
  }

  return [times, values];
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

// Timeline Scrollbar Component
function TimelineScrollbar({ totalDomain, viewDomain, onViewChange, height = 40 }) {
  const trackRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef(null);

  const totalSpan = totalDomain[1] - totalDomain[0];
  const viewSpan = viewDomain[1] - viewDomain[0];
  
  const thumbLeft = ((viewDomain[0] - totalDomain[0]) / totalSpan) * 100;
  const thumbWidth = (viewSpan / totalSpan) * 100;

  const handleTrackClick = (e) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercent = clickX / rect.width;
    
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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="mt-3 px-2" data-testid="timeline-scrollbar">
      <div className="flex justify-between text-xs mb-1" style={{ color: '#9ca3af' }}>
        <span>{formatTime(totalDomain[0])}</span>
        <span className="font-medium" style={{ color: '#b43c3c' }}>
          {formatTime(viewDomain[0])} - {formatTime(viewDomain[1])}
        </span>
        <span>{formatTime(totalDomain[1])}</span>
      </div>
      
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

// High-performance Canvas ECG Chart
function CanvasECGChart({ 
  data, 
  xDomain, 
  yLabel = "ADC (0-4095)",
  height = 380,
  highlightArea,
  highlightColor,
  onSelect,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = dimensions.width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setDimensions({ 
            width: entry.contentRect.width, 
            height 
          });
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [height]);

  // Draw chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data[0].length === 0) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    // Set canvas size with device pixel ratio for sharpness
    canvas.width = dimensions.width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = dimensions.width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = 'transparent';
    ctx.fillRect(0, 0, dimensions.width, height);

    const [times, values] = data;
    const [xMin, xMax] = xDomain;
    const yMin = 0;
    const yMax = 4095;

    // Scale functions
    const scaleX = (t) => margin.left + ((t - xMin) / (xMax - xMin)) * chartWidth;
    const scaleY = (v) => margin.top + chartHeight - ((v - yMin) / (yMax - yMin)) * chartHeight;

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    // Vertical grid lines (time)
    const xStep = Math.ceil((xMax - xMin) / 10);
    for (let t = Math.ceil(xMin); t <= xMax; t += xStep) {
      const x = scaleX(t);
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + chartHeight);
      ctx.stroke();
    }

    // Horizontal grid lines (value)
    for (let v = 0; v <= 4095; v += 1000) {
      const y = scaleY(v);
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + chartWidth, y);
      ctx.stroke();
    }

    // Draw highlight area
    if (highlightArea) {
      ctx.fillStyle = highlightColor || 'rgba(180, 60, 60, 0.15)';
      const x1 = scaleX(highlightArea.left);
      const x2 = scaleX(highlightArea.right);
      ctx.fillRect(x1, margin.top, x2 - x1, chartHeight);
    }

    // Draw selection area while dragging
    if (isDragging && dragStart !== null && dragEnd !== null) {
      ctx.fillStyle = 'rgba(180, 60, 60, 0.2)';
      const x1 = scaleX(Math.min(dragStart, dragEnd));
      const x2 = scaleX(Math.max(dragStart, dragEnd));
      ctx.fillRect(x1, margin.top, x2 - x1, chartHeight);
    }

    // Draw ECG line - optimized for large datasets
    ctx.strokeStyle = '#b43c3c';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();

    // Find data range to draw
    let startIdx = 0;
    let endIdx = times.length - 1;
    
    // Binary search for start
    let lo = 0, hi = times.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid] < xMin) lo = mid + 1;
      else hi = mid;
    }
    startIdx = Math.max(0, lo - 1);
    
    // Binary search for end
    lo = 0; hi = times.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (times[mid] > xMax) hi = mid - 1;
      else lo = mid;
    }
    endIdx = Math.min(times.length - 1, hi + 1);

    // Downsample if too many points
    const visiblePoints = endIdx - startIdx;
    const maxPoints = chartWidth * 2; // 2 points per pixel max
    const step = visiblePoints > maxPoints ? Math.ceil(visiblePoints / maxPoints) : 1;

    let first = true;
    for (let i = startIdx; i <= endIdx; i += step) {
      const x = scaleX(times[i]);
      const y = scaleY(values[i]);
      
      if (first) {
        ctx.moveTo(x, y);
        first = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw axes labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';

    // X-axis labels
    const xTickStep = Math.max(1, Math.ceil((xMax - xMin) / 10));
    for (let t = Math.ceil(xMin / xTickStep) * xTickStep; t <= xMax; t += xTickStep) {
      const x = scaleX(t);
      ctx.fillText(t.toFixed(1) + 's', x, height - 10);
    }

    // Y-axis labels
    ctx.textAlign = 'right';
    for (let v = 0; v <= 4095; v += 1000) {
      const y = scaleY(v);
      ctx.fillText(String(v), margin.left - 8, y + 4);
    }

    // Y-axis label
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // Draw hover tooltip
    if (hoveredPoint) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.strokeStyle = 'rgba(180, 60, 60, 0.5)';
      const tooltipX = scaleX(hoveredPoint.t);
      const tooltipY = scaleY(hoveredPoint.v);
      
      // Draw crosshair
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(tooltipX, margin.top);
      ctx.lineTo(tooltipX, margin.top + chartHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw tooltip box
      const text = `t=${hoveredPoint.t.toFixed(3)}s  v=${Math.round(hoveredPoint.v)}`;
      const textWidth = ctx.measureText(text).width;
      const boxX = Math.min(tooltipX + 10, dimensions.width - textWidth - 30);
      const boxY = Math.max(tooltipY - 30, margin.top + 5);
      
      ctx.fillStyle = 'rgba(26, 26, 26, 0.95)';
      ctx.fillRect(boxX, boxY, textWidth + 16, 24);
      ctx.strokeStyle = 'rgba(180, 60, 60, 0.5)';
      ctx.strokeRect(boxX, boxY, textWidth + 16, 24);
      
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(text, boxX + 8, boxY + 16);
    }

  }, [data, xDomain, dimensions, height, highlightArea, highlightColor, isDragging, dragStart, dragEnd, hoveredPoint, chartWidth, chartHeight, yLabel]);

  // Mouse handlers
  const getTimeFromX = useCallback((clientX) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left - margin.left;
    const [xMin, xMax] = xDomain;
    return xMin + (x / chartWidth) * (xMax - xMin);
  }, [xDomain, chartWidth]);

  const getValueFromY = useCallback((clientY) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const y = clientY - rect.top - margin.top;
    return 4095 - (y / chartHeight) * 4095;
  }, [chartHeight]);

  const findNearestPoint = useCallback((t) => {
    if (!data || !data[0].length) return null;
    const [times, values] = data;
    
    // Binary search
    let lo = 0, hi = times.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid] < t) lo = mid + 1;
      else hi = mid;
    }
    
    const idx = clamp(lo, 0, times.length - 1);
    return { t: times[idx], v: values[idx] };
  }, [data]);

  const handleMouseDown = (e) => {
    const t = getTimeFromX(e.clientX);
    if (t !== null && t >= xDomain[0] && t <= xDomain[1]) {
      setIsDragging(true);
      setDragStart(t);
      setDragEnd(t);
    }
  };

  const handleMouseMove = (e) => {
    const t = getTimeFromX(e.clientX);
    
    if (isDragging && t !== null) {
      setDragEnd(clamp(t, xDomain[0], xDomain[1]));
    }
    
    // Update hover
    if (t !== null && t >= xDomain[0] && t <= xDomain[1]) {
      setHoveredPoint(findNearestPoint(t));
    } else {
      setHoveredPoint(null);
    }
  };

  const handleMouseUp = () => {
    if (isDragging && dragStart !== null && dragEnd !== null) {
      const left = Math.min(dragStart, dragEnd);
      const right = Math.max(dragStart, dragEnd);
      if (right - left > 0.1 && onSelect) {
        onSelect({ left, right });
      }
    }
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
    if (isDragging) {
      handleMouseUp();
    }
  };

  return (
    <div 
      ref={containerRef} 
      style={{ width: "100%", height, position: 'relative' }}
      data-testid="canvas-ecg-chart"
    >
      <canvas
        ref={canvasRef}
        style={{ 
          width: '100%', 
          height: '100%',
          cursor: isDragging ? 'col-resize' : 'crosshair',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    </div>
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
  // Convert data to typed arrays format [times[], values[]]
  const chartData = useMemo(() => {
    if (data) {
      const times = new Float64Array(data.length);
      const values = new Float64Array(data.length);
      for (let i = 0; i < data.length; i++) {
        times[i] = data[i].t;
        values[i] = data[i].v;
      }
      return [times, values];
    }
    return makeDemoECG();
  }, [data]);

  const baseDomain = useMemo(() => {
    if (chartData[0].length < 2) return [0, 25];
    return [chartData[0][0], chartData[0][chartData[0].length - 1]];
  }, [chartData]);

  const DEFAULT_OVERVIEW_SEC = 25;

  const [overviewDomain, setOverviewDomain] = useState(() => [0, DEFAULT_OVERVIEW_SEC]);
  const [zoomViewDomain, setZoomViewDomain] = useState(null);
  const [selectionArea, setSelectionArea] = useState(null);
  const [activityHighlight, setActivityHighlight] = useState(null);

  const overviewPanelRef = useRef(null);
  const zoomPanelRef = useRef(null);

  // Reset on data change
  useEffect(() => {
    const dom = clampDomain([baseDomain[0], baseDomain[0] + DEFAULT_OVERVIEW_SEC], baseDomain);
    setOverviewDomain(dom);
    setZoomViewDomain(null);
    setSelectionArea(null);
    setActivityHighlight(null);
  }, [baseDomain[0], baseDomain[1]]);

  const resetAll = () => {
    const dom = clampDomain([baseDomain[0], baseDomain[0] + DEFAULT_OVERVIEW_SEC], baseDomain);
    setOverviewDomain(dom);
    setZoomViewDomain(null);
    setSelectionArea(null);
    setActivityHighlight(null);
  };

  // Jump-to functionality
  useEffect(() => {
    if (jumpTo == null || chartData[0].length < 2) return;

    const jt = clamp(jumpTo, baseDomain[0], baseDomain[1]);

    setOverviewDomain((prev) => {
      const span = prev[1] - prev[0];
      const left = jt - span * 0.2;
      return clampDomain([left, left + span], baseDomain);
    });

    const hlLeft = clamp(jt, baseDomain[0], baseDomain[1]);
    const hlRight = clamp(jt + Math.max(0.1, highlightWindowSec), baseDomain[0], baseDomain[1]);
    setActivityHighlight({ left: hlLeft, right: hlRight });

    const span = Math.max(1, highlightWindowSec);
    const left = jt - span * 0.2;
    setZoomViewDomain(clampDomain([left, left + span], baseDomain));
  }, [jumpTo, highlightWindowSec, baseDomain, chartData]);

  // Wheel pan for overview
  const onOverviewWheel = useCallback((e) => {
    const delta = -e.deltaY;
    if (delta === 0) return;
    e.preventDefault();

    const el = overviewPanelRef.current;
    const w = el?.clientWidth ?? 800;
    const span = overviewDomain[1] - overviewDomain[0];
    const secPerPx = span / Math.max(1, w);

    setOverviewDomain((prev) => {
      const newSpan = prev[1] - prev[0];
      return clampDomain([prev[0] + delta * secPerPx, prev[0] + delta * secPerPx + newSpan], baseDomain);
    });
  }, [overviewDomain, baseDomain]);

  // Wheel pan for zoom
  const onZoomWheel = useCallback((e) => {
    if (!zoomViewDomain) return;
    const delta = -e.deltaY;
    if (delta === 0) return;
    e.preventDefault();

    const el = zoomPanelRef.current;
    const w = el?.clientWidth ?? 800;
    const span = zoomViewDomain[1] - zoomViewDomain[0];
    const secPerPx = span / Math.max(1, w);

    setZoomViewDomain((prev) => {
      if (!prev) return prev;
      const newSpan = prev[1] - prev[0];
      return clampDomain([prev[0] + delta * secPerPx, prev[0] + delta * secPerPx + newSpan], baseDomain);
    });
  }, [zoomViewDomain, baseDomain]);

  // Handle selection on overview chart
  const handleOverviewSelect = useCallback((selection) => {
    if (selection.right - selection.left < 0.02) return;
    
    const dom = clampDomain([selection.left, selection.right], baseDomain);
    setZoomViewDomain(dom);
    setSelectionArea(selection);
    setActivityHighlight(null);
  }, [baseDomain]);

  // Zoom window presets
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
          <h3 className="text-md font-medium" style={{ color: "#1a1a1a" }}>
            {title}
          </h3>
          <p className="text-sm" style={{ color: "#9ca3af" }}>
            {subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={resetAll}
          className="frosted-glass glow-hover rounded-xl px-4 py-2 text-sm transition-all duration-300"
          style={{ color: "#b43c3c" }}
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
        style={{ width: "100%", position: "relative", userSelect: "none" }}
        data-testid="overview-chart"
      >
        <CanvasECGChart
          data={chartData}
          xDomain={overviewDomain}
          yLabel={yLabel}
          height={380}
          highlightArea={selectionArea ?? activityHighlight}
          highlightColor={activityHighlight ? highlightColor : undefined}
          onSelect={handleOverviewSelect}
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
          style={{ width: "100%", position: "relative" }}
          data-testid="zoom-view"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium" style={{ color: "#1a1a1a" }}>
                Zoom View
              </div>
              <div className="text-xs" style={{ color: "#9ca3af" }}>
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
                    color: "#9ca3af",
                  }}
                  data-testid={`zoom-${sec}s-button`}
                >
                  {sec}s
                </button>
              ))}

              <button
                type="button"
                onClick={() => setZoomViewDomain(null)}
                className="frosted-glass glow-hover rounded-xl px-3 py-1.5 text-sm transition-all duration-300"
                style={{ color: "#b43c3c" }}
                data-testid="close-zoom-button"
              >
                Close
              </button>
            </div>
          </div>

          <div
            ref={zoomPanelRef}
            onWheel={onZoomWheel}
            style={{ width: "100%", userSelect: "none" }}
            data-testid="zoom-chart"
          >
            <CanvasECGChart
              data={chartData}
              xDomain={zoomViewDomain}
              yLabel={yLabel}
              height={220}
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
