// Start both requests in the user gesture, observe both failures immediately,
// and release a granted stream if the audio engine cannot start.
export async function openDevices(getStream,resumeAudio){
 const [capture,audio]=await Promise.allSettled([
  Promise.resolve().then(getStream),Promise.resolve().then(resumeAudio)
 ]);
 if(audio.status==='rejected'&&capture.status==='fulfilled')capture.value.getTracks().forEach(track=>track.stop());
 if(capture.status==='rejected')throw capture.reason;
 if(audio.status==='rejected')throw audio.reason;
 return capture.value;
}
