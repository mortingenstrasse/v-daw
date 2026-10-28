# Validation and acceptance checks

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

Camera/mic permission grant/denial, real camera recording, USB input routing/disconnect, camera/audio drift, physical loopback accuracy, direct monitoring, audible metronome precision, click exclusion by listening, real clap lip-sync, iOS Chrome/Safari, Android, external Firefox/Safari, Bluetooth, sleep/wake and long-session memory pressure. The detector was validated with synthetic signals only. GitHub Actions/Pages were not run: authenticated GitHub access was unavailable.

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
