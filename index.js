// Elements
const E = {}
const ids = ['canvas', 'counter', 'hud']
ids.forEach(id => E[id] = document.getElementById(id));

// State
const S = {
  canvas: {
    size: [window.innerWidth*5, window.innerHeight*5],
    zoom: 400,
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

// Canvas
E.canvas.width = S.canvas.size[0];
E.canvas.height = S.canvas.size[1];
const ctx = E.canvas.getContext('2d');
ctx.fillStyle = 'black';

// Zoom the canvas out
const scaleCanvas = () => {
  if (S.meta.magnitude < 1) {
    S.canvas.zoom = 100/(1 + Math.log10(S.count))
    canvas.style.zoom = `${S.canvas.zoom}%`
  } else {
    canvas.style.zoom = `100%`
  }
}

// Cat
class Cat {
  constructor(props) {
    this.label = ''
    this.size = 100
    if (props?.coordinates) {
      this.coordinates = [(S.canvas.size[0] - this.size)/2 + props.coordinates[0], (S.canvas.size[1] - this.size)/2 + props.coordinates[1]]
      console.log(this.coordinates)
    } else {
      this.position()
    }

    if (props?.mega) {
      this.size = 1000;
    }
  }

  position() {
    const radius = (Math.random()-0.5) * this.size * S.canvas.zoom;
    const angle = Math.random() * 2 * Math.PI;
    this.coordinates = [(S.canvas.size[0] - this.size)/2 + Math.sin(angle)*radius, (S.canvas.size[1] - this.size)/2 + Math.cos(angle)*radius]
  }

  render() {
    // TODO make this look like a cat
    const path = new Path2D();
    path.arc(...this.coordinates, this.size, 0, 2 * Math.PI);
    ctx.fill(path);
  }
}

// Handle Canvas Click
const clickCat = () => {
  E.counter.innerText = `cats ${++S.count}`;
  if (S.count < 1000) {
    scaleCanvas();
  }
  if (S.count > 999 && Math.log10(S.count) % 3 == 0) {
    ctx.clearRect(0, 0, ...S.canvas.size);
    S.meta.magnitude = Math.log10(S.count) / 3;
    const cat = new Cat({mega: true, coordinates: [0, 0]})
    cat.render();
  } else {
    const cat = new Cat()
    cat.render();
  }
}
clickCat()

// setInterval(clickCat, 0)

// Attach Event Listener
E.canvas.addEventListener('click', clickCat)