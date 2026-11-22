// TISHINA 0.3.1 — procedural sky, sun/moon cycle and wind-driven clouds.
// No external textures or network requests. Kept intentionally lightweight for mobile GPUs.
export function installSkyWeather({ THREE, scene, camera, sun, hemisphereLight, renderer, onHud = () => {} }) {
  const CONFIG = {
    startHour: 7 + 50 / 60,       // The player arrives near the northern winter dawn; 04:17 is the recorded radio call.
    fullDaySeconds: 60 * 60,     // One complete 24-hour game day in 60 real minutes.
    latitudeDeg: 61.0,          // Northern industrial region, approximately 61 degrees north.
    dayOfYear: 322,             // 18 November 2034.
    windSpeed: 5.4,              // Mean wind speed in m/s; set to 0 for still air.
    windDirectionDeg: 255,       // Direction clouds travel toward, clockwise from +X in the sky map.
    cloudCoverage: 0.76          // 0 = clear, 1 = fully overcast.
  };

  const clock = { hour: CONFIG.startHour, day: 1, elapsed: 0 };
  const wind = { speed: CONFIG.windSpeed, direction: CONFIG.windDirectionDeg, coverage: CONFIG.cloudCoverage };
  const cloudOffset = new THREE.Vector2(0, 0);
  const sunDirection = new THREE.Vector3(1, 0, 0);
  const moonDirection = new THREE.Vector3(-1, 0, 0);
  const daylightFog = new THREE.Color(0x9ba9ab);
  const nightFog = new THREE.Color(0x17212e);
  const currentFog = new THREE.Color();
  const overcastFog = new THREE.Color(0x727d80);
  const lightTarget = new THREE.Vector3();
  const dayHemi = new THREE.Color(0xc5d0cb);
  const nightHemi = new THREE.Color(0x35465d);
  const groundDay = new THREE.Color(0x242d29);
  const groundNight = new THREE.Color(0x101722);
  const moonLight = new THREE.DirectionalLight(0x9db8e0, 0);
  moonLight.castShadow = false;
  scene.add(moonLight);
  scene.add(moonLight.target);
  scene.add(sun.target);

  const uniforms = {
    uSunDir: { value: sunDirection.clone() },
    uMoonDir: { value: moonDirection.clone() },
    uTime: { value: 0 },
    uCloudOffset: { value: cloudOffset.clone() },
    uCloudCoverage: { value: wind.coverage },
    uCloudSpeed: { value: wind.speed },
    uNight: { value: 1 },
  };

  const vertexShader = /* glsl */`
    varying vec3 vDirection;
    void main() {
      vDirection = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */`
    precision highp float;
    varying vec3 vDirection;
    uniform vec3 uSunDir;
    uniform vec3 uMoonDir;
    uniform float uTime;
    uniform vec2 uCloudOffset;
    uniform float uCloudCoverage;
    uniform float uCloudSpeed;
    uniform float uNight;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float noise2(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;
      mat2 turn = mat2(1.62, -1.18, 1.18, 1.62);
      for (int i = 0; i < 4; i++) {
        value += amplitude * noise2(p);
        p = turn * p + 0.13;
        amplitude *= 0.5;
      }
      return value;
    }
    void main() {
      vec3 dir = normalize(vDirection);
      float horizon = pow(1.0 - max(dir.y, 0.0), 1.55);
      float day = smoothstep(-0.14, 0.13, uSunDir.y);
      float twilight = exp(-abs(uSunDir.y) * 13.0) * (1.0 - day * 0.45);

      vec3 nightZenith = vec3(0.012, 0.021, 0.043);
      vec3 nightHorizon = vec3(0.055, 0.073, 0.105);
      vec3 dayZenith = vec3(0.19, 0.36, 0.53);
      vec3 dayHorizon = vec3(0.57, 0.64, 0.65);
      vec3 nightSky = mix(nightZenith, nightHorizon, horizon);
      vec3 daySky = mix(dayZenith, dayHorizon, horizon);
      vec3 sky = mix(nightSky, daySky, day);
      sky += vec3(0.19, 0.085, 0.045) * twilight * horizon;

      float sunDot = dot(dir, normalize(uSunDir));
      float sunDisc = smoothstep(cos(0.0105), cos(0.0075), sunDot);
      float sunHalo = pow(max(sunDot, 0.0), 32.0) * 0.24 + pow(max(sunDot, 0.0), 7.0) * 0.055;
      vec3 sunColor = mix(vec3(1.0, 0.64, 0.39), vec3(1.0, 0.91, 0.75), day);
      sky += sunColor * sunHalo * (1.0 - uNight * 0.78);
      sky = mix(sky, sunColor, sunDisc * (1.0 - uNight));

      float moonDot = dot(dir, normalize(uMoonDir));
      float moonDisc = smoothstep(cos(0.010), cos(0.007), moonDot);
      float moonHalo = pow(max(moonDot, 0.0), 28.0) * 0.18;
      float moonNoise = fbm(dir.xy * 190.0 + vec2(dir.z * 90.0));
      vec3 moonColor = mix(vec3(0.39, 0.44, 0.52), vec3(0.80, 0.84, 0.88), smoothstep(0.25, 0.75, moonNoise));
      sky += vec3(0.31, 0.39, 0.55) * moonHalo * uNight;
      sky = mix(sky, moonColor, moonDisc * uNight);

      // A sparse procedural star field, naturally hidden by daylight and thick cloud.
      vec2 starCell = floor(dir.xy * 420.0 + vec2(dir.z * 91.0, dir.z * 57.0));
      float starSeed = hash21(starCell);
      float stars = step(0.9975, starSeed) * (1.0 - smoothstep(-0.16, 0.08, uSunDir.y));
      sky += vec3(0.62, 0.72, 0.88) * stars * (1.0 - uCloudCoverage * 0.88);

      // Equirectangular cloud coordinates. Wind moves this layer; calm air freezes it.
      vec2 cloudUV = vec2(atan(dir.z, dir.x) * 0.15915494 + 0.5, asin(clamp(dir.y, -1.0, 1.0)) * 0.31830989 + 0.5);
      cloudUV += uCloudOffset;
      cloudUV.x += sin(cloudUV.y * 8.0 + uTime * 0.018) * 0.0012 * clamp(uCloudSpeed / 12.0, 0.0, 1.0);
      float broad = fbm(cloudUV * vec2(8.5, 5.3));
      float detail = fbm(cloudUV * vec2(25.0, 15.0) + vec2(7.3, 2.1));
      float cloudField = broad * 0.80 + detail * 0.20;
      float threshold = mix(0.79, 0.39, clamp(uCloudCoverage, 0.0, 1.0));
      float clouds = smoothstep(threshold, threshold + 0.17, cloudField + (detail - 0.5) * 0.12);
      clouds *= smoothstep(-0.13, 0.04, dir.y);
      float cloudOpacity = clouds * (0.24 + uCloudCoverage * 0.62);
      vec3 cloudNight = vec3(0.065, 0.083, 0.112);
      vec3 cloudDay = vec3(0.57, 0.61, 0.61);
      vec3 cloudTwilight = vec3(0.31, 0.25, 0.25);
      vec3 cloudColor = mix(cloudNight, cloudDay, day);
      cloudColor = mix(cloudColor, cloudTwilight, twilight * 0.42);
      float topLight = max(dot(dir, normalize(uSunDir)), 0.0);
      cloudColor += vec3(0.10, 0.085, 0.065) * topLight * (1.0 - uNight);
      sky = mix(sky, cloudColor, clamp(cloudOpacity, 0.0, 0.92));

      gl_FragColor = vec4(sky, 1.0);
    }
  `;

  const skyMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    fog: false
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 28), skyMaterial);
  skyDome.name = 'Процедурное небо — солнце, луна и облака';
  skyDome.scale.setScalar(85); // Keep it inside the existing 90-unit camera far plane.
  skyDome.frustumCulled = false;
  skyDome.renderOrder = -1000;
  scene.add(skyDome);
  scene.background = null;

  let hudTimer = 0;
  let lastHudSignature = '';
  const smoothstep = (a, b, x) => {
    const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const formatClock = (hour) => {
    const h = Math.floor(hour) % 24;
    const m = Math.floor((hour - Math.floor(hour)) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  function setTime(hour) {
    if (Number.isFinite(hour)) clock.hour = ((hour % 24) + 24) % 24;
  }
  function setWeather(next = {}) {
    if (Number.isFinite(next.windSpeed)) wind.speed = THREE.MathUtils.clamp(next.windSpeed, 0, 25);
    if (Number.isFinite(next.windDirectionDeg)) wind.direction = ((next.windDirectionDeg % 360) + 360) % 360;
    if (Number.isFinite(next.cloudCoverage)) wind.coverage = THREE.MathUtils.clamp(next.cloudCoverage, 0, 1);
    uniforms.uCloudCoverage.value = wind.coverage;
  }
  function update(dt, elapsedMs = 0) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const safeDt = Math.min(dt, 0.05);
    clock.elapsed += safeDt;
    const advancedHours = safeDt * 24 / CONFIG.fullDaySeconds;
    const unwrappedHour = clock.hour + advancedHours;
    if (unwrappedHour >= 24) clock.day += Math.floor(unwrappedHour / 24);
    clock.hour = unwrappedHour % 24;
    uniforms.uTime.value = elapsedMs * 0.001;

    const latitude = THREE.MathUtils.degToRad(CONFIG.latitudeDeg);
    const declination = THREE.MathUtils.degToRad(23.44) * Math.sin((2 * Math.PI * (284 + CONFIG.dayOfYear)) / 365);
    const hourAngle = ((clock.hour - 12) * Math.PI) / 12;
    const sinElevation = Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
    const sunElevation = Math.asin(THREE.MathUtils.clamp(sinElevation, -1, 1));
    const east = -Math.cos(declination) * Math.sin(hourAngle);
    const north = Math.cos(latitude) * Math.sin(declination) - Math.sin(latitude) * Math.cos(declination) * Math.cos(hourAngle);
    sunDirection.set(east, sinElevation, north).normalize();
    moonDirection.copy(sunDirection).multiplyScalar(-1);
    uniforms.uSunDir.value.copy(sunDirection);
    uniforms.uMoonDir.value.copy(moonDirection);

    const dayAmount = smoothstep(-0.055, 0.12, sinElevation);
    const nightAmount = 1 - smoothstep(-0.075, 0.10, sinElevation);
    const cloudDim = 1 - wind.coverage * 0.42;
    const gust = 0.82 + 0.12 * Math.sin(clock.elapsed * 0.19) + 0.06 * Math.sin(clock.elapsed * 0.071 + 1.7);
    const currentWind = wind.speed * Math.max(0, gust);
    const windAngle = THREE.MathUtils.degToRad(wind.direction);
    cloudOffset.x += Math.cos(windAngle) * currentWind * safeDt * 0.00012;
    cloudOffset.y += Math.sin(windAngle) * currentWind * safeDt * 0.00012;
    uniforms.uCloudOffset.value.copy(cloudOffset);
    uniforms.uCloudSpeed.value = currentWind;
    uniforms.uCloudCoverage.value = wind.coverage;
    uniforms.uNight.value = nightAmount;

    skyDome.position.copy(camera.position);
    lightTarget.copy(camera.position);
    lightTarget.y = 0;
    sun.target.position.copy(lightTarget);
    sun.position.copy(lightTarget).addScaledVector(sunDirection, 90);
    sun.intensity = 1.45 * dayAmount * cloudDim;
    sun.castShadow = sunElevation > 0.08 && wind.coverage < 0.88;
    moonLight.target.position.copy(lightTarget);
    moonLight.position.copy(lightTarget).addScaledVector(moonDirection, 70);
    moonLight.intensity = 0.20 * nightAmount * (1 - wind.coverage * 0.72);

    hemisphereLight.color.copy(nightHemi).lerp(dayHemi, dayAmount);
    hemisphereLight.groundColor.copy(groundNight).lerp(groundDay, dayAmount);
    hemisphereLight.intensity = 0.48 + dayAmount * 0.44;
    renderer.toneMappingExposure = 0.80 + dayAmount * 0.24;
    if (scene.fog) {
      currentFog.copy(nightFog).lerp(daylightFog, dayAmount);
      currentFog.lerp(overcastFog, wind.coverage * 0.22);
      scene.fog.color.copy(currentFog);
      scene.fog.density = 0.014 + wind.coverage * 0.005 + nightAmount * 0.002;
    }

    hudTimer += safeDt;
    if (hudTimer >= 0.5) {
      hudTimer = 0;
      const skyCondition = wind.coverage > 0.82 ? 'СПЛОШНАЯ ОБЛАЧНОСТЬ' : wind.coverage > 0.52 ? 'ОБЛАЧНО' : wind.coverage > 0.25 ? 'ПЕРЕМЕННАЯ ОБЛАЧНОСТЬ' : 'ЯСНО';
      const windLabel = currentWind < 0.5 ? 'ШТИЛЬ' : currentWind < 5 ? 'СЛАБЫЙ ВЕТЕР' : currentWind < 10 ? 'УМЕРЕННЫЙ ВЕТЕР' : currentWind < 17 ? 'СИЛЬНЫЙ ВЕТЕР' : 'ШТОРМОВОЙ ВЕТЕР';
      const dateLabel = `2034 · ДЕНЬ ${String(clock.day).padStart(2, '0')}`;
      const signature = `${dateLabel}|${formatClock(clock.hour)}|${skyCondition}|${windLabel}|${Math.round(currentWind)}`;
      if (signature !== lastHudSignature) {
        lastHudSignature = signature;
        onHud({ date: dateLabel, clock: formatClock(clock.hour), weather: `${skyCondition} · ${windLabel} ${currentWind.toFixed(1)} м/с` });
      }
    }
  }

  function snapshot() {
    return { hour: clock.hour, day: clock.day, elapsed: clock.elapsed, cloudOffset: [cloudOffset.x, cloudOffset.y], windSpeed: wind.speed, windDirectionDeg: wind.direction, cloudCoverage: wind.coverage };
  }
  function restore(data) {
    if (!data || typeof data !== 'object') return;
    setTime(Number(data.hour));
    if (Number.isInteger(data.day)) clock.day = Math.max(1, data.day);
    if (Number.isFinite(data.elapsed)) clock.elapsed = Math.max(0, data.elapsed);
    if (Array.isArray(data.cloudOffset) && data.cloudOffset.length === 2 && data.cloudOffset.every(Number.isFinite)) cloudOffset.set(data.cloudOffset[0], data.cloudOffset[1]);
    setWeather({ windSpeed: Number(data.windSpeed), windDirectionDeg: Number(data.windDirectionDeg), cloudCoverage: Number(data.cloudCoverage) });
    uniforms.uCloudOffset.value.copy(cloudOffset);
    lastHudSignature = '';
  }
  function reset() {
    clock.hour = CONFIG.startHour;
    clock.day = 1;
    clock.elapsed = 0;
    cloudOffset.set(0, 0);
    wind.speed = CONFIG.windSpeed;
    wind.direction = CONFIG.windDirectionDeg;
    wind.coverage = CONFIG.cloudCoverage;
    uniforms.uCloudOffset.value.set(0, 0);
    uniforms.uCloudCoverage.value = wind.coverage;
    lastHudSignature = '';
  }
  // Debug/QA hook: can force calm, storm, noon or midnight during local testing.
  if (typeof window !== 'undefined') window.__TISHINA_SKY_TEST__ = { setTime, setWeather, snapshot };
  update(0.001, 0);
  return { update, snapshot, restore, reset, setTime, setWeather };
}
