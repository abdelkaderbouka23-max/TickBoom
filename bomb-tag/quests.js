const crypto = require("crypto");

function randomId() {
  return crypto.randomUUID();
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickUnused(room, pool, key = "id") {
  if (!room.usedKeys) room.usedKeys = new Set();
  const fresh = pool.filter((item) => !room.usedKeys.has(item[key]));
  const source = fresh.length ? fresh : pool;
  if (!fresh.length) {
    for (const item of pool) room.usedKeys.delete(item[key]);
  }
  const item = source[randomInt(0, source.length - 1)];
  room.usedKeys.add(item[key]);
  return item;
}

function mcq(question, correct, wrongs, extra = {}, type = "quiz") {
  const answers = shuffle([correct, ...wrongs].slice(0, 4));
  return {
    id: randomId(),
    type,
    question,
    answers,
    correctIndex: answers.indexOf(correct),
    phase: "play",
    extra
  };
}

const THEMES = [
  {
    id: "quiz",
    title: "Quick Quiz",
    tag: "Knowledge",
    description: "Culture, tech, logic — answer before it blows."
  },
  {
    id: "brands",
    title: "Brand Guess",
    tag: "Identity",
    description: "Identify iconic brands from their visual mark."
  },
  {
    id: "memory",
    title: "Memory Challenge",
    tag: "Recall",
    description: "Watch the sequence. Then prove you saw it."
  },
  {
    id: "visual",
    title: "Visual Challenge",
    tag: "Focus",
    description: "Spot, match, tap — observation under pressure."
  }
];

const QUIZ = [
  { id: "q1", q: "Which planet has the most visible rings?", a: "Saturn", w: ["Jupiter", "Uranus", "Neptune"] },
  { id: "q2", q: "What is the capital of Australia?", a: "Canberra", w: ["Sydney", "Melbourne", "Perth"] },
  { id: "q3", q: "Which company created the iPhone?", a: "Apple", w: ["Samsung", "Nokia", "Sony"] },
  { id: "q4", q: "In which country is the city of Kyoto?", a: "Japan", w: ["China", "South Korea", "Thailand"] },
  { id: "q5", q: "Who directed Pulp Fiction?", a: "Quentin Tarantino", w: ["Martin Scorsese", "Christopher Nolan", "Ridley Scott"] },
  { id: "q6", q: "What does CPU stand for?", a: "Central Processing Unit", w: ["Core Power Utility", "Computer Primary Unit", "Central Program Usage"] },
  { id: "q7", q: "Which ocean is the largest?", a: "Pacific", w: ["Atlantic", "Indian", "Arctic"] },
  { id: "q8", q: "Ferrari is based in which country?", a: "Italy", w: ["Germany", "France", "UK"] },
  { id: "q9", q: "Which year did World War II end?", a: "1945", w: ["1939", "1942", "1950"] },
  { id: "q10", q: "What is the chemical symbol for gold?", a: "Au", w: ["Ag", "Gd", "Go"] },
  { id: "q11", q: "Which streaming service launched first?", a: "Netflix", w: ["Disney+", "HBO Max", "Apple TV+"] },
  { id: "q12", q: "The Louvre is located in…", a: "Paris", w: ["Rome", "Madrid", "Vienna"] },
  { id: "q13", q: "How many players are on a football (soccer) team on the pitch?", a: "11", w: ["10", "12", "9"] },
  { id: "q14", q: "Which language has the most native speakers?", a: "Mandarin Chinese", w: ["English", "Spanish", "Hindi"] },
  { id: "q15", q: "What is the fastest land animal?", a: "Cheetah", w: ["Lion", "Pronghorn", "Greyhound"] },
  { id: "q16", q: "Bitcoin launched in which year?", a: "2009", w: ["2005", "2013", "2017"] },
  { id: "q17", q: "Which house does Harry Potter belong to?", a: "Gryffindor", w: ["Slytherin", "Ravenclaw", "Hufflepuff"] },
  { id: "q18", q: "The currency of Japan is the…", a: "Yen", w: ["Won", "Yuan", "Ringgit"] },
  { id: "q19", q: "Which instrument has 88 keys?", a: "Piano", w: ["Organ", "Harpsichord", "Synthesizer"] },
  { id: "q20", q: "Mount Everest lies on the border of Nepal and…", a: "China", w: ["India", "Bhutan", "Pakistan"] },
  { id: "q21", q: "Who painted the Mona Lisa?", a: "Leonardo da Vinci", w: ["Michelangelo", "Raphael", "Caravaggio"] },
  { id: "q22", q: "Which gas do plants absorb?", a: "Carbon dioxide", w: ["Oxygen", "Nitrogen", "Helium"] },
  { id: "q23", q: "What is the smallest prime number?", a: "2", w: ["1", "3", "0"] },
  { id: "q24", q: "Which brand’s slogan is “Just Do It”?", a: "Nike", w: ["Adidas", "Puma", "Reebok"] },
  { id: "q25", q: "The Colosseum is in…", a: "Rome", w: ["Athens", "Lisbon", "Istanbul"] },
  { id: "q26", q: "HTML is used to…", a: "Structure web pages", w: ["Style databases", "Compile apps", "Encrypt files"] },
  { id: "q27", q: "Which continent is the Sahara in?", a: "Africa", w: ["Asia", "Australia", "South America"] },
  { id: "q28", q: "Who is known as the GOAT of football for many fans, with 8 Ballon d’Ors?", a: "Lionel Messi", w: ["Cristiano Ronaldo", "Pelé", "Maradona"] },
  { id: "q29", q: "Which of these is a programming language?", a: "Python", w: ["Photoshop", "Nginx", "Figma"] },
  { id: "q30", q: "The Great Barrier Reef is off the coast of…", a: "Australia", w: ["Brazil", "Mexico", "Indonesia"] },
  { id: "q31", q: "True or false: Light travels faster than sound.", a: "True", w: ["False", "Only in water", "Only in space"] },
  { id: "q32", q: "Which Marvel character is also called the Sorcerer Supreme?", a: "Doctor Strange", w: ["Loki", "Vision", "Wanda"] },
  { id: "q33", q: "USB was created to…", a: "Connect devices with a standard port", w: ["Replace Wi-Fi", "Store only photos", "Power stadiums"] },
  { id: "q34", q: "Which city hosted the 2012 Summer Olympics?", a: "London", w: ["Beijing", "Rio", "Tokyo"] },
  { id: "q35", q: "What is 2, 3, 5, 8, 13, … ?", a: "21", w: ["18", "20", "24"] },
  { id: "q36", q: "Rolex is primarily known for…", a: "Watches", w: ["Cars", "Perfume", "Hotels"] },
  { id: "q37", q: "Which country invented sushi in its modern form?", a: "Japan", w: ["China", "Korea", "Thailand"] },
  { id: "q38", q: "The first PlayStation was released by…", a: "Sony", w: ["Nintendo", "Sega", "Microsoft"] },
  { id: "q39", q: "Which desert is the largest hot desert?", a: "Sahara", w: ["Gobi", "Kalahari", "Atacama"] },
  { id: "q40", q: "In music, how many beats are in a standard 4/4 bar?", a: "4", w: ["3", "8", "2"] },
  { id: "q41", q: "Which element has the atomic number 1?", a: "Hydrogen", w: ["Helium", "Oxygen", "Carbon"] },
  { id: "q42", q: "The brand Tesla is mainly associated with…", a: "Electric cars", w: ["Cameras", "Airlines", "Fashion"] },
  { id: "q43", q: "What is the capital of Canada?", a: "Ottawa", w: ["Toronto", "Vancouver", "Montreal"] },
  { id: "q44", q: "Which of these is a luxury fashion house?", a: "Chanel", w: ["Ikea", "Uniqlo", "Decathlon"] },
  { id: "q45", q: "True or false: The Sun is a star.", a: "True", w: ["False", "It is a planet", "It is a comet"] },
  { id: "q46", q: "Which app is known for 15-second to 3-minute vertical videos?", a: "TikTok", w: ["LinkedIn", "Dropbox", "Slack"] },
  { id: "q47", q: "The currency used in Germany is the…", a: "Euro", w: ["Franc", "Mark", "Pound"] },
  { id: "q48", q: "Which number completes 3, 9, 27, 81, … ?", a: "243", w: ["162", "108", "324"] },
  { id: "q49", q: "Which car brand makes the 911?", a: "Porsche", w: ["Ferrari", "BMW", "Jaguar"] },
  { id: "q50", q: "The first iPhone launched in…", a: "2007", w: ["2005", "2009", "2010"] },
  { id: "q51", q: "Which city is known as the Big Apple?", a: "New York", w: ["Los Angeles", "Chicago", "Boston"] },
  { id: "q52", q: "Who wrote Hamlet?", a: "William Shakespeare", w: ["Charles Dickens", "Jane Austen", "Oscar Wilde"] },
  { id: "q53", q: "Which planet is closest to the Sun?", a: "Mercury", w: ["Venus", "Mars", "Earth"] },
  { id: "q54", q: "Spotify is primarily a…", a: "Music streaming service", w: ["Bank", "Airline", "Camera brand"] },
  { id: "q55", q: "The Eiffel Tower was completed in…", a: "1889", w: ["1789", "1912", "1945"] },
  { id: "q56", q: "Which sport uses a shuttlecock?", a: "Badminton", w: ["Tennis", "Squash", "Golf"] },
  { id: "q57", q: "Android is developed by…", a: "Google", w: ["Apple", "Samsung", "Microsoft"] },
  { id: "q58", q: "Which country has the most time zones?", a: "France", w: ["Russia", "USA", "China"] },
  { id: "q59", q: "A Stradivarius is a type of…", a: "Violin", w: ["Piano", "Watch", "Car"] },
  { id: "q60", q: "Which F1 team is based in Maranello?", a: "Ferrari", w: ["Mercedes", "Red Bull", "McLaren"] }
];

const BRANDS = [
  { id: "nike", name: "Nike", file: "nike.svg", difficulty: "easy", wrong: ["Adidas", "Puma", "Reebok"] },
  { id: "adidas", name: "Adidas", file: "adidas.svg", difficulty: "easy", wrong: ["Nike", "Puma", "New Balance"] },
  { id: "apple", name: "Apple", file: "apple.svg", difficulty: "easy", wrong: ["Microsoft", "Samsung", "Google"] },
  { id: "samsung", name: "Samsung", file: "samsung.svg", difficulty: "easy", wrong: ["Sony", "LG", "Apple"] },
  { id: "mcdonalds", name: "McDonald's", file: "mcdonalds.svg", difficulty: "easy", wrong: ["Burger King", "KFC", "Subway"] },
  { id: "coca-cola", name: "Coca-Cola", file: "coca-cola.svg", difficulty: "easy", wrong: ["Pepsi", "Fanta", "Sprite"] },
  { id: "youtube", name: "YouTube", file: "youtube.svg", difficulty: "easy", wrong: ["Netflix", "Twitch", "Vimeo"] },
  { id: "spotify", name: "Spotify", file: "spotify.svg", difficulty: "easy", wrong: ["Apple Music", "Deezer", "SoundCloud"] },
  { id: "netflix", name: "Netflix", file: "netflix.svg", difficulty: "easy", wrong: ["HBO", "Disney+", "Amazon Prime"] },
  { id: "mercedes", name: "Mercedes-Benz", file: "mercedes.svg", difficulty: "easy", wrong: ["BMW", "Audi", "Lexus"] },
  { id: "bmw", name: "BMW", file: "bmw.svg", difficulty: "medium", wrong: ["Mercedes-Benz", "Audi", "Volvo"] },
  { id: "audi", name: "Audi", file: "audi.svg", difficulty: "medium", wrong: ["BMW", "Volkswagen", "Mercedes-Benz"] },
  { id: "ferrari", name: "Ferrari", file: "ferrari.svg", difficulty: "medium", wrong: ["Lamborghini", "Porsche", "Maserati"] },
  { id: "porsche", name: "Porsche", file: "porsche.svg", difficulty: "medium", wrong: ["Ferrari", "Jaguar", "Alpine"] },
  { id: "pepsi", name: "Pepsi", file: "pepsi.svg", difficulty: "medium", wrong: ["Coca-Cola", "RC Cola", "Fanta"] },
  { id: "target", name: "Target", file: "target.svg", difficulty: "medium", wrong: ["Walmart", "Costco", "Kmart"] },
  { id: "chanel", name: "Chanel", file: "chanel.svg", difficulty: "medium", wrong: ["Dior", "Gucci", "Hermès"] },
  { id: "lv", name: "Louis Vuitton", file: "lv.svg", difficulty: "medium", wrong: ["Gucci", "Prada", "Fendi"] },
  { id: "rolex", name: "Rolex", file: "rolex.svg", difficulty: "hard", wrong: ["Omega", "Cartier", "Patek Philippe"] },
  { id: "starbucks", name: "Starbucks", file: "starbucks.svg", difficulty: "hard", wrong: ["Costa", "Nespresso", "Dunkin"] },
  { id: "playstation", name: "PlayStation", file: "playstation.svg", difficulty: "hard", wrong: ["Xbox", "Nintendo", "Sega"] },
  { id: "instagram", name: "Instagram", file: "instagram.svg", difficulty: "hard", wrong: ["Threads", "Snapchat", "Pinterest"] },
  { id: "tesla", name: "Tesla", file: "tesla.svg", difficulty: "hard", wrong: ["Rivian", "Lucid", "BMW"] },
  { id: "volkswagen", name: "Volkswagen", file: "volkswagen.svg", difficulty: "hard", wrong: ["Audi", "Opel", "Skoda"] }
];

const SHAPES = ["circle", "triangle", "diamond", "square", "hex"];
const SHAPE_LABEL = {
  circle: "Circle",
  triangle: "Triangle",
  diamond: "Diamond",
  square: "Square",
  hex: "Hexagon"
};
const PALETTE = ["#5B8CFF", "#FF4D7A", "#2EE59D", "#FFC44D", "#C084FC", "#F8FAFC"];

function createQuizQuest(room) {
  const item = pickUnused(room, QUIZ);
  return mcq(item.q, item.a, item.w, { category: "quiz" }, "quiz");
}

function createBrandQuest(room) {
  const round = room.round || 1;
  const want = round >= 6 ? "hard" : round >= 3 ? "medium" : "easy";
  let pool = BRANDS.filter((b) => b.difficulty === want);
  if (pool.every((b) => room.usedKeys?.has(b.id))) pool = BRANDS;
  const brand = pickUnused(room, pool);
  const answers = shuffle([brand.name, ...brand.wrong]);
  return {
    id: randomId(),
    type: "brands",
    question: "Identify the brand",
    answers,
    correctIndex: answers.indexOf(brand.name),
    phase: "play",
    extra: {
      brandId: brand.id,
      logo: `/brands/${brand.file}`,
      difficulty: brand.difficulty
    }
  };
}

function createMemoryQuest(room) {
  const len = randomInt(4, 5);
  const combo = Array.from({ length: len }, () => ({
    shape: SHAPES[randomInt(0, SHAPES.length - 1)],
    color: PALETTE[randomInt(0, PALETTE.length - 1)]
  }));
  const variant = randomInt(0, 2);
  const ordinals = ["first", "second", "third", "fourth", "fifth"];
  let question;
  let correct;
  let wrongs;

  if (variant === 0) {
    const pos = randomInt(0, len - 1);
    correct = SHAPE_LABEL[combo[pos].shape];
    wrongs = shuffle(SHAPES.filter((s) => s !== combo[pos].shape).map((s) => SHAPE_LABEL[s])).slice(0, 3);
    question = `Which shape was in ${ordinals[pos]} position?`;
  } else if (variant === 1) {
    const pos = randomInt(0, len - 1);
    correct = combo[pos].color;
    wrongs = shuffle(PALETTE.filter((c) => c !== correct)).slice(0, 3);
    question = `Which color was on the ${ordinals[pos]} symbol?`;
  } else {
    const shape = combo[randomInt(0, len - 1)].shape;
    const count = combo.filter((c) => c.shape === shape).length;
    correct = String(count);
    const set = new Set([correct]);
    while (set.size < 4) set.add(String(randomInt(0, len)));
    const answers = shuffle([...set]);
    return {
      id: randomId(),
      type: "memory",
      question: `How many ${SHAPE_LABEL[shape].toLowerCase()}s were shown?`,
      answers,
      correctIndex: answers.indexOf(correct),
      phase: "show",
      extra: { combo, showMs: 1800, visual: "shapes" }
    };
  }

  const answers = variant === 1 ? shuffle([correct, ...wrongs]) : shuffle([correct, ...wrongs]);
  return {
    id: randomId(),
    type: "memory",
    question,
    answers: variant === 1 ? answers : answers,
    correctIndex: answers.indexOf(correct),
    phase: "show",
    extra: {
      combo,
      showMs: 1800,
      visual: "shapes",
      colorAnswers: variant === 1
    }
  };
}

function createVisualQuest(room) {
  const kind = ["odd", "pattern", "color", "spot", "tap"][randomInt(0, 4)];

  if (kind === "color") {
    const colors = [
      { hex: "#3B82F6", name: "Blue" },
      { hex: "#EF4444", name: "Red" },
      { hex: "#22C55E", name: "Green" },
      { hex: "#EAB308", name: "Yellow" }
    ];
    const target = colors[randomInt(0, colors.length - 1)];
    const answers = shuffle(colors.map((c) => c.name));
    return {
      id: randomId(),
      type: "visual",
      question: "Match the color",
      answers,
      correctIndex: answers.indexOf(target.name),
      phase: "play",
      extra: { variant: "color", swatch: target.hex }
    };
  }

  if (kind === "pattern") {
    const patterns = [
      { seq: ["triangle", "circle", "triangle", "circle"], next: "triangle" },
      { seq: ["square", "square", "circle", "square"], next: "square" },
      { seq: ["diamond", "hex", "diamond", "hex"], next: "diamond" },
      { seq: ["circle", "triangle", "square", "circle"], next: "triangle" }
    ];
    const p = patterns[randomInt(0, patterns.length - 1)];
    const answers = shuffle([
      SHAPE_LABEL[p.next],
      ...shuffle(SHAPES.filter((s) => s !== p.next)).slice(0, 3).map((s) => SHAPE_LABEL[s])
    ]);
    return {
      id: randomId(),
      type: "visual",
      question: "What comes next?",
      answers,
      correctIndex: answers.indexOf(SHAPE_LABEL[p.next]),
      phase: "play",
      extra: { variant: "pattern", combo: p.seq.map((shape) => ({ shape, color: "#C9D4FF" })) }
    };
  }

  if (kind === "spot") {
    const left = ["circle", "triangle", "square", "diamond"];
    const right = ["circle", "triangle", "hex", "diamond"];
    const answers = shuffle(["Third shape", "First shape", "Last shape", "Nothing"]);
    return {
      id: randomId(),
      type: "visual",
      question: "What’s different?",
      answers,
      correctIndex: answers.indexOf("Third shape"),
      phase: "play",
      extra: {
        variant: "spot",
        left: left.map((shape) => ({ shape, color: "#D6E4FF" })),
        right: right.map((shape) => ({ shape, color: "#D6E4FF" }))
      }
    };
  }

  if (kind === "tap") {
    const delay = randomInt(900, 2200);
    const cells = Array.from({ length: 6 }, (_, i) => ({
      shape: SHAPES[i % SHAPES.length],
      color: "#334155"
    }));
    const active = randomInt(0, 5);
    return {
      id: randomId(),
      type: "visual",
      question: "Tap the highlighted shape",
      answers: cells.map((_, i) => String(i)),
      correctIndex: active,
      phase: "wait",
      extra: { variant: "tap", cells, active: -1 },
      goAt: Date.now() + delay,
      reactionWindow: 1800,
      revealActive: active
    };
  }

  const cells = Array.from({ length: 16 }, () => ({
    shape: "circle",
    color: "#5B8CFF"
  }));
  const odd = randomInt(0, 15);
  cells[odd] = { shape: "circle", color: "#7AA2FF" };
  if (Math.random() < 0.5) cells[odd] = { shape: "diamond", color: "#5B8CFF" };
  return {
    id: randomId(),
    type: "visual",
    question: "Find the odd one out",
    answers: cells.map((_, i) => String(i)),
    correctIndex: odd,
    phase: "play",
    extra: { variant: "odd", cells }
  };
}

function createQuest(room) {
  const theme = room.theme || "quiz";
  if (theme === "brands") return createBrandQuest(room);
  if (theme === "memory") return createMemoryQuest(room);
  if (theme === "visual") return createVisualQuest(room);
  return createQuizQuest(room);
}

function publicQuest(quest) {
  if (!quest) return null;
  const extra = { ...(quest.extra || {}) };
  if (quest.type === "memory" && quest.phase !== "show") delete extra.combo;
  if (quest.type === "visual" && extra.variant === "tap" && quest.phase !== "go") {
    extra.active = -1;
  }
  if (quest.type === "visual" && extra.variant === "tap" && quest.phase === "go") {
    extra.active = quest.revealActive;
  }
  const view = {
    id: quest.id,
    type: quest.type,
    question: quest.question,
    answers: quest.answers,
    phase: quest.phase,
    extra
  };
  if (quest.type === "visual" && (extra.variant === "odd" || extra.variant === "tap")) {
    view.answers = [];
  }
  return view;
}

module.exports = {
  THEMES,
  BRANDS,
  createQuest,
  publicQuest,
  shuffle,
  randomInt
};
