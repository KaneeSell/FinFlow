import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UpdateModal } from "./UpdateModal";

const mockInfo = {
  currentVersion: "1.0.0",
  latestVersion: "1.1.0",
  hasUpdate: true,
  releaseName: "FinFlow v1.1.0",
  releaseNotes: "- Auto-updater support",
  releaseUrl: "https://github.com/KaneeSell/FinFlow/releases/tag/v1.1.0",
  downloadUrl: "https://github.com/KaneeSell/FinFlow/releases/download/v1.1.0/FinFlow-1.1.0-win-x64.exe",
  publishedAt: "2026-11-26T15:00:00Z",
};

describe("UpdateModal", () => {
  it("renders version comparison and handles accept/dismiss", () => {
    const onAccept = vi.fn();
    const onDismiss = vi.fn();

    render(
      <UpdateModal
        open={true}
        info={mockInfo}
        downloading={false}
        progress={0}
        error={null}
        onAccept={onAccept}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByRole("dialog", { name: "Atualização Disponível" })).toBeInTheDocument();
    expect(screen.getByText(/v1\.0\.0/)).toBeInTheDocument();
    expect(screen.getAllByText(/v1\.1\.0/).length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole("button", { name: "Atualizar Agora" }));
    expect(onAccept).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("shows download progress when downloading", () => {
    render(
      <UpdateModal
        open={true}
        info={mockInfo}
        downloading={true}
        progress={65}
        error={null}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByText("Baixando atualização...")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
  });
});
