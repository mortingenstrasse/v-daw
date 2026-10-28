// Capture and export have different requirements: prefer VP8/Opus for capture,
// while the final export remains H.264/AAC MP4. Support queries are only hints.
export function captureTypes(Recorder) {
 return ['video/webm;codecs=vp8,opus','video/webm',
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','']
  .filter(type=>!type||Recorder.isTypeSupported(type));
}
export async function startCapture(stream,{Recorder=globalThis.MediaRecorder,signal,onStart=()=>{},onBeforeStart=()=>undefined,onData=()=>{},onStop=()=>{},onError=()=>{},timeoutMs=5000,types=captureTypes(Recorder),recorderOptions={}}={}) {
 const errors=[];
 for(const type of types) {
  if(signal?.aborted)throw new DOMException('Recording cancelled.','AbortError');
 try {
   return await new Promise((resolve,reject)=>{
    let rec,started=false,settled=false,timer,requestedAt;
    const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);};
    const fail=error=>{
     if(settled)return;settled=true;cleanup();
     if(rec){rec.onstart=rec.ondataavailable=rec.onerror=rec.onstop=null;try{if(rec.state!=='inactive')rec.stop();}catch{}}
     reject(error);
    };
    const abort=()=>fail(new DOMException('Recording cancelled.','AbortError'));
    const markStarted=()=>{
     if(settled||!rec||rec.state==='inactive')return false;
     started=true;settled=true;cleanup();
     onStart(rec,{mimeType:rec.mimeType||type||'browser default',requestedAt});resolve(rec);return true;
    };
    try {
     rec=new Recorder(stream,{...recorderOptions,...(type?{mimeType:type}:{})});
     rec.ondataavailable=e=>{if(!started&&rec.state==='recording')markStarted();if(started)onData(e);};
     rec.onerror=e=>{const error=e.error||new Error(`Recorder encoder error (${type||'browser default'}; state ${rec?.state||'unknown'})`);if(started)onError(error);else fail(error);};
     rec.onstop=()=>{if(started)onStop();else fail(new Error('Encoder stopped before recording started'));};
     rec.onstart=()=>{markStarted();};
     signal?.addEventListener('abort',abort,{once:true});
     timer=setTimeout(()=>fail(new Error('Encoder start timed out')),timeoutMs);
     requestedAt=onBeforeStart();
     rec.start(250);
     // Several browsers change state synchronously but dispatch `start` later
     // (or omit it due to a browser bug). State is provisional: later encoder
     // errors still go to onError; it does not prove media was encoded.
     if(rec.state==='recording')markStarted();
    }catch(error){fail(error);}
   });
  } catch(error) {
   if(error.name==='AbortError')throw error;
   errors.push(`${type||'browser default'}: ${error.name}: ${error.message}`);
  }
 }
 throw new Error(`Recording could not start. ${errors.join(' | ')}`);
}
