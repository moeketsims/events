/**
 * Review every beat of a recorded clip in one picture.
 *
 *   pnpm exec tsx scripts/check-clip.mts setup
 *   pnpm exec tsx scripts/check-clip.mts checkin --offset 2.0
 *
 * Each recorder writes recordings/narration-<name>.json: every caption and the
 * second it appears. This grabs a frame a beat after each one and tiles them
 * into a contact sheet, so a clip can be judged whole instead of by spot
 * checks. What it is looking for, in order of how often it has gone wrong:
 *
 *   - a blank or white frame, which WhatsApp would use as the thumbnail
 *   - the caption bar covering the control being pointed at
 *   - a gold ring stranded over the wrong thing after a navigation
 *   - a caption that no longer matches what is on screen
 *
 * Output: recordings/check-<name>.jpg
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import ffmpegPath from 'ffmpeg-static';

const OUT_DIR = 'recordings';
const name = process.argv.find(
  (a) => !a.startsWith('-') && !a.includes('node') && !a.endsWith('.mts'),
);
const offsetArg = process.argv.indexOf('--offset');
/** How long after a caption appears to grab the frame; enough for the action to land. */
const OFFSET = offsetArg > -1 ? Number(process.argv[offsetArg + 1]) : 1.4;
/** Tiles across the contact sheet. */
const COLUMNS = 3;
const TILE_W = 560;

if (!name) {
  console.error('Usage: pnpm exec tsx scripts/check-clip.mts <name> [--offset seconds]');
  process.exit(1);
}

const video = `${OUT_DIR}/cut-events-${name}.mp4`;
const timelineFile = `${OUT_DIR}/narration-${name}.json`;
const sheet = `${OUT_DIR}/check-${name}.jpg`;
const frameDir = `${OUT_DIR}/frames-${name}`;

for (const f of [video, timelineFile]) {
  if (!existsSync(f)) {
    console.error(`Missing ${f}.`);
    process.exit(1);
  }
}

const ffmpeg = ffmpegPath as unknown as string;
const timeline = JSON.parse(readFileSync(timelineFile, 'utf8')) as { at: number; text: string }[];

/** Total seconds of the clip, read back from ffmpeg's own report. */
function duration(file: string): number {
  let out = '';
  try {
    out = execFileSync(ffmpeg, ['-hide_banner', '-i', file], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).toString();
  } catch (error) {
    out = String((error as { stderr?: Buffer | string }).stderr ?? '');
  }
  const m = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(out);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

const total = duration(video);

rmSync(frameDir, { recursive: true, force: true });
mkdirSync(frameDir, { recursive: true });

// The first frame matters more than any other: it is the WhatsApp thumbnail.
const stamps = [0, ...timeline.map((b) => Math.min(b.at + OFFSET, Math.max(0, total - 0.4)))];

stamps.forEach((at, i) => {
  execFileSync(
    ffmpeg,
    [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      String(at),
      '-i',
      video,
      '-frames:v',
      '1',
      '-vf',
      `scale=${TILE_W}:-2`,
      '-q:v',
      '3',
      `${frameDir}/${String(i).padStart(3, '0')}.jpg`,
    ],
    { stdio: 'ignore' },
  );
});

const rows = Math.ceil(stamps.length / COLUMNS);
execFileSync(
  ffmpeg,
  [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    `${frameDir}/%03d.jpg`,
    '-filter_complex',
    `tile=${COLUMNS}x${rows}:margin=8:padding=6:color=#001738`,
    '-q:v',
    '4',
    sheet,
  ],
  { stdio: 'ignore' },
);

rmSync(frameDir, { recursive: true, force: true });

const mb = (statSync(sheet).size / 1024).toFixed(0);
console.log(`\n  ${sheet}  (${stamps.length} frames, ${COLUMNS}x${rows}, ${mb} KB)`);
console.log(`  Clip runs ${total.toFixed(1)}s\n`);
stamps.forEach((at, i) => {
  const label = i === 0 ? 'FIRST FRAME (the WhatsApp thumbnail)' : timeline[i - 1]!.text;
  console.log(`  ${String(i + 1).padStart(2)}  ${at.toFixed(1).padStart(6)}s  ${label}`);
});
console.log('');
