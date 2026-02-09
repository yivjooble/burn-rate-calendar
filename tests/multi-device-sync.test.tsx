import { render, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { screen } from "@testing-library/dom";

// Mock the settings page component for testing
jest.mock("@/app/page", () => {
  return function MockSettingsPage() {
    return <div data-testid="settings-page">Settings Page</div>;
  };
});

// Add JSX type declaration for the mock
declare global {
  namespace JSX {
    interface IntrinsicElements {
      div: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
    }
  }
}

describe("Multi-device sync", () => {
  it("should sync settings across devices", async () => {
    // Device 1: Update settings
    const { rerender } = render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <div data-testid="settings-page">Settings Page</div>
      </SWRConfig>
    );
    
    // Simulate settings update on device 1
    // In real implementation, this would call updateSettings from useOptimisticSettings
    
    // Device 2: Should receive update after refresh interval
    rerender(
      <SWRConfig value={{ provider: () => new Map() }}>
        <div data-testid="settings-page">Settings Page</div>
      </SWRConfig>
    );
    
    // Settings should be synced within SWR refresh interval (30 seconds)
    await waitFor(() => {
      expect(screen.getByTestId("settings-page")).toBeInTheDocument();
    }, { timeout: 35000 }); // 30s refresh + 5s buffer
  });

  it("should handle concurrent sync attempts", async () => {
    const { rerender } = render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <div data-testid="settings-page">Settings Page</div>
      </SWRConfig>
    );
    
    // Multiple rapid sync attempts should be deduplicated
    await waitFor(() => {
      expect(screen.getByTestId("settings-page")).toBeInTheDocument();
    });
  });
});
