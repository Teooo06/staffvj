import type { MediaLayerSource } from '../types';
import { clamp } from './utils';

export interface VideoTimeline {
  position: number;
  rawPosition: number;
  start: number;
  end: number;
  duration: number;
  rate: number;
  loop: boolean;
  paused: boolean;
}

export function videoTimeline(
  source: MediaLayerSource,
  nowMs: number,
  duration: number,
): VideoTimeline {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const start = clamp(source.rangeStart ?? 0, 0, safeDuration);
  const end = clamp(source.rangeEnd ?? safeDuration, start, safeDuration);
  const rate = clamp(source.playbackRate ?? 1, 0.05, 8);
  const loop = source.loop !== false;
  const paused = source.paused === true;
  const length = Math.max(0, end - start);

  if (paused) {
    const position = clamp(source.pausePosition ?? start, start, end);
    return {
      position,
      rawPosition: position,
      start,
      end,
      duration: safeDuration,
      rate,
      loop,
      paused,
    };
  }

  const base = source.seekAt ?? source.startedAt;
  const rawPosition = start + Math.max(0, (nowMs - base) / 1000) * rate;
  let position = rawPosition;
  if (loop && length > 0) {
    position = start + (((rawPosition - start) % length) + length) % length;
  } else {
    position = clamp(rawPosition, start, end);
  }

  return {
    position,
    rawPosition,
    start,
    end,
    duration: safeDuration,
    rate,
    loop,
    paused,
  };
}

export function videoSeekPatch(
  source: MediaLayerSource,
  position: number,
  nowMs: number,
  duration: number,
): Partial<MediaLayerSource> {
  const timeline = videoTimeline(source, nowMs, duration);
  const next = clamp(position, timeline.start, timeline.end);
  if (timeline.paused) return { pausePosition: next };
  return {
    seekAt: nowMs - ((next - timeline.start) / timeline.rate) * 1000,
    pausePosition: undefined,
  };
}

export function videoPlayPatch(
  source: MediaLayerSource,
  nowMs: number,
  duration: number,
): Partial<MediaLayerSource> {
  const timeline = videoTimeline(source, nowMs, duration);
  const atEnd = !timeline.loop && timeline.rawPosition >= timeline.end - 0.01;
  const position = atEnd ? timeline.start : timeline.position;
  return {
    paused: false,
    pausePosition: undefined,
    seekAt: nowMs - ((position - timeline.start) / timeline.rate) * 1000,
  };
}

export function videoPausePatch(
  source: MediaLayerSource,
  nowMs: number,
  duration: number,
): Partial<MediaLayerSource> {
  return {
    paused: true,
    pausePosition: videoTimeline(source, nowMs, duration).position,
  };
}

export function videoRestartPatch(nowMs: number): Partial<MediaLayerSource> {
  return {
    paused: false,
    pausePosition: undefined,
    seekAt: nowMs,
  };
}

export function videoStopPatch(source: MediaLayerSource, duration: number): Partial<MediaLayerSource> {
  return {
    paused: true,
    pausePosition: videoTimeline(source, 0, duration).start,
  };
}

export function videoRangePatch(
  source: MediaLayerSource,
  rangeStart: number,
  rangeEnd: number,
  nowMs: number,
  duration: number,
): Partial<MediaLayerSource> {
  const timeline = videoTimeline(source, nowMs, duration);
  const nextStart = clamp(Math.min(rangeStart, rangeEnd), 0, timeline.duration);
  const nextEnd = clamp(Math.max(rangeStart, rangeEnd), nextStart, timeline.duration);
  const position = clamp(timeline.position, nextStart, nextEnd);
  if (timeline.paused) {
    return {
      rangeStart: nextStart,
      rangeEnd: nextEnd,
      pausePosition: position,
    };
  }
  return {
    rangeStart: nextStart,
    rangeEnd: nextEnd,
    seekAt: nowMs - ((position - nextStart) / timeline.rate) * 1000,
    pausePosition: undefined,
  };
}
