import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MoneyText } from "./components/MoneyText";
import { App } from "./App";

describe("Web UI components", () => {
  it("renders MoneyText with BRL formatting and privacy blur", () => {
    const { rerender } = render(<MoneyText cents={150050} privacyMode={false} />);
    expect(screen.getByText(/1\.500,50/)).toBeInTheDocument();

    rerender(<MoneyText cents={150050} privacyMode={true} />);
    expect(screen.getByText(/1\.500,50/)).toHaveClass("privacy-blur");
  });

  it("renders AuthPage when unauthenticated", () => {
    localStorage.clear();
    render(<App />);
    expect(screen.getByText("FinFlow")).toBeInTheDocument();
    expect(screen.getByText("Entrar no FinFlow")).toBeInTheDocument();
  });
});
