/* ========= Gamestate ========= */
const S = {
  canvas: {
    cats: [],
    size: [window.innerWidth*1.5, window.innerHeight*1.5],
  },
  econ: {
    balance: 1, // Current Cats
    base: 1, // Cats per click
    interest: 0, // Growth per tick
    mult: 100, // Multiplier percentage
    total: 0, // Cats accumulated over all time
  },
  meta: {
    magnitude: 0,
  },
  phys: {
    damping: 0.3,
    gravity: 5,
    noise: 0.2,
    overlap: 0.3,
  },
  skills: {
    Q: null,
    W: null,
    E: null,
    R: null,
  }
}

/* ========= Page Setup ========= */
// Elements
const E = {}
const ids = ['canvas', 'counter', 'hud', 'stats', 'KeyQ', 'KeyW', 'KeyE', 'KeyR']
ids.forEach(id => E[id] = document.getElementById(id));

// Constants
const meow = new Audio()
const blackCat = '&#x1F408;&#x200D;&#x2B1B;' // 🐈‍⬛

// Canvas
E.canvas.width = S.canvas.size[0];
E.canvas.height = S.canvas.size[1];
const ctx = E.canvas.getContext('2d');
ctx.fillStyle = 'black';

const updateHud = () => {
  // TODO: Prefixes and exponential notation
  E.counter.innerHTML = `${S.econ.balance.toFixed(0)} cat${(S.econ.balance > 1) ? 's' : ''} ${blackCat}`;
  E.stats.innerHTML = `${S.econ.base} Base<br>${(S.econ.mult/100).toFixed(1)}x Mult<br>${(S.econ.interest)}% Interest`;
  ['Q', 'W', 'E', 'R'].forEach(key => {
    if (S.skills[key]) {
      E[`Key${key}`].innerHTML = `${S.skills[key].icon}<br>${S.skills[key].effect}<br>${S.skills[key].cost}${blackCat}`
    }
  })
}

const updateBalance = (cats) => {
  // Accounting
  if (cats > 0) {
    S.econ.total += cats;
  }
  S.econ.balance += cats;
  updateHud();

  // Adjust Magnitude
  if (Math.floor(Math.log10(S.econ.balance)) > S.meta.magnitude) {
    S.meta.magnitude = Math.floor(Math.log10(S.econ.balance))
  }
  const unitPower = (S.meta.magnitude - 3) > 0 ? (S.meta.magnitude - 3) : 0; // 0.1%

  // Render New Cats, Remove Oldest
  if (cats > 0) {
    const newCats = cats/10**unitPower
    for (let i = 0; i < newCats; i++) {
      if (S.canvas.cats.length < 1024) {
        S.canvas.cats.push(new Cat())
      } else {
        S.canvas.cats.shift();
        S.canvas.cats.push(new Cat());
      }
    }
  } else if (cats < 0) {
    const oldCats = S.canvas.cats.length - (S.econ.balance/10**unitPower > 1024 ? 1024 : S.econ.balance/10**unitPower)
    for (let i = 0; i < oldCats; i++) {
      if (S.canvas.cats.length > 1) {
        S.canvas.cats.shift();
      }
    }
    if (oldCats == 0) {
      S.canvas.cats.forEach(cat => {
        cat.updateVelocity([cat.velocity[0] + cat.size*(Math.random() - 0.5), cat.velocity[1] + cat.size*(Math.random() - 0.5)])
      })
    }
  }
}

/* ========= Physics ========= */
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
    const size = 100 - 3*Math.sqrt(S.canvas.cats.length) + S.meta.magnitude
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
    const path = new Path2D()
    path.arc((S.canvas.size[0]/2) + this.coordinates[0], (S.canvas.size[1]/2) + this.coordinates[1], this.size, 0, 2 * Math.PI);
    // path.moveTo((S.canvas.size[0]/2) + this.coordinates[0] - this.size, (S.canvas.size[1]/2) + this.coordinates[1])
    ctx.fill(path)
    // ctx.stroke(path)
  }
}

/* ========= Skills ========= */
class Skill {
  constructor(props) {
    this.cost = props.cost
    this.effect = props.effect
    this.icon = props.icon
    this.label = props.label
    this.level = 0
  }

  assign(key) {
    if (['Q', 'W', 'E', 'R'].includes(key)) {
      E[`Key${key}`].addEventListener('click', (event) => { this.use(); event.stopPropagation() })
      E[`Key${key}`].title = this.label
    }
  }

  upgrade() {
    if (S.econ.balance > this.cost) {
      this.level++
      updateBalance(-this.cost)
      return true
    }
  }
}

// #1 - Hand: +1 Base
class HandSkill extends Skill {
  constructor(props) {
    super({
      cost: 101,
      effect: '+1',
      icon: '&#x270B;',
      label: 'Hand',
    })
    this.assign(props.key)
  }

  use() {
    if (this.upgrade()) {
      this.cost = 101 + this.level
      S.econ.base++
      updateBalance(0)
    }
  }
}

// #2 - Mult: +10% Mult
class MultSkill extends Skill {
  constructor(props) {
    super({
      cost: 1000,
      effect: '+0.1x',
      icon: '&#x274E;',
      label: 'Mult',
    })
    this.assign(props.key)
  }

  use() {
    if (this.upgrade()) {
      this.cost = 1000 + 100*this.level
      S.econ.mult += 10
      updateBalance(0)
    }
  }
}

// #3 - Bank: +0.01% Interest
class BankSkill extends Skill {
  constructor(props) {
    super({
      cost: 10000,
      effect: '+0.01%',
      icon: '&#x1F3E6;',
      label: 'Bank',
    })
    this.assign(props.key)
  }

  use() {
    if (this.upgrade()) {
      this.cost = 10000*this.level
      S.econ.interest += 0.01
      updateBalance(0)
    }
  }
}


/* ========= Services ========= */
// Rendering
S.canvas.cats.push(new Cat({ coordinates: [0, 0] })) // The first Cat is statically centered
const updateCanvas = () => {
  ctx.clearRect(0, 0, ...S.canvas.size);
  S.canvas.cats.forEach(cat => {
    cat.render();
  })
}
setInterval(updateCanvas, 50) // 20 FPS

// Hotkeys
const hotkeyup = (event) => {
  if (event.code === 'Space' || event.key === ' ') {
    patCat();
  }
}
document.addEventListener('keyup', hotkeyup, false);
const hotkeydown = (event) => {
  if (['KeyQ', 'KeyW', 'KeyE', 'KeyR'].includes(event.code)) {
    document.getElementById(event.code).click()
  }
}
document.addEventListener('keydown', hotkeydown, false);

// Economy
const patCat = () => {
  updateBalance(S.econ.base*S.econ.mult/100)
  // Trigger Meow Sound Here
  meow.load()
  meow.play()
}
E.canvas.addEventListener('click', patCat)
setInterval(() => {
  if (S.econ.interest > 0) {
    updateBalance(Math.floor(S.econ.balance * S.econ.interest/100)) // Interest Ticks
  }
}, 1000)

// Skills
S.skills.Q = new HandSkill({ key: 'Q'})
S.skills.W = new MultSkill({ key: 'W'})
S.skills.E = new BankSkill({ key: 'E'})

/* ========= Debug ========= */
// setInterval(patCat, 10)