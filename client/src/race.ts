import Phaser from "phaser";
import { CARS, LAPS, TRACKS, type StateSnapshot, type Track } from "@neon/shared";

const PALETTE = [0x5cffd6, 0xff3d8a, 0xffc857, 0x9eb6ff];

export class RaceView {
  private held = new Set<string>();
  private game: Phaser.Game | null = null;
  private trackGfx: Phaser.GameObjects.Graphics | null = null;
  private dynGfx: Phaser.GameObjects.Graphics | null = null;
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private spaceWas = false;
  private drawnTrack = 0;
  private focusX = 0;
  private focusY = 0;
  private snap: StateSnapshot | null = null;
  private me = "";
  private scene: Phaser.Scene | null = null;

  constructor(private root: HTMLElement) {
    const typing = (event: KeyboardEvent) =>
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement;
    window.addEventListener("keydown", (event) => {
      if (typing(event)) return;
      this.held.add(event.code);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
    });
    window.addEventListener("keyup", (event) => {
      this.held.delete(event.code);
    });
    window.addEventListener("blur", () => this.held.clear());
  }

  ensure() {
    if (this.game) return;
    const race = this;
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: this.root,
      backgroundColor: "#07080c",
      scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
      scene: {
        create() { race.attach(this); },
        update() { race.draw(); },
      },
      banner: false,
    });
  }

  sync(snap: StateSnapshot | null, me: string) {
    this.snap = snap;
    this.me = me;
  }

  readDrive() {
    const down = (...codes: string[]) => codes.some((code) => this.held.has(code));
    const left = down("KeyA", "ArrowLeft");
    const right = down("KeyD", "ArrowRight");
    const throttle = down("KeyW", "ArrowUp");
    const brake = down("KeyS", "ArrowDown");
    return {
      steer: (right ? 1 : 0) - (left ? 1 : 0),
      throttle: throttle ? 1 : 0,
      brake: brake ? 1 : 0,
    };
  }

  consumeItem() {
    const down = this.held.has("Space");
    const edge = down && !this.spaceWas;
    this.spaceWas = down;
    return edge;
  }

  private attach(scene: Phaser.Scene) {
    this.scene = scene;
    this.trackGfx = scene.add.graphics();
    this.dynGfx = scene.add.graphics();
    scene.input.keyboard?.addCapture(["SPACE", "UP", "DOWN", "LEFT", "RIGHT", "W", "A", "S", "D"]);
  }

  private draw() {
    if (!this.dynGfx || !this.trackGfx || !this.scene || !this.snap) return;
    const track = TRACKS.find((item) => item.id === this.snap?.trackId);
    if (!track) return;
    if (this.drawnTrack !== track.id) {
      this.drawTrack(track);
      this.drawnTrack = track.id;
      this.focusX = track.bounds.cx;
      this.focusY = track.bounds.cy;
    }
    const g = this.dynGfx;
    g.clear();
    for (const oil of this.snap.oils) {
      g.fillStyle(0x24180f, 0.85);
      g.fillEllipse(oil.x, oil.y, 46, 26);
    }
    for (const item of this.snap.items) {
      const color = item.type === "boost" ? 0x5cffd6 : item.type === "shield" ? 0x8eb6ff : item.type === "emp" ? 0xd56bff : 0x6b5344;
      g.fillStyle(color, 1);
      g.fillCircle(item.x, item.y, 12);
      g.lineStyle(2, 0x07080c, 1);
      g.strokeCircle(item.x, item.y, 12);
    }
    const seen = new Set<string>();
    this.snap.players.forEach((player, index) => {
      seen.add(player.id);
      const color = PALETTE[index % PALETTE.length];
      const mine = player.id === this.me;
      const alpha = player.invisible ? (mine ? 0.45 : 0.12) : 1;
      this.drawCar(g, player.x, player.y, player.angle, player.carId, color, alpha, player.boost, player.shield, player.spinning);
      let label = this.labels.get(player.id);
      if (!label) {
        label = this.scene!.add.text(player.x, player.y, player.name, {
          fontFamily: "Trebuchet MS, sans-serif",
          fontSize: "14px",
          color: "#e7f2ea",
        }).setOrigin(0.5, 1);
        this.labels.set(player.id, label);
      }
      label.setText(player.name);
      label.setPosition(player.x, player.y - 28);
      label.setAlpha(player.invisible && !mine ? 0.15 : 1);
    });
    for (const [id, label] of this.labels) {
      if (!seen.has(id)) {
        label.destroy();
        this.labels.delete(id);
      }
    }
    const me = this.snap.players.find((player) => player.id === this.me) ?? this.snap.players[0];
    if (me) {
      this.focusX += (me.x - this.focusX) * 0.12;
      this.focusY += (me.y - this.focusY) * 0.12;
    }
    const cam = this.scene.cameras.main;
    const zoom = Phaser.Math.Clamp(cam.height / 820, 0.42, 1.15);
    cam.setZoom(zoom);
    cam.centerOn(this.focusX, this.focusY);
  }

  private drawTrack(track: Track) {
    const g = this.trackGfx;
    if (!g) return;
    g.clear();
    const pad = 700;
    g.fillStyle(0x10140e, 1);
    g.fillRect(track.bounds.minX - pad, track.bounds.minY - pad, track.bounds.maxX - track.bounds.minX + pad * 2, track.bounds.maxY - track.bounds.minY + pad * 2);
    g.lineStyle(track.width, 0x171b24, 1);
    g.beginPath();
    g.moveTo(track.points[0].x, track.points[0].y);
    for (const point of track.points.slice(1)) g.lineTo(point.x, point.y);
    g.closePath();
    g.strokePath();
    g.lineStyle(3, 0x5cffd6, 0.35);
    g.beginPath();
    g.moveTo(track.points[0].x, track.points[0].y);
    for (const point of track.points.slice(1)) g.lineTo(point.x, point.y);
    g.closePath();
    g.strokePath();
    for (const gate of track.gates) {
      g.lineStyle(gate.finish ? 6 : 3, gate.finish ? 0xff3d8a : 0xd5fff4, gate.finish ? 0.95 : 0.45);
      g.beginPath();
      g.moveTo(gate.ax, gate.ay);
      g.lineTo(gate.bx, gate.by);
      g.strokePath();
    }
  }

  private drawCar(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    angle: number,
    carId: string,
    color: number,
    alpha: number,
    boost: boolean,
    shield: boolean,
    spinning: boolean,
  ) {
    const stats = CARS[carId as keyof typeof CARS];
    const nose = stats?.id === "bulk" ? 16 : stats?.id === "ghost" ? 22 : stats?.id === "pixel" ? 14 : 20;
    const wide = stats?.id === "bulk" ? 13 : stats?.id === "pixel" ? 12 : 9;
    const local = [
      [nose, 0],
      [-14, wide],
      [-10, 0],
      [-14, -wide],
    ];
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const pt = (px: number, py: number) => ({ x: x + px * cos - py * sin, y: y + px * sin + py * cos });
    if (boost) {
      const flame = [pt(-16, 0), pt(-28, 6), pt(-28, -6)];
      g.fillStyle(0xffc857, alpha);
      g.fillTriangle(flame[0].x, flame[0].y, flame[1].x, flame[1].y, flame[2].x, flame[2].y);
    }
    const poly = local.map(([px, py]) => pt(px, py));
    g.fillStyle(color, alpha);
    g.fillTriangle(poly[0].x, poly[0].y, poly[1].x, poly[1].y, poly[3].x, poly[3].y);
    g.fillStyle(0x07080c, alpha);
    const cockpit = pt(-2, 0);
    g.fillCircle(cockpit.x, cockpit.y, spinning ? 5 : 3);
    if (shield) {
      g.lineStyle(2, 0x8eb6ff, alpha);
      g.strokeCircle(x, y, 22);
    }
  }
}

export function lapLabel(lap: number) {
  return `Lap ${Math.min(LAPS, lap + 1)}/${LAPS}`;
}
