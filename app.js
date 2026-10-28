import {endOf,durationOf,splitClip,trimClip,makeChirp,detectChirp,summarizeLatency,loopPosition,playbackWindow,videoRects,mp4Type,MAX_TRACKS,createTrack,recordingSegments,replaceRange,countInSeconds} from './model.js';
const $=id=>document.getElementById(id), uid=()=>crypto.randomUUID();
const tracks=[createTrack(0),createTrack(1)];
const sources=new Map(), history=[];
let cycle={enabled:false,start:0,end:4}, masterVolume=1, masterMuted=false, liveMeter=null;
let wakeLock=null,wakePending=false,countIn=null;
const meterSamples=new Float32Array(256);
 let preparing=false,operation=0; let selected=null,view='audio',position=0,ctx,stream,recording=null,session=null,busy=false,measuring=false,measured=null,raf;
const canvas=$('monitor'),g=canvas.getContext('2d');
const status=(msg,error=false)=>{$('status').textContent=msg;$('status').classList.toggle('error',error);};
const protect=fn=>async(...a)=>{try{await fn(...a);}catch(e){console.error(e);status(e.message||String(e),true);if($('settings').open)$('deviceInfo').textContent=e.message||String(e);}};
const duration=()=>durationOf(tracks), zoom=()=>Number($('zoom').value), getSelected=()=>{for(const t of tracks){const c=t.clips.find(c=>c.id===selected);if(c)return {t,c};}return null;};
function checkpoint(){history.push(tracks.map(t=>t.clips.map(c=>({...c}))));if(history.length>30)history.shift();}
async function audio(){if(!ctx){ctx=new AudioContext({latencyHint:'interactive'});ctx.onstatechange=()=>{if(ctx.state!=='running'&&(session||recording||preparing))stopAll('Audio engine was interrupted. Take stopped; restart playback when ready.');};}await ctx.resume();return ctx;}
function mime(){if(!window.MediaRecorder)return '';return mp4Type(type=>MediaRecorder.isTypeSupported(type))||['video/webm;codecs=vp8,opus','video/webm'].find(type=>MediaRecorder.isTypeSupported(type))||'';}
function exportMime(){return window.MediaRecorder?mp4Type(type=>MediaRecorder.isTypeSupported(type)):'';}
function locked(){return busy||recording||session||measuring||preparing;}
function addTrack(){requireIdle();if(tracks.length>=MAX_TRACKS)return;tracks.push(createTrack(tracks.length));const index=tracks.length-1;$('armed').add(new Option(`0${index+1} — ${tracks[index].name}`,String(index)));$('armed').value=String(index);render();document.querySelectorAll('.track-head')[index].scrollIntoView({block:'nearest',inline:'nearest'});status(`Track 0${index+1} added and armed. ${tracks.length} / ${MAX_TRACKS} tracks.`);}
function armTrack(index){if(locked())return;$('armed').value=String(index);syncGains();render();}
function activeGain(t){return (t.muted?0:t.volume)*(masterMuted?0:masterVolume);}
function updateInspector(){const ti=Number($('armed').value),t=tracks[ti];$('armedLabel').textContent=`Track 0${ti+1}`;$('recordTarget').textContent=`● REC → TRACK 0${ti+1}`;$('record').title=`Record to Track 0${ti+1} — ${t.name}`;$('inspectorTrack').textContent=`0${ti+1}`;$('stripName').textContent=t.name;$('stripFooter').textContent=`Track 0${ti+1}`;$('inspectorVolume').value=t.volume;$('inspectorArm').textContent=`R · ARMED 0${ti+1}`;$('inspectorMute').textContent=t.muted?'M · ON':'M';$('inspectorMute').setAttribute('aria-pressed',String(t.muted));$('trackDb').textContent=t.volume>0?`${(20*Math.log10(t.volume)).toFixed(1)} dB`:'−∞ dB';$('masterDb').textContent=masterVolume>0?`${(20*Math.log10(masterVolume)).toFixed(1)} dB`:'−∞ dB';const sel=getSelected();$('regionInfo').textContent=sel?`${sources.get(sel.c.source).name} · ${sel.c.in.toFixed(2)}–${sel.c.out.toFixed(2)} s`:'No region selected';}
function renderCycle(){const range=$('loopRange');range.style.left=`${cycle.start*zoom()}px`;range.style.width=`${(cycle.end-cycle.start)*zoom()}px`;range.classList.toggle('enabled',cycle.enabled);$('loopToggle').setAttribute('aria-pressed',String(cycle.enabled));$('loopStart').value=cycle.start.toFixed(2);$('loopEnd').value=cycle.end.toFixed(2);$('loopState').textContent=cycle.enabled?`CYCLE ${cycle.start.toFixed(2)}–${cycle.end.toFixed(2)} s`:'CYCLE OFF';}

function requireIdle(){if(busy||recording||session||measuring||preparing)throw Error('Stop transport before changing the session.');}
function updateButtons(){
 const held=busy||measuring||preparing||!!recording, idleHeld=held||!!session;
 document.body.classList.toggle('busy',held);
 for(const id of ['engine','applyDevices','import','demo','armed','audioInput','videoInput','offset','loopbackReady','useMeasured','aspect','loopToggle','loopStart','loopEnd','bpm'])$(id).disabled=idleHeld||(id==='useMeasured'&&!measured);
 $('play').disabled=held||!!session||!duration();$('play').classList.toggle('playing',!!session&&!session.exporting);
 $('record').disabled=idleHeld||!stream;$('export').disabled=idleHeld||!duration()||!exportMime()||!canvas.captureStream;
 $('calibrate').disabled=idleHeld||!stream||!window.AudioWorkletNode;$('cancelExport').hidden=!exportState;
 $('engineState').textContent=stream?'ENGINE ON':'ENGINE OFF';$('engine').textContent=stream?'Stop engine':'Start engine';$('record').classList.toggle('recording',!!recording);
 $('exportSupport').textContent=exportMime()?'MP4 · H.264 + AAC · full timeline · real-time export': 'MP4 H.264 + AAC encoder unavailable in this browser. Try a current desktop Chrome or Safari. No WebM is substituted.';
 $('exportCodec').textContent=exportMime()?'MP4 · H.264 / AAC':'MP4 ENCODER UNAVAILABLE';
 document.querySelectorAll('.track-controls .arm').forEach(b=>b.disabled=idleHeld);
 $('inspectorArm').disabled=idleHeld;$('addTrack').disabled=idleHeld||tracks.length>=MAX_TRACKS;$('trackCount').textContent=`${tracks.length} A/V`;$('trackLimit').textContent=`${tracks.length} / ${MAX_TRACKS}`;$('addTrack').title=tracks.length>=MAX_TRACKS?'Maximum four tracks reached':'Add a linked audio + video track';document.querySelectorAll('.track-controls input,#inspectorVolume,#masterVolume').forEach(el=>el.disabled=busy||measuring);$('inspectorMute').disabled=busy;$('masterMute').disabled=busy;
}
function render(){
 const width=Math.max(20,duration()+3,cycle.end+2)*zoom();
 $('timeline').style.width=`calc(${width}px + var(--head))`;
 $('ruler').replaceChildren();
 const bar=240/Number($('bpm').value),beat=bar/4;
 const step=bar*zoom()<60?2:1;
 for(let i=0;i<=width/zoom()/bar;i+=step){const mark=document.createElement('span');mark.style.left=`${i*bar*zoom()}px`;mark.textContent=String(i+1);$('ruler').append(mark);}
 for(let t=0;t<width/zoom();t+=beat){const tick=document.createElement('span');tick.className='ruler-beat';tick.style.left=`${t*zoom()}px`;$('ruler').append(tick);}
 const cursor=document.createElement('i');cursor.className='ruler-cursor';$('ruler').append(cursor);
 $('tracks').replaceChildren();
 tracks.forEach((t,ti)=>{
  const armed=Number($('armed').value)===ti;
  const row=document.createElement('div');row.className='track-row';
  const head=document.createElement('div');head.className=`track-head${armed?' is-armed':''}`;
  head.innerHTML=`<div class="track-title"><span class="track-num">${ti+1}</span><span class="track-icon">♩</span>${t.name}</div><small>${armed?'● ARMED — RECORDS HERE':'AUDIO + VIDEO · LINKED'}</small>`;
  const controls=document.createElement('div');controls.className='track-controls';
  const mute=document.createElement('button');mute.className='mute';mute.textContent='M';mute.title='Mute';mute.setAttribute('aria-label',`Mute ${t.name}`);mute.setAttribute('aria-pressed',String(t.muted));mute.onclick=()=>{if(busy)return;t.muted=!t.muted;syncGains();render();};
  const arm=document.createElement('button');arm.className='arm';arm.textContent='R';arm.setAttribute('aria-label',`Arm ${t.name}`);arm.setAttribute('aria-pressed',String(armed));arm.title=armed?'Armed — records here':'Arm for recording';arm.onclick=()=>armTrack(ti);
  const vol=document.createElement('input');vol.type='range';vol.min='0';vol.max='1';vol.step='.01';vol.value=t.volume;vol.setAttribute('aria-label',`${t.name} volume`);vol.oninput=()=>{if(busy)return;t.volume=Number(vol.value);syncGains();updateInspector();};
  controls.append(mute,arm,vol);head.append(controls);
  const lane=document.createElement('div');lane.className='lane';lane.style.setProperty('--grid',`${bar*zoom()}px`);
  if(!t.clips.length){const empty=document.createElement('span');empty.className='empty';empty.textContent=armed?'Armed · press Record or import a video':'Press R to arm this track';lane.append(empty);}
  for(const c of t.clips){
   const source=sources.get(c.source),region=document.createElement('button');region.className=`clip track-${ti}${c.id===selected?' selected':''}`;
   region.style.left=`${c.start*zoom()}px`;region.style.width=`${(c.out-c.in)*zoom()}px`;region.setAttribute('aria-label',`${source.name}, ${c.start.toFixed(2)} to ${endOf(c).toFixed(2)} seconds`);
   const label=document.createElement('span');label.className='clip-label';label.textContent=`↔ ${source.name}`;region.append(label);
   if(view==='audio'){
    const wave=document.createElement('canvas');wave.width=Math.max(1,Math.min(4000,Math.round((c.out-c.in)*zoom())));wave.height=86;region.append(wave);
    const w=wave.getContext('2d'),data=source.buffer.getChannelData(0);w.strokeStyle=['#7e9e70','#7995ae','#b48d65','#9983b4'][ti];w.beginPath();
    for(let x=0;x<wave.width;x++){const a=Math.floor((c.in+x/wave.width*(c.out-c.in))*source.buffer.sampleRate),n=Math.max(1,Math.floor((c.out-c.in)*source.buffer.sampleRate/wave.width));let peak=0;for(let j=0;j<n;j+=Math.max(1,Math.floor(n/30)))peak=Math.max(peak,Math.abs(data[a+j]||0));const height=Math.min(1,peak*8)*39;w.moveTo(x,43-height);w.lineTo(x,43+height);}w.stroke();
   }else{
    const film=document.createElement('span');film.className='film';const thumb=source.thumbnail;
    if(thumb){for(let n=0;n<Math.min(30,Math.ceil((c.out-c.in)*zoom()/130));n++){const frame=document.createElement('canvas');frame.width=160;frame.height=90;frame.getContext('2d').drawImage(thumb,0,0,160,90);film.append(frame);}}
    else{const text=document.createElement('span');text.className='film-label';text.textContent='▧ Linked video';film.append(text);}region.append(film);
   }
   for(const edge of ['left','right']){const handle=document.createElement('span');handle.className=`trim-handle ${edge}`;handle.title=`Drag to trim ${edge==='left'?'start':'end'} (audio + video)`;handle.setAttribute('aria-label',`Trim ${edge==='left'?'start':'end'} of ${source.name}`);handle.onpointerdown=e=>beginTrim(e,c,t,region,edge);region.append(handle);}
   region.onclick=e=>{if(e.target.closest('.trim-handle')||locked())return;selected=c.id;render();};lane.append(region);
  }
  const line=document.createElement('div');line.className='playline';lane.append(line);
  lane.onclick=e=>{if(e.target===lane&&!locked())protect(()=>seek((e.clientX-lane.getBoundingClientRect().left)/zoom()))();};row.append(head,lane);$('tracks').append(row);
 });
 const sel=getSelected();$('selection').textContent=sel?`${sources.get(sel.c.source).name} · ${sel.c.start.toFixed(2)}–${endOf(sel.c).toFixed(2)} s · linked A/V`:'Select a region · drag its edges to trim · Split at the playhead';
 for(const id of ['split','trim','delete'])$(id).disabled=!sel||locked();$('undo').disabled=!history.length||locked();
 updateInspector();renderCycle();updateButtons();updateTime();
}
function beginTrim(event,clip,track,region,edge){
 if(locked())return;event.preventDefault();event.stopPropagation();selected=clip.id;
 const before={...clip},x=event.clientX,handle=event.currentTarget;let draft=before,moved=false;
 handle.setPointerCapture(event.pointerId);
 handle.onpointermove=e=>{const delta=(e.clientX-x)/zoom();const start=edge==='left'?Math.max(before.in,Math.min(before.out-.05,before.in+delta)):before.in;const end=edge==='right'?Math.min(before.out,Math.max(before.in+.05,before.out+delta)):before.out;draft=trimClip(before,start,end);moved=Math.abs(delta)>.005;region.style.left=`${draft.start*zoom()}px`;region.style.width=`${(draft.out-draft.in)*zoom()}px`;};
 const finish=e=>{handle.onpointermove=null;handle.onpointerup=null;handle.onpointercancel=null;if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);if(e.type!=='pointercancel'&&moved){checkpoint();track.clips.splice(track.clips.indexOf(clip),1,draft);}render();showStill().catch(err=>status(err.message,true));};
 handle.onpointerup=finish;handle.onpointercancel=finish;
}
function updateTime(){const beat=60/Number($('bpm').value);$('bars').textContent=`${String(Math.floor(position/(beat*4))+1).padStart(3,'0')}  ${Math.floor(position/beat)%4+1}  1`;const cursor=$('ruler').querySelector('.ruler-cursor');if(cursor)cursor.style.left=`${position*zoom()}px`;$('ruler').setAttribute('aria-valuenow',position.toFixed(2));$('ruler').setAttribute('aria-valuemax',String(Math.max(20,duration())));const sec=Math.max(0,position);$('time').value=`${String(Math.floor(sec/60)).padStart(2,'0')}:${(sec%60).toFixed(2).padStart(5,'0')}`;document.querySelectorAll('.playline').forEach(l=>l.style.left=`${position*zoom()}px`);}
async function listDevices(){const devices=await navigator.mediaDevices.enumerateDevices();for(const [id,kind] of [['audioInput','audioinput'],['videoInput','videoinput']]){const select=$(id),value=select.value;select.replaceChildren(new Option('System default',''));devices.filter(d=>d.kind===kind).forEach((d,i)=>select.add(new Option(d.label||`${kind} ${i+1}`,d.deviceId)));if([...select.options].some(o=>o.value===value))select.value=value;}}
async function startEngine(){requireIdle();if(!isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('Camera and audio need HTTPS or localhost in a supported browser.');await audio();if(liveMeter){liveMeter.input.disconnect();liveMeter.meter.disconnect();liveMeter.silent.disconnect();liveMeter=null;}stream?.getTracks().forEach(t=>t.stop());stream=null;updateButtons();const incoming=await navigator.mediaDevices.getUserMedia({audio:{deviceId:$('audioInput').value?{exact:$('audioInput').value}:undefined,echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:{deviceId:$('videoInput').value?{exact:$('videoInput').value}:undefined,width:{ideal:720},height:{ideal:1280},aspectRatio:{ideal:9/16},frameRate:{ideal:30}}});stream=incoming;const input=ctx.createMediaStreamSource(stream),meter=ctx.createAnalyser(),silent=ctx.createGain();meter.fftSize=256;silent.gain.value=0;input.connect(meter).connect(silent).connect(ctx.destination);liveMeter={input,meter,silent};syncInputMonitor();await keepAwake();$('camera').srcObject=stream;await $('camera').play();stream.getTracks().forEach(t=>t.onended=()=>{stopAll('Device disconnected. Reconnect the engine.');stream?.getTracks().forEach(t=>t.stop());stream=null;releaseWake();syncInputMonitor();updateButtons();});await listDevices();const a=stream.getAudioTracks()[0].getSettings();$('deviceInfo').textContent=`Input: ${stream.getAudioTracks()[0].label}. ${a.sampleRate||ctx.sampleRate} Hz; echo cancellation ${a.echoCancellation??'unknown'}, noise suppression ${a.noiseSuppression??'unknown'}. Output follows OS routing.`;measured=null;$('useMeasured').disabled=true;$('offset').value=0;status('Engine ready · input monitor ON. Use headphones; turn monitor off if using hardware direct monitoring.');render();}
function metadata(v){return new Promise((res,rej)=>{if(v.readyState>=1)return res();const done=error=>{clearTimeout(timer);v.onloadedmetadata=null;v.onerror=null;error?rej(error):res();};const timer=setTimeout(()=>done(Error('Video metadata timed out. Try another format.')),15000);v.onloadedmetadata=()=>done();v.onerror=()=>done(Error('This browser cannot read the video format.'));});}
async function addSource(blob,name,knownDuration){await audio();const url=URL.createObjectURL(blob),v=document.createElement('video');v.src=url;v.muted=true;v.playsInline=true;v.preload='auto';try{await metadata(v);let buffer;try{buffer=await ctx.decodeAudioData(await blob.arrayBuffer());}catch{throw Error('Could not decode this video’s audio. Import a video with a browser-decodable audio track (try MP4 H.264/AAC or WebM/Opus).');}let length=Math.min(buffer.duration,Number.isFinite(v.duration)?v.duration:knownDuration||buffer.duration);if(length<.05)throw Error('Take is too short.');const id=uid();const second=v.cloneNode(true);second.muted=true;second.playsInline=true;second.preload='auto';await metadata(second);await prepareVideo(v,Math.min(.1,length/2));const thumbnail=document.createElement('canvas');thumbnail.width=160;thumbnail.height=90;if(v.readyState>=2)thumbnail.getContext('2d').drawImage(v,0,0,160,90);sources.set(id,{id,url,blob,video:v,previews:[v,second],thumbnail,buffer,duration:length,name});return id;}catch(e){URL.revokeObjectURL(url);v.removeAttribute('src');v.load();throw e;}}
async function importFile(file){requireIdle();if(!file)return;status('Decoding video and audio…');busy=true;updateButtons();try{const id=await addSource(file,file.name);checkpoint();const ti=Number($('armed').value),c={id:uid(),source:id,start:Math.max(position,...tracks[ti].clips.map(endOf)),in:0,out:sources.get(id).duration};tracks[ti].clips.push(c);selected=c.id;status('Imported. Audio and video share every edit.');}finally{busy=false;render();await showStill();}}
function syncGains(){syncInputMonitor();if(session){session.gains.forEach((gain,i)=>gain.gain.setTargetAtTime(tracks[i].muted?0:tracks[i].volume,ctx.currentTime,.01));session.master.gain.setTargetAtTime(masterMuted?0:masterVolume,ctx.currentTime,.01);}updateInspector();}
async function prepareVideo(v,time){v.pause();if(Math.abs(v.currentTime-time)<.015&&v.readyState>=2)return;await new Promise((res,rej)=>{const timer=setTimeout(()=>{cleanup();rej(Error('Video seek timed out. Try a shorter clip or another browser.'));},8000);const cleanup=()=>{clearTimeout(timer);v.removeEventListener('seeked',done);v.removeEventListener('error',fail);};const done=()=>{cleanup();res();},fail=()=>{cleanup();rej(Error('Video seek failed.'));};v.addEventListener('seeked',done);v.addEventListener('error',fail);v.currentTime=time;});}
// Separate video elements per clip support split clips and repeated source ranges.
async function makeSession(from, exporting=false, allowLoop=true){
 await audio();
 const destination=exporting?ctx.createMediaStreamDestination():ctx.destination;
 const master=ctx.createGain();master.gain.value=masterMuted?0:masterVolume;
 const masterMeter=ctx.createAnalyser();masterMeter.fftSize=256;master.connect(masterMeter).connect(destination);
 const meters=[];
 const gains=tracks.map(t=>{const gain=ctx.createGain(),meter=ctx.createAnalyser();meter.fftSize=256;gain.gain.value=t.muted?0:t.volume;gain.connect(meter).connect(master);meters.push(meter);return gain;});
 const items=[];
 const loop=allowLoop&&!exporting&&cycle.enabled?{start:cycle.start,end:cycle.end}:null;
 try{
  for(let ti=0;ti<tracks.length;ti++)for(const c of tracks[ti].clips){
   if(endOf(c)<= (loop?loop.start:from)||(loop&&c.start>=loop.end))continue;
   const source=sources.get(c.source),v=document.createElement('video');v.src=source.url;v.muted=true;v.playsInline=true;v.preload='auto';
   items.push({c,ti,s:source,v,active:false});await metadata(v);await prepareVideo(v,Math.min(c.out-.01,c.in+Math.max(0,(loop?Math.max(from,loop.start):from)-c.start)));
  }
 }catch(e){gains.forEach(n=>n.disconnect());meters.forEach(n=>n.disconnect());master.disconnect();masterMeter.disconnect();items.forEach(i=>{i.v.pause();i.v.removeAttribute('src');i.v.load();});if(exporting)destination.stream.getTracks().forEach(t=>t.stop());throw e;}
 return {from,epoch:0,items,gains,meters,master,masterMeter,nodes:[],destination,exporting,loop,scheduledCycle:0,nextBeat:0};
}
function scheduleCycle(s,index){
 const window=playbackWindow(s.from,s.loop,index);
 for(const {c,s:source,ti} of s.items){
  const start=Math.max(c.start,window.start),end=Math.min(endOf(c),window.end);
  if(end<=start)continue;
  const node=ctx.createBufferSource();node.buffer=source.buffer;node.connect(s.gains[ti]);
  node.start(s.epoch+window.at+start-window.start,c.in+start-c.start,end-start);s.nodes.push(node);
  node.onended=()=>{node.disconnect();const n=s.nodes.indexOf(node);if(n>=0)s.nodes.splice(n,1);};
 }
}
function launch(s,epoch){
 s.epoch=epoch;session=s;scheduleCycle(s,0);s.scheduledCycle=0;
 const beat=60/Number($('bpm').value);s.nextBeat=Math.ceil(s.from/beat)*beat-s.from;
 render();
}
function releaseSession(){if(!session)return;const s=session;session=null;disposePrepared(s);}
function disposePrepared(s){for(const n of s.nodes){try{n.stop();}catch{}n.disconnect();}s.gains.forEach(n=>n.disconnect());s.meters.forEach(n=>n.disconnect());s.master.disconnect();s.masterMeter.disconnect();s.items.forEach(i=>{i.v.pause();i.v.removeAttribute('src');i.v.load();});}

async function play(){if(session||recording||busy||measuring||preparing)return;if(!duration())return;if(cycle.enabled&&(position<cycle.start||position>=cycle.end))position=cycle.start;else if(!cycle.enabled&&position>=duration()-.01)position=0;preparing=true;const token=++operation;updateButtons();try{const s=await makeSession(position);if(token!==operation){disposePrepared(s);return;}launch(s,ctx.currentTime+.12);status('Playing · video follows the shared audio clock.');}finally{preparing=false;render();}}
async function seek(t){if(busy||recording||measuring||preparing)return;const resume=!!session;releaseSession();position=Math.max(0,Math.min(duration()||20,t));const scroller=document.querySelector('.timeline-scroll'),head=document.querySelector('.track-head');scroller.scrollLeft=Math.max(0,position*zoom()-(scroller.clientWidth-(head?.offsetWidth||246))*.5);updateTime();if(resume)await play();else await showStill();render();}
function sourcePreview(source,index){if(!source.previews[index]){const v=document.createElement('video');v.src=source.url;v.muted=true;v.playsInline=true;v.preload='auto';source.previews[index]=v;}return source.previews[index];}
async function showStill(){const all=[];for(let ti=0;ti<tracks.length;ti++)for(const c of tracks[ti].clips)if(position>=c.start&&position<endOf(c)){const s=sources.get(c.source);const v=sourcePreview(s,ti);all.push(metadata(v).then(()=>prepareVideo(v,c.in+position-c.start))); }await Promise.all(all);draw();}
function click(at,strong){const o=ctx.createOscillator(),gain=ctx.createGain();o.frequency.value=strong?1400:1000;gain.gain.setValueAtTime(.09,at);gain.gain.exponentialRampToValueAtTime(.0001,at+.035);o.connect(gain).connect(ctx.destination);o.start(at);o.stop(at+.04);o.onended=()=>{o.disconnect();gain.disconnect();};if(session)session.nodes.push(o);return o;}
function metronome(){
 if(!session||session.exporting||!$('metro').checked)return;
 const s=session,beat=60/Number($('bpm').value),now=ctx.currentTime,elapsed=Math.max(0,now-s.epoch),horizon=now+.12;
 let index=0;
 if(s.loop&&elapsed>=s.loop.end-s.from)index=1+Math.floor((elapsed-(s.loop.end-s.from))/(s.loop.end-s.loop.start));
 for(let n=index;n<index+4;n++){
  const window=playbackWindow(s.from,s.loop,n);if(s.epoch+window.at>horizon)break;
  const lower=Math.max(window.start,window.start+now-s.epoch-window.at);
  const upper=Math.min(window.end,window.start+horizon-s.epoch-window.at);
  for(let t=Math.ceil((lower-.000001)/beat)*beat;t<window.end-.000001&&t<=upper;t+=beat){
   const at=s.epoch+window.at+t-window.start;
   if(at>=now-.001&&at>(s.lastClickTime??-1)+.001){click(Math.max(at,now),Math.round(t/beat)%4===0);s.lastClickTime=at;}
  }
  if(!s.loop)break;
 }
}
function activeVideos(){const list=[];for(let ti=0;ti<tracks.length;ti++){let v;const item=session?.items.find(i=>i.ti===ti&&position>=i.c.start&&position<endOf(i.c));if(item)v=item.v;else if(!session){const c=tracks[ti].clips.find(c=>position>=c.start&&position<endOf(c));if(c)v=sourcePreview(sources.get(c.source),ti);}if(stream&&Number($('armed').value)===ti&&(recording||(!session&&!tracks[ti].clips.some(c=>position>=c.start&&position<endOf(c)))))v=$('camera');if(v)list.push({v,ti});}return list;}
function draw(){
 const W=canvas.width,H=canvas.height;g.fillStyle='#20242a';g.fillRect(0,0,W,H);
 const active=activeVideos(),rects=videoRects(active.length,W,H);
 active.forEach(({v},n)=>{const r=rects[n];if(v.readyState<2||!v.videoWidth)return;const scale=Math.min(r.width/v.videoWidth,r.height/v.videoHeight),w=v.videoWidth*scale,h=v.videoHeight*scale;g.drawImage(v,r.x+(r.width-w)/2,r.y+(r.height-h)/2,w,h);});
 if(!active.length){g.fillStyle='#788393';g.font=`${Math.round(W/65)}px sans-serif`;g.textAlign='center';g.fillText('v-daw / no active video',W/2,H/2);}
 $('monitorMode').textContent=active.length>1?`${active.length}-WAY SPLIT · ${active.map(({ti})=>`0${ti+1}`).join(' + ')}`:active.length===1?`FULL FRAME · TRACK 0${active[0].ti+1}`:'NO ACTIVE VIDEO';
 canvas.dataset.layout=active.length>1?`split-${active.length}`:active.length===1?'full':'empty';
}
function meterLevel(analyser){if(!analyser)return 0;analyser.getFloatTimeDomainData(meterSamples);let peak=0;for(const n of meterSamples)peak=Math.max(peak,Math.abs(n));return Math.max(0,Math.min(100,(20*Math.log10(peak||.00001)+60)/60*100));}
function updateMeters(){const ti=Number($('armed').value);const a=stream&&!session?.exporting?liveMeter?.meter:session?.meters[ti];$('trackMeter').style.height=`${meterLevel(a)}%`;$('masterMeter').style.height=`${meterLevel(session?.masterMeter)}%`;}
function frame(){
 if(session){
  const s=session,elapsed=Math.max(0,ctx.currentTime-s.epoch),old=position;position=loopPosition(elapsed,s.from,s.loop);
  if(s.loop){while(playbackWindow(s.from,s.loop,s.scheduledCycle+1).at<=elapsed+.4){s.scheduledCycle++;scheduleCycle(s,s.scheduledCycle);}}
  const wrapped=s.loop&&position<old-.01;
  for(const i of s.items){const active=ctx.currentTime>=s.epoch&&position>=i.c.start&&position<endOf(i.c);if(active){const target=i.c.in+position-i.c.start;if(!i.active){i.active=true;i.v.play().catch(e=>{if(session)stopAll(`Video playback failed: ${e.message}`);});}if((wrapped||Math.abs(i.v.currentTime-target)>.08)&&!i.v.seeking)i.v.currentTime=target;}else if(i.active){i.v.pause();i.active=false;}}
  metronome();updateTime();
  if(!s.loop&&position>=duration()&&!recording){if(s.exporting)finishExport();else{releaseSession();position=duration();render();status('Playback complete.');}}
 }
 draw();updateMeters();raf=requestAnimationFrame(frame);
}

function cancelCountIn(){if(!countIn)return;const c=countIn;countIn=null;clearInterval(c.timer);for(const n of c.nodes){try{n.stop();}catch{}n.disconnect();}c.resolve(false);$('countInLabel').textContent='2-bar count-in';$('record').classList.remove('counting');}
function waitCountIn(){
 return new Promise(resolve=>{
  const beat=60/Number($('bpm').value),epoch=ctx.currentTime+.12,nodes=[];
  for(let i=0;i<8;i++)nodes.push(click(epoch+i*beat,i%4===0));
  const state={resolve,nodes,timer:null};countIn=state;$('record').classList.add('counting');
  state.timer=setInterval(()=>{
   const elapsed=ctx.currentTime-epoch,n=Math.max(0,Math.min(7,Math.floor(elapsed/beat)));
   $('countInLabel').textContent=`COUNT IN · ${Math.floor(n/4)+1}/2 · ${n%4+1}/4`;
   if(elapsed>=countInSeconds(Number($('bpm').value))){clearInterval(state.timer);countIn=null;$('record').classList.remove('counting');$('countInLabel').textContent='2-bar count-in';resolve(true);}
  },20);
 });
}
async function record(){
 requireIdle();if(!stream||!mime())throw Error('Camera/audio recording is unavailable. Start engine in a supported browser.');
 await audio();await keepAwake();const ti=Number($('armed').value);
 if(cycle.enabled)position=cycle.start;
 else if(tracks[ti].clips.some(c=>position<endOf(c)))throw Error('Seek to the armed track’s end, choose an empty track, or enable cycle to replace a range.');
 preparing=true;const token=++operation;updateButtons();let s;
 try{
  s=await makeSession(position,false,true);
  // Existing material on the recording track must not double the live input.
  s.items.filter(i=>i.ti===ti).forEach(i=>{i.v.pause();i.v.removeAttribute('src');i.v.load();});s.items=s.items.filter(i=>i.ti!==ti);
  if(token!==operation){disposePrepared(s);return;}
  status('Count-in · two bars, then recording. Stop cancels.');
  if(!await waitCountIn()||token!==operation){disposePrepared(s);return;}
  const start=position,chunks=[],rec=new MediaRecorder(stream,{mimeType:mime()}),state={rec,ti,start,chunks,loop:s.loop,offset:Number($('offset').value)||0,started:0,stopped:null,stopping:false};
  recording=state;
  rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  rec.onerror=e=>stopAll(e.error?.message||'Recording failed.');
  rec.onstart=()=>{state.started=ctx.currentTime;if(state.stopping){disposePrepared(s);return;}launch(s,state.started);status(state.loop?'Cycle recording · latest pass replaces the recorded range. Original take is preserved.':'Recording linked audio + video.');};
  rec.onstop=()=>protect(async()=>{
   const elapsed=Math.max(0,(state.stopped??ctx.currentTime)-state.started);busy=true;recording=null;releaseSession();syncInputMonitor();updateButtons();
   try{
    const blob=new Blob(chunks,{type:rec.mimeType});offerDownload(blob,`v-daw-take-${ti+1}.${rec.mimeType.includes('mp4')?'mp4':'webm'}`,'Download original take');
    if(!state.started||elapsed<.05){status('Take too short. No region added.');return;}
    const id=await addSource(blob,`Take ${tracks[ti].clips.length+1}`,elapsed),src=sources.get(id);
    const parts=recordingSegments(Math.min(src.duration,elapsed),start,state.loop,state.offset);
    if(!parts.length)throw Error('Offset exceeds the take length. Original take is available below.');
    checkpoint();for(const part of parts){const c={id:uid(),source:id,...part};tracks[ti].clips=state.loop?replaceRange(tracks[ti].clips,c,uid):[...tracks[ti].clips,c];selected=c.id;}
    status(state.loop?'Cycle take ready · latest pass kept for each recorded interval. Undo restores the previous track; download the full original for all passes.':'Take ready. Linked offset applied; check A/V with a visible clap.');
   }finally{busy=false;syncInputMonitor();render();await showStill();}
  })();
  rec.start(250);
 }catch(e){recording=null;if(s)disposePrepared(s);throw e;}
 finally{preparing=false;render();}
}
function stopAll(message='Stopped.'){
 operation++;cancelCountIn();if(busy&&exportState){finishExport(true);return;}
 if(recording){recording.stopping=true;recording.stopped=ctx.currentTime;if(recording.rec.state!=='inactive')recording.rec.stop();}
 releaseSession();render();if(!recording)showStill().catch(e=>status(e.message,true));status(message);
}
function syncInputMonitor(){if(liveMeter&&ctx){const t=tracks[Number($('armed').value)];liveMeter.silent.gain.setTargetAtTime(stream&&$('inputMonitor').checked&&!document.hidden&&!busy&&!measuring?activeGain(t):0,ctx.currentTime,.01);}}
async function keepAwake(){
 if(!stream||document.hidden||wakeLock||wakePending)return;
 if(!navigator.wakeLock){$('wakeStatus').textContent='SCREEN LOCK UNSUPPORTED · use Auto-Lock: Never';return;}
 wakePending=true;
 try{const lock=await navigator.wakeLock.request('screen');if(!stream||document.hidden){await lock.release();return;}wakeLock=lock;$('wakeStatus').textContent='SCREEN STAYS ON';lock.addEventListener('release',()=>{if(wakeLock===lock){wakeLock=null;$('wakeStatus').textContent=stream?'SCREEN LOCK RELEASED · tap to retry':'SCREEN LOCK · ENGINE OFF';}});}
 catch{$('wakeStatus').textContent='SCREEN LOCK DENIED · tap to retry / disable Auto-Lock';}
 finally{wakePending=false;}
}
function releaseWake(){const lock=wakeLock;wakeLock=null;lock?.release().catch(()=>{});$('wakeStatus').textContent='SCREEN LOCK · ENGINE OFF';}
function stopEngine(){requireIdle();stream?.getTracks().forEach(t=>t.stop());stream=null;if(liveMeter){liveMeter.input.disconnect();liveMeter.meter.disconnect();liveMeter.silent.disconnect();liveMeter=null;}$('camera').srcObject=null;releaseWake();render();status('Engine stopped. Screen sleep restored.');}
let exportState=null;
function offerDownload(blob,name,label){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.textContent=label;$('downloads').append(a);}
async function exportVideo(){requireIdle();if(!duration())throw Error('Add a take first.');if(!canvas.captureStream||!exportMime())throw Error('MP4 H.264 + AAC export is unavailable in this browser. Try a current desktop Chrome or Safari.');busy=true;syncInputMonitor();updateButtons();status('Preparing real-time export…');let s,videoStream;try{s=await makeSession(0,true);videoStream=canvas.captureStream(30);const mix=new MediaStream([...videoStream.getVideoTracks(),...s.destination.stream.getAudioTracks()]);if(!mix.getVideoTracks().length)throw Error('Canvas did not provide a video track.');const rec=new MediaRecorder(mix,{mimeType:exportMime(),videoBitsPerSecond:8000000,audioBitsPerSecond:192000}),chunks=[];exportState={rec,s,videoStream,chunks,cancelled:false,previous:position};rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};rec.onerror=e=>{status(`Export failed: ${e.error?.message||'encoder error'}`,true);finishExport(true);};rec.onstop=()=>{const ex=exportState;if(!ex)return;releaseSession();videoStream.getTracks().forEach(t=>t.stop());s.destination.stream.getTracks().forEach(t=>t.stop());exportState=null;busy=false;syncInputMonitor();position=ex.previous;if(!ex.cancelled&&chunks.length){if(!rec.mimeType.toLowerCase().includes('mp4')){status('Encoder did not return MP4. Export rejected.',true);render();return;}offerDownload(new Blob(chunks,{type:rec.mimeType}),'v-daw-mix.mp4','Download MP4');status('MP4 ready · H.264 + AAC. Check the downloaded video before uploading.');}else status('Export cancelled.');render();showStill().catch(e=>status(e.message,true));};rec.onstart=()=>{position=0;launch(s,ctx.currentTime);status(`Exporting ${duration().toFixed(1)}s in real time. Keep the tab visible; click is excluded.`);};rec.start(500);}catch(e){videoStream?.getTracks().forEach(t=>t.stop());if(s)disposePrepared(s);s?.destination.stream.getTracks().forEach(t=>t.stop());exportState=null;busy=false;syncInputMonitor();render();throw e;}}
function finishExport(cancel=false){if(!exportState)return;exportState.cancelled ||= cancel;releaseSession();if(exportState.rec.state!=='inactive')exportState.rec.stop();}
async function calibrate(){requireIdle();if(!$('loopbackReady').checked)throw Error('Confirm the physical loopback setup first.');if(!stream)throw Error('Start the engine first.');await audio();if(!ctx.audioWorklet)throw Error('AudioWorklet is unavailable. Calibration is unsupported in this browser.');measuring=true;syncInputMonitor();updateButtons();status('Measuring three loopback pulses…');let input,node,silent;const tones=[];try{await ctx.audioWorklet.addModule('./capture-worklet.js');input=ctx.createMediaStreamSource(stream);node=new AudioWorkletNode(ctx,'loopback-capture');silent=ctx.createGain();silent.gain.value=0;input.connect(node).connect(silent).connect(ctx.destination);const rate=ctx.sampleRate,chirp=makeChirp(rate),base=Math.ceil((ctx.currentTime+.35)*rate),size=Math.ceil(rate*4),samples=new Float32Array(size),sent=[0,1,2].map(n=>base+Math.round(n*1.1*rate));node.port.onmessage=({data})=>{const start=data.frame-base;for(let j=0;j<data.samples.length;j++){const at=start+j;if(at>=0&&at<size)samples[at]=data.samples[j];}};for(const frame of sent){const buffer=ctx.createBuffer(1,chirp.length,rate);buffer.copyToChannel(chirp,0);const source=ctx.createBufferSource();source.buffer=buffer;source.connect(ctx.destination);source.start(frame/rate);tones.push(source);}await new Promise(r=>setTimeout(r,Math.max(0,((base+size)/rate-ctx.currentTime)*1000)+150));const results=sent.map(frame=>{const expected=frame-base,result=detectChirp(samples,chirp,expected+Math.round(rate*.001),expected+Math.round(rate*.8));return {...result,delay:result.index-expected};});measured={...summarizeLatency(results,rate),at:new Date().toISOString()};$('calibrationResult').textContent=`Round trip ${measured.ms.toFixed(1)} ms · spread ${measured.jitter.toFixed(1)} ms · match ${(measured.confidence*100).toFixed(0)}%. ${new Date().toLocaleTimeString()}. Not a camera/input-only measurement.`;status('Loopback measured. Remove cable and restore recording input. Offset stays unchanged until you explicitly apply an estimate.');}catch(e){measured=null;$('calibrationResult').textContent=`Measurement failed: ${e.message}`;throw e;}finally{tones.forEach(t=>{try{t.stop();}catch{}t.disconnect();});input?.disconnect();node?.disconnect();node?.port.close();silent?.disconnect();measuring=false;syncInputMonitor();render();}}
async function demo(){requireIdle();if(tracks.some(t=>t.clips.length))throw Error('Demo needs an empty session. Delete existing clips first.');if(!canvas.captureStream||!mime())throw Error('Demo generation requires canvas video recording. Import a supported video instead.');await audio();busy=true;updateButtons();status('Generating a real 4-second A/V demo…');const c=document.createElement('canvas');c.width=640;c.height=360;const d=c.getContext('2d'),vs=c.captureStream(24),dest=ctx.createMediaStreamDestination(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=220;gain.gain.value=.06;osc.connect(gain).connect(dest);osc.start();const rec=new MediaRecorder(new MediaStream([...vs.getVideoTracks(),...dest.stream.getAudioTracks()]),{mimeType:mime()}),chunks=[];let timer;try{const done=new Promise((res,rej)=>{rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};rec.onstop=res;rec.onerror=e=>rej(e.error||Error('Demo recorder failed.'));});const start=performance.now();timer=setInterval(()=>{const t=(performance.now()-start)/1000;d.fillStyle='#dce2d3';d.fillRect(0,0,640,360);d.fillStyle='#59654d';d.beginPath();d.arc(320+Math.sin(t*2)*150,180,48,0,Math.PI*2);d.fill();d.fillStyle='#283022';d.font='24px sans-serif';d.fillText(`v-daw / ${t.toFixed(2)}s`,24,42);},40);rec.start(250);await new Promise(r=>setTimeout(r,4000));rec.stop();await done;const blob=new Blob(chunks,{type:rec.mimeType});const id=await addSource(blob,'Studio demo',4);checkpoint();const out=Math.min(4,sources.get(id).duration);tracks.forEach((t,ti)=>t.clips.push({id:uid(),source:id,start:ti,in:0,out:Math.min(4-ti,out)}));selected=tracks[0].clips[0].id;position=0;await showStill();status(`Demo ready on ${tracks.length} linked tracks. Seek to 2.5s for three videos or 3.5s for four when those tracks are added before loading the demo.`);}finally{clearInterval(timer);osc.stop();osc.disconnect();gain.disconnect();vs.getTracks().forEach(t=>t.stop());dest.stream.getTracks().forEach(t=>t.stop());busy=false;render();}}
$('engine').onclick=protect(()=>stream?stopEngine():startEngine());$('inputMonitor').onchange=syncInputMonitor;$('wakeStatus').onclick=keepAwake;$('fullscreen').onclick=protect(async()=>{if(document.fullscreenElement){await document.exitFullscreen();return;}if(document.documentElement.requestFullscreen){try{await Promise.race([document.documentElement.requestFullscreen(),new Promise(resolve=>setTimeout(resolve,1500))]);if(document.fullscreenElement)return;}catch{}}$('fullscreenHelp').showModal();});$('applyDevices').onclick=protect(startEngine);$('settingsBtn').onclick=()=>{$('settings').showModal();};$('play').onclick=protect(play);$('record').onclick=protect(record);$('stop').onclick=()=>stopAll();$('home').onclick=protect(()=>seek(0));$('ruler').onclick=protect(e=>seek((e.clientX-$('ruler').getBoundingClientRect().left)/zoom()));$('ruler').onkeydown=protect(e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();return seek(e.key==='Home'?0:e.key==='End'?duration():position+(e.key==='ArrowRight'?1:-1)*(e.shiftKey?1:.1));}});$('zoom').oninput=render;$('audioTab').onclick=()=>{view='audio';document.body.dataset.view='audio';$('audioTab').setAttribute('aria-selected','true');$('videoTab').setAttribute('aria-selected','false');render();};$('videoTab').onclick=()=>{view='video';document.body.dataset.view='video';$('audioTab').setAttribute('aria-selected','false');$('videoTab').setAttribute('aria-selected','true');render();};$('split').onclick=protect(()=>{requireIdle();const x=getSelected();if(!x)return;const parts=splitClip(x.c,position,uid());checkpoint();x.t.clips.splice(x.t.clips.indexOf(x.c),1,...parts);selected=parts[1].id;render();showStill().catch(e=>status(e.message,true));});$('delete').onclick=protect(()=>{requireIdle();const x=getSelected();if(!x)return;checkpoint();x.t.clips.splice(x.t.clips.indexOf(x.c),1);selected=null;render();});$('undo').onclick=()=>{if(busy||session||recording||measuring||!history.length)return;history.pop().forEach((clips,i)=>tracks[i].clips=clips);selected=null;render();showStill().catch(e=>status(e.message,true));};$('trim').onclick=()=>{const x=getSelected();if(!x||session||recording||busy||preparing)return;$('trimIn').value=String(x.c.in);$('trimOut').value=String(x.c.out);$('trimDialog').showModal();};$('trimCancel').onclick=()=>$('trimDialog').close();$('trimForm').onsubmit=e=>{e.preventDefault();protect(()=>{requireIdle();const x=getSelected();if(!x)return;const c=trimClip(x.c,Number($('trimIn').value),Number($('trimOut').value));checkpoint();x.t.clips.splice(x.t.clips.indexOf(x.c),1,c);$('trimDialog').close();render();showStill().catch(e=>status(e.message,true));})();};$('import').onchange=protect(async e=>{try{await importFile(e.target.files[0]);}finally{e.target.value='';}});$('demo').onclick=protect(demo);$('export').onclick=protect(exportVideo);$('cancelExport').onclick=()=>finishExport(true);$('calibrate').onclick=protect(calibrate);$('useMeasured').onclick=()=>{if(measured){$('offset').value=measured.ms.toFixed(1);status('Using full round trip as a manual advance estimate for new takes. Verify with a clap; this can overcompensate input delay.');}};$('offset').onchange=()=>{$('offset').value=Math.min(1000,Math.max(0,Number($('offset').value)||0));};$('bpm').onchange=()=>{$('bpm').value=Math.min(260,Math.max(30,Number($('bpm').value)||120));render();};
$('addTrack').onclick=protect(addTrack);$('armed').onchange=()=>{syncInputMonitor();render();};
$('inspectorArm').onclick=()=>status(`Track 0${Number($('armed').value)+1} is armed. Use the other track’s R button to change the recording target.`);
$('inspectorMute').onclick=()=>{if(busy)return;const t=tracks[Number($('armed').value)];t.muted=!t.muted;syncGains();render();};
$('inspectorVolume').oninput=()=>{if(busy)return;tracks[Number($('armed').value)].volume=Number($('inspectorVolume').value);syncGains();document.querySelectorAll('.track-head input[type=range]')[Number($('armed').value)].value=$('inspectorVolume').value;};
$('masterVolume').oninput=()=>{if(busy)return;masterVolume=Number($('masterVolume').value);syncGains();};
$('masterMute').onclick=()=>{if(busy)return;masterMuted=!masterMuted;$('masterMute').setAttribute('aria-pressed',String(masterMuted));syncGains();};
$('loopToggle').onclick=()=>{if(locked())return;cycle.enabled=!cycle.enabled;renderCycle();status(cycle.enabled?'Cycle enabled for playback and recording. Drag the gold ruler to choose its range.':'Cycle off.');};
for(const id of ['loopStart','loopEnd'])$(id).onchange=protect(()=>{requireIdle();const start=Number($('loopStart').value),end=Number($('loopEnd').value);if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end-start<.1){renderCycle();throw Error('Loop range needs at least 0.1 seconds, starting at or after zero.');}cycle={start,end,enabled:true};render();});
$('cycleRuler').onpointerdown=event=>{
 if(locked())return;event.preventDefault();const ruler=$('cycleRuler'),rect=ruler.getBoundingClientRect(),time=e=>Math.max(0,Math.min((e.clientX-rect.left)/zoom(),rect.width/zoom()));
 const anchor=time(event),before={...cycle},edge=event.target.id;let moved=false;ruler.setPointerCapture(event.pointerId);
 ruler.onpointermove=e=>{const current=time(e);moved=true;if(edge==='loopStartHandle')cycle.start=Math.min(cycle.end-.1,current);else if(edge==='loopEndHandle')cycle.end=Math.max(cycle.start+.1,current);else{cycle.start=Math.min(anchor,current);cycle.end=Math.max(cycle.start+.1,Math.max(anchor,current));}cycle.enabled=true;renderCycle();};
 const finish=e=>{ruler.onpointermove=null;ruler.onpointerup=null;ruler.onpointercancel=null;if(ruler.hasPointerCapture(e.pointerId))ruler.releasePointerCapture(e.pointerId);if(e.type==='pointercancel'||!moved)cycle=before;render();};ruler.onpointerup=finish;ruler.onpointercancel=finish;
};
$('aspect').onchange=()=>{if(locked())return;const sizes={landscape:[1920,1080],portrait:[1080,1920],square:[1080,1080]};[canvas.width,canvas.height]=sizes[$('aspect').value];draw();};
document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'Exit full screen':'⛶';$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit full screen':'Full screen');if(document.fullscreenElement&&$('fullscreenHelp').open)$('fullscreenHelp').close();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(session||recording||preparing||exportState))stopAll('Tab hidden. Playback/recording stopped; export cancelled to avoid a silently broken result.');syncInputMonitor();if(!document.hidden)keepAwake();});navigator.mediaDevices?.addEventListener('devicechange',()=>{measured=null;$('useMeasured').disabled=true;$('offset').value=0;$('calibrationResult').textContent='Device list changed. Recalibrate the current route.';});window.addEventListener('beforeunload',e=>{if(sources.size||recording){e.preventDefault();e.returnValue='';}});$('capabilities').textContent=`Runtime checks — recording: ${mime()||'unavailable'}; canvas export: ${canvas.captureStream?'available (encoder still needs testing)':'unavailable'}; calibration: ${window.AudioWorkletNode?'available after engine start':'unavailable'}. Session is memory-only.`;setInterval(metronome,25);render();raf=requestAnimationFrame(frame);
