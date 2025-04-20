precision highp float;
uniform sampler2D aabb;
uniform vec3 cameraPos;
uniform vec2 resolution;

out vec4 hit;

struct AABBNode {
    vec3 minBound;
    vec3 maxBound;
    int index;
    int left;
    int right;
};

AABBNode getBVHNode(int index) {
    int texelIndex = index * 3;
    vec4 _minBound = texelFetch(aabb, ivec2(texelIndex, 0), 0);
    vec4 _maxBound = texelFetch(aabb, ivec2(texelIndex + 1, 0), 0);
    vec4 _treeIndices = texelFetch(aabb, ivec2(texelIndex + 2, 0), 0);

    return AABBNode(
        _minBound.xyz,    // minBound
        _maxBound.xyz,    // maxBound
        int(_treeIndices.x),
        int(_treeIndices.y),
        int(_treeIndices.z)
    );

    
}

// Bounding box intersection test
bool intersectAABB(inout vec3 ro, vec3 rd, vec3 minBound, vec3 maxBound) {
    vec3 tMin = (minBound - ro) / rd;
    vec3 tMax = (maxBound - ro) / rd;

    vec3 t1 = min(tMin, tMax);
    vec3 t2 = max(tMin, tMax);

    float tNear = max(max(t1.x, t1.y), t1.z);
    float tFar  = min(min(t2.x, t2.y), t2.z);

    return tNear <= tFar && tFar >= 0.0;
}

// BVH traversal for raymarching
int evaluateSDF(vec3 ro, vec3 rd) {
    int stack[64];
    int stackPtr = 0;
    stack[stackPtr++] = 0;  // Start at root

    int d = -1; 

    while (stackPtr > 0) {
        int nodeIndex = stack[--stackPtr];
        AABBNode node = getBVHNode(nodeIndex);

        if (!intersectAABB(ro, rd, node.minBound, node.maxBound)) {
            continue;
        }

        if (node.left == -1 && node.right == -1) {
            // Leaf node → Evaluate SDF
            return node.index;
        } else {
            // Push child nodes onto stack
            if (node.left != -1) stack[stackPtr++] = node.left;
            if (node.right != -1) stack[stackPtr++] = node.right;
        }
    }

    return -1;
}

void main()
{
    
    vec2 uv = (gl_FragCoord.xy / resolution.xy) * 2.0 - 1.0;
    uv.x *= resolution.x / resolution.y;

    vec3 rayOrigin = cameraPos;
    vec3 rayDir = normalize( vec3( uv, -1. ) );

    int didHit = evaluateSDF(rayOrigin, rayDir);

    hit = vec4(float(didHit), 0.0, 0.0, 1.0);
}