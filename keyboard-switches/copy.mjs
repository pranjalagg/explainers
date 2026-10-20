// The words. Every number that appears here is either read from the model or is one of the published figures
// listed in RESEARCH.md. Anything that is only drawn to fit is called illustrative.
import { SWITCHES, HALL, byId } from "./model.mjs";

const mm = (v) => `${v.toFixed(1)} mm`;

export const TEXT = {
  linear: {
    title: "Linear",
    class: "Cherry MX Red class",
    lede: "A plastic stem slides down inside a housing against a coil spring. Nothing else resists, so the force climbs in a straight line.",
    feel: "Only the spring pushes back, and a spring's force is proportional to how far you squash it. That makes the curve a straight line, with no bump to feel where the key registers. The small gap between the pressing line and the releasing line is friction.",
    sense: "A wedge on the stem's tail pushes a thin metal leaf into a second, fixed leaf. The gold contact between them closes the circuit. The controller reads it as a key press.",
    watch: "Drag down slowly. The leaf closes at 2.0 mm, with no change in how the key feels. Let go and it opens a little higher, at about 1.6 mm: the gap between making and breaking.",
    note: "Contacts bounce. For a few tenths of a millisecond they touch, part and touch again, so firmware has to ignore the chatter. See the trace under the figure.",
  },
  tactile: {
    title: "Tactile",
    class: "Cherry MX Brown class",
    lede: "The same switch with a bump. A ramp on the stem rides over a ridge in the housing, and you feel the force rise and then drop.",
    feel: "One of the stem's legs carries a small bump that has to squeeze past a ridge on the wall. The leg bends aside to let it through, and bending takes force, so the curve rises above the spring's line. After the crest the leg relaxes and the force falls away. The bump is about where the key registers.",
    sense: "The same pair of metal leaves as the linear switch. The bump is only for your finger: the leaves do not know it is there.",
    watch: "Watch the leg on the left sway sideways as it passes the ridge, at the same moment the force curve peaks.",
    note: "A tactile bump is a change in force, not a sound. These switches can be quiet.",
  },
  clicky: {
    title: "Clicky",
    class: "Cherry MX Blue class, click jacket",
    lede: "A loose sleeve called the click jacket is held up by the stem, then released. It falls onto the stem's shoulder, and that fall is the click.",
    feel: "The jacket rides down with the stem until the stem lets go of it. As it slips, the force you feel falls sharply, which is the second half of the bump. The sleeve hits its stop and makes the sound. On the way back up the stem pulls the sleeve up again, with a smaller, sharper tick.",
    sense: "The tail that closes the leaf belongs to the jacket, not the stem. So the circuit is made by the click itself: the contact closes at the moment the jacket falls, not before.",
    watch: "Press until just before 2.2 mm and nothing has closed. Cross it and the jacket drops in a few milliseconds, the leaf closes, and the force falls away.",
    note: "Other clicky switches make the sound with a thin steel bar or leaf instead of a jacket.",
  },
  optical: {
    title: "Optical",
    class: "Infrared beam, no contacts",
    lede: "No metal touches metal. A flag on the stem moves into an infrared beam, and a photodiode notices the light going out.",
    feel: "A spring and a stem, like the linear switch. The sensing adds nothing to the force, because light has no weight.",
    sense: "An infrared LED on one side shines at a photodiode on the other. The flag cuts off the light over about 0.7 mm of travel. The switch registers when half the light is gone, here at 1.5 mm.",
    watch: "Drag down and watch the beam fade as the flag enters it. The signal is smooth, and it crosses the threshold cleanly.",
    note: "With no contacts there is no bounce and nothing to wear out. The 1.5 mm figure, the spring and the beam geometry are illustrative, not a particular product.",
  },
  hall: {
    title: "Hall effect",
    class: "Magnet and field sensor",
    lede: "A magnet on the stem moves toward a sensor on the board. The sensor measures the field, so it knows how far down the key is at every moment.",
    feel: "Again a plain spring. The magnetic force is far too small to feel.",
    sense: "A Hall sensor outputs a voltage that follows the magnetic field, and the field grows sharply as the magnet closes in. Firmware turns that back into a depth. Because it knows the depth all the time, the actuation point is just a number you choose.",
    watch: "Turn on Rapid Trigger and press, then ease up by a third of a millimetre and press again, without ever coming back to the top. Each reversal registers. A fixed switch cannot do that.",
    note: "Rapid Trigger releases when the key has risen a set distance from its lowest point, rather than at a fixed reset point. The field law and the spring here are illustrative.",
  },
  topre: {
    title: "Topre",
    class: "Electrostatic capacitive",
    lede: "A rubber dome gives the feel and a conical spring does the sensing. Nothing touches: the switch notices a change in capacitance.",
    feel: "The dome resists, then gives way. Force climbs to a peak around 1.5 mm, the dome collapses and the force drops, then rises again near the bottom. The conical spring itself adds only about 5 cN, just enough to hold the key up.",
    sense: "The spring flattens toward two electrodes under a thin film on the circuit board. As the area close to the board grows, the capacitance rises, and the controller registers the key when it passes a threshold, around 2.2 mm. You cannot feel that point, because there is no bump there.",
    watch: "The dome buckles first, then the key registers a little later, on the way down the far side of the bump.",
    note: "Sources give the actuation depth anywhere from 2.0 to 3.0 mm. The figure uses 2.2 mm and draws the dome's force curve to fit published descriptions of its shape.",
  },
  buckling: {
    title: "Buckling spring",
    class: "IBM Model M, membrane version",
    lede: "A long spring is held between the key and a pivoting hammer. Push hard enough and the spring suddenly bows sideways, throws the hammer, and clicks.",
    feel: "A tall spring resists like a column: force climbs steeply until it reaches the critical load. Then it buckles. The force drops sharply as the spring bows out, and you feel it give, with the key still a little way from the bottom.",
    sense: "As the spring buckles it rocks the hammer forward onto a membrane. The hammer presses two sheets together, closing a contact. So the click, the drop in force and the electrical signal all happen at once.",
    watch: "Drag until the spring snaps sideways and hits the barrel. The hammer drops, the contact closes, and the force falls, all together.",
    note: "The Model F used the same spring over a capacitive board. The Model M's membrane cannot carry a diode for each key, so it blocks a third key rather than risk a false one.",
  },
};

export const FACTS = {
  linear: [["Actuates at", mm(byId.linear.act)], ["Force there", `${byId.linear.rated} cN`], ["Total travel", mm(byId.linear.travel)], ["Sensed by", "Metal leaves"]],
  tactile: [["Actuates at", mm(byId.tactile.act)], ["Force there", `${byId.tactile.rated} cN`], ["Total travel", mm(byId.tactile.travel)], ["Sensed by", "Metal leaves"]],
  clicky: [["Clicks at", "about 2.2 mm"], ["Force there", `${byId.clicky.rated} cN`], ["Total travel", mm(byId.clicky.travel)], ["Sensed by", "Metal leaves"]],
  optical: [["Actuates at", `${mm(byId.optical.act)} (illustrative)`], ["Force there", "about 45 cN"], ["Total travel", mm(byId.optical.travel)], ["Sensed by", "Light"]],
  hall: [["Actuates at", `you choose, ${mm(HALL.min)} to ${mm(HALL.max + 0.1)}`], ["Reset", "Rapid Trigger or fixed"], ["Total travel", mm(byId.hall.travel)], ["Sensed by", "Magnetic field"]],
  topre: [["Registers at", "about 2.2 mm"], ["Dome weight", "45 cN"], ["Total travel", "4.0 mm (3.8 with the silencer ring)"], ["Sensed by", "Capacitance"]],
  buckling: [["Buckles at", "about 2.2 mm"], ["Peak force", "about 75 cN"], ["Total travel", "3.8 mm (membrane)"], ["Sensed by", "Membrane contact"]],
};

export const COMPARE = SWITCHES.map((s) => ({ id: s.id, name: TEXT[s.id].title, feel: { linear: "Straight line", tactile: "Bump before the point", clicky: "Bump, then a drop and a click", optical: "Straight line", hall: "Straight line", topre: "Wave: peak, collapse, rise", buckling: "Steep rise, sharp drop" }[s.id], sense: { linear: "Metal leaves touch", tactile: "Metal leaves touch", clicky: "Metal leaves touch", optical: "Beam of light is cut", hall: "Field strength is measured", topre: "Capacitance rises", buckling: "Hammer closes a membrane" }[s.id], bounce: s.bounce ? "Yes, debounced in firmware" : "No contact to bounce" }));

export const HOW = [
  ["Every key has two jobs.", "It has to push back on your finger, and it has to tell the controller it has been pressed. The seven switches on the bench do the first job with a spring, a ramp, a jacket, a dome or a buckling coil. They do the second with metal, light, a magnet or an electric field. The two are separate, and you can see that by watching the force chart and the signal chart move at different moments."],
  ["The force curve is what you feel.", "It plots resistance against how far down the key is. A straight line is linear. A bump is tactile. A bump with a sudden drop is clicky. The line on the way down and the line on the way up never match, because of friction and because snaps happen at different points in each direction."],
  ["The signal is what the computer sees.", "Contacts give a step that bounces. Light and capacitance give smooth curves that firmware compares with a threshold. A magnet gives a curve of field strength that is turned back into a depth. Where the signal crosses its threshold is the actuation point, and it does not have to be where you feel anything."],
  ["The matrix finds out which key.", "A keyboard does not run a wire from every key. Keys sit at the crossings of a grid of rows and columns, and the controller drives one column at a time while reading the rows. With three keys down at the corners of a rectangle, current can sneak back through the third and a fourth key looks pressed. A diode in series with each switch, like the small black part on each board here, stops that. A membrane cannot carry diodes, so it blocks a third key instead. Capacitive and Hall switches pass no current and do not have the problem."],
];
