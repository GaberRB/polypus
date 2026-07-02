export function sum(arr) {
  return arr.reduce((acc, x) => acc + x, 0);
}

export function mean(arr) {
  return sum(arr) / arr.length;
}
