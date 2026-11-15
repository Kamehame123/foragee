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
    this.x = clamp(this.x + this.vx * dt, 50, game.world.w - 50);
    this.y = clamp(this.y + this.vy * dt, 80, game.world.h - 50);

    if (this.moving) {
      this.walk += dt * (sprint ? 11 : 7.5);
      if (dx !== 0) this.facing = dx > 0 ? 1 : -1;
    } else {
      this.walk += dt * 1.6;
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
    const step = this.moving ? Math.sin(this.walk) * 3.2 : 0;

    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y));

    ctx.fillStyle = 'rgba(20, 45, 25, 0.22)';
    ellipse(ctx, 0, 0, 14, 5.4);

    ctx.scale(this.facing, 1);

    // Legs / boots
    ctx.fillStyle = '#48536d';
    rr(ctx, -7, -12 + Math.max(0, step), 6.5, 12, 3);
    ctx.fill();
    rr(ctx, 0.5, -12 + Math.max(0, -step), 6.5, 12, 3);
    ctx.fill();

    ctx.fillStyle = '#7a5236';
    rr(ctx, -8, -4 + Math.max(0, step), 8, 4.5, 2);
    ctx.fill();
    rr(ctx, -0.5, -4 + Math.max(0, -step), 8, 4.5, 2);
    ctx.fill();

    ctx.translate(0, -bob);

    // Backpack (drawn behind the body)
    ctx.fillStyle = '#9a6636';
    rr(ctx, -14, -33, 9.5, 18, 4);
    ctx.fill();
    ctx.strokeStyle = '#744a26';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#c48a52';
    rr(ctx, -12.5, -27, 6.5, 6, 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#3fa7a0';
    rr(ctx, -9.5, -34, 19, 23, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(24, 74, 70, 0.55)';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // Straps
    ctx.strokeStyle = '#2c7f7a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-3, -33);
    ctx.lineTo(-3, -13);
    ctx.stroke();

    // Scarf
    ctx.fillStyle = '#e8734a';
    rr(ctx, -8.5, -36, 17, 5, 2.5);
    ctx.fill();

    // Head
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(0, -43, 9, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 80, 55, 0.35)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // Hair peeking under the hat
    ctx.fillStyle = '#6b4a33';
    ctx.beginPath();
    ctx.arc(0, -45, 8.6, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();

    // Face
    ctx.fillStyle = '#3a2f26';
    ctx.beginPath();
    ctx.arc(2.4, -43, 1.25, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(6.2, -43, 1.25, 0, TAU);
    ctx.fill();

    ctx.fillStyle = 'rgba(232, 130, 110, 0.35)';
    ctx.beginPath();
    ctx.arc(4.6, -40, 2.6, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = 'rgba(120, 70, 50, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(4.6, -39.4, 2.1, 0.25, Math.PI - 0.6);
    ctx.stroke();

    // Straw hat
    ctx.fillStyle = '#e8c66a';
    ctx.beginPath();
    ctx.ellipse(0, -49.5, 13, 4.4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#d9b355';
    ctx.beginPath();
    ctx.ellipse(0, -51, 7.5, 6.2, 0, Math.PI, TAU);
    ctx.fill();
    ctx.strokeStyle = '#b9913f';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, -49.6, 7.6, 2.4, 0, 0, TAU);
    ctx.stroke();

    // Arm + tool
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

    ctx.strokeStyle = '#3fa7a0';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 13);
    ctx.stroke();

    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(0, 13, 3.1, 0, TAU);
    ctx.fill();

    if (this.swinging || this.toolType !== 'hand') {
      const tool = this.toolType;
      if (tool === 'axe') {
        ctx.strokeStyle = '#8a5a3b';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(0, 12);
        ctx.lineTo(0, 27);
        ctx.stroke();
        ctx.fillStyle = '#c3cbd4';
        ctx.beginPath();
        ctx.moveTo(0, 21);
        ctx.lineTo(8, 24);
        ctx.lineTo(7, 30);
        ctx.lineTo(0, 28);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#8f98a2';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (tool === 'pickaxe') {
        ctx.strokeStyle = '#8a5a3b';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(0, 12);
        ctx.lineTo(0, 27);
        ctx.stroke();
        ctx.strokeStyle = '#a8b1ba';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-7, 24);
        ctx.quadraticCurveTo(0, 20, 7, 24);
        ctx.stroke();
      } else if (tool === 'hoe') {
        ctx.strokeStyle = '#8a5a3b';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(0, 12);
        ctx.lineTo(0, 27);
        ctx.stroke();
        ctx.fillStyle = '#9aa3ad';
        rr(ctx, -4.5, 25, 9, 4, 1.5);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
