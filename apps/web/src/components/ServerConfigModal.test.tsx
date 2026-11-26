import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getActiveApiBaseUrl } from "../lib/api";
import { ServerConfigModal } from "./ServerConfigModal";

describe("ServerConfigModal", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    delete window.finflowDesktop;
  });

  it("allows selecting a preset or custom local port and saves active API URL", async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();

    render(<ServerConfigModal open={true} onClose={onClose} onSaved={onSaved} />);

    fireEvent.click(screen.getByRole("button", { name: "8080" }));
    expect(screen.getByText("http://127.0.0.1:8080")).toBeInTheDocument();

    const input = screen.getByLabelText("Porta do Servidor Local");
    fireEvent.change(input, { target: { value: "5050" } });
    expect(screen.getByText("http://127.0.0.1:5050")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(getActiveApiBaseUrl()).toBe("http://127.0.0.1:5050");
  });

  it("calls desktop IPC setPort when running inside Electron", async () => {
    const setPort = vi.fn().mockResolvedValue({
      ok: true,
      port: 8000,
      apiUrl: "http://127.0.0.1:8000",
    });
    window.finflowDesktop = {
      isElectron: true,
      defaultApiUrl: "http://127.0.0.1:3333",
      server: {
        getPort: vi.fn().mockResolvedValue(3333),
        checkPort: vi.fn().mockResolvedValue({ available: true, inUseByFinFlow: false }),
        setPort,
      },
    };

    const onClose = vi.fn();
    render(<ServerConfigModal open={true} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "8000" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(setPort).toHaveBeenCalledWith(8000);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
