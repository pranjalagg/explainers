# Keyboard switches: research notes

Notes gathered before building the figure. Each claim says where it came from. Anything the sources do not give is marked **illustrative** and is labelled the same way in `model.mjs`, so the figure never states more than the evidence supports.

## The question the figure answers

Every key has to do two jobs, and the two jobs are done by different parts:

1. **Feel.** Resist the finger with a particular force curve (force against travel).
2. **Sense.** Tell the controller the key is down, by some physical effect.

Families differ in how they do each job. The figure puts seven of them on one bench and presses each with the same probe, so the two jobs can be compared directly.

## The seven specimens

### 1. Linear, metal leaf (Cherry MX Red class)
- A plastic stem slides in a two-part housing. A coil spring is the only thing that resists. Nothing else changes the force, so the curve is a straight line. [Corsair](https://www.corsair.com/us/en/explorer/gamer/keyboards/key-switch-types-101/), [MonsGeek](https://monsgeek.eu/blogs/guide/keyboard-switch-types-linear-vs-tactile-vs-clicky)
- Sensing: the stem pushes a moving metal leaf against a fixed one, closing a circuit. The contact is a gold crosspoint. [Cherry](https://www.cherry.de/en-us/product/mx2a-blue), [Wikipedia: Keyboard technology](https://en.wikipedia.org/wiki/Keyboard_technology)
- Numbers: 45 cN at the actuation point, 2.0 mm pre-travel, 4.0 mm total travel ([Cherry](https://www.cherry.de/en-gb/company/news/cherry-blog/article/cherry-mx-switches-at-a-glance)). Bottom-out is roughly 75 cN ([MKB Guide](https://mkbguide.com/blog/switch-actuation-force-explained-understanding-gram-weight-2026)); the figure draws the spring as a straight line through those two published points, so its force at zero travel (15 cN) is extrapolated.
- Contacts bounce on closing: about 5 ms in 1985, under 1 ms for current Cherry parts ([Deskthority](https://deskthority.net/wiki/Cherry_MX)). The keyboard's firmware has to debounce the signal ([Wikipedia](https://en.wikipedia.org/wiki/Keyboard_technology#Debouncing)).

### 2. Tactile (Cherry MX Brown class)
- Same housing, leaves and spring. The stem has a ramp that rides over a ridge in the housing, so force rises above the spring line and then falls: the bump. The actuation point sits on the bump. [Corsair](https://www.corsair.com/us/en/explorer/gamer/keyboards/key-switch-types-101/), [Das Keyboard](https://www.daskeyboard.com/blog/cherry-mx-switches/)
- Numbers: 55 cN, 2.0 mm pre-travel, 4.0 mm total ([Cherry](https://www.cherry.de/en-gb/company/news/cherry-blog/article/cherry-mx-switches-at-a-glance)).
- A tactile switch does not have to be loud; the bump is a force event, not a sound. [MonsGeek](https://monsgeek.eu/blogs/guide/keyboard-switch-types-linear-vs-tactile-vs-clicky)
- **Illustrative:** the exact position and width of the bump (centred near 1.8 mm).

### 3. Clicky, click jacket (Cherry MX Blue class)
- Adds a two-piece slider. A sleeve (the click jacket or collar) is held by the stem and then released; it snaps down and strikes the switch, giving both the force drop and the sound. On release it is pulled back up by the stem. [Deskthority](https://deskthority.net/wiki/Cherry_MX): "fires the click collar downwards on passing the actuation point"
- Other clicky designs exist (click bar, click leaf), which use spring steel instead of a jacket. [RTINGS](https://www.rtings.com/keyboard-switch/reviews/best/clicky)
- Numbers: 60 cN ([Deskthority](https://deskthority.net/wiki/Cherry_MX)), 4.0 mm total ([Cherry](https://www.cherry.de/en-us/product/mx2a-blue)). The 2.2 mm click point comes from retailer guides only (for example [Angry Miao](https://store.angrymiao.com/blogs/insider-stories/mechanical-keyboard-switch-types)), so treat it as approximate.
- **Illustrative:** the size of the force drop at the click and the release click position.

### 4. Optical
- Same stem-and-spring layout, but no metal contacts. An infrared LED shines across the switch to a photodiode; a flag on the stem moves into the beam. [Keychron](https://www.keychron.com/blogs/news/the-difference-between-optical-switches-and-mechanical-switches), [Wikipedia](https://en.wikipedia.org/wiki/Keyboard_technology#Optical)
- Because no contacts touch, there is no bounce, and no moving electrical parts wear out. Vendors rate such switches at 100 million keystrokes or more. [Windows Central](https://www.windowscentral.com/accessories/keyboards/keyboard-switches-explained-what-to-buy)
- **Illustrative:** 1.5 mm actuation and a linear spring of about 45 cN; no specific product is claimed.

### 5. Hall effect (magnetic)
- A magnet in the stem moves toward a Hall sensor on the circuit board. The sensor's output is proportional to the magnetic field at its position, so the board knows the stem's position continuously, not just whether a threshold was crossed. [Wooting](https://wooting.io/post/what-are-hall-effect-keyboard-switches), [Wikipedia](https://en.wikipedia.org/wiki/Keyboard_technology#Hall_effect)
- Because position is known, the actuation point is a software setting (0.1 to 4.0 mm), and **Rapid Trigger** is possible: release is detected as soon as the key moves up by a small distance from the lowest point reached, not when it crosses a fixed reset point. [Wikipedia](https://en.wikipedia.org/wiki/Keyboard_technology#Hall_effect), [Windows Central](https://www.windowscentral.com/accessories/keyboards/keyboard-switches-explained-what-to-buy) (resets after as little as 0.1 mm)
- No contacts, so no bounce and no ghosting. [Deskthority](https://deskthority.net/wiki/Rollover,_blocking_and_ghosting)
- **Illustrative:** the field law. A dipole's on-axis field falls roughly with the cube of distance; the figure uses `B = 1 / (1 + gap / 1 mm)^3`, normalised to the travel range. Spring force is linear and not tied to a product.

### 6. Topre (electrostatic capacitive)
- A rubber dome with a conical coil spring. The dome provides almost all the resistance and the tactile collapse; the spring itself supplies only about 5 cN. [MKB Guide](https://mkbguide.com/blog/switch-actuation-force-explained-understanding-gram-weight-2026), [Ars Technica](https://arstechnica.com/gadgets/2024/03/the-ars-technica-guide-to-keyboards-mechanical-membrane-and-buckling-springs/)
- Sensing: the switch is non-contact. As the spring is pressed toward the circuit board, the capacitance between the board's electrodes changes, and the controller compares it with a threshold. The point where it registers cannot be felt: there is no secondary bump. [MKB Guide, Topre deep dive](https://mkbguide.com/blog/hhkb-topre-keyboards-deep-dive), [Wikipedia](https://en.wikipedia.org/wiki/Keyboard_technology#Capacitive)
- Numbers: about 4.0 mm total travel (3.8 mm with the silencing ring), actuating between 2.0 and 2.3 mm ([Geekhack](https://geekhack.org/index.php?topic=96653.0)). Sources disagree: another guide says 2.2 to 3.0 mm. The figure uses 2.2 mm and a 45 g dome. Rated 50 million keypresses ([HHKB](https://hhkeyboard.us/resources/features/best-topre-mechanical-keyboards)).
- Origin: designed by a Topre engineer in the late 1970s, inspired by a Japanese mosquito coil. [Wikipedia: Topre](https://en.wikipedia.org/wiki/Topre)
- **Illustrative:** the dome's force curve (rise to a peak near 1.5 mm, collapse to a trough, rise again). The sources say the force curve is wave-like and the resistance is concentrated at the top of the press; the exact numbers are drawn, not measured.

### 7. Buckling spring (IBM Model F and Model M)
- A long coil spring is held between the keycap stem and a pivoting plate (the hammer, flipper or rocker), inside a barrel. Pressed, the spring first resists like a column, then buckles sideways at a critical load. At that instant force falls sharply, the hammer is thrown forward, and the spring strikes the barrel (the click). [Wikipedia: Buckling spring](https://en.wikipedia.org/wiki/Buckling_spring), [Admiral Shark](https://sharktastica.co.uk/wiki/ibm-buckling-spring)
- Sensing: in the Model F the hammer changes capacitance over a circuit board; in the Model M it presses a membrane contact. Patents: US 4,118,611 (1978, capacitive), US 4,528,431 (Model M). [Wikipedia: Buckling spring](https://en.wikipedia.org/wiki/Buckling_spring)
- Numbers: 3.8 mm total travel (membrane type), 4.2 mm and about 75.6 gf peak force (capacitive type). Actuation and tactility coincide, and the key keeps moving after the buckle, so the finger can decelerate before bottoming out. [Admiral Shark](https://sharktastica.co.uk/wiki/ibm-buckling-spring), [Unicomp](https://www.pckeyboard.com/page/category/UKBD)
- The Model M was designed to cost about half what the Model F did. [Wikipedia: Model M](https://en.wikipedia.org/wiki/Model_M_keyboard)
- Because the Model M sensor is a membrane, it cannot carry diodes, so it is limited to two-key rollover. [Deskthority](https://deskthority.net/wiki/Rollover,_blocking_and_ghosting)
- **Illustrative:** the buckle at 2.2 mm and the exact shape of the force drop. The figure draws the Model M (membrane) variant.

## Not on the bench, but worth knowing

- **Rubber dome over membrane** is the most common keyboard design made today. A dome collapses onto a three-layer membrane (contact traces on top and bottom, an insulating spacer with a hole between). Scissor keys add crossed plastic arms and cut travel to roughly 1 to 2.5 mm. [Wikipedia](https://en.wikipedia.org/wiki/Keyboard_technology#Membrane), [Ars Technica](https://arstechnica.com/gadgets/2024/03/the-ars-technica-guide-to-keyboards-mechanical-membrane-and-buckling-springs/)
- **Reed** switches close a glass-encased contact with a magnet (invented 1936). [Wikipedia](https://en.wikipedia.org/wiki/Keyboard_technology#Reed)
- **Key matrix.** Keys are wired in a grid so a full keyboard needs only rows plus columns of wires. The controller drives one column at a time and reads the rows. With three keys down at the corners of a rectangle, current can flow backwards through the third and a fourth, unpressed key appears to be down (ghosting). A diode in series with each switch stops that, giving n-key rollover. Boards that cannot carry diodes block a third key instead (two-key rollover). Capacitive and Hall switches have no current path, so they are immune. [Deskthority](https://deskthority.net/wiki/Rollover,_blocking_and_ghosting), [QMK](https://docs.qmk.fm/how_a_matrix_works)

## Source quality

- Strong: Cherry's own pages, Deskthority, the Wikipedia articles, Admiral Shark's Keyboards, Unicomp, RTINGS.
- Mixed: retailer guides (MonsGeek, Corsair, MKB Guide, Windows Central). Where they disagreed with each other (Topre actuation depth, Speed Silver actuation) the figure uses the more conservative figure and says so.
- A DEV Community comparison table gave lifetimes and debounce figures with no citations, so none of its numbers are used.
- Two page fetches returned nothing useful (Wooting's Rapid Trigger detail, one Topre page); the Rapid Trigger behaviour is taken from Wikipedia and Windows Central instead.

## What the model does with this

`model.mjs` holds, for each switch, a pressing force curve and a releasing force curve (two lines, so the hysteresis loop is visible), a sensing rule, and the numbers above. `node model.mjs --check` prints a table that compares each curve's force at the actuation point with the published rating, so the figure and the sources cannot drift apart silently. The drawing reads its positions from the same model.
