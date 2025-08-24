// State
const S = {
  canvas: {
    size: [window.innerWidth*1.5, window.innerHeight*1.5],
    cats: [],
  },
  cats: {
    balance: 1,
    income: 0,
    total: 0,
    wage: 1,
  },
  meta: {
    magnitude: 0,
  },
  physics: {
    damping: 0.5,
    gravity: 3,
    noise: 0.05,
    overlap: 0.4,
  },
}

// Elements
const E = {}
const ids = ['canvas', 'counter', 'hud']
ids.forEach(id => E[id] = document.getElementById(id));

// Canvas
E.canvas.width = S.canvas.size[0];
E.canvas.height = S.canvas.size[1];
const ctx = E.canvas.getContext('2d');
ctx.fillStyle = 'black';

// Cat
class Cat {
  constructor(props) {
    this.id = S.cats.total;
    this.mega = props?.mega || false;
    this.resize();
    this.velocity = [0, 0];
    if (props?.coordinates) {
      this.coordinates = props.coordinates
    } else {
      this.spawn();
    }
  }

  spawn() {
    // Spawn using radial coordinates to distribute in more of a ball
    const radius = Math.random()*(Math.max(...S.canvas.size))/2
    const angle = Math.random()*Math.PI*2
    const [x0, y0] = [Math.sin(angle)*radius, Math.cos(angle)*radius]
    if (this.detectCollisions([x0, y0]).length > 0) {
      this.spawn()
    } else {
      this.coordinates = [x0, y0]
    }
  }

  resize() {
    let size;
    if (this.mega) {
      size = 100
    } else {
      size = 40 - Math.sqrt(S.canvas.cats.length);
    }
    this.size = size >= 10 ? size : 10;
  }

  detectCollisions(position) {
    return S.canvas.cats.filter(cat => {
      if (cat.id != this.id) {
        const [dx, dy] = [cat.coordinates[0] - position[0], cat.coordinates[1] - position[1]]
        if (Math.sqrt(dx**2 + dy**2) < (this.size + cat.size)*S.physics.overlap) {
          return true
        }
      }
    })
  }

  updateVelocity(velocity) {
    this.velocity = [velocity[0] + Math.random()*S.physics.noise, velocity[1] + Math.random()*S.physics.noise]
  }

  position() {
    // Resize
    this.resize();

    // Desired New Position
    const [x1, y1] = [this.coordinates[0] + this.velocity[0], this.coordinates[1] + this.velocity[1]]

    // Collision Detection
    const collisions = this.detectCollisions([x1, y1])
    collisions.forEach(cat => {
      const [mx, my] = [S.physics.damping*(cat.velocity[0] + this.velocity[0])/2, S.physics.damping*(cat.velocity[1] + this.velocity[1])/2]
      if (y1 > 0) {
        this.updateVelocity([-mx + Math.sin(Math.atan(x1/y1))*S.physics.gravity, -my + Math.cos(Math.atan(x1/y1))*S.physics.gravity])
        cat.updateVelocity([mx - Math.sin(Math.atan(x1/y1))*S.physics.gravity, my - Math.cos(Math.atan(x1/y1))*S.physics.gravity])
      } else if (x1 != 0 && y1 != 0) {
        this.updateVelocity([-mx - Math.sin(Math.atan(x1/y1))*S.physics.gravity, -my - Math.cos(Math.atan(x1/y1))*S.physics.gravity])
        cat.updateVelocity([mx + Math.sin(Math.atan(x1/y1))*S.physics.gravity, my + Math.cos(Math.atan(x1/y1))*S.physics.gravity])
      } else {
        this.updateVelocity([-mx, -my])
        cat.updateVelocity([mx, my])
      }
    })
    if (collisions.length == 0) {
      // Unhindered Movement
      if (y1 > 0) {
        this.updateVelocity([this.velocity[0] - Math.sin(Math.atan(x1/y1))*S.physics.gravity, this.velocity[1] - Math.cos(Math.atan(x1/y1))*S.physics.gravity])
      } else if (x1 != 0 && y1 != 0) {
        this.updateVelocity([this.velocity[0] + Math.sin(Math.atan(x1/y1))*S.physics.gravity, this.velocity[1] + Math.cos(Math.atan(x1/y1))*S.physics.gravity])
      }
      this.coordinates = [x1, y1]
    }
  }

  render() {
    this.position()
    // TODO make this look like a cat
    const path = new Path2D();
    path.arc((S.canvas.size[0]/2) + this.coordinates[0], (S.canvas.size[1]/2) + this.coordinates[1], this.size, 0, 2 * Math.PI);
    ctx.fill(path);
    // ctx.stroke(path)
  }
}

// Handle Cat Click
const updateCanvas = () => {
  ctx.clearRect(0, 0, ...S.canvas.size);
  S.canvas.cats.forEach(cat => {
    cat.render();
  })
}

const clickCat = () => {
  S.cats.total++;
  E.counter.innerText = `${++S.cats.balance} cats`;
  if (S.canvas.cats.length == 0 || (S.canvas.cats.length > 999 && Math.log10(S.cats.balance) % 3 == 0)) {
    S.meta.magnitude = Math.log10(S.cats.balance) / 3;
    S.canvas.cats = [new Cat({ coordinates: [0, 0]})]
  } else {
    S.canvas.cats.push(new Cat())
  }
  // Trigger Sound Here
}

// Hotkeys
const hotkey = (event) => {
  if (event.code === 'Space' || event.key === ' ') {
    clickCat();
  }
}
document.addEventListener('keyup', hotkey, false);

// Init
S.canvas.cats = [new Cat({ coordinates: [0, 0]})] // The first Cat is statically centered
setInterval(updateCanvas, 50) // 20 FPS
E.canvas.addEventListener('click', clickCat)

// Debug
// setInterval(clickCat, 10)