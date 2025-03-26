import * as THREE from 'three';
import Raymarcher from './raymarcher';
import { SDF, AABB } from './lib/bvh';


const renderer = new THREE.WebGLRenderer();
const SDFParams = Array(7).fill(0.0);
SDFParams[0] = 4.0;
const SDF1 = new SDF(0, new THREE.Vector3(0.0, 0.0, 0.0), SDFParams);

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Compute AABB
const aabb = new AABB(SDF1);
aabb.computeBounds(renderer);

console.log('Min Bounds:', aabb.min);
console.log('Max Bounds:', aabb.max);