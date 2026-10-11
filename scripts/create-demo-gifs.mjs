import { spawnSync } from 'node:child_process';
import { mkdir, readdir } from 'node:fs/promises';
import { resolve, basename } from 'node:path';

const source = resolve('demos/videos');
const destination = resolve('demos/gifs');
await mkdir(destination, { recursive: true });
const videos = (await readdir(source)).filter(file => file.endsWith('.webm')).sort();
if (!videos.length) throw new Error('No demo videos found. Run npm run record:demos first.');

for (const video of videos) {
  const name = basename(video, '.webm');
  const result = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', resolve(source, video),
    '-filter_complex', 'fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
    '-loop', '0', resolve(destination, `${name}.gif`),
  ], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`GIF conversion failed for ${video}`);
  console.log(`Saved ${name}.gif`);
}
