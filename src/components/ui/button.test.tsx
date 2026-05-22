import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("renders command text without layout-only wrappers", () => {
    render(<Button>Save look</Button>);

    expect(screen.getByRole("button", { name: "Save look" })).toBeInTheDocument();
  });
});
