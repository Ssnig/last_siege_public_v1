# Game Design Document (GDD): Asymmetric 1v1 Tower Defense

## 1. Core Overview

* **Genre:** Real-time, competitive asymmetric 1v1 tower defense
* **Platform:** Mobile browsers (room-code matchmaking)
* **Core Philosophy:** Strict role asymmetry where one player focuses on spatial defense and the other on economic pacing and unit deployment.

Before matches begin, both players secretly select a custom deck of towers or units in a blind drafting phase. Gameplay takes place across a small pool of shared, pre-designed maps featuring fixed building slots and predetermined paths.

---

## 2. Roles & Gameplay Loop

### The Defender
* **Primary Objective:** Build an impenetrable layout of towers on fixed slots, eliminate incoming threats, and survive until the Attacker is completely out of resources and units.
* **Gameplay Feel:** Tactical, reactive, and spatial. The Defender must constantly evaluate where enemy forces apply pressure, deciding whether to upgrade existing defenses, sell and reposition, or save funds for massive inter-wave bonuses.

### The Attacker
* **Primary Objective:** Overrun the Defender’s designated health points by successfully marching troops through the maze to the end point.
* **Gameplay Feel:** Strategic, pacing-oriented, and economic. The Attacker acts like a general managing a finite campaign, deciding when to deploy heavy main forces versus probing with smaller, flexible forces.

---

## 3. Win & Loss Conditions

The match continues until one of two definitive end-states is reached:

1. **Attacker Victory:** The Attacker successfully drains all of the Defender's specified health points by getting troops to the end point.
2. **Defender Victory:** The Attacker exhausts all of their limited big waves, depletes their resource reserves entirely, and leaves zero active troops remaining on the battlefield.

---

## 4. Resource Systems & Economy

Both players operate on distinct, complementary economies that reward smart timing and risk management over passive hoarding.

### Defender Economy
* **Starting Capital:** A modest initial amount of gold, forcing careful early placement.
* **Passive Income:** A steady, continuous trickle of resources over time.
* **Destruction Bounty:** Earning gold immediately whenever a defending tower eliminates an enemy mob.
* **Speed-Clear Bonus:** A performance-based payout awarded at the end of a wave, scaled higher based on how rapidly the defense wiped out the threat.
* **Inter-Wave Multiplier:** A bonus payout calculated from how long the previous wave survived on the map, rewarding the Defender for holding out against grueling, durable pushes.

### Attacker Economy
* **Starting Capital:** A substantial initial pool of resources, allowing for immediate strategic setups or early aggression.
* **Checkpoint Payouts:** Earning resources whenever deployed units successfully push past specific milestone markers along the path.
* **Wave Completion Refund:** A resource return triggered after an entire wave is fully sent and all units in that wave have perished, sustaining future attacks.
* **Survival Threshold Bonus:** Extra resources awarded if a deployed wave stays alive on the field longer than a designated time threshold.
* **Breach Payout:** A high-value reward granted whenever a unit successfully reaches the end point, simultaneously costing the Defender a health point.

---

## 5. Wave Structure & Mechanics

* **Big Waves (Limited Pool):** The Attacker has a strict, finite number of major waves available per match. Sending a big wave initiates the primary inter-wave economic cycle for the Defender and automatically spawns small mobs without requiring extra gold expenditure from the Attacker.
* **Mini Waves (Flexible & Optional):** Between big waves, the Attacker can choose to spend resources on smaller, variable mini-waves (or choose to send none at all). These are used to test defenses, probe cooldowns, or farm checkpoint income without triggering major defender bonuses.
* **Pathing & Constraints:** Mobs travel strictly along predefined tracks, and towers can only be constructed on designated slots, maintaining clean legibility on mobile screens.