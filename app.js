// ------------------------------------------------------------
    // Core scene
    // ------------------------------------------------------------
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.00055);

    const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 6000);
    camera.position.set(0, 80, 220);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0x8090a8, 0.62);
    scene.add(ambient);

    const keyLight = new THREE.PointLight(0xdde9ff, 1.4, 2500);
    keyLight.position.set(0, 200, 150);
    scene.add(keyLight);

    const blueLight = new THREE.PointLight(0x78bbff, 0.8, 1800);
    blueLight.position.set(-180, -50, 80);
    scene.add(blueLight);

    // ------------------------------------------------------------
    // Simple orbit controls without external dependency
    // ------------------------------------------------------------
    let target = new THREE.Vector3(0, 0, 0);
    let cameraRadius = 240;
    let yaw = 0.15;
    let pitch = 0.25;
    let dragging = false;
    let lastX = 0, lastY = 0;

    renderer.domElement.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener('pointerup', () => dragging = false);
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      yaw -= dx * 0.004;
      pitch -= dy * 0.004;
      pitch = Math.max(-1.25, Math.min(1.25, pitch));
    });
    window.addEventListener('wheel', (e) => {
      cameraRadius *= (1 + Math.sign(e.deltaY) * 0.08);
      cameraRadius = Math.max(20, Math.min(1200, cameraRadius));
    }, { passive: true });

    function updateCamera() {
      const x = target.x + Math.cos(pitch) * Math.sin(yaw) * cameraRadius;
      const y = target.y + Math.sin(pitch) * cameraRadius;
      const z = target.z + Math.cos(pitch) * Math.cos(yaw) * cameraRadius;
      camera.position.lerp(new THREE.Vector3(x, y, z), 0.09);
      camera.lookAt(target);
    }

    // ------------------------------------------------------------
    // UI
    // ------------------------------------------------------------
    const $ = id => document.getElementById(id);

    const speedSlider = $('speed');
    const fluctSlider = $('fluct');
    const expandSlider = $('expand');
    const gravitySlider = $('gravity');
    const accretionSlider = $('accretion');
    const wSlider = $('wSlider');
    const qSlider = $('qSlider');

    const statusEl = $('status');
    const phaseButtons = [...document.querySelectorAll('.phaseBtn')];

    let simSpeed = 1.0;
    let fluctAmp = 0.20;
    let expansionStrength = 1.00;
    let gravityStrength = 1.00;
    let accretionEfficiency = 0.10;
    let projectionMode = 3;
    let wProject = 0.50;
    let qProject = 0.50;

    function syncUI() {
      $('speedVal').textContent = simSpeed.toFixed(1) + '×';
      $('fluctVal').textContent = fluctAmp.toFixed(2);
      $('expandVal').textContent = expansionStrength.toFixed(2);
      $('gravityVal').textContent = gravityStrength.toFixed(2);
      $('accretionVal').textContent = accretionEfficiency.toFixed(2);
      $('wVal').textContent = wProject.toFixed(2);
      $('qVal').textContent = qProject.toFixed(2);
      $('projectionLabel').textContent = projectionMode + 'D';
    }
    syncUI();

    speedSlider.addEventListener('input', () => { simSpeed = Number(speedSlider.value); syncUI(); });
    fluctSlider.addEventListener('input', () => { fluctAmp = Number(fluctSlider.value); syncUI(); rebuildFieldForCurrentPhase(); });
    expandSlider.addEventListener('input', () => { expansionStrength = Number(expandSlider.value); syncUI(); });
    gravitySlider.addEventListener('input', () => { gravityStrength = Number(gravitySlider.value); syncUI(); });
    accretionSlider.addEventListener('input', () => { accretionEfficiency = Number(accretionSlider.value); syncUI(); });
    wSlider.addEventListener('input', () => { wProject = Number(wSlider.value); syncUI(); });
    qSlider.addEventListener('input', () => { qProject = Number(qSlider.value); syncUI(); });
    $('proj3Btn').addEventListener('click', () => { projectionMode = 3; syncUI(); });
    $('proj4Btn').addEventListener('click', () => { projectionMode = 4; syncUI(); });
    $('proj5Btn').addEventListener('click', () => { projectionMode = 5; syncUI(); });

    // ------------------------------------------------------------
    // Cosmology state
    // ------------------------------------------------------------
    const STAGES = [
      'Vacuum state',
      'Quantum fluctuations',
      'Inflation',
      'Hot plasma / Big Bang aftermath',
      'Recombination / structure seeds',
      'First stars and black-hole seeds',
      'Galaxies form',
      'Milky Way and Andromeda',
      'Collision and merger remnant',
      'Solar System focus'
    ];

    let stage = 0;
    let playing = true;
    let cosmicTime = 0;
    let stageTime = 0;
    let stageDuration = 13; // seconds per stage while auto-playing
    let scaleFactor = 1.0;
    let tempProxy = 0.0;
    let remnantType = '—';

    $('playBtn').addEventListener('click', () => playing = true);
    $('pauseBtn').addEventListener('click', () => playing = false);
    $('nextBtn').addEventListener('click', () => setStage(Math.min(STAGES.length - 1, stage + 1)));
    $('resetBtn').addEventListener('click', () => resetSimulation());
    $('viewUniverseBtn').addEventListener('click', () => focusUniverse());
    $('viewSolarBtn').addEventListener('click', () => focusSolarSystem());
    $('collisionBtn').addEventListener('click', () => simulateMilkyWayAndromedaCollision());
    phaseButtons.forEach(btn => btn.addEventListener('click', () => setStage(Number(btn.dataset.phase))));

    function setStatus(text) {
      statusEl.innerHTML = text;
    }

    function highlightPhase() {
      phaseButtons.forEach((btn, i) => {
        btn.style.outline = i === stage ? '1px solid rgba(142,232,255,.6)' : 'none';
        btn.style.background = i === stage
          ? 'linear-gradient(180deg, rgba(36,64,96,.98), rgba(12,20,36,.99))'
          : 'linear-gradient(180deg, rgba(22,40,70,.92), rgba(11,18,32,.98))';
      });
    }

    // ------------------------------------------------------------
    // Background "vast emptiness"
    // ------------------------------------------------------------
    const deepFieldGroup = new THREE.Group();
    scene.add(deepFieldGroup);

    const deepFieldGeo = new THREE.BufferGeometry();
    const deepFieldCount = 6500;
    const deepPos = new Float32Array(deepFieldCount * 3);
    const deepCol = new Float32Array(deepFieldCount * 3);

    for (let i = 0; i < deepFieldCount; i++) {
      const radius = 800 + Math.random() * 2600;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
      deepPos[i*3] = radius * Math.sin(phi) * Math.cos(theta);
      deepPos[i*3+1] = radius * Math.sin(phi) * Math.sin(theta);
      deepPos[i*3+2] = radius * Math.cos(phi);
      const c = 0.6 + Math.random() * 0.4;
      deepCol[i*3] = c;
      deepCol[i*3+1] = c;
      deepCol[i*3+2] = 1.0;
    }
    deepFieldGeo.setAttribute('position', new THREE.BufferAttribute(deepPos, 3));
    deepFieldGeo.setAttribute('color', new THREE.BufferAttribute(deepCol, 3));
    const deepField = new THREE.Points(deepFieldGeo, new THREE.PointsMaterial({
      size: 1.25, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false
    }));
    deepFieldGroup.add(deepField);

    // ------------------------------------------------------------
    // Scalar field / primordial particles
    // ------------------------------------------------------------
    const fieldGroup = new THREE.Group();
    scene.add(fieldGroup);

    let fieldPoints = null;
    let fieldCount = 7200;
    let fieldRaw = [];
    let fieldVel = [];
    let fieldW = [];
    let fieldQ = [];

    function seededNoise(i) {
      const x = Math.sin(i * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    }

    function buildScalarField(mode='vacuum') {
      while (fieldGroup.children.length) fieldGroup.remove(fieldGroup.children[0]);
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(fieldCount * 3);
      const colors = new Float32Array(fieldCount * 3);
      fieldRaw = [];
      fieldVel = [];
      fieldW = [];
      fieldQ = [];

      for (let i = 0; i < fieldCount; i++) {
        let x=0,y=0,z=0, vx=0,vy=0,vz=0, energy=0.05;
        const r = Math.pow(Math.random(), 0.65) * (mode === 'vacuum' ? 1.2 : mode === 'fluct' ? 10 : 24);
        const t = Math.random() * Math.PI * 2;
        const p = Math.acos(THREE.MathUtils.randFloatSpread(2));

        if (mode === 'vacuum') {
          x = (seededNoise(i) - 0.5) * 0.12;
          y = (seededNoise(i+11) - 0.5) * 0.12;
          z = (seededNoise(i+23) - 0.5) * 0.12;
          energy = 0.02;
        } else {
          x = r * Math.sin(p) * Math.cos(t);
          y = r * Math.sin(p) * Math.sin(t);
          z = r * Math.cos(p);
          energy = 0.15 + fluctAmp * (seededNoise(i*7.1) - 0.5);
        }

        const w = seededNoise(i*5.7);
        const q = seededNoise(i*9.1);

        positions[i*3] = x;
        positions[i*3+1] = y;
        positions[i*3+2] = z;

        const base = THREE.MathUtils.clamp(0.35 + energy, 0, 1);
        colors[i*3] = 0.2 + base * 0.55;
        colors[i*3+1] = 0.3 + base * 0.55;
        colors[i*3+2] = 0.5 + base * 0.5;

        fieldRaw.push({ x, y, z, energy, alive:true });
        fieldVel.push({ x:vx, y:vy, z:vz });
        fieldW.push(w);
        fieldQ.push(q);
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      fieldPoints = new THREE.Points(geometry, new THREE.PointsMaterial({
        size: 0.9,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }));
      fieldGroup.add(fieldPoints);
    }

    // ------------------------------------------------------------
    // Galaxies and black holes
    // ------------------------------------------------------------
    const galaxyGroup = new THREE.Group();
    scene.add(galaxyGroup);

    const galaxies = [];
    let totalConsumed = 0;
    let totalAccretionRate = 0;
    let milkyWay = null;
    let andromeda = null;
    let mergerActive = false;

    function createBlackHoleVisual(radius=2.8) {
      const g = new THREE.Group();

      const horizon = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 24, 24),
        new THREE.MeshStandardMaterial({ color: 0x040404, roughness: 0.98, metalness: 0.1 })
      );
      g.add(horizon);

      const disk = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 1.7, radius * 0.35, 12, 72),
        new THREE.MeshBasicMaterial({ color: 0xff9d41, transparent: true, opacity: 0.74 })
      );
      disk.rotation.x = Math.PI * 0.5;
      g.add(disk);

      const hotDisk = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 1.25, radius * 0.14, 10, 64),
        new THREE.MeshBasicMaterial({ color: 0xfff0ab, transparent: true, opacity: 0.68 })
      );
      hotDisk.rotation.x = Math.PI * 0.5 + 0.08;
      g.add(hotDisk);

      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 2.7, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffbb66, transparent: true, opacity: 0.07, side: THREE.DoubleSide })
      );
      g.add(halo);

      g.userData = { horizon, disk, hotDisk, halo };
      return g;
    }

    class Galaxy {
      constructor(options={}) {
        this.name = options.name || 'Galaxy';
        this.center = (options.center || new THREE.Vector3()).clone();
        this.velocity = (options.velocity || new THREE.Vector3()).clone();
        this.radius = options.radius || 42;
        this.starCount = options.starCount || 900;
        this.spin = options.spin || 1;
        this.colorBias = options.colorBias || new THREE.Color(0.75, 0.86, 1.0);
        this.type = options.type || 'spiral';
        this.mass = options.mass || 9e11; // proxy mass
        this.collisionMix = 0;
        this.starburst = 0;

        this.positions = new Float32Array(this.starCount * 3);
        this.colors = new Float32Array(this.starCount * 3);
        this.stars = [];

        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

        this.material = new THREE.PointsMaterial({
          size: 1.05,
          vertexColors: true,
          transparent: true,
          opacity: 0.93,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });

        this.points = new THREE.Points(this.geometry, this.material);
        galaxyGroup.add(this.points);

        this.blackHole = {
          mass: options.blackHoleMass || 4e6,
          position: this.center.clone(),
          accretionDiskMass: 0,
          accretionRate: 0,
          eventHorizon: 2.4,
          influenceRadius: 22,
          visual: createBlackHoleVisual(2.7)
        };
        this.blackHole.visual.position.copy(this.center);
        galaxyGroup.add(this.blackHole.visual);

        this.initStars();
      }

      schwarzschildRadiusProxy() {
        // Browser-scale proxy derived from black-hole mass, not SI-units exact rendering.
        return Math.max(1.5, Math.pow(this.blackHole.mass / 4e6, 1/3) * 2.2);
      }

      initStars() {
        for (let i = 0; i < this.starCount; i++) {
          this.spawnStar(i, true);
        }
      }

      spawnStar(i, initial=false) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.pow(Math.random(), 0.72) * this.radius + 4;
        const armWarp = Math.sin(angle * 2 + radius * 0.14) * this.radius * 0.14;
        const thickness = THREE.MathUtils.randFloatSpread(this.radius * 0.18);

        let x = this.center.x + Math.cos(angle) * radius + Math.cos(angle * 2.5) * armWarp;
        let y = this.center.y + thickness;
        let z = this.center.z + Math.sin(angle) * radius;

        if (this.type === 'elliptical') {
          x = this.center.x + THREE.MathUtils.randFloatSpread(this.radius * 1.3);
          y = this.center.y + THREE.MathUtils.randFloatSpread(this.radius * 0.8);
          z = this.center.z + THREE.MathUtils.randFloatSpread(this.radius * 1.0);
        }

        const dx = x - this.center.x;
        const dz = z - this.center.z;
        const planar = Math.sqrt(dx*dx + dz*dz) + 0.001;
        const tx = -dz / planar * this.spin;
        const tz = dx / planar * this.spin;
        const v = Math.sqrt((this.mass * 1e-11) / (planar + 8)) * 0.9;

        const star = {
          x, y, z,
          vx: tx * v + this.velocity.x + THREE.MathUtils.randFloatSpread(0.08),
          vy: this.velocity.y + THREE.MathUtils.randFloatSpread(0.03),
          vz: tz * v + this.velocity.z + THREE.MathUtils.randFloatSpread(0.08),
          mass: 0.5 + Math.random() * 4,
          lum: 0.75 + Math.random() * 0.6,
          age: initial ? Math.random() * 3 : 0,
          energy: 0.85 + Math.random() * 0.35,
          w: Math.random(),
          q: Math.random()
        };
        this.stars[i] = star;
        this.positions[i*3] = star.x;
        this.positions[i*3+1] = star.y;
        this.positions[i*3+2] = star.z;
        const c = star.energy;
        this.colors[i*3] = 0.4 + c * 0.5 * this.colorBias.r;
        this.colors[i*3+1] = 0.45 + c * 0.5 * this.colorBias.g;
        this.colors[i*3+2] = 0.55 + c * 0.5 * this.colorBias.b;
      }

      update(dt, galaxies) {
        this.center.addScaledVector(this.velocity, dt);
        this.blackHole.position.copy(this.center);
        this.blackHole.eventHorizon = this.schwarzschildRadiusProxy();
        this.blackHole.influenceRadius = this.blackHole.eventHorizon * 7.6;

        let localAccretion = 0;
        for (let i = 0; i < this.starCount; i++) {
          const s = this.stars[i];
          s.age += dt;

          // Rotation around central potential with softened gravity
          const dx = this.center.x - s.x;
          const dy = this.center.y - s.y;
          const dz = this.center.z - s.z;
          const r2 = dx*dx + dy*dy + dz*dz + 16.0;
          const r = Math.sqrt(r2);

          const gSelf = gravityStrength * (this.mass * 2.2e-13) / r2;
          s.vx += dx / r * gSelf * dt;
          s.vy += dy / r * gSelf * dt * 0.8;
          s.vz += dz / r * gSelf * dt;

          // Tidal effects from other galaxies
          for (const other of galaxies) {
            if (other === this) continue;
            const odx = other.center.x - s.x;
            const ody = other.center.y - s.y;
            const odz = other.center.z - s.z;
            const or2 = odx*odx + ody*ody + odz*odz + 36.0;
            const or = Math.sqrt(or2);
            const gOther = gravityStrength * (other.mass * 1.0e-13) / or2;
            s.vx += odx / or * gOther * dt;
            s.vy += ody / or * gOther * dt * 0.7;
            s.vz += odz / or * gOther * dt;

            const centerDist = this.center.distanceTo(other.center);
            if (centerDist < this.radius + other.radius + 28) {
              this.collisionMix = Math.min(1, this.collisionMix + dt * 0.08);
              this.starburst = Math.min(1, this.starburst + dt * 0.06);
              s.vx += THREE.MathUtils.randFloatSpread(0.015) * dt * 10;
              s.vy += THREE.MathUtils.randFloatSpread(0.009) * dt * 10;
              s.vz += THREE.MathUtils.randFloatSpread(0.015) * dt * 10;
            }
          }

          // Black-hole zone and accretion
          const bdx = this.blackHole.position.x - s.x;
          const bdy = this.blackHole.position.y - s.y;
          const bdz = this.blackHole.position.z - s.z;
          const br2 = bdx*bdx + bdy*bdy + bdz*bdz + 0.16;
          const br = Math.sqrt(br2);

          if (br < this.blackHole.influenceRadius) {
            const gbh = gravityStrength * (this.blackHole.mass * 1.8e-9) / br2;
            s.vx += bdx / br * gbh * dt;
            s.vy += bdy / br * gbh * dt;
            s.vz += bdz / br * gbh * dt;

            const drain = Math.max(0, 1 - br / this.blackHole.influenceRadius);
            s.energy -= drain * dt * 0.04;
            this.blackHole.accretionDiskMass += s.mass * drain * dt * 0.002;
            localAccretion += s.mass * drain * dt * 0.0005;
          }

          // Eddington-like cap on accretion proxy
          const eddCap = Math.max(0.00006, this.blackHole.mass * 2.4e-11);
          this.blackHole.accretionRate = Math.min(localAccretion * accretionEfficiency, eddCap);
          this.blackHole.mass += this.blackHole.accretionRate;

          // Capture inside event horizon
          if (br < this.blackHole.eventHorizon * 1.1 || s.energy <= 0) {
            totalConsumed++;
            this.spawnStar(i, false);
            continue;
          }

          // Star motion
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.z += s.vz * dt;

          // Damping
          s.vx *= 0.9992;
          s.vy *= 0.9992;
          s.vz *= 0.9992;

          // Recycle extremely far stars as tidal debris sources
          const dist = Math.sqrt((s.x - this.center.x)**2 + (s.y - this.center.y)**2 + (s.z - this.center.z)**2);
          if (dist > this.radius * 5.2) {
            this.spawnStar(i, false);
            continue;
          }

          // Visual projection modes
          let px = s.x, py = s.y, pz = s.z;
          if (projectionMode >= 4) {
            const w = s.w;
            const factor = 1 + (w - 0.5) * (wProject * 0.9);
            px = this.center.x + (px - this.center.x) * factor;
            py = this.center.y + (py - this.center.y) * (1 + (w - 0.5) * wProject * 0.6);
          }
          if (projectionMode >= 5) {
            const q = s.q;
            pz = this.center.z + (pz - this.center.z) * (1 + (q - 0.5) * qProject * 0.9);
            py += (q - 0.5) * qProject * 7;
          }

          this.positions[i*3] = px;
          this.positions[i*3+1] = py;
          this.positions[i*3+2] = pz;

          const heat = Math.min(1.2, s.energy + this.starburst * 0.25);
          this.colors[i*3] = Math.min(1, 0.38 + heat * 0.6 + this.collisionMix * 0.12);
          this.colors[i*3+1] = Math.min(1, 0.42 + heat * 0.5);
          this.colors[i*3+2] = Math.max(0.05, 0.60 + heat * 0.36 - Math.max(0, 0.6 - s.energy) * 0.5);
        }

        this.points.geometry.attributes.position.needsUpdate = true;
        this.points.geometry.attributes.color.needsUpdate = true;

        // Visual evolution of black hole and accretion disk
        const scale = THREE.MathUtils.clamp(0.75 + Math.log10(this.blackHole.mass + 1) / 5.8, 0.9, 2.4);
        this.blackHole.visual.scale.setScalar(scale);
        this.blackHole.visual.position.copy(this.blackHole.position);
        this.blackHole.visual.rotation.y += dt * 1.6;
        this.blackHole.visual.rotation.z += dt * 0.55;
        this.blackHole.visual.userData.disk.scale.set(1 + this.blackHole.accretionRate * 800, 1, 1 + this.blackHole.accretionRate * 800);
        this.blackHole.visual.userData.hotDisk.material.opacity = THREE.MathUtils.clamp(0.36 + this.blackHole.accretionRate * 1200, 0.38, 0.95);

        this.collisionMix *= 0.996;
        this.starburst *= 0.995;
      }

      convertToMergerRemnant() {
        this.type = 'elliptical';
        this.radius *= 1.18;
        this.mass *= 1.05;
        this.starburst = 0.7;
        remnantType = 'Elliptical-like merger remnant';
      }
    }

    function clearGalaxies() {
      while (galaxyGroup.children.length) {
        const child = galaxyGroup.children[0];
        galaxyGroup.remove(child);
      }
      galaxies.length = 0;
      milkyWay = null;
      andromeda = null;
      mergerActive = false;
      totalConsumed = 0;
      totalAccretionRate = 0;
      remnantType = '—';
    }

    function spawnGenericGalaxy(center, velocity) {
      const g = new Galaxy({
        center: center || new THREE.Vector3(THREE.MathUtils.randFloatSpread(320), THREE.MathUtils.randFloatSpread(80), THREE.MathUtils.randFloatSpread(120)),
        velocity: velocity || new THREE.Vector3(THREE.MathUtils.randFloatSpread(0.6), THREE.MathUtils.randFloatSpread(0.08), THREE.MathUtils.randFloatSpread(0.15)),
        radius: 34 + Math.random() * 20,
        starCount: 700 + Math.floor(Math.random() * 500),
        spin: Math.random() > 0.5 ? 1 : -1,
        mass: 5e11 + Math.random() * 7e11,
        blackHoleMass: 2e6 + Math.random() * 8e6,
        colorBias: new THREE.Color(0.72 + Math.random() * 0.2, 0.80 + Math.random() * 0.1, 1.0)
      });
      galaxies.push(g);
      return g;
    }

    function buildMilkyWayAndAndromeda() {
      clearGalaxies();

      milkyWay = new Galaxy({
        name: 'Milky Way',
        center: new THREE.Vector3(-65, 4, -6),
        velocity: new THREE.Vector3(0.12, 0.0, 0.02),
        radius: 50,
        starCount: 1200,
        spin: 1,
        type: 'spiral',
        mass: 1.15e12,
        blackHoleMass: 4.3e6,
        colorBias: new THREE.Color(0.72, 0.84, 1.0)
      });

      andromeda = new Galaxy({
        name: 'Andromeda',
        center: new THREE.Vector3(85, -2, 10),
        velocity: new THREE.Vector3(-0.10, 0.0, -0.015),
        radius: 58,
        starCount: 1450,
        spin: -1,
        type: 'spiral',
        mass: 1.45e12,
        blackHoleMass: 1.1e8,
        colorBias: new THREE.Color(0.85, 0.84, 1.0)
      });

      galaxies.push(milkyWay, andromeda);
    }

    function simulateMilkyWayAndromedaCollision() {
      if (!milkyWay || !andromeda) {
        buildMilkyWayAndAndromeda();
        setStage(7);
      }
      milkyWay.velocity.set(0.48, 0.0, 0.01);
      andromeda.velocity.set(-0.56, 0.0, -0.01);
      milkyWay.starburst = 0.3;
      andromeda.starburst = 0.35;
      mergerActive = true;
      stage = Math.max(stage, 8);
      stageTime = 0;
      remnantType = 'Tidal-bridge merger in progress';
      setStatus(
        '<strong>Collision running.</strong> The two galaxies are now on a merger track. ' +
        'Tidal stripping, bridge formation, starburst heating, and eventual elliptical-like remnant growth are enabled.'
      );
      highlightPhase();
    }

    // ------------------------------------------------------------
    // Solar system
    // ------------------------------------------------------------
    const solarGroup = new THREE.Group();
    scene.add(solarGroup);
    solarGroup.visible = false;
    solarGroup.position.set(420, 0, 0);

    const solar = {
      planets: {},
      moonPivot: null
    };

    function buildSolarSystem() {
      while (solarGroup.children.length) solarGroup.remove(solarGroup.children[0]);

      const sun = new THREE.Mesh(
        new THREE.SphereGeometry(8.5, 28, 28),
        new THREE.MeshBasicMaterial({ color: 0xffcd67 })
      );
      solarGroup.add(sun);

      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(14, 22, 22),
        new THREE.MeshBasicMaterial({ color: 0xffa53d, transparent: true, opacity: 0.12 })
      );
      solarGroup.add(glow);

      const defs = [
        ['Mercury', 14, 0.8, 0xb2b2b2, 0.018],
        ['Venus',   20, 1.3, 0xd8b67a, 0.014],
        ['Earth',   27, 1.4, 0x4f93ff, 0.0118],
        ['Mars',    35, 1.0, 0xc96948, 0.0095],
        ['Jupiter', 49, 3.2, 0xd0b08d, 0.0060],
        ['Saturn',  63, 2.7, 0xd8c56e, 0.0049],
        ['Uranus',  76, 2.1, 0x94d8e8, 0.0036],
        ['Neptune', 88, 2.0, 0x568eff, 0.0031]
      ];

      defs.forEach(([name, orbit, size, color, speed]) => {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(orbit - 0.04, orbit + 0.04, 128),
          new THREE.MeshBasicMaterial({ color: 0x345070, side: THREE.DoubleSide, transparent: true, opacity: 0.34 })
        );
        ring.rotation.x = Math.PI * 0.5;
        solarGroup.add(ring);

        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(size, 18, 18),
          new THREE.MeshStandardMaterial({ color, roughness: 0.96, metalness: 0.02 })
        );
        mesh.userData = { name, orbit, speed, angle: Math.random() * Math.PI * 2 };
        solar.planets[name] = mesh;
        solarGroup.add(mesh);

        if (name === 'Saturn') {
          const saturnRing = new THREE.Mesh(
            new THREE.RingGeometry(size * 1.4, size * 2.25, 56),
            new THREE.MeshBasicMaterial({ color: 0xdaca8f, side: THREE.DoubleSide, transparent: true, opacity: 0.76 })
          );
          saturnRing.rotation.x = Math.PI * 0.5;
          mesh.add(saturnRing);
        }

        if (name === 'Earth') {
          const pivot = new THREE.Group();
          mesh.add(pivot);
          const moon = new THREE.Mesh(
            new THREE.SphereGeometry(0.34, 12, 12),
            new THREE.MeshStandardMaterial({ color: 0xbababa, roughness: 1.0 })
          );
          moon.position.set(2.9, 0, 0);
          pivot.add(moon);
          solar.moonPivot = pivot;
        }
      });
    }
    buildSolarSystem();

    function updateSolar(dt, t) {
      Object.values(solar.planets).forEach(p => {
        p.userData.angle += p.userData.speed * dt * 0.8;
        p.position.set(
          Math.cos(p.userData.angle) * p.userData.orbit,
          0,
          Math.sin(p.userData.angle) * p.userData.orbit
        );
        p.rotation.y += 0.01 * dt;
      });
      if (solar.moonPivot) solar.moonPivot.rotation.y += 0.038 * dt;
    }

    function focusSolarSystem() {
      target.copy(solarGroup.position);
      $('metricTarget').textContent = 'Solar System';
      solarGroup.visible = true;
    }

    function focusUniverse() {
      target.set(0, 0, 0);
      $('metricTarget').textContent = 'Universe';
    }

    // ------------------------------------------------------------
    // Stage initialization
    // ------------------------------------------------------------
    function rebuildFieldForCurrentPhase() {
      if (stage === 0) buildScalarField('vacuum');
      else if (stage === 1) buildScalarField('fluct');
      else if (stage >= 2 && stage <= 4) buildScalarField('plasma');
    }

    function setStage(n) {
      stage = n;
      stageTime = 0;
      cosmicTime = Math.max(cosmicTime, stage);
      highlightPhase();

      if (stage <= 4) {
        clearGalaxies();
        solarGroup.visible = false;
      }

      if (stage === 0) {
        buildScalarField('vacuum');
        scaleFactor = 1.0;
        tempProxy = 0.0;
        remnantType = '—';
        setStatus('<strong>Vacuum state.</strong> Sparse quantum vacuum with near-zero visible excitations. The scene is intentionally almost empty.');
        focusUniverse();
      } else if (stage === 1) {
        buildScalarField('fluct');
        setStatus('<strong>Quantum fluctuations.</strong> A Gaussian random field creates tiny energy-density perturbations in an otherwise near-empty vacuum.');
      } else if (stage === 2) {
        buildScalarField('plasma');
        setStatus('<strong>Inflation.</strong> The scale factor grows exponentially for a short interval, stretching primordial fluctuations into large-scale seeds.');
      } else if (stage === 3) {
        buildScalarField('plasma');
        setStatus('<strong>Hot Big Bang aftermath.</strong> Expansion continues, temperature remains high, and the primordial medium is still plasma-like.');
      } else if (stage === 4) {
        buildScalarField('plasma');
        setStatus('<strong>Recombination and structure seeds.</strong> The universe cools enough for neutral matter to emerge; density contrast remains as the source of later collapse.');
      } else if (stage === 5) {
        if (!fieldPoints) buildScalarField('plasma');
        clearGalaxies();
        spawnGenericGalaxy(new THREE.Vector3(-80, 0, 10), new THREE.Vector3(0.08, 0, 0.01));
        galaxies[0].blackHole.mass *= 0.55;
        setStatus('<strong>First stars and black-hole seeds.</strong> Overdense regions collapse. Some massive stars leave compact remnants that begin accreting gas.');
      } else if (stage === 6) {
        clearGalaxies();
        spawnGenericGalaxy(new THREE.Vector3(-110, -10, -6), new THREE.Vector3(0.10, 0.0, 0.02));
        spawnGenericGalaxy(new THREE.Vector3(10, 12, 8), new THREE.Vector3(-0.05, 0.0, -0.01));
        spawnGenericGalaxy(new THREE.Vector3(120, -6, 14), new THREE.Vector3(-0.08, 0.0, -0.02));
        setStatus('<strong>Galaxies form.</strong> Softened gravity and angular momentum shape rotating stellar systems around growing black holes.');
      } else if (stage === 7) {
        buildMilkyWayAndAndromeda();
        setStatus('<strong>Milky Way and Andromeda.</strong> Two nearby spiral galaxies are staged with different masses and central black holes. Use the collision button to merge them.');
      } else if (stage === 8) {
        if (!milkyWay || !andromeda) buildMilkyWayAndAndromeda();
        simulateMilkyWayAndromedaCollision();
      } else if (stage === 9) {
        if (!milkyWay || !andromeda) buildMilkyWayAndAndromeda();
        solarGroup.visible = true;
        focusSolarSystem();
        setStatus('<strong>Solar System focus.</strong> A local stellar system is shown inside the larger universe after structure formation, highlighting Earth and the major planets.');
      }
      updateMetrics();
    }

    function resetSimulation() {
      playing = true;
      cosmicTime = 0;
      totalConsumed = 0;
      stage = 0;
      stageTime = 0;
      setStage(0);
    }

    // ------------------------------------------------------------
    // Physics updates
    // ------------------------------------------------------------
    function updateScalarField(dt) {
      if (!fieldPoints) return;
      const pos = fieldPoints.geometry.attributes.position.array;
      const col = fieldPoints.geometry.attributes.color.array;

      for (let i = 0; i < fieldCount; i++) {
        const p = fieldRaw[i];
        const v = fieldVel[i];
        const w = fieldW[i];
        const q = fieldQ[i];

        if (stage === 0) {
          p.x += (seededNoise(i + cosmicTime * 10) - 0.5) * 0.0008;
          p.y += (seededNoise(i + 100 + cosmicTime * 10) - 0.5) * 0.0008;
          p.z += (seededNoise(i + 200 + cosmicTime * 10) - 0.5) * 0.0008;
        } else if (stage === 1) {
          const amp = fluctAmp * 0.15;
          p.x += Math.sin(cosmicTime * 2 + i * 0.1) * amp * 0.01;
          p.y += Math.cos(cosmicTime * 1.7 + i * 0.08) * amp * 0.01;
          p.z += Math.sin(cosmicTime * 2.5 + i * 0.12) * amp * 0.01;
          p.energy = 0.12 + fluctAmp * (seededNoise(i * 7.1) - 0.5) * 0.7;
        } else if (stage >= 2 && stage <= 4) {
          const r = Math.sqrt(p.x*p.x + p.y*p.y + p.z*p.z) + 0.001;
          const infl = stage === 2 ? 1.024 + 0.02 * expansionStrength : stage === 3 ? 1.005 + 0.006 * expansionStrength : 1.0018 + 0.003 * expansionStrength;
          p.x *= infl;
          p.y *= infl;
          p.z *= infl;

          const cooling = stage === 3 ? 0.996 : 0.9985;
          p.energy *= cooling;

          // small density clumping during recombination
          if (stage === 4) {
            const collapse = fluctAmp * 0.0035;
            p.x -= (p.x / r) * collapse * (0.5 + w);
            p.y -= (p.y / r) * collapse * (0.4 + q);
            p.z -= (p.z / r) * collapse * (0.5 + w);
          }
        }

        let px = p.x, py = p.y, pz = p.z;
        if (projectionMode >= 4) {
          const wf = 1 + (w - 0.5) * wProject * 1.0;
          px *= wf;
          py *= 1 + (w - 0.5) * wProject * 0.7;
        }
        if (projectionMode >= 5) {
          pz *= 1 + (q - 0.5) * qProject * 1.0;
          py += (q - 0.5) * qProject * 8;
        }

        pos[i*3] = px;
        pos[i*3+1] = py;
        pos[i*3+2] = pz;

        const b = THREE.MathUtils.clamp(0.18 + p.energy * 1.9, 0.06, 1.0);
        col[i*3]   = Math.min(1, 0.18 + b * 0.75);
        col[i*3+1] = Math.min(1, 0.22 + b * 0.64);
        col[i*3+2] = Math.min(1, 0.35 + b * 0.80);
      }

      fieldPoints.geometry.attributes.position.needsUpdate = true;
      fieldPoints.geometry.attributes.color.needsUpdate = true;
      fieldPoints.rotation.y += 0.0006 * dt;
      fieldPoints.rotation.x += 0.00018 * dt;
    }

    function updateCosmicScalars(dt) {
      if (stage === 0) {
        scaleFactor = 1.0;
        tempProxy = 0.0;
      } else if (stage === 1) {
        scaleFactor = 1.0;
        tempProxy = 0.03 + fluctAmp * 0.1;
      } else if (stage === 2) {
        scaleFactor *= Math.pow(1.08 + 0.03 * expansionStrength, dt * 0.06);
        tempProxy = 1.2;
      } else if (stage === 3) {
        scaleFactor *= Math.pow(1.015 + 0.01 * expansionStrength, dt * 0.06);
        tempProxy = Math.max(0.38, tempProxy * 0.995 + 0.25);
      } else if (stage === 4) {
        scaleFactor *= Math.pow(1.006 + 0.004 * expansionStrength, dt * 0.06);
        tempProxy = Math.max(0.10, tempProxy * 0.995);
      } else {
        scaleFactor *= Math.pow(1.002 + 0.002 * expansionStrength, dt * 0.03);
        tempProxy = Math.max(0.02, tempProxy * 0.998);
      }
      scaleFactor = Math.min(scaleFactor, 2e5);
    }

    function updateGalaxies(dt) {
      totalAccretionRate = 0;
      galaxies.forEach(g => {
        g.update(dt, galaxies);
        totalAccretionRate += g.blackHole.accretionRate;
      });

      if (mergerActive && milkyWay && andromeda) {
        const d = milkyWay.center.distanceTo(andromeda.center);
        if (d < 48) {
          milkyWay.mass += andromeda.mass * 0.25 * dt * 0.01;
          andromeda.mass += milkyWay.mass * 0.12 * dt * 0.002;
          milkyWay.convertToMergerRemnant();
          andromeda.convertToMergerRemnant();
          remnantType = d < 22 ? 'Single large elliptical-like remnant' : 'Late-stage merger remnant';
        }
      }
    }

    function updateMetrics() {
      $('metricStage').textContent = STAGES[stage];
      $('metricScale').textContent = scaleFactor.toFixed(scaleFactor < 100 ? 3 : 1);
      $('metricTemp').textContent = tempProxy.toFixed(3);
      $('metricParticles').textContent = fieldPoints ? fieldCount.toLocaleString() : '0';
      $('metricGalaxies').textContent = galaxies.length.toString();
      $('metricBHs').textContent = galaxies.length.toString();
      $('metricAccretion').textContent = totalAccretionRate.toFixed(6);
      $('metricConsumed').textContent = totalConsumed.toLocaleString();
      $('metricRemnant').textContent = remnantType;
    }

    // ------------------------------------------------------------
    // Initial stage
    // ------------------------------------------------------------
    setStage(0);

    // ------------------------------------------------------------
    // Main loop
    // ------------------------------------------------------------
    const clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);

      const dtRaw = Math.min(0.05, clock.getDelta());
      const dt = dtRaw * simSpeed * 60;

      if (playing) {
        cosmicTime += dtRaw * simSpeed;
        stageTime += dtRaw * simSpeed;

        updateCosmicScalars(dt);

        if (stage <= 4) updateScalarField(dt);
        if (stage >= 5) updateGalaxies(dt);
        if (stage >= 9) updateSolar(dt, cosmicTime);

        if (stageTime > stageDuration && stage < STAGES.length - 1) {
          setStage(stage + 1);
        }
      }

      deepField.rotation.y += 0.00005 * simSpeed;
      deepField.rotation.x += 0.00001 * simSpeed;

      // Solar system visible from late stages onward
      if (stage >= 9) solarGroup.visible = true;

      updateCamera();
      updateMetrics();
      renderer.render(scene, camera);
    }
    animate();

    // ------------------------------------------------------------
    // Resize
    // ------------------------------------------------------------
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
