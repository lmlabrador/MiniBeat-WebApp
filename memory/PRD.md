# ECG Waveform Viewer - PRD

## Original Problem Statement
Add a smooth and simple horizontal scroll wheel to scroll through ECG plots with:
- Visible scrollbar below both plots
- Position indicator showing current time range

## Architecture
- React frontend with **custom Canvas-based chart** for high performance
- TimelineScrollbar component for horizontal navigation
- Overview chart (25s default window) + Zoom view (on selection)

## User Personas
- Medical professionals viewing ECG data
- Researchers analyzing waveform patterns
- Data analysts working with time-series data

## Core Requirements
1. ✅ Visible horizontal scrollbar below charts
2. ✅ Position indicator showing current view range
3. ✅ Draggable thumb for navigation
4. ✅ Click-to-navigate on track
5. ✅ Mouse wheel support for panning
6. ✅ High-performance rendering (replaced Recharts with custom Canvas)

## What's Been Implemented (Jan 2026)
- **CanvasECGChart Component**: Custom high-performance canvas renderer
  - Binary search for visible data range
  - Automatic downsampling for zoomed-out views
  - Device pixel ratio support for sharp rendering
  - Hover tooltips with cursor tracking
  - Selection/drag to zoom functionality
- **TimelineScrollbar Component**: Reusable scrollbar with position indicator
- **Draggable thumb**: Smooth drag interaction with grip lines visual
- **Position labels**: Shows start time, current range, and end time
- **Overview scrollbar**: Navigate through full ~3 minute ECG dataset  
- **Zoom view scrollbar**: Navigate within zoomed selection
- **Visual styling**: Frosted glass effect, ECG paper background, cornell-red (#b43c3c)

## Performance Optimizations
- Canvas rendering instead of SVG (Recharts) - ~10x faster
- Binary search for data range finding - O(log n)
- Automatic downsampling: max 2 points per pixel
- Float64Array for data storage - memory efficient
- RequestAnimationFrame-friendly rendering

## Files Modified/Created
- `/app/frontend/src/components/ECGWaveformPanel.jsx` - Main ECG component with Canvas chart
- `/app/frontend/src/App.js` - Updated to display ECG viewer
- `/app/frontend/src/App.css` - Added CSS variables and styling

## Backlog / Future Enhancements
- P1: Keyboard shortcuts for navigation (arrow keys)
- P1: Zoom with mouse wheel (ctrl + scroll)
- P2: Minimap waveform preview in scrollbar track
- P2: Playback animation mode
- P3: Export selected region as image/data
- P3: WebGL rendering for even larger datasets
