'use strict';

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.walk = 0;
    this.moving = false;
    this.swinging = false;
    this.swingT = 0;
    this.toolType = 'hand';
    this.stepT = 0;
    this.blinkTimer = 3;
    this.blink = false;
  }

  update(dt, game) {
    const k = game.keys;
    let dx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    let dy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    const len = Math.hypot(dx, dy);
    this.moving = len > 0;

    if (this.moving) {
      dx /= len;
      dy /= len;
    }

    const sprint = k.sprint && this.moving && game.state.energy > 2;
    const speed = 188 * (game.state.upgrades.boots ? 1.15 : 1) * (sprint ? 1.42 : 1);

    this.vx = dx * speed;
    this.vy = dy * speed;

    const nx = clamp(this.x + this.vx * dt, 50, game.world.w - 50);
    const ny = clamp(this.y + this.vy * dt, 80, game.world.h - 50);
    if (!game.world.isBlocked(nx, this.y)) this.x = nx;
    if (!game.world.isBlocked(this.x, ny)) this.y = ny;

    if (this.moving) {
      this.walk += dt * (sprint ? 11 : 7.5);
      if (dx !== 0) this.facing = dx > 0 ? 1 : -1;

      this.stepT += dt;
      if (this.stepT > (sprint ? 0.2 : 0.3)) {
        this.stepT = 0;
        game.spawnDust(this.x - this.facing * 5, this.y + 1);
        if (Math.random() < 0.5) Sound.step();
      }
    } else {
      this.walk += dt * 1.6;
      this.stepT = 0;
    }

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blink = true;
      this.blinkTimer = 2.6 + Math.random() * 4;
    } else if (this.blinkTimer < 2.48) {
      this.blink = false;
    }

    if (sprint) game.state.energy = Math.max(0, game.state.energy - dt * 4.5);

    if (this.swinging) {
      this.swingT += dt / 0.22;
      if (this.swingT >= 1) {
        this.swingT = 0;
        this.swinging = false;
      }
    }
  }

  swing(toolType) {
    this.swinging = true;
    this.swingT = 0;
    this.toolType = toolType || 'hand';
  }

  draw(ctx, game) {
    const t = game.clock;
    const bob = this.moving ? Math.abs(Math.sin(this.walk)) * 1.8 : Math.sin(t * 2.2) * 0.7;
    const step = this.moving ? Math.sin(this.walk) * 4 : 0;
    const lean = this.moving ? 0.045 : 0;

    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y));

    ctx.fillStyle = 'rgba(20, 45, 25, 0.24)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 14 - bob * 0.4, 5.4, 0, 0, TAU);
    ctx.fill();

    ctx.scale(this.facing, 1);
    if (this.moving) ctx.rotate(lean);

    // Back arm
    ctx.save();
    ctx.translate(-5, -29);
    ctx.rotate(-0.5 - Math.sin(this.walk) * 0.25);
    ctx.strokeStyle = '#32908b';
    ctx.lineWidth = 4.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 12);
    ctx.stroke();
    ctx.fillStyle = '#edc29a';
    ctx.beginPath();
    ctx.arc(0, 12.4, 2.8, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Legs
    ctx.fillStyle = '#48536d';
    rr(ctx, -7, -12 + Math.max(0, step), 6.5, 12, 3);
    ctx.fill();
    rr(ctx, 0.5, -12 + Math.max(0, -step), 6.5, 12, 3);
    ctx.fill();

    ctx.fillStyle = '#39435a';
    rr(ctx, -7.6, -4 + Math.max(0, step), 8, 4.8, 2);
    ctx.fill();
    rr(ctx, -0.6, -4 + Math.max(0, -step), 8, 4.8, 2);
    ctx.fill();
    ctx.fillStyle = '#7a5236';
    rr(ctx, -7.6, -2.4 + Math.max(0, step), 8, 2.4, 1.2);
    ctx.fill();
    rr(ctx, -0.6, -2.4 + Math.max(0, -step), 8, 2.4, 1.2);
    ctx.fill();

    ctx.translate(0, -bob);

    // Backpack
    ctx.fillStyle = '#9a6636';
    rr(ctx, -15, -34, 10, 19, 4.5);
    ctx.fill();
    ctx.strokeStyle = '#744a26';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#c48a52';
    rr(ctx, -13.4, -28, 6.8, 6.4, 2);
    ctx.fill();
    ctx.strokeStyle = '#7d5133';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-13, -31);
    ctx.lineTo(-7, -31);
    ctx.stroke();
    ctx.fillStyle = '#e5d79a';
    ctx.beginPath();
    ctx.arc(-10, -35.4, 1.5, 0, TAU);
    ctx.fill();

    // Body tunic
    ctx.fillStyle = '#3fa7a0';
    rr(ctx, -9.5, -34, 19, 23, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(24, 74, 70, 0.55)';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.fillStyle = 'rgba(94, 210, 202, 0.55)';
    rr(ctx, -7.8, -32.6, 7, 9, 3.4);
    ctx.fill();

    ctx.fillStyle = '#2f807b';
    rr(ctx, -9.5, -14.4, 19, 4.4, 2.2);
    ctx.fill();
    ctx.fillStyle = '#f2c66a';
    rr(ctx, -1.6, -14.8, 3.4, 3.4, 1.2);
    ctx.fill();

    ctx.strokeStyle = '#2c7f7a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-3, -33);
    ctx.lineTo(-3, -15);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(70, 160, 154, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6.4, -30);
    ctx.quadraticCurveTo(-6.8, -22, -5.6, -17);
    ctx.stroke();

    // Scarf
    ctx.fillStyle = '#e8734a';
    rr(ctx, -8.8, -36.4, 17.4, 5, 2.5);
    ctx.fill();
    const flutter = Math.sin(t * 6 + this.walk) * 2;
    ctx.fillStyle = '#d9623c';
    ctx.beginPath();
    ctx.moveTo(-7.6, -35);
    ctx.quadraticCurveTo(-13, -33.4 + flutter, -16, -29 + flutter);
    ctx.quadraticCurveTo(-12, -29.6, -7.6, -32.2);
    ctx.closePath();
    ctx.fill();

    // Head
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(0, -43, 9, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 80, 55, 0.35)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.fillStyle = '#6b4a33';
    ctx.beginPath();
    ctx.arc(0, -45, 8.6, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-7.4, -46.6, 2.4, 3.6, 0.4, 0, TAU);
    ctx.fill();

    // Face
    if (this.blink) {
      ctx.strokeStyle = '#3a2f26';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(0.8, -43);
      ctx.lineTo(3.2, -43);
      ctx.moveTo(4.8, -43);
      ctx.lineTo(7.2, -43);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#3a2f26';
      ctx.beginPath();
      ctx.arc(2.4, -43.2, 1.25, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(6.2, -43.2, 1.25, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(2.8, -43.7, 0.4, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(6.6, -43.7, 0.4, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(232, 130, 110, 0.3)';
    ctx.beginPath();
    ctx.arc(4.4, -39.8, 2.7, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = 'rgba(120, 70, 50, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(4.6, -39.2, 2, 0.3, Math.PI - 0.6);
    ctx.stroke();

    // Straw hat
    ctx.fillStyle = '#e8c66a';
    ctx.beginPath();
    ctx.ellipse(0, -49.5, 13.4, 4.6, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180, 140, 60, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#d9b355';
    ctx.beginPath();
    ctx.ellipse(0, -51, 7.6, 6.4, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = '#b9913f';
    rr(ctx, -7.6, -51.2, 15.2, 2.6, 1.3);
    ctx.fill();
    ctx.strokeStyle = '#b9913f';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, -49.6, 7.6, 2.4, 0, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#79b566';
    ctx.beginPath();
    ctx.ellipse(5.4, -53.2, 3, 1.5, -0.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#5a8f4a';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(5.4, -53.4);
    ctx.quadraticCurveTo(3.6, -54, 2.4, -53.2);
    ctx.stroke();

    // Front arm and tool
    this.drawArm(ctx, game);

    ctx.restore();
  }

  drawArm(ctx, game) {
    const idle = Math.sin(this.walk) * 0.16;
    let angle = 0.45 + idle;
    if (this.swinging) {
      const p = Math.sin(this.swingT * Math.PI);
      angle = lerp(-1.55, 0.75, p);
    }

    ctx.save();
    ctx.translate(6, -29);
    ctx.rotate(angle);

    if (this.swinging) {
      ctx.strokeStyle = 'rgba(255, 246, 216, 0.32)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 12, 22, -1.9, 0.4);
      ctx.stroke();
    }

    ctx.strokeStyle = '#3fa7a0';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 13);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(94, 210, 202, 0.5)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-1.4, 2);
    ctx.lineTo(-1.4, 11);
    ctx.stroke();

    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(0, 13, 3.1, 0, TAU);
    ctx.fill();

    const tool = this.toolType;
    const steel = tool === 'steelAxe' || tool === 'steelPick';

    if (tool === 'axe' || tool === 'steelAxe') {
      ctx.strokeStyle = '#8a5a3b';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.lineTo(0, 29);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(210, 165, 110, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-0.8, 14);
      ctx.lineTo(-0.8, 26);
      ctx.stroke();

      ctx.fillStyle = steel ? '#c3cbd4' : '#b0b8c1';
      ctx.beginPath();
      ctx.moveTo(0, 21);
      ctx.quadraticCurveTo(9, 22, 10, 25);
      ctx.quadraticCurveTo(8.4, 30, 0, 30);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = steel ? '#8f98a2' : '#7f8891';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(2, 23);
      ctx.quadraticCurveTo(7, 23.6, 8.4, 25);
      ctx.stroke();
    } else if (tool === 'pickaxe' || tool === 'steelPick') {
      ctx.strokeStyle = '#8a5a3b';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.lineTo(0, 29);
      ctx.stroke();
      ctx.strokeStyle = steel ? '#c3cbd4' : '#a8b1ba';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-8, 25);
      ctx.quadraticCurveTo(0, 20, 8, 25);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-5, 24);
      ctx.quadraticCurveTo(0, 21, 5, 24);
      ctx.stroke();
    } else if (tool === 'hoe') {
      ctx.strokeStyle = '#8a5a3b';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.lineTo(0, 29);
      ctx.stroke();
      ctx.fillStyle = '#9aa3ad';
      rr(ctx, -4.5, 27, 9, 4, 1.5);
      ctx.fill();
      ctx.fillStyle = '#b6bec7';
      rr(ctx, -4.5, 27, 9, 1.6, 0.8);
      ctx.fill();
    } else if (tool === 'fishingRod') {
      ctx.strokeStyle = '#8a5a3b';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.quadraticCurveTo(10, 2, 18, -16);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(240, 240, 225, 0.75)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(18, -16);
      ctx.quadraticCurveTo(21, 2, 19, 22);
      ctx.stroke();
      ctx.fillStyle = '#e0567a';
      ctx.beginPath();
      ctx.arc(19, 23, 2, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }
}
