import { chromium } from 'playwright';
import {mkdir,rm,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createGif,gifSpeed} from './create-featured-gifs.mjs';
import {browserOptions,profile,demoUrl,enable,formatScenario,emojiScenario,inboxScenario} from './showcase-scenarios.mjs';
const out='demos/featured'; const raw='/tmp/intelligent-components-recordings';
await mkdir(out,{recursive:true}); await mkdir(raw,{recursive:true});
const context=await chromium.launchPersistentContext(profile,{...browserOptions,recordVideo:{dir:raw,size:browserOptions.viewport}});
const page=context.pages()[0]??await context.newPage();
const segments=[];let ended;
const progress=setInterval(()=>console.log('Recording / model initialization in progress…'),30000);
try {
  await page.goto(demoUrl,{waitUntil:'domcontentloaded'}); await enable(page);
  for(const [name,tab,scenario] of [['autoformat','Autoformat',formatScenario],['live-emoji','Live emoji',emojiScenario],['inbox-routing','Inbox routing',inboxScenario]]) {
    await page.getByRole('button',{name:new RegExp(tab)}).click(); await enable(page);
    await page.waitForTimeout(500);
    const start=Date.now(); await scenario(page); const end=Date.now();segments.push({name,start,end});
    await page.screenshot({path:`${out}/${name}.png`,animations:'disabled',timeout:60000});
  }
  ended=Date.now();
} finally {clearInterval(progress);await context.close();}
const source=await page.video().path();
const duration=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',source],{encoding:'utf8'}));
for(const {name,start,end} of segments) {
  const offset=Math.max(0,duration-(ended-start)/1000),length=(end-start)/1000;
  execFileSync('ffmpeg',['-y','-loglevel','error','-ss',String(offset),'-i',source,'-t',String(length),'-an','-c:v','libvpx-vp9','-crf','30','-b:v','0',`${out}/${name}.webm`]);
  createGif(`${out}/${name}.webm`,`${out}/${name}.gif`);
  console.log('SAVED',`${out}/${name}.gif`);
}
await writeFile(`${out}/recording.json`,JSON.stringify({recordedAt:new Date().toISOString(),inference:'real, on-device',models:{format:'Qwen3-4B-q4f16_1-MLC (WebLLM 0.2.86)',decisions:'d1-omni-600M (ONNX revision 4ebc1b97bf1477485371c79d1cf8d5e4e8eebfa0)'},modelInitializationOmitted:true,gifPlaybackSpeed:gifSpeed,videoPlaybackSpeed:1,viewport:browserOptions.viewport,demos:segments.map(s=>({name:s.name,durationSeconds:(s.end-s.start)/1000}))},null,2)+'\n');
await rm(source);
