# Real routes plan: the GPX worlds, one map at a time

Owner request, 2026-11-15: make the free-ride worlds of the routes built from the crew's own rides feel like the
real place (fewer made-up details, more local life; the jokes stay when grounded in real life). One map at a time,
starting with Nundah. The older waypoint routes are out of scope.

Data allowed (owner approved, 2026-11-15): OpenStreetMap (ODbL), Queensland and Geoscience Australia LiDAR
(ELVIS data, CC BY 4.0), ESA WorldCover (CC BY 4.0). Credits in `client/public/assets/CREDITS.md`.

## Shared fixes (all routes)
- [x] Loops are true circuits: the road smooths and curves through the start line, wraps round, and has no
      straight run-off past either end (client `roadPath.ts`, `chunks.ts`; server `road_route.py`).
- [x] Builder: a loop's lap starts at a given spot (`startAt`); the client closes the join.
- [ ] Buildings never cross the road: real outline checked against the road, roofs and canopies handled.
- [ ] Builder test: no building over the road, no kink at a lap join.

## Nundah Crit Track (owner's notes, 2026-11-15)
The crit track in Albert Bishop Park, home of the Hamilton Wheelers.
- [x] Start/finish on the long straight, about a quarter of the way along from the clubhouse end.
- [x] Heights from Queensland LiDAR (`dem: "qld"`): line and a 10 m ground grid; the clubhouse rise shows.
      The S-bend bump is under half a metre in the LiDAR, so it barely shows.
- [ ] The mangrove creek beside the long straight (outside), from LiDAR water; sparse trees between it and the
      straight.
- [ ] Hamilton Wheelers clubhouse (OSM "Criterium Clubhouse") up by the little hill; toilet block near the line.
- [ ] Infield: gums and long grass, thick enough that you cannot see across between the long ends.
- [ ] Snakes in the long grass, wallabies.
- [ ] Crit dressing instead of the made-up start village: start/finish line and gantry, no centre line.

## Later maps
Howick (rebuild: its map features were never fetched), Mount Coot-tha Back (lap join kink, building over the
road), Mondo, Full Gas Friday, Darren Smith, Metros.
