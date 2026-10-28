import test from 'node:test';
import assert from 'node:assert/strict';
import {startCapture} from '../recorder.js';

class ImmediateRecorder {
  static isTypeSupported(type) { return type === 'good' || type === 'video/webm'; }
  constructor(stream, options = {}) {
    this.stream = stream;
    this.mimeType = options.mimeType || 'video/webm';
    this.state = 'inactive';
    this.startCalls = 0;
  }
  start() { this.startCalls += 1; this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.onstop?.(); }
}

test('resolves when MediaRecorder enters recording even without a start event', async () => {
  let started = 0;
  const rec = await startCapture({}, {
    Recorder: ImmediateRecorder,
    types: ['good'],
    timeoutMs: 50,
    onStart: () => { started += 1; }
  });
  assert.equal(rec.state, 'recording');
  assert.equal(rec.startCalls, 1);
  assert.equal(started, 1);
});

class DelayedStartRecorder extends ImmediateRecorder {
  start() {
    super.start();
    setTimeout(() => this.onstart?.(), 5);
  }
}

test('does not double-start when a delayed start event follows the synchronous state change', async () => {
  let started = 0;
  const rec = await startCapture({}, {
    Recorder: DelayedStartRecorder,
    types: ['good'],
    timeoutMs: 50,
    onStart: () => { started += 1; }
  });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(rec.state, 'recording');
  assert.equal(started, 1);
});

class FallbackRecorder extends ImmediateRecorder {
  start() {
    if (this.mimeType === 'bad') throw new Error('unsupported encoder');
    super.start();
  }
}

test('tries the next MIME type after a synchronous encoder start failure', async () => {
  let selected = '';
  const rec = await startCapture({}, {
    Recorder: FallbackRecorder,
    types: ['bad', 'good'],
    timeoutMs: 50,
    onStart: (_rec, info) => { selected = info.mimeType; }
  });
  assert.equal(rec.mimeType, 'good');
  assert.equal(selected, 'good');
});

test('forwards data after the recorder has entered recording', async () => {
  const chunks = [];
  const rec = await startCapture({}, {
    Recorder: ImmediateRecorder,
    types: ['good'],
    timeoutMs: 50,
    onData: event => chunks.push(event.data)
  });
  const payload = {size: 4};
  rec.ondataavailable({data: payload});
  assert.deepEqual(chunks, [payload]);
});

test('each attempted encoder gets its own capture clock origin',async()=>{
 let clock=0,info;
 await startCapture({}, {Recorder:FallbackRecorder,types:['bad','good'],onBeforeStart:()=>++clock,onStart:(_,value)=>info=value});
 assert.equal(info.requestedAt,2);
});
test('runtime encoder errors and final stop are delivered after synchronous start',async()=>{
 let error,stops=0;
 const rec=await startCapture({}, {Recorder:ImmediateRecorder,types:['good'],onError:e=>error=e,onStop:()=>stops++});
 rec.onerror({error:new Error('encoder initialization failed')});rec.stop();
 assert.match(error.message,/initialization/);assert.equal(stops,1);
});
test('pre-cancelled startup never starts a recorder',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(startCapture({}, {Recorder:ImmediateRecorder,types:['good'],signal:controller.signal}),{name:'AbortError'});
});
