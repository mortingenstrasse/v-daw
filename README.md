# v-daw · 0.4

A buildless, local-first, up-to-four-track audio/video studio with a white Logic-inspired arrangement, transport LCD, track headers and channel strips. Plain HTML, CSS and ES modules; no application libraries, server backend, analytics, accounts, uploads or mastering effects.

## Run

Use Python 3 for a static development server:

```sh
cd v-daw
python3 -m http.server 3000 --bind 0.0.0.0
```

Open http://127.0.0.1:3000 in a modern desktop browser. `npm start` runs the same server. Node 20+ is only needed for `npm test`; there are no npm dependencies to install. Do not open `index.html` with `file://` (modules, permissions and AudioWorklet require a proper origin). Camera/microphone need HTTPS or localhost. For a real phone use HTTPS hosting, such as Pages; an HTTP LAN address is insufficient.

## Use

1. Start with two tracks. **Add track** sits beneath the last track and adds/arms one linked track at a time, up to four; it is disabled during transport and at the four-track limit. Each track has its own mute, volume, recording target and linked edits. Default gain is 25% per track for four-track mixing headroom. **Load demo** generates four-second A/V locally and fills all currently added tracks, entering at 0/1/2/3s so you can inspect each split count. Or **Import video** into the armed track. Imports append after existing material or at the playhead. Video must contain decodable audio.
2. **Start engine** requests camera + microphone. Choose the interface/USB audio input and camera in **Studio settings**, then reconnect. Output follows OS routing. Input monitoring starts enabled and follows the armed track and Stereo Out gains/mutes. Use headphones to avoid feedback. Turn Input monitor off if using interface direct monitoring; browser monitoring has unavoidable latency.
3. Press a track's **R** button to arm it. Its header turns pale red, **R** becomes solid red, **ARMED — RECORDS HERE** appears, and the transport/inspector display the exact record target. There is exactly one armed track. The **Record to** selector changes the same state. Record one camera + selected input into one armed track at a time; overdub on another track. Record first plays **two bars / eight beats** at the selected BPM (even if the ongoing metronome is off). Stop cancels count-in. The recorder starts immediately after the count-in against a captured AudioContext timestamp; delayed or missing browser `start` events no longer block the take.
4. The ruler is in **bars and beats**, in 4/4 at the chosen BPM. Click to seek; keyboard arrows seek 0.1s, Shift+Arrow seeks 1s; Home/End jump. Select a region and **Split** at the playhead. Drag either region edge inward to shorten it, or use **Trim** for exact source times. Audio and Video tabs always edit the same linked source/range. Edge drag trims within the current range; Undo restores removed material. Video filmstrips repeat a representative source thumbnail, not a frame-accurate thumbnail cache.
5. Drag the **gold cycle ruler** above the bar ruler to select any playback loop; drag its end handles to adjust. Numeric **In/Out** fields are seconds and enable the cycle. The transport **⟳** toggles it. Minimum range is 0.1s. Audio is scheduled against the same clock across cycles; video seeks on wrap and can show frame-level discontinuities. Stop before editing a cycle. **Cycle recording starts at cycle In and wraps.** One continuous source records all passes; the last performed interval replaces earlier material in that interval, keeping the unaffected remainder and material outside the cycle. Stop finalizes the linked regions. Undo restores the entire previous track state; download the original take for every pass. It is not a take-lane/comping system. Recording offset skips pre-roll once at the cycle start; it is not reapplied on every wrap. Export ignores cycle and uses the full timeline, including gaps.
6. **M** mutes a track's sound; its video stays visible. Track volume and the **Stereo Out** fader/mute apply to playback and export. Meters show actual audio amplitude. No FX, compressor or limiter is added; excessive summed gain can clip. Metronome is monitoring-only and is not exported.
7. In the monitor and export, **one active video uses the full canvas**, **two active videos split the canvas**. Landscape/square split side by side; portrait splits top/bottom. Three active videos use two equal tiles on top and one centered below; four use a 2×2 grid. Only currently active clips occupy tiles, in track order, so tracks 01+04 also make a two-way view with accurate labels. The same layout is used in playback, paused preview and MP4 export. Gaps display a neutral slate. Aspect is preserved with letterboxing; no automatic destructive crop. Layout is based on clips active at the playhead, independent of audio mute or tab choice.
8. The default is **9:16 portrait, 1080×1920**, including the camera’s requested aspect ratio (hardware may ignore it). The monitor is shown only in the Video tab; Audio keeps the session/import/export controls. Choose **16:9 1920×1080** for landscape, **9:16 1080×1920** for Reels/Shorts/TikTok, or **1:1 1080×1080**. **Export MP4** records the complete mix in real time at nominal 30fps, requested 8Mbps video / 192kbps audio. It requires native **H.264 + AAC in an MP4 container**. No WebM rename/fallback is used for the final mix. Actual platform acceptance still depends on file duration/size and the destination service; a file is not uploaded automatically.
9. **Start engine** requests a Screen Wake Lock; the status reads **SCREEN STAYS ON** only while held. **Stop engine** releases camera, input and wake lock. Return to the visible app retries the lock, and the status button retries manually. Low power, browser/OS policy or API absence can prevent/release it; the app reports this instead of promising forced wakefulness. If refused, temporarily use the phone’s Auto-Lock → Never setting. Stay foregrounded. Hiding the tab stops playback/recording and cancels export. Cancel discards the incomplete mix. Source takes/demo can use a browser-supported fallback recording format where native MP4 is unavailable, but the final MP4 export is disabled in that case with an explanation.

**Full screen:** use the ⛶ button where the document Fullscreen API is supported. On iPhone, its fallback explains Share → Add to Home Screen → Open as Web App; launch the icon for a standalone window without browser bars. A manifest and icons are included; there is no offline cache/service worker. Download existing takes before changing windows because sessions do not transfer. iPhone wake lock/fullscreen behavior still requires device testing. The transport is sticky while the arrangement scrolls.

The whole session, edit history and media stay in RAM until the tab is closed/reloaded. No project-save format or crash recovery exists. Download original takes and finished mixes. Long takes can exhaust memory: the MVP decodes all audio, retains originals and creates video elements per clip during playback. It is intended for short sessions.

## Calibration: what is actually measured

Studio settings contains the reusable physical-loopback workflow. Stop transport, turn hardware direct monitoring **off**, disconnect speakers, select the intended input, and route a low-level compatible output physically into a **line input**. Start at low volume; do not connect a headphone/line output to a phantom-powered mic input. Select the OS output route before measuring. A setup checkbox must be confirmed.

The engine sends three 35 ms windowed chirps spaced 1.1 seconds apart. An AudioWorklet timestamps the captured input using the audio render clock. A normalized matched filter searches 1–800 ms after each scheduled pulse. It tolerates inverted polarity, requires a correlation score of at least 0.55 for every pulse, and rejects a spread above 12 ms. The UI reports median round trip, spread and match confidence. No signal or inconsistent timing is a failed measurement, never a fabricated success. This is an estimate through the browser/OS/interface graph, not a certified acoustic test; filtering, sample-rate conversion, crosstalk, clock behavior or route choice can bias it.

Remove the cable and restore recording routing afterward. Reconnect/device-list changes invalidate the displayed estimate and reset the recording offset. Recalibrate after a route/device change. OS output-route changes may not fire `devicechange`; the user must invalidate/recheck their setup. Battery and thermal state can affect timing, but a low battery is not by itself a known fixed delay.

**The round trip is not the separate input delay.** It includes playback and capture processing. It does not measure camera latency, isolate converter delays, remove hardware latency, or guarantee zero-latency monitoring. `AudioContext.baseLatency` likewise is not a substitute for a physical round-trip measurement.

Compensation defaults to **0 ms**, not half or all of the measured round trip. The user may explicitly choose **Use measured round trip as estimate**, or enter a manual advance. This shifts only **new linked takes** earlier by the entered amount. At timeline zero, source pre-roll is trimmed instead of creating a negative start. A full round-trip estimate can overcompensate; verify timing with a visible clap/known click and adjust. Audio and video shift together to preserve their existing relationship; no automatic lip-sync correction is performed. Existing clips are never silently moved.

## Synchronization and browser limits

A camera track and chosen audio track are recorded together with one MediaRecorder. The browser supplies their timestamps, so hardware camera latency, encoder startup and drift can remain. Capture placement uses the AudioContext timestamp captured immediately before the successful `MediaRecorder.start()` call; it is not a sample-accurate capture timestamp. Device processing constraints are requested off, but a browser can ignore them; the settings UI reports the returned values.

Playback schedules decoded audio buffers against one AudioContext clock. Muted video elements use the same clip in/out and timeline positions, start at clip boundaries, seek at cycle wraps, and correct drift exceeding 80 ms on animation frames. This is best-effort frame synchronization, **not** a professional sample-accurate video engine. Frames may be dropped/frozen during seeking, CPU pressure or thermal throttling. Export uses the same timeline, automatic full/split composition and mixer (cycle ignored), not a faster offline renderer; allow a frame of boundary tolerance plus encoder delay and visually verify the result.

| Platform / feature | MVP behavior |
| --- | --- |
| Desktop Chromium | Primary intended target. Runtime-tested in the desktop in-app Chromium preview; not a full external Chrome/Edge certification. |
| Safari, Firefox, Android | API/codec-gated; not physically tested in this delivery. Import audio decoding and encoder support differ. |
| iOS Chrome | **Not device-tested.** Do not infer desktop Chrome capabilities from the brand. Depending on engine/OS, camera permissions, USB input enumeration/routing, background policy, AudioWorklet, canvas capture and MediaRecorder codecs can differ. Safari may be worth trying if a capability fails. No iOS export or external USB routing guarantee. |
| Missing camera/permission | Engine reports failure. Demo/import can still work if their APIs exist. |
| Missing AudioWorklet | Calibration unavailable; manual offset remains available. |
| Missing canvas capture or explicit H.264/AAC MP4 recording | Final export disabled with an explanation. No WebM is silently substituted. Advertised support can still fail at recorder creation/runtime. |
| Bluetooth | No reliable low-latency promise. Prefer a wired interface; changes can invalidate calibration. |
| Backgrounding / screen lock | Unsupported for reliable media work. Tab hiding stops transport/recording and cancels export. |
| Secure context | Required for capture; use HTTPS or localhost. |

No support for region dragging/moving, snapping, ripple editing, independent A/V offsets, more than four tracks, per-channel interface routing, live FX, offline transcoding, adaptive clock resampling, project persistence or collaborative sessions. Region edge dragging and playback cycling are supported.

Primary API references: [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder), [canvas capture track](https://developer.mozilla.org/en-US/docs/Web/API/CanvasCaptureMediaStreamTrack), [baseLatency](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/baseLatency), and [WebKit MediaRecorder background](https://webkit.org/blog/11353/mediarecorder-api/). Runtime checks take precedence over historical codec lists.

## GitHub Pages

Repository: https://github.com/mortingenstrasse/v-daw. This folder is the static repository root.

In repository **Settings → Pages**, choose **Deploy from a branch**, then **main / (root)**. Push updates to `main`; GitHub's built-in Pages deployment publishes the static app. No custom workflow or server-side secrets are required. Run `npm test` before pushing.

The expected site is https://mortingenstrasse.github.io/v-daw/ ; confirm successful deployment before sharing it as live. Open it over HTTPS and repeat device/export tests. All application references are relative for repository-subpath hosting.

## Files and tests

- `index.html`, `style.css`: responsive interface and dialogs.
- `app.js`: media/device lifecycle, transport, editing, mixing, export, calibration and demo.
- `model.js`: linked edit math, placement, cycle clock/scheduling, adaptive video rectangles, strict MP4 codec selection and signal detection.
- `capture-worklet.js`: timestamped, silent loopback input tap.
- `tests/model.test.js`: deterministic model and detector tests; `npm test`.
- `TESTING.md`: delivery evidence and repeatable manual acceptance checks.
- `.nojekyll`: plain static GitHub Pages hosting.
- `manifest.webmanifest`, `icon-192.png`, `icon-512.png`: Home Screen standalone launch.

Platform references: [WebKit Home Screen web apps](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) and [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API). Wake lock can be revoked; it never authorizes background recording.

No third-party runtime code or assets are bundled. Hosting serves application code; captured/imported media is never sent to a server by this app.

## 0.4.3 review of supplied fix

Monitoring uses MediaStreamSource → gain → destination; the analyser is a separate branch. Capture and audio activation are requested together. The browser is asked for low input latency, not forced to deliver zero latency. Moving the analyser does not itself prove a latency reduction: the Web Audio specification describes its audio pass-through. Physical before/after loopback measurements with identical device routing are still required. Calibration compensation moves new clips and does not accelerate live monitoring.

Recorder startup follows its synchronous recording state so delayed start events do not stall transport. The state does not certify encoder success: subsequent errors remain visible. Codec fallback applies to failures before startup is accepted. Device startup failures release granted tracks, and duplicate engine starts are locked out.

See TESTING.md for independently repeated 0.4.3 checks. Third-party hosting files from the supplied archive are not required for GitHub Pages and are not included.

## 0.5.1 — internal audio quantize and camera discovery

Select a region and open **Audio quantize**. Choose selected region or entire armed track, grid and strength. Each region remains one timeline object. An immutable internal audio map schedules attacks and displays their waveform; the original video remains continuous at its original source timing. Video preparation scales with region count, not detected attack count. Playback/export use the same map. Reopening and changing strength recalculates from original audio; 0% removes the map. Trim/split and Undo preserve the internal edit correctly. Audio edits can change the alignment between sound and visible playing gestures. Percussive attacks work best; sustained notes can still be shortened or leave audio gaps. This is not time stretching.

Camera selection includes every video input exposed by enumerateDevices. Settings opening and devicechange refresh the list. **Allow camera access / Refresh devices** requests temporary video permission when the engine is off, lists devices and releases the temporary stream. Select a device and Reconnect to use it. There is no front-camera filter or requested camera aspect/resolution; export dimensions remain independently selectable. macOS/browser permissions and Continuity Camera discovery determine whether iPhone is exposed. A web page cannot list devices withheld by the browser. Physical iPhone discovery was not tested.

Metronome uses the audio clock and a 250 ms scheduling horizon. Long browser/main-thread stalls can still disrupt real-time work.
