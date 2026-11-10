// component/shop/ShopScene.ts
// Imperative three.js scene for the shop: a carousel of pedestals, each holding a
// procedurally built low-poly item that spins under a spotlight.
import * as THREE from 'three';
import type { ShopModel } from '@/utils/shopItems';

export interface SceneItem {
  model: ShopModel;
  color: number;
  locked: boolean;
  affordable: boolean;
}

interface Slot {
  root: THREE.Group;
  model: THREE.Group;
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshStandardMaterial>;
  hitbox: THREE.Mesh;
  spinners: THREE.Object3D[];
  item: SceneItem;
}

interface CoinParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
}

const BACKGROUND = 0x0b0714;
const ITEM_HEIGHT = 1.55;

const material = (color: number, options: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.25,
    flatShading: true,
    emissive: color,
    emissiveIntensity: 0.12,
    ...options,
  });

const metal = () => material(0xd4d4d8, { metalness: 0.9, roughness: 0.2, emissiveIntensity: 0.02 });
const dark = () => material(0x1f1b2e, { metalness: 0.5, roughness: 0.5, emissiveIntensity: 0 });

const mesh = (geometry: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};

// Builds the model for one item. Returns the group plus parts that spin on their own.
const buildModel = (kind: ShopModel, color: number): { group: THREE.Group; spinners: THREE.Object3D[] } => {
  const group = new THREE.Group();
  const spinners: THREE.Object3D[] = [];
  const main = material(color);

  switch (kind) {
    case 'sword': {
      const sword = new THREE.Group();
      sword.add(mesh(new THREE.BoxGeometry(0.14, 1.05, 0.05), metal(), 0, 0.35));
      const tip = mesh(new THREE.ConeGeometry(0.1, 0.28, 4), metal(), 0, 1.01);
      tip.rotation.y = Math.PI / 4;
      tip.scale.z = 0.35;
      sword.add(tip);
      sword.add(mesh(new THREE.BoxGeometry(0.55, 0.09, 0.14), main, 0, -0.2));
      sword.add(mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.36, 8), dark(), 0, -0.42));
      sword.add(mesh(new THREE.IcosahedronGeometry(0.09, 0), main, 0, -0.64));
      sword.rotation.z = 0.35;
      sword.scale.setScalar(0.7);
      group.add(sword);
      break;
    }
    case 'gear': {
      const gear = new THREE.Group();
      const disc = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.2, 20), main);
      disc.rotation.x = Math.PI / 2;
      gear.add(disc);
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        const tooth = mesh(new THREE.BoxGeometry(0.16, 0.18, 0.2), main, Math.cos(angle) * 0.48, Math.sin(angle) * 0.48);
        tooth.rotation.z = angle;
        gear.add(tooth);
      }
      const hub = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 12), metal());
      hub.rotation.x = Math.PI / 2;
      gear.add(hub);
      spinners.push(gear);
      group.add(gear);
      break;
    }
    case 'target': {
      const rings = [0x0, 0x1, 0x2, 0x3];
      rings.forEach(i => {
        const radius = 0.6 - i * 0.15;
        const disc = mesh(new THREE.CylinderGeometry(radius, radius, 0.08 + i * 0.03, 28),
          i % 2 === 0 ? material(0xf8fafc, { emissiveIntensity: 0.05 }) : main);
        disc.rotation.x = Math.PI / 2;
        group.add(disc);
      });
      const dart = new THREE.Group();
      dart.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6), metal(), 0, 0.3));
      dart.add(mesh(new THREE.ConeGeometry(0.1, 0.18, 4), material(0xfacc15), 0, 0.62));
      dart.rotation.x = Math.PI / 2 - 0.25;
      dart.position.set(0.05, 0.05, 0.05);
      group.add(dart);
      break;
    }
    case 'drone': {
      const body = mesh(new THREE.SphereGeometry(0.3, 12, 8), main);
      body.scale.y = 0.55;
      group.add(body);
      group.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), material(0xffffff, { emissive: 0x67e8f9, emissiveIntensity: 1.2 }), 0, -0.02, 0.27));
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const arm = mesh(new THREE.BoxGeometry(0.5, 0.05, 0.07), dark(), Math.cos(angle) * 0.3, 0.05, Math.sin(angle) * 0.3);
        arm.rotation.y = -angle;
        group.add(arm);
        const rotor = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 3), material(0xe5e7eb, { transparent: true, opacity: 0.7 }),
          Math.cos(angle) * 0.55, 0.1, Math.sin(angle) * 0.55);
        spinners.push(rotor);
        group.add(rotor);
      }
      break;
    }
    case 'magnet': {
      const arc = mesh(new THREE.TorusGeometry(0.4, 0.15, 10, 20, Math.PI), material(0xdc2626));
      arc.rotation.z = Math.PI;
      group.add(arc);
      [-0.4, 0.4].forEach(x => {
        group.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.35, 10), material(0xdc2626), x, 0.17));
        group.add(mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.18, 10), metal(), x, 0.43));
      });
      group.position.y = -0.1;
      break;
    }
    case 'die': {
      const geometry = new THREE.IcosahedronGeometry(0.55, 0);
      group.add(mesh(geometry, main));
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
      group.add(edges);
      break;
    }
    case 'bomb': {
      group.add(mesh(new THREE.SphereGeometry(0.45, 16, 12), material(0x27272a, { metalness: 0.6, roughness: 0.3, emissiveIntensity: 0 })));
      group.add(mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.14, 10), metal(), 0, 0.47));
      const fuseCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.52, 0), new THREE.Vector3(0.08, 0.68, 0), new THREE.Vector3(0.22, 0.75, 0.04),
      ]);
      group.add(mesh(new THREE.TubeGeometry(fuseCurve, 12, 0.025, 6), material(0xa16207)));
      const spark = mesh(new THREE.IcosahedronGeometry(0.08, 0), new THREE.MeshBasicMaterial({ color: 0xfde047 }), 0.24, 0.77, 0.04);
      spark.userData.flicker = true;
      group.add(spark);
      group.add(new THREE.PointLight(0xfb923c, 2, 2).translateX(0.24).translateY(0.8));
      break;
    }
    case 'bolt': {
      const shape = new THREE.Shape();
      shape.moveTo(0.1, 0.7);
      shape.lineTo(-0.3, 0.0);
      shape.lineTo(-0.02, 0.0);
      shape.lineTo(-0.15, -0.7);
      shape.lineTo(0.32, 0.12);
      shape.lineTo(0.04, 0.12);
      shape.lineTo(0.22, 0.7);
      shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 });
      geometry.center();
      group.add(mesh(geometry, material(color, { emissiveIntensity: 0.6, metalness: 0.4 })));
      break;
    }
    case 'potion':
    case 'elixir': {
      const glass = material(color, { transparent: true, opacity: 0.82, emissiveIntensity: 0.5, roughness: 0.1 });
      if (kind === 'potion') {
        group.add(mesh(new THREE.SphereGeometry(0.4, 14, 10), glass, 0, -0.1));
      } else {
        group.add(mesh(new THREE.CylinderGeometry(0.22, 0.36, 0.7, 8), glass, 0, -0.05));
      }
      group.add(mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.35, 10), glass, 0, kind === 'potion' ? 0.42 : 0.47));
      group.add(mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.14, 10), material(0x92400e, { emissiveIntensity: 0 }), 0, kind === 'potion' ? 0.65 : 0.7));
      // Bubbles floating inside
      for (let i = 0; i < 4; i++) {
        const bubble = mesh(new THREE.SphereGeometry(0.04 + i * 0.01, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }),
          (i - 1.5) * 0.1, -0.1 + i * 0.08, 0.15);
        bubble.userData.bubble = i;
        group.add(bubble);
      }
      break;
    }
    case 'box': {
      group.add(mesh(new THREE.BoxGeometry(0.75, 0.62, 0.75), main, 0, -0.12));
      const gold = material(0xfacc15, { metalness: 0.7 });
      group.add(mesh(new THREE.BoxGeometry(0.82, 0.18, 0.82), main, 0, 0.27));
      group.add(mesh(new THREE.BoxGeometry(0.14, 0.82, 0.84), gold, 0, 0.0));
      group.add(mesh(new THREE.BoxGeometry(0.84, 0.82, 0.14), gold, 0, 0.0));
      [-1, 1].forEach(side => {
        const loop = mesh(new THREE.TorusGeometry(0.13, 0.04, 6, 12), gold, side * 0.13, 0.45);
        loop.rotation.y = Math.PI / 2;
        loop.rotation.x = side * 0.5;
        group.add(loop);
      });
      break;
    }
    case 'lens': {
      const lens = new THREE.Group();
      const ring = mesh(new THREE.TorusGeometry(0.4, 0.065, 8, 24), material(0xfacc15, { metalness: 0.8 }));
      lens.add(ring);
      const glass = mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.03, 24),
        new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.35, emissive: color, emissiveIntensity: 0.4, roughness: 0 }));
      glass.rotation.x = Math.PI / 2;
      lens.add(glass);
      const handle = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.55, 8), material(0x78350f, { emissiveIntensity: 0 }), 0.42, -0.42);
      handle.rotation.z = Math.PI / 4;
      lens.add(handle);
      lens.rotation.z = -0.2;
      group.add(lens);
      break;
    }
  }

  return { group, spinners };
};

// Darkens every material in a model so locked items read as silhouettes
const silhouette = (group: THREE.Object3D) => {
  group.traverse(child => {
    const m = child as THREE.Mesh;
    if (m.isMesh) {
      m.material = new THREE.MeshStandardMaterial({ color: 0x110d1c, roughness: 0.9, emissive: 0x2e1065, emissiveIntensity: 0.25 });
    }
    if ((child as THREE.LineSegments).isLineSegments) child.visible = false;
    if ((child as THREE.PointLight).isPointLight) child.visible = false;
  });
};

const disposeObject = (object: THREE.Object3D) => {
  object.traverse(child => {
    const m = child as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    mats.forEach(mat => mat.dispose());
  });
};

export class ShopScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
  private carousel = new THREE.Group();
  private slots: Slot[] = [];
  private radius = 3;
  private selected = 0;
  private angle = 0; // current carousel rotation
  private targetAngle = 0;
  private accentLight = new THREE.PointLight(0xffffff, 8, 5);
  private dust: THREE.Points;
  private coins: CoinParticle[] = [];
  private coinGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 12);
  private coinMaterial = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.25, emissive: 0xca8a04, emissiveIntensity: 0.4 });
  private celebrateStart = -10;
  private clock = new THREE.Clock();
  private frame = 0;
  private resizeObserver: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private drag: { startX: number; startAngle: number; moved: boolean } | null = null;

  constructor(private container: HTMLElement, private onSelect: (index: number) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(BACKGROUND);
    this.scene.fog = new THREE.Fog(BACKGROUND, 7, 20);

    this.camera.position.set(0, 2.4, 8);
    this.camera.lookAt(0, 0.85, 0);

    this.buildRoom();
    this.dust = this.buildDust();
    this.scene.add(this.carousel);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);

    this.loop();
  }

  private buildRoom() {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(16, 48),
      new THREE.MeshStandardMaterial({ color: 0x140e22, roughness: 0.3, metalness: 0.4 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Glowing floor rings
    [2.2, 4.5, 7].forEach((r, i) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r, r + 0.03, 64),
        new THREE.MeshBasicMaterial({ color: [0xa855f7, 0x6366f1, 0x3b82f6][i], transparent: true, opacity: 0.35 - i * 0.08 }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, 0.01, -1.5);
      this.scene.add(ring);
    });

    // A ring of neon pillars in the background
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const pillar = new THREE.Group();
      pillar.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), new THREE.MeshStandardMaterial({ color: 0x1a1230, roughness: 0.8 })));
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 6.5, 0.52), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xa855f7 : 0x22d3ee }));
      pillar.add(strip);
      pillar.position.set(Math.sin(angle) * 10, 3.5, Math.cos(angle) * 10 - 2);
      pillar.lookAt(0, 3.5, -2);
      this.scene.add(pillar);
    }

    this.scene.add(new THREE.HemisphereLight(0x8b5cf6, 0x0b0714, 0.9));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.15));

    const spot = new THREE.SpotLight(0xfff7ed, 60, 14, 0.42, 0.55, 1.4);
    spot.position.set(0, 6.5, 2.8);
    spot.target.position.set(0, 1, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    this.scene.add(spot, spot.target);

    const rim = new THREE.DirectionalLight(0x93c5fd, 0.8);
    rim.position.set(-4, 4, -4);
    this.scene.add(rim);

    this.accentLight.position.set(0, 0.6, 0.9);
    this.scene.add(this.accentLight);
  }

  private buildDust() {
    const count = 220;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 1] = Math.random() * 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 12 - 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xe9d5ff, size: 0.035, transparent: true, opacity: 0.7 }));
    this.scene.add(points);
    return points;
  }

  setItems(items: SceneItem[]) {
    this.slots.forEach(slot => { this.carousel.remove(slot.root); disposeObject(slot.root); });
    this.slots = [];

    const count = Math.max(items.length, 1);
    this.radius = Math.max(2.6, (count * 2.7) / (Math.PI * 2));
    this.carousel.position.set(0, 0, -this.radius);

    items.forEach((item, index) => {
      const root = new THREE.Group();
      const angle = (index / count) * Math.PI * 2;
      root.position.set(Math.sin(angle) * this.radius, 0, Math.cos(angle) * this.radius);
      root.rotation.y = angle;

      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.7, 0.9, 6),
        new THREE.MeshStandardMaterial({ color: 0x241a3a, roughness: 0.4, metalness: 0.5, flatShading: true }),
      );
      pedestal.position.y = 0.45;
      pedestal.castShadow = true;
      pedestal.receiveShadow = true;
      root.add(pedestal);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.6, 0.03, 6, 32),
        new THREE.MeshStandardMaterial({ color: item.color, emissive: item.color, emissiveIntensity: 1 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.92;
      root.add(ring);

      const { group: model, spinners } = buildModel(item.model, item.color);
      if (item.locked) silhouette(model);
      model.position.y = ITEM_HEIGHT;
      root.add(model);

      const hitbox = new THREE.Mesh(new THREE.SphereGeometry(0.85, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      hitbox.position.y = 1.2;
      hitbox.userData.index = index;
      root.add(hitbox);

      this.carousel.add(root);
      this.slots.push({ root, model, ring, hitbox, spinners, item });
    });

    this.selected = Math.min(this.selected, items.length - 1);
    this.angle = this.targetAngle = this.angleFor(this.selected);
    this.updateAccent();
  }

  setAffordability(items: SceneItem[]) {
    items.forEach((item, i) => { if (this.slots[i]) this.slots[i].item = item; });
  }

  private angleFor(index: number) {
    return -(index / Math.max(this.slots.length, 1)) * Math.PI * 2;
  }

  select(index: number) {
    if (!this.slots.length) return;
    this.selected = index;
    // Rotate the shortest way round
    const full = Math.PI * 2;
    let target = this.angleFor(index);
    while (target - this.angle > Math.PI) target -= full;
    while (target - this.angle < -Math.PI) target += full;
    this.targetAngle = target;
    this.updateAccent();
  }

  private updateAccent() {
    const slot = this.slots[this.selected];
    if (slot) this.accentLight.color.setHex(slot.item.locked ? 0x4c1d95 : slot.item.color);
  }

  // Item leaps and spins, and a shower of coins bursts out
  celebrate() {
    this.celebrateStart = this.clock.getElapsedTime();
    for (let i = 0; i < 28; i++) {
      const coin = new THREE.Mesh(this.coinGeometry, this.coinMaterial);
      coin.position.set(0, ITEM_HEIGHT, 0);
      this.scene.add(coin);
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 2.5;
      this.coins.push({
        mesh: coin,
        velocity: new THREE.Vector3(Math.cos(angle) * speed, 3 + Math.random() * 3, Math.sin(angle) * speed * 0.6 + 1),
        spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, 0),
        life: 1.6,
      });
    }
  }

  private resize() {
    const { clientWidth, clientHeight } = this.container;
    if (!clientWidth || !clientHeight) return;
    this.renderer.setSize(clientWidth, clientHeight);
    this.camera.aspect = clientWidth / clientHeight;
    // Pull back on narrow screens so neighbours stay in view
    this.camera.position.z = clientWidth < clientHeight ? 10.5 : 8;
    this.camera.updateProjectionMatrix();
  }

  private handlePointerDown = (event: PointerEvent) => {
    this.drag = { startX: event.clientX, startAngle: this.targetAngle, moved: false };
  };

  private handlePointerMove = (event: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);

    if (this.drag) {
      const dx = event.clientX - this.drag.startX;
      if (Math.abs(dx) > 6) this.drag.moved = true;
      if (this.drag.moved) this.targetAngle = this.drag.startAngle + dx * 0.008;
    }

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.slots.map(s => s.hitbox))[0];
    this.renderer.domElement.style.cursor = this.drag?.moved ? 'grabbing' : hit ? 'pointer' : 'grab';
  };

  private handlePointerUp = (event: PointerEvent) => {
    if (!this.drag) return;
    const { moved } = this.drag;
    this.drag = null;
    if (!this.slots.length) return;

    if (moved) {
      // Snap to the item nearest the front
      const step = (Math.PI * 2) / this.slots.length;
      const index = ((Math.round(-this.targetAngle / step) % this.slots.length) + this.slots.length) % this.slots.length;
      this.onSelect(index);
      this.select(index);
      return;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.slots.map(s => s.hitbox))[0];
    if (hit) this.onSelect(hit.object.userData.index as number);
  };

  private loop = () => {
    this.frame = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.getElapsedTime();

    this.angle += (this.targetAngle - this.angle) * Math.min(1, dt * 7);
    this.carousel.rotation.y = this.angle;

    const sinceCelebrate = t - this.celebrateStart;
    const celebrating = sinceCelebrate < 0.9;

    this.slots.forEach((slot, index) => {
      const isFront = index === this.selected;
      const targetScale = isFront ? 1.2 : 0.8;
      const scale = slot.model.scale.x + (targetScale - slot.model.scale.x) * Math.min(1, dt * 6);
      slot.model.scale.setScalar(scale);

      let y = ITEM_HEIGHT + Math.sin(t * 1.8 + index) * 0.07;
      let spinSpeed = isFront ? 0.9 : 0.35;
      if (isFront && celebrating) {
        y += Math.sin((sinceCelebrate / 0.9) * Math.PI) * 0.7;
        spinSpeed = 14 * (1 - sinceCelebrate / 0.9);
      }
      slot.model.position.y = y;
      slot.model.rotation.y += dt * spinSpeed;

      slot.spinners.forEach(spinner => {
        if (slot.item.model === 'gear') spinner.rotation.z += dt * 1.5;
        else spinner.rotation.y += dt * 25;
      });

      slot.model.traverse(child => {
        if (child.userData.flicker) child.scale.setScalar(0.8 + Math.random() * 0.6);
        if (child.userData.bubble !== undefined) {
          const phase = (t * 0.5 + child.userData.bubble * 0.25) % 1;
          child.position.y = -0.3 + phase * 0.5;
        }
      });

      const glow = slot.item.locked ? 0.1 : slot.item.affordable ? 1.6 + Math.sin(t * 4) * 0.5 : 0.35;
      slot.ring.material.emissiveIntensity = isFront ? glow * 1.4 : glow;
    });

    this.accentLight.intensity = 6 + Math.sin(t * 2) * 1.5;

    this.dust.rotation.y = t * 0.02;
    this.dust.position.y = Math.sin(t * 0.3) * 0.2;

    this.coins = this.coins.filter(coin => {
      coin.life -= dt;
      coin.velocity.y -= 9 * dt;
      coin.mesh.position.addScaledVector(coin.velocity, dt);
      if (coin.mesh.position.y < 0.02) {
        coin.mesh.position.y = 0.02;
        coin.velocity.y *= -0.4;
        coin.velocity.x *= 0.7;
        coin.velocity.z *= 0.7;
      }
      coin.mesh.rotation.x += coin.spin.x * dt;
      coin.mesh.rotation.y += coin.spin.y * dt;
      if (coin.life <= 0) {
        this.scene.remove(coin.mesh);
        return false;
      }
      return true;
    });

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    canvas.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    disposeObject(this.scene);
    this.coinGeometry.dispose();
    this.coinMaterial.dispose();
    this.renderer.dispose();
    canvas.remove();
  }
}
