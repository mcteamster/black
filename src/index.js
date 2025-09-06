/* ========= Gamestate ========= */
let S = {
  canvas: {
    cats: [],
    size: [window.screen.width * 1.5, window.screen.height * 1.5],
  },
  econ: {
    auto: 0, // Auto per tick
    balance: 1, // Current Cats
    base: 1, // Cats per click
    discount: 100, // Price Modifier %
    interest: 0, // Growth % per tick
    mult: 100, // Multiplier %
    total: 0, // Cats accumulated over all time
  },
  meta: {
    cutscene: false,
    magnitude: 0,
    mute: false,
    playthrough: 1,
    starttime: (new Date()).getTime(),
  },
  phys: {
    damping: 0.3,
    gravity: 5,
    noise: 0.2,
    overlap: 0.25,
  },
  skills: {
    Q: null,
    W: null,
    E: null,
    R: null,
  },
  story: {
    narrator: null,
    unlocked: ['s1', 's2', 's3'],
  },
}

const saveGame = () => {
  console.debug('Saving Game')
  const saveData = JSON.stringify(S)
  localStorage.setItem('mcteamster.black.savedata', saveData)
}

const loadGame = () => {
  const loadData = localStorage.getItem('mcteamster.black.savedata')
  if (loadData) {
    S = JSON.parse(loadData)
    S.meta.starttime = (new Date()).getTime()
  } else {
    // TODO: Skill Selection
    S.skills.Q = new HandsSkill({ key: 'Q' })
    S.skills.W = new TimesSkill({ key: 'W' })
    S.skills.E = new GrowSkill({ key: 'E' })
    S.skills.R = new AutoSkill({ key: 'R' })
  }

  // Restore Cats
  if (S.canvas.cats.length == 0) {
    S.canvas.cats.push(new Cat({ coordinates: [0, 0] })) // The first Cat is statically centered
  } else {
    S.canvas.cats = S.canvas.cats.map((cat) => new Cat(cat))
  }

  // Skills
  Object.keys(S.skills).forEach(key => {
    if (S.skills[key]?.id) {
      S.skills[key] = skillRegister[S.skills[key].id](S.skills[key])
    } else {
      S.skills[key] = null
    }
  })

  // Narrator
  if (S.story.narrator == null) {
    S.story.narrator = new Narrator({ playthrough: S.meta.playthrough })
  } else {
    S.story.narrator = new Narrator(S.story.narrator)
  }

  // UI
  loadData && updateBalance(0);
}

const resetGame = () => {
  console.debug('Resetting Game');
  localStorage.removeItem('mcteamster.black.savedata');
  location.reload() // TODO: Better way to restart?
}

/* ========= Page Setup ========= */
// Elements
const E = { body: document.body }
const ids = ['canvas', 'counter', 'dialogue', 'interest', 'mute', 'reset', 'stats', 'KeyQ', 'KeyW', 'KeyE', 'KeyR']
ids.forEach(id => E[id] = document.getElementById(id));

// Canvas
E.canvas.width = S.canvas.size[0];
E.canvas.height = S.canvas.size[1];
const ctx = E.canvas.getContext('2d');
ctx.fillStyle = 'black';

// Constants
const blackCat = '&#x1F408;&#x200D;&#x2B1B;' // 🐈‍⬛
const meows = Array.from({ length: 5 }, () => { return new Audio('./meow.mp3') })

// Helpers
const notation = (x, short) => {
  let value;
  let suffix = short ? '' : ' cats';
  if (x == 1) {
    value = 1
    suffix = short ? '' : ' cat'
  } else if (x > 1 && x < 10 ** 6) {
    value = x.toFixed(0)
  } else if (x >= 10 ** 6 && x < 10 ** 21) {
    if (x >= 10 ** 18) {
      value = (x / 10 ** 18).toFixed(2)
      suffix = short ? 'E' : ' Exacats'
    } else if (x >= 10 ** 15) {
      value = (x / 10 ** 15).toFixed(2)
      suffix = short ? 'P' : ' Petacats'
    } else if (x >= 10 ** 12) {
      value = (x / 10 ** 12).toFixed(2)
      suffix = short ? 'T' : ' Teracats'
    } else if (x >= 10 ** 9) {
      value = (x / 10 ** 9).toFixed(2)
      suffix = short ? 'G' : ' Gigacats'
    } else {
      value = (x / 10 ** 6).toFixed(2)
      suffix = short ? 'M' : ' Megacats'
    }
  } else {
    value = x.toPrecision(3)
  }
  return `${value}${suffix}`
}

const updateHud = () => {
  E.counter.innerHTML = `${blackCat} ${notation(S.econ.balance)}`;
  E.interest.innerHTML = `${S.econ.interest > 0 ? '&#x1F4C8; ' + (S.econ.interest.toFixed(2)) + '% ps' : ''}`
  E.stats.innerHTML = `${S.econ.base > 1 ? '&#x270B;' + notation(S.econ.base, true) : ''}${S.econ.mult > 100 ? ' &#x274E; ' + (S.econ.mult / 100).toFixed(1) : ''}`;
  ['Q', 'W', 'E', 'R'].forEach(key => {
    if (S.skills[key]) {
      const element = E[`Key${key}`]
      if (S.econ.balance > (S.skills[key].cost  * S.econ.discount / 100)) {
        S.skills[key].enable()
      }
      element.innerHTML = `<div>
        <div class='commandIcon'>${S.skills[key].icon}</div>
        <div class='commandEffect'>${S.skills[key].effect}</div>
        <div class='commandCost'>${S.skills[key].cost > 1 ? 
          notation((S.skills[key].cost * S.econ.discount / 100), true)+'&nbsp;'+blackCat : 
          S.skills[key].cost == 1 ? 'ON' : 'OFF'
        }</div>
      </div>`
    }
  })
  E.mute.innerHTML = S.meta.mute ? '&#x1F507;' : '&#x1F509;'
  S.story.narrator.nextLine();
}

const updateMagnitude = () => {
  // Background Colour
  const [hue, saturation, lightness] = [
    Math.min(140 + 10 * Math.log10(S.econ.balance), 240),
    Math.max(50 - Math.log10(S.econ.balance), 0),
    Math.max(50 - 3 * Math.log10(S.econ.balance), 10)
  ]
  E.body.style.background = `hsl(${hue},${saturation}%,${lightness}%)`

  if (Math.floor(Math.log10(S.econ.balance)) > S.meta.magnitude) {
    S.meta.magnitude = Math.floor(Math.log10(S.econ.balance))
  }
  return unitPower = (S.meta.magnitude - 3) > 0 ? (S.meta.magnitude - 3) : 0; // 0.1%
}

const updateBalance = (cats) => {
  if (!S.meta.cutscene) {
    // Scaling
    if (cats == Infinity) {
      return
    } else if (cats > 0) {
      S.econ.total += cats;
    }
    S.econ.balance += cats;
    const unitPower = updateMagnitude();
    updateHud();

    // Render New Cats, Remove Oldest
    if (cats > 0) {
      const newCats = cats / 10 ** unitPower
      for (let i = 0; i < newCats; i++) {
        if (S.canvas.cats.length < 1024) {
          S.canvas.cats.push(new Cat())
        } else {
          S.canvas.cats.shift();
          S.canvas.cats.push(new Cat());
        }
      }
    } else if (cats < 0) {
      const oldCats = S.canvas.cats.length - (S.econ.balance / 10 ** unitPower > 1024 ? 1024 : S.econ.balance / 10 ** unitPower)
      for (let i = 0; i < oldCats; i++) {
        if (S.canvas.cats.length > 1) {
          S.canvas.cats.shift();
        }
      }
      if (oldCats == 0) {
        S.canvas.cats.forEach(cat => {
          cat.updateVelocity([cat.velocity[0] + cat.size * (Math.random() - 0.5), cat.velocity[1] + cat.size * (Math.random() - 0.5)])
        })
      }
    }
  }
}

/* ========= Physics ========= */
class Cat {
  constructor(props) {
    this.id = props?.id || S.econ.total;
    this.orientation = props?.orientation || 0;
    this.rotation = props?.rotation || 0;
    this.velocity = props?.velocity || [0, 0];
    if (props?.coordinates) {
      this.coordinates = props.coordinates
    } else {
      this.spawn();
    }
    this.resize();
  }

  spawn() {
    // Spawn using radial coordinates to distribute in more of a ball
    const radius = Math.random() * (Math.max(...S.canvas.size)) / 2
    const angle = Math.random() * Math.PI * 2
    const [x, y] = [Math.sin(angle) * radius, Math.cos(angle) * radius]
    if (this.detectCollisions([x, y]).length > 0) {
      this.spawn()
    } else {
      this.coordinates = [x, y]
    }
  }

  resize() {
    const size = 85 - 2.5 * Math.sqrt(S.canvas.cats.length) + S.meta.magnitude
    this.size = size > 85 ? 85 : size
  }

  detectCollisions(position) {
    return S.canvas.cats.filter(cat => {
      if (cat.id != this.id) {
        const [dx, dy] = [cat.coordinates[0] - position[0], cat.coordinates[1] - position[1]]
        if (Math.sqrt(dx ** 2 + dy ** 2) < (this.size + cat.size) * S.phys.overlap) {
          return true
        }
      }
    })
  }

  updateVelocity(velocity) {
    // Add a little bit of noise to help smooth out the ball
    this.velocity = [velocity[0] + (Math.random() - 0.5) * S.phys.noise, velocity[1] + (Math.random() - 0.5) * S.phys.noise]
    this.rotation += 0.01 * (Math.random() - 0.5);
  }

  updatePosition() {
    // Angle
    this.orientation += this.rotation

    // Desired New Positions
    const [x1, y1] = [this.coordinates[0] + this.velocity[0], this.coordinates[1] + this.velocity[1]]

    // Collision Detection - This physics looks better than real conservation of momentum
    const collisions = this.detectCollisions([x1, y1])
    collisions.forEach(cat => {
      const [mx, my] = [S.phys.damping * (cat.velocity[0] + this.velocity[0]) / 2, S.phys.damping * (cat.velocity[1] + this.velocity[1]) / 2]
      if (y1 > 0) {
        this.updateVelocity([-mx + Math.sin(Math.atan(x1 / y1)) * S.phys.gravity, -my + Math.cos(Math.atan(x1 / y1)) * S.phys.gravity])
        cat.updateVelocity([mx - Math.sin(Math.atan(x1 / y1)) * S.phys.gravity, my - Math.cos(Math.atan(x1 / y1)) * S.phys.gravity])
      } else if (x1 != 0 && y1 != 0) {
        this.updateVelocity([-mx - Math.sin(Math.atan(x1 / y1)) * S.phys.gravity, -my - Math.cos(Math.atan(x1 / y1)) * S.phys.gravity])
        cat.updateVelocity([mx + Math.sin(Math.atan(x1 / y1)) * S.phys.gravity, my + Math.cos(Math.atan(x1 / y1)) * S.phys.gravity])
      } else {
        this.updateVelocity([-mx, -my])
        cat.updateVelocity([mx, my])
      }
    })
    if (collisions.length == 0) {
      // Unhindered Movement
      if (y1 > 0) {
        this.updateVelocity([this.velocity[0] - Math.sin(Math.atan(x1 / y1)) * S.phys.gravity, this.velocity[1] - Math.cos(Math.atan(x1 / y1)) * S.phys.gravity])
      } else if (x1 != 0 && y1 != 0) {
        this.updateVelocity([this.velocity[0] + Math.sin(Math.atan(x1 / y1)) * S.phys.gravity, this.velocity[1] + Math.cos(Math.atan(x1 / y1)) * S.phys.gravity])
      }
      this.coordinates = [x1, y1]
    }
  }

  render() {
    this.resize();
    this.updatePosition()
    const offsetX = (S.canvas.size[0] / 2) + this.coordinates[0]
    const offsetY = (S.canvas.size[1] / 2) + this.coordinates[1]
    const detail = 1.5 - 0.001 * S.canvas.cats.length
    const path = new Path2D()
    path.arc(offsetX, offsetY, this.size, 0, 2 * Math.PI); // Head
    if (detail > 1) {
      path.moveTo(offsetX - this.size * Math.sin(this.orientation + Math.PI * (90 / 180)), offsetY - this.size * Math.cos(this.orientation + Math.PI * (90 / 180))) // Left Ear
      path.lineTo(offsetX - detail * this.size * Math.sin(this.orientation + Math.PI * (30 / 180)), offsetY - detail * this.size * Math.cos(this.orientation + Math.PI * (30 / 180)))
      path.lineTo(offsetX - this.size * Math.sin(this.orientation + Math.PI * (10 / 180)), offsetY - this.size * Math.cos(this.orientation + Math.PI * (10 / 180)))
      path.moveTo(offsetX - this.size * Math.sin(this.orientation - Math.PI * (10 / 180)), offsetY - this.size * Math.cos(this.orientation - Math.PI * (10 / 180))) // Right Ear
      path.lineTo(offsetX - detail * this.size * Math.sin(this.orientation - Math.PI * (30 / 180)), offsetY - detail * this.size * Math.cos(this.orientation - Math.PI * (30 / 180)))
      path.lineTo(offsetX - this.size * Math.sin(this.orientation - Math.PI * (90 / 180)), offsetY - this.size * Math.cos(this.orientation - Math.PI * (90 / 180)))
    }
    ctx.fill(path)
  }
}

/* ========= Skills ========= */
class Skill {
  constructor(props) {
    this.cost = props.cost
    this.effect = props.effect
    this.icon = props.icon
    this.id = props.id
    this.key = props.key
    this.label = props.label
    this.level = props?.level || 0
    this.assign()
    this.enabled = props?.enabled || false
    if (this.enabled) {
      this.enable()
    }
  }

  assign() {
    if (['Q', 'W', 'E', 'R'].includes(this.key)) {
      E[`Key${this.key}`].addEventListener('click', (event) => { this.use(); event.stopPropagation() })
      E[`Key${this.key}`].title = `(${this.key}) ${this.label}`
    }
  }

  buy() {
    if (this.enabled && S.econ.balance > (this.cost * S.econ.discount / 100 )) {
      this.level++
      updateBalance(-(this.cost * S.econ.discount / 100))
      return true
    }
  }

  enable() {
    if (E[`Key${this.key}`].classList.contains('hidden')) {
      E[`Key${this.key}`].classList.remove('hidden');
    }
    this.enabled = true;
  }
}

// #1 - Hands: +1 Base
class HandsSkill extends Skill {
  constructor(props) {
    super({
      id: 's1',
      cost: 110,
      effect: '+1',
      icon: '&#x270B;',
      label: 'Hands: Increase the base number of cats per click.',
      ...props,
    })
  }

  use() {
    if (this.buy()) {
      this.cost = 110 + 10 * this.level // Linear
      S.econ.base++
      updateBalance(0)
    }
  }
}

// #2 - Times: +10% Mult
class TimesSkill extends Skill {
  constructor(props) {
    super({
      id: 's2',
      cost: 1000,
      effect: '+0.1x',
      icon: '&#x274E;',
      label: 'Times: Increase the multiplier for cats per click.',
      ...props,
    })
  }

  use() {
    if (this.buy()) {
      this.cost = 1000 + 10 * ((this.level) ** 2) // Parabolic
      S.econ.mult += 10
      updateBalance(0)
    }
  }
}

// #3 - Grow: +0.01% Interest
class GrowSkill extends Skill {
  constructor(props) {
    super({
      id: 's3',
      cost: 10000,
      effect: '+0.01%',
      icon: '&#x1F4C8;',
      label: 'Grow: Increase the interest rate of the current cat balance',
      ...props,
    })
  }

  use() {
    if (this.buy()) {
      this.cost = 10 ** (4 + this.level / 10) // Exponential
      S.econ.interest += 0.01
      updateBalance(0)
    }
  }
}

// #13 - Auto: Clicks per second
class AutoSkill extends Skill {
  constructor(props) {
    super({
      id: 's13',
      cost: 0,
      effect: `Auto`,
      icon: '&#x2699;&#xFE0F;',
      label: 'Auto: Toggle automatic clicks per second - equal to the number of unlocked skills.',
      ...props,
    })
  }

  use() {
    if (this.cost == 1) {
      this.cost = 0
      S.econ.auto = 0
    } else {
      this.cost = 1
      S.econ.auto = S.story.unlocked.length
    }
    updateBalance(0)
  }
}

const skillRegister = {
  's1': (props) => { return new HandsSkill(props) },
  's2': (props) => { return new TimesSkill(props) },
  's3': (props) => { return new GrowSkill(props) },
  // 's4': (props) => { return new AutoSkill(props) },
  // 's5': (props) => { return new HandsSkill(props) },
  // 's6': (props) => { return new HandsSkill(props) },
  // 's7': (props) => { return new HandsSkill(props) },
  // 's8': (props) => { return new HandsSkill(props) },
  // 's9': (props) => { return new HandsSkill(props) },
  // 's10': (props) => { return new HandsSkill(props) },
  // 's11': (props) => { return new HandsSkill(props) },
  // 's12': (props) => { return new HandsSkill(props) },
  's13': (props) => { return new AutoSkill(props) },
}

/* ========= Dialogue ========= */
class Narrator {
  constructor(props) {
    this.currentLine = props?.currentLine || '';
    this.playthrough = props.playthrough;
    this.dialogLines = props?.dialogLines;
    this.skillLines = props?.skillLines;
    if (!this.dialogLines && !this.skillLines) {
      this.loadLines(this.playthrough);
    }
  }

  loadLines(playthrough) {
    const dialogLines = [
      { predicate: 0, line: 'please DO NOT the cat' },
      { predicate: 13, line: 'AHHH! What are you doing?' },
      { predicate: 25, line: "HEY!" },
      { predicate: 40, line: "Quit it!" },
      { predicate: 55, line: "PLEASE?" },
      { predicate: 70, line: "Okay." },
      { predicate: 85, line: "You're really doing this" },
      { predicate: 120, line: "Look..." },
      { predicate: 200, line: "I can't say I didn't warn you" },
      { predicate: 400, line: "But if you're going to commit..." },
      { predicate: 600, line: "You should do it properly." },
      { predicate: 800, line: "The better you treat them, the better they'll treat you" },
      { predicate: 1100, line: "Give and you shall receive" },
      { predicate: 1500, line: "It's just the way the universe works" },
      { predicate: 2000, line: "Or at least that's what I was told..." },
      { predicate: 4000, line: "We sure have a lot of cats now. Have you ever wondered where they come from?" },
      { predicate: 7000, line: "When a mommy and daddy cat love each other very much..." },
      { predicate: 11000, line: "But really. Is this bottomless ball of cats not a mystery to you?" },
      { predicate: 20000, line: "The truth is..." },
      { predicate: 40000, line: "...something along the lines of..." },
      { predicate: 70000, line: "<i>*pages flicking*</i>" },
      { predicate: 100000, line: "...I don't know either." },
      { predicate: 200000, line: "..." },
      { predicate: 400000, line: "Hey. Don't judge me. It's my first day!" },
      { predicate: 700000, line: "What's the worst that could possibly happen?" },
      { predicate: 10 ** 6, line: "WHAT. IS. THAT. IT'S A MEGACAT", include: () => { return (playthrough == 1) }, },
      { predicate: Infinity, line: "Ironically, your curiosity got us killed by cats." },
    ]

    const skillLines = [
      {
        predicate: () => { return (S.skills.Q?.level == 0 && S.econ.balance > S.skills.Q?.cost) },
        line: `I'll find someone to take them off your HANDS`,
        include: () => { return (S.skills.Q?.id == 's1') },
      },
      {
        predicate: () => { return (S.skills.Q?.level == 1 && S.econ.balance < (S.skills.Q?.cost)) },
        line: `OH NO. THIS IS WORSE!`,
        include: () => { return (S.skills.Q?.id == 's1') },
      },
      {
        predicate: () => { return (S.skills.W?.level == 0 && S.econ.balance > S.skills.W?.cost) },
        line: `They'll go out and tell others about the good TIMES`,
        include: () => { return (S.skills.W?.id == 's2') },
      },
      {
        predicate: () => { return (S.skills.E?.level == 0 && S.econ.balance > S.skills.E?.cost) },
        line: `They want to have kittens! Maybe we should give them space to GROW?`,
        include: () => { return (S.skills.E?.id == 's3') },
      },
    ]

    this.dialogLines = dialogLines.filter(line => {
      if (!line.include || line.include()) {
        return true
      }
    })

    this.skillLines = skillLines.filter(line => {
      if (!line.include || line.include()) {
        return true
      }
    })
  }

  nextLine() {
    const skillLines = this.skillLines.filter((line) => {
      if (typeof line.predicate == 'number' && S.econ.balance > line.predicate) {
        return true
      } else if (typeof line.predicate == 'function' && line.predicate()) {
        return true
      }
    })
    if (skillLines.length > 0) {
      if (this.currentLine != skillLines[skillLines.length - 1].line) {
        this.currentLine = skillLines[skillLines.length - 1].line
      }
    } else {
      const dialogLines = this.dialogLines.filter((line) => {
        if (typeof line.predicate == 'number' && S.econ.balance >= line.predicate) {
          return true
        } else if (typeof line.predicate == 'function' && line.predicate()) {
          return true
        }
      })
      if (dialogLines.length > 0) {
        if (this.currentLine != dialogLines[0].line) {
          this.currentLine = dialogLines[0].line
          this.dialogLines = this.dialogLines.filter((line) => {
            return (line.line != this.currentLine)
          })
        }
      }
    }
    this.sayLine(this.currentLine)
  }

  sayLine(line) {
    E.dialogue.innerHTML = line
  }
}

/* ========= Story Events ========= */
const storyAutocat = () => {
  console.info("You did not the cat.")
  S.meta.cutscene = true;
  S.canvas.cats = [];
  S.story.narrator.sayLine('You did not the cat')
  setTimeout(() => {
    if (!S.story.unlocked.includes('s13')) {
      S.story.narrator.sayLine('Thank you!')
      S.story.unlocked.push('s13'); // Unlock the Autocat
      setTimeout(() => {
        endPlaythrough();
      }, 3000)
    }
  }, 3000)
}

const storyMegacat = () => {
  // TODO: Megacat Story
}

const endPlaythrough = () => {
  S.canvas.cats = []
  S.econ = {
    auto: 0, // Auto per tick
    balance: 1, // Current Cats
    base: 1, // Cats per click
    discount: 100, // Price Modifier %
    interest: 0, // Growth % per tick
    mult: 100, // Multiplier %
    total: 0, // Cats accumulated over all time
  }
  S.meta.cutscene = false
  S.meta.playthrough += 1
  saveGame()
  loadGame()
}

/* ========= Services ========= */
// Rendering
const renderFrame = () => {
  ctx.clearRect(0, 0, ...S.canvas.size);
  S.canvas.cats.forEach(cat => {
    cat.render();
  })
}
setInterval(renderFrame, 50) // 20 FPS

// Economy
const patCat = () => {
  updateBalance(S.econ.base * S.econ.mult / 100)
  // Trigger Meow Sound Here
  if (!S.meta.mute) {
    meows[Math.floor(meows.length * Math.random())].play()
  }
}
E.canvas.addEventListener('click', patCat)

// Ticks
const tickInterval = setInterval(() => {
  const elapsedTime = (new Date().getTime() - S.meta.starttime);

  // Save
  if ((elapsedTime % 30000) < 1000) {
    saveGame()
  } 

  // Econ
  if (S.econ.interest > 0) {
    updateBalance(Math.floor(S.econ.balance * S.econ.interest / 100))
  }

  if (S.econ.auto > 0) {
    for (let i = 0; i < S.econ.auto; i++) {
      setTimeout(() => {
        patCat()
      }, 50*i)
    }
  }

  // Story Events
  if (!S.story.unlocked.includes('s4')) {
    if (S.econ.balance > 10**6) {
      storyMegacat()
    }
  }
  if (!S.story.unlocked.includes('s13')) {
    if (S.econ.balance == 1 && elapsedTime > 10000) {
      storyAutocat()
    }
  }
}, 1000)

/* ========= Buttons ========= */
// Menu Buttons
E.reset.addEventListener('click', (event) => {
  if (confirm("Clear Saved Data?") == true) {
    resetGame();
  }
})
E.mute.addEventListener('click', (event) => { 
  console.log('Toggling Mute'); 
  S.meta.mute = !S.meta.mute; 
  updateHud();
  event.stopPropagation()
})

// Hotkeys
const hotkeydown = (event) => {
  if (['KeyQ', 'KeyW', 'KeyE', 'KeyR'].includes(event.code)) {
    document.getElementById(event.code).click()
  } else if (event.code === 'Space' || event.key === ' ') {
    patCat();
  }
}
document.addEventListener('keydown', hotkeydown, false);

/* ========= Init ========= */
loadGame()

/* ========= Debug ========= */
// S.econ.balance = 10000
// S.econ.discount = 50