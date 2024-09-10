import * as THREE from 'three';
import Raymarcher from './raymarcher';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

camera.position.set(0, 0, 550);
const raymarcher = new Raymarcher();


scene.add(raymarcher);

renderer.render(scene, camera);
