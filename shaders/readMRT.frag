precision highp float;

uniform sampler2D tex;
out vec4 bound;

void main()
{
    bound = vec4(texelFetch(tex, ivec2(0, 0), 0).rgb, 1.0);
}