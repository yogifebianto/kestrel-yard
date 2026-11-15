// The planted bomb: a physical device at the bombsite, so the timer on the HUD
// corresponds to something the player can see, walk up to and shoot.
import * as THREE from 'three';

const SITE_A = new THREE.Vector3(-20, 0.8, -20);
const SITE_B = new THREE.Vector3(20, 0, 20);

export function createBomb(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const caseMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a3028'), roughness: 0.72, metalness: 0.25 });
  const trimMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3f4a3a'), roughness: 0.6, metalness: 0.35 });
  const ledMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ff3a24'),
    emissive: new THREE.Color('#ff3a24'),
    emissiveIntensity: 2.4,
    roughness: 0.4,
    metalness: 0.0,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.24, 0.34), caseMat);
  body.position.y = 0.12;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.045, 0.37), trimMat);
  lid.position.y = 0.265;
  lid.castShadow = true;
  group.add(lid);

  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.40), trimMat);
  strap.position.set(-0.12, 0.18, 0);
  group.add(strap);

  const led = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), ledMat);
  led.position.set(0.17, 0.23, 0.14);
  group.add(led);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 6), trimMat);
  antenna.position.set(-0.20, 0.34, -0.09);
  group.add(antenna);

  // A warm pool of light under the device, so it reads at a glance at any distance.
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 20),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ff6a3a'),
      emissive: new THREE.Color('#ff6a3a'),
      emissiveIntensity: 0.35,
      roughness: 0.9,
      metalness: 0.0,
      transparent: true,
      opacity: 0.55,
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.012;
  group.add(glow);

  const sitePosition = new THREE.Vector3();
  let blink = 0;

  // Place the device on the planted site. Called when the round reports a plant.
  function place(site) {
    sitePosition.copy(site === 'b_site' ? SITE_B : SITE_A);
    group.position.copy(sitePosition);
    group.visible = true;
    blink = 0;
  }

  function hide() {
    group.visible = false;
  }

  // Blink the LED faster as the timer runs down: a visible countdown in the world.
  function step(dt, secondsLeft) {
    if (!group.visible) return;
    blink += dt;
    const period = secondsLeft < 10 ? 0.18 : secondsLeft < 25 ? 0.4 : 0.8;
    const on = (blink % period) < period * 0.5;
    ledMat.emissiveIntensity = on ? 2.6 : 0.25;
    glow.material.opacity = on ? 0.6 : 0.28;
  }

  return { place, hide, step, group };
}