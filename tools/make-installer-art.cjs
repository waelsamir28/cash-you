#!/usr/bin/env node
"use strict";

// Build reproducible 24-bit BMP artwork for electron-builder's NSIS header/sidebar.
// No native graphics tools or npm dependencies are required.
const fs = require("node:fs");
const path = require("node:path");
const OUT = path.join(__dirname, "..", "assets", "branding");
fs.mkdirSync(OUT, { recursive: true });

const FONT = {
 C:["01110","10001","10000","10000","10000","10001","01110"],
 A:["01110","10001","10001","11111","10001","10001","10001"],
 S:["01111","10000","10000","01110","00001","00001","11110"],
 H:["10001","10001","10001","11111","10001","10001","10001"],
 Y:["10001","10001","01010","00100","00100","00100","00100"],
 O:["01110","10001","10001","10001","10001","10001","01110"],
 U:["10001","10001","10001","10001","10001","10001","01110"],
 M:["10001","11011","10101","10101","10001","10001","10001"],
 R:["11110","10001","10001","11110","10100","10010","10001"],
 T:["11111","00100","00100","00100","00100","00100","00100"],
 P:["11110","10001","10001","11110","10000","10000","10000"],
 I:["11111","00100","00100","00100","00100","00100","11111"],
 N:["10001","11001","10101","10011","10001","10001","10001"],
 E:["11111","10000","10000","11110","10000","10000","11111"],
 F:["11111","10000","10000","11110","10000","10000","10000"],
 D:["11110","10001","10001","10001","10001","10001","11110"],
 " ":["000","000","000","000","000","000","000"]
};
function canvas(w,h,top,bottom){const p=Buffer.alloc(w*h*3);for(let y=0;y<h;y++){const t=y/(h-1),c=top.map((v,i)=>Math.round(v+(bottom[i]-v)*t));for(let x=0;x<w;x++){const n=(y*w+x)*3;p[n]=c[2];p[n+1]=c[1];p[n+2]=c[0];}}return{width:w,height:h,pixels:p};}
function rect(c,x,y,w,h,rgb){for(let yy=Math.max(0,y);yy<Math.min(c.height,y+h);yy++)for(let xx=Math.max(0,x);xx<Math.min(c.width,x+w);xx++){const i=(yy*c.width+xx)*3;c.pixels[i]=rgb[2];c.pixels[i+1]=rgb[1];c.pixels[i+2]=rgb[0];}}
function circle(c,cx,cy,r,rgb){for(let y=Math.max(0,cy-r);y<Math.min(c.height,cy+r);y++)for(let x=Math.max(0,cx-r);x<Math.min(c.width,cx+r);x++)if((x-cx)**2+(y-cy)**2<=r*r){const i=(y*c.width+x)*3;c.pixels[i]=rgb[2];c.pixels[i+1]=rgb[1];c.pixels[i+2]=rgb[0];}}
function text(c,s,x,y,scale,rgb){let cx=x;for(const ch of s){const g=FONT[ch];if(!g){cx+=4*scale;continue;}for(let row=0;row<g.length;row++)for(let col=0;col<g[row].length;col++)if(g[row][col]==="1")rect(c,cx+col*scale,y+row*scale,scale,scale,rgb);cx+=(g[0].length+1)*scale;}}
function mark(c,x,y,size){const gap=Math.max(2,Math.floor(size/12)),bar=Math.floor((size-2*gap)/3);rect(c,x,y+Math.floor(size*.30),bar,Math.floor(size*.70),[47,190,210]);rect(c,x+bar+gap,y+Math.floor(size*.12),bar,Math.floor(size*.88),[69,143,245]);rect(c,x+2*(bar+gap),y,bar,size,[130,111,246]);}
function save(file,c){const stride=Math.ceil(c.width*3/4)*4,data=stride*c.height,b=Buffer.alloc(54+data);b.write("BM");b.writeUInt32LE(b.length,2);b.writeUInt32LE(54,10);b.writeUInt32LE(40,14);b.writeInt32LE(c.width,18);b.writeInt32LE(c.height,22);b.writeUInt16LE(1,26);b.writeUInt16LE(24,28);b.writeUInt32LE(data,34);for(let y=0;y<c.height;y++){const src=(c.height-1-y)*c.width*3,dst=54+y*stride;c.pixels.copy(b,dst,src,src+c.width*3);}fs.writeFileSync(path.join(OUT,file),b);}
const h=canvas(150,57,[17,24,39],[25,38,67]);circle(h,142,8,27,[28,48,82]);mark(h,10,12,32);text(h,"CASH YOU",54,23,2,[235,242,255]);save("installer-header.bmp",h);
const s=canvas(164,314,[15,23,42],[25,36,71]);circle(s,142,52,68,[27,46,83]);circle(s,6,280,66,[27,39,75]);mark(s,26,37,42);text(s,"CASH YOU",26,99,2,[238,244,255]);rect(s,26,126,42,2,[47,190,210]);text(s,"SMART SALES",26,148,1,[176,195,225]);text(s,"POINT OF SALE",26,162,1,[176,195,225]);rect(s,26,230,112,1,[58,77,117]);rect(s,26,237,68,2,[47,190,210]);save("installer-sidebar.bmp",s);
console.log("Generated NSIS header and sidebar artwork in assets/branding.");
