class LoopbackCapture extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const channel=inputs[0]?.[0];
    if(channel) {const copy=new Float32Array(channel);this.port.postMessage({frame:currentFrame,samples:copy},[copy.buffer]);}
    // Output remains silent: never feed loopback input back to speakers.
    return true;
  }
}
registerProcessor('loopback-capture',LoopbackCapture);
