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
    active: true,
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
    unlocked: [],
  },
};

const startGame = () => {
  E.launch.classList.add('hidden');
  S.meta.active = true;
  S.meta.starttime = (new Date()).getTime();

  // First Cat
  S.canvas.cats.push(new Cat({ coordinates: [0, 0] }));

  // Apply Skill Selection
  registerKeys();
  S.skills.selected = S.skills.selected.sort((a, b) => { return (a.substring(1) - b.substring(1)) }); // sort in alphnumeric order
  if (S.skills.selected.length == 1 && S.skills.selected[0] == 's13') {
    // Edge case for Auto only
    S.skills.bindings = {
      Q: null,
      W: null,
      E: null,
      R: skillRegister.s13.generator({ key: 'R' })
    };
  } else {
    Object.keys(S.skills.bindings).forEach((key, index) => { S.skills.bindings[key] = S.skills.selected[index] ? skillRegister[S.skills.selected[index]].generator({ key: key }) : null });
  }

  // Narrator
  S.story.narrator = new Narrator({ playthrough: S.meta.playthrough });

  // UI
  updateBalance(0);
};

const saveGame = () => {
  console.debug('Saving Game');
  const saveData = JSON.stringify(S);
  localStorage.setItem('mcteamster.black.savedata', saveData);
};
onbeforeunload = saveGame;

const loadGame = () => {
  const loadData = localStorage.getItem('mcteamster.black.savedata');
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
  console.debug('Resetting Game');
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
  E.counter.innerHTML = (S.meta.playthrough == 1 && S.econ.balance == 1) ? '' : `${blackCat} ${notation(S.econ.balance)}`;
  E.interest.innerHTML = `${S.econ.interest > 0 ? '&#x1F4C8; ' + (S.econ.interest.toFixed(2)) + '% ps' : ''}`;
  E.stats.innerHTML = `
    ${S.econ.base > 1 ? '&#x270B; ' + notation(S.econ.base, true) : ''}&nbsp;
    ${S.econ.mult > 100 ? ' &#x274E; ' + (S.econ.mult > 10**5 ? notation(S.econ.mult / 100, true) : (S.econ.mult / 100).toFixed(1)) : ''}
  `;
  ['Q', 'W', 'E', 'R'].forEach(key => {
    if (S.skills.bindings[key]) {
      if (S.econ.balance > (S.skills.bindings[key].cost * S.econ.discount / 100)) {
        S.skills.bindings[key].enable();
      }
      let price = '';
      if (S.skills.bindings[key].cooldown > 0) {
        price = (((S.skills.bindings[key].timestamp + (S.skills.bindings[key].cooldown * S.econ.discount / 100)) - (new Date()).getTime())/1000).toFixed(0);
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
  S.story.narrator.nextLine();
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
  if (S.meta.active && !S.meta.cutscene) {
    // Scaling
    if (cats == Infinity) {
      S.econ.cats = Infinity;
      S.econ.total = Infinity;
      updateHud();
      return
    } else if (cats > 0) {
      S.econ.total += cats;
    }
    S.econ.balance += cats;
    const unitPower = updateMagnitude();
    updateHud();

    // Render New Cats, Remove Oldest
    if (cats > 0) {
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
  }

  assign() {
    if (['Q', 'W', 'E', 'R'].includes(this.key)) {
      E[`Key${this.key}`].addEventListener('click', (event) => { this.use(); event.stopPropagation() })
      E[`Key${this.key}`].title = `(${this.key}) ${this.label}`
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
        S.story.unlocked.push('s2')
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
        S.story.unlocked.push('s4')
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
        S.story.unlocked.push('s6')
      }
    }
  }
}

// #6 - Vets: 2x Interest
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
      if (S.econ.interest == 0) {
        S.econ.interest = 0.01
      } else {
        S.econ.interest *= 2
      }
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

// #8 - Space: Delayed 10x return of current balance
class SpaceSkill extends Skill {
  constructor(props) {
    super({
      id: 's8',
      cost: 0,
      cooldown: 300000,
      timestamp: 0,
      ...props,
    })
  }

  use() {
    const now = (new Date()).getTime()
    if (now > (this.timestamp + (this.cooldown * S.econ.discount / 100))) {
      this.timestamp = now;
      const bounty = S.econ.balance * 10
      setTimeout(() => {
        updateBalance(bounty)
      }, this.cooldown)
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
      cooldown: 30000,
      timestamp: 0,
      ...props,
    })
  }

  use() {
    const now = (new Date()).getTime()
    if (now > (this.timestamp + (this.cooldown * S.econ.discount / 100))) {
      this.timestamp = now;
      if (Math.random() > 1/S.meta.playthrough) {
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
      S.econ.discount = 100 - 5*(S.story.unlocked.length)
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
      this.cost = 1
      S.econ.balance += 10 ** (S.story.unlocked.length)
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
    effect: '2x &#x270B;',
    label: 'Factory: Double the current Base. Cats view themselves as the boss.',
  },
  s3: {
    generator: (props) => { return new TimesSkill(props) },
    name: 'Times',
    icon: '&#x274E;',
    effect: '+0.1x',
    label: 'Times: Increase the Mult for cats per click by 0.1x. Let the good times roll.',
  },
  s4: {
    generator: (props) => { return new MediaSkill(props) },
    name: 'Media',
    icon: '&#x1F3AC;',
    effect: '2x &#x274E;',
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
    effect: '2x &#x1F4C8;',
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
    effect: () => { return `${(100 - 100/S.meta.playthrough).toFixed(0)}% x2` },
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
    effect: () => { return `Auto:${S.story.unlocked.length}` },
    label: 'Auto: 1 automatic click per second for each unlocked skill. Can be toggled on/off.',
  },
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
    ];

    // TODO: Rework this
    const skillLines = [
      {
        predicate: () => { return (S.skills.bindings.Q?.level == 0 && S.econ.balance > S.skills.bindings.Q?.cost) },
        line: `I'll find someone to take them off your HANDS`,
        include: () => { return (S.skills.bindings.Q?.id == 's1') },
      },
      {
        predicate: () => { return (S.skills.bindings.Q?.level == 1 && S.econ.balance < (S.skills.bindings.Q?.cost)) },
        line: `OH NO. THIS IS WORSE!`,
        include: () => { return (S.skills.bindings.Q?.id == 's1') },
      },
      {
        predicate: () => { return (S.skills.bindings.W?.level == 0 && S.econ.balance > S.skills.bindings.W?.cost) },
        line: `They'll go out and tell others about the good TIMES`,
        include: () => { return (S.skills.bindings.W?.id == 's3') },
      },
      {
        predicate: () => { return (S.skills.bindings.E?.level == 0 && S.econ.balance > S.skills.bindings.E?.cost) },
        line: `They want to have kittens! Maybe we should give them space to GROW?`,
        include: () => { return (S.skills.bindings.E?.id == 's5') },
      },
    ];

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
  console.info("Achievement: You did not the cat.");
  S.meta.cutscene = true;
  S.canvas.cats = [];
  S.story.narrator.sayLine('You did not the cat');
  setTimeout(() => {
    if (!S.story.unlocked.includes('s13')) {
      S.story.unlocked.push('s13'); // Unlock the Auto Skill
      S.story.narrator.sayLine('Thank you for listening!!');
      setTimeout(() => {
        S.story.narrator.sayLine('<i>You have unlocked the Auto skill</i>');
        setTimeout(() => {
          endPlaythrough();
        }, 3000)
      }, 3000)
    }
  }, 3000)
};

const storyMegacat = () => {
  // TODO: Megacat Story
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
  S.meta.cutscene = false;
  S.meta.active = false;
  S.meta.magnitude = 0;
  S.meta.playthrough += 1;
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
  updateBalance(S.econ.base * S.econ.mult / 100);
  // Trigger Meow Sound Here
  if (!S.meta.mute) {
    meows[Math.floor(meows.length * Math.random())].play();
  }
};
E.canvas.addEventListener('click', patCat);

// Ticks
const tickInterval = setInterval(() => {
  const elapsedTime = (new Date().getTime() - S.meta.starttime);

  // Auto Save
  if ((elapsedTime % 300000) < 1000) {
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
      }
    }
    if (!S.story.unlocked.includes('s3')) {
      if (S.econ.balance > 1000) {
        S.story.unlocked.push('s3');
        S.skills.selected.push('s3');
        S.skills.bindings.W = skillRegister['s3'].generator({ key: 'W' });
      }
    }
    if (!S.story.unlocked.includes('s5')) {
      if (S.econ.balance > 10000) {
        S.story.unlocked.push('s5');
        S.skills.selected.push('s5');
        S.skills.bindings.E = skillRegister['s5'].generator({ key: 'E' });
      }
    }

    // Milestones
    if (!S.story.unlocked.includes('s7')) {
      if (S.econ.balance > 10 ** 6) {
        storyMegacat();
        S.story.unlocked.push('s7');
      }
    }
    if (!S.story.unlocked.includes('s11')) {
      if (S.econ.balance > 10 ** 9) {
        // TODO Gigacat
        S.story.unlocked.push('s11');
      }
    }
    if (!S.story.unlocked.includes('s12')) {
      if (S.econ.balance > 10 ** 12) {
        // TODO Teracat
        S.story.unlocked.push('s12');
      }
    }
    if (!S.story.unlocked.includes('s10')) {
      if (S.econ.balance > 10 ** 15) {
        // TODO Petacat
        S.story.unlocked.push('s10');
      }
    }
    if (!S.story.unlocked.includes('s8')) {
      if (S.econ.balance > 10 ** 18) {
        // TODO Exacat
        S.story.unlocked.push('s8');
      }
    }
    if (!S.story.unlocked.includes('s9')) {
      if (S.econ.balance > 10 ** 21) {
        // TODO Infinity
        S.story.unlocked.push('s9');
      }
    }
    
    // Did not the cat
    if (!S.story.unlocked.includes('s13')) {
      if (S.econ.balance == 1 && elapsedTime > 10000) {
        storyAutocat();
      }
    }
  } else {
    updateLauncher();
  }

  // Econ
  if (S.econ.interest > 0) {
    updateBalance(Math.floor(S.econ.balance * S.econ.interest / 100));
  } else {
    updateHud();
  }

  if (S.econ.auto > 0) {
    for (let i = 0; i < S.econ.auto; i++) {
      setTimeout(() => {
        patCat();
      }, 70 * i)
    }
  }

  if (S.econ.drain > 0) {
    updateBalance(S.econ.drain);
  }
}, 1000);

/* ========= Buttons ========= */
// Menu Buttons
E.pause.addEventListener('click', (event) => {
  E.menu.classList.toggle('hidden');
  // E.menu.style.background = E.body.style.background;
  event.stopPropagation();
});
E.mute.addEventListener('click', (event) => {
  console.log('Toggling Mute');
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
      document.getElementById(event.code).click();
    } else if (event.code === 'Space' || event.key === ' ') {
      patCat();
    } else if (event.code === 'Escape' || event.key === 'Escape') {
      E.pause.click();
    }
  }
};
document.addEventListener('keydown', hotkeydown, false);

/* ========= Init ========= */
// Check for Meta In-App Browsers
if (navigator.userAgent.match(/FBAN|FBAV|Instagram/i)) {
  console.warn('In-app browser detected');
  document.body.outerHTML = `
    <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);">
      Please open this page in your primary browser for the best gameplay experience
    </div>
  `
  clearInterval(tickInterval)
} else {
  loadGame() || startGame();
}
