"use strict";
// The entry file of your WebAssembly module.
import Z80 from "../Z80/Z80";

export function add(a: number, b: number): number {
  return a + b;
}
export function CreateZ80():Z80 {
  return new Z80({});
}
