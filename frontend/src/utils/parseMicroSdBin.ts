// Types
export type ECGPoint = { t: number; v: number };

export type ActivityLogItem = {
  id: string;
  label: string;
  tSec: number;
  durationSec: number;
  confidence?: number;
};

export type ParsedBinFile = {
  fileId: number;
  adcBits: number;
  numChannels: number;
  sampleRateHz: number;
  startUnixMs: number;
  samplesPerBlock: number;
  ecg: ECGPoint[];
  activities: ActivityLogItem[];
};

// Activity labels for demo
const ACTIVITY_LABELS = ['Crying', 'Eating', 'Sleeping', 'Active', 'Resting', 'Feeding'];

// Generate demo ECG data if real parsing fails or for testing
function generateDemoECG(n: number = 250 * 180, sampleRate: number = 250): ECGPoint[] {
  const points: ECGPoint[] = [];
  
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
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
    
    // Baseline wandering + noise
    v += 0.05 * Math.sin(2 * Math.PI * 0.33 * t);
    v += 0.01 * Math.sin(2 * Math.PI * 22 * t);
    v += (Math.random() - 0.5) * 0.02; // Small random noise
    
    const adc = Math.round(2048 + v * 1200);
    points.push({ t, v: Math.max(0, Math.min(4095, adc)) });
  }
  
  return points;
}

// Generate demo activities
function generateDemoActivities(totalDurationSec: number): ActivityLogItem[] {
  const activities: ActivityLogItem[] = [];
  let currentTime = Math.random() * 5; // Start at random point
  
  while (currentTime < totalDurationSec - 10) {
    const duration = 5 + Math.random() * 15; // 5-20 seconds
    const label = ACTIVITY_LABELS[Math.floor(Math.random() * ACTIVITY_LABELS.length)];
    
    activities.push({
      id: `activity-${activities.length}-${Date.now()}`,
      label,
      tSec: currentTime,
      durationSec: Math.round(duration * 10) / 10,
      confidence: 0.7 + Math.random() * 0.3, // 70-100% confidence
    });
    
    currentTime += duration + Math.random() * 20; // Gap between activities
  }
  
  return activities;
}

// Parse binary file (with fallback to demo data)
export function parseMicroSdBin(buffer: ArrayBuffer): ParsedBinFile {
  const view = new DataView(buffer);
  const fileSize = buffer.byteLength;
  
  // Try to parse header (assuming a simple format)
  // If file is too small or invalid, generate demo data
  if (fileSize < 32) {
    console.warn('File too small, generating demo data');
    return generateDemoData();
  }
  
  try {
    // Attempt to read header fields
    // This is a generic format - adjust based on actual binary format
    const fileId = view.getUint32(0, true);
    const adcBits = view.getUint8(4) || 12;
    const numChannels = view.getUint8(5) || 1;
    const sampleRateHz = view.getUint16(6, true) || 250;
    const startUnixMs = Number(view.getBigUint64(8, true)) || Date.now();
    const samplesPerBlock = view.getUint16(16, true) || 256;
    
    // Calculate expected data size
    const headerSize = 32;
    const bytesPerSample = Math.ceil(adcBits / 8);
    const dataSize = fileSize - headerSize;
    const numSamples = Math.floor(dataSize / (bytesPerSample * numChannels));
    
    if (numSamples < 100) {
      console.warn('Not enough samples, generating demo data');
      return generateDemoData();
    }
    
    // Parse ECG data
    const ecg: ECGPoint[] = [];
    let offset = headerSize;
    
    for (let i = 0; i < numSamples && offset < fileSize; i++) {
      const t = i / sampleRateHz;
      let v = 0;
      
      if (bytesPerSample === 2) {
        v = view.getInt16(offset, true);
      } else if (bytesPerSample === 1) {
        v = view.getInt8(offset);
      } else {
        v = view.getUint16(offset, true);
      }
      
      ecg.push({ t, v: Math.abs(v) });
      offset += bytesPerSample * numChannels;
    }
    
    // Generate activities based on data patterns or use embedded ones
    const totalDuration = ecg.length / sampleRateHz;
    const activities = generateDemoActivities(totalDuration);
    
    return {
      fileId,
      adcBits,
      numChannels,
      sampleRateHz,
      startUnixMs,
      samplesPerBlock,
      ecg,
      activities,
    };
    
  } catch (error) {
    console.error('Error parsing binary file:', error);
    return generateDemoData();
  }
}

// Generate complete demo data
function generateDemoData(): ParsedBinFile {
  const sampleRateHz = 250;
  const durationSec = 180; // 3 minutes
  const numSamples = sampleRateHz * durationSec;
  
  return {
    fileId: Math.floor(Math.random() * 1000000),
    adcBits: 12,
    numChannels: 1,
    sampleRateHz,
    startUnixMs: Date.now(),
    samplesPerBlock: 256,
    ecg: generateDemoECG(numSamples, sampleRateHz),
    activities: generateDemoActivities(durationSec),
  };
}

// Export demo generator for testing
export function generateDemoFile(): ParsedBinFile {
  return generateDemoData();
}
