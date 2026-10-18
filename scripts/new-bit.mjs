import fs from 'node:fs';
import path from 'node:path';
import { CONTENT_ROOT } from '../site.config.mjs';

const pad2 = (value) => String(value).padStart(2, '0');

const readSiteTimezone = () => {
  const env = (process.env.SITE_TIMEZONE ?? '').trim();
  if (env) return env;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'settings', 'site.json'), 'utf8'));
    return typeof raw.timezone === 'string' && raw.timezone.trim() ? raw.timezone.trim() : 'Asia/Shanghai';
  } catch {
    return 'Asia/Shanghai';
  }
};

const getZonedParts = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: values.get('year'),
    month: values.get('month'),
    day: values.get('day'),
    hour: values.get('hour'),
    minute: values.get('minute'),
    second: values.get('second')
  };
};

const getOffsetText = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset'
  }).formatToParts(date);
  const offset = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+00:00';
  const match = /^GMT([+-]\d{2}:\d{2})$/.exec(offset);
  return match?.[1] ?? '+00:00';
};

const now = new Date();
const timeZone = readSiteTimezone();
const parts = getZonedParts(now, timeZone);
const dateText = `${parts.year}-${parts.month}-${parts.day}`;
const timeText = `${parts.hour}${parts.minute}`;
const dateTimeText = `${dateText}T${parts.hour}:${parts.minute}:${parts.second}${getOffsetText(now, timeZone)}`;

const entryId = `bits-${dateText}-${timeText}`;
const directory = path.join(process.cwd(), CONTENT_ROOT, 'bits', entryId);
const filePath = path.join(directory, 'index.md');

if (fs.existsSync(filePath)) {
  console.error(`File already exists: ${filePath}`);
  process.exit(1);
}

fs.mkdirSync(directory, { recursive: true });

const template = `---\ndraft: true\ndate: ${dateTimeText}\ntags: []\nimages: []\n---\n\n`;
fs.writeFileSync(filePath, template, 'utf8');

console.log(`Created: ${filePath}`);
console.log('Next: edit the file and run `npm run dev`');
