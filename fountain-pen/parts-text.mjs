// What each part is and why the pen needs it. The numbers are the ones the simulation uses.
import * as M from "./model.mjs";

const n0 = (v) => Math.round(v);
const n1 = (v) => (Math.round(v * 10) / 10).toString();
const expansion = (M.AIR_POCKET * 4) / 293;

export const ORDER_APART = ["nib", "feed", "section", "cartridge", "barrel", "cap"];

export const PARTS = {
  nib: {
    name: "Nib",
    role: "The part that touches the paper.",
    body: `A thin curved sheet of steel or gold with a slit down the middle, so it is really two springy halves called tines. The slit pulls ink to the tip, and it lets the tines spread under pressure, which is what widens the line.`,
    features: {
      slit: {
        name: "Slit",
        text: `Ink sits in the slit and is pulled toward the tip by capillary action. The pores of paper are far smaller (about 10 µm) and pull harder, ${n0(M.P_PAPER)} Pa against ${n0(M.P_INK)} Pa, so ink moves from the nib into the page as the nib drags across it. Press on the nib and the two tines spread: in this model each gram-force opens the slit by ${M.NIB.perGram} mm, up to ${M.NIB.maxSpread} mm.`,
      },
      breather: {
        name: "Breather hole",
        text: `The slit ends in a round hole. A sharp end would crack, so the hole spreads the stress. It is also where air gets in: the bubbles that replace used ink enter here and run back down the air channel.`,
      },
      tipping: {
        name: "Tipping",
        text: `A bead of very hard alloy welded to the end of the tines. Bare steel or gold would wear away on paper; the tipping lasts for years and is ground smooth so the nib glides. Its width, ${M.NIB.tipping} mm in this model, is the thinnest line the pen can make.`,
      },
      plate: {
        name: "Shoulders",
        text: `The curve gives the thin sheet its stiffness and lets the rear half of the nib sit snugly against the feed. The shoulders where it widens are where the tines pivot as they open.`,
      },
    },
    facts: [`Tipping ${M.NIB.tipping} mm`, `Slit opens ${M.NIB.perGram} mm per gf`, `Line ${M.NIB.tipping} to ${n1(M.NIB.tipping + M.NIB.maxSpread)} mm`],
  },
  feed: {
    name: "Feed",
    role: "The pen's plumbing.",
    body: `A moulded plastic or ebonite part tucked under the nib. It meters ink to the nib, lets air back into the cartridge, and keeps a small reserve of ink in hand.`,
    features: {
      inkchannel: {
        name: "Ink channel",
        text: `A groove only about ${M.FEED.inkGap} mm wide between the feed and the nib. Narrow gaps pull liquid by capillary action: 2γ/h gives about ${n0(M.P_INK)} Pa here, enough to draw ink forward even with the pen upright. It can deliver about ${M.FEED.supply} µL/s, and less as suction builds in the cartridge.`,
      },
      airchannel: {
        name: "Air channel",
        text: `A wider passage, about ${M.FEED.airGap} mm. A gap this wide hardly holds ink, so air gets in at only ${n0(M.P_AIR)} Pa. Each time the cartridge has lost about ${n1(M.BURP_VOLUME)} µL of ink the suction reaches that pressure, a bubble squeezes in at the breather hole and runs back to the cartridge, and the pressure resets. Without this passage the suction would grow until ink stopped flowing.`,
      },
      fins: {
        name: "Fins",
        text: `A comb of thin pockets, each open to the ink channel. They do two jobs. A reserve: the channel only delivers ${M.FEED.supply} µL/s, but a wide fast stroke asks for more, so the pockets hold about ${M.FEED.buffer} µL ready and refill whenever you pause. Without them a bold stroke runs dry in seconds. A catch basin: when the pen warms in your hand the air in the cartridge expands and pushes ink forward, about ${n1(expansion)} µL for a rise of 4 K. The pockets store it instead of letting it fall on the page as a blot. Try Remove the fins, then Warm the pen, on the rig above.`,
      },
      collector: {
        name: "Collector",
        text: `A small chamber at the back of the feed where ink arriving from the cartridge gathers before it enters the channel and the fins.`,
      },
      pin: {
        name: "Pin",
        text: `A hollow spike at the rear of the feed that pushes through the cartridge's plug. It has two passages: ink goes forward through one, and bubbles of air come back through the other.`,
      },
    },
    facts: [`Ink channel ${M.FEED.inkGap} mm`, `Air channel ${M.FEED.airGap} mm`, `Fins hold ${M.FEED.buffer} µL`],
  },
  section: {
    name: "Section",
    role: "Holds the nib and feed, and your fingers.",
    body: `The grip. The nib and feed are pressed into it with a friction fit, so a nib can be pulled out and replaced. The front is where you hold the pen; the rear has a thread that screws into the barrel.`,
    features: {
      grip: {
        name: "Walls",
        text: `The bore matches the nib and feed, so there is no gap for ink to creep into, and the walls are thick enough to be gripped for hours without flexing.`,
      },
      threads: {
        name: "Thread",
        text: `Joins the section to the barrel. Unscrewing it is how a cartridge is changed.`,
      },
    },
    facts: [`Friction fit`, `Threaded to the barrel`],
  },
  cartridge: {
    name: "Cartridge",
    role: "The ink reservoir.",
    body: `A sealed plastic tube of ink, about ${n1(M.CART_VOLUME / 1000)} mL here. A plug at its nose stays shut until the feed's pin pushes through it. The air above the ink is what makes the suction: as ink leaves, that air spreads out and its pressure falls.`,
    features: {
      ink: {
        name: "Ink",
        text: `Gravity keeps the ink low in the tube, around the pin, so the ink channel always has something to draw from. Water-based ink has a surface tension near ${M.INK.gamma * 1000} mN/m, which sets how hard narrow gaps pull on it.`,
      },
      air: {
        name: "Air pocket",
        text: `About ${n0((1 - M.CART.fill) * 100)}% of the cartridge, ${n0(M.AIR_POCKET)} µL. Ink cannot leave without this air getting thinner: its pressure times its volume stays constant, so ${n1(M.BURP_VOLUME)} µL of ink out lowers the pressure by ${n0(M.P_AIR)} Pa, just enough for a bubble to get in through the air channel.`,
      },
      plug: {
        name: "Plug",
        text: `Rubber, or a small ball, that seals the nose until the pin pierces it. It grips the pin so ink cannot leak around it.`,
      },
    },
    facts: [`${n1(M.CART_VOLUME / 1000)} mL`, `${n0(M.CART.fill * 100)}% ink`, `${n1(M.BURP_VOLUME)} µL per bubble`],
  },
  barrel: {
    name: "Barrel",
    role: "Holds the cartridge and screws onto the section.",
    body: `A hollow tube that protects the cartridge and keeps it seated on the pin. The trim ring covers the joint with the section.`,
    features: {
      bore: {
        name: "Bore",
        text: `Wider than the cartridge so it slides in easily, with just enough room for the cartridge to sit straight on the pin.`,
      },
      ring: {
        name: "Trim ring",
        text: `Hides the seam where barrel meets section and gives the thin front edge of the barrel some protection.`,
      },
    },
    facts: [`Threaded to the section`],
  },
  cap: {
    name: "End cap",
    role: "Closes the rear of the barrel.",
    body: `A pressed-in dome that seals the back of the barrel. On a pen filled by a converter instead of a cartridge, this is where the turning knob would be.`,
    features: {},
    facts: [`Pressed in`],
  },
};
