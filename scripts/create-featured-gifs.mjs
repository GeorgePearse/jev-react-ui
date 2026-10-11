import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
export const gifSpeed=Number(process.env.GIF_SPEED??2);
if(!Number.isFinite(gifSpeed)||gifSpeed<1||gifSpeed>8)throw new Error('GIF_SPEED must be between 1 and 8.');
export function createGif(video,gif) {
  execFileSync('ffmpeg',['-y','-loglevel','error','-i',video,'-filter_complex',`setpts=PTS/${gifSpeed},fps=12,scale=1080:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3`,'-loop','0',gif]);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  for(const name of ['autoformat','live-emoji','inbox-routing'])createGif(`demos/featured/${name}.webm`,`demos/featured/${name}.gif`);
}
