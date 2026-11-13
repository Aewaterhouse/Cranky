/**
 * Tunables for how the free ride feels to watch: the camera's extras and the rider's poses. Shown in the debug
 * panel as `VIS.route.feel`. Speeds in m/s, lengths in metres, angles in radians, gradients as fractions.
 */
export const FEEL = {
  cam: {
    /** 1 turns every extra below off, for a steady camera (the "Calm camera" setting). */
    calm: 0,
    /** The view widens by this many degrees by `fovKickAt`. */
    fovKick: 6,
    fovKickAt: 18,
    /** Shake on a fast descent: metres and roll at full, from `shakeFrom` to `shakeFull`, on at least `shakeGrade` down, at `shakeHz`. */
    shake: 0.05,
    shakeRoll: 0.008,
    shakeFrom: 9,
    shakeFull: 16,
    shakeGrade: 0.03,
    shakeHz: 8,
    /** Coasting in a tuck: the camera comes this share of `camBack` closer and this much lower. */
    tuckIn: 0.22,
    tuckDown: 0.9,
    /** The camera rolls this share of the rider's lean into a bend, at most `leanMax`, eased at `leanRate` a second. */
    lean: 0.5,
    leanMax: 0.1,
    leanRate: 3,
    /** How quickly the aim follows a change of gradient (1/s): lower is gentler. */
    pitchStiff: 2,
  },
  rider: {
    /** Out of the saddle from this gradient or this share of FTP; back down once under both by the `Off` margins. */
    standGrade: 0.08,
    standGradeOff: 0.015,
    standEffort: 1.3,
    standEffortOff: 0.2,
    /** Tucks when coasting at this speed on at least this much descent; sits up again `tuckOff` slower. */
    tuckMs: 11,
    tuckGrade: 0.02,
    tuckOff: 2,
    /** Below this speed nobody is coasting, they have stopped. */
    coastMs: 0.5,
    /** Poses blend at this rate a second; a coasting rider's pedals level out at `levelRate`. */
    ease: 3,
    levelRate: 5,
    /** Standing: how far the bike rocks, the hips come forward and up, and the body bobs. */
    rock: 0.14,
    standF: 0.2,
    standUp: 0.15,
    standBob: 0.03,
    /** Torso angle from upright: riding, tucked and celebrating. */
    lean: 0.75,
    tuckLean: 1.22,
    cheerLean: 0.1,
    /** Celebrating: hands this high above the shoulders and this far apart. */
    cheerUp: 0.56,
    cheerWide: 0.42,
    /** Most a rider leans into a bend. */
    maxLean: 0.45,
  },
}
