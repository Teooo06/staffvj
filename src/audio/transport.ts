import type { AudioSettings, TransportData } from '../types';
import { clamp } from '../lib/utils';

interface AudioGraph {
  context: AudioContext;
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
  frequencyData: Uint8Array<ArrayBuffer>;
}

const GRAPH_SAMPLES = 64;

export class TransportClock {
  private bpm = 124;
  private anchorBeat = 0;
  private anchorTime = 0;
  private level = 0;
  private sensitivity = 1;
  private autoBpm = true;
  private detectorMode: AudioSettings['detectorMode'] = 'bass';
  private beatThreshold = 0.85;
  private tempoResponse = 0.42;
  private minBpm = 60;
  private maxBpm = 200;
  private manualBpmUntil = 0;
  private audio: AudioGraph | null = null;
  private audioDeviceId: string | null = null;
  private lastOnsetAt = 0;
  private onsetFlashAt = 0;
  private onsetIntervals: number[] = [];
  private previousSpectrum = new Uint8Array(1024);
  private previousFlux = 0;
  private fluxBaseline = 0.006;
  private estimatedBpm = 0;
  private beatConfidence = 0;
  private onsetGraph = new Array<number>(GRAPH_SAMPLES).fill(0);
  private onsetMarkers = new Array<number>(GRAPH_SAMPLES).fill(0);
  private lastGraphSampleAt = 0;
  private lastTapAt = 0;

  constructor(bpm = 124) {
    this.bpm = clamp(bpm, 60, 200);
    this.anchorTime = performance.now();
  }

  setBpm(value: number): void {
    const next = clamp(value, 60, 200);
    if (Math.abs(next - this.bpm) < 0.01) return;
    const now = performance.now();
    this.anchorBeat = this.beatPosition(now);
    this.anchorTime = now;
    this.bpm = next;
  }

  setManualBpm(value: number): void {
    this.manualBpmUntil = performance.now() + 3000;
    this.setBpm(value);
  }

  getBpm(): number {
    return this.bpm;
  }

  setAudioSettings(settings: AudioSettings): void {
    this.sensitivity = clamp(settings.sensitivity, 0.2, 3);
    this.autoBpm = settings.autoBpm;
    this.detectorMode = settings.detectorMode;
    this.beatThreshold = clamp(settings.beatThreshold, 0.4, 5);
    this.tempoResponse = clamp(settings.tempoResponse, 0.1, 0.8);
    this.minBpm = clamp(settings.minBpm, 60, 199);
    this.maxBpm = clamp(settings.maxBpm, this.minBpm + 1, 200);
  }

  isAudioConnected(): boolean {
    return Boolean(this.audio);
  }

  tap(): number {
    const now = performance.now();
    this.manualBpmUntil = now + 3000;
    const since = now - this.lastTapAt;
    if (this.lastTapAt > 0 && since > 250 && since < 1800) {
      const estimate = 60000 / since;
      this.bpm = clamp(this.bpm * 0.3 + estimate * 0.7, 60, 200);
      this.anchorBeat = 0;
      this.anchorTime = now;
    }
    this.lastTapAt = now;
    return Math.round(this.bpm * 10) / 10;
  }

  async connectAudio(deviceId: string | null): Promise<void> {
    if (this.audio && this.audioDeviceId === deviceId) {
      if (this.audio.context.state !== 'running') await this.audio.context.resume();
      return;
    }
    this.disconnectAudio();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      // Keep the analysis window short enough for live response while retaining
      // useful low-frequency resolution for kick drums and line-level inputs.
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);
      this.audio = {
        context,
        stream,
        source,
        analyser,
        data: new Uint8Array(analyser.fftSize),
        frequencyData: new Uint8Array(analyser.frequencyBinCount),
      };
      this.previousSpectrum = new Uint8Array(analyser.frequencyBinCount);
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      if (context) void context.close().catch(() => { /* noop */ });
      throw error;
    }
    this.resetDetector();
    this.audioDeviceId = deviceId;
  }

  disconnectAudio(): void {
    const audio = this.audio;
    this.audio = null;
    this.audioDeviceId = null;
    this.level = 0;
    this.resetDetector();
    if (!audio) return;
    audio.stream.getTracks().forEach((track) => track.stop());
    audio.source.disconnect();
    void audio.context.close().catch(() => {
      /* noop */
    });
  }

  tick(now = performance.now()): TransportData {
    let pulse = 0;
    let beatDetected = false;
    let onsetDetected = false;

    if (this.audio) {
      const { analyser, data, frequencyData } = this.audio;
      analyser.getByteTimeDomainData(data);
      analyser.getByteFrequencyData(frequencyData);
      let sum = 0;
      for (let index = 0; index < data.length; index += 1) {
        const sample = (data[index] - 128) / 128;
        sum += sample * sample;
      }
      const rms = Math.sqrt(sum / data.length);
      const target = clamp(rms * 5.2 * this.sensitivity, 0, 1);
      this.level += (target - this.level) * (target > this.level ? 0.55 : 0.09);

      const sampleRate = analyser.context.sampleRate;
      const binWidthHz = sampleRate / analyser.fftSize;
      const firstBassBin = Math.max(1, Math.floor(45 / binWidthHz));
      const lastBassBin = Math.min(Math.ceil(250 / binWidthHz), frequencyData.length - 1);
      const lastMixBin = Math.min(Math.ceil(6000 / binWidthHz), frequencyData.length - 1);
      let bassFlux = 0;
      let mixFlux = 0;
      let bassBins = 0;
      let mixBins = 0;

      for (let index = firstBassBin; index <= lastMixBin; index += 1) {
        const current = frequencyData[index];
        const increase = Math.max(0, current - this.previousSpectrum[index]) / 255;
        if (index <= lastBassBin) {
          bassFlux += increase;
          bassBins += 1;
        }
        mixFlux += increase;
        mixBins += 1;
        this.previousSpectrum[index] = current;
      }

      bassFlux /= Math.max(1, bassBins);
      mixFlux /= Math.max(1, mixBins);
      const highBins = Math.max(1, mixBins - bassBins);
      const highFlux = Math.max(0, (mixFlux * mixBins - bassFlux * bassBins) / highBins);
      const novelty = this.detectorMode === 'bass'
        ? bassFlux
        : this.detectorMode === 'hybrid'
          ? bassFlux * 1.45 + highFlux * 0.85
          : Math.max(bassFlux, mixFlux * 2.1);
      const threshold = Math.max(0.006, this.fluxBaseline * 1.55) * this.beatThreshold;
      const risingTransient = novelty > threshold && novelty > this.previousFlux * 1.04;

      // Follow the room's noise floor slowly; loud hits should not immediately
      // raise the threshold and hide the next beat.
      this.fluxBaseline +=
        (novelty - this.fluxBaseline) * (novelty < this.fluxBaseline ? 0.1 : 0.003);
      this.previousFlux = novelty;

      if (risingTransient && now - this.lastOnsetAt > 220) {
        const interval = now - this.lastOnsetAt;
        if (this.lastOnsetAt > 0 && interval > 2200) {
          this.onsetIntervals = [];
          this.estimatedBpm = 0;
          this.beatConfidence = 0;
        }
        this.lastOnsetAt = now;
        this.onsetFlashAt = now;
        onsetDetected = true;
        const minimumBeatInterval = Math.max(220, (60000 / this.maxBpm) * 0.85);
        if (interval >= minimumBeatInterval && interval < 1500) {
          this.onsetIntervals.push(interval);
          if (this.onsetIntervals.length > 16) this.onsetIntervals.shift();
          this.refineTempo(now);
        }
      }

      const sinceOnset = now - this.onsetFlashAt;
      beatDetected = sinceOnset < 220;
      if (beatDetected) pulse = Math.max(pulse, 1 - sinceOnset / 220);
      const graphScale = Math.max(threshold * 2, 0.018);
      this.updateOnsetGraph(now, clamp(novelty / graphScale, 0, 1), onsetDetected);
    } else {
      this.level += (0 - this.level) * 0.2;
    }

    const position = this.beatPosition(now);
    const beatIndex = Math.floor(position);
    const phase = position - beatIndex;
    pulse = Math.max(pulse, Math.max(0, 1 - phase / 0.3));
    const beatMs = 60000 / this.bpm;
    const wallNow = Date.now();
    const waveform = this.audio ? this.downsampleWaveform(this.audio.data, 64) : [];
    const spectrum = this.audio ? this.downsampleSpectrum(this.audio.frequencyData, 48) : [];
    const beatInBar = ((beatIndex % 4) + 4) % 4 + 1;

    return {
      bpm: Math.round(this.bpm * 10) / 10,
      level: clamp(this.level, 0, 1),
      beatPulse: clamp(pulse, 0, 1),
      beatPosition: position,
      beatIndex,
      beatInBar,
      barNumber: Math.floor(Math.max(0, beatIndex) / 4) + 1,
      lastBeatAt: wallNow - phase * beatMs,
      barPhase: (beatInBar - 1 + phase) / 4,
      playing: true,
      audioConnected: Boolean(this.audio),
      audioRunning: this.audio?.context.state === 'running',
      beatDetected,
      estimatedBpm: Math.round(this.estimatedBpm * 10) / 10,
      beatConfidence: this.beatConfidence,
      onsetGraph: [...this.onsetGraph],
      onsetMarkers: [...this.onsetMarkers],
      waveform,
      spectrum,
    };
  }

  dispose(): void {
    this.disconnectAudio();
  }

  private resetDetector(): void {
    this.lastOnsetAt = 0;
    this.onsetFlashAt = 0;
    this.onsetIntervals = [];
    this.manualBpmUntil = 0;
    this.previousFlux = 0;
    this.fluxBaseline = 0.006;
    this.estimatedBpm = 0;
    this.beatConfidence = 0;
    this.previousSpectrum.fill(0);
    this.onsetGraph.fill(0);
    this.onsetMarkers.fill(0);
    this.lastGraphSampleAt = 0;
  }

  private beatPosition(now: number): number {
    return this.anchorBeat + ((now - this.anchorTime) / 60000) * this.bpm;
  }

  private refineTempo(now: number): void {
    if (this.onsetIntervals.length < 3) return;

    const recent = this.onsetIntervals.slice(-4);
    if (recent.length >= 4 && this.estimatedBpm > 0) {
      const recentOrdered = recent
        .map((interval) => 60000 / interval)
        .sort((left, right) => left - right);
      const recentMedian = recentOrdered[Math.floor(recentOrdered.length / 2)];
      const recentSpread =
        (recentOrdered[recentOrdered.length - 1] - recentOrdered[0]) / Math.max(1, recentMedian);
      const changeRatio = Math.abs(recentMedian - this.estimatedBpm) / Math.max(1, this.estimatedBpm);
      if (recentSpread < 0.08 && changeRatio > 0.12) {
        this.onsetIntervals = recent;
        this.estimatedBpm = recentMedian;
        this.beatConfidence = Math.max(this.beatConfidence, 0.55);
        if (this.autoBpm && now >= this.manualBpmUntil) {
          this.setBpm(clamp(recentMedian, this.minBpm, this.maxBpm));
        }
      }
    }

    const reference = this.estimatedBpm || this.bpm;
    const candidates = this.onsetIntervals.slice(-8).map((interval) => {
      const raw = 60000 / interval;
      const choices = [raw / 2, raw, raw * 2]
        .filter((value) => value >= this.minBpm && value <= this.maxBpm);
      return choices
        .sort((left, right) => {
          // Prefer the observed interval when it falls in the configured range;
          // use the clock as a tie-breaker for half/double-time ambiguity.
          const leftRawPenalty = Math.abs(Math.log2(left / raw));
          const rightRawPenalty = Math.abs(Math.log2(right / raw));
          return leftRawPenalty - rightRawPenalty ||
            Math.abs(left - reference) - Math.abs(right - reference);
        })[0];
    }).filter((value): value is number => Number.isFinite(value));
    if (candidates.length < 3) return;

    const ordered = [...candidates].sort((left, right) => left - right);
    const median = ordered[Math.floor(ordered.length / 2)];
    const tolerance = Math.max(4, median * 0.085);
    const inliers = ordered.filter((value) => Math.abs(value - median) <= tolerance);
    if (inliers.length < 3 || inliers.length / candidates.length < 0.6) {
      this.beatConfidence = Math.max(0, this.beatConfidence * 0.8);
      return;
    }

    const estimate = inliers[Math.floor(inliers.length / 2)];
    const deviation = inliers.reduce((sum, value) => sum + Math.abs(value - estimate), 0) / inliers.length;
    this.beatConfidence = clamp(
      (inliers.length / candidates.length) * (1 - deviation / Math.max(1, tolerance)),
      0,
      1,
    );
    this.estimatedBpm = estimate;

    if (!this.autoBpm || now < this.manualBpmUntil) return;
    const delta = estimate - this.bpm;
    const relativeDelta = Math.abs(delta) / Math.max(1, this.bpm);
    if (relativeDelta > 0.12 && this.beatConfidence > 0.45) {
      this.setBpm(clamp(estimate, this.minBpm, this.maxBpm));
    } else if (Math.abs(delta) >= 0.15) {
      const maxCorrection = 4 + this.beatConfidence * 8;
      const correction = clamp(delta * this.tempoResponse, -maxCorrection, maxCorrection);
      this.setBpm(this.bpm + correction);
    }

    // Use confirmed transients to nudge phase without snapping to an isolated
    // onset that may be an offbeat or percussion fill.
    const position = this.beatPosition(now);
    const nearestBeat = Math.round(position);
    const phaseError = nearestBeat - position;
    if (Math.abs(phaseError) < 0.32) {
      this.anchorBeat = position + phaseError * 0.18;
      this.anchorTime = now;
    }
  }

  private updateOnsetGraph(now: number, strength: number, onset: boolean): void {
    if (now - this.lastGraphSampleAt >= 80) {
      this.lastGraphSampleAt = now;
      this.onsetGraph.shift();
      this.onsetGraph.push(strength);
      this.onsetMarkers.shift();
      this.onsetMarkers.push(onset ? 1 : 0);
      return;
    }
    const last = GRAPH_SAMPLES - 1;
    this.onsetGraph[last] = Math.max(this.onsetGraph[last], strength);
    if (onset) this.onsetMarkers[last] = 1;
  }

  private downsampleWaveform(data: Uint8Array<ArrayBuffer>, buckets: number): number[] {
    const result: number[] = [];
    for (let bucket = 0; bucket < buckets; bucket += 1) {
      const index = Math.min(
        data.length - 1,
        Math.floor(((bucket + 0.5) / buckets) * data.length),
      );
      result.push((data[index] - 128) / 128);
    }
    return result;
  }

  private downsampleSpectrum(data: Uint8Array<ArrayBuffer>, buckets: number): number[] {
    const result: number[] = [];
    for (let bucket = 0; bucket < buckets; bucket += 1) {
      const start = Math.max(1, Math.floor(Math.pow(bucket / buckets, 2) * data.length));
      const end = Math.max(start + 1, Math.floor(Math.pow((bucket + 1) / buckets, 2) * data.length));
      let peak = 0;
      for (let index = start; index < Math.min(data.length, end); index += 1) {
        peak = Math.max(peak, data[index] / 255);
      }
      result.push(peak);
    }
    return result;
  }
}
