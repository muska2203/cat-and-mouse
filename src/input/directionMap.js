const DIR_BY_DELTA = {
  "0:-1": "up",
  "0:1": "down",
  "-1:0": "left",
  "1:0": "right",
  "-1:-1": "up_left",
  "1:-1": "up_right",
  "-1:1": "down_left",
  "1:1": "down_right",
};

export function resolveDirectionByDelta(dx, dy) {
  return DIR_BY_DELTA[`${dx}:${dy}`] || null;
}
