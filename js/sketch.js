// ============================================================
// 模块B：中国木版年画基因图谱 — p5.js 代码生成艺术引擎
// 设计理念：将七大流派非遗纹样解构为算法图元，
//           色彩提取自中国传统色系，模拟雕版套色印刷肌理
// ============================================================

let currentSchool = "杨柳青";
let particles = [];
let targetParticleCount = 180;
let mouseInfluence = 0;
let carveGrid = [];
let timeSeed = 0;
let autoRotate = true;
let autoRotateTimer = 0;
let autoRotateInterval = 500;
let schoolList = ["杨柳青", "桃花坞", "潍坊杨家埠", "凤翔", "绵竹", "朱仙镇", "武强"];
let rippleRings = [];       // 流派切换时的涟漪
let mouseTrail = [];        // 鼠标拖尾

// ===================== 七大流派传统色谱 =====================
const colorPalettes = {
    "杨柳青": ['#D5625A','#2B4490','#F3C786','#4A4135','#C98F8F','#E8D5B0'],
    "桃花坞": ['#DE82A2','#56876D','#2B4490','#E29C45','#8C2E2E','#F5E6D0'],
    "潍坊杨家埠": ['#DE1C31','#1D953F','#F7C42F','#2E1E0E','#E8493A','#F2EDE2'],
    "凤翔": ['#AA2116','#C7A252','#3B4C6B','#5D4037','#F5DEB3','#E8D5B0'],
    "绵竹": ['#2F3E75','#D35400','#D9D9D9','#5D4037','#C49A6C','#F5DEB3'],
    "朱仙镇": ['#C3272B','#1C1C1C','#D4A017','#2B4490','#E8D5B0','#8B4513'],
    "武强": ['#B61A1A','#C49A6C','#222222','#1D953F','#F2EDE2','#D4A017'],
};

const schoolDescriptions = {
    "杨柳青": "天津 · 宫廷雅韵",
    "桃花坞": "苏州 · 江南秀雅",
    "潍坊杨家埠": "山东 · 乡土浓烈",
    "凤翔": "陕西 · 古拙雄浑",
    "绵竹": "四川 · 巴蜀神韵",
    "朱仙镇": "河南 · 中原古朴",
    "武强": "河北 · 粗犷民俗",
};

// ===================== p5.js 生命周期 =====================
function setup() {
    let container = document.getElementById('p5-canvas-container');
    let w = container.offsetWidth || 580;
    let h = 520;
    let canvas = createCanvas(w, h);
    canvas.parent('p5-canvas-container');
    canvas.mouseOver(() => { mouseInfluence = 1; autoRotate = false; });
    canvas.mouseOut(() => { mouseInfluence = 0; autoRotate = true; autoRotateTimer = autoRotateInterval - 80; });
    
    setTimeout(() => {
        let tip = document.getElementById('p5-tooltip');
        if (tip) tip.classList.add('fading');
    }, 6000);
    
    pixelDensity(1);
    noiseSeed(random(1000));
    timeSeed = random(1000);
    initParticles();
    initCarveGrid();
}

function draw() {
    background(18, 18, 18, 26);
    timeSeed += 0.005;
    
    // 自动轮播
    if (autoRotate && !mouseIsPressed) {
        autoRotateTimer++;
        if (autoRotateTimer >= autoRotateInterval) {
            autoRotateTimer = 0;
            let idx = schoolList.indexOf(currentSchool);
            switchArtStyleInternal(schoolList[(idx + 1) % schoolList.length]);
        }
    }
    
    let colors = colorPalettes[currentSchool] || colorPalettes["杨柳青"];
    let mx = map(mouseX, 0, width, -1, 1, true);
    let my = map(mouseY, 0, height, -1, 1, true);
    let mPress = mouseIsPressed ? 1.8 : 1.0;
    
    push();
    translate(width / 2, height / 2);
    
    // 鼠标拖尾
    drawMouseTrail(colors);
    
    drawSchoolLabel(colors);
    drawCarveTexture(colors, mx, my);
    drawSchoolMotif(colors, mx, my, mPress);
    
    // 涟漪
    rippleRings = rippleRings.filter(r => r.life > 0);
    rippleRings.forEach(r => { r.update(); r.display(colors); });
    
    particles.forEach(p => {
        p.update(mx, my, mPress);
        p.display(colors);
    });
    
    if (autoRotate) drawAutoRotateIndicator();
    pop();
}

// ===================== 鼠标拖尾 =====================
function drawMouseTrail(colors) {
    if (mouseInfluence > 0) {
        mouseTrail.push({ x: mouseX - width/2, y: mouseY - height/2, life: 30 });
    }
    mouseTrail = mouseTrail.filter(t => t.life-- > 0);
    noStroke();
    mouseTrail.forEach(t => {
        let c = color(colors[0]);
        c.setAlpha(t.life * 1.5);
        fill(c);
        ellipse(t.x, t.y, t.life * 0.3, t.life * 0.3);
    });
}

// ===================== 流派标签 =====================
function drawSchoolLabel(colors) {
    push();
    let txt = currentSchool + " · " + (schoolDescriptions[currentSchool] || "");
    textAlign(CENTER, TOP);
    textFont('serif');
    textSize(11);
    let c = color(colors[0]);
    c.setAlpha(80);
    fill(c);
    noStroke();
    text(txt, 0, -height/2 + 10);
    pop();
}

// ===================== 轮播指示器 =====================
function drawAutoRotateIndicator() {
    let progress = autoRotateTimer / autoRotateInterval;
    let barW = 52, y = height/2 - 14;
    noFill(); stroke(255, 20); strokeWeight(1);
    rect(-barW/2, y, barW, 3, 1.5);
    noStroke(); fill(191, 161, 111, 130);
    rect(-barW/2, y, barW * progress, 3, 1.5);
}

// ===================== 粒子系统 =====================
function initParticles() {
    particles = [];
    for (let i = 0; i < targetParticleCount; i++) {
        particles.push(new ArtParticle());
    }
}

class ArtParticle {
    constructor() {
        let angle = random(TWO_PI);
        let radius = random(8, 230);
        this.pos = createVector(cos(angle) * radius, sin(angle) * radius);
        this.vel = p5.Vector.random2D().mult(random(0.08, 0.7));
        this.acc = createVector(0, 0);
        this.size = random(1.2, 5.5);
        this.life = random(0.25, 1);
        this.phase = random(TWO_PI);
    }
    update(mx, my, mPress) {
        if (mouseInfluence > 0 && this.pos.mag() < 250) {
            let toMouse = createVector(mx * 80, my * 80).sub(this.pos);
            let d = toMouse.mag();
            if (d < 130) {
                let force = toMouse.normalize().mult(map(d, 0, 130, 2.5, 0) * mPress);
                this.acc.add(force);
            }
        }
        let n = noise((this.pos.x+300)*0.008+timeSeed, (this.pos.y+300)*0.008+timeSeed);
        let flowAngle = n * TWO_PI * 2;
        this.acc.add(p5.Vector.fromAngle(flowAngle, 0.18));
        this.vel.add(this.acc);
        this.vel.limit(2);
        this.pos.add(this.vel);
        this.acc.mult(0);
        if (this.pos.mag() > 238) {
            this.pos.setMag(random(10, 45));
            this.vel = p5.Vector.random2D().mult(random(0.2, 1));
        }
    }
    display(colors) {
        push();
        translate(this.pos.x, this.pos.y);
        let idx = abs(floor(this.pos.x+this.pos.y+this.phase)) % colors.length;
        let c = color(colors[idx]);
        c.setAlpha(this.life * 210);
        noStroke(); fill(c);
        let t = floor(abs(this.pos.x*11+this.pos.y*8)) % 4;
        if (t === 0) ellipse(0, 0, this.size, this.size*0.65);
        else if (t === 1) {
            beginShape();
            vertex(0,-this.size*0.8); vertex(this.size*0.55,0);
            vertex(0,this.size*0.8); vertex(-this.size*0.55,0);
            endShape(CLOSE);
        } else if (t === 2) {
            rect(0, 0, this.size*0.75, this.size*1.1, 1.5);
        } else {
            // 圆形 + 小点（雕版针孔）
            ellipse(0, 0, this.size*0.8);
            fill(color(colors[(idx+1)%colors.length]));
            ellipse(this.size*0.3, 0, 1.5, 1.5);
        }
        pop();
    }
}

// ===================== 雕版刻痕纹理 =====================
function initCarveGrid() {
    carveGrid = [];
    let cols = 32, rows = 26;
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            carveGrid.push({
                x: map(i, 0, cols-1, -270, 270),
                y: map(j, 0, rows-1, -210, 210),
                size: random(1, 4.5),
                angle: random(TWO_PI),
                offset: random(TWO_PI)
            });
        }
    }
}

function drawCarveTexture(colors, mx, my) {
    noFill();
    carveGrid.forEach(g => {
        let d = dist(g.x, g.y, mx*60, my*60);
        let alpha = map(d, 0, 100, 38, 1, true);
        let idx = floor(abs(g.x+g.y)) % colors.length;
        let c = color(colors[idx]); c.setAlpha(alpha);
        stroke(c); strokeWeight(0.35);
        push();
        translate(g.x, g.y);
        rotate(g.angle + sin(timeSeed*2+g.offset)*0.3);
        line(-g.size, 0, g.size, 0);
        pop();
    });
}

// ===================== 涟漪 =====================
class RippleRing {
    constructor() {
        this.radius = 5;
        this.life = 40;
        this.maxR = random(120, 200);
    }
    update() { this.radius += (this.maxR - this.radius) * 0.08; this.life -= 1.2; }
    display(colors) {
        let c = color(colors[0]);
        c.setAlpha(this.life * 2.5);
        noFill(); stroke(c); strokeWeight(1.2);
        ellipse(0, 0, this.radius*2, this.radius*2);
    }
}

// ===================== 七流派图案算法 =====================
function drawSchoolMotif(colors, mx, my, mPress) {
    switch (currentSchool) {
        case "杨柳青": drawYangliuqing(colors, mx, my, mPress); break;
        case "桃花坞": drawTaohuawu(colors, mx, my, mPress); break;
        case "潍坊杨家埠": drawYangjiabu(colors, mx, my, mPress); break;
        case "凤翔": drawFengxiang(colors, mx, my, mPress); break;
        case "绵竹": drawMianzhu(colors, mx, my, mPress); break;
        case "朱仙镇": drawZhuxianzhen(colors, mx, my, mPress); break;
        case "武强": drawWuqiang(colors, mx, my, mPress); break;
    }
}

// ---- 杨柳青：工笔线描 · 婴儿抱鱼 ----
function drawYangliuqing(colors, mx, my, mPress) {
    push();
    let layers = 10;
    for (let l = 0; l < layers; l++) {
        let r = 25 + l * 20 + sin(timeSeed*3+l)*12;
        let clr = color(colors[l%colors.length]); clr.setAlpha(22+l*3);
        stroke(clr); strokeWeight(0.5+l*0.07); noFill();
        beginShape();
        for (let a = 0; a < TWO_PI; a += 0.04) {
            let wave = sin(a*5+timeSeed*2+l*0.7)*9 + sin(a*3+timeSeed*1.4)*6 + mx*9*sin(a*2);
            let rr = r + wave;
            vertex(rr*cos(a), rr*sin(a)*0.85);
        }
        endShape(CLOSE);
    }
    stroke(colors[0]); strokeWeight(1.5); noFill();
    let faceR = 30 + sin(timeSeed*2)*5;
    arc(0, -6, faceR, faceR*0.85, PI*0.25, PI*0.75);
    // 眼睛暗示
    stroke(colors[3]); strokeWeight(1.8);
    point(-faceR*0.3, -6); point(faceR*0.3, -6);
    pop();
}

// ---- 桃花坞：繁花织锦 ----
function drawTaohuawu(colors, mx, my, mPress) {
    push();
    let petals = 12;
    for (let ring = 0; ring < 6; ring++) {
        let baseR = 35 + ring*26 + sin(timeSeed*2.5+ring)*7;
        for (let i = 0; i < petals; i++) {
            let angle = (TWO_PI/petals)*i + ring*0.15 + timeSeed*0.3;
            let r = baseR + cos(timeSeed*3+i*0.5)*14 + my*12;
            let x = r*cos(angle), y = r*sin(angle);
            let clr = color(colors[(i+ring)%colors.length]); clr.setAlpha(45+ring*5);
            fill(clr); stroke(colors[(i+ring+1)%colors.length]); strokeWeight(0.25);
            push(); translate(x, y); rotate(angle+timeSeed);
            beginShape();
            for (let t=0; t<TWO_PI; t+=0.1) {
                let pr = 7+ring*3;
                let shape = pr*(0.7+0.3*sin(t*2+timeSeed));
                vertex(shape*cos(t), shape*sin(t)*0.6);
            }
            endShape(CLOSE);
            pop();
        }
    }
    // 中心团花
    for (let i=0; i<30; i++) {
        let a = (TWO_PI/30)*i;
        let r = 18+sin(i*0.5+timeSeed*4)*6;
        stroke(colors[i%colors.length]); strokeWeight(0.4);
        line(0,0,r*cos(a),r*sin(a));
    }
    pop();
}

// ---- 杨家埠：门神面谱 ----
function drawYangjiabu(colors, mx, my, mPress) {
    push();
    stroke(colors[0]); strokeWeight(2.5+mPress); noFill();
    beginShape();
    for (let a=0; a<TWO_PI; a+=0.05) {
        let fr = 58+sin(a*3+timeSeed)*9+cos(a*5)*4;
        vertex(fr*cos(a)*0.85, fr*sin(a)*1.1);
    }
    endShape(CLOSE);
    stroke(colors[3]); strokeWeight(5.5);
    let by = -18+my*8;
    line(-38,by-5,-10,by-2); line(10,by-2,38,by-5);
    let ey = -5+my*5;
    stroke(colors[0]); strokeWeight(2.2); fill(colors[3]);
    ellipse(-20,ey,18,9); ellipse(20,ey,18,9);
    // 眼珠
    fill(255,200); noStroke();
    ellipse(-20,ey,5,5); ellipse(20,ey,5,5);
    stroke(colors[3]); strokeWeight(1.3);
    for (let i=0; i<14; i++) {
        let x = map(i,0,13,-32,32);
        let y = 24+abs(x)*0.35+sin(timeSeed*3+i)*5;
        line(x, y, x*1.7, y+32);
    }
    noStroke();
    let ba = 22+6*sin(timeSeed*2);
    let c0=color(colors[0]);c0.setAlpha(ba);fill(c0);rect(-28,-38,56,28,22);
    let c2=color(colors[2]);c2.setAlpha(ba);fill(c2);rect(-22,10,44,14,7);
    pop();
}

// ---- 凤翔：西府纳祥 ----
function drawFengxiang(colors, mx, my, mPress) {
    push();
    for (let r=18; r<170; r+=24) {
        let clr=color(colors[floor(r/24)%colors.length]);clr.setAlpha(28);
        stroke(clr);strokeWeight(0.6+r*0.004);noFill();
        ellipse(0,0,(r+sin(timeSeed*2+r*0.1)*6)*2);
    }
    for (let i=0;i<18;i++) {
        let a=(TWO_PI/18)*i+timeSeed*0.15;
        let clr=color(colors[i%colors.length]);clr.setAlpha(55);
        stroke(clr);strokeWeight(0.7);
        for (let s=0;s<5;s++) {
            let r1=22+s*30,r2=r1+24;
            line(r1*cos(a),r1*sin(a),r2*cos(a+0.08),r2*sin(a+0.08));
        }
    }
    stroke(colors[1]);strokeWeight(1.4);noFill();
    for (let i=0;i<4;i++) {
        push();rotate((TWO_PI/4)*i+timeSeed*0.4);
        beginShape();
        for (let t=0;t<PI*1.2;t+=0.08) {
            let sr=48+sin(t*4+timeSeed*2)*9;
            vertex(sr*cos(t+0.3),sr*0.6*sin(t+0.3));
        }
        endShape();pop();
    }
    let sc=color(colors[0]);sc.setAlpha(28+18*sin(timeSeed*3));
    noStroke();fill(sc);rect(-10,-10,20,20,3);
    pop();
}

// ---- 绵竹：立锤门神 ----
function drawMianzhu(colors, mx, my, mPress) {
    push();
    for (let l=0;l<7;l++) {
        let r=32+l*26+sin(timeSeed*2.5+l*0.8)*9;
        let clr=color(colors[l%colors.length]);clr.setAlpha(16+l*5);
        stroke(clr);strokeWeight(0.4+l*0.1);noFill();
        beginShape();
        for (let a=0;a<TWO_PI;a+=0.03) {
            let wave=sin(a*4+timeSeed*1.8+l)*7+cos(a*2+timeSeed)*5;
            let vm=sin(a)>0?1.08:0.78;
            vertex((r+wave)*vm*cos(a),(r+wave)*vm*sin(a));
        }
        endShape(CLOSE);
    }
    stroke(colors[1]);strokeWeight(2.8);line(0,-58,0,58);
    stroke(colors[0]);strokeWeight(2);
    line(-20,-42+my*8,20,-42+my*8);
    line(-24,0,24,0);
    noStroke();
    let c=color(colors[0]);c.setAlpha(22);fill(c);rect(-14,-52,28,22,3);
    c=color(colors[2]);c.setAlpha(22);fill(c);rect(-12,32,24,18,3);
    pop();
}

// ---- 朱仙镇：马上鞭 · 动态骑射 ----
function drawZhuxianzhen(colors, mx, my, mPress) {
    push();
    // 放射状神光 — 朱仙镇特色
    let rays = 24;
    for (let i = 0; i < rays; i++) {
        let a = (TWO_PI/rays)*i + timeSeed*0.1;
        let r1 = 30, r2 = 90 + sin(timeSeed*2+i*0.5)*20;
        let clr = color(colors[i%colors.length]); clr.setAlpha(40);
        stroke(clr); strokeWeight(0.5 + (i%3)*0.3);
        line(r1*cos(a), r1*sin(a), r2*cos(a), r2*sin(a));
    }
    // 核心构图 — 模仿马上鞭的三角结构
    stroke(colors[0]); strokeWeight(2.5); noFill();
    beginShape();
    for (let a = 0; a < TWO_PI; a += 0.06) {
        let rr = 40 + sin(a*3+timeSeed)*10 + cos(a*5)*6;
        vertex(rr*cos(a)*0.9, rr*sin(a)*1.15);
    }
    endShape(CLOSE);
    // 武器暗示 — 横线表示鞭
    stroke(colors[2]); strokeWeight(3);
    let wy = my*15 + sin(timeSeed*2)*12;
    line(-55, wy, 55, wy);
    line(-45, wy-10, -55, wy);
    line(45, wy-10, 55, wy);
    // 色块
    noStroke();
    let c = color(colors[0]); c.setAlpha(30); fill(c);
    rect(-30, -20, 60, 15, 4);
    pop();
}

// ---- 武强：六子争头 · 交错布局 ----
function drawWuqiang(colors, mx, my, mPress) {
    push();
    // 武强以连环画式布局闻名，六组交错方块
    let rows = 3, cols = 2;
    let cellW = 55, cellH = 65;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            let cx = (c - 0.5) * cellW * 1.2;
            let cy = (r - 1) * cellH * 1.1;
            let clr = color(colors[(r*cols+c)%colors.length]);
            clr.setAlpha(30);
            stroke(clr); strokeWeight(0.8); noFill();
            rect(cx - cellW/2, cy - cellH/2, cellW, cellH, 4);
            // 内部符号
            let sc = color(colors[(r*cols+c+1)%colors.length]);
            sc.setAlpha(40);
            fill(sc); noStroke();
            let symSize = 10 + sin(timeSeed*3 + r + c)*4;
            ellipse(cx, cy, symSize, symSize*0.7);
        }
    }
    // 串联折线 — 隐喻"六子"的连体结构
    stroke(colors[0]); strokeWeight(1.5); noFill();
    beginShape();
    for (let a = 0; a < TWO_PI*3; a += 0.15) {
        let rr = 55 + sin(a*2+timeSeed)*15;
        vertex(rr*cos(a), rr*sin(a)*0.6);
    }
    endShape();
    pop();
}

// ===================== 键盘交互 =====================
function keyPressed() {
    autoRotate = false; autoRotateTimer = autoRotateInterval - 60;
    let idx = schoolList.indexOf(currentSchool);
    if (keyCode === RIGHT_ARROW || keyCode === DOWN_ARROW || key==='n'||key==='N') {
        switchArtStyleInternal(schoolList[(idx+1)%schoolList.length]);
    } else if (keyCode === LEFT_ARROW || keyCode === UP_ARROW || key==='p'||key==='P') {
        switchArtStyleInternal(schoolList[(idx-1+schoolList.length)%schoolList.length]);
    } else if (key===' '||key==='a'||key==='A') {
        autoRotate = !autoRotate;
    } else if (key>='1'&&key<='7') {
        let num = parseInt(key)-1;
        if (num<schoolList.length) switchArtStyleInternal(schoolList[num]);
    }
    return false;
}

function mouseMoved() {
    mouseInfluence = 1;
    if (autoRotate) { autoRotate = false; autoRotateTimer = autoRotateInterval - 80; }
}

function mousePressed() {
    particles.forEach(p => {
        let d = dist(mouseX-width/2, mouseY-height/2, p.pos.x, p.pos.y);
        if (d<60) {
            let dir = p5.Vector.sub(p.pos, createVector(mouseX-width/2, mouseY-height/2));
            dir.normalize().mult(5);
            p.vel.add(dir);
        }
    });
    // 点击产生涟漪
    for (let i=0;i<3;i++) rippleRings.push(new RippleRing());
}

// ===================== 内部切换 =====================
function switchArtStyleInternal(schoolName) {
    if (!colorPalettes[schoolName]) return;
    currentSchool = schoolName;
    // 涟漪爆炸
    for (let i=0;i<5;i++) rippleRings.push(new RippleRing());
    particles.forEach(p => {
        p.vel.mult(4);
        setTimeout(()=>{p.vel.normalize().mult(random(0.2,1));p.pos.setMag(random(8,130));},350);
    });
    initCarveGrid();
}

// ===================== 外部调用接口 =====================
window.switchArtStyle = function(schoolName) {
    autoRotate = false; autoRotateTimer = 0;
    switchArtStyleInternal(schoolName);
    document.querySelectorAll('.style-btn').forEach(btn => {
        btn.classList.remove('active');
        if(btn.getAttribute('data-school')===schoolName) btn.classList.add('active');
    });
};

// 绑定按钮
document.querySelectorAll('.style-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.style-btn').forEach(b=>b.classList.remove('active'));
        this.classList.add('active');
        window.switchArtStyle(this.getAttribute('data-school'));
    });
});

function windowResized() {
    let container = document.getElementById('p5-canvas-container');
    if (container) resizeCanvas(container.offsetWidth||580,520);
}
