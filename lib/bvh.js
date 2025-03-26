import * as THREE from 'three';
import fragShaderAABB from '../shaders/AABBconstructor.frag'
import vertShaderAABB from '../shaders/AABBconstructor.vert'

//sdf primative indexes corresponding to 
const SDFPrimatives = Object.freeze({
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
    }
}

//consider using AOBB
export class AABB {
    index;
    constructor(SDF) {
        this.min = new THREE.Vector3(0.0, 0.0, 0.0);
        this.max = new THREE.Vector3(0.0, 0.0, 0.0);
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
                sdf: { value: sdfTexture }
            }
        });

        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.camera.updateProjectionMatrix();

        const renderPlaneGeometry = new THREE.PlaneGeometry(2, 2);

        this.renderTarget = new THREE.WebGLRenderTarget(2, 1,
            {
                count: 2,
                type: THREE.FloatType,
                format: THREE.RGBAFormat
            });

        // Name our G-Buffer attachments for debugging

        this.renderTarget.textures[0].name = 'min';
        this.renderTarget.textures[1].name = 'max';

        console.log(this.renderTarget.textures)

        var meshShader = new THREE.Mesh(renderPlaneGeometry, material);
        this.scene.add(meshShader);
    }

    computeBounds(renderer) {
        renderer.setRenderTarget(this.renderTarget);
        renderer.render(this.scene, this.camera);
        renderer.setRenderTarget(null);

        const gl = renderer.getContext("experimental-webgl")

        const minBuffer = new Float32Array(4);
        //reading min twice somehow
        renderer.readRenderTargetPixels(this.renderTarget, 0, 0, 1, 1, minBuffer);
        this.min.set(minBuffer[0], minBuffer[1], minBuffer[2]);

        const maxBuffer = new Float32Array(4);
        renderer.readRenderTargetPixels(this.renderTarget, 0, 0, 1, 1, maxBuffer);
        this.max.set(maxBuffer[0], maxBuffer[1], maxBuffer[2]);
    }
}

class AABBTree {
    constructor(left, right, AABB) {
        this.left = left;
        this.right = right;
        this.AABB = AABB;
    }
}


class BVHFactory {
    constructor(SceneArr) {
        //2D array holding each object (rows) and their positions/args (columns)
        this.SceneArr = SceneArr;

        //texture holding the hit targets of the given scene
        const treeTexture = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);

        const material = new THREE.RawShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader: vertShaderBVH,
            fragmentShader: fragShaderBVH,
            uniforms: {
                scene: { value: SceneArr },
                sceneDimensions: { value: new THREE.Vector2(SceneArr.length, SceneArr[0].length) },
            },
            defines: {
                MAX_ARGS: '5',
            },
        });

    }

    buildAABB(objects) {
        for (const object of objects) {
            object.computeBounds();
        }
    }

    buildBVH(objects) {
        if (objects.length === 1) {
            // Leaf node
            return new AABBTree(null, null, new AABB(objects[0].min, objects[0].max, objects[0]));
        }

        // Sort objects along the X-axis (can also try Y or Z)
        objects.sort((a, b) => a.min[0] - b.min[0]);

        // Split objects into two halves
        const mid = Math.floor(objects.length / 2);
        const leftObjects = objects.slice(0, mid);
        const rightObjects = objects.slice(mid);

        // Compute bounding box for parent node
        const minBound = [
            Math.min(...objects.map(obj => obj.min[0])),
            Math.min(...objects.map(obj => obj.min[1])),
            Math.min(...objects.map(obj => obj.min[2]))
        ];
        const maxBound = [
            Math.max(...objects.map(obj => obj.max[0])),
            Math.max(...objects.map(obj => obj.max[1])),
            Math.max(...objects.map(obj => obj.max[2]))
        ];

        // Create AABB node
        const nodeAABB = new AABB(minBound, maxBound, null);

        // Recursively build left and right child trees
        const leftChild = this.buildBVH(leftObjects);
        const rightChild = this.buildBVH(rightObjects);

        return new AABBTree(leftChild, rightChild, nodeAABB);
    }

    flattenBVH(objects) {
        const numSDFs = SceneArr.length;
        const sdfArray = new Float32Array(numSDFs * 8);

        SceneArr.forEach((sdf, i) => {
            sdfArray.set([
                sdf.type,
                sdf.pos.x, sdf.pos.y, sdf.pos.z,
                sdf.params.x, sdf.params.y, sdf.params.z
            ], i * 8);
        });

        const sdfTexture = new THREE.DataTexture(
            sdfArray, numSDFs, 1,
            THREE.RedFormat, THREE.FloatType
        );
        sdfTexture.needsUpdate = true;
    }

}