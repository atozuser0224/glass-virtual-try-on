import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyFrameFit, type Renderer3DState } from './renderer3d';

function makeRendererState(group: THREE.Group): Renderer3DState {
  return {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(55, 1, 0.01, 10),
    renderer: {} as THREE.WebGLRenderer,
    glassesGroup: group,
    currentShape: null,
    currentMaterial: null,
    envMap: null,
    ambientLight: new THREE.AmbientLight(),
    keyLight: new THREE.DirectionalLight(),
    fillLight: new THREE.DirectionalLight(),
  };
}

describe('applyFrameFit', () => {
  it('maps camera y down to world y down for the upright mirrored preview', () => {
    const group = new THREE.Group();
    const state = makeRendererState(group);

    applyFrameFit(
      state,
      {
        center: { x: 0.5, y: 0.75, z: 0 },
        width: 0.4,
        roll: 0,
        yaw: 0,
      },
      1,
    );

    expect(group.position.y).toBeLessThan(0);
  });
});
