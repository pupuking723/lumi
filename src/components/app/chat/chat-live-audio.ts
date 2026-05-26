import { base64ToBytes } from "@/lib/live/ws-client";

export function getAudioContextCtor() {
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  );
}

export function stopMediaStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => {
    track.enabled = false;
    track.stop();
  });
}

export function safeDisconnect(node: AudioNode) {
  try {
    node.disconnect();
  } catch {
    // Already disconnected.
  }
}

export function downsampleToPCM16(
  input: Float32Array,
  inputSampleRate: number,
  targetSampleRate: number,
): Uint8Array {
  if (!input.length || inputSampleRate <= 0 || targetSampleRate <= 0) {
    return new Uint8Array();
  }
  const ratio = Math.max(inputSampleRate / targetSampleRate, 1);
  const outputLength = Math.floor(input.length / ratio);
  const bytes = new Uint8Array(outputLength * 2);
  const view = new DataView(bytes.buffer);

  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(Math.floor((index + 1) * ratio), input.length);
    let total = 0;
    const count = Math.max(end - start, 1);

    for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) {
      total += input[sourceIndex] || 0;
    }

    const sample = Math.max(-1, Math.min(1, total / count));
    view.setInt16(
      index * 2,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true,
    );
  }

  return bytes;
}

export function audioFrameMetrics(input: Float32Array): {
  rms: number;
  peak: number;
} {
  if (!input.length) return { rms: 0, peak: 0 };
  let sum = 0;
  let peak = 0;

  for (let index = 0; index < input.length; index += 1) {
    const value = Math.abs(input[index] || 0);
    sum += value * value;
    if (value > peak) peak = value;
  }

  return { rms: Math.sqrt(sum / input.length), peak };
}

export function base64PCMToFloat32(
  value: string,
  mimeType: string,
): Float32Array {
  const bytes = base64ToBytes(value);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const samples = new Float32Array(sampleCount);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const littleEndian = !/audio\/l16/i.test(mimeType);

  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = Math.max(
      -1,
      Math.min(1, view.getInt16(index * 2, littleEndian) / 32768),
    );
  }

  return samples;
}

export function appendLiveTranscript(current: string, next: string): string {
  const text = next.trim();
  if (!text) return current;
  if (!current) return text;
  if (/^[，。！？,.!?;；:：]/.test(text)) return `${current}${text}`;
  return `${current}${/[\s\n]$/.test(current) ? "" : " "}${text}`;
}

export function mergeLiveTranscript(current: string, next: string): string {
  const currentText = current.trim();
  const nextText = next.trim();
  if (!currentText) return nextText;
  if (!nextText) return currentText;
  if (nextText.startsWith(currentText)) return nextText;
  if (currentText.startsWith(nextText)) return currentText;
  return appendLiveTranscript(currentText, nextText);
}

export function textsOverlap(current: string, next: string): boolean {
  const currentText = current.trim();
  const nextText = next.trim();
  return (
    Boolean(currentText && nextText) &&
    (currentText === nextText ||
      currentText.includes(nextText) ||
      nextText.includes(currentText))
  );
}
