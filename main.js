import * as THREE from 'three';
import Raymarcher from './raymarcher';
import { SDF, AABB, BVHFactory } from './lib/bvh';


const renderer = new THREE.WebGLRenderer();
const SDFParams = Array(7).fill(0.0);
SDFParams[0] = 1.0;

const SDF1 = [new SDF(0, new THREE.Vector3(0.0, 0.0, 0.0), SDFParams),
new SDF(0, new THREE.Vector3(0.0, 0.0, -2.0), SDFParams),
new SDF(0, new THREE.Vector3(0.0, 0.0, -4.0), SDFParams),
new SDF(0, new THREE.Vector3(0.0, 0.0, -6.0), SDFParams),
];

const factory = new BVHFactory(SDF1);

var BVH = factory.produceBVH(renderer);
var BVHlist = factory.flattenBVHlist(BVH);

BVHlist.forEach((aabb) => {
    console.log(`AABB ${aabb.AABB.index}: Min(${aabb.AABB.min.x}, ${aabb.AABB.min.y}, ${aabb.AABB.min.z}) Max(${aabb.AABB.max.x}, ${aabb.AABB.max.y}, ${aabb.AABB.max.z})`);
});

var BVHtexture = factory.flattenBVHTexture(BVHlist, SDF1);
var SceneTexture = factory.createSceneTexture(renderer, BVHtexture, [0.0, 0.0, 8.0])
var SDFTexture = factory.createObjectTexture(SDF1);

renderer.setSize(window.innerWidth, window.innerHeight);


const screenScene = new THREE.Scene();
const screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

var raymarcher = new Raymarcher(SceneTexture, SDFTexture);
screenScene.add(raymarcher);
renderer.setRenderTarget(null);
renderer.clear();
renderer.render(screenScene, screenCamera);

document.body.appendChild(renderer.domElement);
