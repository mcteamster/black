// State
const S = {
  canvas: {
    size: [window.innerWidth, window.innerHeight],
    gravity: 10,
    cats: [],
  },
  cats: {
    balance: 0,
    income: 0,
    total: 0,
  },
  meta: {
    magnitude: 0,
  },
  count: 0,
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
    this.size = this.mega ? 100 : 50 - Math.sqrt(S.count)/1000**S.meta.magnitude
    this.coordinates = [(Math.random()-0.5)*((S.canvas.size[0]+this.size)/2), (Math.random()-0.5)*((S.canvas.size[1]+this.size)/2)] // +X is right, +Y is down
    this.velocity = [0, 0] // Vx, Vy
  }

  position() {
    const [x1, y1] = [this.coordinates[0] + this.velocity[0], this.coordinates[1] + this.velocity[1]]
    if (y1 > 0) {
      this.velocity = [this.velocity[0] - Math.sin(Math.atan(x1/y1))*S.canvas.gravity, this.velocity[1] - Math.cos(Math.atan(x1/y1))*S.canvas.gravity]
    } else {
      this.velocity = [this.velocity[0] + Math.sin(Math.atan(x1/y1))*S.canvas.gravity, this.velocity[1] + Math.cos(Math.atan(x1/y1))*S.canvas.gravity]
    }
    this.size = this.mega ? 100 : 50 - Math.sqrt(S.count)/1000**S.meta.magnitude
    this.coordinates = [x1, y1]
  }

  render() {
    this.position()
    // TODO make this look like a cat
    const path = new Path2D();
    path.arc((S.canvas.size[0] + this.size)/2 + this.coordinates[0], (S.canvas.size[1] + this.size)/2 + + this.coordinates[1], this.size, 0, 2 * Math.PI);
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
  E.counter.innerText = `${++S.count} cats`;
  if (S.count > 999 && Math.log10(S.count) % 3 == 0) {
    S.meta.magnitude = Math.log10(S.count) / 3;
    S.canvas.cats = [new Cat({mega: true, coordinates: [0, 0]})]
  } else {
    S.canvas.cats.push(new Cat())
  }
  updateCanvas()
}

// Init
E.canvas.addEventListener('click', clickCat)
clickCat()
setInterval(updateCanvas, 50)
// setInterval(clickCat, 10)