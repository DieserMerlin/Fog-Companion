export enum Killer {
  TRAPPER = 'TRAPPER',
  WRAITH = 'WRAITH',
  HILLBILLY = 'HILLBILLY',
  NURSE = 'NURSE',
  SHAPE = 'SHAPE',
  HAG = 'HAG',
  DOCTOR = 'DOCTOR',
  CANNIBAL = 'CANNIBAL',
  HUNTRESS = 'HUNTRESS',
  NIGHTMARE = 'NIGHTMARE',
  PIG = 'PIG',
  CLOWN = 'CLOWN',
  SPIRIT = 'SPIRIT',
  LEGION = 'LEGION',
  PLAGUE = 'PLAGUE',
  GHOSTFACE = 'GHOSTFACE',
  DEMOGORGON = 'DEMOGORGON',
  ONI = 'ONI',
  DEATHSLINGER = 'DEATHSLINGER',
  EXECUTIONER = 'EXECUTIONER',
  BLIGHT = 'BLIGHT',
  TWINS = 'TWINS',
  TRICKSTER = 'TRICKSTER',
  NEMESIS = 'NEMESIS',
  CENOBITE = 'CENOBITE',
  ARTIST = 'ARTIST',
  ONRYO = 'ONRYO',
  DREDGE = 'DREDGE',
  MASTERMIND = 'MASTERMIND',
  KNIGHT = 'KNIGHT',
  SKULL_MERCHANT = 'SKULL_MERCHANT',
  SINGULARITY = 'SINGULARITY',
  XENOMORPH = 'XENOMORPH',
  GOOD_GUY = 'GOOD_GUY',
  UNKNOWN = 'UNKNOWN',
  LICH = 'LICH',
  DARK_LORD = 'DARK_LORD',
  HOUNDMASTER = 'HOUNDMASTER',
  GHOUL = 'GHOUL',
  ANIMATRONIC = 'ANIMATRONIC',
  KRASUE = 'KRASUE',
}

export enum KillerDetectionCertainty {
  BLIND_GUESS = 0,
  UNCERTAIN = 30,
  CERTAIN = 60,
  CONFIRMED = 90,
}

export type KillerDetection = {
  name: Killer;
  start?: { m1?: true, m2?: true, label?: string };
  detect: {
    names?: string[],

    // Unique power labels for reliable killer identification
    powerLabel?: string[],
    
    // Helper labels for confirming menu guesses. Can be used for ambiguous labels.
    confirmPowerLabel?: string[],
  }
}

export const DetectableKillers: KillerDetection[] = [
  {
    name: Killer.TRAPPER, detect: {
      names: ["THE TRAPPER", "NAUGHTY BEAR"],
      powerLabel: ['SET TRAP']
    }
  },
  {
    name: Killer.WRAITH, detect: {
      names: ["THE WRAITH"],
      powerLabel: ['CLOAK', 'UNCLOAK']
    }
  },
  {
    name: Killer.HILLBILLY, detect: {
      names: ["THE HILLBILLY"],
      confirmPowerLabel: ['USE CHAINSAW']
    }
  },
  {
    name: Killer.NURSE, detect: {
      names: ["THE NURSE"],
      powerLabel: ['BLINK']
    }, start: { m2: true, label: "BLINK (M2)" }
  },
  {
    name: Killer.SHAPE, detect: {
      names: ["THE SHAPE"],
      confirmPowerLabel: ['STALK'],
      powerLabel: ['PURSUER MODE', "STALKER MODE", "CHARGE SLAUGHTERING STRIKE"]
    }
  },
  {
    name: Killer.HAG, detect: {
      names: ["THE HAG"],
      powerLabel: ['PLACE TRAP']
    }
  },
  {
    name: Killer.DOCTOR, detect: {
      names: ["THE DOCTOR", "PHARAOH EDDIE", "THE LOOK-SEE"],
      powerLabel: ['STATIC BLAST', 'SHOCK THERAPY']
    }
  },
  {
    name: Killer.CANNIBAL, detect: {
      names: ["THE CANNIBAL"],
      confirmPowerLabel: ['USE CHAINSAW'],
      powerLabel: ['EXTEND CHAINSAW SWEEP']
    }
  },
  {
    name: Killer.HUNTRESS, detect: {
      names: ["THE HUNTRESS", "THE MORDEO", "WERE-ELK"],
      powerLabel: ['THROW HATCHET']
    }
  },
  {
    name: Killer.NIGHTMARE, detect: {
      names: ["THE NIGHTMARE"],
      confirmPowerLabel: ['TELEPORT'],
      powerLabel: ['SWITCH TO SNARE', 'SWITCH TO PALLET', 'CHARGE DREAM SNARE', 'PALLET FOCUS']
    }
  },
  {
    name: Killer.PIG, detect: {
      names: ["THE PIG"],
      confirmPowerLabel: ['CROUCH', 'STAND UP'],
      powerLabel: ['(HOLD) AMBUSH']
    }
  },
  {
    name: Killer.CLOWN, detect: {
      names: ["THE CLOWN"],
      confirmPowerLabel: ['SWAP (TAP)', 'RELOAD(HOLD)'],
      powerLabel: ['THROW BOTTLE']
    }
  },
  {
    name: Killer.SPIRIT, detect: {
      names: ["THE SPIRIT", "TOMIE"],
      powerLabel: ['PHASE WALK']
    }
  },
  {
    name: Killer.LEGION, detect: {
      names: ["THE LEGION", "HUNK"],
      powerLabel: ['FRENZY', 'END FRENZY']
    }
  },
  {
    name: Killer.PLAGUE, detect: {
      names: ["THE PLAGUE"],
      powerLabel: ['VILE PURGE', 'CORRUPT PURGE']
    }
  },
  {
    name: Killer.GHOSTFACE, detect: {
      names: ["THE GHOST FACE"],
      confirmPowerLabel: ['STALK', 'LEAN AND STALK'],
      powerLabel: ['STEALTH MODE']
    }
  },
  {
    name: Killer.DEMOGORGON, detect: {
      names: ["THE DEMOGORGON"],
      powerLabel: ["CHANNEL ABYSS", "OPEN PORTAL"]
    }
  },
  {
    name: Killer.ONI, detect: {
      names:
        ["THE ONI", "MURDEROUS GRIZZLY", "SAMURAI EDDIE"],
      powerLabel: ["ABSORB", "BLOOD FURY", "DEMON DASH", "DEMON STRIKE"]
    }
  },
  {
    name: Killer.DEATHSLINGER, detect: {
      names: ["THE DEATHSLINGER", "STRANGER EDDIE"],
      powerLabel: ["AIM DOWN SIGHTS"]
    }
  },
  {
    name: Killer.EXECUTIONER, detect: {
      names: ["THE EXECUTIONER"],
      powerLabel: ["RITES OF JUDGMENT"]
    }
  },
  {
    name: Killer.BLIGHT, detect: {
      names: ["THE BLIGHT", "WILLIAM BURKIN"],
      powerLabel: ['RUSH']
    }, start: { m2: true, label: "RUSH (M2)" }
  },
  {
    name: Killer.TWINS, detect: {
      names: ["THE TWINS"],
      powerLabel: ["UNBIND VICTOR", "CONTROL CHARLOTTE", "CHARGE POUNCE"]
    }
  },
  {
    name: Killer.TRICKSTER, detect: {
      names: ["THE TRICKSTER"],
      powerLabel: ["AIM BLADE", "MAIN EVENT"]
    }
  },
  {
    name: Killer.NEMESIS, detect: {
      names: ["THE NEMESIS"],
      powerLabel: ["CHARGE TENTACLE STRIKE"]
    }
  },
  {
    name: Killer.CENOBITE, detect: {
      names: ["THE CENOBITE", "CHATTERER"],
      powerLabel: ["CREATE GATEWAY", "CLOSE GATEWAY"]
    }
  },
  {
    name: Killer.ARTIST, detect: {
      names: ["THE ARTIST", "BOULET ARTIST", "MISS FUCHI", "THE LESHEN"],
      powerLabel: ["LAUNCH", "BIRDS OF TORMENT"]
    }
  },
  {
    name: Killer.ONRYO, detect: {
      names: ["THE ONRYO"],
      powerLabel: ["MANIFEST", "DEMANIFEST"]
    }
  },
  {
    name: Killer.DREDGE, detect: {
      names: ["THE DREDGE", "EDDIE'S TRIBUTE"],
      powerLabel: ["CHARGE TELEPORT", "RETURN TO REMNANT"]
    }
  },
  {
    name: Killer.MASTERMIND, detect: {
      names: ["THE MASTERMIND"],
      powerLabel: ["CHARGE BOUND", "TRIGGER BOUND"]
    }
  },
  {
    name: Killer.KNIGHT, detect: {
      names: ["THE KNIGHT"],
      powerLabel: ["SUMMON GUARD"]
    }
  },
  {
    name: Killer.SKULL_MERCHANT, detect: {
      names: ["THE SKULL MERCHANT"],
      powerLabel: ["DEPLOY DRONE", "INSPECT RADAR"]
    }
  },
  {
    name: Killer.SINGULARITY, detect: {
      names: ["THE SINGULARITY"],
      powerLabel: ["CHARGE BIOPOD", "LAUNCH BIOPOD"]
    }
  },
  {
    name: Killer.XENOMORPH, detect: {
      names: ["THE XENOMORPH", "XENOMORPH QUEEN"],
      powerLabel: ["TAIL ATTACK", "HIGHLIGHT CONTROL STATION"]
    }
  },
  {
    name: Killer.GOOD_GUY, detect: {
      names: ["THE GOOD GUY", "THE GOOD GAL"],
      powerLabel: ["ENTER HIDEY", "EXIT HIDEY", "SLICE & DICE"]
    }
  },
  {
    name: Killer.UNKNOWN, detect: {
      names: ["THE UNKNOWN"],
      confirmPowerLabel: ["TELEPORT"],
      powerLabel: ["CHARGE UVX"]
    }
  },
  {
    name: Killer.LICH, detect: {
      names: ["THE LICH"],
      powerLabel: ["VILE DARKNESS", "CAST FLY", "CAST FLIGHT OF THE DAMNED", "CAST DISPELLING SPHERE", "CAST MAGE HAND"]
    }
  },
  {
    name: Killer.DARK_LORD, detect: {
      names: ["THE DARK LORD", "TRUE FORM"],
      powerLabel: ["SHAPESHIFT", "CHARGE HELLFIRE", "CHARGE POUNCE"]
    }
  },
  {
    name: Killer.HOUNDMASTER, detect: {
      names: ["THE HOUNDMASTER", "ULTIMATE HOUNDMASTER"],
      powerLabel: ["SWITCH COMMAND", "CHASE", "CHASE COMMAND", "REDIRECT CHASE", "SEARCH COMMAND"]
    }
  },
  {
    name: Killer.GHOUL, detect: {
      names: ["THE GHOUL"],
      powerLabel: ["CHARGE KAGUNE LEAP"]
    }
  },
  {
    name: Killer.ANIMATRONIC, detect: {
      names: ["THE ANIMATRONIC"],
      powerLabel: ["READY AIM", "THROW AXE"]
    }
  },
  {
    name: Killer.KRASUE, detect: {
      names: ["THE KRASUE"],
      powerLabel: ["CHARGE REGURGITATE", "HEAD FORM", "HEADLONG FLIGHT", "BODY FORM"]
    }
  },
]