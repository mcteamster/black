// State
const S = {
  canvas: {
    size: [window.innerWidth*1.5, window.innerHeight*1.5],
    cats: [],
  },
  cats: {
    balance: 1, // Current Cats
    income: 0, // Cats per Second
    total: 0, // Cats accumulated over all time
    wage: 1, // Cats per Pat
  },
  meta: {
    magnitude: 0,
  },
  physics: {
    damping: 0.1,
    gravity: 3,
    noise: 0.1,
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

// Physics
const calculateVelocity = (ma, va, mb, vb, cr) => { 
  return (
    (cr*(mb**2)*(vb - va) + ((ma**2)*va + (mb**2)*vb))/(ma**2 + mb**2)
  )
}

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
    let size = 40 - Math.sqrt(S.canvas.cats.length)
    if (this.mega) {
      size = 80
    }
    this.size = size > 4 ? size : 4;
  }

  promote() {
    this.mega = true;
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
    this.velocity = [velocity[0] + (Math.random()-0.5)*S.physics.noise, velocity[1] + (Math.random()-0.5)*S.physics.noise]
  }

  position() {
    // Resize
    this.resize();

    // Desired New Positions
    const [x1, y1] = [this.coordinates[0] + this.velocity[0], this.coordinates[1] + this.velocity[1]]

    // Collision Detection
    const collisions = this.detectCollisions([x1, y1])
    collisions.forEach(cat => {
      // Conservation of Momentum
      let ux = calculateVelocity(this.size, this.velocity[0], cat.size, cat.velocity[0], S.physics.damping)
      let uy = calculateVelocity(this.size, this.velocity[1], cat.size, cat.velocity[1], S.physics.damping)
      let vx = calculateVelocity(cat.size, cat.velocity[0], this.size, this.velocity[0], S.physics.damping)
      let vy = calculateVelocity(cat.size, cat.velocity[1], this.size, this.velocity[1], S.physics.damping)
      if (y1 > 0) {
        [ux, uy] = [ux - (Math.sin(Math.atan(x1/y1))*S.physics.gravity), uy - (Math.cos(Math.atan(x1/y1))*S.physics.gravity)];
        [vx, vy] = [vx - (Math.sin(Math.atan(x1/y1))*S.physics.gravity), vy - (Math.cos(Math.atan(x1/y1))*S.physics.gravity)];
      } else if (x1 != 0 && y1 != 0) {
        [ux, uy] = [ux + (Math.sin(Math.atan(x1/y1))*S.physics.gravity), uy + (Math.cos(Math.atan(x1/y1))*S.physics.gravity)];
        [vx, vy] = [uy + (Math.sin(Math.atan(x1/y1))*S.physics.gravity), vy + (Math.cos(Math.atan(x1/y1))*S.physics.gravity)];
      }
      this.updateVelocity([ux, uy])
      cat.updateVelocity([vx, vy])
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
    ctx.fill(path)
    // path.ellipse((S.canvas.size[0]/2) + this.coordinates[0], (S.canvas.size[1]/2) + this.coordinates[1], this.size/5, this.size/5, 0, 2 * Math.PI, 0)
  }
}

// Handle Cat Click
const updateCanvas = () => {
  ctx.clearRect(0, 0, ...S.canvas.size);
  S.canvas.cats.forEach(cat => {
    cat.render();
  })
}

const updateBalance = (cats) => {
  if (cats > 0) {
    S.cats.total += cats;
  }
  S.cats.balance += cats;
  E.counter.innerText = `${S.cats.balance} cats`;

  // Re-render
  if (S.canvas.cats.length < 1000) {
    S.canvas.cats.push(new Cat())
  } else {
    S.canvas.cats.unshift();
    S.canvas.cats.push(new Cat());
  }
}

const patCat = () => {
  updateBalance(S.cats.wage)

  // Trigger Sound Here
}

// Hotkeys
const hotkey = (event) => {
  if (event.code === 'Space' || event.key === ' ') {
    patCat();
  }
}
document.addEventListener('keyup', hotkey, false);

// Init
S.canvas.cats.push(new Cat({ coordinates: [0, 0] })) // The first Cat is statically centered
setInterval(updateCanvas, 50) // 20 FPS
E.canvas.addEventListener('click', patCat)

// Debug
// setInterval(patCat, 10)