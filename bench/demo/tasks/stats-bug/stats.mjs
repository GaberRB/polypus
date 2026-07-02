import { sum, mean } from "./math.mjs";

export function variance(arr) {
  const m = mean(arr);
  return sum(arr.map((x) => x - m)) / arr.length;
}

export function stddev(arr) {
  return variance(arr);
}
