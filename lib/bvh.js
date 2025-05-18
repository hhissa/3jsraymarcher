import * as THREE from 'three';
import fragShaderAABB from '../shaders/AABBconstructor.frag'
import vertShaderAABB from '../shaders/AABBconstructor.vert'
import fragShaderBVH from '../shaders/BVHconstructor.frag'
import vertShaderBVH from '../shaders/BVHconstructor.vert'
import fragShaderMRT from '../shaders/readMRT.frag'
import vertShaderMRT from '../shaders/readMRT.vert'


//sdf primative indexes corresponding to 
export const SDFPrimatives = Object.freeze({
    CIRCLE: 0,
    CUBE: 1,
    ELLIPSOID: 2,

});


export class SDF {
    constructor(type, pos, params, op) {
        this.type = type;
        //vec3
        this.pos = pos;
        //Array of floats
        this.params = params;
        this.op = op;
        this.color = 1;
    }
}

//consider using AOBB
export class AABB {
    constructor(SDF) {
        this.index = 0;
        this.min = new THREE.Vector3(0.0, 0.0, 0.0);
        this.max = new THREE.Vector3(0.0, 0.0, 0.0);
        if (SDF === null) {
            return;
        }

        this.SDF = SDF;

        const sdfProps = new Float32Array(8);

        sdfProps.set([SDF.type,
        SDF.params[0], SDF.params[1], SDF.params[2],
        SDF.params[3], SDF.params[4], SDF.params[5],
        SDF.params[6],
        ], 0);

        const sdfTexture = new THREE.DataTexture(
            sdfProps, sdfProps.length, 1,
            THREE.RedFormat, THREE.FloatType
        );

        sdfTexture.needsUpdate = true;

        const material = new THREE.RawShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader: vertShaderAABB,
            fragmentShader: fragShaderAABB,
            uniforms: {
                sdf: { value: sdfTexture },
            }
        });

        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.camera.updateProjectionMatrix();

        const renderPlaneGeometry = new THREE.PlaneGeometry(2, 2);

        //this is bad, should output each directions bound to 6 pixels in one single rt
        // so it can be parallelized and faster on the gpu
        this.renderTarget = new THREE.WebGLRenderTarget(1, 1,
            {
                count: 2,
                type: THREE.FloatType,
                format: THREE.RGBAFormat,
                internalFormat: 'RGBA32F', // Required for FloatType in WebGL2
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter,
                depthBuffer: false,
            });

        // Name our G-Buffer attachments for debugging

        this.renderTarget.textures[0].name = 'min';
        this.renderTarget.textures[1].name = 'max';

        var meshShader = new THREE.Mesh(renderPlaneGeometry, material);
        this.scene.add(meshShader);
    }

    computeBounds(renderer) {

        const gl = renderer.getContext();
        const ext = gl.getExtension('EXT_color_buffer_float');

        // Set the render target to the custom framebuffer
        renderer.setRenderTarget(this.renderTarget);
        renderer.render(this.scene, this.camera);

        //work around for reading MRT, should have picked webGPU for this.
        //get rid of this work around by single rt to output bound per pixel
        function readMultiRenderTarget(renderer, MRTtexture) {
            var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

            var scene = new THREE.Scene();
            const material = new THREE.RawShaderMaterial({
                glslVersion: THREE.GLSL3,
                vertexShader: vertShaderMRT,
                fragmentShader: fragShaderMRT,
                uniforms: {
                    tex: { value: MRTtexture },
                }
            });

            const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
                type: THREE.FloatType,
                format: THREE.RGBAFormat,
                internalFormat: 'RGBA32F',
            });

            const renderPlaneGeometry = new THREE.PlaneGeometry(2, 2);

            var mesh = new THREE.Mesh(renderPlaneGeometry, material);

            scene.add(mesh);

            renderer.setRenderTarget(renderTarget);
            renderer.render(scene, camera);

            const buffer = new Float32Array(4);
            renderer.readRenderTargetPixels(renderTarget, 0, 0, 1, 1, buffer)
            return buffer;
        }

        // Read from min/max textures separately
        var minBuffer = new Float32Array(4);
        minBuffer = readMultiRenderTarget(renderer, this.renderTarget.textures[0]);
        this.min.set(minBuffer[0] + this.SDF.pos.x, minBuffer[1] + this.SDF.pos.y, minBuffer[2] + this.SDF.pos.z);

        var maxBuffer = new Float32Array(4);
        maxBuffer = readMultiRenderTarget(renderer, this.renderTarget.textures[1]);
        this.max.set(maxBuffer[0] + this.SDF.pos.x, maxBuffer[1] + this.SDF.pos.y, maxBuffer[2] + this.SDF.pos.z);
    }
}


class AABBTree {
    constructor(left, right, AABB) {
        this.left = left;
        this.right = right;
        this.AABB = AABB;
    }
}


export class BVHFactory {
    constructor(SceneArr) {
        //Array holding SDF objects
        this.indexCounter = 0;
        this.SceneArr = SceneArr;
        this.BVHTexture;
    }


    //objects: list[SDF]
    buildAABB(renderer, objects) {
        var listAABB = [];
        for (const object of objects) {
            var aabb = new AABB(object);
            aabb.computeBounds(renderer);
            listAABB.push(aabb);
        }
        return listAABB;
    }

    //objects: list[AABB]
    buildBVH(objects) {
        if (objects.length === 1) {
            // Leaf node
            objects[0].index = this.indexCounter++;
            return new AABBTree(null, null, objects[0]);
        }

        // Sort objects along the X-axis (can also try Y or Z)
        objects.sort((a, b) => a.min.x - b.min.x);

        // Split objects into two halves
        const mid = Math.floor(objects.length / 2);
        const leftObjects = objects.slice(0, mid);
        const rightObjects = objects.slice(mid);

        // Compute bounding box for parent node
        const minBound = [
            Math.min(...objects.map(obj => obj.min.x)),
            Math.min(...objects.map(obj => obj.min.y)),
            Math.min(...objects.map(obj => obj.min.z))
        ];
        const maxBound = [
            Math.max(...objects.map(obj => obj.max.x)),
            Math.max(...objects.map(obj => obj.max.y)),
            Math.max(...objects.map(obj => obj.max.z))
        ];

        // Create AABB node
        const nodeAABB = new AABB(null);
        nodeAABB.min = new THREE.Vector3(minBound[0], minBound[1], minBound[2]);
        nodeAABB.max = new THREE.Vector3(maxBound[0], maxBound[1], maxBound[2]);
        nodeAABB.index = this.indexCounter++;

        // Recursively build left and right child trees
        const leftChild = this.buildBVH(leftObjects);
        const rightChild = this.buildBVH(rightObjects);

        return new AABBTree(leftChild, rightChild, nodeAABB);
    }

    //root is AABBTree
    flattenBVHlist(root) {
        const list = [];

        function traverse(node) {
            if (!node) return;
            list.push(node); // Store the AABB in the list
            traverse(node.left);
            traverse(node.right);
        }

        traverse(root);
        return list;
    }

    //objects: list of AABB's in preorder with index property satisfied.
    // creates texture holding all BB in a preorder traversal
    flattenBVHTexture(objects, SDFS) {
        const numAABBs = objects.length;
        const AABBArray = new Float32Array(numAABBs * 12);
        objects.forEach((node, i) => {
            let SDFIndex = node.AABB.SDF ? SDFS.findIndex(o => o === node.AABB.SDF) : -1;
            AABBArray.set([
                node.AABB.min.x, node.AABB.min.y, node.AABB.min.z, 1.0,
                node.AABB.max.x, node.AABB.max.y, node.AABB.max.z, 1.0,
                node.AABB.index, !node.left ? -1 : node.left.AABB.index, !node.right ? -1 : node.right.AABB.index, SDFIndex
            ], i * 12);
        });

        const BVHTexture = new THREE.DataTexture(
            AABBArray, 3, numAABBs,
            THREE.RGBAFormat, THREE.FloatType
        );

        BVHTexture.needsUpdate = true;
        return BVHTexture;
    }

    //objects: list of aabb's with index and sdf properties satisfied
    createObjectTexture(objects) {
        const numSDFs = objects.length;
        const SDFArray = new Float32Array(numSDFs * 16);
        objects.forEach((object, i) => {
            SDFArray.set([
                object.pos.x, object.pos.y, object.pos.z, object.index,
                object.params[0], object.params[1], object.params[2], object.params[3],
                object.params[4], object.params[5], object.params[6], object.params[7],
                object.op, object.color, 0.0, 0.0
            ], i * 16)
        });

        const SDFTexture = new THREE.DataTexture(
            SDFArray, 4, numSDFs,
            THREE.RGBAFormat, THREE.FloatType
        );

        return SDFTexture;
    }

    //flattened AABB texture
    // tex: texture holding bvh info,
    createSceneTexture(renderer, tex, pos) {
        const material = new THREE.RawShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader: vertShaderBVH,
            fragmentShader: fragShaderBVH,
            uniforms: {
                aabb: { value: tex },
                cameraPos: { value: new THREE.Vector3(pos[0], pos[1], pos[2]) },
                resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
            }
        });

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        camera.updateProjectionMatrix();

        const renderPlaneGeometry = new THREE.PlaneGeometry(2, 2);

        const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight,
            {
                type: THREE.FloatType,
                format: THREE.RGBAFormat,
                internalFormat: 'RGBA32F', // Required for FloatType in WebGL2
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter,
                depthBuffer: false,
            });

        var meshShader = new THREE.Mesh(renderPlaneGeometry, material);
        scene.add(meshShader);

        renderer.setRenderTarget(renderTarget);
        renderer.render(scene, camera);

        return renderTarget;
    }

    produceBVH(renderer) {
        var listAABB = this.buildAABB(renderer, this.SceneArr);
        var bvh = this.buildBVH(listAABB);
        return bvh;
    }
}