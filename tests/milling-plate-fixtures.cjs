const mill = require("../milling-course-model.js");
const plate = mill.plate;

function attempt() {
  let state = plate.create();
  function act(action) {
    state = plate.transition(state, action);
    return state;
  }
  const setup = (key, value = true) => act({ type: "setup", key, value });
  const spindle = (value) => act({ type: "spindle", value });
  const move = (x, y, z, mode = "G0") => act({ type: "move", x, y, z, mode });
  function prepare() {
    setup("reference");
    setup("clamped");
    act({ type: "configure", zero: { x: 120, y: 80, z: 50 }, length: 50, diameter: 6 });
    act({ type: "verifySetup" });
    setup("door");
    spindle(true);
  }
  function lane(from, to, y, depth) {
    const { x, y: previousY } = state.position;
    move(x, previousY, 12);
    move(from, y, 12);
    move(from, y, -depth, "G1");
    move(to, y, -depth, "G1");
  }
  function stop() {
    move(state.position.x, state.position.y, 12);
    spindle(false);
    setup("door", false);
  }
  function measure(points = plate.task.checks) {
    for (const [x, y] of points) act({ type: "surface", x, y });
  }
  return { act, setup, spindle, move, prepare, lane, stop, measure, state: () => state };
}

function complete({ rightFirst = false, restarts = 0 } = {}) {
  const work = attempt();
  for (let i = 0; i < restarts; i++) work.act({ type: "restart" });
  work.prepare();
  const left = () => work.lane(-4, 22, 5, 1);
  const right = () => {
    work.lane(64, 36, 9, 1);
    work.lane(64, 36, 9, 2);
  };
  for (const area of rightFirst ? [right, left] : [left, right]) area();
  work.stop();
  work.measure();
  return work.act({ type: "confirm" });
}

module.exports = { attempt, complete };
