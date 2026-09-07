export class BattlefieldCamera {
  constructor(scene) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.camera.setBounds(-400, -300, 2200, 1600);
    this.overview();
    this.keys = scene.input.keyboard.addKeys('UP,DOWN,LEFT,RIGHT');
    this.down = p => { if (p.rightButtonDown() || p.middleButtonDown()) this.drag = { x:p.x, y:p.y }; };
    this.up = () => { this.drag = null; };
    this.move = p => {
      if (!this.drag || !p.isDown) return;
      this.camera.scrollX -= (p.x-this.drag.x)/this.camera.zoom;
      this.camera.scrollY -= (p.y-this.drag.y)/this.camera.zoom;
      this.drag = { x:p.x, y:p.y };
    };
    this.wheel = (p, objects, dx, dy) => this.zoom(Math.exp(-dy*.0015),p);
    scene.input.mouse.disableContextMenu();
    this.handlers = {pointerdown:this.down,pointerup:this.up,gameout:this.up,pointermove:this.move,wheel:this.wheel};
    for (const [event,handler] of Object.entries(this.handlers)) scene.input.on(event,handler);
    this.toolbar = document.createElement('nav');
    this.toolbar.className = 'camera-controls';
    this.toolbar.setAttribute('aria-label','Battlefield camera');
    this.toolbar.innerHTML = '<button data-camera="out" title="Zoom out">-</button><button data-camera="reset">Overview</button><button data-camera="in" title="Zoom in">+</button><button data-camera="left" aria-label="Pan left">&#8592;</button><button data-camera="up" aria-label="Pan up">&#8593;</button><button data-camera="down" aria-label="Pan down">&#8595;</button><button data-camera="right" aria-label="Pan right">&#8594;</button><small>Wheel: zoom / arrows or right-drag: pan</small>';
    scene.hud.root.append(this.toolbar);
    this.toolbar.addEventListener('click', e => {
      const action = e.target.dataset.camera;
      if (action === 'reset') this.overview();
      if (action === 'in') this.zoom(1.25);
      if (action === 'out') this.zoom(.8);
      const pan = 100 / this.camera.zoom;
      if (action === 'left') this.camera.scrollX -= pan;
      if (action === 'right') this.camera.scrollX += pan;
      if (action === 'up') this.camera.scrollY -= pan;
      if (action === 'down') this.camera.scrollY += pan;
    });
  }
  overview() {
    const { map, projection } = this.scene;
    if (!projection.isometric) { this.camera.setZoom(1).centerOn(640,360); return; }
    const { grid, presentation } = map;
    const center = projection.project(grid.x+grid.columns*grid.cellSize/2,grid.y+grid.rows*grid.cellSize/2);
    const span = grid.columns+grid.rows;
    this.camera.setZoom(Math.min(1080/(span*presentation.halfWidth),550/(span*presentation.halfHeight))).centerOn(center.x,center.y + 120);
  }
  zoom(factor,pointer) {
    const x=pointer?.x ?? 640, y=pointer?.y ?? 360;
    const before=this.camera.getWorldPoint(x,y);
    this.camera.setZoom(Math.min(3.5,Math.max(.65,this.camera.zoom*factor)));
    this.camera.preRender();
    const after=this.camera.getWorldPoint(x,y);
    this.camera.scrollX+=before.x-after.x; this.camera.scrollY+=before.y-after.y;
  }
  update(delta) {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) return;
    const step=Math.min(delta,50)*.65/this.camera.zoom;
    this.camera.scrollX+=(Number(this.keys.RIGHT.isDown)-Number(this.keys.LEFT.isDown))*step;
    this.camera.scrollY+=(Number(this.keys.DOWN.isDown)-Number(this.keys.UP.isDown))*step;
  }
  destroy() {
    for (const [event,handler] of Object.entries(this.handlers)) this.scene.input.off(event,handler);
    this.toolbar.remove();
    for (const key of Object.values(this.keys)) this.scene.input.keyboard.removeKey(key);
  }
}
