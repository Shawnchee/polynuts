'use client';

import { useEffect, useRef } from 'react';

interface AuroraProps {
  colorStops?: [string, string, string];
  amplitude?: number;
  blend?: number;
  speed?: number;
  className?: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

const VERT = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
uniform float uTime;
uniform float uAmplitude;
uniform float uBlend;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec2 uResolution;

vec3 mod289v3(vec3 x){return x-floor(x*(1./289.))*289.;}
vec2 mod289v2(vec2 x){return x-floor(x*(1./289.))*289.;}
vec3 permute3(vec3 x){return mod289v3(((x*34.)+1.)*x);}

float snoise(vec2 v){
  const vec4 C=vec4(0.211324865,0.366025403,-0.577350269,0.024390243);
  vec2 i=floor(v+dot(v,C.yy));
  vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
  vec4 x12=x0.xyxy+C.xxzz;
  x12.xy-=i1;
  i=mod289v2(i);
  vec3 p=permute3(permute3(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);
  m=m*m*m*m;
  vec3 x=2.*fract(p*C.www)-1.;
  vec3 h=abs(x)-0.5;
  vec3 a0=x-floor(x+0.5);
  m*=1.79284291-0.85373472*(a0*a0+h*h);
  vec3 g;
  g.x=a0.x*x0.x+h.x*x0.y;
  g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.*dot(m,g);
}

void main(){
  vec2 uv=gl_FragCoord.xy/uResolution;
  float t=uTime*0.18;

  float n1=snoise(vec2(uv.x*1.8+t*0.12,uv.y*1.2-t*0.08))*uAmplitude;
  float n2=snoise(vec2(uv.x*2.4-t*0.09,uv.y*2.1+t*0.14))*uAmplitude*0.6;
  float wave=sin(uv.x*3.14159+n1)*0.5+0.5+n2*0.25;
  wave=clamp(wave,0.,1.);

  float falloff=smoothstep(1.,0.2,uv.y)*smoothstep(0.,0.15,uv.y);
  wave*=falloff*1.4;

  vec3 color;
  if(wave<0.5){
    color=mix(uColor0,uColor1,wave*2.);
  } else {
    color=mix(uColor1,uColor2,(wave-0.5)*2.);
  }

  float alpha=clamp(wave*uBlend*1.6,0.,1.);
  gl_FragColor=vec4(color,alpha);
}
`;

export function Aurora({
  colorStops = ['#00c3ff', '#7b2fff', '#ff2fa0'],
  amplitude = 1.0,
  blend = 0.7,
  speed = 1.0,
  className = '',
}: AuroraProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const propsRef = useRef({ colorStops, amplitude, blend, speed });

  useEffect(() => {
    propsRef.current = { colorStops, amplitude, blend, speed };
  }, [colorStops, amplitude, blend, speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
    if (!gl) return;

    // Compile shaders
    function compile(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      return s;
    }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    // Full-screen triangle (covers viewport with a single triangle)
    const verts = new Float32Array([-1, -1, 3, -1, -1, 3]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(prog, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uAmp = gl.getUniformLocation(prog, 'uAmplitude');
    const uBlend = gl.getUniformLocation(prog, 'uBlend');
    const uColor0 = gl.getUniformLocation(prog, 'uColor0');
    const uColor1 = gl.getUniformLocation(prog, 'uColor1');
    const uColor2 = gl.getUniformLocation(prog, 'uColor2');
    const uRes = gl.getUniformLocation(prog, 'uResolution');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      gl!.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener('resize', resize);

    let startTime = performance.now();

    function render() {
      const { colorStops: cs, amplitude: amp, blend: bl, speed: spd } = propsRef.current;
      const t = ((performance.now() - startTime) / 1000) * spd;

      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);

      gl!.uniform1f(uTime, t);
      gl!.uniform1f(uAmp, amp);
      gl!.uniform1f(uBlend, bl);
      gl!.uniform3fv(uColor0, hexToRgb(cs[0]));
      gl!.uniform3fv(uColor1, hexToRgb(cs[1]));
      gl!.uniform3fv(uColor2, hexToRgb(cs[2]));
      gl!.uniform2f(uRes, canvas!.width, canvas!.height);

      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      rafRef.current = requestAnimationFrame(render);
    }
    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      gl.deleteProgram(prog);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 h-full w-full ${className}`}
      style={{ display: 'block' }}
    />
  );
}
