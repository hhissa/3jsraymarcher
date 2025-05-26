precision highp float;
uniform sampler2D aabb;
uniform vec3 cameraPos;
uniform vec2 resolution;
out vec4 hit;

float hits[MAXHITS];

struct AABBNode {
    vec3 minBound;
    vec3 maxBound;
    int index;
    int left;
    int right;
    float sdfIndex;
};

AABBNode getBVHNode(int index) {
    int texelIndex = index;
    vec4 _minBound = texelFetch(aabb, ivec2(0, texelIndex), 0);
    vec4 _maxBound = texelFetch(aabb, ivec2(1, texelIndex), 0);
    vec4 _treeIndices = texelFetch(aabb, ivec2(2, texelIndex), 0);

    return AABBNode(
        _minBound.xyz,    // minBound
        _maxBound.xyz,    // maxBound
        int(_treeIndices.x), //tree index
        int(_treeIndices.y), //left index in tree
        int(_treeIndices.z), //right index in tree
        _treeIndices.w  //index in CPU SDF list
    ); 
}

// Bounding box intersection test
bool intersectAABB(vec3 ro, vec3 rd, vec3 minBound, vec3 maxBound) {
    //distance to the planes
    vec3 tMin = (minBound - ro) / rd;
    vec3 tMax = (maxBound - ro) / rd;

    vec3 t1 = min(tMin, tMax);
    vec3 t2 = max(tMin, tMax);

    float tNear = max(max(t1.x, t1.y), t1.z);
    float tFar  = min(min(t2.x, t2.y), t2.z);

    return (tNear <= tFar && tFar >= 0.0); 
}

// BVH traversal for raymarching
void evaluateSDF(vec3 ro, vec3 rd) {
    int stack[64];
    int stackPtr = 0;
    int hitsCounter = 0;
    stack[stackPtr++] = 0;  // Start at root 

    while (stackPtr > 0) {
        int nodeIndex = stack[--stackPtr];
        AABBNode node = getBVHNode(nodeIndex);

        if (!intersectAABB(ro, rd, node.minBound, node.maxBound)) {
            continue;
        }

        if (node.left == -1 && node.right == -1) {
            hits[hitsCounter] = node.sdfIndex;
            hitsCounter += 1;
        } else {
            // Push child nodes onto stack
            if (node.left != -1) stack[stackPtr++] = node.left;
            if (node.right != -1) stack[stackPtr++] = node.right;
        }
    }
}

void main()
{
    vec2 uv = (gl_FragCoord.xy / resolution.xy) * 2.0 - 1.0;
    uv.x *= resolution.x / resolution.y;

    vec3 rayOrigin = cameraPos;
    vec3 rayDir = normalize( vec3( uv, -1. ) );
    float didHit = 0.0;

    for(int i = 0; i < MAXHITS; i++)
    {
        hits[i] = -1.0;
    }

    evaluateSDF(rayOrigin, rayDir);

    hit = vec4(hits[0], hits[1], hits[2], hits[3]);
}