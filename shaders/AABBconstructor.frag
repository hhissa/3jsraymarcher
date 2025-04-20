precision highp float;

#include "primatives.glsl"

layout(location = 0) out vec4 minOut;
layout(location = 1) out vec4 maxOut;

uniform sampler2D sdf; // SDF params (position, radius, etc.)

// Compute SDF distance for different types
float getSDF(vec3 p) {

    int sdfType = int(texelFetch(sdf, ivec2(0, 0), 0).r);

    float sdfParams[7];  // Declare the array with fixed size
    sdfParams[0] = texelFetch(sdf, ivec2(1, 0), 0).r;
    sdfParams[1] = texelFetch(sdf, ivec2(2, 0), 0).r;
    sdfParams[2] = texelFetch(sdf, ivec2(3, 0), 0).r;
    sdfParams[3] = texelFetch(sdf, ivec2(4, 0), 0).r;
    sdfParams[4] = texelFetch(sdf, ivec2(5, 0), 0).r;
    sdfParams[5] = texelFetch(sdf, ivec2(6, 0), 0).r;
    sdfParams[6] = texelFetch(sdf, ivec2(7, 0), 0).r;
    switch(sdfType){
    case 0: 
        return sdSphere(p, sdfParams[0]);
    case 1:
        return sdBox(p, vec3(sdfParams[0], sdfParams[1], sdfParams[2]));
    }
    return -1.0;
}

vec3 marchDirection(vec3 start, vec3 dir) {
    float t = 0.0;
    const float stepSize = 0.05; // Reduce step size for accuracy
    const float maxDist = 50.0; // Increase max search distance

    vec3 pos = start;
    for (int i = 0; i < 200; i++) { // Increase iteration count
        float dist = -getSDF(pos);
        if (dist < 0.001) break; // Hit surface
        pos += dir * dist; // Move by SDF result, not fixed stepSize
        t += dist;
        if (t > maxDist) break; // Stop if too far
    }
    return pos;
}

void main() {

    // Define search directions
    vec3 start = vec3(0.0); 
    vec3 dirX = vec3(1, 0, 0), dirY = vec3(0, 1.0, 0), dirZ = vec3(0, 0, 1);

    // find min/max along each axis
    // could just min throughout
    vec3 minX = marchDirection(start, -dirX);
    vec3 maxX = marchDirection(start, dirX);
    vec3 minY = marchDirection(start, -dirY);
    vec3 maxY = marchDirection(start, dirY);
    vec3 minZ = marchDirection(start, -dirZ);
    vec3 maxZ = marchDirection(start, dirZ);

    vec3 minBound = min(minX, minY);
    minOut = vec4(min(minBound, minZ), 0.0);

    vec3 maxBound = max(maxX, maxY);
    maxOut = vec4(max(maxBound, maxZ), 0.0);
}