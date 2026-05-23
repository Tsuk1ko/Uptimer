import { describe, expect, it } from 'vitest';

import {
  buildHomepageArtifactMonitorFragmentWrites,
  parseHomepageArtifactMonitorFragmentRows,
} from '../src/snapshots/public-homepage';
import {
  assemblePublicHomepagePayloadFromFragments,
  assemblePublicStatusPayloadFromFragments,
  buildHomepageEnvelopeFragmentWrite,
  buildHomepageMonitorFragmentWrites,
  buildMonitorRuntimeUpdateFragmentWrites,
  buildStatusEnvelopeFragmentWrite,
  buildStatusMonitorFragmentWrites,
  HOMEPAGE_ENVELOPE_FRAGMENT_KEY,
  HOMEPAGE_MONITOR_FRAGMENTS_KEY,
  MONITOR_RUNTIME_UPDATE_FRAGMENTS_KEY,
  parseHomepageEnvelopeFragmentRows,
  parseHomepageMonitorFragmentRows,
  parseMonitorRuntimeUpdateFragmentRows,
  parsePublicMonitorFragmentKey,
  parseStatusEnvelopeFragmentRows,
  parseStatusMonitorFragmentRows,
  PUBLIC_SNAPSHOT_ENVELOPE_FRAGMENT_KEY,
  readHomepageSnapshotBodyJsonFromFragments,
  readHomepageSnapshotFragments,
  readMonitorRuntimeUpdateFragments,
  readStatusSnapshotBodyJsonFromFragments,
  readStatusSnapshotFragments,
  STATUS_ENVELOPE_FRAGMENT_KEY,
  STATUS_MONITOR_FRAGMENTS_KEY,
  toPublicMonitorFragmentKey,
} from '../src/snapshots/public-monitor-fragments';
import { createFakeD1Database } from './helpers/fake-d1';

function rowFromWrite(write: {
  fragmentKey: string;
  generatedAt: number;
  bodyJson: string;
  updatedAt: number;
}) {
  return {
    fragment_key: write.fragmentKey,
    generated_at: write.generatedAt,
    body_json: write.bodyJson,
    updated_at: write.updatedAt,
  };
}

function statusMonitor(id: number) {
  return {
    id,
    name: `Monitor ${id}`,
    type: 'http' as const,
    group_name: 'Core',
    group_sort_order: 0,
    sort_order: id,
    uptime_rating_level: 4 as const,
    status: 'up' as const,
    is_stale: false,
    last_checked_at: 1_700_000_000,
    last_latency_ms: 42,
    heartbeats: [
      {
        checked_at: 1_700_000_000,
        status: 'up' as const,
        latency_ms: 42,
      },
    ],
    uptime_30d: {
      range_start_at: 1_697_408_000,
      range_end_at: 1_700_000_000,
      total_sec: 2_592_000,
      downtime_sec: 0,
      unknown_sec: 0,
      uptime_sec: 2_592_000,
      uptime_pct: 100,
    },
    uptime_days: [
      {
        day_start_at: 1_699_920_000,
        total_sec: 86_400,
        downtime_sec: 0,
        unknown_sec: 0,
        uptime_sec: 86_400,
        uptime_pct: 100,
      },
    ],
  };
}

function statusPayload() {
  return {
    generated_at: 1_700_000_000,
    site_title: 'Uptimer',
    site_description: '',
    site_locale: 'auto' as const,
    site_timezone: 'UTC',
    uptime_rating_level: 4 as const,
    overall_status: 'up' as const,
    banner: {
      source: 'monitors' as const,
      status: 'operational' as const,
      title: 'All Systems Operational',
      down_ratio: null,
    },
    summary: {
      up: 2,
      down: 0,
      maintenance: 0,
      paused: 0,
      unknown: 0,
    },
    monitors: [statusMonitor(1), statusMonitor(2)],
    active_incidents: [],
    maintenance_windows: {
      active: [],
      upcoming: [],
    },
  };
}

function homepageMonitor(id: number) {
  return {
    id,
    name: `Monitor ${id}`,
    type: 'http' as const,
    group_name: 'Core',
    status: 'up' as const,
    is_stale: false,
    last_checked_at: 1_700_000_000,
    heartbeat_strip: {
      checked_at: [1_700_000_000],
      status_codes: 'u',
      latency_ms: [42],
    },
    uptime_30d: {
      uptime_pct: 100,
    },
    uptime_day_strip: {
      day_start_at: [1_699_920_000],
      downtime_sec: [0],
      unknown_sec: [0],
      uptime_pct_milli: [100_000],
    },
  };
}

function homepagePayload() {
  return {
    generated_at: 1_700_000_000,
    bootstrap_mode: 'full' as const,
    monitor_count_total: 2,
    site_title: 'Uptimer',
    site_description: '',
    site_locale: 'auto' as const,
    site_timezone: 'UTC',
    uptime_rating_level: 4 as const,
    overall_status: 'up' as const,
    banner: {
      source: 'monitors' as const,
      status: 'operational' as const,
      title: 'All Systems Operational',
      down_ratio: null,
    },
    summary: {
      up: 2,
      down: 0,
      maintenance: 0,
      paused: 0,
      unknown: 0,
    },
    monitors: [homepageMonitor(1), homepageMonitor(2)],
    active_incidents: [],
    maintenance_windows: {
      active: [],
      upcoming: [],
    },
    resolved_incident_preview: null,
    maintenance_history_preview: null,
  };
}

describe('snapshots/public-monitor-fragments', () => {
  it('serializes status monitor fragments without duplicating the status envelope', () => {
    const writes = buildStatusMonitorFragmentWrites(statusPayload(), 1_700_000_005);

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      snapshotKey: STATUS_MONITOR_FRAGMENTS_KEY,
      generatedAt: 1_700_000_000,
      updatedAt: 1_700_000_005,
    });
    expect(writes[0]?.fragmentKey).toMatch(/^batch:1700000000:[0-9a-z]+$/);
    expect(JSON.parse(writes[0]!.bodyJson)).toEqual([statusMonitor(1), statusMonitor(2)]);
    expect(writes[0]!.bodyJson).toContain('heartbeats');
    expect(writes[0]!.bodyJson).toContain('uptime_days');
    expect(writes[0]!.bodyJson).not.toContain('site_title');
  });

  it('serializes only selected status monitor fragments', () => {
    const writes = buildStatusMonitorFragmentWrites(statusPayload(), 1_700_000_005, [2]);

    expect(writes).toHaveLength(1);
    expect(writes[0]?.fragmentKey).toMatch(/^batch:1700000000:[0-9a-z]+$/);
    expect(JSON.parse(writes[0]!.bodyJson)).toEqual([statusMonitor(2)]);
  });

  it('serializes homepage monitor fragments separately from status fragments', () => {
    const writes = buildHomepageMonitorFragmentWrites(homepagePayload(), 1_700_000_005, [1]);

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      snapshotKey: HOMEPAGE_MONITOR_FRAGMENTS_KEY,
      generatedAt: 1_700_000_000,
      updatedAt: 1_700_000_005,
    });
    expect(writes[0]?.fragmentKey).toMatch(/^batch:1700000000:[0-9a-z]+$/);
    expect(JSON.parse(writes[0]!.bodyJson)).toEqual([homepageMonitor(1)]);
    expect(writes[0]!.bodyJson).toContain('heartbeat_strip');
    expect(writes[0]!.bodyJson).toContain('uptime_day_strip');
    expect(writes[0]!.bodyJson).not.toContain('bootstrap_mode');
  });

  it('serializes status and homepage envelopes without monitor histories', () => {
    const statusWrite = buildStatusEnvelopeFragmentWrite(statusPayload(), 1_700_000_005);
    const homepageWrite = buildHomepageEnvelopeFragmentWrite(homepagePayload(), 1_700_000_005);

    expect(statusWrite).toMatchObject({
      snapshotKey: STATUS_ENVELOPE_FRAGMENT_KEY,
      fragmentKey: PUBLIC_SNAPSHOT_ENVELOPE_FRAGMENT_KEY,
      generatedAt: 1_700_000_000,
      updatedAt: 1_700_000_005,
    });
    expect(homepageWrite).toMatchObject({
      snapshotKey: HOMEPAGE_ENVELOPE_FRAGMENT_KEY,
      fragmentKey: PUBLIC_SNAPSHOT_ENVELOPE_FRAGMENT_KEY,
      generatedAt: 1_700_000_000,
      updatedAt: 1_700_000_005,
    });

    const statusEnvelope = JSON.parse(statusWrite.bodyJson);
    const homepageEnvelope = JSON.parse(homepageWrite.bodyJson);
    expect(statusEnvelope).toMatchObject({
      site_title: 'Uptimer',
      summary: { up: 2 },
      monitor_ids: [1, 2],
    });
    expect(homepageEnvelope).toMatchObject({
      site_title: 'Uptimer',
      bootstrap_mode: 'full',
      summary: { up: 2 },
      monitor_ids: [1, 2],
    });
    expect(statusEnvelope).not.toHaveProperty('monitors');
    expect(homepageEnvelope).not.toHaveProperty('monitors');
    expect(statusWrite.bodyJson).not.toContain('heartbeats');
    expect(homepageWrite.bodyJson).not.toContain('heartbeat_strip');
  });

  it('reads and assembles status/homepage snapshots from envelope and monitor fragments', async () => {
    const statusEnvelopeWrite = buildStatusEnvelopeFragmentWrite(statusPayload(), 1_700_000_005);
    const statusMonitorWrites = buildStatusMonitorFragmentWrites(statusPayload(), 1_700_000_005);
    const homepageEnvelopeWrite = buildHomepageEnvelopeFragmentWrite(homepagePayload(), 1_700_000_005);
    const homepageMonitorWrites = buildHomepageMonitorFragmentWrites(homepagePayload(), 1_700_000_005);

    const statusEnvelope = parseStatusEnvelopeFragmentRows([
      {
        ...rowFromWrite(statusEnvelopeWrite),
      },
    ]);
    const statusMonitors = parseStatusMonitorFragmentRows(
      statusMonitorWrites.map(rowFromWrite),
    );
    const homepageEnvelope = parseHomepageEnvelopeFragmentRows([
      {
        ...rowFromWrite(homepageEnvelopeWrite),
      },
    ]);
    const homepageMonitors = parseHomepageMonitorFragmentRows(
      homepageMonitorWrites.map(rowFromWrite),
    );

    expect(statusEnvelope?.generatedAt).toBe(1_700_000_000);
    expect(statusMonitors.invalidCount).toBe(0);
    expect(homepageEnvelope?.generatedAt).toBe(1_700_000_000);
    expect(homepageMonitors.invalidCount).toBe(0);
    expect(
      assemblePublicStatusPayloadFromFragments(statusEnvelope!.data, statusMonitors.data),
    ).toEqual(statusPayload());
    expect(
      assemblePublicHomepagePayloadFromFragments(homepageEnvelope!.data, homepageMonitors.data),
    ).toEqual(homepagePayload());

    const db = createFakeD1Database([
      {
        match: 'from public_snapshot_fragments',
        all: (args) => {
          if (args[0] === STATUS_ENVELOPE_FRAGMENT_KEY) {
            return [rowFromWrite(statusEnvelopeWrite)];
          }
          if (args[0] === STATUS_MONITOR_FRAGMENTS_KEY) {
            return statusMonitorWrites.map(rowFromWrite);
          }
          if (args[0] === HOMEPAGE_ENVELOPE_FRAGMENT_KEY) {
            return [rowFromWrite(homepageEnvelopeWrite)];
          }
          if (args[0] === HOMEPAGE_MONITOR_FRAGMENTS_KEY) {
            return homepageMonitorWrites.map(rowFromWrite);
          }
          return [];
        },
      },
    ]);

    await expect(readStatusSnapshotFragments(db)).resolves.toMatchObject({
      envelope: { generatedAt: 1_700_000_000 },
      monitors: { data: [{ id: 1 }, { id: 2 }], invalidCount: 0 },
    });
    await expect(readHomepageSnapshotFragments(db)).resolves.toMatchObject({
      envelope: { generatedAt: 1_700_000_000 },
      monitors: { data: [{ id: 1 }, { id: 2 }], invalidCount: 0 },
    });
  });

  it('assembles public body JSON from envelope and raw monitor fragments', async () => {
    const statusEnvelopeWrite = buildStatusEnvelopeFragmentWrite(statusPayload(), 1_700_000_005);
    const statusMonitorWrites = buildStatusMonitorFragmentWrites(statusPayload(), 1_700_000_005).reverse();
    const homepageEnvelopeWrite = buildHomepageEnvelopeFragmentWrite(homepagePayload(), 1_700_000_005);
    const homepageMonitorWrites = buildHomepageMonitorFragmentWrites(homepagePayload(), 1_700_000_005).reverse();
    const db = createFakeD1Database([
      {
        match: 'from public_snapshot_fragments',
        all: (args) => {
          if (args[0] === STATUS_ENVELOPE_FRAGMENT_KEY) {
            return [rowFromWrite(statusEnvelopeWrite)];
          }
          if (args[0] === STATUS_MONITOR_FRAGMENTS_KEY) {
            return statusMonitorWrites.map(rowFromWrite);
          }
          if (args[0] === HOMEPAGE_ENVELOPE_FRAGMENT_KEY) {
            return [rowFromWrite(homepageEnvelopeWrite)];
          }
          if (args[0] === HOMEPAGE_MONITOR_FRAGMENTS_KEY) {
            return homepageMonitorWrites.map(rowFromWrite);
          }
          return [];
        },
      },
    ]);

    const statusBody = await readStatusSnapshotBodyJsonFromFragments(db);
    const homepageBody = await readHomepageSnapshotBodyJsonFromFragments(db);

    expect(statusBody).toMatchObject({
      generatedAt: 1_700_000_000,
      monitorCount: 2,
      invalidCount: 0,
      staleCount: 0,
    });
    expect(homepageBody).toMatchObject({
      generatedAt: 1_700_000_000,
      monitorCount: 2,
      invalidCount: 0,
      staleCount: 0,
    });
    expect(JSON.parse(statusBody!.bodyJson)).toEqual(statusPayload());
    expect(JSON.parse(homepageBody!.bodyJson)).toEqual(homepagePayload());
  });

  it('serializes compact monitor runtime update fragments with latest update wins', () => {
    const writes = buildMonitorRuntimeUpdateFragmentWrites(
      [
        {
          monitor_id: 1,
          interval_sec: 60,
          created_at: 1_699_999_000,
          checked_at: 1_700_000_000,
          check_status: 'down',
          next_status: 'down',
          latency_ms: null,
        },
        {
          monitor_id: 1,
          interval_sec: 60,
          created_at: 1_699_999_000,
          checked_at: 1_700_000_060,
          check_status: 'up',
          next_status: 'up',
          latency_ms: 42,
        },
      ],
      1_700_000_065,
    );

    expect(writes).toEqual([
      {
        snapshotKey: MONITOR_RUNTIME_UPDATE_FRAGMENTS_KEY,
        fragmentKey: expect.stringMatching(/^batch:1700000060:[0-9a-z]+$/),
        generatedAt: 1_700_000_060,
        bodyJson: '[[1,60,1699999000,1700000060,"up","up",42]]',
        updatedAt: 1_700_000_065,
      },
    ]);
  });

  it('reads mixed legacy and batch monitor fragments with newest generated_at winning', () => {
    const batchWrite = buildStatusMonitorFragmentWrites(statusPayload(), 1_700_000_005)[0]!;
    const parsed = parseStatusMonitorFragmentRows([
      {
        fragment_key: 'monitor:1',
        generated_at: 1_699_999_940,
        body_json: JSON.stringify({ ...statusMonitor(1), name: 'old' }),
        updated_at: 1_699_999_945,
      },
      rowFromWrite(batchWrite),
    ]);

    expect(parsed.invalidCount).toBe(0);
    expect(parsed.data).toEqual([statusMonitor(1), statusMonitor(2)]);
  });

  it('reads compact runtime update batch fragments and keeps the latest update per monitor', () => {
    const batchWrites = buildMonitorRuntimeUpdateFragmentWrites(
      [
        {
          monitor_id: 2,
          interval_sec: 60,
          created_at: 1_699_999_000,
          checked_at: 1_700_000_060,
          check_status: 'up',
          next_status: 'up',
          latency_ms: 44,
        },
        {
          monitor_id: 1,
          interval_sec: 60,
          created_at: 1_699_999_000,
          checked_at: 1_700_000_060,
          check_status: 'up',
          next_status: 'up',
          latency_ms: 42,
        },
      ],
      1_700_000_065,
    );

    const parsed = parseMonitorRuntimeUpdateFragmentRows([
      {
        fragment_key: 'monitor:1',
        generated_at: 1_700_000_000,
        body_json: '[1,60,1699999000,1700000000,"down","down",null]',
        updated_at: 1_700_000_005,
      },
      rowFromWrite(batchWrites[0]!),
    ]);

    expect(parsed.invalidCount).toBe(0);
    expect(parsed.updates.map((update) => update.monitor_id)).toEqual([1, 2]);
    expect(parsed.updates[0]).toMatchObject({ monitor_id: 1, checked_at: 1_700_000_060 });
  });

  it('serializes and reads homepage artifact monitor batch fragments', () => {
    const writes = buildHomepageArtifactMonitorFragmentWrites(homepagePayload(), 1_700_000_005);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.fragmentKey).toMatch(/^batch:1700000000:[0-9a-z]+$/);

    const parsed = parseHomepageArtifactMonitorFragmentRows(
      writes.map(rowFromWrite),
      homepagePayload(),
    );

    expect(parsed.invalidCount).toBe(0);
    expect(parsed.staleCount).toBe(0);
    expect(parsed.missingCount).toBe(0);
    expect(parsed.monitorNameById.get(1)).toBe('Monitor 1');
    expect(parsed.cardHtmlByMonitorId.get(1)).toContain('Monitor 1');
  });

  it('reads valid compact runtime update fragments and reports skipped rows', async () => {
    const rows = [
      {
        fragment_key: 'monitor:2',
        generated_at: 1_700_000_060,
        body_json: '[2,60,1699999000,1700000060,"up","up",44]',
        updated_at: 1_700_000_065,
      },
      {
        fragment_key: 'monitor:1',
        generated_at: 1_700_000_000,
        body_json: '[1,60,1699999000,1700000000,"down","down",null]',
        updated_at: 1_700_000_005,
      },
      {
        fragment_key: 'monitor:1',
        generated_at: 1_700_000_060,
        body_json: '[1,60,1699999000,1700000060,"up","up",42]',
        updated_at: 1_700_000_065,
      },
      {
        fragment_key: 'monitor:bad',
        generated_at: 1_700_000_060,
        body_json: '[3,60,1699999000,1700000060,"up","up",42]',
        updated_at: 1_700_000_065,
      },
      {
        fragment_key: 'monitor:4',
        generated_at: 1_699_999_000,
        body_json: '[4,60,1699999000,1699999000,"up","up",42]',
        updated_at: 1_700_000_065,
      },
    ];

    const parsed = parseMonitorRuntimeUpdateFragmentRows(rows, {
      minGeneratedAt: 1_700_000_000,
      maxGeneratedAt: 1_700_000_120,
    });

    expect(parsed.invalidCount).toBe(1);
    expect(parsed.staleCount).toBe(1);
    expect(parsed.updates.map((update) => update.monitor_id)).toEqual([1, 2]);
    expect(parsed.updates[0]).toMatchObject({
      monitor_id: 1,
      checked_at: 1_700_000_060,
      check_status: 'up',
      latency_ms: 42,
    });

    const db = createFakeD1Database([
      {
        match: 'from public_snapshot_fragments',
        all: (args) => {
          expect(args).toEqual([MONITOR_RUNTIME_UPDATE_FRAGMENTS_KEY]);
          return rows;
        },
      },
    ]);
    await expect(
      readMonitorRuntimeUpdateFragments(db, { minGeneratedAt: 1_700_000_000 }),
    ).resolves.toMatchObject({
      invalidCount: 1,
      staleCount: 1,
      updates: [{ monitor_id: 1 }, { monitor_id: 2 }],
    });
  });

  it('validates monitor fragment keys', () => {
    expect(toPublicMonitorFragmentKey(42)).toBe('monitor:42');
    expect(parsePublicMonitorFragmentKey('monitor:42')).toBe(42);
    expect(parsePublicMonitorFragmentKey('monitor:x')).toBeNull();
    expect(() => toPublicMonitorFragmentKey(0)).toThrow('positive integer');
    expect(() => buildStatusMonitorFragmentWrites(statusPayload(), 1, [0])).toThrow(
      'positive integer',
    );
  });
});
