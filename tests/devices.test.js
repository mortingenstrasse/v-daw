import test from 'node:test';
import assert from 'node:assert/strict';
import {openDevices} from '../devices.js';
test('permission rejection is surfaced',async()=>{await assert.rejects(openDevices(()=>Promise.reject(new Error('denied')),()=>Promise.resolve()),/denied/);});
test('audio failure releases a late granted stream',async()=>{let stopped=0;await assert.rejects(openDevices(()=>new Promise(resolve=>setTimeout(()=>resolve({getTracks:()=>[{stop:()=>stopped++}]}),5)),()=>Promise.reject(new Error('audio failed'))),/audio failed/);assert.equal(stopped,1);});
test('working stream is retained',async()=>{const stream={};assert.equal(await openDevices(()=>stream,()=>{}),stream);});
