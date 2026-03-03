export type ECGPoint = { t: number; v: number };

export type ActivityLogItem = {
  id: string;
  type?: number;
  label: string;
  tSec: number;
  unixMs?: number;
  durationSec: number;
  sampleIndex?: number;
  blockNumber?: number;
  posInBlock?: number;
  confidence?: number;
};

export type ParsedMicroSdBin = {
  fileId: number;
  adcBits: number;
  numChannels: number;
  sampleRateHz: number;
  startUnixMs: number;
  samplesPerBlock: number;
  ecg: ECGPoint[];
  activities: ActivityLogItem[];
};

const FILE_HEADER_SIZE = 512;
const BLOCK_SIZE = 512;
const BLOCK_HEADER_SIZE = 19;
const PAYLOAD_SIZE = 489;
const CRC_OFFSET = 508;

function u64ToNumber(view: DataView, offset: number, littleEndian = true): number {
  const lo = view.getUint32(offset + (littleEndian ? 0 : 4), littleEndian);
  const hi = view.getUint32(offset + (littleEndian ? 4 : 0), littleEndian);
  return hi * 2 ** 32 + lo;
}

function activityCodeToActivityType(code: number): string {
  switch (code) {
    case 0x81:
    case 0x41:
      return "Crying";
    case 0x82:
    case 0x42:
      return "Eating";
    case 0x84:
    case 0x44:
      return "Sleep";
    case 0x55:
      return "End Session";
    default:
      return `Activity (0x${code.toString(16).padStart(2, "0")})`;
  }
}

function isStartCode(code: number): boolean {
  return (code & 0x80) === 0x80 && code !== 0x55;
}

function unpack12BitSamples(buffer: Uint8Array): number[] {
  const samples: number[] = [];
  let bitIndex = 0;

  for (let i = 0; i < 326; i++) {
    let value = 0;
    for (let b = 0; b < 12; b++) {
      const byteOffset = Math.floor((bitIndex + b) / 8);
      const bitOffset = (bitIndex + b) % 8;
      const bit = (buffer[byteOffset] >> bitOffset) & 1;
      value |= bit << b;
    }
    samples.push(value);
    bitIndex += 12;
  }

  return samples;
}

export function parseMicroSdBin(arrayBuffer: ArrayBuffer): ParsedMicroSdBin {
  if (arrayBuffer.byteLength < FILE_HEADER_SIZE) {
    throw new Error("File too small to contain header.");
  }

  const view = new DataView(arrayBuffer);

  const fileId = view.getUint32(0, true);
  const adcBits = view.getUint16(4, true);
  const numChannels = view.getUint8(6);
  const sampleRateHz = view.getUint16(7, true);
  const startUnixMs = u64ToNumber(view, 9, true);
  const samplesPerBlock = view.getUint16(17, true);

  if (samplesPerBlock !== 326) {
    throw new Error(`Unexpected samplesPerBlock=${samplesPerBlock}. Expected 326.`);
  }
  if (sampleRateHz <= 0) {
    throw new Error("Invalid sampleRateHz in header.");
  }
  if (adcBits <= 0 || adcBits > 16) {
    throw new Error("Invalid adcBits in header.");
  }

  const totalBlocks = Math.floor((arrayBuffer.byteLength - FILE_HEADER_SIZE) / BLOCK_SIZE);
  if (totalBlocks <= 0) {
    return { fileId, adcBits, numChannels, sampleRateHz, startUnixMs, samplesPerBlock, ecg: [], activities: [] };
  }

  const ecg: ECGPoint[] = [];
  const activityRawEvents: Array<{
    code: number;
    tSec: number;
    sampleIndex: number;
    blockNumber: number;
    blockTimestampMs: number;
  }> = [];

  for (let b = 0; b < totalBlocks; b++) {
    const blockBase = FILE_HEADER_SIZE + b * BLOCK_SIZE;
    const blockNumber = view.getUint32(blockBase + 0, true);
    const firstSampleIndex = view.getUint32(blockBase + 4, true);
    const blockTimestampMs = u64ToNumber(view, blockBase + 8, true);
    const activityCode = view.getUint8(blockBase + 17);

    const payloadBase = blockBase + BLOCK_HEADER_SIZE;
    const payloadBytes = new Uint8Array(arrayBuffer, payloadBase, PAYLOAD_SIZE);
    const samples12bit = unpack12BitSamples(payloadBytes);

    for (let i = 0; i < samples12bit.length; i++) {
      const v = samples12bit[i];
      const sampleIndex = firstSampleIndex + i;
      const t = sampleIndex / sampleRateHz;
      ecg.push({ t, v });
    }

    if (activityCode !== 0) {
      const sampleIndex = firstSampleIndex;
      const tSec = sampleIndex / sampleRateHz;
      activityRawEvents.push({ code: activityCode, tSec, sampleIndex, blockNumber, blockTimestampMs });
    }

    void CRC_OFFSET;
  }

  const activities: ActivityLogItem[] = [];
  const pendingStarts = new Map<string, (typeof activityRawEvents)[0]>();

  for (const event of activityRawEvents) {
    const actType = activityCodeToActivityType(event.code);
    const isStart = isStartCode(event.code);

    if (isStart) {
      pendingStarts.set(actType, event);
    } else {
      const startEvent = pendingStarts.get(actType);
      if (startEvent) {
        const durationSec = event.tSec - startEvent.tSec;
        activities.push({
          id: `${actType}_${startEvent.blockNumber}_${startEvent.sampleIndex}`,
          type: startEvent.code,
          label: actType,
          tSec: startEvent.tSec,
          unixMs: startEvent.blockTimestampMs,
          durationSec: Math.max(durationSec, 0),
          sampleIndex: startEvent.sampleIndex,
          blockNumber: startEvent.blockNumber,
          posInBlock: 0,
        });
        pendingStarts.delete(actType);
      }
    }
  }

  for (const [actType, startEvent] of pendingStarts) {
    activities.push({
      id: `${actType}_orphan_${startEvent.blockNumber}_${startEvent.sampleIndex}`,
      type: startEvent.code,
      label: `${actType} (Start only)`,
      tSec: startEvent.tSec,
      unixMs: startEvent.blockTimestampMs,
      durationSec: 0,
      sampleIndex: startEvent.sampleIndex,
      blockNumber: startEvent.blockNumber,
      posInBlock: 0,
    });
  }

  activities.sort((a, b) => a.tSec - b.tSec);

  return { fileId, adcBits, numChannels, sampleRateHz, startUnixMs, samplesPerBlock, ecg, activities };
}
