export function WindowControls() {
  return (
    <div
      style={
        {
          position: "fixed",
          top: 0,
          right: 0,
          zIndex: 1200,
          display: "flex",
          height: 32,
          WebkitAppRegion: "no-drag",
        } as React.CSSProperties & { WebkitAppRegion?: string }
      }
    >
      <WindowButton title="Minimize" onClick={() => window.muze.windowMinimize()}>
        <path d="M5 12h14" />
      </WindowButton>
      <WindowButton
        title="Maximize"
        onClick={() => window.muze.windowToggleMaximize()}
      >
        <rect x="7" y="7" width="10" height="10" rx="1" />
      </WindowButton>
      <WindowButton
        title="Close"
        danger
        onClick={() => window.muze.windowClose()}
      >
        <path d="m7 7 10 10" />
        <path d="m17 7-10 10" />
      </WindowButton>
    </div>
  );
}

function WindowButton({
  children,
  title,
  danger,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 46,
        height: 32,
        color: "rgba(255,255,255,0.68)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background var(--transition), color var(--transition)",
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = danger
          ? "rgba(232, 72, 85, 0.9)"
          : "rgba(255,255,255,0.08)";
        event.currentTarget.style.color = danger ? "#fff" : "var(--text-primary)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = "transparent";
        event.currentTarget.style.color = "rgba(255,255,255,0.68)";
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  );
}
