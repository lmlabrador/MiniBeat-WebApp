interface SidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export default function LeftSidebar({ activeTab = "dashboard", onTabChange }: SidebarProps) {
  const tabs = [
    { id: "dashboard", icon: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z", label: "Dashboard" },
    { id: "patient", icon: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z", label: "Patient" },
    { id: "reports", icon: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h8c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z", label: "Reports" },
    { id: "settings", icon: "M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.44,0.17-0.48,0.41L9.21,5.35c-0.59,0.24-1.13,0.56-1.62,0.94l-2.39-0.96c-0.22-0.08-0.47,0-0.59,0.22L2.69,8.87c-0.12,0.2-0.07,0.47,0.12,0.61l2.03,1.58c-0.05,0.3-0.07,0.62-0.07,0.94c0,0.32,0.02,0.64,0.07,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.39,2.54c0.04,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.48-0.41l0.39-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.2,0.07-0.47-0.12-0.61L19.14,12.94zM12,15.5c-1.93,0-3.5-1.57-3.5-3.5S10.07,8.5,12,8.5s3.5,1.57,3.5,3.5S13.93,15.5,12,15.5z", label: "Settings" },
  ];

  return (
    <aside
      className="fixed bottom-0 left-0 top-14 z-40 w-16"
      style={{
        background: "rgba(255, 255, 255, 0.72)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        borderRight: "1px solid var(--separator)",
      }}
    >
      <div className="flex flex-col items-center space-y-2 py-4">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange?.(tab.id)}
              className="sidebar-icon cursor-pointer rounded-xl p-3 transition-all"
              style={{
                background: isActive ? "rgba(255, 59, 48, 0.12)" : "transparent",
                color: isActive ? "var(--cornell-red)" : "var(--silver)",
              }}
              title={tab.label}
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d={tab.icon} />
              </svg>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
