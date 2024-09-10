import * as THREE from 'three';
import fragShader from './shaders/raymarcher.frag'
import vertShader from './shaders/raymarcher.vert'
import { cameraPosition } from 'three/webgpu';

class Raymarcher extends THREE.Mesh {

    constructor({ } = {}) {
        const renderPlaneGeometry = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight);
        const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
        const renderPlaneMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            map: renderTarget.texture,

        });

        super(renderPlaneGeometry, renderPlaneMaterial);

        const material = new THREE.RawShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader: vertShader,
            fragmentShader: fragShader,
            uniforms: {
                cameraFov: { value: 90 },
                cameraPosition: { value: new THREE.Vector3(0.0, 1.0, -4.0) },
                maxSteps: { value: 1000 },
                resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
            },
            defines: {
                EPSILON: '0.1',
                MAX_DISTANCE: '100.0',
                MIN_DISTANCE: '0.001',
                MAX_STEPS: 1000
            }
        });
        this.userData = {
            raymarcher: new THREE.Mesh(renderPlaneGeometry, material),
            renderTarget: renderTarget,
        }


    }

    onBeforeRender(renderer, scene, camera) {
        const { userData: { raymarcher, renderTarget } } = this;
        const currentRenderTarget = renderer.getRenderTarget();
        renderer.setRenderTarget(renderTarget);
        renderer.render(raymarcher, camera);
        renderer.setRenderTarget(currentRenderTarget);

    }

}

export default Raymarcher; 