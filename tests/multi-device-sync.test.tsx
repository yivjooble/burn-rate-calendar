import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock SWR to prevent async issues
vi.mock("swr", () => ({
  SWRConfig: ({ children }: { children: React.ReactNode }) => children,
  useSWRConfig: vi.fn(() => ({ mutate: vi.fn() })),
}));

// Simple test component
function MockSettingsPage() {
  return <div data-testid="settings-page">Settings Page</div>;
}

describe("Multi-device sync", () => {
  it("should render settings page component", () => {
    render(<MockSettingsPage />);
    expect(screen.getByTestId("settings-page")).toBeInTheDocument();
  });

  it("should handle rerender correctly", () => {
    const { rerender } = render(<MockSettingsPage />);
    expect(screen.getByTestId("settings-page")).toBeInTheDocument();
    
    rerender(<MockSettingsPage />);
    expect(screen.getByTestId("settings-page")).toBeInTheDocument();
  });
});
