# Revision 0.5.0 — 29 October 2026

- 37 automated tests pass. Added stereo/silence onset detection, 0/50/100% strength, source/timeline boundaries, collision and overlap handling, stable beat phase across scheduling windows and non-bar cycle wrapping.
- Synthetic rhythmic capture in in-app Chromium: 46 attacks detected; 60% quantize produced 47 linked regions in both Audio and Video views. Playback passed with no console errors. Undo restored one original region. Entire armed track at 100% also tested.
- Quantized export downloaded and verified: H.264 1080×1920 + AAC MP4, 22.271 s. FFmpeg decoded both streams without errors when retaining the source time base (-fps_mode passthrough -enc_time_base:v demux). Default output time-base rounding produced duplicate-DTS warnings; they were not source decode failures. Final microfade/metronome version also passed quantized playback with no browser errors.
- Transient detection is heuristic and not certified for arbitrary instruments. Physical iPhone timing and audible metronome stability require device testing; automated tests do not establish zero jitter.

# Review 0.4.3 — 28 October 2026

- Reviewed the supplied vdaw-fixed.zip against the deployed 0.4.0 and local 0.4.1 work. Retained direct input-to-gain monitoring with a parallel analyser, simultaneous capture/audio initialization, and synchronous recorder-state startup.
- Added safe cleanup for permission/audio initialization failure and an engine-start lock. Each codec attempt now records its own audio-clock origin immediately before start.
- 31 automated tests passed, including recording state, delayed event, sync codec fallback, runtime error forwarding, cancellation, device failure cleanup, linked editing, cycle mapping and calibration signal detection. JavaScript syntax checks passed.
- Independent in-app Chromium test with synthetic audio/video: engine start, 120 BPM two-bar count-in (4.205 s to native start event), cycle capture and linked clip finalization, playback, count-in cancellation without new clips, and MP4 export passed. No app console errors observed.
- Downloaded export verified with ffprobe: real MP4, H.264 1080×1920, AAC 48 kHz, duration 4.006 s.
- The synthetic source replaces hardware only in the unpublished test fixture. It does not measure physical input/output latency. No iPhone/EVO loopback or acoustic latency claim is made.
- Recorder state becoming recording is provisional. Async encoding failure can still follow; it is surfaced and finalized, not silently retried after transport has begun. Support queries are not an encoding guarantee.

## Earlier reports

# Validation and acceptance checks

## Submitted archive 0.4.2 — supplied test report (historical, not independent verification)

- `npm test`: **25/25 passed**, including four MediaRecorder lifecycle tests for synchronous recording state, delayed or missing `start` events, MIME fallback after encoder startup failure, and chunk forwarding.
- JavaScript syntax checks passed for `app.js`, `recorder.js` and `model.js`; `/manus-routes.json` returned HTTP 200 with the root route.
- Browser preview with the temporary synthetic camera/microphone fixture from the source archive started the engine, completed the two-bar count-in, entered `Recording linked audio + video · video/webm;codecs=vp8,opus`, and finalized a linked A/V take with a downloadable original. The fixture was removed from the production HTML and repository so real devices are never replaced by synthetic media. QA reported recorder start **4.22s after Record** at 120 BPM, consistent with the 4.00s count-in plus startup margin.
- The browser console remained free of errors during the demo, synthetic capture and finalization run. Physical iPhone routing, Bluetooth, camera latency and native MP4 support remain hardware/browser-specific checks.

## Revision 0.4 — mobile capture workflow

- `npm test`: 21/21 passed, including two-bar duration, repeated/partial loop placement, offset handling and preservation of material outside replaced ranges.
- Browser QA used real MediaRecorder/AudioContext/canvas capture with a **synthetic input fixture**, not the user's physical camera/microphone. This fixture stays under `work/`, is not in the repository and is never deployed.
- At 120 BPM, recording started 4.18s after Record (4s count-in + setup/event margin). Stop during a second count-in cancelled without starting the recorder.
- A 42.59s continuous capture cycled through 0–4s. Final linked regions covered 0–2.57s from the latest partial pass and 2.57–4s from the preceding pass. No timeline growth beyond cycle Out. Original continuous take was downloadable.
- The resulting cycle mix exported successfully as native MP4 at the default 1080×1920 canvas. Export ran for 4.01s, ignoring cycle repeats. Physical output/device codec compatibility remains untested.
- Screen wake lock was granted in preview and released by Stop engine. This does **not** verify iPhone auto-lock, low-power behavior or Home Screen installation.
- At 390×844, document/client widths both 390; after 311px vertical scroll, transport top remained 0. Audio tab preview computed display was `none`; Video tab showed the portrait preview.
- No browser console warnings/errors in the capture/export run. In-app browser did not confirm native Fullscreen; fallback instructions cover unsupported/rejected requests. Actual iPhone installation/fullscreen and audible input monitoring must be verified on hardware.

### Phone acceptance checks

1. Reload the updated HTTPS site. Use headphones; Start engine. Confirm input monitor is on and the armed input is audible; toggle it off/on and adjust that track's volume/mute. Disable software monitoring when using hardware direct monitoring. Check that export excludes live input and the metronome.
2. Verify **SCREEN STAYS ON**, leave the visible app untouched longer than the phone's Auto-Lock period. Lock/background deliberately: transport stops; foregrounding retries the wake lock. Low-power/rejection must show the warning. Stop engine should release the lock and devices.
3. Tap ⛶. If native fullscreen is unavailable, follow Share → Add to Home Screen → Open as Web App. Download existing takes first; launch from icon and verify browser bars are absent. No offline/background recording is promised.
4. Record at 60/120 BPM: hear exactly eight pre-roll clicks; no take during count-in. Stop mid-count-in should leave no new region. Test interruptions during count-in too.
5. Set cycle 2–6s; record for several passes then stop mid-pass. Position must wrap; the latest performed portion replaces earlier material, with no region outside the cycle. Download the full original, then Undo to restore pre-recording material. Confirm linked audio/video boundaries and playback/export across the partial-pass join.
6. Audio tab has no monitor; Video tab has live camera when the armed position is empty and during recording. Default export is 9:16. Verify full-frame/2/3/4-way layouts, portrait MP4 import to the target social app, sticky mobile transport while scrolling, and landscape orientation.

## Revision 0.3 — four tracks

- 15/15 model tests pass, including four independent track objects, rejection beyond the limit, and exact three/four-video tile geometry in landscape, square and portrait.
- Browser add-track test: started with two, added track 03 then 04, recording target and selector followed each addition, and Add track was disabled at 4/4.
- Browser seek at 2.5s showed 3-WAY SPLIT (01+02+03); at 3.5s showed 4-WAY SPLIT (01+02+03+04), including lazy-loaded preview elements for the added tracks. No console errors were observed.
- Deployment status must be confirmed from the Pages run and HTTP endpoint; a supplied workflow alone is not a deployment claim.


## Revision 0.2 — white DAW / loop / MP4

- 12/12 automated model tests pass. New cases cover partial-first-pass cycle wrapping and gap-free scheduling, full-frame versus split rectangles in landscape/portrait, and strict AVC/AAC MP4 selection with no WebM relabeling.
- Desktop browser: red R arming updates the track header, channel strip, selector and transport target together.
- Audio-tab right-edge drag shortened the first take from approximately 3.95 to 3.45s. Video-tab left-edge drag then shortened it to 0.25–3.45s; Split at 2s produced 0.25–2s and 2–3.45s paired regions.
- Dragging the gold ruler selected 0.50–2.50s, enabled cycling, and playback remained in that interval across many repeats without console errors. Audio continuity at cycle seams still requires an acoustic/null test on target hardware.
- Preview at the start showed FULL FRAME for one active clip; at 2s it showed SPLIT VIEW for the two overlapping tracks. At a 390px viewport the document had clientWidth/scrollWidth 390/390; timeline content was 1470px inside its own 390px scroll area, with no horizontal page overflow.
- Final MP4 export uses the complete timeline even with cycle enabled. The downloaded 9:16 file was inspected with ffprobe: real MP4/isom container, H.264 Baseline 1080×1920, 4:2:0 pixels, AAC-LC stereo 44.1 kHz, 4.099s, 258,177 bytes. FFmpeg decoded both streams without errors; audio was non-silent (mean −29.2 dBFS / peak −24.3 dBFS). Frames sampled at 0.6s and 2.2s confirmed single-video full-canvas allocation and two-video top/bottom split. Source aspect ratios remain letterboxed. Actual social-platform uploads were not performed.

## Earlier 0.1 evidence (historical WebM exporter)


Delivery checks: 28 October 2026. No physical USB/camera calibration or iOS certification is claimed.

## Performed

- `node --check app.js` passed; `npm test`: **8/8 passed** (0.1; current suite is 12/12). Covers linked split boundaries/identity, invalid splits, trim placement/validation, offset pre-roll at zero, two-track duration, chirp recovery at 44.1/48 kHz with noise/inverted polarity, rejected silence and unstable latency.
- Local preview returned HTTP **200**.
- Desktop in-app Chromium generated real local demo A/V and loaded it on both tracks.
- Browser UI: trim from source 0.5 to 3 seconds, playback to end, ruler seek to 2 seconds, linked split in Video tab, delete/undo restoration, and track mute toggling worked.
- Final-source build re-imported the generated mix, decoded its audio, split at 2 seconds and played from that boundary. Export completed again with no console errors; cancelling a subsequent export reported cancellation and added no new mix download.
- Mixed export produced a **248,847-byte WebM**. `ffprobe` found **VP8 960×540 video** and **Opus 48 kHz stereo audio**. FFmpeg decoded it successfully with non-silent audio (mean −26.9 dBFS, peak −21.4 dBFS); decoded duration approximately 4.04 seconds for a 4-second timeline. WebM had no finite duration header; some players may show unknown duration. The app re-imported it using decoded audio duration.
- No console errors/warnings observed during demo/edit/play/export checks.
- **390×844 responsive viewport**: body measured 390 px; studio and arrange both approximately 356.8 px. Layout reflowed to one column; the timeline intentionally scrolls horizontally. This is desktop viewport testing, not an iPhone test.

## Not verified on actual devices

Camera/mic permission grant/denial, real camera recording, USB input routing/disconnect, camera/audio drift, physical loopback accuracy, direct monitoring, audible metronome precision, click exclusion by listening, real clap lip-sync, iOS Chrome/Safari, Android, external Firefox/Safari, Bluetooth, sleep/wake and long-session memory pressure. The detector was validated with synthetic signals only. This was the initial delivery limitation; GitHub Pages was subsequently enabled and v0.3 deployed successfully from main/root. No custom Actions workflow is required.

## Repeatable acceptance checklist

### No hardware needed

1. Serve the app and load demo. Verify clips at 0 and 1 seconds, paired A/V, and side-by-side monitor slots.
2. Select the first clip. Focus the ruler; Home, then Shift+Right twice seeks to 2 seconds. Split. Audio and Video tabs must show identical contiguous boundaries.
3. Trim the right part to a narrower source range. Retained content should keep its absolute timeline location. Reversed, expanded and too-short trims must fail.
4. Delete/undo and verify restoration. Play through boundaries and gaps. Mute/change gain during playback; verify expected sound and unchanged video visibility.
5. Enable Click, compare 60 and 120 BPM, and listen for the accent. Click must not be present in an exported file.
6. Export in the foreground, download and play the file in another player. Verify both videos, boundaries, gaps, mute/gain, audio presence and A/V timing. Check that container matches extension.
7. Export and Cancel: no completed new mix. Export and hide tab: cancellation instead of a claimed good render. Keep screen awake for normal recording/export.
8. Re-import the mix. Verify decode/playback. A file without decodable audio should produce a clear error.
9. Check 390, 768 and desktop widths: reachable controls and horizontally scrollable timeline.

### Interface/camera acceptance

1. On HTTPS/localhost, start engine and grant camera/mic. Check named devices and reported audio settings. Separately deny permission and verify a clear, recoverable error.
2. Select USB interface input and reconnect. Verify the intended physical input is actually captured; OS/browser/interface determine available routes and channels.
3. Record a visible clap on track 01; stop and download the original. Play/export and inspect A/V alignment. Overdub track 02 while hearing track 01 through headphones/direct monitor. Record actual timing error instead of assuming perfect sync.
4. Stop. Disable hardware direct monitoring, disconnect speakers, lower output, connect compatible physical line output to line input, and confirm the setup checkbox. Run calibration three times; log median/spread and compare with independent measurement if available.
5. Disconnect cable and retry: no reliable signal must fail. Safely vary levels; unreliable correlations must be rejected. No fabricated latency value should appear.
6. Remove cable; restore recording route. Set an explicit manual estimate. New linked takes should advance by that amount, trim negative pre-roll at zero and leave old takes untouched. Full RTT can overcompensate: validate with known click/clap and adjust.
7. Reconnect/change devices and confirm invalidation/reset. OS output route changes may require manual recalibration even without an event. Disconnect during capture and verify stop/finalized-take recovery.
8. Test the actual iOS Chrome phone/interface/adapter. Log OS/browser version, available inputs, selected MIME type, AudioWorklet availability, import and played-back export. A responsive UI or reported API alone is not evidence that recording/export works on that device.
