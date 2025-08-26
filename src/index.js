// State
const S = {
  canvas: {
    cats: [],
    size: [window.innerWidth*1.5, window.innerHeight*1.5],
  },
  cats: {
    balance: 1, // Current Cats
    income: 1, // Cats per tick
    total: 0, // Cats accumulated over all time
    wage: 1.0, // Cats per click
  },
  meta: {
    magnitude: 0,
  },
  physics: {
    damping: 0.5,
    gravity: 3,
    noise: 0.05,
    overlap: 0.3,
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
        if (Math.sqrt(dx**2 + dy**2) < (this.size + cat.size)*S.physics.overlap) {
          return true
        }
      }
    })
  }

  updateVelocity(velocity) {
    // Add a little bit of noise to help smooth out the ball
    this.velocity = [velocity[0] + (Math.random()-0.5)*S.physics.noise, velocity[1] + (Math.random()-0.5)*S.physics.noise]
  }

  updatePosition() {
    // Desired New Positions
    const [x1, y1] = [this.coordinates[0] + this.velocity[0], this.coordinates[1] + this.velocity[1]]

    // Collision Detection - This physics looks better than real conservation of momentum
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
    this.resize();
    this.updatePosition()

    // TODO make this look like a cat
    const path = new Path2D();
    path.arc((S.canvas.size[0]/2) + this.coordinates[0], (S.canvas.size[1]/2) + this.coordinates[1], this.size, 0, 2 * Math.PI);
    ctx.fill(path)
    // path.ellipse((S.canvas.size[0]/2) + this.coordinates[0], (S.canvas.size[1]/2) + this.coordinates[1], this.size/5, this.size/5, 0, 2 * Math.PI, 0)
  }
}

const updateBalance = (cats) => {
  // Accounting
  if (cats > 0) {
    S.cats.total += cats;
  } else {
    // Spending Cats
  }
  S.cats.balance += cats;
  E.counter.innerText = `${S.cats.balance} cat${(S.cats.balance > 1) ? 's' : ''}`; // TODO: Prefixes and exponential notation

  // Adjust Magnitude
  S.meta.magnitude = Math.floor(Math.log10(S.cats.balance));
  const unitPower = (S.meta.magnitude - 3) > 0 ? (S.meta.magnitude - 3) : 0; // 0.1%

  // Render New Cats, Remove Oldest
  const newCats = Math.ceil(cats/(10**unitPower))
  for (let i = 0; i < newCats; i++) {
    if (S.canvas.cats.length < 1024) {
      S.canvas.cats.push(new Cat())
    } else {
      S.canvas.cats.shift();
      S.canvas.cats.push(new Cat());
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
setInterval(updateBalance, 500, S.cats.income) // Income
const patCat = () => {
  updateBalance(S.cats.wage)
  // Trigger Meow Sound Here
}
E.canvas.addEventListener('click', patCat) // Wage

// Hotkeys
const hotkey = (event) => {
  if (event.code === 'Space' || event.key === ' ') {
    patCat();
  }
  // Other hotkeys go here
}
document.addEventListener('keyup', hotkey, false);

// Debug
// setInterval(patCat, 10)