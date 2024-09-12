precision highp float;
precision highp int;

out vec4 fragColor;
in vec3 rd;
uniform vec3 cameraPosition;
uniform vec2 resolution;

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

///////////////////////////////////////////////////////////////////////////////////////
// INIT FUNCTIONS //

void initLight() {
    light.position = vec3(0.0, 2.0, 0.0);
    light.direction = vec3(0.0,.5, -.2);
}

void initRayout(out RayInfo ray) 
{
    vec2 uv = ( gl_FragCoord.xy / resolution.xy ) * 2.0 - 1.0;
    uv.x *= resolution.x / resolution.y;

    ray.origin = cameraPosition;
    ray.dir = normalize( vec3( uv, 1. ) );
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
//Primatives//

float sdPlane( vec3 p, vec3 n, float h )
{
  // n must be normalized
  return dot(p,n) + h;
}

float sdSphere( vec3 p, float s )
{
  return length(p)-s;
}

float sdEllipsoid( vec3 p, vec3 r )
{
  float k0 = length(p/r);
  float k1 = length(p/(r*r));
  return k0*(k0-1.0)/k1;
}

float sdColumn( vec3 p, float s, float top, float bottom) {
    float d = length(p.xz) - (s - 0.05*p.y);
    d=max(d, p.y -top);
    d=max(d, -p.y -bottom);
    return d;
}

float sdRoundCone( vec3 p, float r1, float r2, float h )
{
  // sampling independent computations (only depend on shape)
  float b = (r1-r2)/h;
  float a = sqrt(1.0-b*b);

  // sampling dependant computations
  vec2 q = vec2( length(p.xz), p.y );
  float k = dot(q,vec2(-b,a));
  if( k<0.0 ) return length(q) - r1;
  if( k>a*h ) return length(q-vec2(0.0,h)) - r2;
  return dot(q, vec2(a,b) ) - r1;
}

float Thor(vec3 p) {
    float d;

    //torso

    //rotating the torso
    vec3 torsor = rotatex(p, radians(25.0));
    torsor = rotatey(torsor, radians(0.0));

    float tpy = -0.05;
    float s1 = sdEllipsoid(torsor + vec3(0.0,tpy+0.1,.1), vec3(0.7, 0.8, 0.6));
    float s2 = sdSphere(torsor+vec3(0.0,-1.3+tpy,-.1), 0.45);
    float e1 = sdEllipsoid(torsor+vec3(0.0,-0.9+tpy,-0.1), vec3(0.26, 0.6, 0.26) + p.y * vec3(0.05,0.0,0.05) );
    float body = opSmoothSubtraction(s2, opSmoothUnion(s1, e1, 0.4), 0.1);

    //legs
    //mirroring the leg across the x axis
    vec3 mirroredleg = vec3(abs(p.x), p.y, p.z);
    float leg = sdColumn(mirroredleg-vec3(0.3, -1.0,0.0), 0.2, 0.8, 0.0);
    float thigh = sdEllipsoid(mirroredleg-vec3(0.43, -0.4, 0.0), vec3(0.1, 0.2, 0.2));
    float lower = opSmoothUnion(thigh, leg, 0.1);
    d = opSmoothUnion(lower,body, 0.3);

    //head
    float hpy = 0.3;
    //rotating the head
    vec3 headr = rotatex(p -vec3(0.0,1.6 - hpy,-.1), radians(-70.0));
    headr = rotatey(headr, radians(0.0));
    float face = opSubtraction(sdSphere(p-vec3(0.0,1.5 - hpy, -.35), 0.26), sdEllipsoid(p-vec3(0.0,1.5 - hpy, -.35), vec3(0.28)));
    face = opSubtraction(sdSphere(p - vec3(0.0, 1.20, -0.47), 0.19), face);
    face = opSubtraction(sdSphere(p - vec3(0.0, 1.4, -.5), 0.07), face);
    float antenna = sdColumn(headr, 0.2 - p.y * 0.04 ,0.7 ,0.0);
    
    float head = opSmoothUnion(face, antenna, 0.15);
    d = opUnion(d, head);
    return d;
}

float map(vec3 p) {
    vec3 rot = rotatex(p, radians(0.0));
    rot = rotatey(rot, radians(0.0));
    float thor = Thor(rot);
    float p1 = sdPlane(p, vec3(0.0, 1.0, 0.0), 1.0);
    return opUnion(thor, p1);
}


//get normal using finite difference
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

//refactor to only return distance
// when d.z is distance lighting is fucked
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

//draw pixel
void draw(inout vec4 color, in RayInfo ray) {
    vec3 p;
    vec4 d = march(p, ray);
    if (d.z != -1.0) {
        color = vec4(1.0, 0.0, 0.0, 1.0);
        vec3 norm = normal(p, d.z); 
        calcLighting(color, p, norm);
    }
    
}

void main() {
    RayInfo ray;
    vec4 color = vec4(1.0);

    initRayout(ray);
    initLight();
    draw(color, ray);

    //gamma correction
    color.xyz = pow( color.xyz, vec3(1.0/2.2));

    fragColor = color;
}