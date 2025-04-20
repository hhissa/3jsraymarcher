import * as THREE from 'three';
import Raymarcher from './raymarcher';
import { SDF, AABB, BVHFactory } from './lib/bvh';


const renderer = new THREE.WebGLRenderer();
const SDFParams = Array(7).fill(0.0);
SDFParams[0] = 1.0;

const SDF1 = [new SDF(0, new THREE.Vector3(0.0, 2.0, 0.0), SDFParams),
new SDF(0, new THREE.Vector3(0.0, -2.0, 0.0), SDFParams),
new SDF(0, new THREE.Vector3(2.0, 0.0, 0.0), SDFParams),
new SDF(0, new THREE.Vector3(-2.0, 0.0, 0.0), SDFParams)];

const factory = new BVHFactory(SDF1);

var BVH = factory.produceBVH(renderer);
var BVHlist = factory.flattenBVHlist(BVH);
BVHlist.forEach((aabb) => {
    console.log(`AABB ${aabb.AABB.index}: Min(${aabb.AABB.min.x}, ${aabb.AABB.min.y}, ${aabb.AABB.min.z}) Max(${aabb.AABB.max.x}, ${aabb.AABB.max.y}, ${aabb.AABB.max.z})`);
});


var BVHtexture = factory.flattenBVHTexture(BVHlist);
var SceneTexture = factory.createSceneTexture(renderer, BVHtexture, [0.0, 0.0, 8.0])

renderer.setSize(window.innerWidth, window.innerHeight);

const quadGeometry = new THREE.PlaneGeometry(2, 2);
const quadMaterial = new THREE.MeshBasicMaterial({
    map: SceneTexture.texture
});

const quadMesh = new THREE.Mesh(quadGeometry, quadMaterial);

// Optional: disable depth test/write if you're using this as an overlay
quadMaterial.depthTest = false;
quadMaterial.depthWrite = false;

const screenScene = new THREE.Scene();
const screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

screenScene.add(quadMesh);
renderer.setRenderTarget(null); // Render to the screen
renderer.clear(); // Optional
renderer.render(screenScene, screenCamera);

document.body.appendChild(renderer.domElement);
