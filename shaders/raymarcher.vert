precision highp float;
in vec3 position;
out vec3 rd;


uniform mat4 viewMatrix;
uniform vec2 resolution;
uniform float cameraFov;


void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
    float aspect = resolution.y / resolution.x;
    vec2 uv = vec2(position.x, position.y * aspect);
    //take inverse of tan and multiply by opposite side (hardcoded 2) to get adjacent side
    // tan(theta) = opposite/adjacent
    float distToNear = (1.0 / tan(radians(cameraFov) / 2.0)) * aspect;
    rd = normalize(vec3(uv, -distToNear) * mat3(viewMatrix));
}