import { describe, expect, it } from "vitest";
import {
  normalizeRutInput,
  parseRut,
  rutCartolaPassword,
} from "./rut";

describe("rut", () => {
  it("parses formatted RUT", () => {
    expect(parseRut("12.345.678-9")).toEqual({ body: "12345678", verifier: "9" });
  });

  it("derives BancoEstado cartola password from body", () => {
    expect(rutCartolaPassword("12.345.678-9")).toBe("5678");
    expect(rutCartolaPassword("18.202.300-0")).toBe("2300");
  });

  it("normalizes input for storage", () => {
    expect(normalizeRutInput("12.345.678-9")).toBe("12345678-9");
  });

  it("rejects invalid RUT", () => {
    expect(parseRut("abc")).toBeNull();
    expect(normalizeRutInput("no")).toBeNull();
  });
});
