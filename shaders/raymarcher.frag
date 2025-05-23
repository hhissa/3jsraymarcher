precision highp float;
#include "primatives.glsl"

out vec4 fragColor;
in vec3 rd;
uniform vec3 cameraPosition;
uniform vec2 resolution;
uniform float cameraFov;

//texture holding objects hits per pixel for resolotion
uniform sampler2D hitTexture;
//texture holding sdf's and parameters
uniform sampler2D sdfTexture;


///////////////////////////////////////////////////////////////////////////////////////
// DATA STRUCTURES //

struct Light {
    vec3 position;
    vec3 direction;
    vec4 color;
    float brightness;
    float penumbraFactor;
} light;

struct RayInfo {
    vec3 origin;
    vec3 dir;
};

struct SDF {
    int type;
    vec3 pos;
    float params[8];
    int op;
    int color;
};

///////////////////////////////////////////////////////////////////////////////////////
// GLOBAL VARIABLES //

SDF hits[4];

///////////////////////////////////////////////////////////////////////////////////////
// INIT FUNCTIONS //

void initLight() {
    light.position = vec3(0.0, 2.0, 0.0);
    light.direction = vec3(0.0,.5, -.2);
}

// void initRayout(out RayInfo ray) 
// {
//     vec2 uv = (gl_FragCoord.xy / resolution.xy) * 2.0 - 1.0; // [-1,1]
//     uv.x *= resolution.x / resolution.y;                     // aspect correction

//     ray.origin = cameraPosition;

//     // Convert fov to radians and get half angles
//     float fovRad = radians(cameraFov);
//     float halfHeight = tan(fovRad / 2.0);
//     float halfWidth = halfHeight * (resolution.x / resolution.y);

//     // Camera coordinate system
//     vec3 forward = normalize(vec3(0.0, 0.0, -1.0));  // assuming looking down -Z
//     vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
//     vec3 up = normalize(cross(right, forward));

//     // Build ray direction
//     ray.dir = normalize(
//         forward 
//         + uv.x * halfWidth * right 
//         + uv.y * halfHeight * up
//     );
// }

void initRayout(out RayInfo ray) 
{
    vec2 uv = ( gl_FragCoord.xy / resolution.xy ) * 2.0 - 1.0;  // [-1,1] coords
    uv.x *= resolution.x / resolution.y;                        // correct aspect ratio

    ray.origin = cameraPosition;
    ray.dir = normalize(vec3(uv, -1.0));
}

vec4 getPixel(ivec2 coord) {
    return texelFetch(hitTexture, coord, 0);
}
///////////////////////////////////////////////////////////////////////////////////////
// BOOLEAN OPERATORS //

vec3 rotatey(vec3 p, float theta) {
    return p * mat3(vec3(cos(theta), 0.0, sin(theta)),
     vec3(0.0, 1.0, 0.0), 
     vec3(-sin(theta), 0.0, cos(theta)));
}

vec3 rotatex(vec3 p, float theta) {
    return p * mat3(vec3(1.0, 0.0, 0.0), 
    vec3(0.0, cos(theta), -sin(theta)), 
    vec3(0.0, sin(theta), cos(theta)));;
}

// Union
float opUnion(float d1, float d2)
{
	return min(d1, d2);
}

// Subtraction
float opSubtraction(float d1, float d2)
{
	return max(-d1, d2);
}

// Intersection
float opIntersection(float d1, float d2)
{
	return max(d1, d2);
}

float opSmoothUnion( float d1, float d2, float k )
{
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
}

float opSmoothSubtraction( float d1, float d2, float k )
{
    float h = clamp( 0.5 - 0.5*(d2+d1)/k, 0.0, 1.0 );
    return mix( d2, -d1, h ) + k*h*(1.0-h);
}

float opSmoothIntersection( float d1, float d2, float k )
{
    float h = clamp( 0.5 - 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) + k*h*(1.0-h);
}

////////////////////////////////////////////////////////////////////////////////
    
// Compute SDF distance for different types
float evalSDF(vec3 p, SDF hit) {
    switch(hit.type){
    case 0: 
        return sdSphere(p - hit.pos, hit.params[0]);
    case 1:
        return sdBox(p - hit.pos, vec3(hit.params[0], hit.params[1], hit.params[2]));
    }
    return 9999.0;
}


float map(vec3 p) {
    float d = 9999.0;
    // for (int i = 0; i < 4; ++i) {
    //     if (hits[i].type == -1) continue;
    //     d = opUnion(d, evalSDF(p, hits[0]));
    // }
    d = min(d, evalSDF(p, hits[0]));
    return d;
}

// float map(vec3 p) {
//     return sdSphere(p - vec3(0,0, 12.0), 2.0);
// }

vec3 normal(in vec3 p, float d) {
    float offset = 0.001;
    vec3 distances = vec3(
        map(p + vec3(offset,0.0,0.0)) - d,
        map(p + vec3(0.0,offset,0.0)) - d,
        map(p + vec3(0.0,0.0,offset)) - d
        );
    return normalize(distances);
}

///////////////////////////////////////////////////////////////////////////////////////
// LIGHTING FUNCTIONS //

// vec3 calcFog( in vec3  col,   // color of pixel
//                in float t,     // distance to point
//                in vec3  rd,    // camera to point
//                in vec3  lig )  // sun direction
// {
//     float fogAmount = 1.0 - exp(-t*b);
//     float sunAmount = max( dot(rd, lig), 0.0 );
//     vec3  fogColor  = mix( vec3(0.5,0.6,0.7), // blue
//                            vec3(1.0,0.9,0.7), // yellow
//                            pow(sunAmount,8.0) );
//     return mix( col, fogColor, fogAmount );
// }

float calcShadow(in vec3 ro, in vec3 rd, float k) {
    float res = 1.0;
    float t = EPSILON;
    for( int i =0; i < MAX_STEPS && t < MAX_DISTANCE; i++) {
        float h = map(ro + rd * t);
        if(h<MIN_DISTANCE) {
            return 0.0;
        }
        res = min(res, k*h/t);
        t += h;
    }
    return res;
}

float calcOcclusion(vec3 p, vec3 norm) {
    float occ = 0.0;
    float weight = 0.5;
    for (int i = 1; i < 6; i++) {
        float d = EPSILON * float(i);
        occ += weight * (1.0 - (d - map(p + d * norm)));
        weight *= 0.5;
    }
    return occ;
}

void calcLighting(inout vec4 color, in vec3 p, in vec3 norm) {
    float occ = calcOcclusion(p, norm);
    float sha = calcShadow(p, light.direction, 4.);
    float sunLighting = clamp( dot(norm, light.direction), 0.0, 1.0);
    float skyLighting = clamp( 0.5 + 0.5*norm.y, 0.0, 1.0 );
    float indirectLighting = clamp( dot( norm, normalize(light.direction*vec3(-1.0,0.0,-1.0)) ), 0.0, 1.0 );
    vec3 lin = sunLighting*vec3(1.64, 1.27, 0.99) * pow(vec3(sha), vec3(1.0, 1.2, 1.5));
    lin += skyLighting * vec3(0.16, 0.20, 0.28)*occ;
    lin += indirectLighting*vec3(0.40,0.28,0.20)*occ;
    color.xyz *= lin;
    
}

vec4 march(out vec3 p, in RayInfo ray) {
    float distance = 0.0;
    int i;
    vec4 d = vec4(0.0);
    for(i = 0; i < MAX_STEPS && distance < MAX_DISTANCE; i++) {
        p = ray.origin + ray.dir * distance;
        d.z = map(p);
        if (d.z <= MIN_DISTANCE) {
            return d;
        }
        distance += d.z;
    }

    return vec4(0.0, 0.0, -1.0, i);
}

//get material
void getMaterial() {

}
//get miss ray color
void getMissColor() {

}

void loadSDFData() {
    vec4 hitIndices = texelFetch(hitTexture, ivec2(gl_FragCoord.xy), 0);

    for (int i = 0; i < 4; ++i) {
        int index = int(hitIndices[i]);
        if (index == -1) {
            hits[i].type = -1;
            continue;
        }

        // SDF takes 4 texels = 16 floats
        int baseY = index;

        vec4 col0 = texelFetch(sdfTexture, ivec2(0, baseY), 0);
        vec4 col1 = texelFetch(sdfTexture, ivec2(1, baseY), 0);
        vec4 col2 = texelFetch(sdfTexture, ivec2(2, baseY), 0);
        vec4 col3 = texelFetch(sdfTexture, ivec2(3, baseY), 0);

        hits[i].pos = col0.xyz;
        hits[i].type = int(col0.w);

        hits[i].params[0] = col1.x;
        hits[i].params[1] = col1.y;
        hits[i].params[2] = col1.z;
        hits[i].params[3] = col1.w;
        hits[i].params[4] = col2.x;
        hits[i].params[5] = col2.y;
        hits[i].params[6] = col2.z;
        hits[i].params[7] = col2.w;

        hits[i].op = int(col3.x);
        hits[i].color = int(col3.y);
    }
}

//draw pixel
void draw(inout vec4 color, in RayInfo ray) {
    vec3 p;
    vec4 d = march(p, ray);
    if (d.z != -1.0) {
        color = vec4(1.0, 0.0, 0.0, 1.0);
        vec3 norm = normal(p, d.z); 
        calcLighting(color, p, norm);
    } else {
        color = vec4(1.0);
    }
    
}

void main() {
    RayInfo ray;
    vec4 color = vec4(0.0);
    loadSDFData();
    initRayout(ray);
    initLight();
    draw(color, ray);
    //gamma correction
    color.xyz = pow( color.xyz, vec3(1.0/2.2));
    fragColor = color;
}