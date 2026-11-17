# Zwift-protocol trainers: sending a gear ratio directly

Research notes for a later trainer check page experiment. Public sources only, read 17 Nov 2026.
Each detail is marked **Confirmed** (seen in source code or an authoritative write-up, ideally two or more) or **Guess** (inferred, one source, or unclear).
No code was copied from GPL projects. The bytes below are protocol facts recomputed by hand.

## Sources

| Key | Source |
|---|---|
| QZ | github.com/cagnulein/qdomyos-zwift @ `d1503300a8` (16 Nov 2026). Files: `src/devices/ftmsbike/ftmsbike.cpp` (`zwiftPlayInit`, `update`, `sendZwiftPlayInclination`), `src/android/src/ZwiftHubBike.java`, `src/devices/zwifthubbike/Zwift hub.proto`, `src/ios/virtualbike_zwift.swift` (Zwift Hub emulator, `handleZwiftGear`), `src/ios/BLEPeripheralManager.swift`, `src/zwift_play/zapBleUuids.h`, `src/wheelcircumference.h`, `src/qzsettings.h`. PR #4292 (9 Feb 2026), PR #2961 "Victory Dircon" (30 Dec 2024) |
| INC | github.com/incyclist/devices @ `07e0035023` (10 Nov 2026). `src/ble/zwift/play/sensor.ts`, `src/ble/fm/adapter.ts`, `src/ble/fm/sensor.ts`, `src/ble/fm/consts.ts`, `src/ble/base/interface.ts`, `src/modes/antble-smarttrainer.ts` |
| KE | github.com/csanz91/kickr_esp32 @ `d32898c0ea` (Feb 2025). `kickr_constants.h`, `kickr_protocol.cpp`. Tested on KICKR CORE firmware 1.5.36 |
| WC | github.com/BrianBland/wattcade @ `d992523e15`. `src/devices/zwiftTrainer/codec.ts`, `native.ts`, `NOTES.md` (Web Bluetooth, untested on hardware per its notes) |
| VC | github.com/pymmog/virtual-cog @ `1e75f4b8a1`. `VirtualCog/Devices/Kickr/KickrZwiftClient.swift`, `Devices/Shared/BleUUIDs.swift` |
| MAK1 | makinolo.com/blog/2024/10/20/zwift-trainer-protocol/ (20 Oct 2024) |
| MAK2 | makinolo.com/blog/2024/07/26/zwift-ride-protocol/ (26 Jul 2024, updated 31 Jan 2025) |
| MT | github.com/MaximumTrainer/MaximumTrainer_Redux @ `45121f64b0`, `notes/zwift-cog-protocol-findings.md`. Hands-on with a **JetBlack Victory, fw 4.29** |
| RID | github.com/ridrs/ridrs.app @ `751cfbc1f9`, `docs/decisions/0057-trainer-side-virtual-shifting-findings.md` (summarises SHIFTR, virtual-cog and Wahoo support) |
| ZI | zwiftinsider.com/hub-fw-5-2-2/ and zwiftinsider.com/direto-volt-d100-virtual-shifting ; dcrainmaker.com/2025/02/rouvy-adds-zwift-cog-click-ride-virtual-shifting-battle-royale-begins.html |

## 1. Which trainers, and how to detect them

- Zwift Hub (Classic and One), Wahoo KICKR CORE (fw 1.3.17 or later), JetBlack Victory expose the Zwift trainer service. **Confirmed** (MAK1 lists Hub One, Victory, KICKR CORE; RID cites Wahoo for KICKR CORE 1.3.17; KE tested a KICKR CORE; MT probed a Victory). MAK1 only tested the KICKR CORE itself.
- Elite (some Direto/Suito models), JetBlack Volt V2 (fw 3.1.84), Van Rysel D100 got "virtual shifting" firmware. **Guess** that they use the same BLE service (ZI reports the feature, not the protocol).
- Rouvy and MyWhoosh drive these trainers too. **Confirmed** for Rouvy reverse-engineering it (DC Rainmaker); MyWhoosh **Guess**, only implied by the QZ PR #4292 title "Mywhoosh compatibility".
- Detection, best to worst:
  1. After connecting, look for primary service `00000001-19ca-4651-86e5-fa29dcdd09d1` alongside FTMS `0x1826`. **Confirmed** (INC `supportsVirtualShifting()` checks for this UUID; QZ looks for characteristic `…0003` in any service).
  2. Advertised 16-bit service `0xFC82`. Zwift controllers moved to `FC82` in Jan 2025 (MAK2); the Victory advertises `FC82` (MT); WC lists `0000fc82-…` as a fallback service to request. **Confirmed** that `FC82` is in use, **Guess** whether the GATT service on a given trainer is `FC82` or the 128-bit `…0001` (MT reports the Victory's GATT service as `FC82` holding the same `…0002/3/4` characteristics).
  3. Name contains "KICKR" or "Zwift" with only `1818`/`FC82` advertised. **Confirmed** as an INC heuristic (`checkForWahooEnhancement`), not a rule.
- Web Bluetooth: both `0000fc82-0000-1000-8000-00805f9b34fb` and `00000001-19ca-4651-86e5-fa29dcdd09d1` must be in `optionalServices` or the browser hides them. **Confirmed** (WC `TRAINER_REQUEST_OPTIONS`). Bluefy needs full 128-bit strings (WC NOTES, single source, **Guess** for other browsers).

## 2. Service and characteristics

| UUID | Role | Properties | Status |
|---|---|---|---|
| `00000001-19ca-4651-86e5-fa29dcdd09d1` (or `FC82`) | Zwift service | primary | **Confirmed** (QZ, INC, KE, VC, RID) |
| `00000002-19ca-4651-86e5-fa29dcdd09d1` | "async"/measurement: riding data `0x03` | notify | **Confirmed** (QZ, INC, KE, MT, RID) |
| `00000003-19ca-4651-86e5-fa29dcdd09d1` | "sync RX"/control point: app writes here | write, write without response | **Confirmed** (all) |
| `00000004-19ca-4651-86e5-fa29dcdd09d1` | "sync TX"/response: RideOn reply, `0x3c` info replies | indicate (MT: read + indicate) | **Confirmed** (QZ, INC, KE, MT, RID) |
| `00000006-19ca-4651-86e5-fa29dcdd09d1` | unknown | ? | **Guess**, only named in QZ `zapBleUuids.h` |

- It sits on the same GATT connection as FTMS; no second connection is needed. **Confirmed** (QZ and INC both reuse the FTMS peripheral; WC comment "on the FTMS trainer's existing GATT connection").
- Writes: INC uses write without response; KE, VC and QZ write with response. Either works on tested units. **Guess** which is preferred.
- Every message is one id byte followed by a protobuf (proto2) body. **Confirmed** (QZ proto comments, INC `sendPlayCommand(id, …)`, MAK1).

## 3. Handshake

Order used by INC (the most complete JS implementation):

1. Subscribe to notifications on `…0002` and indications on `…0004`. **Confirmed** (INC `initHubService` subscribe → pair; KE `enableNotifications` before `sendHello`; VC; WC).
2. Write "RideOn" to `…0003`. Variants seen:
   - `52 69 64 65 4f 6e 02 01` ("RideOn" + `02 01`): QZ `zwiftPlayInit`, INC `pair()` when the device is a fitness machine. **Confirmed** (two sources).
   - `52 69 64 65 4f 6e 01 02`: KE (KICKR CORE) and WC. **Confirmed** to work on KICKR CORE 1.5.36 (KE).
   - plain `52 69 64 65 4f 6e`: VC, and MT on the Victory. Trainer echoed it but see risks. **Confirmed** that it gets a reply.
   - Which trailing bytes matter is **unknown**. Use `02 01` first (two independent apps).
3. Trainer answers on `…0004` with something starting "RideOn". KE (after sending `01 02`) waits for exactly `52 69 64 65 4f 6e 02 02`; MT saw plain `526964654f6e`; QZ's emulator sends `… 02 00`. INC treats any reply starting with "RideOn" as paired. **Confirmed** that the reply starts with "RideOn"; trailing bytes **vary**, so match only the first 6 bytes.
4. Send `41 08 05` (id `0x41`, field 1 = 5). INC waits up to 2 s for the first `0x03` riding-data notification and only then calls the hub "active". **Confirmed** (INC `initHubService`, QZ `init1`). Meaning of `0x41`/5 is **unknown**.
5. No encryption, no keys, for trainers. **Confirmed** (MAK1 "These trainers do not encrypt their messages"; MT on Victory; INC uses plaintext when `isFM`). Zwift Play/Click v2 controllers do encrypt (ECDH P-256 in INC, MT); irrelevant for trainers.

QZ then replays a longer init copied from a Zwift capture (each line is `writeCharacteristicZwiftPlay` in `zwiftPlayInit`). Decoded by me from the proto:

| Bytes | Meaning | Status |
|---|---|---|
| `04 2a 04 10 c0 bb 01` | gear ratio 2.4000 | **Confirmed** decode |
| `00 08 00` | HubRequest DataId 0 (general info) | **Confirmed** decode |
| `00 08 88 04` | HubRequest DataId 520 (read back gear ratio) | **Confirmed** (MAK1, KE, QZ) |
| `04 2a 0a 10 c0 bb 01 20 bf 06 28 b4 42` | ratio 2.4, bike 8.31 kg, rider 85.00 kg | **Confirmed** decode |
| `04 22 0b 08 00 10 da 02 18 ec 27 20 90 03` | wind 0, incline 1.73 %, CWa 5100, Crr 400 | **Confirmed** decode |
| `04 22 03 10 a9 01`, `04 22 02 10 00` | incline −0.85 %, incline 0 | **Confirmed** decode |

Whether the long sequence is needed is **unknown**; INC and KE work without it.

## 4. Setting a gear

- Message: id `0x04` HubCommand, field 5 `PhysicalParam` (length-delimited, tag `0x2a`), inside it field 2 `GearRatioX10000` (varint, tag `0x10`). Value = ratio × 10000, rounded. **Confirmed** (QZ proto + Java/Swift, INC, KE, WC, VC, MAK1, RID).
- Byte layout: `04 2a <len> 10 <varint>` where `<len>` = 1 + varint length. **Confirmed** (KE `createPhysicalParamMessage`, WC `encodeGear`).
- Examples (recomputed, match QZ's emulator table where present):

| Gear (24-step table) | Ratio | Bytes |
|---|---|---|
| 1 | 0.75 | `04 2a 03 10 cc 3a` |
| 7 | 1.53 | `04 2a 03 10 c4 77` |
| 12 | 2.40 | `04 2a 04 10 c0 bb 01` |
| 17 | 3.49 | `04 2a 04 10 d4 90 02` |
| 24 | 5.49 | `04 2a 04 10 f4 ac 03` |

- Ratio table: Zwift's 24 gears run 0.75 → 5.49: `0.75 0.87 0.99 1.11 1.23 1.38 1.53 1.68 1.86 2.04 2.22 2.40 2.61 2.82 3.03 3.24 3.49 3.74 3.99 4.24 4.54 4.84 5.14 5.49`. **Confirmed** (INC `gearRatios`, WC, QZ emulator decodes Zwift's own writes to these values (gear 13 as 26099, 20 as 42399, 24 as 54899), ZI quotes 0.75–5.49). Start gear 12 in INC and WC.
- Other tables: KE uses a linear 0.75–2.80; QZ sends `10000 × (chainring/cog) / (42/14) × 3` from its own 12-gear 38×(44…10) table. So any value in about 0.75–5.49 is accepted. **Guess** on the hard limits; nothing tested outside that range.
- After a gear write, QZ sends `00 08 88 04` and INC sends HubRequest 512 (`00 08 80 04`). The trainer replies on `…0004` with `3c 08 88 04 12 … 40 <varint ratio>` (field 8 = current ratio). **Confirmed** for 520 (KE parses field 8; QZ emulator mirrors Zwift). The purpose of 512 is **unknown**.
- Gotcha: QZ (PR #4292) says gear commands do nothing until one incline command has been sent, so it sends incline 0.4 % first. INC sends a SimulationParam right after init (default incline 0.01 %, it never sends exactly 0). **Confirmed** by two sources that a simulation message goes first; exact reason **unknown**.
- INC re-sends the gear ratio with every SIM update and resends only changed fields. **Confirmed** (INC `checkSlopeWithAdapterShifting`, `prevHubSettings`).

## 5. Other messages

- Simulation (grade/wind) on the Zwift channel: `04 22 <len> …` = HubCommand field 4 `SimulationParam`: 1 wind sint32 (m/s × 100), 2 incline sint32 (% × 100, zigzag), 3 CWa uint32 (× 10000, Zwift uses 5100), 4 Crr uint32 (× 100000, Zwift uses 400). **Confirmed** (proto in QZ, INC, MAK1, MT, RID). Examples: 1 % `04 22 03 10 c8 01`, 5 % `04 22 03 10 e8 07`, −2 % `04 22 03 10 8f 03`.
- Weights: PhysicalParam field 4 bike weight × 100, field 5 rider weight × 100. MAK1 example `04 2a 08 10 00 20 81 05 28 c4 3b` = 6.41 kg bike, 76.2 kg rider. INC sends 10 kg / 75 kg defaults with the first gear. **Confirmed**.
- Wheel circumference: no Zwift-channel field found. **Guess** that it is not needed; the trainer models speed itself (MAK1 says `0x03` speed differs from FTMS speed).
- ERG on the Zwift channel: HubCommand field 3 PowerTarget, e.g. 200 W = `04 18 c8 01`. **Confirmed** in proto and VC `setTargetPower`; MT saw the Victory log "Target power set to: 250W" but not actuate. QZ instead keeps ERG on FTMS `0x05` while in Zwift mode; INC also keeps ERG on FTMS. **Guess** which works per trainer.
- Trainer sends `0x03` HubRidingData on `…0002` (notify): 1 power W, 2 cadence rpm, 3 speed × 100 (km/h), 4 HR, 5 and 6 unknown. MAK1 example `03 08 be 01 10 50 18 bd 06 20 00 28 e2 ba 01 30 8b eb 01` = 190 W, 80 rpm, 8.29. **Confirmed** (MAK1, KE, QZ, VC).
- Other ids seen from the trainer: `0x2a` text "trainer response" (e.g. `gap_params_change(2): 72, 72, 0, 600`), `0x3c` device info, `0x15` empty, `0x19` idle, `0x42` "init confirmed". **Confirmed** as ids in INC `dispatchMeasurement`; meanings **Guess**.
- Keepalive: none sent by any app studied. INC re-runs the whole init after a reconnect. **Confirmed** absence in code; whether the trainer times out a silent session is **unknown**.
- FTMS indoor bike data (`0x2AD2`) and power (`0x1818`) keep flowing in parallel. **Confirmed** (MAK1: power and cadence "match exactly" CPS/FTMS).

## 6. Returning to normal

- No "stop"/"leave Zwift mode" message has been found in any source. **Confirmed** absence (QZ, INC, KE, VC, MAK1 all lack one).
- Disconnecting ends the session: every app re-handshakes after reconnect (INC `resetHubState`, QZ resets `gearInclinationSent` on disconnect). **Guess** that the trainer drops back to plain FTMS/standalone on disconnect; not documented.
- Soft fallback without disconnecting: send gear 2.40 (Zwift's middle gear) and incline 0, then use FTMS again. **Guess**.
- For Cranky's safety rule (50 % FTP then release on error): after RideOn, FTMS may stop answering (see MT below), so the only reliable "release" is probably a GATT disconnect. **Guess**.

## 7. Risks and unknowns

- **FTMS may lock out after RideOn.** MT (Victory fw 4.29): writing RideOn to the FC82 control point made the trainer stop servicing the FTMS control point ("Request Control times out, no ERG, stuck ~120 W"). They removed the feature. QZ, by contrast, still sends FTMS target power in Zwift mode (on Zwift Hub). **Confirmed** conflict between sources; per-trainer behaviour **unknown**.
- **Victory may ack but not actuate.** MT saw the Victory log "Set simulated virtual gear ratio received: 5490" yet apply no resistance (blue LED flashing). MT only sent plain "RideOn" and never sent `41 08 05` or a simulation message first, which INC and QZ both do. **Guess** that the full INC order would fix it; QZ PR #2961 shows QZ looked at a Victory capture, but no outcome is recorded.
- **Handshake trailing bytes** (`02 01` vs `01 02` vs none) and the meaning of `0x41 08 05`, `0x00` DataId 512, `0x2a` replies: all reverse-engineered, unofficial. **Guess**.
- **Firmware drift.** Zwift changed the controller service to FC82 in Jan 2025 (MAK2); QZ has a commit "fixing get gears from zwift for new firmware version of zwift ride" (`5abc9ac9c0`, 15 Nov 2024). Expect changes without notice.
- **Web Bluetooth specifics:** untested in Chrome on desktop by any source found; WC (Web Bluetooth) is unverified on hardware.
- **Legal:** MT notes US patent 11,986,700 "Virtual shifting for exercise devices"; DC Rainmaker raises possible objections from Zwift. Trainer path is plaintext, so no circumvention issue (MT). **Guess** on any real exposure for a hobby app.
- Not found: any official Zwift documentation, TrainerDay or GoldenCheetah implementations (searched; nothing public on this channel).

## Suggested first experiment (trainer check page)

1. Request the trainer with FTMS filter plus both optional services. 2. If `…0001`/`FC82` exists, subscribe `…0002` and `…0004`. 3. Write `RideOn 02 01`, log the reply. 4. Write `41 08 05`, wait for a `0x03`. 5. Write incline 0 % (`04 22 02 10 00`) then gear 12 (`04 2a 04 10 c0 bb 01`) then `00 08 88 04`, and log the `0x3c` reply. 6. Step gears 1 → 24 while pedalling and watch power. 7. Check whether FTMS Request Control (`0x00`) still succeeds. 8. Disconnect and confirm FTMS works on reconnect.
