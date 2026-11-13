/**
 * Roadside one-liners for free ride. Each is [words, where it belongs, who made it]:
 *   where: ramp (before a steep ramp), falseflat, hairpin (just after one), togo (1 km to go), suburb, snow (at the
 *          snowline), sea (down at sea level), bush, farm, descent, top (just over the summit), start, any
 *   who:   c = council (printed, official), h = hand-painted on a bit of ply
 * Keep them short (they wrap to three lines), dry, and fit for a bunch of mates. Add freely.
 */
export type SignTag =
  | 'ramp'
  | 'falseflat'
  | 'hairpin'
  | 'togo'
  | 'suburb'
  | 'snow'
  | 'sea'
  | 'bush'
  | 'farm'
  | 'descent'
  | 'top'
  | 'start'
  | 'any'
export type SignLine = readonly [text: string, tag: SignTag, style: 'c' | 'h']

export const SIGN_LINES: readonly SignLine[] = [
  ['STEEP BIT AHEAD. SORRY.', 'ramp', 'c'],
  ['LOW GEAR. LOW EXPECTATIONS.', 'ramp', 'c'],
  ['GRADIENT: RUDE', 'ramp', 'c'],
  ['TRUCKS USE LOW GEAR. YOU TOO.', 'ramp', 'c'],
  ['IT GETS WORSE', 'ramp', 'h'],
  ['NO STOPPING. NO, REALLY.', 'ramp', 'c'],
  ['GRAVITY ENFORCED NEXT 1 KM', 'ramp', 'c'],
  ['LEGS MUST BE CARRIED PAST THIS POINT', 'ramp', 'c'],
  ['YOU CHOSE THIS', 'ramp', 'h'],
  ['FALSE FLAT. REAL PAIN.', 'falseflat', 'c'],
  ["LOOKS FLAT. ISN'T.", 'falseflat', 'h'],
  ["THIS BIT DOESN'T COUNT AS REST", 'falseflat', 'h'],
  ['OPTICAL ILLUSION NEXT 500 M', 'falseflat', 'c'],
  ["YES, IT'S STILL UPHILL", 'falseflat', 'h'],
  ['THAT WAS ONE. THERE ARE MORE.', 'hairpin', 'h'],
  ['DIZZY YET?', 'hairpin', 'h'],
  ['CORNER COMPLETED. WELL DONE, APPARENTLY.', 'hairpin', 'c'],
  ['SAME VIEW, SLIGHTLY HIGHER', 'hairpin', 'c'],
  ['ENGINEER WAS PAID BY THE BEND', 'hairpin', 'c'],
  ['KEEP LEFT. KEEP GOING.', 'hairpin', 'c'],
  ['1 KM TO GO (COUNCIL ESTIMATE)', 'togo', 'c'],
  ['LAST KM. EMPTY THE TANK.', 'togo', 'h'],
  ['NEARLY THERE. THIS TIME WE MEAN IT.', 'togo', 'h'],
  ['1 KM TO GO. SPRINT OPTIONAL.', 'togo', 'c'],
  ['SMILE FOR THE CAMERA (THERE IS NO CAMERA)', 'togo', 'h'],
  ['BIN NIGHT IS TUESDAY', 'suburb', 'c'],
  ["SLOW DOWN, NAN'S REVERSING", 'suburb', 'h'],
  ['NEIGHBOURHOOD WATCH: WE SAW THAT GEAR CHANGE', 'suburb', 'c'],
  ['GARAGE SALE SAT. NO BIKES.', 'suburb', 'h'],
  ['LOST CAT. ANSWERS TO NOTHING.', 'suburb', 'h'],
  ['RIDE LIKE YOUR NAN LIVES HERE', 'suburb', 'h'],
  ["40 ZONE. YOU'LL BE FINE.", 'suburb', 'c'],
  ['LAWN BOWLS TONIGHT. BARE FEET OK.', 'suburb', 'h'],
  ['TIDY TOWN RUNNER-UP 1987', 'suburb', 'c'],
  ['LEMONS. FREE. PLEASE.', 'suburb', 'h'],
  ['SNOW CHAINS MUST BE CARRIED. ALSO SNACKS.', 'snow', 'c'],
  ['ICE ON ROAD. ICE IN ESKY.', 'snow', 'c'],
  ['ABOVE THE SNOWLINE. BELOW YOUR BEST.', 'snow', 'h'],
  ['BLACK ICE. WHITE KNUCKLES.', 'snow', 'c'],
  ["SNOW GUMS AHEAD. THEY'VE SEEN SLOWER.", 'snow', 'h'],
  ['HOT CHOCOLATE 4 KM (UPHILL)', 'snow', 'h'],
  ["SEA LEVEL. IT'S ALL UPHILL FROM HERE.", 'sea', 'c'],
  ['NO SWIMMING IN CYCLING SHOES', 'sea', 'c'],
  ['FISH AND CHIPS AT THE FINISH (NOT GUARANTEED)', 'sea', 'h'],
  ['BEWARE OF SEAGULLS. GUARD YOUR CHIPS.', 'sea', 'c'],
  ['SAND ON ROAD. SALT IN WOUNDS.', 'sea', 'c'],
  ["TIDE'S OUT. SO ARE YOUR LEGS.", 'sea', 'h'],
  ["WILDLIFE NEXT 5 KM. THEY'RE FASTER.", 'bush', 'c'],
  ['DROP BEARS: UNLIKELY. LOOK UP ANYWAY.', 'bush', 'c'],
  ['TOTAL FIRE BAN. INCLUDES YOUR QUADS.', 'bush', 'c'],
  ['SNAKES SUNBAKING. GIVE WAY.', 'bush', 'c'],
  ['KOALAS CROSSING, EVENTUALLY', 'bush', 'c'],
  ['NO PHONE RECEPTION. NO EXCUSES.', 'bush', 'h'],
  ['MAGPIE SEASON: JAN TO DEC', 'bush', 'c'],
  ['THE LYREBIRD DOES A GREAT FREEHUB', 'bush', 'h'],
  ['FRESH EGGS. STALE JOKES.', 'farm', 'h'],
  ['COWS HAVE RIGHT OF WAY. AND OPINIONS.', 'farm', 'c'],
  ['TRESPASSERS WILL BE FED', 'farm', 'h'],
  ['SHUT THE GATE', 'farm', 'h'],
  ['HAY FOR SALE. HEY TO YOU TOO.', 'farm', 'h'],
  ['ELECTRIC FENCE. ASK DAZZA.', 'farm', 'h'],
  ['FREE SPEED AHEAD', 'descent', 'h'],
  ['CHECK BRAKES. THEN CHECK AGAIN.', 'descent', 'c'],
  ['WHAT GOES UP GETS TO COAST', 'descent', 'c'],
  ['STOP PEDALLING. START GRINNING.', 'descent', 'h'],
  ['TUCK AT OWN RISK', 'descent', 'c'],
  ["IT'S ALL DOWNHILL FROM HERE. MOSTLY.", 'top', 'c'],
  ['YOU MADE IT. THE VIEW IS COMPLIMENTARY.', 'top', 'c'],
  ['WARM-UP ZONE. NO HEROES.', 'start', 'c'],
  ['LAST CHANCE TO TURN BACK', 'start', 'h'],
  ["EASY NOW. IT'S A LONG WAY.", 'start', 'h'],
  ['YOU ARE HERE. UNFORTUNATELY.', 'any', 'c'],
  ['NEXT SERVO 86 KM', 'any', 'c'],
  ['SCENIC ROUTE (THEY ALL ARE)', 'any', 'c'],
  ['HONK IF YOU LOVE HILLS. NOBODY HONKS.', 'any', 'h'],
  ['REST AREA 2 KM. JUST KIDDING.', 'any', 'c'],
  ['COFFEE: NOT ON THIS ROAD', 'any', 'h'],
  ['FORM IS TEMPORARY. THIS ROAD IS LONG.', 'any', 'h'],
  ["DRINK WATER. THE OTHER STUFF'S FOR LATER.", 'any', 'h'],
  ['YOUR FTP IS NOT A PERSONALITY', 'any', 'h'],
  ['REDUCE SPEED. OH. YOU HAVE.', 'any', 'c'],
  ['HAVE A BREAK. ACTUALLY NO. KEEP GOING.', 'any', 'h'],
]
