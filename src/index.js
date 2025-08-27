// State
const S = {
  canvas: {
    cats: [],
    size: [window.innerWidth*1.5, window.innerHeight*1.5],
  },
  econ: {
    balance: 1, // Current Cats
    base: 0, // Cats per click and tick
    mult: 100, // Multiplier percentage
    total: 0, // Cats accumulated over all time
  },
  meta: {
    magnitude: 0,
  },
  phys: {
    damping: 0.5,
    gravity: 3,
    noise: 0.05,
    overlap: 0.3,
  },
}

// Elements
const E = {}
const ids = ['base', 'canvas', 'counter', 'hud', 'mult', 'stats']
ids.forEach(id => E[id] = document.getElementById(id));

// Canvas
E.canvas.width = S.canvas.size[0];
E.canvas.height = S.canvas.size[1];
const ctx = E.canvas.getContext('2d');
ctx.fillStyle = 'black';

// Cat
class Cat {
  constructor(props) {
    this.id = S.econ.total;
    this.velocity = [0, 0];
    if (props?.coordinates) {
      this.coordinates = props.coordinates
    } else {
      this.spawn();
    }
    this.resize();
  }

  spawn() {
    // Spawn using radial coordinates to distribute in more of a ball
    const radius = Math.random()*(Math.max(...S.canvas.size))/2
    const angle = Math.random()*Math.PI*2
    const [x, y] = [Math.sin(angle)*radius, Math.cos(angle)*radius]
    if (this.detectCollisions([x, y]).length > 0) {
      this.spawn()
    } else {
      this.coordinates = [x, y]
    }
  }

  resize() {
    const size = 36 - Math.sqrt(S.canvas.cats.length) + S.meta.magnitude
    this.size = size > 100 ? 100 : size
  }

  detectCollisions(position) {
    return S.canvas.cats.filter(cat => {
      if (cat.id != this.id) {
        const [dx, dy] = [cat.coordinates[0] - position[0], cat.coordinates[1] - position[1]]
        if (Math.sqrt(dx**2 + dy**2) < (this.size + cat.size)*S.phys.overlap) {
          return true
        }
      }
    })
  }

  updateVelocity(velocity) {
    // Add a little bit of noise to help smooth out the ball
    this.velocity = [velocity[0] + (Math.random()-0.5)*S.phys.noise, velocity[1] + (Math.random()-0.5)*S.phys.noise]
  }

  updatePosition() {
    // Desired New Positions
    const [x1, y1] = [this.coordinates[0] + this.velocity[0], this.coordinates[1] + this.velocity[1]]

    // Collision Detection - This physics looks better than real conservation of momentum
    const collisions = this.detectCollisions([x1, y1])
    collisions.forEach(cat => {
      const [mx, my] = [S.phys.damping*(cat.velocity[0] + this.velocity[0])/2, S.phys.damping*(cat.velocity[1] + this.velocity[1])/2]
      if (y1 > 0) {
        this.updateVelocity([-mx + Math.sin(Math.atan(x1/y1))*S.phys.gravity, -my + Math.cos(Math.atan(x1/y1))*S.phys.gravity])
        cat.updateVelocity([mx - Math.sin(Math.atan(x1/y1))*S.phys.gravity, my - Math.cos(Math.atan(x1/y1))*S.phys.gravity])
      } else if (x1 != 0 && y1 != 0) {
        this.updateVelocity([-mx - Math.sin(Math.atan(x1/y1))*S.phys.gravity, -my - Math.cos(Math.atan(x1/y1))*S.phys.gravity])
        cat.updateVelocity([mx + Math.sin(Math.atan(x1/y1))*S.phys.gravity, my + Math.cos(Math.atan(x1/y1))*S.phys.gravity])
      } else {
        this.updateVelocity([-mx, -my])
        cat.updateVelocity([mx, my])
      }
    })
    if (collisions.length == 0) {
      // Unhindered Movement
      if (y1 > 0) {
        this.updateVelocity([this.velocity[0] - Math.sin(Math.atan(x1/y1))*S.phys.gravity, this.velocity[1] - Math.cos(Math.atan(x1/y1))*S.phys.gravity])
      } else if (x1 != 0 && y1 != 0) {
        this.updateVelocity([this.velocity[0] + Math.sin(Math.atan(x1/y1))*S.phys.gravity, this.velocity[1] + Math.cos(Math.atan(x1/y1))*S.phys.gravity])
      }
      this.coordinates = [x1, y1]
    }
  }

  render() {
    this.resize();
    this.updatePosition()

    // TODO make this look like a cat
    const path = new Path2D();
    path.arc((S.canvas.size[0]/2) + this.coordinates[0], (S.canvas.size[1]/2) + this.coordinates[1], this.size, 0, 2 * Math.PI);
    ctx.fill(path)
    // path.ellipse((S.canvas.size[0]/2) + this.coordinates[0], (S.canvas.size[1]/2) + this.coordinates[1], this.size/5, this.size/5, 0, 2 * Math.PI, 0)
  }
}

const updateHud = () => {
  // TODO: Prefixes and exponential notation
  E.counter.innerText = `${S.econ.balance.toFixed(0)} cat${(S.econ.balance > 1) ? 's' : ''}`;
  E.stats.innerText = `Base: ${S.econ.base + 1} | Mult: ${S.econ.mult}%`;
}

const updateBalance = (cats) => {
  // Accounting
  if (cats > 0) {
    S.econ.total += cats;
  } else {
    // Spending Cats
  }
  S.econ.balance += cats;
  updateHud();

  // Adjust Magnitude
  S.meta.magnitude = Math.floor(Math.log10(S.econ.balance));
  const unitPower = (S.meta.magnitude - 3) > 0 ? (S.meta.magnitude - 3) : 0; // 0.1%

  // Render New Cats, Remove Oldest
  const deltaCats = Math.ceil(cats/(10**unitPower))
  if (cats > 0) {
    for (let i = 0; i < deltaCats; i++) {
      if (S.canvas.cats.length < 1024) {
        S.canvas.cats.push(new Cat())
      } else {
        S.canvas.cats.shift();
        S.canvas.cats.push(new Cat());
      }
    }
  } else if (cats < 0) {
    S.canvas.cats = []
    for (let i = 0; i < Math.ceil(S.econ.balance/(10**unitPower)); i++) {
      if (S.canvas.cats.length < 1024) {
        S.canvas.cats.push(new Cat())
      } else {
        S.canvas.cats.shift();
        S.canvas.cats.push(new Cat());
      }
    }
  }
}

// Rendering
S.canvas.cats.push(new Cat({ coordinates: [0, 0] })) // The first Cat is statically centered
const updateCanvas = () => {
  ctx.clearRect(0, 0, ...S.canvas.size);
  S.canvas.cats.forEach(cat => {
    cat.render();
  })
}
setInterval(updateCanvas, 50) // 20 FPS

// Accounting
setInterval(updateBalance, 500, S.econ.base*S.econ.mult/100) // Income
const patCat = () => {
  updateBalance((1 + S.econ.base)*S.econ.mult/100)
  // Trigger Meow Sound Here
}
E.canvas.addEventListener('click', patCat)
const upgradeBase = () => {
  if (S.econ.balance > 100) {
    S.econ.base++
    updateBalance(-100)
    updateHud()
  }
}
E.base.addEventListener('click', upgradeBase)
const upgradeMult = () => {
  if (S.econ.balance > 1000) {
    S.econ.mult++
    updateBalance(-1000)
    updateHud()
  }
}
E.mult.addEventListener('click', upgradeMult)

// Hotkeys
const hotkey = (event) => {
  if (event.code === 'Space' || event.key === ' ') {
    patCat();
  } else if ((event.code === 'KeyQ' || event.key === 'q')) {
    upgradeBase();
  } else if ((event.code === 'KeyW' || event.key === 'w')) {
    upgradeMult();
  }
  // Other hotkeys go here
}
document.addEventListener('keyup', hotkey, false);

// Debug
// setInterval(patCat, 10)