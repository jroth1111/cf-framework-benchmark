// Deterministic third-party SDK weight simulation for the mpa_airbnb_hifi
// suite. Governed by docs/contracts-v6-addendum.md "Third-Party SDK Weight
// Contract": maps.js ~80 KB gzipped, analytics.js ~35 KB gzipped, both
// byte-identical across frameworks via this single module. Payloads are
// generated once per isolate from a fixed seed so every framework serves
// the same bytes.

function mulberry32(seed) {
  let s = seed >>> 0;
  return function rand() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function hex(n, width) {
  return n.toString(16).padStart(width, "0");
}

function buildMapsJs() {
  const rand = mulberry32(0xcafe1a7e);

  const styles = ["streets", "satellite", "terrain", "outdoors", "light", "dark"];
  const adapters = ["raster", "vector", "hybrid", "atlas"];
  const cities = [
    "lisbon", "porto", "madrid", "barcelona", "paris", "lyon", "berlin",
    "munich", "amsterdam", "brussels", "vienna", "prague", "warsaw", "rome",
    "milan", "athens", "istanbul", "dublin", "edinburgh", "london", "oslo",
    "stockholm", "helsinki", "copenhagen", "reykjavik", "zurich", "geneva",
    "tokyo", "kyoto", "osaka", "seoul", "taipei", "hongkong", "singapore",
    "bangkok", "kualalumpur", "hanoi", "saigon", "manila", "jakarta",
    "sydney", "melbourne", "brisbane", "auckland", "wellington",
    "newyork", "boston", "chicago", "miami", "austin", "seattle", "portland",
    "sanfrancisco", "losangeles", "sandiego", "denver", "phoenix", "vancouver",
    "toronto", "montreal", "ottawa", "calgary", "mexicocity", "guadalajara",
    "buenosaires", "santiago", "limaa", "bogota", "saopaulo", "rio",
    "capetown", "nairobi", "marrakech", "cairo", "telaviv",
  ];

  // Tile descriptors: 1100 entries, structured object literal. Mostly
  // numeric data so gzip compresses key names but not values. Sized to
  // land the gzipped response near the v6 ~80 KB target.
  const tiles = [];
  for (let i = 0; i < 1100; i++) {
    tiles.push({
      id: `tile-${hex(i, 4)}`,
      lat: Number((rand() * 180 - 90).toFixed(6)),
      lng: Number((rand() * 360 - 180).toFixed(6)),
      zoom: 1 + Math.floor(rand() * 18),
      bbox: [
        Number((rand() * 360 - 180).toFixed(4)),
        Number((rand() * 180 - 90).toFixed(4)),
        Number((rand() * 360 - 180).toFixed(4)),
        Number((rand() * 180 - 90).toFixed(4)),
      ],
      style: pick(rand, styles),
      adapter: pick(rand, adapters),
      city: pick(rand, cities),
      version: hex(Math.floor(rand() * 0xffff), 4),
      hash: hex(Math.floor(rand() * 0xffffffff), 8),
    });
  }

  // Marker registry: 600 entries, simulates POI catalog the SDK exposes.
  const markers = [];
  const markerKinds = ["pin", "cluster", "label", "circle", "polygon"];
  for (let i = 0; i < 600; i++) {
    markers.push({
      id: `mk-${hex(i, 4)}`,
      kind: pick(rand, markerKinds),
      lat: Number((rand() * 180 - 90).toFixed(5)),
      lng: Number((rand() * 360 - 180).toFixed(5)),
      label: `Marker ${i}`,
      color: `#${hex(Math.floor(rand() * 0xffffff), 6)}`,
      size: 8 + Math.floor(rand() * 32),
      anchor: pick(rand, ["top", "bottom", "center", "left", "right"]),
    });
  }

  // Projection lookup table: simulates SDK's mercator transform constants.
  const projection = [];
  for (let i = 0; i < 360; i++) {
    projection.push({
      deg: i,
      sin: Math.sin((i * Math.PI) / 180),
      cos: Math.cos((i * Math.PI) / 180),
      tan: Math.tan((i * Math.PI) / 180),
    });
  }

  // Helper bodies: a handful of distinct shapes so gzip can't collapse them.
  const helpers = [];
  for (let i = 0; i < 80; i++) {
    const a = hex(Math.floor(rand() * 0xffff), 4);
    const b = hex(Math.floor(rand() * 0xffff), 4);
    const c = hex(Math.floor(rand() * 0xffff), 4);
    helpers.push(
      `function h_${a}(x,y){var t_${b}=x*${(rand() * 100).toFixed(3)}+y;var u_${c}=Math.sin(t_${b}*${(rand() * 10).toFixed(4)});return u_${c}*Math.cos(t_${b}*0.5)+t_${b};}`
    );
  }

  const tilesJson = JSON.stringify(tiles);
  const markersJson = JSON.stringify(markers);
  const projectionJson = JSON.stringify(projection);

  return `/* @cf-bench/bench-contract maps SDK fixture v1 */
(function(){
  if (typeof window === "undefined") return;
  if (window.__cfBenchMapsLoaded) return;
  window.__cfBenchMapsLoaded = true;
  var TILES = ${tilesJson};
  var MARKERS = ${markersJson};
  var PROJECTION = ${projectionJson};
  ${helpers.join("\n  ")}
  function tileFor(lat, lng, zoom) {
    var best = null, bestDist = Infinity;
    for (var i = 0; i < TILES.length; i++) {
      var t = TILES[i];
      if (t.zoom !== zoom) continue;
      var dx = t.lat - lat, dy = t.lng - lng;
      var d = dx*dx + dy*dy;
      if (d < bestDist) { best = t; bestDist = d; }
    }
    return best;
  }
  function projectXY(deg) {
    var p = PROJECTION[((deg % 360) + 360) % 360];
    return p ? [p.cos, p.sin] : [1, 0];
  }
  function markerById(id) {
    for (var i = 0; i < MARKERS.length; i++) if (MARKERS[i].id === id) return MARKERS[i];
    return null;
  }
  var registry = Object.create(null);
  function register(name, ctor) { registry[name] = ctor; }
  register("tileFor", tileFor);
  register("projectXY", projectXY);
  register("markerById", markerById);
  if (typeof customElements !== "undefined" && !customElements.get("bench-map-tile")) {
    var BenchMapTileElement = (function() {
      function defineProto() {
        function ctor() { return Reflect.construct(HTMLElement, [], ctor); }
        ctor.prototype = Object.create(HTMLElement.prototype);
        ctor.prototype.constructor = ctor;
        ctor.prototype.connectedCallback = function() {
          var lat = parseFloat(this.getAttribute("lat")) || 0;
          var lng = parseFloat(this.getAttribute("lng")) || 0;
          var zoom = parseInt(this.getAttribute("zoom") || "10", 10);
          var t = tileFor(lat, lng, zoom);
          if (t) this.dataset.tileId = t.id;
        };
        Object.setPrototypeOf(ctor, HTMLElement);
        return ctor;
      }
      return defineProto();
    })();
    try { customElements.define("bench-map-tile", BenchMapTileElement); } catch (_) {}
  }
  window.__cfBenchMapsApi = registry;
})();
`;
}

function buildAnalyticsJs() {
  const rand = mulberry32(0x10bb1e51);

  const eventTypes = [
    "page_view", "click", "scroll", "form_submit", "form_change", "search",
    "filter", "select_listing", "open_gallery", "close_gallery", "open_map",
    "close_map", "favorite", "unfavorite", "share", "begin_checkout",
    "add_payment", "remove_payment", "complete_checkout", "checkout_error",
    "session_start", "session_end", "ab_test_assigned",
  ];
  const errorCodes = [];
  for (let i = 0; i < 200; i++) {
    errorCodes.push({
      code: `E${1000 + i}`,
      severity: pick(rand, ["info", "warn", "error", "fatal"]),
      retry: rand() > 0.5,
      message: `Generic message ${i}`,
    });
  }

  // Event schema definitions (compressible structure, simulates analytics SDK
  // shipping a static schema bundle).
  const schemas = [];
  for (let i = 0; i < eventTypes.length; i++) {
    const fields = [];
    const fieldCount = 6 + Math.floor(rand() * 8);
    for (let f = 0; f < fieldCount; f++) {
      fields.push({
        name: `field_${i}_${f}`,
        type: pick(rand, ["string", "number", "boolean", "iso_date", "url", "id"]),
        required: rand() > 0.6,
        max_length: 32 + Math.floor(rand() * 256),
      });
    }
    schemas.push({ event: eventTypes[i], fields });
  }

  // Beacon redaction patterns and PII allowlist (compressible repetitive
  // arrays that simulate analytics SDK config blobs).
  const piiPatterns = [];
  for (let i = 0; i < 60; i++) {
    piiPatterns.push({
      name: `pattern_${i}`,
      regex: `^[a-z]{${2 + (i % 6)}}-[0-9]{${3 + (i % 5)}}-${hex(i, 4)}$`,
      replacement: "[REDACTED]",
    });
  }

  // A/B experiment registry: high-entropy bucket-id table that simulates an
  // analytics SDK shipping its full experiment catalog inline. Random hash
  // tokens compress poorly so this scales close to 1:1 in the gzipped wire
  // payload, lifting the gzipped size toward the v6 ~35 KB target.
  const experiments = [];
  for (let i = 0; i < 460; i++) {
    const variants = [];
    const variantCount = 2 + Math.floor(rand() * 2);
    for (let v = 0; v < variantCount; v++) {
      variants.push({
        id: hex(Math.floor(rand() * 0xffffffff), 8),
        weight: Number((rand()).toFixed(3)),
        salt: hex(Math.floor(rand() * 0xffffffff), 8),
      });
    }
    experiments.push({
      key: `exp_${hex(Math.floor(rand() * 0xffffffff), 8)}`,
      hash: hex(Math.floor(rand() * 0xffffffff), 8),
      bucket: hex(Math.floor(rand() * 0xffffffff), 8),
      variants,
    });
  }

  const piiPatternsJson = JSON.stringify(piiPatterns);
  const schemasJson = JSON.stringify(schemas);
  const errorCodesJson = JSON.stringify(errorCodes);
  const experimentsJson = JSON.stringify(experiments);

  // Helper bodies: smaller batch than maps but still high-entropy.
  const helpers = [];
  for (let i = 0; i < 30; i++) {
    const a = hex(Math.floor(rand() * 0xffff), 4);
    const b = hex(Math.floor(rand() * 0xffff), 4);
    helpers.push(
      `function a_${a}(v){var n_${b}=String(v||"").length*${(rand() * 1000).toFixed(2)};return n_${b}^${Math.floor(rand() * 0xffff)};}`
    );
  }

  return `/* @cf-bench/bench-contract analytics SDK fixture v1 */
(function(){
  if (typeof window === "undefined") return;
  if (window.__cfBenchAnalyticsLoaded) return;
  window.__cfBenchAnalyticsLoaded = true;
  var SCHEMAS = ${schemasJson};
  var ERROR_CODES = ${errorCodesJson};
  var PII_PATTERNS = ${piiPatternsJson};
  var EXPERIMENTS = ${experimentsJson};
  var queue = [];
  var sessionId = "sess-" + Math.random().toString(36).slice(2, 10);
  ${helpers.join("\n  ")}
  function redact(value) {
    if (typeof value !== "string") return value;
    for (var i = 0; i < PII_PATTERNS.length; i++) {
      var p = PII_PATTERNS[i];
      try {
        var re = new RegExp(p.regex);
        if (re.test(value)) return p.replacement;
      } catch (_) {}
    }
    return value;
  }
  function validate(event) {
    for (var i = 0; i < SCHEMAS.length; i++) {
      if (SCHEMAS[i].event === event.event) {
        var fields = SCHEMAS[i].fields;
        for (var j = 0; j < fields.length; j++) {
          var f = fields[j];
          if (f.required && !(f.name in event)) return false;
        }
        return true;
      }
    }
    return false;
  }
  function send(event) {
    if (!validate(event)) return false;
    var payload = { ts: Date.now(), session: sessionId, event: event };
    queue.push(payload);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon("/__bench/beacon", JSON.stringify(payload));
      }
    } catch (_) {}
    return true;
  }
  function track(name, props) {
    var ev = Object.assign({ event: name }, props || {});
    return send(ev);
  }
  if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
    try {
      var obs = new MutationObserver(function(records) {
        for (var i = 0; i < records.length; i++) {
          var r = records[i];
          if (r.type === "childList" && r.addedNodes.length > 0) {
            track("dom_added", { count: r.addedNodes.length });
            break;
          }
        }
      });
      if (document.documentElement) {
        obs.observe(document.documentElement, { childList: true, subtree: true });
      }
    } catch (_) {}
  }
  window.__cfBenchAnalytics = { track: track, redact: redact, queue: queue };
  try { track("session_start", { session: sessionId }); } catch (_) {}
})();
`;
}

let cachedMaps = null;
let cachedAnalytics = null;

export function getMapsSdkSource() {
  if (cachedMaps === null) cachedMaps = buildMapsJs();
  return cachedMaps;
}

export function getAnalyticsSdkSource() {
  if (cachedAnalytics === null) cachedAnalytics = buildAnalyticsJs();
  return cachedAnalytics;
}
