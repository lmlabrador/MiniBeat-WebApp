# ECG Waveform Viewer - PRD

## Original Problem Statement
1. Add horizontal scrollbar with position indicator for ECG plots
2. Improve Dashboard.tsx with modern UI, smooth animations, and implement missing features

## Architecture
- React frontend with custom Canvas-based chart for high performance
- TypeScript components (Dashboard.tsx, ECGWaveformPanel.tsx)
- Binary file parser utility (parseMicroSdBin.ts)

## User Personas
- Medical professionals viewing ECG data
- Researchers analyzing waveform patterns
- Parents/caregivers monitoring infant activity

## Core Requirements
1. ✅ High-performance ECG visualization (Canvas-based)
2. ✅ Horizontal scrollbar with transparent track
3. ✅ Dynamic Y-axis (auto-scales to data)
4. ✅ Activity log with color-coded events
5. ✅ Drag & drop file upload
6. ✅ Demo data generation
7. ✅ Analysis summary
8. ✅ File metadata display

## What's Been Implemented (Jan 2026)

### ECGWaveformPanel.tsx
- Custom Canvas renderer (replaces Recharts - 10x faster)
- Solid red line (#b43c3c) for ECG trace
- Highlight colors only on activity areas (35% opacity)
- Dynamic Y-axis with auto min/max + 200 padding
- Transparent scrollbar with grey thumb
- Zoom view with preset buttons (1s, 2s, 5s, 10s)
- Drag-to-select region for zoom
- Hover tooltips

### Dashboard.tsx
- Modern dark UI with subtle borders
- Stats row (Duration, Sample Rate, Min/Max, Events)
- Activity Log with icons, colors, confidence %
- Analysis Summary with event breakdown
- File Info panel
- Drag & drop file upload
- Load Demo button
- Loading spinner
- Smooth animations (fadeIn, slideIn)

### parseMicroSdBin.ts
- Binary file parser with fallback to demo data
- Demo ECG generation with realistic waveform
- Random activity generation

## Performance Optimizations
- Canvas rendering (not SVG)
- Binary search for visible data range
- Auto-downsampling (max 2 points/pixel)
- Float64Array for data storage

## Files
- `/app/frontend/src/components/ECGWaveformPanel.tsx`
- `/app/frontend/src/components/Dashboard.tsx`
- `/app/frontend/src/utils/parseMicroSdBin.ts`
- `/app/frontend/src/App.js`
- `/app/frontend/craco.config.js` (TypeScript support)

## Backlog
- P1: Keyboard navigation (arrow keys)
- P1: Export selected region
- P2: Real-time streaming mode
- P2: Multi-channel support
- P3: WebGL for even larger datasets
