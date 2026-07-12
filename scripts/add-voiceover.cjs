#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

function parseArgs(argv) {
  const args = {
    voice: null,
    rate: null,
    volume: 1.35,
    workDir: null,
    audioDir: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    args[key] = argv[++i];
  }
  for (const required of ['input', 'timeline', 'output']) {
    if (!args[required]) throw new Error(`Missing --${required}`);
  }
  args.volume = Number(args.volume);
  return args;
}

function hasCommand(command) {
  return spawnSync('sh', ['-lc', `command -v ${command}`], { stdio: 'ignore' }).status === 0;
}

function ffprobeDuration(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1',
    file,
  ], { encoding: 'utf8' }).trim();
  return Number(out);
}

function readTimeline(file) {
  const timeline = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(timeline.segments) || timeline.segments.length === 0) {
    throw new Error('Timeline must contain a nonempty segments array.');
  }
  for (const [index, segment] of timeline.segments.entries()) {
    if (typeof segment.start !== 'number') throw new Error(`segments[${index}].start must be a number.`);
  }
  return timeline;
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function findAudioFile(audioDir, index) {
  if (!audioDir) return null;
  const base = `segment-${String(index + 1).padStart(2, '0')}`;
  const extensions = ['wav', 'mp3', 'm4a', 'aac', 'aiff', 'aif', 'flac', 'ogg'];
  for (const extension of extensions) {
    const candidate = path.join(audioDir, `${base}.${extension}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!hasCommand('ffmpeg')) throw new Error('ffmpeg is required to mix voiceover into the video.');
  if (!hasCommand('ffprobe')) throw new Error('ffprobe is required to inspect media durations.');

  const input = path.resolve(args.input);
  const output = path.resolve(args.output);
  const timelinePath = path.resolve(args.timeline);
  const timeline = readTimeline(timelinePath);
  const durationSeconds = ffprobeDuration(input);
  const voice = args.voice || timeline.voice || 'Tingting';
  const rate = String(args.rate || timeline.rate || 220);
  const workDir = path.resolve(args.workDir || path.join(path.dirname(output), `voiceover-work-${stamp()}`));
  const audioDir = args.audioDir ? path.resolve(args.audioDir) : null;
  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(path.dirname(output), { recursive: true });

  const audioFiles = [];
  const segments = timeline.segments.map((segment, index) => {
    let audioFile = segment.audioFile ? path.resolve(segment.audioFile) : findAudioFile(audioDir, index);
    const generated = !audioFile;
    if (generated) {
      if (!segment.text) {
        throw new Error(`segments[${index}] must contain text, audioFile, or a matching file in --audio-dir.`);
      }
      if (!hasCommand('say')) {
        throw new Error(`macOS say is required to generate segments[${index}]. Provide audioFile or --audio-dir for pre-rendered narration.`);
      }
      audioFile = path.join(workDir, `segment-${String(index + 1).padStart(2, '0')}.aiff`);
      execFileSync('say', ['-v', voice, '-r', rate, '-o', audioFile, segment.text], { stdio: 'inherit' });
    }
    if (!fs.existsSync(audioFile)) throw new Error(`Audio file not found for segments[${index}]: ${audioFile}`);
    const duration = ffprobeDuration(audioFile);
    audioFiles.push(audioFile);
    return {
      ...segment,
      audioFile,
      generated,
      duration,
      end: Number((segment.start + duration).toFixed(3)),
    };
  });

  const overlaps = [];
  for (let i = 0; i < segments.length - 1; i += 1) {
    const gap = segments[i + 1].start - segments[i].end;
    if (gap < 0) overlaps.push({ from: i + 1, to: i + 2, overlap: Number((-gap).toFixed(3)) });
  }

  const ffmpegArgs = ['-y', '-i', input];
  for (const audioFile of audioFiles) ffmpegArgs.push('-i', audioFile);

  const filters = [`anullsrc=channel_layout=stereo:sample_rate=44100:d=${durationSeconds}[base]`];
  const delayedLabels = [];
  for (let i = 0; i < segments.length; i += 1) {
    const ms = Math.round(segments[i].start * 1000);
    const label = `a${i + 1}`;
    delayedLabels.push(`[${label}]`);
    filters.push(`[${i + 1}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,adelay=${ms}|${ms}[${label}]`);
  }
  filters.push(`[base]${delayedLabels.join('')}amix=inputs=${segments.length + 1}:duration=first:dropout_transition=0,volume=${args.volume}[aout]`);

  execFileSync('ffmpeg', [
    ...ffmpegArgs,
    '-filter_complex', filters.join(';'),
    '-map', '0:v:0',
    '-map', '[aout]',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-movflags', '+faststart',
    output,
  ], { stdio: 'inherit' });

  const report = {
    input,
    output,
    timeline: timelinePath,
    workDir,
    audioDir,
    voice,
    rate: Number(rate),
    volume: args.volume,
    durationSeconds,
    overlaps,
    endsBeforeVideoEnd: segments.at(-1).end <= durationSeconds,
    segments,
  };
  const reportPath = path.join(workDir, 'voiceover-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, report: reportPath }, null, 2));

  if (overlaps.length > 0) {
    console.error(`Voiceover contains overlapping segments: ${shellQuote(JSON.stringify(overlaps))}`);
    process.exitCode = 1;
  }
  if (!report.endsBeforeVideoEnd) {
    console.error('Voiceover narration extends beyond the end of the video.');
    process.exitCode = 1;
  }
}

main();
