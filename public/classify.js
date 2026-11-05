// Product → store category classifier, shared by the Worker (imports) and the admin (Auto-sort).
// Scores keywords in the title (strong) and CJ category / description (weaker). Returns null when unsure.
const K = {
  pets: {
    strong: ["pet", "pets", "dog", "dogs", "puppy", "cat", "cats", "kitten", "kitty", "leash", "harness for dog", "collar", "litter", "aquarium", "fish tank", "bird cage", "hamster", "rabbit cage", "chew toy", "scratching", "pet bed", "dog bed", "cat tree", "paw", "grooming glove", "pet hair", "kennel", "feeder", "pooper"],
    weak: ["animal", "fur", "bark", "claw"],
  },
  "toys-kids": {
    strong: ["toy", "toys", "kid", "kids", "child", "children", "baby", "babies", "infant", "toddler", "newborn", "stroller", "pacifier", "diaper", "nursery", "lego", "building blocks", "puzzle", "plush", "stuffed", "doll", "dolls", "rc car", "remote control car", "drone toy", "fidget", "slime", "teether", "bib", "crib", "montessori", "educational", "kids' ", "boys", "girls"],
    weak: ["game", "play", "cartoon", "cute", "student", "school"],
  },
  automotive: {
    strong: ["car", "cars", "auto", "automotive", "vehicle", "truck", "motorcycle", "motorbike", "scooter", "bike light", "windshield", "sunshade", "dashboard", "dash cam", "dashcam", "steering wheel", "seat cover", "car seat", "tire", "tyre", "jump starter", "obd", "license plate", "wiper", "headlight", "car mount", "car charger", "car vacuum", "car wash", "car cleaning", "air freshener car", "trunk organizer", "parking", "rearview", "rear view", "tire inflator", "air pump", "car phone holder", "car holder", "car cover", "car air", "car accessories", "jump start"],
    weak: ["drive", "driving", "driver", "garage"],
  },
  "beauty-health": {
    strong: ["beauty", "makeup", "make-up", "cosmetic", "cosmetics", "lipstick", "lip gloss", "mascara", "eyeliner", "eyeshadow", "foundation", "concealer", "skincare", "skin care", "serum", "moisturizer", "cream", "lotion", "face mask", "facial", "acne", "wrinkle", "anti-aging", "hair", "wig", "wigs", "hair dryer", "straightener", "curling", "curler", "shampoo", "nail", "nails", "manicure", "pedicure", "perfume", "fragrance", "massager", "massage", "health", "posture", "knee brace", "back brace", "toothbrush", "teeth", "whitening", "razor", "shaver", "trimmer", "epilator", "eyelash", "lashes", "brow", "blackhead", "pore", "spa", "essential oil", "aromatherapy", "sunscreen", "tweezers", "comb", "hairbrush", "scalp", "body care", "foot care", "slimming", "weight loss", "thermometer", "blood pressure", "pill box", "first aid", "bandage", "sleep mask", "ear plug"],
    weak: ["skin", "face", "body", "relax", "pain", "wellness", "care"],
  },
  "sports-outdoors": {
    strong: ["sport", "sports", "fitness", "gym", "workout", "exercise", "yoga", "pilates", "dumbbell", "kettlebell", "resistance band", "jump rope", "skipping rope", "treadmill", "camping", "camp", "tent", "hiking", "trekking", "fishing", "fish lure", "lure", "bait", "hunting", "cycling", "bicycle", "bike", "running", "swim", "swimming", "goggles", "surf", "ski", "snowboard", "golf", "tennis", "badminton", "basketball", "football", "soccer", "baseball", "volleyball", "boxing", "climbing", "outdoor", "outdoors", "backpack", "sleeping bag", "hammock", "flashlight", "headlamp", "lantern", "compass", "water bottle", "sports bottle", "tactical", "survival", "binoculars", "picnic", "beach"],
    weak: ["training", "muscle", "travel", "portable", "waterproof"],
  },
  fashion: {
    strong: ["dress", "dresses", "shirt", "t-shirt", "tshirt", "tee", "blouse", "top", "tops", "sweater", "hoodie", "jacket", "coat", "jeans", "pants", "trousers", "shorts", "skirt", "leggings", "jumpsuit", "romper", "cardigan", "vest", "suit", "lingerie", "bra", "underwear", "panties", "boxer", "briefs", "pajama", "pajamas", "sleepwear", "socks", "stockings", "swimsuit", "bikini", "swimwear", "shoe", "shoes", "sneaker", "sneakers", "boots", "sandals", "slippers", "heels", "loafers", "handbag", "bag", "bags", "purse", "wallet", "tote", "clutch", "crossbody", "shoulder bag", "jewelry", "jewellery", "necklace", "bracelet", "earring", "earrings", "ring", "rings", "pendant", "anklet", "brooch", "sunglasses", "eyeglasses", "hat", "cap", "beanie", "scarf", "gloves", "belt", "tie", "hair clip", "headband", "women's", "womens", "men's", "mens", "ladies", "fashion", "apparel", "clothing", "outfit", "cotton", "denim", "silk", "lace", "luggage", "suitcase"],
    weak: ["women", "men", "woman", "man", "wear", "style", "casual", "elegant", "vintage", "trendy", "slim fit", "loose"],
  },
  electronics: {
    strong: ["watch", "watches", "wristwatch", "watch band", "watch strap", "watchband", "electronic", "electronics", "phone", "smartphone", "iphone", "android", "samsung", "tablet", "ipad", "laptop", "computer", "pc", "keyboard", "mouse", "monitor", "usb", "usb-c", "type-c", "hdmi", "cable", "charger", "charging", "power bank", "powerbank", "mobile power", "battery", "wireless", "bluetooth", "earbuds", "earphone", "earphones", "headphone", "headphones", "headset", "speaker", "soundbar", "microphone", "mic", "camera", "webcam", "projector", "smartwatch", "smart watch", "fitness tracker", "led", "rgb", "smart home", "smart plug", "smart bulb", "router", "wifi", "adapter", "hub", "dock", "ssd", "hard drive", "memory card", "sd card", "flash drive", "gaming", "game controller", "gamepad", "console", "vr", "drone", "tripod", "selfie stick", "ring light", "phone case", "screen protector", "phone holder", "phone stand", "magsafe", "magnetic charger", "earbud", "tws", "anc", "electric", "digital", "gadget", "gadgets", "tech"],
    weak: ["smart", "power", "light", "lamp", "display", "screen", "sensor", "remote"],
  },
  "home-kitchen": {
    strong: ["home", "house", "household", "kitchen", "cooking", "cookware", "pan", "pot", "knife", "knives", "cutting board", "utensil", "spatula", "whisk", "peeler", "grater", "blender", "mixer", "kettle", "coffee", "tea", "mug", "cup", "cups", "glass", "bottle opener", "plate", "plates", "bowl", "bowls", "dish", "dishes", "tableware", "cutlery", "chopsticks", "lunch box", "food storage", "container", "baking", "bakeware", "oven", "air fryer", "toaster", "microwave", "fridge", "refrigerator", "spice", "seasoning", "jar", "storage", "organizer", "rack", "shelf", "hanger", "hook", "basket", "bin", "drawer", "closet", "wardrobe", "laundry", "cleaning", "cleaner", "mop", "broom", "vacuum", "duster", "sponge", "trash", "garbage", "bathroom", "shower", "toilet", "towel", "bath", "soap dispenser", "bedding", "bed sheet", "bedsheet", "sheet set", "duvet", "comforter", "quilt", "pillow", "pillowcase", "blanket", "mattress", "curtain", "curtains", "rug", "carpet", "mat", "doormat", "cushion", "sofa", "chair", "table", "desk", "furniture", "decor", "decoration", "wall art", "vase", "candle", "clock", "mirror", "photo frame", "garden", "gardening", "plant", "planter", "flower", "watering", "lawn", "patio", "tool", "tools", "screwdriver", "drill", "wrench", "tape measure", "ladder", "faucet", "sink", "humidifier", "diffuser", "fan", "heater", "night light", "lamp shade", "ultrasonic cleaner", "iron", "sewing", "needle", "umbrella", "insect", "mosquito", "pest"],
    weak: ["room", "bedroom", "living room", "wall", "door", "window", "daily use", "stainless steel", "wooden", "ceramic", "reusable", "cloth"],
  },
};

const norm = (s) => " " + String(s || "").toLowerCase().replace(/[^a-z0-9'\- ]+/g, " ").replace(/\s+/g, " ") + " ";
const hits = (text, word) => text.includes(" " + word + " ") || (word.includes(" ") && text.includes(word)) ? 1 : 0;

// Returns { id, score, runnerUp } or null. `allowed` = list of category ids that exist in the store.
// rules: [{ kw: "watch", cat: "electronics" }, …] set by the store owner — they always win.
export function classify({ title = "", category = "", description = "" }, allowed, rules = []) {
  const t = norm(title), c = norm(category), d = norm(String(description).slice(0, 400));
  for (const r of rules || []) {
    const kw = norm(r.kw).trim();
    if (kw && (!allowed || allowed.includes(r.cat)) && (t.includes(" " + kw + " ") || (kw.includes(" ") && t.includes(kw)) || t.includes(" " + kw + "s ")))
      return { id: r.cat, score: 99, runnerUp: 0, sure: true, rule: r.kw };
  }
  const scores = [];
  for (const [id, kw] of Object.entries(K)) {
    if (allowed && !allowed.includes(id)) continue;
    let s = 0;
    for (const w of kw.strong) s += hits(t, w) * 4 + hits(c, w) * 3 + hits(d, w) * 1;
    for (const w of kw.weak) s += hits(t, w) * 1 + hits(c, w) * 1;
    scores.push([id, s]);
  }
  // Specific phrases win over generic ones
  if (/ car (mount|holder|charger|phone|vacuum|seat|cover|wash|air|organizer|accessor)/.test(t) && scores.find((x) => x[0] === "automotive")) scores.find((x) => x[0] === "automotive")[1] += 6;
  if (/ (smart ?watch|watch(es)?|wristwatch|watch ?band|watch ?strap) /.test(t) && scores.find((x) => x[0] === "electronics")) scores.find((x) => x[0] === "electronics")[1] += 12;
  if (/ (dog|cat|pet) /.test(t) && scores.find((x) => x[0] === "pets")) scores.find((x) => x[0] === "pets")[1] += 6;
  if (/ (baby|kids?|children|toddler|infant) /.test(t) && scores.find((x) => x[0] === "toys-kids")) scores.find((x) => x[0] === "toys-kids")[1] += 4;
  scores.sort((a, b) => b[1] - a[1]);
  if (!scores.length || scores[0][1] < 3) return null;
  return { id: scores[0][0], score: scores[0][1], runnerUp: scores[1]?.[1] || 0, sure: scores[0][1] >= 6 && scores[0][1] - (scores[1]?.[1] || 0) >= 3 };
}
