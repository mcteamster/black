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
    drain: 0, // Loss per tick
    interest: 0, // Growth % per tick
    mult: 100, // Multiplier %
    total: 0, // Cats accumulated over all time
  },
  meta: {
    active: true, // In Game
    freeze: false, // Disable Interactivity
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
    bindings: {
      Q: null,
      W: null,
      E: null,
      R: null,
    },
    selected: [],
  },
  story: {
    narrator: null,
    milestone: 0,
    unlocked: [],
  },
};

const startGame = () => {
  E.launch.classList.add('hidden')
  S.meta.active = true
  S.meta.starttime = (new Date()).getTime()

  // First Cat
  S.canvas.cats.push(new Cat({ coordinates: [0, 0] }))

  // Apply Skill Selection
  registerKeys()
  S.skills.selected = S.skills.selected.sort((a, b) => { return (a.substring(1) - b.substring(1)) }) // sort in alphnumeric order
  if (S.skills.selected.length == 1 && S.skills.selected[0] == 's13') {
    // Edge case for Auto only
    S.skills.bindings = {
      Q: null,
      W: null,
      E: null,
      R: skillRegister.s13.generator({ key: 'R' })
    }
  } else {
    Object.keys(S.skills.bindings).forEach((key, index) => { S.skills.bindings[key] = S.skills.selected[index] ? skillRegister[S.skills.selected[index]].generator({ key: key }) : null })
  }

  // Narrator
  S.story.narrator = new Narrator()

  // UI
  updateBalance(0)
};

const saveGame = () => {
  const saveData = JSON.stringify(S)
  localStorage.setItem('mcteamster.black.savedata', saveData)
};
onbeforeunload = saveGame;

const loadGame = () => {
  const loadData = localStorage.getItem('mcteamster.black.savedata')
  if (loadData) {
    S = JSON.parse(loadData);

    // Restore Cats
    S.canvas.size = [window.screen.width * 1.5, window.screen.height * 1.5];
    S.canvas.cats = S.canvas.cats.map((cat) => new Cat(cat));

    // Skills
    registerKeys();
    Object.keys(S.skills.bindings).forEach(key => {
      if (S.skills.bindings[key]?.id) {
        S.skills.bindings[key] = skillRegister[S.skills.bindings[key].id].generator(S.skills.bindings[key]);
      } else {
        S.skills.bindings[key] = null;
      }
    });

    // Narrator
    S.story.narrator = new Narrator(S.story.narrator);

    // UI
    updateBalance(0);
    if (!S.meta.active) {
      updateLauncher();
    }
    return true
  } else {
    return false
  }
};

const resetGame = () => {
  localStorage.removeItem('mcteamster.black.savedata');
  onbeforeunload = undefined;
  location.reload();
};

/* ========= Page Setup ========= */
// Elements
const E = { body: document.body };
const ids = [
  'canvas', 'counter', 'dialogue', 'interest', 'stats',
  'pause', 'mute', 'menu', 'restart', 'clear',
  'launch', 'instructions', 'picker', 'start', 'playthrough',
];
ids.forEach(id => E[id] = document.getElementById(id));
const registerKeys = () => {
  let keyHTML = '';
  ['Q', 'W', 'E', 'R'].forEach((key) => {
    keyHTML += `
      <div id="Key${key}" class="command centered column">
        <div id="Key${key}Icon" class='commandIcon'>${key}</div>
        <div id="Key${key}Effect" class='commandEffect'></div>
        <div id="Key${key}Price" class='commandPrice'></div>
      </div>
    `
  });
  document.getElementById('commands').innerHTML = keyHTML;
  const keys = ['KeyQ', 'KeyW', 'KeyE', 'KeyR'];
  keys.forEach(id => E[id] = document.getElementById(id));
};
registerKeys();

// Canvas
E.canvas.width = S.canvas.size[0];
E.canvas.height = S.canvas.size[1];
const ctx = E.canvas.getContext('2d');
ctx.fillStyle = 'black';

// Constants
const blackCat = '&#x1F408;&#x200D;&#x2B1B;'; // 🐈‍⬛
const meows = Array.from({ length: 5 }, () => { return new Audio('./meow.mp3') });

// Helpers
const notation = (x, short) => {
  let value;
  let suffix = short ? '' : ' cats';
  if (x == 1) {
    value = 1;
    suffix = short ? '' : ' cat';
  } else if (x > 1 && x < 10 ** 6) {
    value = x.toFixed(0);
  } else if (x >= 10 ** 6 && x < 10 ** 21) {
    if (x >= 10 ** 18) {
      value = (x / 10 ** 18).toFixed(2);
      suffix = short ? 'E' : ' Exacats';
    } else if (x >= 10 ** 15) {
      value = (x / 10 ** 15).toFixed(2);
      suffix = short ? 'P' : ' Petacats';
    } else if (x >= 10 ** 12) {
      value = (x / 10 ** 12).toFixed(2);
      suffix = short ? 'T' : ' Teracats';
    } else if (x >= 10 ** 9) {
      value = (x / 10 ** 9).toFixed(2);
      suffix = short ? 'G' : ' Gigacats';
    } else {
      value = (x / 10 ** 6).toFixed(2);
      suffix = short ? 'M' : ' Megacats';
    }
  } else {
    value = x.toPrecision(3);
  }
  return `${value}${suffix}`
};

const updateHud = () => {
  E.counter.innerHTML = ((S.meta.playthrough == 1 && S.econ.balance == 1) || S.econ.balance <= 0 || S.econ.balance > 10 ** 100) ? '' : `${blackCat} ${notation(S.econ.balance)}`;
  E.interest.innerHTML = `
    ${S.econ.interest > 0 ? '&#x1F4C8; ' + (S.econ.interest.toFixed(2)) + '% ps' : ''}
    ${S.econ.drain > 0 ? '&nbsp;&#x1F4C9 -' + (notation(S.econ.drain, true)) + ' ps' : ''}
  `;
  S.econ.drain > 0 ? E.dialogue.style.background = "rgba(255, 0, 0, 0.75)" : E.dialogue.style.background = "rgba(0, 0, 0, 0.75)";
  E.stats.innerHTML = `
    ${S.econ.base > 1 ? '&#x270B; ' + notation(S.econ.base, true) : ''}&nbsp;
    ${S.econ.mult > 100 ? ' &#x274E; ' + (S.econ.mult > 10 ** 5 ? notation(S.econ.mult / 100, true) : (S.econ.mult / 100).toFixed(1)) : ''}
  `;
  ['Q', 'W', 'E', 'R'].forEach(key => {
    if (S.skills.bindings[key]) {
      if (S.econ.balance > (S.skills.bindings[key].cost * S.econ.discount / 100)) {
        S.skills.bindings[key].enable();
      }
      let price = '';
      if (S.skills.bindings[key].cooldown > 0) {
        price = (((S.skills.bindings[key].timestamp + (S.skills.bindings[key].cooldown * S.econ.discount / 100)) - (new Date()).getTime()) / 1000).toFixed(0);
        if (price <= 0) {
          price = 'Ready';
        } else {
          price += 's';
        }
      } else if (S.skills.bindings[key].cost > 1) {
        price = notation((S.skills.bindings[key].cost * S.econ.discount / 100), true) + '&nbsp;' + blackCat;
      } else if (S.skills.bindings[key].cost == 0) {
        price = 'Off';
      }
      document.getElementById(`Key${key}Icon`).innerHTML = `${S.skills.bindings[key].icon}`
      document.getElementById(`Key${key}Effect`).innerHTML = `${(typeof S.skills.bindings[key].effect == 'function') ? S.skills.bindings[key].effect() : S.skills.bindings[key].effect}`
      document.getElementById(`Key${key}Price`).innerHTML = `${price}`
    } else {
      E[`Key${key}`].classList.add('hidden');
    }
  })
  E.mute.innerHTML = S.meta.mute ? '&#x1F507;' : '&#x1F509;';
};

const updateLauncher = () => {
  E.launch.classList.remove('hidden');
  E.body.style.background = 'hsl(140, 50%, 25%)'
  E.instructions.innerHTML = `
    <div>${S.skills.selected.length > 0 ? skillRegister[S.skills.selected[S.skills.selected.length - 1]].label : 'Select up to 4 Skills'}</div>
  `;
  let pickerContent = "";
  Object.keys(skillRegister).forEach((skill) => {
    if (S.story.unlocked.includes(skill)) {
      pickerContent += `<div id="${skill}" 
        class="command centered column ${S.skills.selected.includes(skill) && 'selected'}" 
        title="${skillRegister[skill].label}"
        onClick="
          if (S.skills.selected.includes(this.id)) {
            S.skills.selected = S.skills.selected.filter((skill) => skill != this.id)
          } else {
            S.skills.selected.push(this.id);
            if (S.skills.selected.length > 4) {
              S.skills.selected = S.skills.selected.slice(-4);
            }
          }
          updateLauncher();
        ">
        <div class="commandIcon">${skillRegister[skill].icon}</div>
        <div>${skillRegister[skill].name}</div>
      </div>`;
    } else {
      pickerContent += `<div id="${skill}" class="command centered column" title="Play to Unlock">
        <div class="commandIcon">?</div>
      </div>`;
    }
  })
  E.picker.innerHTML = pickerContent;
  E.start.addEventListener('click', startGame);
  E.playthrough.innerHTML = `<div>Game #${S.meta.playthrough}</div>`
};

const updateMagnitude = () => {
  // Background Colour
  const [hue, saturation, lightness] = [
    Math.min(140 + 10 * Math.log10(S.econ.balance), 240),
    Math.max(50 - Math.log10(S.econ.balance), 0),
    Math.max(50 - 3 * Math.log10(S.econ.balance), 10)
  ];
  E.body.style.background = `hsl(${hue},${saturation}%,${lightness}%)`;

  if (Math.floor(Math.log10(S.econ.balance)) > S.meta.magnitude) {
    S.meta.magnitude = Math.floor(Math.log10(S.econ.balance));
  }
  return unitPower = (S.meta.magnitude - 3) > 0 ? (S.meta.magnitude - 3) : 0; // 0.1%
};

const updateBalance = (cats) => {
  if (S.meta.active) {
    // Scaling
    if (cats > 0) {
      S.econ.total += cats;
    }
    S.econ.balance += cats;
    const unitPower = updateMagnitude();

    if (!S.meta.freeze && S.econ.balance <= 0) {
      S.meta.freeze = true;
      S.canvas.cats = [];
      S.story.narrator.addLines([
        { duration: 4000, line: "Oh no, we lost all the cats...", },
        { duration: 4000, line: "Man, my boss is gonna be so mad", callback: endPlaythrough },
        { line: '<i>Fin.</i>' },
      ]);
    } else if (cats > 0) {
      // Render New Cats, Remove Oldest
      const newCats = cats / 10 ** unitPower;
      for (let i = 0; i < newCats; i++) {
        if (S.canvas.cats.length < 1024) {
          S.canvas.cats.push(new Cat());
        } else {
          S.canvas.cats.shift();
          S.canvas.cats.push(new Cat());
        }
      }
    } else if (cats < 0) {
      const oldCats = S.canvas.cats.length - (S.econ.balance / 10 ** unitPower > 1024 ? 1024 : S.econ.balance / 10 ** unitPower);
      for (let i = 0; i < oldCats; i++) {
        if (S.canvas.cats.length > 1) {
          S.canvas.cats.shift();
        }
      }
      if (oldCats == 0) {
        S.canvas.cats.forEach(cat => {
          cat.updateVelocity([cat.velocity[0] + cat.size * (Math.random() - 0.5), cat.velocity[1] + cat.size * (Math.random() - 0.5)]);
        })
      }
    }

    updateHud();
  }
};

/* ========= Physics ========= */
class Cat {
  constructor(props) {
    this.id = props?.id || S.econ.total;
    this.orientation = props?.orientation || 0;
    this.rotation = props?.rotation || 0;
    this.velocity = props?.velocity || [0, 0];
    if (props?.coordinates) {
      this.coordinates = props.coordinates;
    } else {
      this.spawn();
    }
    this.resize();
  }

  spawn() {
    // Spawn using radial coordinates to distribute in more of a ball
    const radius = Math.random() * (Math.max(...S.canvas.size)) / 2;
    const angle = Math.random() * Math.PI * 2;
    const [x, y] = [Math.sin(angle) * radius, Math.cos(angle) * radius];
    if (this.detectCollisions([x, y]).length > 0) {
      this.spawn();
    } else {
      this.coordinates = [x, y];
    }
  }

  resize() {
    const size = 85 - 2.5 * Math.sqrt(S.canvas.cats.length) + S.meta.magnitude;
    this.size = size > 85 ? 85 : size;
  }

  detectCollisions(position) {
    return S.canvas.cats.filter(cat => {
      if (cat.id != this.id) {
        const [dx, dy] = [cat.coordinates[0] - position[0], cat.coordinates[1] - position[1]];
        if (Math.sqrt(dx ** 2 + dy ** 2) < (this.size + cat.size) * S.phys.overlap) {
          return true
        }
      }
    })
  }

  updateVelocity(velocity) {
    // Add a little bit of noise to help smooth out the ball
    this.velocity = [velocity[0] + (Math.random() - 0.5) * S.phys.noise, velocity[1] + (Math.random() - 0.5) * S.phys.noise];
    this.rotation += 0.01 * (Math.random() - 0.5);
  }

  updatePosition() {
    // Angle
    this.orientation += this.rotation;

    // Desired New Positions
    const [x1, y1] = [this.coordinates[0] + this.velocity[0], this.coordinates[1] + this.velocity[1]];

    // Collision Detection - This physics looks better than real conservation of momentum
    const collisions = this.detectCollisions([x1, y1]);
    collisions.forEach(cat => {
      const [mx, my] = [S.phys.damping * (cat.velocity[0] + this.velocity[0]) / 2, S.phys.damping * (cat.velocity[1] + this.velocity[1]) / 2];
      if (y1 > 0) {
        this.updateVelocity([-mx + Math.sin(Math.atan(x1 / y1)) * S.phys.gravity, -my + Math.cos(Math.atan(x1 / y1)) * S.phys.gravity]);
        cat.updateVelocity([mx - Math.sin(Math.atan(x1 / y1)) * S.phys.gravity, my - Math.cos(Math.atan(x1 / y1)) * S.phys.gravity]);
      } else if (x1 != 0 && y1 != 0) {
        this.updateVelocity([-mx - Math.sin(Math.atan(x1 / y1)) * S.phys.gravity, -my - Math.cos(Math.atan(x1 / y1)) * S.phys.gravity]);
        cat.updateVelocity([mx + Math.sin(Math.atan(x1 / y1)) * S.phys.gravity, my + Math.cos(Math.atan(x1 / y1)) * S.phys.gravity]);
      } else {
        this.updateVelocity([-mx, -my]);
        cat.updateVelocity([mx, my]);
      }
    })
    if (collisions.length == 0) {
      // Unhindered Movement
      if (y1 > 0) {
        this.updateVelocity([this.velocity[0] - Math.sin(Math.atan(x1 / y1)) * S.phys.gravity, this.velocity[1] - Math.cos(Math.atan(x1 / y1)) * S.phys.gravity]);
      } else if (x1 != 0 && y1 != 0) {
        this.updateVelocity([this.velocity[0] + Math.sin(Math.atan(x1 / y1)) * S.phys.gravity, this.velocity[1] + Math.cos(Math.atan(x1 / y1)) * S.phys.gravity]);
      }
      this.coordinates = [x1, y1];
    }
  }

  render() {
    this.resize();
    this.updatePosition();
    const offsetX = (S.canvas.size[0] / 2) + this.coordinates[0];
    const offsetY = (S.canvas.size[1] / 2) + this.coordinates[1];
    const detail = 1.5 - 0.001 * S.canvas.cats.length;
    const path = new Path2D();
    path.arc(offsetX, offsetY, this.size, 0, 2 * Math.PI); // Head
    if (detail > 1) {
      path.moveTo(offsetX - this.size * Math.sin(this.orientation + Math.PI * (90 / 180)), offsetY - this.size * Math.cos(this.orientation + Math.PI * (90 / 180))); // Left Ear
      path.lineTo(offsetX - detail * this.size * Math.sin(this.orientation + Math.PI * (30 / 180)), offsetY - detail * this.size * Math.cos(this.orientation + Math.PI * (30 / 180)));
      path.lineTo(offsetX - this.size * Math.sin(this.orientation + Math.PI * (10 / 180)), offsetY - this.size * Math.cos(this.orientation + Math.PI * (10 / 180)));
      path.moveTo(offsetX - this.size * Math.sin(this.orientation - Math.PI * (10 / 180)), offsetY - this.size * Math.cos(this.orientation - Math.PI * (10 / 180))); // Right Ear
      path.lineTo(offsetX - detail * this.size * Math.sin(this.orientation - Math.PI * (30 / 180)), offsetY - detail * this.size * Math.cos(this.orientation - Math.PI * (30 / 180)));
      path.lineTo(offsetX - this.size * Math.sin(this.orientation - Math.PI * (90 / 180)), offsetY - this.size * Math.cos(this.orientation - Math.PI * (90 / 180)));
    }
    ctx.fill(path);
  }
}

/* ========= Skills ========= */
class Skill {
  constructor(props) {
    this.id = props.id
    this.effect = skillRegister[this.id].effect
    this.icon = skillRegister[this.id].icon
    this.label = skillRegister[this.id].label
    this.cost = props.cost
    this.cooldown = props?.cooldown || 0
    this.timestamp = props?.timestamp || 0
    this.key = props.key
    this.level = props?.level || 0
    this.assign()
    this.enabled = props?.enabled || false
    if (this.enabled) {
      this.enable()
    }
    this.repeat = null;
    this.accelerate = 1;
  }

  assign() {
    if (['Q', 'W', 'E', 'R'].includes(this.key)) {
      E[`Key${this.key}`].title = `(${this.key}) ${this.label}`

      const startRepeat = (event) => {
        if (!S.meta.freeze) {
          if (this.id == 's13') {
            this.use();
          } else if (!this.repeat) {
            this.repeat = setInterval(() => {
              for (let i = 0; i < this.accelerate; i++) {
                this.use();
              }
              this.accelerate++;
            }, 50);
          }
        }
        event.stopPropagation();
      }
      E[`Key${this.key}`].addEventListener('mousedown', startRepeat)
      E[`Key${this.key}`].addEventListener('touchstart', startRepeat)

      const endRepeat = (event) => {
        if (this.repeat) {
          clearInterval(this.repeat);
          this.repeat = null;
          this.accelerate = 1;
        }
        event.stopPropagation();
      }
      E[`Key${this.key}`].addEventListener('mouseup', endRepeat)
      E[`Key${this.key}`].addEventListener('touchend', endRepeat)
    }
  }

  buy() {
    if (this.enabled && S.econ.balance > (this.cost * S.econ.discount / 100)) {
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
      ...props,
    })
  }

  use() {
    if (this.buy()) {
      this.cost = 110 + 10 * this.level // Linear
      S.econ.base++
      updateBalance(0)

      // Unlock upgraded skill
      if (this.level >= 10000 && !S.story.unlocked.includes('s2')) {
        S.story.unlocked.push('s2');
        S.story.narrator.addLines([
          { duration: 4000, line: "The cats have industrialised." },
          { duration: 4000, line: "<i>You have unlocked the Factory skill</i>" },
        ]);
      }
    }
  }
}

// #2 - Factory: 2x Base
class FactorySkill extends Skill {
  constructor(props) {
    super({
      id: 's2',
      cost: 100000,
      ...props,
    })
  }

  use() {
    if (this.buy()) {
      this.cost = 10 ** (5 + this.level) // Exponential
      S.econ.base *= 2
      updateBalance(0)
    }
  }
}

// #3 - Times: +0.1x Mult
class TimesSkill extends Skill {
  constructor(props) {
    super({
      id: 's3',
      cost: 1000,
      ...props,
    })
  }

  use() {
    if (this.buy()) {
      this.cost = 1000 + 10 * ((this.level) ** 2) // Parabolic
      S.econ.mult += 10
      updateBalance(0)

      // Unlock upgraded skill
      if (this.level >= 1000 && !S.story.unlocked.includes('s4')) {
        S.story.unlocked.push('s4');
        S.story.narrator.addLines([
          { duration: 4000, line: "The cats have developed propaganda." },
          { duration: 4000, line: "<i>You have unlocked the Media skill</i>" },
        ]);
      }
    }
  }
}

// #4 - Media: 2x Mult
class MediaSkill extends Skill {
  constructor(props) {
    super({
      id: 's4',
      cost: 100000,
      ...props,
    })
  }

  use() {
    if (this.buy()) {
      this.cost = 10 ** (5 + this.level) // Exponential
      S.econ.mult *= 2
      updateBalance(0)
    }
  }
}

// #5 - Grow: +0.01% Interest
class GrowSkill extends Skill {
  constructor(props) {
    super({
      id: 's5',
      cost: 10000,
      ...props,
    })
  }

  use() {
    if (this.buy()) {
      this.cost = 10 ** (4 + this.level / 10) // Exponential
      S.econ.interest += 0.01
      updateBalance(0)

      // Unlock upgraded skill
      if (this.level >= 100 && !S.story.unlocked.includes('s6')) {
        S.story.unlocked.push('s6');
        S.story.narrator.addLines([
          { duration: 4000, line: "The cats have advanced veterinary science." },
          { duration: 4000, line: "<i>You have unlocked the Vets skill</i>" },
        ]);
      }
    }
  }
}

// #6 - Vets: +1% Interest
class VetsSkill extends Skill {
  constructor(props) {
    super({
      id: 's6',
      cost: 10 ** 6,
      ...props,
    })
  }

  use() {
    if (this.buy()) {
      this.cost *= (this.level + 1) // Factorial
      S.econ.interest += 1
      updateBalance(0)
    }
  }
}

// #7 - Catnip: Burst of clicks on cooldown
class CatnipSkill extends Skill {
  constructor(props) {
    super({
      id: 's7',
      cost: 0,
      cooldown: 15000,
      timestamp: 0,
      ...props,
    })
  }

  use() {
    const now = (new Date()).getTime()
    if (now > (this.timestamp + (this.cooldown * S.econ.discount / 100))) {
      this.timestamp = now;
      updateBalance(S.econ.base * S.econ.mult * 10) // 1000 Clicks
    }
  }
}

// #8 - Space: Delayed 100x return of current balance
class SpaceSkill extends Skill {
  constructor(props) {
    super({
      id: 's8',
      cost: 0,
      cooldown: 60000,
      timestamp: 0,
      ...props,
    })
  }

  use() {
    const now = (new Date()).getTime()
    if (now > (this.timestamp + (this.cooldown * S.econ.discount / 100))) {
      this.timestamp = now;
      const bounty = S.econ.balance * 100
      const playthrough = S.meta.playthrough
      setTimeout(() => {
        (playthrough == S.meta.playthrough) && updateBalance(bounty)
      }, (this.cooldown * S.econ.discount / 100))
      updateHud()
    }
  }
}

// #9 - Anti-Catter: Double or Nothing
class AntiCatterSkill extends Skill {
  constructor(props) {
    super({
      id: 's9',
      cost: 0,
      cooldown: 5000,
      timestamp: 0,
      ...props,
    })
  }

  use() {
    const now = (new Date()).getTime()
    if (now > (this.timestamp + (this.cooldown * S.econ.discount / 100))) {
      this.timestamp = now;
      if (Math.random() > 1 / S.meta.playthrough) {
        updateBalance(S.econ.balance) // Double
      } else {
        updateBalance(1 - S.econ.balance) // Nothing
      }
    }
  }
}

// #10 - Nekro: Discounts
class NekroSkill extends Skill {
  constructor(props) {
    super({
      id: 's10',
      cost: 0,
      ...props,
    })
    this.use()
  }

  use() {
    if (this.cost == 0) {
      this.cost = 1
      S.econ.discount = 100 - 5 * (S.story.unlocked.length)
    }
  }
}

// #11 - Payday: Once off lump sum
class PaydaySkill extends Skill {
  constructor(props) {
    super({
      id: 's11',
      cost: 0,
      ...props,
    })
    this.use()
  }

  use() {
    if (this.cost == 0) {
      this.cost = 1;
      S.econ.balance += 10 ** (S.story.unlocked.length);
      S.story.milestone = S.story.unlocked.length;
    }
  }
}

// #12 - War: Initial Base and Mult, double cost
class WarSkill extends Skill {
  constructor(props) {
    super({
      id: 's12',
      cost: 0,
      ...props,
    })
    this.use()
  }

  use() {
    if (this.cost == 0) {
      this.cost = 1
      S.econ.base = 1000 * (S.story.unlocked.length)
      S.econ.mult = 1000 * (S.story.unlocked.length)
      S.econ.discount *= 2
      S.story.milestone = 6; // Skip Mega
    }
  }
}

// #13 - Auto: Clicks per second
class AutoSkill extends Skill {
  constructor(props) {
    super({
      id: 's13',
      cost: 0,
      ...props,
    })
  }

  use() {
    this.debounce = true;
    if (this.cost == 1) {
      setTimeout(() => {
        if (this.debounce) {
          this.cost = 0;
          S.econ.auto = 0;
          updateBalance(0);
          this.flipping = false;
        }
      }, 500);
    } else {
      setTimeout(() => {
        if (this.debounce) {
          this.cost = 1;
          S.econ.auto = S.story.unlocked.length * 5;
          updateBalance(0);
          this.debounce = false;
        }
      }, 500);
    }
  }
}

// Register Skill metadata
const skillRegister = {
  s1: {
    generator: (props) => { return new HandsSkill(props) },
    name: 'Hands',
    icon: '&#x270B;',
    effect: '+1',
    label: 'Hands: Increase the Base number of cats per click by 1. So you can the cat.',
  },
  s2: {
    generator: (props) => { return new FactorySkill(props) },
    name: 'Factory',
    icon: '&#x1F3ED;',
    effect: 'x2 &#x270B;',
    label: 'Factory: Double the current Base. Cats view themselves as the boss.',
  },
  s3: {
    generator: (props) => { return new TimesSkill(props) },
    name: 'Times',
    icon: '&#x274E;',
    effect: '+0.1',
    label: "Times: Increase the Mult for cats per click by 0.1x. It's always a good time.",
  },
  s4: {
    generator: (props) => { return new MediaSkill(props) },
    name: 'Media',
    icon: '&#x1F3AC;',
    effect: 'x2 &#x274E;',
    label: 'Media: Double the current Mult. Cats have gone viral and taken over all forms of media.',
  },
  s5: {
    generator: (props) => { return new GrowSkill(props) },
    name: 'Grow',
    icon: '&#x1F4C8;',
    effect: '+0.01%',
    label: 'Grow: Increase the Interest rate of the current cat balance by 0.01%. Litters of kitties need litres of kitty litter.',
  },
  s6: {
    generator: (props) => { return new VetsSkill(props) },
    name: 'Vets',
    icon: '&#x1F3E5;',
    effect: '+1% &#x1F4C8;',
    label: 'Vets: Double the current Interest. Advances in modern feline medicine have increased life expectancy and kitten birth rates.',
  },
  s7: {
    generator: (props) => { return new CatnipSkill(props) },
    name: 'Catnip',
    icon: '&#x1F33F;',
    effect: 'Burst',
    label: 'Catnip: Unleash a burst of 1000 clicks; 15 second cooldown. Cats are drawn in by the irresistible appeal of catnip.',
  },
  s8: {
    generator: (props) => { return new SpaceSkill(props) },
    name: 'Space',
    icon: '&#x1F680;',
    effect: `x10 ${blackCat}`,
    label: 'Space: Launch an Expurrdition to the stars; 5 minute cooldown. After 5 minutes gain 10x the balance at launch time.',
  },
  s9: {
    generator: (props) => { return new AntiCatterSkill(props) },
    name: 'Anti-Catter',
    icon: '&#x2728;',
    effect: () => { return `${(100 - 100 / S.meta.playthrough).toFixed(0)}% x2` },
    label: 'Anti-Catter: Double or Nothing; 30 second cooldown. Chances of success permanently increase with every playthrough.',
  },
  s10: {
    generator: (props) => { return new NekroSkill(props) },
    name: 'Nekro',
    icon: '&#x1FAA6;',
    effect: () => { return `${100 - S.econ.discount}% Off` },
    label: 'Nekro: Discount on all Purrchases; 5% off for each unlocked skill. Nekomancy pushes the boundaries of the nine lives.',
  },
  s11: {
    generator: (props) => { return new PaydaySkill(props) },
    name: 'Payday',
    icon: '&#x1F4B0;',
    effect: 'Payday',
    label: 'Payday: Start with a lump sum of cats; increases tenfold for each unlocked skill. The Fat Cats have been hoarding generational wealth.',
  },
  s12: {
    generator: (props) => { return new WarSkill(props) },
    name: 'War',
    icon: '&#x1F6A9;',
    effect: 'Wartime',
    label: 'War: Start with 1000 Base and 10x Mult for each unlocked skill. Purrchases cost double. War takes more than it gives.',
  },
  s13: {
    generator: (props) => { return new AutoSkill(props) },
    name: 'Auto',
    icon: '&#x2699;&#xFE0F;',
    effect: () => { return `Auto:${5 * S.story.unlocked.length}` },
    label: 'Auto: 5 automatic clicks per second for each unlocked skill. Can be toggled on/off.',
  },
}

/* ========= Dialogue ========= */
class Narrator {
  constructor(props) {
    this.currentLine = props?.currentLine || { line: 'please DO NOT the cat' };
    this.queue = props?.queue || [];
    if (this.queue.length == 0) {
      this.loadLines();
    }
    this.sayLine(this.currentLine.line);
  }

  loadLines() {
    this.queue = [
      { line: 'please DO NOT the cat' },
      { predicate: 13, line: 'AHHH! What are you doing?' },
      { predicate: 25, line: "HEY!" },
      { predicate: 40, line: "Quit it!" },
      { predicate: 55, line: "PLEASE?" },
      { predicate: 70, line: "Okay." },
      { predicate: 85, line: "You're really doing this" },
      { predicate: 130, line: "Look..." },
      { predicate: 200, line: "I can't say I didn't warn you" },
      { predicate: 400, line: "But if you're going to commit..." },
      { predicate: 600, line: "You should do it properly." },
      { predicate: 800, line: "The better you treat them, the better they'll treat you" },
      { predicate: 1300, line: "Give and you shall receive" },
      { predicate: 2000, line: "It's just the way the universe works" },
      { predicate: 4000, line: "Or at least that's what I was told..." },
      { predicate: 6000, line: "We sure have a lot of cats now. Have you ever wondered where they come from?" },
      { predicate: 8000, line: "When a mommy and daddy cat love each other very much..." },
      { predicate: 13000, line: "But really. Is this bottomless ball of cats not a mystery to you?" },
      { predicate: 20000, line: "The truth is..." },
      { predicate: 40000, line: "...something along the lines of..." },
      { predicate: 70000, line: "<i>*pages flicking*</i>" },
      { predicate: 100000, line: "...I don't know either." },
      { predicate: 200000, line: "..." },
      { predicate: 400000, line: "Hey. Don't judge me. It's my first day!" },
      { predicate: 700000, line: "What's the worst that could possibly happen?" },
      { predicate: 3 * 10 ** 6, line: "The cats are really taking over the city..." },
      { predicate: 1 * 10 ** 7, line: "Have you noticed anything strange?" },
      { predicate: 3 * 10 ** 7, line: "They seem... smarter" },
      { predicate: 1 * 10 ** 8, line: "It's like there's a cat society" },
      { predicate: 3 * 10 ** 8, line: "...I'm so not getting paid enough for this" },
      { predicate: 3 * 10 ** 9, line: "I think they're calling it... Catitalism?" },
      { predicate: 1 * 10 ** 10, line: "Imperium. Supremus. Felis." },
      { predicate: 3 * 10 ** 10, line: "That's one real Cat Empire" },
      { predicate: 1 * 10 ** 11, line: "Do you think they're satisfied?" },
      { predicate: 3 * 10 ** 11, line: "I think they're hungry for more" },
      { predicate: 3 * 10 ** 12, line: "What do they want after world domination?" },
      { predicate: 3 * 10 ** 13, line: "They're building... some sort of structure" },
      { predicate: 3 * 10 ** 14, line: "<i>*pages flicking frantically*</i>" },
      { predicate: 3 * 10 ** 15, line: "This goes beyond my training" },
      { predicate: 3 * 10 ** 16, line: "AND WHERE DO THEY KEEP COMING FROM?" },
      { predicate: 3 * 10 ** 17, line: "They can't possibly be from Earth" },
      { predicate: 10 ** 20, line: "Maybe they came from another planet?" },
      { predicate: 10 ** 25, line: "Or another solar system?" },
      { predicate: 10 ** 30, line: "Perhaps they just want to go home..." },
      { predicate: 10 ** 45, line: "To a galaxy, far far away..." },
      { predicate: 10 ** 40, line: "<i>*muffled phone call noises*</i>" },
      { predicate: 10 ** 50, line: "Ok. Scratch that." },
      { predicate: 10 ** 60, line: "There's more cats than matter in the universe." },
      { predicate: 10 ** 70, line: "Don't even start thinking about the multiverse" },
      { predicate: 10 ** 80, line: "We're beyond the laws of physics here" },
      { predicate: 10 ** 90, line: "Can you just accept that? I want to go home." },
      { predicate: 10 ** 100, line: "<i>Fin.</i>" },
    ];
  }

  addLines(lines) {
    this.queue.unshift(...lines);
  }

  nextLine() {
    if (!this.currentLine.duration || (new Date()).getTime() > (this.currentLine.timestamp + this.currentLine.duration)) {
      if (this.queue.length > 0) {
        if ((!this.queue[0].predicate) || (typeof (this.queue[0].predicate) == 'number' && S.econ.balance > this.queue[0].predicate) || (typeof (this.queue[0].predicate) == 'function' && this.queue[0].predicate())) {
          if (this.currentLine.callback) {
            this.currentLine.callback();
          }
          this.currentLine = this.queue[0];
          this.currentLine.timestamp = (new Date().getTime());
          this.sayLine(this.currentLine.line);
          this.queue.shift();
        }
      } else {
        this.currentLine = { line: '...' };
      }
    }
  }

  sayLine(line) {
    E.dialogue.innerHTML = line
  }
}

/* ========= Story Events ========= */
const storyMegacat = () => {
  S.story.milestone = 6;
  if (!S.story.unlocked.includes('s7')) {
    S.skills.selected.push('s7');
    S.story.unlocked.push('s7');
    S.skills.bindings.R = skillRegister['s7'].generator({ key: 'R' });
  }
  S.econ.drain = 50000;
  S.story.narrator.addLines([
    { duration: 4000, line: "WHAT. IS. THAT?" },
    { duration: 4000, line: "It's a... MEGACAT" },
    { duration: 4000, line: 'ITS CONSUMING ALL THE OTHER CATS' },
    { duration: 4000, line: 'Quick, go get the CATNIP' },
    { duration: 4000, line: 'We need to FEED THE BEAST' },
    { duration: 4000, line: 'KEEP FEEDING IT' },
    { duration: 4000, line: 'WE HAVE TO SAVE THE CATS' },
    {
      duration: 4000, line: 'ALMOST THERE!!!', callback: () => {
        S.econ.drain = 0;
      }
    },
    { duration: 4000, line: 'Phew! That was a close one.' },
  ]);
};

const storyGigacat = () => {
  S.story.milestone = 9;
  S.econ.drain = 6 * 10 ** 7;
  S.story.narrator.addLines([
    { duration: 4000, line: "Uh oh. This is bad." },
    { duration: 6000, line: "The cats are seizing the means of production!" },
    { duration: 4000, line: "It's a full blown revolution!" },
    { duration: 6000, line: "What will you do? Will you support them?" },
    { duration: 4000, line: "They're losing numbers FAST" },
    { duration: 4000, line: "Don't let this be for nothing!" },
    {
      duration: 4000, line: "They're storming the capital!!!", callback: () => {
        S.econ.drain = 0;
        if (!S.story.unlocked.includes('s11')) {
          S.story.unlocked.push('s11');
          S.story.narrator.addLines([{ duration: 4000, line: '<i>You have unlocked the Payday skill</i>' }]);
        }
      }
    },
    { duration: 4000, line: "The Fat Cats are in charge now." },
  ]);
};

const storyTeracat = () => {
  S.story.milestone = 12;
  S.econ.drain = 7 * 10 ** 10;
  S.story.narrator.addLines([
    { duration: 4000, line: "<i>*Cat Empire has declared war*</i>" },
    { duration: 4000, line: "They're launching an all-out invasion!" },
    { duration: 6000, line: 'Fighting on every front!' },
    { duration: 6000, line: "It's a sheer battle of numbers" },
    { duration: 6000, line: '100 cats vs every person!' },
    { duration: 6000, line: 'An absolute meownstrosity!' },
    { duration: 6000, line: "They're almost taken the last outpost." },
    {
      duration: 4000, line: "Pushing through the final defences...", callback: () => {
        S.econ.drain = 0;
        if (!S.story.unlocked.includes('s12')) {
          S.story.unlocked.push('s12');
          S.story.narrator.addLines([{ duration: 4000, line: '<i>You have unlocked the War skill</i>' }]);
        }
      }
    },
    { duration: 4000, line: 'The cats now control the Earth.' },
  ]);
};

const storyPetacat = () => {
  S.story.milestone = 15;
  S.econ.drain = 8 * 10 ** 13;
  S.story.narrator.addLines([
    { duration: 4000, line: "Okay. So it's a Megalith." },
    { duration: 4000, line: "A place of ritual sacrifice" },
    { duration: 6000, line: "They're trying to unlock the secrets of immortality!" },
    { duration: 4000, line: "It's costing trillions of lives!" },
    { duration: 6000, line: "Is this what happens when you have everything?" },
    { duration: 6000, line: "You know, I feel sorry for them." },
    {
      duration: 6000, line: 'In the end they became their own demise...', callback: () => {
        S.econ.drain = 0;
        if (!S.story.unlocked.includes('s10')) {
          S.story.unlocked.push('s10');
          S.story.narrator.addLines([{ duration: 4000, line: '<i>You have unlocked the Nekro skill</i>' }]);
        }
      }
    },
    { duration: 4000, line: 'WAIT. WHAT!?!' },
    { duration: 4000, line: 'The Nekomancers have uncovered the key to resurrection.' },
    { duration: 4000, line: 'I did not sign up for this. Did you?' },
  ]);
};

const storyExacat = () => {
  S.story.milestone = 18;
  S.econ.drain = 10 ** 17;
  S.story.narrator.addLines([
    { duration: 6000, line: "The cats have launched a space program." },
    { duration: 4000, line: "Their ships are fueled by... catpower!" },
    { duration: 4000, line: "Just pushing each other up!" },
    { duration: 4000, line: 'Outwards and onwards to the stars' },
    { duration: 4000, line: 'KEEP GOING' },
    {
      duration: 4000, line: "They've nearly escaped the Earth's gravity", callback: () => {
        S.econ.drain = 0;
        if (!S.story.unlocked.includes('s8')) {
          S.story.unlocked.push('s8');
          S.story.narrator.addLines([{ duration: 4000, line: '<i>You have unlocked the Space skill</i>' }]);
        }
      }
    },
    { duration: 4000, line: "They're off to explore the galaxy" },
    { duration: 4000, line: "I wonder where they'll go" },
  ]);
};

const storyInfinity = () => {
  S.meta.freeze = true;
  S.story.milestone = 100;
  E.body.style.background = 'black';
  E.counter.innerHTML = '';
  E.interest.innerHTML = '';
  S.canvas.cats = [];
  S.story.narrator.addLines([
    { duration: 4000, line: "Well. You've done it" },
    { duration: 4000, line: "The whole universe is full of cats" },
    { duration: 4000, line: "I hope you're happy" },
    { duration: 4000, line: "You can finally go do someting else with your life" },
    { duration: 4000, line: "What?" },
    { duration: 4000, line: "You're wondering what's next?" },
    { duration: 4000, line: "Seriously. There's nothing." },
    { duration: 4000, line: "..." },
    { duration: 4000, line: "Oh go away. I've got a huge mess to clean up" },
    { duration: 4000, line: "<i>*sigh*</i>" },
    {
      duration: 6000, line: "Have you heard the saying about curiosity?", callback: () => {
        E.body.style.background = 'white';
      },
    },
    { duration: 6000, line: '<i>Fin.</i>', callback: endPlaythrough },
    { line: '<i>Fin.</i>' },
  ]);
  if (!S.story.unlocked.includes('s9')) {
    S.story.unlocked.push('s9');
    S.story.narrator.addLines([{ duration: 4000, line: '<i>You have unlocked the Anti-Catter skill</i>' }]);
  }
};

const storyAutocat = () => {
  S.meta.freeze = true;
  S.canvas.cats = [];
  S.story.narrator.addLines([
    { duration: 4000, line: 'You did not the cat.' },
    { duration: 4000, line: 'Thanks for watching it!' },
    { duration: 4000, line: "You've saved me from a lot of trouble. Here have this..." },
    { duration: 4000, line: '<i>You have unlocked the Auto skill</i>', callback: endPlaythrough },
    { line: '<i>Fin.</i>' },
  ]);
};

const endPlaythrough = () => {
  // Reset
  S.canvas.cats = [];
  S.econ = {
    auto: 0, // Auto per tick
    balance: 1, // Current Cats
    base: 1, // Cats per click
    discount: 100, // Price Modifier %
    drain: 0, // Loss per tick
    interest: 0, // Growth % per tick
    mult: 100, // Multiplier %
    total: 0, // Cats accumulated over all time
  };
  S.meta.active = false;
  S.meta.freeze = false;
  S.meta.magnitude = 0;
  S.meta.playthrough += 1;
  S.story.milestone = 0;
  S.story.narrator = new Narrator();
  saveGame();
};

/* ========= Services ========= */
// Rendering
const renderFrame = () => {
  ctx.clearRect(0, 0, ...S.canvas.size);
  S.canvas.cats.forEach(cat => {
    cat.render();
  })
};
setInterval(renderFrame, 50); // 20 FPS

// Economy
const patCat = () => {
  if (!S.meta.freeze) {
    updateBalance(S.econ.base * S.econ.mult / 100);
    // Trigger Meow Sound Here
    if (!S.meta.mute && S.meta.active) {
      meows[Math.floor(meows.length * Math.random())].play();
    }
  }
};
E.canvas.addEventListener('click', patCat);
E.dialogue.addEventListener('click', patCat);

// Ticks
const tickInterval = setInterval(() => {
  const elapsedTime = (new Date().getTime() - S.meta.starttime);

  // Auto Save
  if ((elapsedTime % 120000) < 1000) {
    saveGame();
  }

  // Story Events
  if (S.meta.active) {
    // Base Skills
    if (!S.story.unlocked.includes('s1')) {
      if (S.econ.balance > 110) {
        S.story.unlocked.push('s1');
        S.skills.selected.push('s1');
        S.skills.bindings.Q = skillRegister['s1'].generator({ key: 'Q' });
        S.story.narrator.addLines([{ line: "I'll find someone to take them off your HANDS" }]);
      }
    }
    if (!S.story.unlocked.includes('s3')) {
      if (S.econ.balance > 1000) {
        S.story.unlocked.push('s3');
        S.skills.selected.push('s3');
        S.skills.bindings.W = skillRegister['s3'].generator({ key: 'W' });
        S.story.narrator.addLines([{ line: "They'll go out and tell others about the good TIMES" }]);
        S.story.narrator.sayLine("")
      }
    }
    if (!S.story.unlocked.includes('s5')) {
      if (S.econ.balance > 10000) {
        S.story.unlocked.push('s5');
        S.skills.selected.push('s5');
        S.skills.bindings.E = skillRegister['s5'].generator({ key: 'E' });
        S.story.narrator.addLines([{ line: "They want to have kittens! Maybe we should give them space to GROW?" }]);
      }
    }

    // Milestones
    if (S.meta.magnitude >= 100) {
      S.story.milestone < 100 && storyInfinity();
    } else if (S.meta.magnitude >= 18) {
      S.story.milestone < 18 && storyExacat();
    } else if (S.meta.magnitude >= 15) {
      S.story.milestone < 15 && storyPetacat();
    } else if (S.meta.magnitude >= 12) {
      S.story.milestone < 12 && storyTeracat();
    } else if (S.meta.magnitude >= 9) {
      S.story.milestone < 9 && storyGigacat();
    } else if (S.meta.magnitude >= 6) {
      S.story.milestone < 6 && storyMegacat();
    }

    // Did not the cat
    if (!S.story.unlocked.includes('s13')) {
      if (S.econ.balance == 1 && elapsedTime > 20000) {
        S.story.unlocked.push('s13');
        storyAutocat();
      }
    }
  } else {
    updateLauncher();
  }

  // Econ
  if (!S.meta.freeze) {
    if (S.econ.interest > 0) {
      updateBalance(Math.floor(S.econ.balance * S.econ.interest / 100));
    }

    if (S.econ.auto > 0) {
      for (let i = 0; i < S.econ.auto; i++) {
        setTimeout(() => {
          patCat();
        }, 10 * i)
      }
    }

    if (S.econ.drain > 0) {
      updateBalance(-S.econ.drain);
    }
  }

  // Dialogue
  updateHud();
  S.story.narrator.nextLine();
}, 1000);

/* ========= Buttons ========= */
// Menu Buttons
E.pause.addEventListener('click', (event) => {
  E.menu.classList.toggle('hidden');
  event.stopPropagation();
});
E.mute.addEventListener('click', (event) => {
  S.meta.mute = !S.meta.mute;
  updateHud();
  event.stopPropagation();
});
E.restart.addEventListener('click', (event) => {
  endPlaythrough();
  updateLauncher();
  E.menu.classList.add('hidden');
  event.stopPropagation();
});
E.clear.addEventListener('click', (event) => {
  resetGame();
  event.stopPropagation();
});

// Hotkeys
const hotkeydown = (event) => {
  if (S.meta.active) {
    if (['KeyQ', 'KeyW', 'KeyE', 'KeyR'].includes(event.code)) {
      document.getElementById(event.code).dispatchEvent(new Event('mousedown'));
    } else if (event.code === 'Space' || event.key === ' ') {
      patCat();
    }
  }
};
document.addEventListener('keydown', hotkeydown, false);

const hotkeyup = (event) => {
  if (['KeyQ', 'KeyW', 'KeyE', 'KeyR'].includes(event.code)) {
    document.getElementById(event.code).dispatchEvent(new Event('mouseup'));
  }

  if (event.code === 'Escape' || event.key === 'Escape') {
    E.pause.click();
  }
};
document.addEventListener('keyup', hotkeyup, false);

/* ========= Init ========= */
// Check for Meta In-App Browsers
if (navigator.userAgent.match(/FBAN|FBAV|Instagram/i)) {
  document.body.outerHTML = `
    <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);">
      Please open this page in your primary browser for the best gameplay experience
    </div>
  `
  clearInterval(tickInterval)
} else {
  loadGame() || startGame();
}
